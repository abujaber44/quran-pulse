import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@quran_pulse_khatmah';
export const TOTAL_MUSHAF_PAGES = 604;

export interface KhatmahPlan {
  targetDays: number;
  startedAt: string; // yyyy-mm-dd
  /** Unique mushaf pages read since the khatmah started */
  readPages: number[];
  /** Pages read per day, keyed by yyyy-mm-dd (counts new pages only) */
  dailyLog: Record<string, number>;
  completedAt?: string;
}

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export async function getKhatmah(): Promise<KhatmahPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as KhatmahPlan;
  } catch {
    return null;
  }
}

export async function startKhatmah(targetDays: number): Promise<KhatmahPlan> {
  const plan: KhatmahPlan = {
    targetDays,
    startedAt: todayKey(),
    readPages: [],
    dailyLog: {},
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  return plan;
}

export async function endKhatmah(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** Record a mushaf page as read. Only new (unseen) pages count toward progress. */
export async function recordKhatmahPage(page: number): Promise<void> {
  const plan = await getKhatmah();
  if (!plan || plan.completedAt) return;
  if (plan.readPages.includes(page)) return;

  plan.readPages.push(page);
  const today = todayKey();
  plan.dailyLog[today] = (plan.dailyLog[today] ?? 0) + 1;

  if (plan.readPages.length >= TOTAL_MUSHAF_PAGES) {
    plan.completedAt = today;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

export interface KhatmahStatus {
  dayNumber: number; // 1-based day of the plan
  targetDays: number;
  pagesRead: number;
  totalPages: number;
  pagesPerDay: number;
  readToday: number;
  leftToday: number; // 0 when today's quota is met
  percent: number; // 0-100
  completed: boolean;
}

export function getKhatmahStatus(plan: KhatmahPlan): KhatmahStatus {
  const start = new Date(plan.startedAt + 'T00:00:00');
  const now = new Date();
  const dayNumber = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1);
  const pagesRead = plan.readPages.length;
  const pagesPerDay = Math.ceil(TOTAL_MUSHAF_PAGES / plan.targetDays);
  const readToday = plan.dailyLog[todayKey()] ?? 0;

  // Quota is cumulative: by end of day N the reader should be at N * pagesPerDay,
  // so falling behind on one day rolls into the next.
  const cumulativeTarget = Math.min(TOTAL_MUSHAF_PAGES, dayNumber * pagesPerDay);
  const leftToday = Math.max(0, cumulativeTarget - pagesRead);

  return {
    dayNumber: Math.min(dayNumber, plan.targetDays),
    targetDays: plan.targetDays,
    pagesRead,
    totalPages: TOTAL_MUSHAF_PAGES,
    pagesPerDay,
    readToday,
    leftToday,
    percent: Math.min(100, Math.round((pagesRead / TOTAL_MUSHAF_PAGES) * 100)),
    completed: !!plan.completedAt || pagesRead >= TOTAL_MUSHAF_PAGES,
  };
}
