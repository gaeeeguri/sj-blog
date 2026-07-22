import type { APIRoute } from 'astro';

export const prerender = false;

// Payload shape sent by https://github.com/mcnaveen/health-connect-webhook
interface ExerciseSession {
  type: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  distance_meters?: number;
  steps?: number;
}

interface HeartRateSample {
  bpm: number;
  time: string;
}

interface HealthConnectPayload {
  timestamp: string;
  app_version: string;
  exercise?: ExerciseSession[];
  heart_rate?: HeartRateSample[];
}

// health-connect-webhook attaches no signature/HMAC of its own (see docs/webhook.md) — it only
// supports user-configured static headers per webhook. We rely on a shared-secret Authorization
// header set in the app's "manage headers" UI, matched against this env var.
function isAuthorized(request: Request): boolean {
  const secret = import.meta.env.HEALTH_WEBHOOK_SECRET;
  if (!secret) return false; // fail closed if not configured, never accept unauthenticated requests
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function workoutTypeFor(exerciseType: string): 'strength' | 'cardio' | 'mobility' | 'hiit' | 'other' {
  const t = exerciseType.toLowerCase();
  if (/(hiit|high_intensity|interval)/.test(t)) return 'hiit';
  if (/(strength|weight)/.test(t)) return 'strength';
  if (/(yoga|stretch|pilates|mobility)/.test(t)) return 'mobility';
  if (/(run|walk|bik|cycl|swim|hik|row|elliptical|stair)/.test(t)) return 'cardio';
  return 'other';
}

function slugFor(exerciseType: string, startTime: string): string {
  const raw = `hc-${exerciseType}-${startTime}`;
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function averageHeartRateDuring(session: ExerciseSession, samples?: HeartRateSample[]): number | undefined {
  if (!samples || samples.length === 0) return undefined;
  const start = new Date(session.start_time).getTime();
  const end = new Date(session.end_time).getTime();
  const inWindow = samples.filter((s) => {
    const t = new Date(s.time).getTime();
    return t >= start && t <= end;
  });
  if (inWindow.length === 0) return undefined;
  const avg = inWindow.reduce((sum, s) => sum + s.bpm, 0) / inWindow.length;
  return Math.round(avg);
}

function buildMarkdown(session: ExerciseSession, heartRateSamples?: HeartRateSample[]) {
  const typeLabel = session.type.replace(/_/g, ' ');
  const title = typeLabel.replace(/\b\w/g, (c) => c.toUpperCase());

  const durationMinutes = Math.round(session.duration_seconds / 60);
  const distanceKm =
    session.distance_meters && session.distance_meters > 0
      ? Math.round((session.distance_meters / 1000) * 100) / 100
      : undefined;
  const paceMinPerKm =
    durationMinutes > 0 && distanceKm ? Math.round((durationMinutes / distanceKm) * 100) / 100 : undefined;
  const avgHeartRate = averageHeartRateDuring(session, heartRateSamples);

  const descriptionParts = [`${durationMinutes} min ${typeLabel}`];
  if (distanceKm) descriptionParts.push(`${distanceKm.toFixed(1)} km`);
  const description = descriptionParts.join(' · ');

  const frontmatter = [
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `pubDate: ${session.start_time}`,
    `draft: false`,
    `tags: [${JSON.stringify(typeLabel.toLowerCase())}]`,
    `workoutType: ${workoutTypeFor(session.type)}`,
  ];
  if (durationMinutes > 0) frontmatter.push(`durationMinutes: ${durationMinutes}`);
  if (distanceKm !== undefined) frontmatter.push(`distanceKm: ${distanceKm}`);
  if (paceMinPerKm !== undefined) frontmatter.push(`paceMinPerKm: ${paceMinPerKm}`);
  if (avgHeartRate !== undefined) frontmatter.push(`avgHeartRate: ${avgHeartRate}`);

  return `---\n${frontmatter.join('\n')}\n---\n\nAuto-imported from Health Connect (${title}).\n`;
}

async function githubRequest(path: string, init?: RequestInit) {
  const token = import.meta.env.GITHUB_TOKEN;
  const owner = import.meta.env.GITHUB_OWNER;
  const repo = import.meta.env.GITHUB_REPO;
  if (!token || !owner || !repo) {
    throw new Error('Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO env var');
  }
  return fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'sj-blog-health-webhook',
      ...init?.headers,
    },
  });
}

async function commitWorkout(slug: string, markdown: string): Promise<'created' | 'exists' | 'error'> {
  const path = `src/content/fitness/${slug}.md`;
  const branch = import.meta.env.GITHUB_BRANCH || 'main';

  const existing = await githubRequest(`${path}?ref=${branch}`);
  if (existing.status === 200) return 'exists';
  if (existing.status !== 404) return 'error';

  const created = await githubRequest(path, {
    method: 'PUT',
    body: JSON.stringify({
      message: `chore: import workout ${slug}`,
      content: Buffer.from(markdown, 'utf-8').toString('base64'),
      branch,
    }),
  });
  return created.ok ? 'created' : 'error';
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  let payload: HealthConnectPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }

  const sessions = payload.exercise ?? [];
  const results: Record<string, string> = {};

  for (const session of sessions) {
    if (!session.type || !session.start_time || !session.end_time) continue;
    const slug = slugFor(session.type, session.start_time);
    try {
      const markdown = buildMarkdown(session, payload.heart_rate);
      results[slug] = await commitWorkout(slug, markdown);
    } catch (err) {
      results[slug] = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return new Response(JSON.stringify({ received: sessions.length, results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
