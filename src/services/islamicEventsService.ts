import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://api.aladhan.com/v1';
const HTOG_CACHE_PREFIX = '@qp_htog:';
const HIJRI_TODAY_CACHE_PREFIX = '@qp_hijri:'; // shared shape with ramadanService

export interface IslamicEvent {
  /** Hijri month 1-12 */
  month: number;
  /** Hijri day 1-30 */
  day: number;
  nameEn: string;
  nameAr: string;
  emoji: string;
}

// Fixed hijri-date occasions, in hijri calendar order
export const ISLAMIC_EVENTS: IslamicEvent[] = [
  { month: 1, day: 1, nameEn: 'Islamic New Year', nameAr: 'رأس السنة الهجرية', emoji: '🌙' },
  { month: 1, day: 10, nameEn: 'Day of Ashura', nameAr: 'يوم عاشوراء', emoji: '🤲' },
  { month: 3, day: 12, nameEn: 'Mawlid al-Nabi', nameAr: 'المولد النبوي', emoji: '💚' },
  { month: 7, day: 27, nameEn: 'Isra & Mi\'raj', nameAr: 'الإسراء والمعراج', emoji: '✨' },
  { month: 8, day: 15, nameEn: 'Mid-Sha\'ban', nameAr: 'ليلة النصف من شعبان', emoji: '🌕' },
  { month: 9, day: 1, nameEn: 'First day of Ramadan', nameAr: 'بداية رمضان', emoji: '🌙' },
  { month: 9, day: 27, nameEn: 'Laylat al-Qadr (expected)', nameAr: 'ليلة القدر (المتوقعة)', emoji: '⭐' },
  { month: 10, day: 1, nameEn: 'Eid al-Fitr', nameAr: 'عيد الفطر', emoji: '🎉' },
  { month: 12, day: 9, nameEn: 'Day of Arafah', nameAr: 'يوم عرفة', emoji: '🕋' },
  { month: 12, day: 10, nameEn: 'Eid al-Adha', nameAr: 'عيد الأضحى', emoji: '🎉' },
];

export const HIJRI_MONTH_NAMES_EN = [
  'Muharram', 'Safar', 'Rabi\' I', 'Rabi\' II',
  'Jumada I', 'Jumada II', 'Rajab', 'Sha\'ban',
  'Ramadan', 'Shawwal', 'Dhul-Qa\'dah', 'Dhul-Hijjah',
];

export const HIJRI_MONTH_NAMES_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
  'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

export const getHijriMonthName = (month: number, lang: string): string => {
  const names = lang === 'ar' ? HIJRI_MONTH_NAMES_AR : HIJRI_MONTH_NAMES_EN;
  return names[month - 1] ?? '';
};

/** Events falling on a given hijri month/day (for grid markers) */
export const getEventsForHijriDay = (month: number, day: number): IslamicEvent[] =>
  ISLAMIC_EVENTS.filter((e) => e.month === month && e.day === day);

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export async function getHijriToday(): Promise<{ year: number; month: number; day: number } | null> {
  const cacheKey = HIJRI_TODAY_CACHE_PREFIX + todayKey();
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      // ramadanService caches {month, day}; tolerate entries without year
      if (parsed.year) return parsed;
    }
  } catch {
    // fall through to the network
  }

  try {
    const d = new Date();
    const formatted = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    const { data } = await axios.get(`${API_BASE}/gToH/${formatted}`);
    const hijri = data?.data?.hijri;
    if (!hijri) return null;
    const result = {
      year: Number(hijri.year),
      month: Number(hijri.month.number),
      day: Number(hijri.day),
    };
    AsyncStorage.setItem(cacheKey, JSON.stringify(result)).catch(() => {});
    return result;
  } catch {
    return null;
  }
}

/** Convert a hijri date to a gregorian Date via Aladhan, cached forever. */
async function hijriToGregorian(day: number, month: number, year: number): Promise<Date | null> {
  const cacheKey = `${HTOG_CACHE_PREFIX}${year}-${month}-${day}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = new Date(cached);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  } catch {
    // fall through to the network
  }

  try {
    const { data } = await axios.get(`${API_BASE}/hToG/${day}-${month}-${year}`);
    const greg = data?.data?.gregorian?.date as string | undefined; // DD-MM-YYYY
    if (!greg) return null;
    const [dd, mm, yyyy] = greg.split('-').map(Number);
    const result = new Date(yyyy, mm - 1, dd);
    if (Number.isNaN(result.getTime())) return null;
    AsyncStorage.setItem(cacheKey, result.toISOString()).catch(() => {});
    return result;
  } catch {
    return null;
  }
}

export interface UpcomingEvent extends IslamicEvent {
  hijriYear: number;
  gregorianDate: Date;
  /** Whole days from today (0 = today) */
  daysAway: number;
}

/**
 * The next `count` Islamic occasions from today, with gregorian dates and
 * day countdowns. Conversions are cached, so after the first load this is
 * fully offline for the rest of the hijri year.
 */
export async function getUpcomingEvents(count: number = 6): Promise<UpcomingEvent[]> {
  const hijriToday = await getHijriToday();
  if (!hijriToday) return [];

  const candidates = ISLAMIC_EVENTS.map((event) => {
    const isPast =
      event.month < hijriToday.month ||
      (event.month === hijriToday.month && event.day < hijriToday.day);
    return { ...event, hijriYear: isPast ? hijriToday.year + 1 : hijriToday.year };
  });

  const resolved = await Promise.all(
    candidates.map(async (event) => {
      const gregorianDate = await hijriToGregorian(event.day, event.month, event.hijriYear);
      return gregorianDate ? { ...event, gregorianDate } : null;
    })
  );

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return resolved
    .filter((e): e is UpcomingEvent & { gregorianDate: Date } => e !== null)
    .map((e) => ({
      ...e,
      daysAway: Math.round((e.gregorianDate.getTime() - startOfToday.getTime()) / 86400000),
    }))
    .filter((e) => e.daysAway >= 0)
    .sort((a, b) => a.daysAway - b.daysAway)
    .slice(0, count);
}
