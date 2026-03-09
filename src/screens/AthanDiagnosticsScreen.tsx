import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import ScreenIntroTile from '../components/ScreenIntroTile';
import {
  ATHAN_CHANNEL_ID,
  ATHAN_NOTIFICATION_ID_PREFIX,
  ATHAN_NOTIFICATION_TITLE_PREFIX,
  buildAthanNotificationId,
} from '../utils/athanNotifications';

type Prayer = {
  name: string;
  time: string;
  enabled: boolean;
};

type ScheduledAthan = {
  identifier: string;
  prayerName: string;
  title: string;
  scheduledAt: Date | null;
  channelId: string | null;
  triggerType: string;
  triggerNote: string | null;
};

type UpcomingPrayer = {
  name: string;
  time: string;
  expectedAt: Date;
  identifier: string;
};

const parsePrayerTime = (raw: string): { hour: number; minute: number } | null => {
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

const extractTriggerDate = (trigger: Notifications.NotificationTrigger | null): Date | null => {
  if (!trigger || typeof trigger !== 'object') {
    return null;
  }

  const rawDate = (trigger as { date?: unknown }).date;
  if (rawDate instanceof Date) {
    return Number.isNaN(rawDate.getTime()) ? null : rawDate;
  }
  if (typeof rawDate === 'number' || typeof rawDate === 'string') {
    const parsedDate = new Date(rawDate);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }
  return null;
};

const extractTriggerType = (trigger: Notifications.NotificationTrigger | null): string => {
  if (!trigger || typeof trigger !== 'object') return 'unknown';
  const rawType = (trigger as { type?: unknown }).type;
  return typeof rawType === 'string' ? rawType : 'unknown';
};

const extractTriggerChannelId = (trigger: Notifications.NotificationTrigger | null): string | null => {
  if (!trigger || typeof trigger !== 'object') {
    return null;
  }

  const channelId = (trigger as { channelId?: unknown }).channelId;
  return typeof channelId === 'string' ? channelId : null;
};

const buildSchedulableTriggerInput = (
  trigger: Notifications.NotificationTrigger | null
): Notifications.SchedulableNotificationTriggerInput | null => {
  if (!trigger || typeof trigger !== 'object') return null;

  const triggerType = extractTriggerType(trigger);

  if (triggerType === 'date') {
    const rawDate = (trigger as { date?: unknown }).date;
    if (rawDate instanceof Date || typeof rawDate === 'number') {
      return {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: rawDate,
      };
    }
    return null;
  }

  if (triggerType === 'timeInterval') {
    const seconds = Number((trigger as { seconds?: unknown }).seconds);
    const repeats = Boolean((trigger as { repeats?: unknown }).repeats);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats,
    };
  }

  if (triggerType === 'calendar') {
    const repeats = Boolean((trigger as { repeats?: unknown }).repeats);
    const dateComponents = (trigger as { dateComponents?: unknown }).dateComponents;
    if (!dateComponents || typeof dateComponents !== 'object') return null;

    const components = dateComponents as Record<string, unknown>;
    const result: Notifications.CalendarTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      repeats,
    };

    const numericFields = [
      'year',
      'month',
      'day',
      'hour',
      'minute',
      'second',
      'weekday',
      'weekdayOrdinal',
      'weekOfMonth',
      'weekOfYear',
    ] as const;

    for (const field of numericFields) {
      const value = Number(components[field]);
      if (Number.isFinite(value)) {
        (result as any)[field] = value;
      }
    }

    if (typeof components.timeZone === 'string') {
      result.timezone = components.timeZone;
    }

    return result;
  }

  return null;
};

const resolveScheduledAtFromTrigger = async (
  trigger: Notifications.NotificationTrigger | null
): Promise<{ scheduledAt: Date | null; triggerNote: string | null; triggerType: string }> => {
  const triggerType = extractTriggerType(trigger);
  const directDate = extractTriggerDate(trigger);
  if (directDate) {
    return { scheduledAt: directDate, triggerNote: null, triggerType };
  }

  const schedulableTrigger = buildSchedulableTriggerInput(trigger);
  if (!schedulableTrigger) {
    const triggerNote =
      Platform.OS === 'ios'
        ? 'iOS runtime did not expose an absolute trigger date for this notification.'
        : null;
    return { scheduledAt: null, triggerNote, triggerType };
  }

  try {
    const nextTriggerTimestamp = await Notifications.getNextTriggerDateAsync(schedulableTrigger);
    if (typeof nextTriggerTimestamp === 'number') {
      return { scheduledAt: new Date(nextTriggerTimestamp), triggerNote: null, triggerType };
    }
    return {
      scheduledAt: null,
      triggerNote: 'No next trigger date was returned by runtime.',
      triggerType,
    };
  } catch {
    const triggerNote =
      Platform.OS === 'ios'
        ? 'Expo Go on iOS may hide exact pending trigger timestamps.'
        : 'Could not resolve next trigger timestamp from runtime.';
    return { scheduledAt: null, triggerNote, triggerType };
  }
};

