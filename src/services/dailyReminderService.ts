import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReadingStreak } from './readingProgressService';

const STORAGE_KEY = '@quran_pulse_daily_reminder';
const NOTIFICATION_ID = 'quran-daily-reminder';
const STREAK_NOTIFICATION_ID = 'quran-streak-reminder';
const DAYS_AHEAD = 7;

export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  hour: 20,
  minute: 0,
};

type Lang = 'en' | 'ar';

// Rotating reminder content: a short ayah or hadith-inspired nudge per day
const REMINDER_MESSAGES: Record<Lang, Array<{ title: string; body: string }>> = {
  en: [
    { title: '📖 Quran Time', body: '"Indeed, in the remembrance of Allah do hearts find rest." (13:28)' },
    { title: '📖 Quran Time', body: '"This is the Book about which there is no doubt, a guidance for the righteous." (2:2)' },
    { title: '📖 Quran Time', body: '"So remember Me; I will remember you." (2:152)' },
    { title: '📖 Quran Time', body: '"And We send down of the Quran that which is healing and mercy for the believers." (17:82)' },
    { title: '📖 Quran Time', body: '"Indeed, this Quran guides to that which is most suitable." (17:9)' },
    { title: '📖 Quran Time', body: 'The best of you are those who learn the Quran and teach it. Take a moment to read today.' },
    { title: '📖 Quran Time', body: '"And recite the Quran with measured recitation." (73:4)' },
  ],
  ar: [
    { title: '📖 وقت القرآن', body: '﴿أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ﴾ (الرعد ٢٨)' },
    { title: '📖 وقت القرآن', body: '﴿ذَٰلِكَ الْكِتَابُ لَا رَيْبَ فِيهِ هُدًى لِّلْمُتَّقِينَ﴾ (البقرة ٢)' },
    { title: '📖 وقت القرآن', body: '﴿فَاذْكُرُونِي أَذْكُرْكُمْ﴾ (البقرة ١٥٢)' },
    { title: '📖 وقت القرآن', body: '﴿وَنُنَزِّلُ مِنَ الْقُرْآنِ مَا هُوَ شِفَاءٌ وَرَحْمَةٌ لِّلْمُؤْمِنِينَ﴾ (الإسراء ٨٢)' },
    { title: '📖 وقت القرآن', body: '﴿إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ﴾ (الإسراء ٩)' },
    { title: '📖 وقت القرآن', body: 'خيركم من تعلّم القرآن وعلّمه — خذ لحظة للقراءة اليوم.' },
    { title: '📖 وقت القرآن', body: '﴿وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا﴾ (المزمل ٤)' },
  ],
};

export async function getReminderSettings(): Promise<ReminderSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  return JSON.parse(raw) as ReminderSettings;
}

export async function saveReminderSettings(settings: ReminderSettings, lang: Lang = 'en'): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  if (settings.enabled) {
    await scheduleReminder(settings, lang);
  } else {
    await cancelReminder();
  }
}

/** Re-schedule the next 7 days of reminders (call on app start so content rotates). */
export async function refreshDailyReminder(lang: Lang = 'en'): Promise<void> {
  const settings = await getReminderSettings();
  if (!settings.enabled) return;
  await scheduleReminder(settings, lang);
}

async function scheduleReminder(settings: ReminderSettings, lang: Lang): Promise<void> {
  await cancelReminder();

  const messages = REMINDER_MESSAGES[lang] ?? REMINDER_MESSAGES.en;
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    date.setHours(settings.hour, settings.minute, 0, 0);
    if (date.getTime() <= Date.now()) continue;

    const msg = messages[(dayOfYear + i) % messages.length];
    await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIFICATION_ID}-${i}`,
      content: {
        title: msg.title,
        body: msg.body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    }).catch(() => {});
  }
}

async function cancelReminder(): Promise<void> {
  // Legacy single-id reminder from older versions
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => {});
  for (let i = 0; i < DAYS_AHEAD; i++) {
    await Notifications.cancelScheduledNotificationAsync(`${NOTIFICATION_ID}-${i}`).catch(() => {});
  }
}

/**
 * Streak protection: if the user has an active streak but hasn't read today,
 * schedule a heads-up for 21:00 tonight. Call on app start with the current
 * streak; reading during the day replaces it on the next app open.
 */
export async function scheduleStreakProtection(streak: ReadingStreak, lang: Lang = 'en'): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(STREAK_NOTIFICATION_ID).catch(() => {});

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (streak.currentStreak < 1 || streak.lastReadDate === today) return;

  const fireAt = new Date();
  fireAt.setHours(21, 0, 0, 0);
  if (fireAt.getTime() <= Date.now()) return;

  const content =
    lang === 'ar'
      ? {
          title: '🔥 حافظ على مداومتك',
          body: `مداومتك ${streak.currentStreak} يوم تنتهي الليلة — اقرأ آية واحدة لتستمر!`,
        }
      : {
          title: '🔥 Protect your streak',
          body: `Your ${streak.currentStreak}-day streak ends tonight — read one ayah to keep it going!`,
        };

  await Notifications.scheduleNotificationAsync({
    identifier: STREAK_NOTIFICATION_ID,
    content: { ...content, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  }).catch(() => {});
}
