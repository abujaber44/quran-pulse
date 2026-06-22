import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'quran_pulse_memorization_progress';

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
