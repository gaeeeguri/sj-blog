import type { CollectionEntry } from 'astro:content';

export type FitnessCategory = 'running' | 'workout';

/** UTC calendar-day midnight — mirrors TrainingHeatmap.astro's helper. */
function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Sunday-start week (matches TrainingHeatmap's week convention). */
function weekStart(d: Date): Date {
  const m = utcMidnight(d);
  m.setUTCDate(m.getUTCDate() - m.getUTCDay());
  return m;
}

const DAY_MS = 86_400_000;

/**
 * Category discriminator: entries carrying a distance reading are
 * distance-cardio ("running"); everything else is duration/HR-only ("workout").
 */
export function categoryOf(entry: CollectionEntry<'fitness'>): FitnessCategory {
  return entry.data.distanceKm !== undefined ? 'running' : 'workout';
}

/**
 * Plain walking dominates the auto-synced log (1600+ entries) and isn't a
 * "run" or a "workout" — excluded from the fitness dashboard entirely.
 */
export function isWalking(entry: CollectionEntry<'fitness'>): boolean {
  return entry.data.title.trim().toLowerCase() === 'walking';
}

export function excludeWalking(entries: CollectionEntry<'fitness'>[]): CollectionEntry<'fitness'>[] {
  return entries.filter((entry) => !isWalking(entry));
}

export interface WeeklyTrendPoint {
  weekStartISO: string;
  distanceKm: number;
  durationMinutes: number;
}

export interface FitnessStats {
  totalWorkouts: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  currentStreakDays: number;
  thisWeekDistanceKm: number;
  thisMonthDistanceKm: number;
  avgPaceMinPerKm: number | undefined;
  categoryBreakdown: {
    running: { count: number; minutes: number; distanceKm: number };
    workout: { count: number; minutes: number };
  };
  weeklyTrend: WeeklyTrendPoint[];
}

export function computeFitnessStats(entries: CollectionEntry<'fitness'>[]): FitnessStats {
  let totalDistanceKm = 0;
  let totalDurationMinutes = 0;

  // Weighted pace accumulator: total minutes-run / total km-run across paced entries.
  let paceWeightedKm = 0;
  let paceMinutes = 0;

  const running = { count: 0, minutes: 0, distanceKm: 0 };
  const workout = { count: 0, minutes: 0 };

  const now = new Date();
  const today = utcMidnight(now);
  const currentWeekStart = weekStart(now);
  const currentMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();

  let thisWeekDistanceKm = 0;
  let thisMonthDistanceKm = 0;

  const activeDays = new Set<string>();
  let mostRecentDay = -Infinity;

  // 12-week Sunday-start trend, current week last.
  const trend: WeeklyTrendPoint[] = [];
  const trendIndex = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const ws = new Date(currentWeekStart);
    ws.setUTCDate(ws.getUTCDate() - i * 7);
    const iso = dateKey(ws);
    trendIndex.set(iso, trend.length);
    trend.push({ weekStartISO: iso, distanceKm: 0, durationMinutes: 0 });
  }

  for (const entry of entries) {
    const { distanceKm, durationMinutes, paceMinPerKm } = entry.data;
    const dist = distanceKm ?? 0;
    const dur = durationMinutes ?? 0;

    totalDistanceKm += dist;
    totalDurationMinutes += dur;

    if (categoryOf(entry) === 'running') {
      running.count += 1;
      running.minutes += dur;
      running.distanceKm += dist;
    } else {
      workout.count += 1;
      workout.minutes += dur;
    }

    if (paceMinPerKm !== undefined) {
      const w = dist > 0 ? dist : 1;
      paceWeightedKm += w;
      paceMinutes += paceMinPerKm * w;
    }

    const day = utcMidnight(entry.data.pubDate);
    const dayTime = day.getTime();
    activeDays.add(dateKey(day));
    if (dayTime > mostRecentDay) mostRecentDay = dayTime;

    if (dayTime >= currentWeekStart.getTime()) thisWeekDistanceKm += dist;
    if (day.getUTCFullYear() * 12 + day.getUTCMonth() === currentMonth) thisMonthDistanceKm += dist;

    const ws = weekStart(entry.data.pubDate);
    const idx = trendIndex.get(dateKey(ws));
    if (idx !== undefined) {
      trend[idx].distanceKm += dist;
      trend[idx].durationMinutes += dur;
    }
  }

  // Streak: consecutive days ending at the most recent active day, but only if
  // that day is today or yesterday.
  let currentStreakDays = 0;
  if (mostRecentDay !== -Infinity) {
    const gap = today.getTime() - mostRecentDay;
    if (gap === 0 || gap === DAY_MS) {
      let cursor = mostRecentDay;
      while (activeDays.has(dateKey(new Date(cursor)))) {
        currentStreakDays += 1;
        cursor -= DAY_MS;
      }
    }
  }

  return {
    totalWorkouts: entries.length,
    totalDistanceKm,
    totalDurationMinutes,
    currentStreakDays,
    thisWeekDistanceKm,
    thisMonthDistanceKm,
    avgPaceMinPerKm: paceWeightedKm > 0 ? paceMinutes / paceWeightedKm : undefined,
    categoryBreakdown: { running, workout },
    weeklyTrend: trend,
  };
}
