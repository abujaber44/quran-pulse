// v6: bumped after R8 resource shrinking stripped athan_v2.mp3 from release
// builds — devices that created the v5 channel while the sound file was
// missing keep the broken (silent) sound forever, because Android locks a
// channel's settings after creation. A new channel ID forces a fresh channel
// with a valid sound URI.
export const ATHAN_CHANNEL_ID = 'athan-alerts-v6';
export const STALE_ATHAN_CHANNEL_IDS = ['athan-alerts-v5', 'athan-alerts-v4', 'athan-alerts-v3'];
export const ATHAN_REMINDER_CHANNEL_ID = 'athan-refresh-reminders-v1';
export const ATHAN_NOTIFICATION_ID_PREFIX = 'athan-prayer-';
export const ATHAN_NOTIFICATION_TITLE_PREFIX = 'حان الآن موعد صلاة';
export const ATHAN_REFRESH_REMINDER_ID = 'athan-refresh-reminder';
export const ATHAN_SCHEDULE_WINDOW_DAYS = 7;

const formatLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

export const buildAthanNotificationId = (prayerName: string, date: Date): string =>
  `${ATHAN_NOTIFICATION_ID_PREFIX}${prayerName.toLowerCase()}-${formatLocalDateKey(date)}`;
