import { computePrayerScheduleWindow, parsePrayerTime, toLocalDateKey } from './prayerTimesService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./citySearch', () => ({
  cacheCityCoordinates: jest.fn(),
  geocodeCity: jest.fn().mockResolvedValue(null),
}));

jest.mock('./islamicEventsService', () => ({
  getHijriToday: jest.fn().mockResolvedValue(null),
  getHijriMonthName: jest.fn().mockReturnValue(''),
}));

/** Carlstadt, NJ — the town Aladhan's geocoder stopped resolving. */
const CARLSTADT = { latitude: 40.8398, longitude: -74.0929 };
const NEW_YORK = { latitude: 40.7128, longitude: -74.006 };

const toMinutes = (value: string): number => {
  const parsed = parsePrayerTime(value);
  if (!parsed) throw new Error(`unparseable time: ${value}`);
  return parsed.hour * 60 + parsed.minute;
};

describe('computePrayerScheduleWindow', () => {
  const startDate = new Date(2026, 7, 27); // 27 Aug 2026

  it('produces a full window for a town no geocoder-backed API resolved', () => {
    const days = computePrayerScheduleWindow(CARLSTADT, 2, startDate, 7);

    expect(days).toHaveLength(7);
    expect(days[0].dateKey).toBe(toLocalDateKey(startDate));
    for (const day of days) {
      for (const prayer of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const) {
        expect(parsePrayerTime(day.timings[prayer])).not.toBeNull();
      }
    }
  });

  it('matches the reference times the app previously received from the API', () => {
    // Aladhan timingsByCity, New York, method 2 (ISNA), 27-08-2026.
    const reference: Record<string, string> = {
      Fajr: '04:58',
      Sunrise: '06:18',
      Dhuhr: '12:57',
      Asr: '16:42',
      Maghrib: '19:36',
      Isha: '20:56',
    };

    const [today] = computePrayerScheduleWindow(NEW_YORK, 2, startDate, 1);

    for (const [key, expected] of Object.entries(reference)) {
      const drift = Math.abs(toMinutes(today.timings[key as keyof typeof today.timings]) - toMinutes(expected));
      expect(drift).toBeLessThanOrEqual(3);
    }
  });

  it('measures the night from sunset to the next sunrise, not maghrib to fajr', () => {
    // The distinction is ~40 minutes on the Night Worship card; adhan's own
    // SunnahTimes uses the other convention.
    const [today] = computePrayerScheduleWindow(NEW_YORK, 2, startDate, 1);

    // Aladhan's values for the same day and convention.
    expect(Math.abs(toMinutes(today.timings.Midnight) - toMinutes('00:57'))).toBeLessThanOrEqual(3);
    expect(Math.abs(toMinutes(today.timings.Lastthird) - toMinutes('02:44'))).toBeLessThanOrEqual(3);
  });

  it('applies the selected calculation method', () => {
    const [isna] = computePrayerScheduleWindow(NEW_YORK, 2, startDate, 1);
    const [mwl] = computePrayerScheduleWindow(NEW_YORK, 3, startDate, 1);

    // ISNA uses a 15° fajr angle, MWL 18° — MWL's fajr must be earlier.
    expect(toMinutes(mwl.timings.Fajr)).toBeLessThan(toMinutes(isna.timings.Fajr));
    expect(mwl.timings.Dhuhr).toBe(isna.timings.Dhuhr);
  });

  it('is deterministic and needs no network', () => {
    const first = computePrayerScheduleWindow(CARLSTADT, 2, startDate, 3);
    const second = computePrayerScheduleWindow(CARLSTADT, 2, startDate, 3);
    expect(first).toEqual(second);
  });
});
