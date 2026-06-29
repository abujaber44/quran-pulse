import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Platform, Easing } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { UI_COLORS, UI_RADII, UI_SHADOWS, UI_GRADIENTS } from '../theme/ui';
import { useLanguage } from '../i18n';
import {
  getReadingProgress,
  getReadingStreak,
  getCompletedSurahCount,
  getLastRead,
  type ReadingProgress,
  type ReadingStreak,
  type LastReadPosition,
} from '../services/readingProgressService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchSurahs } from '../services/quranApi';
import { getBookmarks } from '../services/bookmarkService';
import { fetchDailyPersonalizedAyah, type DailyAyah } from '../services/aiService';

type RootStackParamList = {
  MemorizeUnderstand: undefined;
  Athkar: undefined;
  PrayerTimes: undefined;
  QuranMiracles: undefined;
  Bookmarks: undefined;
  QuranPlayer: undefined;
  Calendar: undefined;
  Settings: undefined;
};

const ICONS: Record<string, string> = {
  MemorizeUnderstand: '📖',
  QuranPlayer: '🎧',
  PrayerTimes: '🕌',
  Calendar: '📅',
  Athkar: '📿',
  QuranMiracles: '✨',
  Bookmarks: '🔖',
  Settings: '⚙️',
};

export default function LandingScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { t, lang } = useLanguage();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [streak, setStreak] = useState<ReadingStreak | null>(null);
  const [lastRead, setLastRead] = useState<LastReadPosition | null>(null);
  const [surahs, setSurahs] = useState<any[]>([]);
  const [dailyAyah, setDailyAyah] = useState<DailyAyah | null>(null);
  const [loadingDailyAyah, setLoadingDailyAyah] = useState(false);

  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const phraseFade = useRef(new Animated.Value(0)).current;
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);

  const loadingPhrases = useMemo(() => lang === 'ar' ? [
    'نبحث لك عن آية تلامس قلبك...',
    'نتأمل في كتاب الله...',
    'نختار لك ما يناسب يومك...',
    'نستلهم من نور القرآن...',
  ] : [
    'Finding an ayah that speaks to your heart...',
    'Reflecting on the words of Allah...',
    'Selecting something meaningful for your day...',
    'Drawing inspiration from the Quran...',
  ], [lang]);

  useEffect(() => {
    if (!loadingDailyAyah || dailyAyah) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    Animated.timing(phraseFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    const interval = setInterval(() => {
      Animated.timing(phraseFade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setLoadingPhraseIndex(prev => (prev + 1) % loadingPhrases.length);
        Animated.timing(phraseFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 3000);
    return () => { clearInterval(interval); shimmerAnim.stopAnimation(); };
  }, [loadingDailyAyah, dailyAyah, shimmerAnim, phraseFade, loadingPhrases]);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getReadingProgress(), getReadingStreak(), getLastRead()]).then(([p, s, lr]) => {
        setProgress(p);
        setStreak(s);
        setLastRead(lr);
      });
    }, [])
  );

  useEffect(() => {
    fetchSurahs().then(setSurahs);
  }, []);

  useEffect(() => {
    const loadDailyAyah = async () => {
      const cacheKey = '@quran_pulse_daily_ayah';
      const today = new Date().toISOString().split('T')[0];

      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { date: string; lang?: string; ayah: DailyAyah };
        if (parsed.date === today) {
          setDailyAyah(parsed.ayah);
          if (parsed.lang === lang) return;
        }
      }

      setLoadingDailyAyah(true);
      try {
        const [progressData, bookmarks] = await Promise.all([getReadingProgress(), getBookmarks()]);
        const recentSurahs = Object.keys(progressData.surahsRead).slice(0, 5);
        const bookmarkTags = [...new Set(bookmarks.map(b => b.surahName))].slice(0, 5);

        const ayah = await fetchDailyPersonalizedAyah(recentSurahs, bookmarkTags, lang);
        if (ayah) {
          setDailyAyah(ayah);
          await AsyncStorage.setItem(cacheKey, JSON.stringify({ date: today, lang, ayah }));
        }
      } catch {
        // Silent fail — daily ayah is optional
      } finally {
        setLoadingDailyAyah(false);
      }
    };

    void loadDailyAyah();
  }, [lang]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <LinearGradient colors={UI_GRADIENTS.heroLight} style={styles.container}>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.eyebrow}>{t.bismillah}</Text>
          <Text style={styles.title}>{t.appName}</Text>
          <Text style={styles.subtitle}>{t.appTagline}</Text>
        </Animated.View>


        {progress && streak && (progress.totalAyahsRead > 0 || streak.currentStreak > 0) ? (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>{t.readingProgress}</Text>
            <View style={styles.progressStats}>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>🔥 {streak.currentStreak}</Text>
                <Text style={styles.progressStatLabel}>{t.dayStreak}</Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>📖 {progress.totalAyahsRead}</Text>
                <Text style={styles.progressStatLabel}>{t.ayahsRead}</Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>✅ {getCompletedSurahCount(progress)}</Text>
                <Text style={styles.progressStatLabel}>{t.surahsCompleted}</Text>
              </View>
            </View>
            {streak.longestStreak > 1 && (
              <Text style={styles.progressBest}>🏆 {t.bestStreak}: {streak.longestStreak} {t.dayStreak}</Text>
            )}
          </View>
        ) : null}

        {(dailyAyah || loadingDailyAyah) && (
          <View style={styles.dailyAyahCard}>
            <Text style={styles.dailyAyahHeader}>{t.dailyAyah}</Text>
            {loadingDailyAyah && !dailyAyah ? (
              <View style={styles.dailyAyahLoading}>
                <Animated.View style={[styles.dailyAyahGlow, {
                  opacity: shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }),
                  transform: [{ scale: shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }],
                }]}>
                  <Text style={styles.dailyAyahLoadingIcon}>✦</Text>
                </Animated.View>
                <Animated.Text style={[styles.dailyAyahLoadingText, { opacity: phraseFade }]}>
                  {loadingPhrases[loadingPhraseIndex]}
                </Animated.Text>
              </View>
            ) : dailyAyah ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  const surah = surahs.find((s: any) => s.id === dailyAyah.surahId);
                  if (surah) {
                    (navigation as any).navigate('Surah', { surah, surahs, initialAyah: dailyAyah.ayahNumber, scrollNonce: Date.now() });
                  }
                }}
              >
                <Text style={styles.dailyAyahArabic}>{dailyAyah.arabicText}</Text>
                <View style={styles.dailyAyahFooter}>
                  <Text style={styles.dailyAyahRef}>{dailyAyah.surahName} — {dailyAyah.verseKey}</Text>
                  <Text style={styles.dailyAyahBadge}>{t.selectedForYou}</Text>
                </View>
                <Text style={styles.dailyAyahReason}>✦ {dailyAyah.reason}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {lastRead && surahs.length > 0 && (
          <TouchableOpacity
            style={styles.continueCard}
            activeOpacity={0.8}
            onPress={() => {
              const surah = surahs.find((s: any) => s.id === lastRead.surahId);
              if (surah) {
                (navigation as any).navigate('Surah', { surah, surahs, initialAyah: lastRead.ayahNum, scrollNonce: Date.now() });
              }
            }}
          >
            <Text style={styles.continueLabel}>{t.continueLearning}</Text>
            <Text style={styles.continueTitle}>📖 {lastRead.surahName} — {t.ayah} {lastRead.ayahNum}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t.coreFeatures}</Text>
          <Text style={styles.sectionSubtitle}>{t.dailyJourney}</Text>
        </View>

        <View style={styles.primaryStack}>
          <TouchableOpacity style={styles.primaryCard} onPress={() => navigation.navigate('MemorizeUnderstand')} activeOpacity={0.8}>
            <LinearGradient colors={['rgba(31,157,85,0.2)', 'rgba(31,157,85,0.05)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryCardGradient}>
              <Text style={styles.cardIcon}>{ICONS.MemorizeUnderstand}</Text>
              <View style={styles.cardContent}>
                <Text style={styles.primaryCardTitle}>{t.memorizeUnderstand}</Text>
                <Text style={styles.primaryCardSubtitle}>{t.memorizeUnderstandDesc}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryCard} onPress={() => navigation.navigate('QuranPlayer')} activeOpacity={0.8}>
            <LinearGradient colors={['rgba(45,127,184,0.2)', 'rgba(45,127,184,0.05)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryCardGradient}>
              <Text style={styles.cardIcon}>{ICONS.QuranPlayer}</Text>
              <View style={styles.cardContent}>
                <Text style={styles.primaryCardTitle}>{t.listenToQuran}</Text>
                <Text style={styles.primaryCardSubtitle}>{t.listenToQuranDesc}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.secondaryGrid}>
          {([
            { route: 'PrayerTimes' as const, title: t.prayerTimes, sub: t.prayerTimesDesc },
            { route: 'Calendar' as const, title: t.islamicCalendar, sub: t.islamicCalendarDesc },
            { route: 'Athkar' as const, title: t.athkar, sub: t.athkarDesc },
            { route: 'QuranMiracles' as const, title: t.quranMiracles, sub: t.quranMiraclesDesc },
          ]).map((item) => (
            <TouchableOpacity key={item.route} style={styles.secondaryCard} onPress={() => navigation.navigate(item.route)} activeOpacity={0.8}>
              <Text style={styles.secondaryIcon}>{ICONS[item.route]}</Text>
              <Text style={styles.secondaryCardTitle}>{item.title}</Text>
              <Text style={styles.secondaryCardSubtitle}>{item.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.utilitySection}>
          <Text style={styles.utilityTitle}>{t.quickAccess}</Text>
          <View style={styles.utilityRow}>
            <TouchableOpacity style={styles.utilityButton} onPress={() => navigation.navigate('Bookmarks')} activeOpacity={0.8}>
              <Text style={styles.utilityIcon}>{ICONS.Bookmarks}</Text>
              <Text style={styles.utilityButtonTitle}>{t.myBookmarks}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.utilityButton} onPress={() => navigation.navigate('Settings')} activeOpacity={0.8}>
              <Text style={styles.utilityIcon}>{ICONS.Settings}</Text>
              <Text style={styles.utilityButtonTitle}>{t.settings}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 60,
    paddingBottom: 44,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 13,
    color: UI_COLORS.primarySoft,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 10,
    opacity: 0.9,
  },
  title: {
    fontSize: 52,
    fontWeight: 'bold',
    color: UI_COLORS.white,
    fontFamily: 'AmiriQuran',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 17,
    color: 'rgba(214,228,238,0.9)',
    letterSpacing: 1,
  },
  introCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: UI_RADII.xl,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  description: {
    fontSize: 15,
    color: 'rgba(234,242,248,0.9)',
    textAlign: 'center',
    lineHeight: 24,
  },
  progressCard: {
    backgroundColor: 'rgba(31,157,85,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(31,157,85,0.25)',
    borderRadius: UI_RADII.xl,
    padding: 16,
    marginBottom: 20,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: UI_COLORS.primarySoft,
    marginBottom: 12,
    textAlign: 'center',
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  progressStat: {
    alignItems: 'center',
  },
  progressStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: UI_COLORS.white,
    marginBottom: 2,
  },
  progressStatLabel: {
    fontSize: 11,
    color: 'rgba(215,239,225,0.7)',
  },
  progressBest: {
    fontSize: 12,
    color: 'rgba(215,239,225,0.6)',
    textAlign: 'center',
    marginTop: 10,
  },
  dailyAyahCard: {
    backgroundColor: 'rgba(31,157,85,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(31,157,85,0.2)',
    borderRadius: UI_RADII.xl,
    padding: 18,
    marginBottom: 16,
  },
  dailyAyahHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: UI_COLORS.primarySoft,
    marginBottom: 12,
    textAlign: 'center',
  },
  dailyAyahLoading: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 14,
  },
  dailyAyahGlow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(31,157,85,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyAyahLoadingIcon: {
    fontSize: 22,
    color: UI_COLORS.primarySoft,
  },
  dailyAyahLoadingText: {
    fontSize: 14,
    color: 'rgba(214,228,238,0.7)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  dailyAyahArabic: {
    fontSize: 22,
    lineHeight: 38,
    textAlign: 'center',
    color: UI_COLORS.white,
    writingDirection: 'rtl',
    marginBottom: 10,
  },
  dailyAyahTranslation: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: 'rgba(214,228,238,0.85)',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  dailyAyahFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  dailyAyahRef: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(215,239,225,0.8)',
  },
  dailyAyahBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: UI_COLORS.primary,
    backgroundColor: 'rgba(31,157,85,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  dailyAyahReason: {
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(214,228,238,0.6)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  continueCard: {
    backgroundColor: 'rgba(45,127,184,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(45,127,184,0.3)',
    borderRadius: UI_RADII.lg,
    padding: 14,
    marginBottom: 16,
  },
  continueLabel: {
    fontSize: 12,
    color: 'rgba(214,228,238,0.7)',
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  continueTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: UI_COLORS.white,
    textAlign: 'center',
  },
  sectionHeader: {
    marginBottom: 14,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: UI_COLORS.white,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  sectionSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: 'rgba(198,211,222,0.8)',
    textAlign: 'center',
  },
  primaryStack: {
    marginBottom: 16,
    gap: 12,
  },
  primaryCard: {
    borderRadius: UI_RADII.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...(Platform.OS === 'android'
      ? { elevation: 0 }
      : UI_SHADOWS.card),
  },
  primaryCardGradient: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 6,
  },
  cardIcon: {
    fontSize: 28,
    marginBottom: 2,
  },
  cardContent: {},
  primaryCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: UI_COLORS.white,
    textAlign: 'center',
  },
  primaryCardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(208,221,232,0.85)',
    lineHeight: 18,
    textAlign: 'center',
  },
  secondaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 22,
    gap: 10,
  },
  secondaryCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: UI_RADII.lg,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    ...(Platform.OS === 'android'
      ? { elevation: 0 }
      : UI_SHADOWS.input),
  },
  secondaryIcon: {
    fontSize: 22,
    marginBottom: 8,
  },
  secondaryCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: UI_COLORS.white,
    textAlign: 'center',
  },
  secondaryCardSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(208,221,232,0.75)',
    lineHeight: 17,
    textAlign: 'center',
  },
  utilitySection: {
    backgroundColor: 'rgba(18,59,54,0.55)',
    borderRadius: UI_RADII.xl,
    borderWidth: 1,
    borderColor: 'rgba(215,239,225,0.2)',
    padding: 16,
    ...(Platform.OS === 'android'
      ? { elevation: 0 }
      : UI_SHADOWS.card),
  },
  utilityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: UI_COLORS.primarySoft,
    marginBottom: 12,
    textAlign: 'center',
  },
  utilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  utilityButton: {
    flex: 1,
    backgroundColor: 'rgba(215,239,225,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(215,239,225,0.2)',
    borderRadius: UI_RADII.lg,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  utilityIcon: {
    fontSize: 20,
  },
  utilityButtonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: UI_COLORS.white,
    textAlign: 'center',
  },
});
