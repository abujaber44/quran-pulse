import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Platform, Easing, Modal, Pressable, TextInput, Alert, AppState } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { UI_COLORS, UI_RADII, UI_SHADOWS, UI_GRADIENTS } from '../theme/ui';
import { useLanguage } from '../i18n';
import {
  getReadingProgress,
  getReadingStreak,
  getCompletedSurahCount,
  type ReadingProgress,
  type ReadingStreak,
} from '../services/readingProgressService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchSurahs } from '../services/quranApi';
import { getBookmarks } from '../services/bookmarkService';
import { fetchDailyPersonalizedAyah, type DailyAyah } from '../services/aiService';
import {
  getKhatmah,
  startKhatmah,
  endKhatmah,
  getKhatmahStatus,
  type KhatmahPlan,
} from '../services/khatmahService';
import { getReviewSchedule, getDueVerseKeys } from '../services/memorizationService';
import { refreshDailyReminder, scheduleStreakProtection } from '../services/dailyReminderService';
import { refreshFridayKahfReminder } from '../services/fridayKahfService';
import { getRamadanStatus, countdownTo, type RamadanStatus } from '../services/ramadanService';
import { getHijriToday, getHijriMonthName } from '../services/islamicEventsService';
import NextPrayerHero from '../components/NextPrayerHero';

type RootStackParamList = {
  MemorizeUnderstand: undefined;
  Athkar: { period?: 'morning' | 'evening'; nonce?: number } | undefined;
  Bookmarks:
    | { initialTag?: 'memorize' | 'read'; autoOpen?: 'quiz' | 'practice'; nonce?: number }
    | undefined;
  PrayerTimes: undefined;
  QuranMiracles: undefined;
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
  Stats: '📊',
};

type SmartChip = {
  key: string;
  label: string;
  onPress: () => void;
};

