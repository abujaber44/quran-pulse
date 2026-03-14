export const ATHAN_CHANNEL_ID = 'athan-alerts-v5';
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
