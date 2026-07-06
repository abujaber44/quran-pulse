import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { UI_COLORS, UI_RADII } from '../theme/ui';
import { useLanguage } from '../i18n';
import { getNextPrayerFromCache, type NextPrayerFromCache } from '../services/prayerTimesService';

const formatClock = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const formatCountdown = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// Live countdown to the next prayer, computed entirely from the cached
// 7-day schedule (no network). Ticks only while the home screen is focused.
export default function NextPrayerHero({ onPress }: { onPress: () => void }) {
  const { t } = useLanguage();
  const [next, setNext] = useState<NextPrayerFromCache | null>(null);
  const [hasCache, setHasCache] = useState<boolean | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const nextRef = useRef<NextPrayerFromCache | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        const info = await getNextPrayerFromCache();
        if (cancelled) return;
        nextRef.current = info;
        setNext(info);
        setHasCache(info !== null);
      };
      void load();

      const timer = setInterval(() => {
        setNow(Date.now());
        // When the countdown crosses zero, advance to the following prayer
        const current = nextRef.current;
        if (current && current.at.getTime() <= Date.now()) {
          void load();
        }
      }, 1000);

      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }, [])
  );

  if (hasCache === null) return null;

  if (!next) {
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
        <Text style={styles.label}>{t.nextPrayer}</Text>
        <Text style={styles.emptyText}>{t.homeSetCity}</Text>
      </TouchableOpacity>
    );
  }

  const prayerLabels: Record<string, string> = {
    Fajr: t.fajr,
    Dhuhr: t.dhuhr,
    Asr: t.asr,
    Maghrib: t.maghrib,
    Isha: t.isha,
  };

  const remainingMs = next.at.getTime() - now;
  let progress = 0;
  if (next.previousAt) {
    const total = next.at.getTime() - next.previousAt.getTime();
    if (total > 0) {
      progress = Math.min(1, Math.max(0, (now - next.previousAt.getTime()) / total));
    }
  }

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={styles.label}>{t.nextPrayer}</Text>
        <Text style={styles.city}>📍 {next.city}</Text>
      </View>
      <View style={styles.mainRow}>
        <Text style={styles.prayerName}>{prayerLabels[next.name] ?? next.name}</Text>
        <Text style={styles.countdown}>{formatCountdown(remainingMs)}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <View style={styles.timesRow}>
        <Text style={styles.timeHint}>{next.previousAt ? formatClock(next.previousAt) : ''}</Text>
        <Text style={styles.timeHint}>{formatClock(next.at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: UI_RADII.xl,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(214,228,238,0.75)',
  },
  city: {
    fontSize: 12,
    color: 'rgba(214,228,238,0.75)',
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 4,
  },
  prayerName: {
    fontSize: 19,
    fontWeight: '700',
    color: UI_COLORS.white,
  },
  countdown: {
    fontSize: 24,
    fontWeight: '800',
    color: '#57c7a5',
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.28)',
    marginTop: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#57c7a5',
  },
  timesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeHint: {
    fontSize: 10.5,
    color: 'rgba(214,228,238,0.55)',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: UI_COLORS.white,
    marginTop: 6,
  },
});