const formatDateExact = (date: Date | null): string => {
  if (!date) return 'Unknown trigger time';
  return `${date.toLocaleString()} (${date.toISOString()})`;
};

export default function AthanDiagnosticsScreen({ route }: any) {
  const city = typeof route?.params?.city === 'string' ? route.params.city : 'Unknown';
  const prayers: Prayer[] = Array.isArray(route?.params?.prayers) ? route.params.prayers : [];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduledAthans, setScheduledAthans] = useState<ScheduledAthan[]>([]);
  const [channelInfo, setChannelInfo] = useState<Notifications.NotificationChannel | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  const expectedUpcoming = useMemo<UpcomingPrayer[]>(() => {
    if (prayers.length === 0) return [];

    const now = new Date();
    const candidates: UpcomingPrayer[] = [];
    let dayOffset = 0;

    while (candidates.length < 12 && dayOffset < 4) {
      for (const prayer of prayers) {
        if (!prayer.enabled) continue;
        const parsed = parsePrayerTime(prayer.time);
        if (!parsed) continue;

        const expectedAt = new Date(now);
        expectedAt.setDate(now.getDate() + dayOffset);
        expectedAt.setHours(parsed.hour, parsed.minute, 0, 0);

        if (expectedAt <= now) continue;

        candidates.push({
          name: prayer.name,
          time: prayer.time,
          expectedAt,
          identifier: buildAthanNotificationId(prayer.name),
        });
      }
      dayOffset += 1;
    }

    return candidates
      .sort((a, b) => a.expectedAt.getTime() - b.expectedAt.getTime())
      .slice(0, 7);
  }, [prayers]);

  const scheduledByIdentifier = useMemo(() => {
    return new Map(scheduledAthans.map((item) => [item.identifier, item]));
  }, [scheduledAthans]);

  const refreshDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const filteredAthanRequests = scheduled
        .filter((request) => {
          const title = typeof request.content.title === 'string' ? request.content.title : '';
          const rawData = request.content.data as { source?: unknown } | undefined;
          const source = rawData?.source;
          return (
            request.identifier.startsWith(ATHAN_NOTIFICATION_ID_PREFIX) ||
            source === 'athan' ||
            title.startsWith(ATHAN_NOTIFICATION_TITLE_PREFIX)
          );
        });

      const athans = await Promise.all(
        filteredAthanRequests.map(async (request) => {
          const title = typeof request.content.title === 'string' ? request.content.title : '';
          const rawData = request.content.data as { prayerName?: unknown } | undefined;
          const prayerNameFromData =
            typeof rawData?.prayerName === 'string' ? rawData.prayerName : '';
          const prayerNameFromTitle = title.startsWith(ATHAN_NOTIFICATION_TITLE_PREFIX)
            ? title.replace(ATHAN_NOTIFICATION_TITLE_PREFIX, '').trim()
            : '';
          const resolvedSchedule = await resolveScheduledAtFromTrigger(request.trigger);

          return {
            identifier: request.identifier,
            prayerName: prayerNameFromData || prayerNameFromTitle || 'Unknown',
            title,
            scheduledAt: resolvedSchedule.scheduledAt,
            channelId: extractTriggerChannelId(request.trigger),
            triggerType: resolvedSchedule.triggerType,
            triggerNote: resolvedSchedule.triggerNote,
          };
        })
      );

      const sortedAthans = athans
        .sort((a, b) => {
          const aTime = a.scheduledAt ? a.scheduledAt.getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.scheduledAt ? b.scheduledAt.getTime() : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        });

      setScheduledAthans(sortedAthans);

      if (Platform.OS === 'android') {
        const channel = await Notifications.getNotificationChannelAsync(ATHAN_CHANNEL_ID);
        setChannelInfo(channel);
      } else {
        setChannelInfo(null);
      }

      setLastRefreshAt(new Date());
    } catch (refreshError) {
      console.error('Failed to load athan diagnostics:', refreshError);
      setError('Could not load scheduled notification diagnostics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScreenIntroTile
          title="Athan Diagnostics"
          description="This view helps you verify exact athan schedules on-device, compare expected prayer triggers, and inspect Android channel configuration."
          style={styles.introTile}
        />

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Current Context</Text>
          <Text style={styles.statusText}>City: {city}</Text>
          <Text style={styles.statusText}>Athan schedules found: {scheduledAthans.length}</Text>
          <Text style={styles.statusText}>
            Last refresh: {lastRefreshAt ? lastRefreshAt.toLocaleTimeString() : 'Not yet'}
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={() => void refreshDiagnostics()}>
            <Text style={styles.refreshButtonText}>Refresh Diagnostics</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={UI_COLORS.primary} />
            <Text style={styles.loadingText}>Loading notification data...</Text>
          </View>
        ) : (
          <>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Expected Next 7 Prayer Triggers</Text>
              {expectedUpcoming.length === 0 ? (
                <Text style={styles.emptyText}>No enabled prayers with valid times were found.</Text>
              ) : (
                expectedUpcoming.map((item, index) => {
                  const scheduledItem = scheduledByIdentifier.get(item.identifier);
                  return (
                    <View key={`${item.identifier}-${index}`} style={styles.row}>
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowTitle}>
                          {item.name} ({item.time})
                        </Text>
                        <Text
                          style={[
                            styles.rowBadge,
                            scheduledItem ? styles.rowBadgeOk : styles.rowBadgeWarn,
                          ]}
                        >
                          {scheduledItem ? 'Scheduled' : 'Missing'}
                        </Text>
                      </View>
                      <Text style={styles.rowText}>Expected: {formatDateExact(item.expectedAt)}</Text>
                      <Text style={styles.rowText}>
                        Scheduled: {formatDateExact(scheduledItem?.scheduledAt ?? null)}
                      </Text>
                      {scheduledItem?.triggerNote ? (
                        <Text style={styles.rowMeta}>Note: {scheduledItem.triggerNote}</Text>
                      ) : null}
                      <Text style={styles.rowMeta}>Trigger type: {scheduledItem?.triggerType || 'unknown'}</Text>
                      <Text style={styles.rowMeta}>ID: {item.identifier}</Text>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Scheduled Athan Notifications</Text>
              {scheduledAthans.length === 0 ? (
                <Text style={styles.emptyText}>No athan notifications are currently scheduled.</Text>
              ) : (
                scheduledAthans.map((item) => (
                  <View key={item.identifier} style={styles.row}>
                    <Text style={styles.rowTitle}>{item.prayerName}</Text>
                    <Text style={styles.rowText}>{formatDateExact(item.scheduledAt)}</Text>
                    {item.triggerNote ? <Text style={styles.rowMeta}>Note: {item.triggerNote}</Text> : null}
                    <Text style={styles.rowMeta}>Trigger type: {item.triggerType}</Text>
                    <Text style={styles.rowMeta}>
                      {item.channelId ? `Channel: ${item.channelId}` : 'Channel: n/a'}
                    </Text>
                    <Text style={styles.rowMeta}>ID: {item.identifier}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Notification Channel</Text>
              {Platform.OS !== 'android' ? (
                <Text style={styles.emptyText}>Channel diagnostics apply to Android only.</Text>
              ) : !channelInfo ? (
                <Text style={styles.emptyText}>
                  Channel "{ATHAN_CHANNEL_ID}" not found. Reopen Prayer Times to recreate it.
                </Text>
              ) : (
                <>
                  <Text style={styles.rowText}>ID: {channelInfo.id}</Text>
                  <Text style={styles.rowText}>Name: {channelInfo.name}</Text>
                  <Text style={styles.rowText}>Importance: {channelInfo.importance}</Text>
                  <Text style={styles.rowText}>
                    Sound: {channelInfo.sound ? String(channelInfo.sound) : 'Default/None'}
                  </Text>
                  <Text style={styles.rowText}>
                    Vibration: {channelInfo.enableVibrate ? 'Enabled' : 'Disabled'}
                  </Text>
                  <Text style={styles.rowText}>Bypass DND: {channelInfo.bypassDnd ? 'Yes' : 'No'}</Text>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  introTile: {
    marginHorizontal: 0,
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    borderRadius: UI_RADII.lg,
    padding: 16,
    marginBottom: 14,
    ...UI_SHADOWS.card,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    color: UI_COLORS.text,
    lineHeight: 21,
  },
  refreshButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: UI_COLORS.primary,
    borderRadius: UI_RADII.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshButtonText: {
    color: UI_COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 26,
  },
  loadingText: {
    marginTop: 10,
    color: UI_COLORS.textMuted,
    fontSize: 14,
  },
  errorText: {
    color: UI_COLORS.danger,
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    borderRadius: UI_RADII.lg,
    padding: 14,
    marginBottom: 14,
    ...UI_SHADOWS.card,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: UI_COLORS.primaryDeep,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: UI_COLORS.textMuted,
    lineHeight: 21,
  },
  row: {
    borderTopWidth: 1,
    borderColor: UI_COLORS.border,
    paddingVertical: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: UI_COLORS.text,
    flex: 1,
    paddingRight: 8,
  },
  rowText: {
    fontSize: 13,
    color: UI_COLORS.text,
    lineHeight: 20,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 12,
    color: UI_COLORS.textMuted,
    lineHeight: 18,
  },
  rowBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
    color: UI_COLORS.white,
  },
  rowBadgeOk: {
    backgroundColor: UI_COLORS.primary,
  },
  rowBadgeWarn: {
    backgroundColor: '#c98200',
  },
});
