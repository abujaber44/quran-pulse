export const ATHAN_CHANNEL_ID = 'athan-alerts-v3';
export const ATHAN_NOTIFICATION_ID_PREFIX = 'athan-prayer-';
export const ATHAN_NOTIFICATION_TITLE_PREFIX = 'حان الآن موعد صلاة';

export const buildAthanNotificationId = (prayerName: string): string =>
  `${ATHAN_NOTIFICATION_ID_PREFIX}${prayerName.toLowerCase()}`;
