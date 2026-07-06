import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@quran_pulse_kahf_reminder';
const NOTIFICATION_ID = 'quran-kahf-reminder';
const WEEKS_AHEAD = 4;
const FRIDAY = 5; // Date.getDay()

export interface KahfReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

// On by default — a gentle weekly sunnah reminder. Users can turn it off in
// Settings; scheduling is a no-op until notification permission is granted.
const DEFAULT_SETTINGS: KahfReminderSettings = {
  enabled: true,
  hour: 9,
  minute: 0,
};

type Lang = 'en' | 'ar';

const KAHF_MESSAGES: Record<Lang, { title: string; body: string }> = {
  en: {
    title: '🕌 It’s Friday',
    body: 'Whoever reads Surah Al-Kahf on Friday will have a light between the two Fridays. Tap to start reading.',
  },
  ar: {
    title: '🕌 يوم الجمعة',
    body: 'من قرأ سورة الكهف يوم الجمعة أضاء له من النور ما بين الجمعتين — اضغط لبدء القراءة.',
  },
};

export async function getKahfReminderSettings(): Promise<KahfReminderSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  return JSON.parse(raw) as KahfReminderSettings;
}

export async function saveKahfReminderSettings(
  settings: KahfReminderSettings,
  lang: Lang = 'en'
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  if (settings.enabled) {
    await scheduleKahfReminders(settings, lang);
  } else {
    await cancelKahfReminders();
  }
}

/** Re-schedule the next 4 Fridays (call on app start, like the daily reminder). */
export async function refreshFridayKahfReminder(lang: Lang = 'en'): Promise<void> {
  const settings = await getKahfReminderSettings();
  if (!settings.enabled) return;
  await scheduleKahfReminders(settings, lang);
}

async function scheduleKahfReminders(settings: KahfReminderSettings, lang: Lang): Promise<void> {
  await cancelKahfReminders();

  const msg = KAHF_MESSAGES[lang] ?? KAHF_MESSAGES.en;

  const first = new Date();
  first.setHours(settings.hour, settings.minute, 0, 0);
  let daysUntilFriday = (FRIDAY - first.getDay() + 7) % 7;
  if (daysUntilFriday === 0 && first.getTime() <= Date.now()) {
    daysUntilFriday = 7;
  }
  first.setDate(first.getDate() + daysUntilFriday);

  for (let i = 0; i < WEEKS_AHEAD; i++) {
    const date = new Date(first);
    date.setDate(first.getDate() + i * 7);

    await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIFICATION_ID}-${i}`,
      content: {
        title: msg.title,
        body: msg.body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        data: { source: 'friday-kahf' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    }).catch(() => {});
  }
}

async function cancelKahfReminders(): Promise<void> {
  for (let i = 0; i < WEEKS_AHEAD; i++) {
    await Notifications.cancelScheduledNotificationAsync(`${NOTIFICATION_ID}-${i}`).catch(() => {});
  }
}
