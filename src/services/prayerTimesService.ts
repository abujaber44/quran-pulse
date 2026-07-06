import AsyncStorage from '@react-native-async-storage/async-storage';

export const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];

/** The five prayers plus the extra day markers Aladhan provides */
export const EXTENDED_TIME_KEYS = [
  'Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Midnight', 'Lastthird',
] as const;
export type ExtendedTimeKey = (typeof EXTENDED_TIME_KEYS)[number];

export type PrayerTimings = Record<ExtendedTimeKey, string>;

export type PrayerScheduleDay = {
  /** yyyy-mm-dd local key — Dates don't survive JSON caching */
  dateKey: string;
  timings: PrayerTimings;
  hijriDate?: string; // e.g. "15 Muharram 1448"
  hijriDateAr?: string;
};

export type PrayerScheduleResult = {
  days: PrayerScheduleDay[];
  fromCache: boolean;
};

export interface CalculationMethod {
  id: number;
  label: string;
  labelAr: string;
}

// Aladhan calculation method ids
export const CALCULATION_METHODS: CalculationMethod[] = [
  { id: 2, label: 'ISNA (North America)', labelAr: 'الجمعية الإسلامية لأمريكا الشمالية' },
  { id: 3, label: 'Muslim World League', labelAr: 'رابطة العالم الإسلامي' },
  { id: 4, label: 'Umm Al-Qura (Makkah)', labelAr: 'أم القرى (مكة)' },
  { id: 5, label: 'Egyptian Authority', labelAr: 'الهيئة المصرية العامة' },
  { id: 1, label: 'Karachi (South Asia)', labelAr: 'جامعة كراتشي' },
  { id: 13, label: 'Diyanet (Turkey)', labelAr: 'ديانت (تركيا)' },
];

const METHOD_STORAGE_KEY = 'prayer_calc_method';
const SCHEDULE_CACHE_PREFIX = '@qp_prayer_schedule:';
export const DEFAULT_METHOD_ID = 2; // preserves the app's historical behavior

export const isValidMethodId = (value: unknown): value is number =>
  CALCULATION_METHODS.some((m) => m.id === value);

// --- Athan scheduling debug trace ---
// scheduleNotificationAsync failures on a real device are otherwise
// invisible in a preview/production build (no attached debugger), so we
// persist a summary of the last scheduling run for the Athan Diagnostics
// screen to display.
const ATHAN_DEBUG_KEY = '@qp_athan_debug_trace';

export interface AthanDebugTrace {
  ranAt: number;
  attempted: number;
  succeeded: number;
  failed: number;
  /** Most recent failures, newest last, capped to a handful */
  errors: string[];
  outerError: string | null;
}

export async function saveAthanDebugTrace(trace: AthanDebugTrace): Promise<void> {
  await AsyncStorage.setItem(ATHAN_DEBUG_KEY, JSON.stringify(trace)).catch(() => {});
}

export async function getAthanDebugTrace(): Promise<AthanDebugTrace | null> {
  try {
    const raw = await AsyncStorage.getItem(ATHAN_DEBUG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AthanDebugTrace;
  } catch {
    return null;
  }
}

export async function getCalculationMethod(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(METHOD_STORAGE_KEY);
    const parsed = raw !== null ? Number(raw) : NaN;
    return isValidMethodId(parsed) ? parsed : DEFAULT_METHOD_ID;
  } catch {
    return DEFAULT_METHOD_ID;
  }
}

export async function saveCalculationMethod(methodId: number): Promise<void> {
  if (!isValidMethodId(methodId)) return;
  await AsyncStorage.setItem(METHOD_STORAGE_KEY, String(methodId)).catch(() => {});
}

export const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Builds a local-time Date from a "yyyy-mm-dd" key using numeric components,
 * not string parsing. `new Date(dateKey + 'THH:MM:SS')` is unreliable on
 * Hermes (RN's JS engine) — it can silently produce an Invalid Date or treat
 * the string as UTC, which shifts triggers by hours or fails scheduling
 * outright depending on device timezone.
 */
export const dateKeyToLocalDate = (dateKey: string, hour: number = 0, minute: number = 0): Date => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour, minute, 0, 0);
};

export const parsePrayerTime = (raw: string): { hour: number; minute: number } | null => {
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
};

const extractTimings = (rawTimings: any): PrayerTimings | null => {
  if (!rawTimings || typeof rawTimings !== 'object') return null;

  const extracted: Partial<PrayerTimings> = {};
  for (const key of EXTENDED_TIME_KEYS) {
    const rawValue = rawTimings[key];
    // Only the five prayers are mandatory; extra markers may be absent
    if (typeof rawValue === 'string' && parsePrayerTime(rawValue)) {
      extracted[key] = rawValue;
    } else if ((PRAYER_NAMES as readonly string[]).includes(key)) {
      return null;
    } else {
      extracted[key] = '';
    }
  }

  return extracted as PrayerTimings;
};

