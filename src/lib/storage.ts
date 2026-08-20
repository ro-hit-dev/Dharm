import type { Language } from '../data/content';

export interface UserProfile {
  name: string;
  age: string;
  language: Language;
}

export interface DayProgress {
  score: number;
  completedAt: string;
  firstCompletedAt?: string;
}

export interface SavedState {
  user: UserProfile | null;
  dayScores: Record<number, DayProgress>;
}

const KEY = 'dharma-quest-v1';

export function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { user: null, dayScores: {} };
    const parsed = JSON.parse(raw) as SavedState;
    return {
      user: parsed.user ?? null,
      dayScores: parsed.dayScores ?? {},
    };
  } catch {
    return { user: null, dayScores: {} };
  }
}

export function saveState(state: SavedState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearState(): void {
  localStorage.removeItem(KEY);
}

export function istNow(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

export function istDateString(date = istNow()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isDayUnlocked(dayIndex: number, dayScores: Record<number, DayProgress>): boolean {
  const now = istNow();

  // A completed day is unavailable for retest until 06:00 IST the next day.
  if (dayScores[dayIndex]) {
    if (now.getHours() < 6) return false;
    return istDateString(now) > dayScores[dayIndex].completedAt.slice(0, 10);
  }

  if (dayIndex === 0) return true;

  const previous = dayScores[dayIndex - 1];
  if (!previous) return false;
  if (now.getHours() < 6) return false;

  // Use firstCompletedAt so retaking an earlier day never relocks later days.
  const firstCompleted = previous.firstCompletedAt ?? previous.completedAt;
  return istDateString(now) > firstCompleted.slice(0, 10);
}
