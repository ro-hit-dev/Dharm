import type { User } from '@supabase/supabase-js';
import type { Language } from '../data/content';
import type { AnswerRecord, DayProgress, UserProfile } from './storage';
import { isSupabaseConfigured, supabase } from './supabase';

export interface QuizAttemptSummary {
  id: string;
  day: number;
  attemptNumber: number;
  score: number;
  totalQuestions: number;
  percentage: number;
  startedAt: string | null;
  completedAt: string;
}

export interface QuizAttemptAnswer {
  id: string;
  attemptId: string;
  questionNumber: number;
  questionText: string;
  selectedText: string;
  correctText: string;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizAttemptDetails extends QuizAttemptSummary {
  answers: QuizAttemptAnswer[];
}

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
  const ageFromMetadata =
    typeof metadata.age === 'number'
      ? String(metadata.age)
      : typeof metadata.age === 'string'
        ? metadata.age
        : '';

  return {
    name: typeof row?.name === 'string' && row.name.trim() ? row.name : nameFromMetadata,
    age: row?.age !== null && row?.age !== undefined ? String(row.age) : ageFromMetadata,
    language: normalizeLanguage(row?.language ?? metadata.language),
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
  return normalizeProfile(user, data as Record<string, unknown> | null);
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

function buildAttemptPayload(answers: AnswerRecord[]) {
  return answers.map((answer, index) => ({
    question_number: index + 1,
    question_text: answer.q,
    selected_text: answer.selected,
    correct_text: answer.ans,
    is_correct: answer.correct,
    explanation: answer.trivia,
  }));
}

export async function recordQuizAttempt(params: {
  userId: string;
  dayIndex: number;
  score: number;
  totalQuestions: number;
  answers?: AnswerRecord[];
  startedAt?: string;
  completedAt?: string;
}): Promise<DayProgress> {
  const client = requireClient();
  const dbDay = params.dayIndex + 1;
  const answers = params.answers ?? [];
  const completedAt = params.completedAt ?? new Date().toISOString();

  const { data, error } = await client.rpc('finalize_quiz_attempt', {
    p_day: dbDay,
    p_score: params.score,
    p_total_questions: params.totalQuestions,
    p_answers: buildAttemptPayload(answers),
    p_started_at: params.startedAt ?? completedAt,
    p_completed_at: completedAt,
  });

  if (error) throw error;

  const attempt = Array.isArray(data) ? data[0] : data;
  const bestScore = Number(attempt?.best_score ?? params.score);
  const firstCompletedAt = attempt?.first_completed_at
    ? String(attempt.first_completed_at)
    : completedAt;

  return {
    score: bestScore,
    completedAt: String(attempt?.completed_at ?? completedAt),
    firstCompletedAt,
    answers,
  };
}

export async function loadQuizAttempts(userId: string, dayIndex?: number): Promise<QuizAttemptSummary[]> {
  const client = requireClient();
  let query = client
    .from('quiz_attempts')
    .select('id, day, attempt_number, score, total_questions, percentage, started_at, completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });

  if (dayIndex !== undefined) {
    query = query.eq('day', dayIndex + 1);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    day: Number(row.day),
    attemptNumber: Number(row.attempt_number ?? 0),
    score: Number(row.score ?? 0),
    totalQuestions: Number(row.total_questions ?? 0),
    percentage: Number(row.percentage ?? 0),
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: String(row.completed_at),
  }));
}

export async function loadQuizAttemptDetails(userId: string, attemptId: string): Promise<QuizAttemptDetails> {
  const client = requireClient();
  const { data: attempt, error: attemptError } = await client
    .from('quiz_attempts')
    .select('id, day, attempt_number, score, total_questions, percentage, started_at, completed_at')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single();

  if (attemptError) throw attemptError;

  const { data: answers, error: answerError } = await client
    .from('quiz_attempt_answers')
    .select('id, attempt_id, question_number, question_text, selected_text, correct_text, is_correct, explanation')
    .eq('attempt_id', attemptId)
    .eq('user_id', userId)
    .order('question_number', { ascending: true });

  if (answerError) throw answerError;

  return {
    id: String(attempt.id),
    day: Number(attempt.day),
    attemptNumber: Number(attempt.attempt_number ?? 0),
    score: Number(attempt.score ?? 0),
    totalQuestions: Number(attempt.total_questions ?? 0),
    percentage: Number(attempt.percentage ?? 0),
    startedAt: attempt.started_at ? String(attempt.started_at) : null,
    completedAt: String(attempt.completed_at),
    answers: (answers ?? []).map((row) => ({
      id: String(row.id),
      attemptId: Number(row.attempt_id),
      questionNumber: Number(row.question_number),
      questionText: String(row.question_text),
      selectedText: String(row.selected_text),
      correctText: String(row.correct_text),
      isCorrect: Boolean(row.is_correct),
      explanation: String(row.explanation ?? ''),
    })),
  };
}

export async function syncLocalProgress(
  userId: string,
  localProgress: Record<number, DayProgress>,
): Promise<Record<number, DayProgress>> {
  const cloud = await loadCloudProgress(userId);
  const merged: Record<number, DayProgress> = { ...cloud };

  for (const [key, local] of Object.entries(localProgress)) {
    const dayIndex = Number(key);
    if (!Number.isFinite(dayIndex) || dayIndex < 0) continue;

    const cloudEntry = cloud[dayIndex];
    const localIsBetter = !cloudEntry || local.score > cloudEntry.score;

    if (localIsBetter && (local.answers?.length ?? 0) > 0) {
      try {
        const uploaded = await recordQuizAttempt({
          userId,
          dayIndex,
          score: local.score,
          totalQuestions: local.answers?.length ?? 0,
          answers: local.answers,
          startedAt: local.startedAt,
          completedAt: local.completedAt,
        });
        merged[dayIndex] = uploaded;
      } catch (error) {
        console.error(`Unable to migrate local progress for day ${dayIndex + 1}:`, error);
        merged[dayIndex] = local;
      }
    } else {
      merged[dayIndex] = cloudEntry ?? local;
    }
  }

  const refreshed = await loadCloudProgress(userId);
  Object.assign(merged, refreshed);
  return merged;
}
