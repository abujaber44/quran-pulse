// v8: Android locks a channel's sound at creation time, so any channel
// created by a build where R8 resource shrinking had gutted athan_v2.mp3
// stays silent forever — the only fix is a fresh channel ID. v7 is skipped
// deliberately: it may already exist (broken) on devices from an
// uncommitted production build.
export const ATHAN_CHANNEL_ID = 'athan-alerts-v8';
export const STALE_ATHAN_CHANNEL_IDS = [
  'athan-alerts-v7',
  'athan-alerts-v6',
  'athan-alerts-v5',
  'athan-alerts-v4',
  'athan-alerts-v3',
];
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
