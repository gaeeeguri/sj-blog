#!/usr/bin/env node
// Imports workouts from a Samsung Health CSV export into src/content/fitness/samsung-health/.
// Usage: node scripts/import-samsung-health.mjs [path-to-export-dir]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(REPO_ROOT, 'src/content/fitness');

// Samsung Health Data SDK predefined exercise types:
// https://developer.samsung.com/health/android/data/api-reference/EXERCISE_TYPE.html
const EXERCISE_TYPES = {
  '0': { name: 'Custom workout', workoutType: 'other' },
  '1001': { name: 'Walking', workoutType: 'cardio' },
  '1002': { name: 'Running', workoutType: 'cardio' },
  '9002': { name: 'Yoga', workoutType: 'mobility' },
  '11007': { name: 'Cycling', workoutType: 'cardio' },
  '13001': { name: 'Hiking', workoutType: 'cardio' },
  '14001': { name: 'Swimming', workoutType: 'cardio' },
  '15002': { name: 'Weight machine', workoutType: 'strength' },
  '15003': { name: 'Exercise bike', workoutType: 'cardio' },
  '15005': { name: 'Treadmill', workoutType: 'cardio' },
};

function resolveExportDir(argPath) {
  if (argPath) return argPath;
  const samsungHealthDir = join(REPO_ROOT, 'Samsung Health');
  const candidates = readdirSync(samsungHealthDir).filter((name) => name.startsWith('samsunghealth_'));
  if (candidates.length === 0) throw new Error(`No samsunghealth_* export found in ${samsungHealthDir}`);
  candidates.sort();
  return join(samsungHealthDir, candidates[candidates.length - 1]);
}

function parseSamsungCsv(filePath) {
  const raw = readFileSync(filePath, 'utf-8').replace(/^﻿/, '');
  const firstNewline = raw.indexOf('\n');
  const rest = raw.slice(firstNewline + 1);
  return parse(rest, { columns: true, skip_empty_lines: true, relax_column_count: true });
}

function num(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toUtcDate(samsungTimestamp) {
  // Samsung stores naive local wall-clock time like "2025-02-05 08:26:01.000".
  // Treated as UTC so the calendar day stays stable regardless of the reader's timezone.
  return samsungTimestamp.replace(' ', 'T') + 'Z';
}

function yamlString(value) {
  return JSON.stringify(value);
}

function buildMarkdown(row) {
  const datauuid = row['com.samsung.health.exercise.datauuid'];
  const startTime = row['com.samsung.health.exercise.start_time'];
  const exerciseTypeCode = row['com.samsung.health.exercise.exercise_type'];
  if (!datauuid || !startTime || !exerciseTypeCode) return null;

  const exerciseType = EXERCISE_TYPES[exerciseTypeCode] ?? { name: 'Workout', workoutType: 'other' };

  const durationMs = num(row['com.samsung.health.exercise.duration']);
  const roundedDurationMinutes = durationMs ? Math.round(durationMs / 60000) : undefined;
  const durationMinutes = roundedDurationMinutes && roundedDurationMinutes > 0 ? roundedDurationMinutes : undefined;

  const distanceM = num(row['com.samsung.health.exercise.distance']);
  const roundedDistanceKm = distanceM && distanceM > 0 ? Math.round((distanceM / 1000) * 100) / 100 : undefined;
  const distanceKm = roundedDistanceKm && roundedDistanceKm > 0 ? roundedDistanceKm : undefined;

  const roundedPace =
    durationMinutes && distanceKm ? Math.round((durationMinutes / distanceKm) * 100) / 100 : undefined;
  const paceMinPerKm = roundedPace && roundedPace > 0 ? roundedPace : undefined;

  const meanHeartRate = num(row['com.samsung.health.exercise.mean_heart_rate']);
  const roundedHeartRate = meanHeartRate && meanHeartRate > 0 ? Math.round(meanHeartRate) : undefined;
  const avgHeartRate = roundedHeartRate && roundedHeartRate > 0 ? roundedHeartRate : undefined;

  const altitudeGain = num(row['com.samsung.health.exercise.altitude_gain']);
  const elevationM = altitudeGain && altitudeGain > 0 ? Math.round(altitudeGain) : undefined;

  const calorie = num(row['com.samsung.health.exercise.calorie']);

  const customTitle = row['title']?.trim();
  const title = customTitle || exerciseType.name;

  const descriptionParts = [`${durationMinutes ?? '?'} min ${exerciseType.name.toLowerCase()}`];
  if (distanceKm) descriptionParts.push(`${distanceKm.toFixed(1)} km`);
  if (calorie) descriptionParts.push(`${Math.round(calorie)} kcal`);
  const description = descriptionParts.join(' · ');

  const comment = row['com.samsung.health.exercise.comment']?.trim();
  const body = comment || `Auto-imported from Samsung Health (${exerciseType.name}).`;

  const frontmatter = [
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
    `pubDate: ${toUtcDate(startTime)}`,
    `draft: false`,
    `tags: ["${exerciseType.name.toLowerCase()}"]`,
    `workoutType: ${exerciseType.workoutType}`,
  ];
  if (durationMinutes !== undefined) frontmatter.push(`durationMinutes: ${durationMinutes}`);
  if (distanceKm !== undefined) frontmatter.push(`distanceKm: ${distanceKm}`);
  if (paceMinPerKm !== undefined) frontmatter.push(`paceMinPerKm: ${paceMinPerKm}`);
  if (avgHeartRate !== undefined) frontmatter.push(`avgHeartRate: ${avgHeartRate}`);
  if (elevationM !== undefined) frontmatter.push(`elevationM: ${elevationM}`);

  const markdown = `---\n${frontmatter.join('\n')}\n---\n\n${body}\n`;
  return { datauuid, markdown };
}

function main() {
  const exportDir = resolveExportDir(process.argv[2]);
  const exerciseCsv = readdirSync(exportDir).find((name) => name.startsWith('com.samsung.shealth.exercise.') && name.endsWith('.csv'));
  if (!exerciseCsv) throw new Error(`No exercise CSV found in ${exportDir}`);

  const rows = parseSamsungCsv(join(exportDir, exerciseCsv));
  mkdirSync(OUTPUT_DIR, { recursive: true });

  let written = 0;
  let skipped = 0;
  let unmappedTypes = new Set();

  for (const row of rows) {
    const result = buildMarkdown(row);
    if (!result) {
      skipped++;
      continue;
    }
    const exerciseTypeCode = row['com.samsung.health.exercise.exercise_type'];
    if (!EXERCISE_TYPES[exerciseTypeCode]) unmappedTypes.add(exerciseTypeCode);

    writeFileSync(join(OUTPUT_DIR, `${result.datauuid}.md`), result.markdown, 'utf-8');
    written++;
  }

  console.log(`Imported ${written} workouts into ${OUTPUT_DIR}`);
  if (skipped > 0) console.log(`Skipped ${skipped} rows missing required fields`);
  if (unmappedTypes.size > 0) {
    console.log(`Unmapped exercise_type codes (defaulted to "other"): ${[...unmappedTypes].join(', ')}`);
  }
}

main();
