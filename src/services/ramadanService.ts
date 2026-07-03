import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HIJRI_CACHE_PREFIX = '@qp_hijri:';
const TIMINGS_CACHE_PREFIX = '@qp_ramadan_timings:';
const CITY_STORAGE_KEY = 'prayer_city'; // shared with PrayerTimesScreen

export interface RamadanStatus {
  isRamadan: boolean;
  /** Day of Ramadan (1-30), only meaningful when isRamadan */
  dayOfRamadan: number;
  /** Today's Fajr time "HH:MM" (suhoor ends), when a saved city is available */
  fajr?: string;
  /** Today's Maghrib time "HH:MM" (iftar), when a saved city is available */
  maghrib?: string;
}

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const gregorianDDMMYYYY = (): string => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};

async function getHijriToday(): Promise<{ month: number; day: number } | null> {
  const cacheKey = HIJRI_CACHE_PREFIX + todayKey();
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Cache read is best effort — fall through to the network
  }

  try {
    const { data } = await axios.get(`https://api.aladhan.com/v1/gToH/${gregorianDDMMYYYY()}`);
    const hijri = data?.data?.hijri;
    if (!hijri) return null;
    const result = { month: Number(hijri.month.number), day: Number(hijri.day) };
    AsyncStorage.setItem(cacheKey, JSON.stringify(result)).catch(() => {});
    return result;
  } catch {
    return null;
  }
}

async function getTodayTimings(): Promise<{ fajr?: string; maghrib?: string }> {
  const cacheKey = TIMINGS_CACHE_PREFIX + todayKey();
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Cache read is best effort — fall through to the network
  }

  try {
    const city = await AsyncStorage.getItem(CITY_STORAGE_KEY);
    if (!city) return {};
    const url = `https://api.aladhan.com/v1/timingsByCity/${gregorianDDMMYYYY()}?city=${encodeURIComponent(city)}&country=&method=2`;
    const { data } = await axios.get(url);
    const timings = data?.data?.timings;
    if (!timings) return {};
    const result = {
      fajr: (timings.Fajr as string)?.slice(0, 5),
      maghrib: (timings.Maghrib as string)?.slice(0, 5),
    };
    AsyncStorage.setItem(cacheKey, JSON.stringify(result)).catch(() => {});
    return result;
  } catch {
    return {};
  }
}

export async function getRamadanStatus(): Promise<RamadanStatus> {
  const hijri = await getHijriToday();
  if (!hijri || hijri.month !== 9) {
    return { isRamadan: false, dayOfRamadan: 0 };
  }
  const timings = await getTodayTimings();
  return {
    isRamadan: true,
    dayOfRamadan: hijri.day,
    ...timings,
  };
}

/** "HH:MM" today → countdown text like "3h 24m", or null if already passed. */
export function countdownTo(time: string): string | null {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
