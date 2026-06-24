import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@quran_pulse_reading_progress';
const STREAK_KEY = '@quran_pulse_reading_streak';

export interface ReadingProgress {
  surahsRead: Record<number, { lastAyah: number; completedAt?: number }>;
  totalAyahsRead: number;
  lastReadAt: number;
}

export interface ReadingStreak {
  currentStreak: number;
  longestStreak: number;
  lastReadDate: string;
}

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export async function getReadingProgress(): Promise<ReadingProgress> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return { surahsRead: {}, totalAyahsRead: 0, lastReadAt: 0 };
  return JSON.parse(raw) as ReadingProgress;
}

export async function recordAyahRead(surahId: number, ayahNum: number, totalVerses: number): Promise<void> {
  const progress = await getReadingProgress();

  const existing = progress.surahsRead[surahId];
  if (!existing || ayahNum > existing.lastAyah) {
    progress.surahsRead[surahId] = {
      lastAyah: ayahNum,
      completedAt: ayahNum >= totalVerses ? Date.now() : existing?.completedAt,
    };
    progress.totalAyahsRead++;
  }

  progress.lastReadAt = Date.now();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  await updateStreak();
}

export async function getReadingStreak(): Promise<ReadingStreak> {
  const raw = await AsyncStorage.getItem(STREAK_KEY);
  if (!raw) return { currentStreak: 0, longestStreak: 0, lastReadDate: '' };
  return JSON.parse(raw) as ReadingStreak;
}

async function updateStreak(): Promise<void> {
  const streak = await getReadingStreak();
  const today = todayKey();

  if (streak.lastReadDate === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (streak.lastReadDate === yesterdayKey) {
    streak.currentStreak++;
  } else {
    streak.currentStreak = 1;
  }

  if (streak.currentStreak > streak.longestStreak) {
    streak.longestStreak = streak.currentStreak;
  }

  streak.lastReadDate = today;
  await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(streak));
}

export function getSurahProgress(progress: ReadingProgress, surahId: number, totalVerses: number): number {
  const entry = progress.surahsRead[surahId];
  if (!entry) return 0;
  return Math.min(100, Math.round((entry.lastAyah / totalVerses) * 100));
}

export function getCompletedSurahCount(progress: ReadingProgress): number {
  return Object.values(progress.surahsRead).filter(s => s.completedAt).length;
}