export default function LandingScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { t, lang } = useLanguage();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [streak, setStreak] = useState<ReadingStreak | null>(null);
  const [surahs, setSurahs] = useState<any[]>([]);
  const [dailyAyah, setDailyAyah] = useState<DailyAyah | null>(null);
  const [loadingDailyAyah, setLoadingDailyAyah] = useState(false);
  const [khatmah, setKhatmah] = useState<KhatmahPlan | null>(null);
  const [showKhatmahModal, setShowKhatmahModal] = useState(false);
  const [customDaysInput, setCustomDaysInput] = useState('');
  const [dueReviewCount, setDueReviewCount] = useState(0);
  const [ramadan, setRamadan] = useState<RamadanStatus | null>(null);
  const [hijriLine, setHijriLine] = useState<string | null>(null);
  const [dailyAyahExpanded, setDailyAyahExpanded] = useState(false);
  // Bumped on focus and on returning from background so time-of-day chips
  // recompute — without this, a chip built the previous evening survives
  // an overnight backgrounded app.
  const [lastActiveAt, setLastActiveAt] = useState(() => Date.now());

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setLastActiveAt(Date.now());
    });
    return () => subscription.remove();
  }, []);

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
      setLastActiveAt(Date.now());
      Promise.all([getReadingProgress(), getReadingStreak()]).then(([p, s]) => {
        setProgress(p);
        setStreak(s);
      });
      getKhatmah().then(setKhatmah);
      getRamadanStatus().then(setRamadan).catch(() => {});
      Promise.all([getBookmarks(), getReviewSchedule()]).then(([bookmarks, schedule]) => {
        const memorizeKeysList = bookmarks
          .filter((b) => b.tag === 'memorize')
          .map((b) => `${b.surahId}:${b.ayahNum}`);
        setDueReviewCount(getDueVerseKeys(memorizeKeysList, schedule).length);
      });
    }, [])
  );

  const khatmahStatus = khatmah ? getKhatmahStatus(khatmah) : null;

  const handleStartKhatmah = useCallback((days: number) => {
    if (!days || days < 1 || days > 365) return;
    startKhatmah(days).then((plan) => {
      setKhatmah(plan);
      setShowKhatmahModal(false);
      setCustomDaysInput('');
    });
  }, []);

  const handleEndKhatmah = useCallback(() => {
    Alert.alert(t.endKhatmah, t.endKhatmahConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.endKhatmah,
        style: 'destructive',
        onPress: () => endKhatmah().then(() => setKhatmah(null)),
      },
    ]);
  }, [t]);

  const khatmahNextPage = khatmah && khatmah.readPages.length > 0
    ? Math.min(604, Math.max(...khatmah.readPages) + 1)
    : 1;

  const openSurahById = useCallback((surahId: number, initialAyah?: number) => {
    const surah = surahs.find((s: any) => Number(s.id) === surahId);
    if (surah) {
      (navigation as any).navigate('Surah', {
        surah,
        surahs,
        ...(initialAyah ? { initialAyah, scrollNonce: Date.now() } : {}),
      });
    } else {
      navigation.navigate('MemorizeUnderstand');
    }
  }, [navigation, surahs]);

  // Contextual suggestions: what the user most likely wants right now.
  // Priority-ordered, capped at 4, changes with time of day / weekday / activity.
  const smartChips: SmartChip[] = (() => {
    const chips: SmartChip[] = [];
    const nowDate = new Date(lastActiveAt);

    if (ramadan?.isRamadan) {
      const suhoor = ramadan.fajr ? countdownTo(ramadan.fajr) : null;
      const iftar = ramadan.maghrib ? countdownTo(ramadan.maghrib) : null;
      const label = suhoor
        ? `🌙 ${t.suhoorEndsIn} ${suhoor}`
        : iftar
          ? `🌙 ${t.iftarIn} ${iftar}`
          : `🌙 ${t.ramadanMubarak}`;
      chips.push({
        key: 'ramadan',
        label,
        onPress: () => navigation.navigate('PrayerTimes'),
      });
    }
    if (nowDate.getDay() === 5) {
      chips.push({
        key: 'kahf',
        label: `📖 ${t.fridayKahfChip}`,
        onPress: () => openSurahById(18),
      });
    }
    if (dueReviewCount > 0) {
      chips.push({
        key: 'review',
        label: `🧠 ${dueReviewCount} ${t.dueForReview}`,
        onPress: () => navigation.navigate('Bookmarks', { initialTag: 'memorize', nonce: Date.now() }),
      });
    }
    // Always present: the quiz works with or without bookmarks (surah/juz scope)
    chips.push({
      key: 'quiz',
      label: `✏️ ${t.quizMeChip}`,
      onPress: () =>
        navigation.navigate('Bookmarks', { initialTag: 'memorize', autoOpen: 'quiz', nonce: Date.now() }),
    });
    if (khatmahStatus && !khatmahStatus.completed && khatmahStatus.leftToday > 0) {
      chips.push({
        key: 'khatmah-today',
        label: `📿 ${khatmahStatus.leftToday} ${t.pagesLeftToday}`,
        onPress: () => (navigation as any).navigate('MushafReader', { juzNumber: 1, initialPage: khatmahNextPage }),
      });
    }
    // Morning athkar from pre-dawn through early afternoon; evening athkar
    // from mid-afternoon (Asr time) through the night.
    const hour = nowDate.getHours();
    const athkarPeriod: 'morning' | 'evening' = hour >= 4 && hour < 15 ? 'morning' : 'evening';
    chips.push({
      key: 'athkar',
      label: athkarPeriod === 'morning' ? `🌅 ${t.morningAthkar}` : `🌇 ${t.eveningAthkar}`,
      onPress: () => navigation.navigate('Athkar', { period: athkarPeriod, nonce: Date.now() }),
    });

    return chips.slice(0, 4);
  })();

  useEffect(() => {
    fetchSurahs().then(setSurahs);
  }, []);

  // Hijri date line under the app name, e.g. "Fri · 16 Muharram 1448"
  useEffect(() => {
    getHijriToday()
      .then((hijri) => {
        if (!hijri) return;
        const weekdays = [t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat];
        setHijriLine(
          `${weekdays[new Date().getDay()]} · ${hijri.day} ${getHijriMonthName(hijri.month, lang)} ${hijri.year}`
        );
      })
      .catch(() => {});
  }, [lang, t]);

  // Rotate the next week of reminder content and arm streak protection
  useEffect(() => {
    refreshDailyReminder(lang).catch(() => {});
    refreshFridayKahfReminder(lang).catch(() => {});
    getReadingStreak()
      .then((s) => scheduleStreakProtection(s, lang))
      .catch(() => {});
  }, [lang]);

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
          <Text style={styles.title}>{t.appName}</Text>
          {hijriLine ? <Text style={styles.hijriLine}>{hijriLine}</Text> : (
            <Text style={styles.subtitle}>{t.appTagline}</Text>
          )}
        </Animated.View>

        <NextPrayerHero onPress={() => navigation.navigate('PrayerTimes')} />

        <View style={styles.chipsRow}>
          {smartChips.map((chip) => (
            <TouchableOpacity key={chip.key} style={styles.chip} activeOpacity={0.8} onPress={chip.onPress}>
              <Text style={styles.chipText} numberOfLines={1}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
              <View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setDailyAyahExpanded((prev) => !prev)}
                >
                  <Text
                    style={styles.dailyAyahArabic}
                    numberOfLines={dailyAyahExpanded ? undefined : 3}
                  >
                    {dailyAyah.arabicText}
                  </Text>
                  <View style={styles.dailyAyahFooter}>
                    <TouchableOpacity
                      onPress={() => openSurahById(dailyAyah.surahId, dailyAyah.ayahNumber)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.dailyAyahRef}>{dailyAyah.surahName} — {dailyAyah.verseKey} ›</Text>
                    </TouchableOpacity>
                    <Text style={styles.dailyAyahBadge}>{t.selectedForYou}</Text>
                  </View>
                  {dailyAyahExpanded && (
                    <Text style={styles.dailyAyahReason}>✦ {dailyAyah.reason}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dailyAyahToggle}
                  activeOpacity={0.7}
                  onPress={() => setDailyAyahExpanded((prev) => !prev)}
                >
                  <Text style={styles.dailyAyahToggleText}>
                    {dailyAyahExpanded ? `▲ ${t.dailyAyahLess}` : `▼ ${t.dailyAyahMore}`}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}

        {progress && streak ? (
          <View style={styles.journeyCard}>
            <TouchableOpacity
              style={styles.journeyStats}
              activeOpacity={0.85}
              onPress={() => (navigation as any).navigate('Stats')}
            >
              <View style={styles.journeyStat}>
                <Text style={styles.journeyStatValue}>🔥 {streak.currentStreak}</Text>
                <Text style={styles.journeyStatLabel}>{t.dayStreak}</Text>
              </View>
              <View style={styles.journeyStat}>
                <Text style={styles.journeyStatValue}>📖 {progress.totalAyahsRead}</Text>
                <Text style={styles.journeyStatLabel}>{t.ayahsRead}</Text>
              </View>
              <View style={styles.journeyStat}>
                <Text style={styles.journeyStatValue}>✅ {getCompletedSurahCount(progress)}</Text>
                <Text style={styles.journeyStatLabel}>{t.surahsCompleted}</Text>
              </View>
            </TouchableOpacity>
            {khatmahStatus ? (
              <TouchableOpacity
                style={styles.khatmahPill}
                activeOpacity={0.85}
                onPress={() => (navigation as any).navigate('MushafReader', { juzNumber: 1, initialPage: khatmahNextPage })}
                onLongPress={handleEndKhatmah}
              >
                <Text style={styles.khatmahPillTitle}>📿 {khatmahStatus.percent}%</Text>
                <View style={styles.khatmahPillTrack}>
                  <View style={[styles.khatmahPillFill, { width: `${khatmahStatus.percent}%` }]} />
                </View>
                <Text style={styles.khatmahPillLabel}>{t.khatmah}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.khatmahPill}
                activeOpacity={0.85}
                onPress={() => setShowKhatmahModal(true)}
              >
                <Text style={styles.khatmahPillTitle}>📿</Text>
                <Text style={styles.khatmahPillLabel}>{t.startKhatmah}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t.coreFeatures}</Text>
          <Text style={styles.sectionSubtitle}>{t.dailyJourney}</Text>
        </View>

        <View style={styles.featureGrid}>
          {([
            { route: 'MemorizeUnderstand' as const, title: t.memorizeUnderstand },
            { route: 'QuranPlayer' as const, title: t.listenToQuran },
            { route: 'PrayerTimes' as const, title: t.prayerTimes },
            { route: 'Calendar' as const, title: t.islamicCalendar },
            { route: 'Athkar' as const, title: t.athkar },
            { route: 'QuranMiracles' as const, title: t.quranMiracles },
          ]).map((item) => (
            <TouchableOpacity key={item.route} style={styles.featureTile} onPress={() => navigation.navigate(item.route)} activeOpacity={0.8}>
              <Text style={styles.featureIcon}>{ICONS[item.route]}</Text>
              <Text style={styles.featureTitle}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.utilityRow}>
          <TouchableOpacity style={styles.utilityButton} onPress={() => navigation.navigate('Bookmarks')} activeOpacity={0.8}>
            <Text style={styles.utilityIcon}>{ICONS.Bookmarks}</Text>
            <Text style={styles.utilityButtonTitle}>{t.myBookmarks}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.utilityButton} onPress={() => (navigation as any).navigate('Stats')} activeOpacity={0.8}>
            <Text style={styles.utilityIcon}>{ICONS.Stats}</Text>
            <Text style={styles.utilityButtonTitle}>{t.myStats}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.utilityButton} onPress={() => navigation.navigate('Settings')} activeOpacity={0.8}>
            <Text style={styles.utilityIcon}>{ICONS.Settings}</Text>
            <Text style={styles.utilityButtonTitle}>{t.settings}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showKhatmahModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKhatmahModal(false)}
      >
        <Pressable style={styles.khatmahModalBackdrop} onPress={() => setShowKhatmahModal(false)}>
          <Pressable style={styles.khatmahModalCard} onPress={() => undefined}>
            <Text style={styles.khatmahModalTitle}>📿 {t.startKhatmah}</Text>
            <Text style={styles.khatmahModalSubtitle}>{t.khatmahChooseDays}</Text>
            <View style={styles.khatmahDayOptions}>
              {[30, 60, 90].map((d) => (
                <TouchableOpacity key={d} style={styles.khatmahDayOption} onPress={() => handleStartKhatmah(d)}>
                  <Text style={styles.khatmahDayOptionNum}>{d}</Text>
                  <Text style={styles.khatmahDayOptionLabel}>{t.days}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.khatmahCustomRow}>
              <TextInput
                style={styles.khatmahCustomInput}
                placeholder={t.enterDays}
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={customDaysInput}
                onChangeText={setCustomDaysInput}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.khatmahCustomGo}
                onPress={() => handleStartKhatmah(Number(customDaysInput.trim()))}
              >
                <Text style={styles.khatmahCustomGoText}>{t.go}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    marginBottom: 14,
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: UI_COLORS.white,
    fontFamily: 'AmiriQuran',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(214,228,238,0.9)',
    letterSpacing: 1,
    marginTop: 2,
  },
  hijriLine: {
    fontSize: 13,
    color: 'rgba(214,228,238,0.75)',
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    maxWidth: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(234,242,248,0.95)',
  },
  journeyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(31,157,85,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(31,157,85,0.25)',
    borderRadius: UI_RADII.xl,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 10,
  },
  journeyStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  journeyStat: {
    alignItems: 'center',
  },
  journeyStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: UI_COLORS.white,
    marginBottom: 2,
  },
  journeyStatLabel: {
    fontSize: 10.5,
    color: 'rgba(215,239,225,0.7)',
  },
  khatmahPill: {
    minWidth: 86,
    alignItems: 'center',
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
    borderRadius: UI_RADII.lg,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  khatmahPillTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f5c778',
  },
  khatmahPillTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginTop: 5,
  },
  khatmahPillFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#f5a623',
  },
  khatmahPillLabel: {
    fontSize: 10,
    color: 'rgba(240,228,205,0.8)',
    marginTop: 4,
    textAlign: 'center',
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
  khatmahModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,18,31,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  khatmahModalCard: {
    width: '100%',
    backgroundColor: 'rgba(18,46,63,0.97)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 20,
  },
  khatmahModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f5c778',
    textAlign: 'center',
  },
  khatmahModalSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  khatmahDayOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  khatmahDayOption: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
    borderRadius: UI_RADII.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  khatmahDayOptionNum: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f5a623',
  },
  khatmahDayOptionLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  khatmahCustomRow: {
    flexDirection: 'row',
    gap: 10,
  },
  khatmahCustomInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: UI_RADII.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: UI_COLORS.white,
    textAlign: 'center',
  },
  khatmahCustomGo: {
    backgroundColor: '#f5a623',
    borderRadius: UI_RADII.sm,
    paddingHorizontal: 22,
    justifyContent: 'center',
  },
  khatmahCustomGoText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
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
  dailyAyahToggle: {
    alignItems: 'center',
    paddingTop: 8,
  },
  dailyAyahToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(215,239,225,0.75)',
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
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 10,
  },
  featureTile: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: UI_RADII.lg,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    ...(Platform.OS === 'android'
      ? { elevation: 0 }
      : UI_SHADOWS.input),
  },
  featureIcon: {
    fontSize: 26,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: UI_COLORS.white,
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
