import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

const COUNTDOWN_CHANNEL_ID = 'prayer-countdown-v1';
const COUNTDOWN_NOTIFICATION_ID = 'prayer-countdown-active';
const REMINDER_PREFIX = 'prayer-reminder-30m-';
const COUNTDOWN_MINUTES = 30;

export async function setupCountdownChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(COUNTDOWN_CHANNEL_ID, {
    name: 'Prayer Countdown',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    vibrationPattern: [],
    enableVibrate: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

interface PrayerTime {
  name: string;
  time: string;
  enabled: boolean;
}

function parsePrayerTime(raw: string): { hour: number; minute: number } | null {
  const cleaned = raw.replace(/\s*\(.*\)/, '').trim();
  const parts = cleaned.split(':');
  if (parts.length < 2) return null;
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return null;
  return { hour, minute };
}

export async function schedulePrePrayerReminders(prayers: PrayerTime[]): Promise<void> {
  if (Platform.OS !== 'android') return;

  await setupCountdownChannel();

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of existing) {
    if (notif.identifier.startsWith(REMINDER_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const prayer of prayers) {
    if (!prayer.enabled) continue;
    const parsed = parsePrayerTime(prayer.time);
    if (!parsed) continue;

    const prayerDate = new Date(today);
    prayerDate.setHours(parsed.hour, parsed.minute, 0, 0);

    const reminderDate = new Date(prayerDate.getTime() - COUNTDOWN_MINUTES * 60 * 1000);

    if (reminderDate <= now) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: `${REMINDER_PREFIX}${prayer.name.toLowerCase()}`,
      content: {
        title: `🕌 ${prayer.name}`,
        body: `${prayer.name} in ${COUNTDOWN_MINUTES} minutes — prepare for prayer`,
        priority: Notifications.AndroidNotificationPriority.LOW,
        sticky: true,
        data: { source: 'pre-prayer' },
        ...(Platform.OS === 'android' ? { channelId: COUNTDOWN_CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
        channelId: COUNTDOWN_CHANNEL_ID,
      },
    });
  }
}

const COUNTDOWN_TASK_NAME = 'PRAYER_COUNTDOWN_UPDATE';

TaskManager.defineTask(COUNTDOWN_TASK_NAME, async () => {
  await Notifications.dismissNotificationAsync(COUNTDOWN_NOTIFICATION_ID).catch(() => {});
});

export async function startCountdown(prayerName: string, prayerTimeMs: number): Promise<void> {
  if (Platform.OS !== 'android') return;

  const now = Date.now();
  const remainingMs = prayerTimeMs - now;
  if (remainingMs <= 0) return;

  const remainingMin = Math.ceil(remainingMs / 60000);

  await Notifications.scheduleNotificationAsync({
    identifier: COUNTDOWN_NOTIFICATION_ID,
    content: {
      title: `🕌 ${prayerName}`,
      body: `${prayerName} in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''} — prepare for prayer`,
      priority: Notifications.AndroidNotificationPriority.LOW,
      sticky: true,
      data: { source: 'pre-prayer' },
      ...(Platform.OS === 'android' ? { channelId: COUNTDOWN_CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}
