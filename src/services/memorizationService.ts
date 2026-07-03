import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'quran_pulse_memorization_progress';
const SCHEDULE_KEY = 'quran_pulse_review_schedule';

// Spaced-repetition review intervals in days. A correct answer moves a verse
// up one level; a wrong answer resets it to level 0 (review again tomorrow).
const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60];

export interface ReviewEntry {
  level: number;
  dueDate: string; // yyyy-mm-dd
  lastReviewed: string; // yyyy-mm-dd
}

export type ReviewSchedule = Record<string, ReviewEntry>;

const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dateKey(d);
};

export async function getReviewSchedule(): Promise<ReviewSchedule> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ReviewSchedule;
  } catch {
    return {};
  }
}

export async function updateReviewResults(attempts: QuizAttempt[]): Promise<void> {
  if (attempts.length === 0) return;
  const schedule = await getReviewSchedule();
  const today = dateKey(new Date());

  for (const attempt of attempts) {
    const existing = schedule[attempt.verseKey];
    const level = attempt.correct
      ? Math.min((existing?.level ?? -1) + 1, REVIEW_INTERVALS.length - 1)
      : 0;
    schedule[attempt.verseKey] = {
      level,
      dueDate: addDays(REVIEW_INTERVALS[level]),
      lastReviewed: today,
    };
  }
  await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
}

/**
 * Verses due for review: any bookmarked verse never reviewed before,
 * or whose scheduled review date has arrived.
 */
export function getDueVerseKeys(bookmarkedKeys: string[], schedule: ReviewSchedule): string[] {
  const today = dateKey(new Date());
  return bookmarkedKeys.filter((key) => {
    const entry = schedule[key];
    return !entry || entry.dueDate <= today;
  });
}

export interface QuizAttempt {
  verseKey: string;
  correct: boolean;
  timestamp: number;
}

export async function getQuizHistory(): Promise<QuizAttempt[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as QuizAttempt[];
}

export async function saveQuizResult(attempt: QuizAttempt): Promise<void> {
  const history = await getQuizHistory();
  history.push(attempt);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export async function saveQuizResults(attempts: QuizAttempt[]): Promise<void> {
  const history = await getQuizHistory();
  history.push(...attempts);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  await updateReviewResults(attempts);
}

export function getWeakVerses(history: QuizAttempt[]): string[] {
  const stats = new Map<string, { correct: number; total: number }>();

  for (const attempt of history) {
    const entry = stats.get(attempt.verseKey) ?? { correct: 0, total: 0 };
    entry.total++;
    if (attempt.correct) entry.correct++;
    stats.set(attempt.verseKey, entry);
  }

  return Array.from(stats.entries())
    .filter(([, s]) => s.correct / s.total < 0.6)
    .map(([verseKey]) => verseKey);
}
