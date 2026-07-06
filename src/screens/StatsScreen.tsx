import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import GlassBackground from '../components/GlassBackground';
import ScreenIntroTile from '../components/ScreenIntroTile';
import { useLanguage } from '../i18n';
import {
  getReadingProgress,
  getReadingStreak,
  getCompletedSurahCount,
  getDailyLog,
  type ReadingProgress,
  type ReadingStreak,
} from '../services/readingProgressService';
import {
  getQuizHistory,
  getReviewSchedule,
  type QuizAttempt,
  type ReviewSchedule,
} from '../services/memorizationService';
import { getKhatmah, getKhatmahStatus, getKhatmahInsights, type KhatmahStatus, type KhatmahInsights } from '../services/khatmahService';

const dateKeyOffset = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const weekdayLabel = (daysAgo: number, lang: string): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { weekday: 'narrow' });
};

export default function StatsScreen() {
  const { t, lang } = useLanguage();
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [streak, setStreak] = useState<ReadingStreak | null>(null);
  const [dailyLog, setDailyLog] = useState<Record<string, number>>({});
  const [quizHistory, setQuizHistory] = useState<QuizAttempt[]>([]);
  const [schedule, setSchedule] = useState<ReviewSchedule>({});
  const [khatmahStatus, setKhatmahStatus] = useState<KhatmahStatus | null>(null);
  const [khatmahInsights, setKhatmahInsights] = useState<KhatmahInsights | null>(null);

  useFocusEffect(
    useCallback(() => {
      getReadingProgress().then(setProgress);
      getReadingStreak().then(setStreak);
      getDailyLog().then(setDailyLog);
      getQuizHistory().then(setQuizHistory);
      getReviewSchedule().then(setSchedule);
      getKhatmah().then((plan) => {
        if (!plan) {
          setKhatmahStatus(null);
          setKhatmahInsights(null);
          return;
        }
        const status = getKhatmahStatus(plan);
        setKhatmahStatus(status);
        setKhatmahInsights(getKhatmahInsights(plan, status));
      });
    }, [])
  );

  // Last 7 days, oldest first
  const week = Array.from({ length: 7 }, (_, i) => {
    const daysAgo = 6 - i;
    return {
      label: weekdayLabel(daysAgo, lang),
      count: dailyLog[dateKeyOffset(daysAgo)] ?? 0,
    };
  });
  const weekMax = Math.max(1, ...week.map((d) => d.count));
  const weekTotal = week.reduce((sum, d) => sum + d.count, 0);

  const totalAttempts = quizHistory.length;
  const correctAttempts = quizHistory.filter((a) => a.correct).length;
  const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
  const masteredCount = Object.values(schedule).filter((e) => e.level >= 3).length;

  return (
    <GlassBackground>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ScreenIntroTile title={t.myStats} description={t.myStatsDesc} style={styles.introTile} />

          {/* Overview */}
          <View style={styles.card}>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>🔥 {streak?.currentStreak ?? 0}</Text>
                <Text style={styles.statLabel}>{t.dayStreak}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>🏆 {streak?.longestStreak ?? 0}</Text>
                <Text style={styles.statLabel}>{t.bestStreak}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>📖 {progress?.totalAyahsRead ?? 0}</Text>
                <Text style={styles.statLabel}>{t.ayahsRead}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>✅ {progress ? getCompletedSurahCount(progress) : 0}</Text>
                <Text style={styles.statLabel}>{t.surahsCompleted}</Text>
              </View>
            </View>
          </View>

          {/* Weekly activity */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.last7Days}</Text>
            {weekTotal === 0 ? (
              <Text style={styles.emptyText}>{t.noActivityYet}</Text>
            ) : (
              <View style={styles.chartRow}>
                {week.map((day, i) => (
                  <View key={i} style={styles.chartCol}>
                    <Text style={styles.chartCount}>{day.count > 0 ? day.count : ''}</Text>
                    <View style={styles.chartBarTrack}>
                      <View
                        style={[
                          styles.chartBarFill,
                          { height: `${Math.max(4, (day.count / weekMax) * 100)}%` },
                          day.count === 0 && styles.chartBarEmpty,
                        ]}
                      />
                    </View>
                    <Text style={styles.chartLabel}>{day.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Memorization */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.memorize}</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{totalAttempts}</Text>
                <Text style={styles.statLabel}>{t.attempts}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{accuracy}%</Text>
                <Text style={styles.statLabel}>{t.quizAccuracy}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>🧠 {masteredCount}</Text>
                <Text style={styles.statLabel}>{t.versesMastered}</Text>
              </View>
            </View>
          </View>

          {/* Khatmah */}
          {khatmahStatus && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                📿 {t.khatmah} — {t.khatmahDay} {khatmahStatus.dayNumber} {t.ofWord} {khatmahStatus.targetDays}
              </Text>
              <View style={styles.khatmahBarTrack}>
                <View style={[styles.khatmahBarFill, { width: `${khatmahStatus.percent}%` }]} />
              </View>
              <Text style={styles.khatmahMeta}>
                {khatmahStatus.pagesRead}/{khatmahStatus.totalPages} {t.pagesRead} · {khatmahStatus.percent}%
              </Text>

              {khatmahStatus.completed ? (
                <Text style={styles.khatmahDetailOk}>{t.khatmahDone}</Text>
              ) : khatmahInsights ? (
                <>
                  <View style={styles.khatmahDetailRow}>
                    <View style={styles.khatmahDetailBox}>
                      <Text style={styles.khatmahDetailValue}>{khatmahStatus.leftToday}</Text>
                      <Text style={styles.khatmahDetailLabel}>{t.pagesLeftToday}</Text>
                    </View>
                    <View style={styles.khatmahDetailBox}>
                      <Text style={styles.khatmahDetailValue}>{khatmahStatus.pagesPerDay}</Text>
                      <Text style={styles.khatmahDetailLabel}>{t.khatmahDailyPlan}</Text>
                    </View>
                    <View style={styles.khatmahDetailBox}>
                      <Text
                        style={[
                          styles.khatmahDetailValue,
                          khatmahInsights.requiredPace > khatmahStatus.pagesPerDay && styles.khatmahDetailWarnValue,
                        ]}
                      >
                        {khatmahInsights.requiredPace}
                      </Text>
                      <Text style={styles.khatmahDetailLabel}>{t.khatmahNeededNow}</Text>
                    </View>
                  </View>

                  {khatmahStatus.dayNumber > 1 && (
                    khatmahInsights.carriedOver > 0 ? (
                      <Text style={styles.khatmahDetailWarn}>
                        {t.khatmahYesterday}: {khatmahInsights.yesterdayRead}/{khatmahStatus.pagesPerDay} {t.pagesRead} — {khatmahInsights.carriedOver} {t.khatmahRolledOver}
                      </Text>
                    ) : (
                      <Text style={styles.khatmahDetailOk}>✅ {t.khatmahYesterdayMet}</Text>
                    )
                  )}

                  {khatmahInsights.projectedFinishDays !== null && (
                    <Text style={styles.khatmahDetailMuted}>
                      {t.khatmahProjection}: ~{khatmahInsights.projectedFinishDays} {t.days} ({(() => {
                        const d = new Date();
                        d.setDate(d.getDate() + khatmahInsights.projectedFinishDays);
                        return d.toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { day: 'numeric', month: 'short' });
                      })()})
                    </Text>
                  )}
                </>
              ) : null}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { paddingBottom: 30 },
  introTile: { marginBottom: 12 },
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: UI_RADII.lg,
    ...UI_SHADOWS.card,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginBottom: 14,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: UI_COLORS.white,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 140,
    paddingTop: 4,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  chartCount: {
    fontSize: 10,
    fontWeight: '700',
    color: UI_COLORS.primarySoft,
  },
  chartBarTrack: {
    flex: 1,
    width: 18,
    justifyContent: 'flex-end',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 5,
    backgroundColor: UI_COLORS.primary,
  },
  chartBarEmpty: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chartLabel: {
    fontSize: 11,
    color: UI_COLORS.textMuted,
  },
  khatmahBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  khatmahBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#f5a623',
  },
  khatmahDetailRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  khatmahDetailBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: UI_RADII.md,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  khatmahDetailValue: {
    fontSize: 18,
    fontWeight: '800',
    color: UI_COLORS.white,
  },
  khatmahDetailWarnValue: {
    color: '#f5a623',
  },
  khatmahDetailLabel: {
    fontSize: 10.5,
    color: 'rgba(240,228,205,0.75)',
    textAlign: 'center',
    marginTop: 3,
  },
  khatmahDetailWarn: {
    fontSize: 12.5,
    color: '#f5c778',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  khatmahDetailOk: {
    fontSize: 12.5,
    color: 'rgba(147,222,180,0.9)',
    textAlign: 'center',
    marginTop: 10,
  },
  khatmahDetailMuted: {
    fontSize: 12,
    color: 'rgba(240,228,205,0.65)',
    textAlign: 'center',
    marginTop: 6,
  },
  khatmahMeta: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
  },
});
