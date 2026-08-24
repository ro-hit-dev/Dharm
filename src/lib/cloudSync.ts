import { supabase } from './supabase';
import type { DayProgress, SavedState, UserProfile } from './storage';
import type { Session } from '@supabase/supabase-js';

export interface CloudProfile {
  id: string;
  name: string | null;
  age: number | null;
  language: UserProfile['language'];
  created_at: string;
}

export interface CloudDayProgress {
  user_id: string;
  day: number;
  best_score: number;
  attempts: number;
  completed_at: string | null;
  first_completed_at: string | null;
}

function isLanguage(value: unknown): value is UserProfile['language'] {
  return value === 'en' || value === 'hi' || value === 'mr';
}

export async function loadCloudState(session: Session): Promise<{
  user: UserProfile | null;
  dayScores: Record<number, DayProgress>;
}> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,name,age,language,created_at')
    .eq('id', session.user.id)
    .maybeSingle<CloudProfile>();

  if (profileError && profileError.code !== 'PGRST116') {
    throw profileError;
  }

  const { data: progress, error: progressError } = await supabase
    .from('day_progress')
    .select('user_id,day,best_score,attempts,completed_at,first_completed_at')
    .eq('user_id', session.user.id)
    .order('day', { ascending: true })
    .returns<CloudDayProgress[]>();

  if (progressError) throw progressError;

  const dayScores: Record<number, DayProgress> = {};
  for (const row of progress ?? []) {
    if (!row.completed_at) continue;
    dayScores[row.day - 1] = {
      score: row.best_score,
      completedAt: row.completed_at,
      firstCompletedAt: row.first_completed_at ?? row.completed_at,
      attempts: row.attempts,
    };
  }

  const metadataName = typeof session.user.user_metadata?.name === 'string'
    ? session.user.user_metadata.name
    : '';

  const user: UserProfile | null = profile
    ? {
        name: profile.name ?? metadataName,
        age: profile.age == null ? '' : String(profile.age),
        language: isLanguage(profile.language) ? profile.language : 'en',
      }
    : metadataName
      ? { name: metadataName, age: '', language: 'en' }
      : null;

  return { user, dayScores };
}

export async function upsertCloudProfile(session: Session, user: UserProfile): Promise<void> {
  const age = Number(user.age);
  const { error } = await supabase.from('profiles').upsert(
    {
      id: session.user.id,
      name: user.name.trim() || null,
      age: Number.isFinite(age) ? age : null,
      language: user.language,
    },
    { onConflict: 'id' },
  );

  if (error) throw error;
}

export async function saveCloudProgress(
  session: Session,
  dayIndex: number,
  progress: DayProgress,
): Promise<void> {
  const score = progress.score;
  const existing = await supabase
    .from('day_progress')
    .select('best_score,attempts,completed_at,first_completed_at')
    .eq('user_id', session.user.id)
    .eq('day', dayIndex + 1)
    .maybeSingle<Pick<CloudDayProgress, 'best_score' | 'attempts' | 'completed_at' | 'first_completed_at'>>();

  if (existing.error && existing.error.code !== 'PGRST116') throw existing.error;

  const previous = existing.data;
  const attempts = (previous?.attempts ?? 0) + 1;
  const bestScore = Math.max(previous?.best_score ?? 0, score);
  const firstCompletedAt = previous?.first_completed_at ?? progress.firstCompletedAt ?? progress.completedAt;

  const { error } = await supabase.from('day_progress').upsert(
    {
      user_id: session.user.id,
      day: dayIndex + 1,
      best_score: bestScore,
      attempts,
      completed_at: progress.completedAt,
      first_completed_at: firstCompletedAt,
    },
    { onConflict: 'user_id,day' },
  );

  if (error) throw error;
}

export async function saveCloudAttempt(
  session: Session,
  dayIndex: number,
  score: number,
): Promise<void> {
  const { error } = await supabase.from('quiz_attempts').insert({
    user_id: session.user.id,
    day: dayIndex + 1,
    score,
  });

  if (error) throw error;
}

export async function migrateGuestState(
  session: Session,
  state: SavedState,
): Promise<void> {
  if (state.user) {
    await upsertCloudProfile(session, state.user);
  }

  const { data: existingRows, error } = await supabase
    .from('day_progress')
    .select('day,best_score,attempts,completed_at,first_completed_at')
    .eq('user_id', session.user.id)
    .returns<Array<Omit<CloudDayProgress, 'user_id'>>>();

  if (error) throw error;

  const existing = new Map((existingRows ?? []).map((row) => [row.day, row]));

  const rows = Object.entries(state.dayScores).map(([index, progress]) => {
    const day = Number(index) + 1;
    const prior = existing.get(day);
    return {
      user_id: session.user.id,
      day,
      best_score: Math.max(prior?.best_score ?? 0, progress.score),
      attempts: (prior?.attempts ?? 0) + (progress.attempts ?? 1),
      completed_at: prior?.completed_at ?? progress.completedAt,
      first_completed_at: prior?.first_completed_at ?? progress.firstCompletedAt ?? progress.completedAt,
    };
  });

  if (rows.length) {
    const { error: upsertError } = await supabase
      .from('day_progress')
      .upsert(rows, { onConflict: 'user_id,day' });
    if (upsertError) throw upsertError;
  }
}