const cacheKeyFor = (city: string, methodId: number): string =>
  `${SCHEDULE_CACHE_PREFIX}${city.trim().toLowerCase()}|${methodId}`;

type CachedSchedule = {
  fetchedAt: number;
  days: PrayerScheduleDay[];
};

const readScheduleCache = async (city: string, methodId: number): Promise<PrayerScheduleDay[]> => {
  try {
    const raw = await AsyncStorage.getItem(cacheKeyFor(city, methodId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CachedSchedule;
    if (!Array.isArray(parsed.days)) return [];

    // Only days from today onward are useful
    const todayKey = toLocalDateKey(new Date());
    return parsed.days.filter((day) => day.dateKey >= todayKey);
  } catch {
    return [];
  }
};

const writeScheduleCache = (city: string, methodId: number, days: PrayerScheduleDay[]): void => {
  const payload: CachedSchedule = { fetchedAt: Date.now(), days };
  AsyncStorage.setItem(cacheKeyFor(city, methodId), JSON.stringify(payload)).catch(() => {});
};

// Same key the Prayer Times screen writes the chosen city to
const CITY_STORAGE_KEY = 'prayer_city';

export interface NextPrayerFromCache {
  name: PrayerName;
  at: Date;
  /** The most recent prayer before now, for interval progress. Null before Fajr with no cached yesterday. */
  previousAt: Date | null;
  previousName: PrayerName | null;
  city: string;
}

/**
 * Next upcoming prayer from the locally cached 7-day schedule — no network.
 * Returns null when no city has been chosen yet or the cache is empty
 * (e.g. Prayer Times was never opened).
 */
export async function getNextPrayerFromCache(now: Date = new Date()): Promise<NextPrayerFromCache | null> {
  try {
    const city = await AsyncStorage.getItem(CITY_STORAGE_KEY);
    if (!city) return null;
    const methodId = await getCalculationMethod();
    const days = await readScheduleCache(city, methodId);
    if (days.length === 0) return null;

    let next: { name: PrayerName; at: Date } | null = null;
    let previousAt: Date | null = null;
    let previousName: PrayerName | null = null;

    for (const day of days) {
      for (const name of PRAYER_NAMES) {
        const parsed = parsePrayerTime(day.timings[name]);
        if (!parsed) continue;
        const at = dateKeyToLocalDate(day.dateKey, parsed.hour, parsed.minute);
        if (at <= now) {
          if (!previousAt || at > previousAt) {
            previousAt = at;
            previousName = name;
          }
        } else if (!next || at < next.at) {
          next = { name, at };
        }
      }
      if (next) break;
    }

    if (!next) return null;
    return { ...next, previousAt, previousName, city };
  } catch {
    return null;
  }
}

const fetchDay = async (
  cityName: string,
  methodId: number,
  targetDate: Date
): Promise<PrayerScheduleDay | null> => {
  const day = String(targetDate.getDate()).padStart(2, '0');
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const year = targetDate.getFullYear();
  const url = `https://api.aladhan.com/v1/timingsByCity/${day}-${month}-${year}?city=${encodeURIComponent(cityName)}&country=&method=${methodId}`;

  const response = await fetch(url);
  const data = await response.json();
  if (data?.code !== 200) return null;

  const timings = extractTimings(data?.data?.timings);
  if (!timings) return null;

  const hijri = data?.data?.date?.hijri;
  const hijriDate = hijri
    ? `${hijri.day} ${hijri.month?.en ?? ''} ${hijri.year}`.trim()
    : undefined;
  const hijriDateAr = hijri
    ? `${hijri.day} ${hijri.month?.ar ?? ''} ${hijri.year}`.trim()
    : undefined;

  return {
    dateKey: toLocalDateKey(targetDate),
    timings,
    hijriDate,
    hijriDateAr,
  };
};

/**
 * Fetch the schedule window from Aladhan; on any failure fall back to the
 * cached copy for this city+method so the screen keeps working offline.
 */
export async function fetchPrayerScheduleWindow(
  cityName: string,
  methodId: number,
  startDate: Date,
  days: number
): Promise<PrayerScheduleResult> {
  try {
    const requests: Array<Promise<PrayerScheduleDay | null>> = [];
    for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
      const targetDate = new Date(startDate);
      targetDate.setDate(startDate.getDate() + dayOffset);
      requests.push(fetchDay(cityName, methodId, targetDate).catch(() => null));
    }

    const settled = await Promise.all(requests);
    const fetched = settled
      .filter((item): item is PrayerScheduleDay => item !== null)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    if (fetched.length > 0) {
      writeScheduleCache(cityName, methodId, fetched);
      return { days: fetched, fromCache: false };
    }
  } catch {
    // fall through to cache
  }

  const cached = await readScheduleCache(cityName, methodId);
  return { days: cached, fromCache: true };
}
