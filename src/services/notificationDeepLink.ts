import { CommonActions } from '@react-navigation/native';
import type * as Notifications from 'expo-notifications';
import { navigationRef, navigateWhenReady } from '../navigation/navigationRef';
import { fetchSurahs } from './quranApi';
import type { Surah } from '../types';

// Routes a tapped notification to the screen it is about, based on the
// `data` payload attached at each scheduling site:
//   athan / pre-prayer / athan-refresh-reminder → PrayerTimes
//   daily-reminder / streak                     → MemorizeUnderstand (Learn)
//   friday-kahf                                 → Surah Al-Kahf (18)

const KAHF_SURAH_ID = 18;

// The cold-start check (getLastNotificationResponseAsync) and the foreground
// listener can both fire for the same tap — handle each response only once.
let lastHandledKey: string | null = null;

function navigate(name: string, params?: Record<string, unknown>): void {
  navigateWhenReady(() => {
    navigationRef.dispatch(CommonActions.navigate({ name, params }));
  });
}

async function openKahf(): Promise<void> {
  try {
    const surahs = (await fetchSurahs()) as Surah[];
    const surah = surahs.find((s) => Number(s.id) === KAHF_SURAH_ID);
    if (surah) {
      navigate('Surah', { surah, surahs });
      return;
    }
  } catch {
    // Offline with an empty cache — fall through to the Learn screen
  }
  navigate('MemorizeUnderstand');
}

export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): void {
  const key = `${response.notification.request.identifier}:${response.notification.date}`;
  if (key === lastHandledKey) return;
  lastHandledKey = key;

  const data = response.notification.request.content.data as
    | Record<string, unknown>
    | undefined;
  if (!data) return;

  const source = typeof data.source === 'string' ? data.source : '';
  const targetScreen = typeof data.targetScreen === 'string' ? data.targetScreen : '';

  if (source === 'friday-kahf') {
    void openKahf();
    return;
  }
  if (source === 'daily-reminder' || source === 'streak') {
    navigate('MemorizeUnderstand');
    return;
  }
  if (source === 'athan' || source === 'pre-prayer' || targetScreen === 'PrayerTimes') {
    navigate('PrayerTimes');
  }
}
