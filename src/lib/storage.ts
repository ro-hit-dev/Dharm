import type { Language } from '../data/content';

export interface AnswerRecord {
  correct: boolean;
  trivia: string;
  q: string;
  ans: string;
  selected: string;
}

export interface UserProfile {
  name: string;
  age: string;
  language: Language;
}

export interface DayProgress {
  score: number;
  completedAt: string;
  firstCompletedAt?: string;
  answers?: AnswerRecord[];
}

export interface SavedState {
  user: UserProfile | null;
  dayScores: Record<number, DayProgress>;
  /** null/undefined = guest-local data; a UUID = data cached for that account. */
  ownerId?: string | null;
}

const KEY = 'dharma-quest-v2';
const LEGACY_KEY = 'dharma-quest-v1';

const EMPTY_STATE: SavedState = {
  user: null,
  dayScores: {},
  ownerId: null,
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function parseState(raw: string | null): SavedState {
  if (!raw) return EMPTY_STATE;

  try {
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    const user = parsed.user;
    const dayScores = parsed.dayScores;
    const ownerId = typeof parsed.ownerId === 'string' ? parsed.ownerId : null;

    return {
      user:
        user && typeof user === 'object'
          ? {
              name: typeof user.name === 'string' ? user.name : '',
              age: typeof user.age === 'string' ? user.age : String(user.age ?? ''),
              language: user.language === 'hi' || user.language === 'mr' ? user.language : 'en',
            }
          : null,
      dayScores: dayScores && typeof dayScores === 'object' ? dayScores as Record<number, DayProgress> : {},
      ownerId,
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function loadState(): SavedState {
  if (!canUseStorage()) return EMPTY_STATE;

  const current = parseState(window.localStorage.getItem(KEY));
  if (current.user || Object.keys(current.dayScores).length > 0) return current;

  const legacy = parseState(window.localStorage.getItem(LEGACY_KEY));
  if (legacy.user || Object.keys(legacy.dayScores).length > 0) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(legacy));
    } catch {
      // Keep the in-memory state usable even when storage is unavailable.
    }
    return legacy;
  }

  return EMPTY_STATE;
}

export function saveState(state: SavedState): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota/private-mode failures should not crash the application.
  }
}

export function clearState(): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function istNow(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

export function istDateString(date = istNow()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Day zero is always available. A completed day can be retaken after 06:00 IST
 * on the following calendar day. The following day unlocks using firstCompletedAt
 * so retakes never reset the user's forward progress.
 */
export function isDayUnlocked(dayIndex: number, dayScores: Record<number, DayProgress>): boolean {
  if (dayIndex < 0) return false;
  if (dayIndex === 0 && !dayScores[0]) return true;

  const now = istNow();
  const today = istDateString(now);
  const afterUnlock = now.getHours() >= 6;
  if (!afterUnlock) return false;

  const current = dayScores[dayIndex];
  if (current) {
    return today > current.completedAt.slice(0, 10);
  }

  const previous = dayScores[dayIndex - 1];
  if (!previous) return false;

  const firstCompleted = previous.firstCompletedAt ?? previous.completedAt;
  return today > firstCompleted.slice(0, 10);
}
