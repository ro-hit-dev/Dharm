import type { User } from '@supabase/supabase-js';
import type { Language } from '../data/content';
import type { AnswerRecord, DayProgress, UserProfile } from './storage';
import { isSupabaseConfigured, supabase } from './supabase';

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }
  return supabase;
}

function normalizeLanguage(value: unknown): Language {
  return value === 'hi' || value === 'mr' ? value : 'en';
}

function normalizeProfile(user: User, row: Record<string, unknown> | null): UserProfile {
  const metadata = user.user_metadata ?? {};
  const nameFromMetadata = typeof metadata.name === 'string' ? metadata.name : '';
  const ageFromMetadata = typeof metadata.age === 'number' ? String(metadata.age) : typeof metadata.age === 'string' ? metadata.age : '';

  return {
    name: typeof row?.name === 'string' && row.name.trim() ? row.name : nameFromMetadata,
    age: row?.age !== null && row?.age !== undefined ? String(row.age) : ageFromMetadata,
    language: normalizeLanguage(row?.language),
  };
}

export async function loadCloudProfile(user: User): Promise<UserProfile | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .select('id, name, age, language')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return normalizeProfile(user, data as Record<string, unknown>);
}

export async function saveCloudProfile(userId: string, profile: UserProfile): Promise<void> {
  const client = requireClient();
  const age = Number.parseInt(profile.age, 10);
  const { error } = await client.from('profiles').upsert(
    {
      id: userId,
      name: profile.name.trim(),
      age: Number.isFinite(age) ? age : null,
      language: profile.language,
    },
    { onConflict: 'id' },
  );

  if (error) throw error;
}

export async function loadCloudProgress(userId: string): Promise<Record<number, DayProgress>> {
  const client = requireClient();
  const { data, error } = await client
    .from('day_progress')
    .select('id, user_id, day, best_score, attempts, completed_at, first_completed_at')
    .eq('user_id', userId)
    .order('day', { ascending: true });

  if (error) throw error;

  const result: Record<number, DayProgress> = {};
  for (const row of data ?? []) {
    const rawDay = Number(row.day);
    if (!Number.isFinite(rawDay)) continue;
    const dayIndex = rawDay >= 1 ? rawDay - 1 : rawDay;
    if (dayIndex < 0) continue;

    result[dayIndex] = {
      score: Number(row.best_score ?? 0),
      completedAt: String(row.completed_at ?? new Date().toISOString()),
      firstCompletedAt: row.first_completed_at ? String(row.first_completed_at) : undefined,
    };
  }

  return result;
}

export async function recordQuizAttempt(params: {
  userId: string;
  dayIndex: number;
  score: number;
  answers?: AnswerRecord[];
}): Promise<DayProgress> {
  const client = requireClient();
  const dbDay = params.dayIndex + 1;
  const completedAt = new Date().toISOString();

  const { data: existing, error: readError } = await client
    .from('day_progress')
    .select('id, best_score, attempts, completed_at, first_completed_at')
    .eq('user_id', params.userId)
    .eq('day', dbDay)
    .order('attempts', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) throw readError;

  const attempts = Number(existing?.attempts ?? 0) + 1;
  const bestScore = Math.max(Number(existing?.best_score ?? 0), params.score);
  const firstCompletedAt = existing?.first_completed_at ?? completedAt;

  if (existing?.id) {
    const { error } = await client
      .from('day_progress')
      .update({
        best_score: bestScore,
        attempts,
        completed_at: completedAt,
        first_completed_at: firstCompletedAt,
      })
      .eq('id', existing.id)
      .eq('user_id', params.userId);
    if (error) throw error;
  } else {
    const { error } = await client.from('day_progress').insert({
      user_id: params.userId,
      day: dbDay,
      best_score: bestScore,
      attempts,
      completed_at: completedAt,
      first_completed_at: firstCompletedAt,
    });
    if (error) throw error;
  }

  const { error: attemptError } = await client.from('quiz_attempts').insert({
    user_id: params.userId,
    day: dbDay,
    score: params.score,
    completed_at: completedAt,
  });

  if (attemptError) throw attemptError;

  return {
    score: bestScore,
    completedAt,
    firstCompletedAt,
    answers: params.answers,
  };
}

export async function syncLocalProgress(
  userId: string,
  localProgress: Record<number, DayProgress>,
): Promise<Record<number, DayProgress>> {
  const merged = { ...localProgress };
  const cloud = await loadCloudProgress(userId);

  for (const [key, cloudEntry] of Object.entries(cloud)) {
    const day = Number(key);
    const local = merged[day];
    if (!local || cloudEntry.score > local.score) {
      merged[day] = { ...cloudEntry, answers: local?.answers };
    } else if (local.firstCompletedAt && cloudEntry.firstCompletedAt) {
      merged[day] = {
        ...local,
        firstCompletedAt: local.firstCompletedAt < cloudEntry.firstCompletedAt ? local.firstCompletedAt : cloudEntry.firstCompletedAt,
      };
    }
  }

  const localHadNoCloud = Object.keys(cloud).length === 0;
  if (localHadNoCloud) {
    for (const [key, local] of Object.entries(localProgress)) {
      const dayIndex = Number(key);
      if (!Number.isFinite(dayIndex)) continue;
      try {
        await recordQuizAttempt({ userId, dayIndex, score: local.score, answers: local.answers });
      } catch {
        // Keep the local progress usable even if a first-time cloud merge fails.
      }
    }
  }

  return merged;
}
