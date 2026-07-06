import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useThemedAlert } from '../context/ThemedAlertContext';
import { resolveArabicFontFamily } from '../theme/fonts';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import { fetchRandomDailyHadith, DailyHadith } from '../services/hadithService';
import ScreenIntroTile from '../components/ScreenIntroTile';
import GlassBackground from '../components/GlassBackground';
import { getAiInsight } from '../services/aiService';
import { useLanguage } from '../i18n';
import {
  getHijriToday,
  getHijriMonthName,
  getEventsForHijriDay,
  getUpcomingEvents,
  type UpcomingEvent,
} from '../services/islamicEventsService';

const API_BASE = 'https://api.aladhan.com/v1';
const WEEKDAYS_FALLBACK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAILY_INSIGHT_CACHE_PREFIX = 'onThisDateInsight:';
const MONTH_CACHE_PREFIX = '@qp_hijri_cal:';

type CalendarDay = {
  gregorian: {
    date: string;
    day: string;
    month: { number: number; en: string };
    year: string;
    weekday: { en: string };
  };
  hijri: {
    day: string;
    month: { en: string; number?: number | string };
    year: string;
    holidays?: string[];
  };
};

type OnThisDateReflection = {
  title: string;
  text: string;
  source: string;
  arabicText?: string;
};

type QuranInsightEdition = {
  text?: string;
  numberInSurah?: number;
  surah?: {
    englishName?: string;
    name?: string;
  };
  edition?: {
    identifier?: string;
    language?: string;
    englishName?: string;
  };
};

const ON_THIS_DATE_REFLECTIONS: OnThisDateReflection[] = [
  {
    title: 'Ayah Insight',
    text: 'Consistent remembrance brings calm to the heart, even on busy days.',
    source: 'Quran reflection',
  },
  {
    title: 'Hadith Insight',
    text: 'Small acts done regularly are beloved, so keep your worship steady.',
    source: 'Hadith reflection',
  },
  {
    title: 'Ayah Insight',
    text: 'Patience with prayer and gratitude strengthens your daily rhythm.',
    source: 'Quran reflection',
  },
  {
    title: 'Hadith Insight',
    text: 'Mercy toward others opens doors of mercy for you.',
    source: 'Hadith reflection',
  },
  {
    title: 'Ayah Insight',
    text: 'When intentions are sincere, even simple deeds carry lasting value.',
    source: 'Quran reflection',
  },
  {
    title: 'Hadith Insight',
    text: 'A believer benefits others through good speech, service, and character.',
    source: 'Hadith reflection',
  },
];

const toSingleLine = (value: string): string => value.replace(/\s+/g, ' ').trim();

const dayOfYear = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
};

const getAyahNumberForDate = (date: Date): number => {
  const seed =
    dayOfYear(date) +
    date.getFullYear() * 11 +
    (date.getMonth() + 1) * 31 +
    date.getDate() * 17;
  return (seed % 6236) + 1;
};

const parseGregorianDateFromCalendarDay = (day: CalendarDay): Date | null => {
  const parts = day.gregorian.date.split('-').map((part) => Number(part));
  if (parts.length === 3 && parts.every((value) => Number.isFinite(value))) {
    // Aladhan returns DD-MM-YYYY for gregorian.date.
    const [dd, mm, yyyy] = parts;
    const parsed = new Date(yyyy, mm - 1, dd);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const dayNum = Number(day.gregorian.day);
  const monthNum = Number(day.gregorian.month.number);
  const yearNum = Number(day.gregorian.year);
  if (!Number.isFinite(dayNum) || !Number.isFinite(monthNum) || !Number.isFinite(yearNum)) {
    return null;
  }

  const parsed = new Date(yearNum, monthNum - 1, dayNum);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const fetchInsightForDateFromApi = async (date: Date): Promise<OnThisDateReflection | null> => {
  try {
    const ayahNumber = getAyahNumberForDate(date);
    const response = await axios.get(`https://api.alquran.cloud/v1/ayah/${ayahNumber}/editions/quran-uthmani,en.sahih`);
    const payload = response.data?.data;
    const editions: QuranInsightEdition[] = Array.isArray(payload)
      ? payload
      : payload
        ? [payload]
        : [];

    if (editions.length === 0) return null;

    const englishEdition =
      editions.find((item) => item.edition?.language === 'en') ||
      editions.find((item) => item.edition?.identifier === 'en.sahih');
    const arabicEdition =
      editions.find((item) => item.edition?.identifier === 'quran-uthmani') ||
      editions.find((item) => item.edition?.language === 'ar');

    const englishText = englishEdition?.text ? toSingleLine(englishEdition.text) : '';
    const arabicText = arabicEdition?.text ? toSingleLine(arabicEdition.text) : '';
    if (!englishText && !arabicText) return null;

    const limitedEnglish = englishText.length > 210 ? `${englishText.slice(0, 207)}...` : englishText;
    const text = limitedEnglish || '';
    const surahName = englishEdition?.surah?.englishName || arabicEdition?.surah?.englishName || 'Quran';
    const ayahInSurah = englishEdition?.numberInSurah || arabicEdition?.numberInSurah || '';

    return {
      title: 'Quran Insight',
      text,
      source: ayahInSurah ? `${surahName} ${ayahInSurah}` : surahName,
      arabicText,
    };
  } catch (error) {
    console.error('Daily insight API fetch failed:', error);
    return null;
  }
};

const FALLBACK_HADITH: DailyHadith = {
  arabic: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ',
  english: 'The best among you are those who learn the Quran and teach it.',
  source: 'Sahih al-Bukhari',
};

const isWhiteDay = (hijriDay: number): boolean => hijriDay >= 13 && hijriDay <= 15;
const isSunnahFastWeekday = (weekdayEn: string): boolean =>
  weekdayEn === 'Monday' || weekdayEn === 'Thursday';

export default function CalendarScreen() {
  const [hijriMonth, setHijriMonth] = useState<number>(1);
  const [hijriYear, setHijriYear] = useState<number>(1447);
  const [currentHijri, setCurrentHijri] = useState<{ year: number; month: number } | null>(null);
  const [monthData, setMonthData] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dailyHadith, setDailyHadith] = useState<DailyHadith | null>(null);
  const [hadithReflection, setHadithReflection] = useState<string | null>(null);
  const [loadingReflection, setLoadingReflection] = useState(false);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [selectedDayApiInsight, setSelectedDayApiInsight] = useState<OnThisDateReflection | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(1447);
  const { settings } = useSettings();
  const { showAlert } = useThemedAlert();
  const { t, lang } = useLanguage();
  const isDark = settings.isDarkMode;
  const WEEKDAYS = [t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat];
  const hadithArabicFontSize = Math.max(18, settings.arabicFontSize - 10);
  const onDateArabicFontSize = Math.max(20, settings.arabicFontSize - 12);
  const arabicFontFamily = resolveArabicFontFamily(settings.arabicFontFamily);

  // Automatically set to today's Hijri month on first load
  useEffect(() => {
    getHijriToday().then((hijri) => {
      if (!hijri) return;
      setCurrentHijri({ year: hijri.year, month: hijri.month });
      setHijriMonth(hijri.month);
      setHijriYear(hijri.year);
    });
  }, []);

  useEffect(() => {
    getUpcomingEvents(6).then(setUpcomingEvents).catch(() => {});
  }, []);

  useEffect(() => {
    if (hijriMonth && hijriYear) {
      fetchHijriMonth();
    }
  }, [hijriMonth, hijriYear]);

  useEffect(() => {
    if (monthData.length === 0) {
      setSelectedDay(null);
      return;
    }

    const today = new Date();
    const todayInMonth = monthData.find((day) =>
      Number(day.gregorian.day) === today.getDate() &&
      day.gregorian.month.number === today.getMonth() + 1 &&
      Number(day.gregorian.year) === today.getFullYear()
    );

    setSelectedDay((previous) => {
      if (previous) {
        const stillExists = monthData.find((day) => day.gregorian.date === previous.gregorian.date);
        if (stillExists) return stillExists;
      }
      return todayInMonth || monthData[0];
    });
  }, [monthData]);

  // Fetch Hadith of the Day (once per day, cached)
  useEffect(() => {
    const loadDailyHadith = async () => {
      try {
        const cached = await AsyncStorage.getItem('dailyHadith');
        const cachedDate = await AsyncStorage.getItem('dailyHadithDate');
        const today = new Date().toDateString();

        if (cached && cachedDate === today) {
          setDailyHadith(JSON.parse(cached) as DailyHadith);
          return;
        }

        const hadith = await fetchRandomDailyHadith();
        if (hadith) {
          setDailyHadith(hadith);
          await AsyncStorage.setItem('dailyHadith', JSON.stringify(hadith));
          await AsyncStorage.setItem('dailyHadithDate', today);
        } else {
          setDailyHadith(FALLBACK_HADITH);
        }
      } catch (error) {
        console.error('Hadith fetch error:', error);
        setDailyHadith(FALLBACK_HADITH);
      }
    };

    loadDailyHadith();
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadInsightForSelectedDay = async () => {
      if (!selectedDay) {
        setSelectedDayApiInsight(null);
        return;
      }

      const cacheKey = `${DAILY_INSIGHT_CACHE_PREFIX}${selectedDay.gregorian.date}`;
      try {
        const cachedInsight = await AsyncStorage.getItem(cacheKey);
        if (cachedInsight) {
          if (isActive) {
            setSelectedDayApiInsight(JSON.parse(cachedInsight) as OnThisDateReflection);
          }
          return;
        }

        const parsedDate = parseGregorianDateFromCalendarDay(selectedDay);
        if (!parsedDate) {
          if (isActive) setSelectedDayApiInsight(null);
          return;
        }

        const insight = await fetchInsightForDateFromApi(parsedDate);
        if (!isActive) return;

        if (insight) {
          setSelectedDayApiInsight(insight);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(insight));
        } else {
          setSelectedDayApiInsight(null);
        }
      } catch (error) {
        console.error('Selected-day insight load failed:', error);
        if (isActive) {
          setSelectedDayApiInsight(null);
        }
      }
    };

    void loadInsightForSelectedDay();
    return () => {
      isActive = false;
    };
  }, [selectedDay]);

  const fetchHijriMonth = async (): Promise<void> => {
    setLoading(true);
    const cacheKey = `${MONTH_CACHE_PREFIX}${hijriYear}-${hijriMonth}`;

    // Hijri↔gregorian mapping never changes — cached months work fully offline
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        setMonthData(JSON.parse(cached) as CalendarDay[]);
        setLoading(false);
        return;
      }
    } catch {
      // fall through to the network
    }

    try {
      const response = await axios.get(`${API_BASE}/hToGCalendar/${hijriMonth}/${hijriYear}`);
      if (response.data.code === 200) {
        const days = response.data.data as CalendarDay[];
        setMonthData(days);
        AsyncStorage.setItem(cacheKey, JSON.stringify(days)).catch(() => {});
      } else {
        showAlert({
          title: 'Error',
          message: 'Failed to load Islamic calendar',
          variant: 'danger',
        });
      }
    } catch (error) {
      console.error('API error:', error);
      showAlert({
        title: 'Network Error',
        message: 'Please check your connection',
        variant: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (delta: number) => {
    let newMonth: number = hijriMonth + delta;
    let newYear: number = hijriYear;

    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }

    setHijriMonth(newMonth);
    setHijriYear(newYear);
  };

  const goToToday = useCallback(() => {
    if (!currentHijri) return;
    setHijriMonth(currentHijri.month);
    setHijriYear(currentHijri.year);

    const today = new Date();
    const todayInMonth = monthData.find((day) =>
      Number(day.gregorian.day) === today.getDate() &&
      day.gregorian.month.number === today.getMonth() + 1 &&
      Number(day.gregorian.year) === today.getFullYear()
    );
    if (todayInMonth) setSelectedDay(todayInMonth);
  }, [currentHijri, monthData]);

  const isOnCurrentMonth =
    currentHijri !== null && hijriMonth === currentHijri.month && hijriYear === currentHijri.year;

  const monthGrid = useMemo<(CalendarDay | null)[]>(() => {
    if (monthData.length === 0) return [];

    const firstWeekday = monthData[0].gregorian.weekday.en.toLowerCase();
    const firstWeekdayIndex = Math.max(
      WEEKDAYS_FALLBACK.findIndex((weekday) => firstWeekday.startsWith(weekday.toLowerCase())),
      0
    );

    const leadingEmptyCells = Array.from({ length: firstWeekdayIndex }, () => null);
    const baseGrid = [...leadingEmptyCells, ...monthData];
    const trailingCellsCount = (7 - (baseGrid.length % 7)) % 7;
    const trailingEmptyCells = Array.from({ length: trailingCellsCount }, () => null);
    return [...baseGrid, ...trailingEmptyCells];
  }, [monthData]);

  // Only the curated ISLAMIC_EVENTS list drives events. The Aladhan API's
  // hijri.holidays[] is deliberately ignored — it carries a long tail of
  // minor commemorations (scholar birthdays, regional observances) that
  // cluttered the calendar.
  const selectedDayEvents = useMemo<string[]>(() => {
    if (!selectedDay) return [];
    return getEventsForHijriDay(hijriMonth, Number(selectedDay.hijri.day)).map((e) =>
      lang === 'ar' ? `${e.emoji} ${e.nameAr}` : `${e.emoji} ${e.nameEn}`
    );
  }, [selectedDay, hijriMonth, lang]);

  const selectedDayFastingBadges = useMemo<string[]>(() => {
    if (!selectedDay) return [];
    const badges: string[] = [];
    if (isWhiteDay(Number(selectedDay.hijri.day))) badges.push(`🌕 ${t.whiteDays}`);
    if (isSunnahFastWeekday(selectedDay.gregorian.weekday.en)) badges.push(`🤍 ${t.sunnahFast}`);
    return badges;
  }, [selectedDay, t.whiteDays, t.sunnahFast]);

  const selectedDayReflection = useMemo<OnThisDateReflection | null>(() => {
    if (!selectedDay) return null;

    const dayNum = Number(selectedDay.hijri.day);
    const monthRaw = selectedDay.hijri.month.number;
    const monthNum = Number(monthRaw);
    const fallbackMonth = Number.isFinite(monthNum) && monthNum > 0 ? monthNum : hijriMonth;
    const safeDay = Number.isFinite(dayNum) && dayNum > 0 ? dayNum : 1;

    const index = (safeDay + fallbackMonth * 7) % ON_THIS_DATE_REFLECTIONS.length;
    return ON_THIS_DATE_REFLECTIONS[index];
  }, [selectedDay, hijriMonth]);
  const onThisDateInsight = selectedDayApiInsight ?? selectedDayReflection;

  const countdownLabel = (daysAway: number): string => {
    if (daysAway === 0) return t.today;
    if (daysAway === 1) return t.tomorrow;
    return `${daysAway} ${t.days}`;
  };

  const isRamadanMonth = hijriMonth === 9;

  const renderDay = (day: CalendarDay | null, index: number) => {
    if (!day) {
      return <View key={`empty-${index}`} style={styles.emptyCell} />;
    }

    const greg = day.gregorian;
    const hij = day.hijri;
    const hijDayNum = Number(hij.day);
    const isSelected = selectedDay?.gregorian.date === day.gregorian.date;

    const today = new Date();
    const isToday =
      Number(greg.day) === today.getDate() &&
      greg.month.number === today.getMonth() + 1 &&
      Number(greg.year) === today.getFullYear();

    const hasEvent = getEventsForHijriDay(hijriMonth, hijDayNum).length > 0;
    const whiteDay = isWhiteDay(hijDayNum);
    const sunnahFast = isSunnahFastWeekday(greg.weekday.en);

    return (
      <TouchableOpacity
        key={day.gregorian.date}
        style={styles.dayCell}
        onPress={() => setSelectedDay(day)}
      >
        <View style={[
          styles.dayCard,
          isRamadanMonth && styles.ramadanCell,
          greg.weekday.en === 'Friday' && styles.fridayCell,
          isToday && styles.todayCell,
          isSelected && !isToday && styles.selectedCell,
        ]}>
          <Text style={[
            styles.hijriDay,
            isToday && styles.todayText,
          ]}>
            {hij.day}
          </Text>
          <Text style={[
            styles.gregDay,
            isToday && styles.todayText,
          ]}>
            {greg.day}
          </Text>
          <View style={styles.dotsRow}>
            {hasEvent && <View style={[styles.dot, styles.eventDot]} />}
            {whiteDay && <View style={[styles.dot, styles.whiteDayDot]} />}
            {!whiteDay && sunnahFast && <View style={[styles.dot, styles.fastDot]} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <GlassBackground isDark={isDark}>
      <View style={styles.container}>
        <ScreenIntroTile
          title={t.calendarTitle}
          description={t.calendarDescription}
          isDark={isDark}
          style={styles.introTile}
        />

        <View style={styles.navigation}>
          <TouchableOpacity style={styles.navChevron} onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={18} color={UI_COLORS.accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.monthTitleWrap}
            onPress={() => {
              setPickerYear(hijriYear);
              setShowMonthPicker(true);
            }}
          >
            <Text style={styles.monthTitle}>
              {getHijriMonthName(hijriMonth, lang)} {hijriYear}
            </Text>
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navChevron} onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={18} color={UI_COLORS.accent} />
          </TouchableOpacity>
        </View>

        {!isOnCurrentMonth && currentHijri && (
          <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
            <Ionicons name="calendar-outline" size={13} color="#5ddb92" />
            <Text style={styles.todayButtonText}>{t.today}</Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#27ae60" style={{ marginTop: 30 }} />
        ) : monthData.length === 0 ? (
          <Text style={styles.noData}>{t.noCalendarData}</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* Centered calendar grid wrapper */}
            <View style={styles.gridWrapper}>
              <View style={styles.weekdayHeader}>
                {WEEKDAYS.map((weekday) => (
                  <Text key={weekday} style={styles.weekdayText}>
                    {weekday}
                  </Text>
                ))}
              </View>

              <View style={styles.grid}>
                {monthGrid.map((day, index) => renderDay(day, index))}
              </View>
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: UI_COLORS.primary }]} />
                <Text style={styles.legendText}>{t.today}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: UI_COLORS.friday }]} />
                <Text style={styles.legendText}>{t.friday}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.eventDot]} />
                <Text style={styles.legendText}>{t.eventDot}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.whiteDayDot]} />
                <Text style={styles.legendText}>{t.whiteDays}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.fastDot]} />
                <Text style={styles.legendText}>{t.sunnahFast}</Text>
              </View>
            </View>

            {selectedDay && (
              <View style={styles.selectedDayContainer}>
                <View style={styles.selectedDateRow}>
                  <View style={styles.selectedDateBlock}>
                    <Text style={styles.selectedDateLabel}>{t.hijriLabel}</Text>
                    <Text style={styles.selectedDateBig}>{selectedDay.hijri.day}</Text>
                    <Text style={styles.selectedDateSub}>
                      {getHijriMonthName(hijriMonth, lang)} {selectedDay.hijri.year}
                    </Text>
                  </View>
                  <View style={styles.selectedDateDivider} />
                  <View style={styles.selectedDateBlock}>
                    <Text style={styles.selectedDateLabel}>{t.gregorianLabel}</Text>
                    <Text style={styles.selectedDateBig}>{selectedDay.gregorian.day}</Text>
                    <Text style={styles.selectedDateSub}>
                      {selectedDay.gregorian.month.en} {selectedDay.gregorian.year}
                    </Text>
                  </View>
                </View>

                {(selectedDayEvents.length > 0 || selectedDayFastingBadges.length > 0) && (
                  <View style={styles.badgesWrap}>
                    {selectedDayEvents.map((event) => (
                      <View key={event} style={[styles.badge, styles.eventBadge]}>
                        <Text style={styles.eventBadgeText}>{event}</Text>
                      </View>
                    ))}
                    {selectedDayFastingBadges.map((badge) => (
                      <View key={badge} style={[styles.badge, styles.fastBadge]}>
                        <Text style={styles.fastBadgeText}>{badge}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {selectedDayEvents.length === 0 && (
                  <View style={styles.onDateSection}>
                    <Text style={styles.onDateSectionTitle}>{onThisDateInsight?.title || 'Reflection'}</Text>
                    {onThisDateInsight?.arabicText ? (
                      <Text
                        style={[
                          styles.onDateArabicText,
                          { fontSize: onDateArabicFontSize },
                          arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
                        ]}
                      >
                        {onThisDateInsight.arabicText}
                      </Text>
                    ) : null}
                    <Text style={styles.onDateInsightText}>
                      {onThisDateInsight?.text || 'Reflect on this day with gratitude and sincere intention.'}
                    </Text>
                    <Text style={styles.onDateSourceText}>
                      {onThisDateInsight?.source || 'Daily reflection'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Upcoming Islamic occasions */}
            {upcomingEvents.length > 0 && (
              <View style={styles.upcomingContainer}>
                <Text style={styles.upcomingTitle}>{t.upcomingEvents}</Text>
                {upcomingEvents.map((event) => (
                  <View key={`${event.hijriYear}-${event.month}-${event.day}`} style={styles.upcomingRow}>
                    <Text style={styles.upcomingEmoji}>{event.emoji}</Text>
                    <View style={styles.upcomingInfo}>
                      <Text style={styles.upcomingName}>
                        {lang === 'ar' ? event.nameAr : event.nameEn}
                      </Text>
                      <Text style={styles.upcomingDate}>
                        {event.day} {getHijriMonthName(event.month, lang)} · {event.gregorianDate.toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={[styles.countdownChip, event.daysAway <= 1 && styles.countdownChipSoon]}>
                      <Text style={[styles.countdownText, event.daysAway <= 1 && styles.countdownTextSoon]}>
                        {countdownLabel(event.daysAway)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Hadith of the Day */}
            {dailyHadith && (
              <View style={styles.hadithContainer}>
                <Text style={styles.hadithTitle}>{t.hadithOfTheDay}</Text>
                <Text
                  style={[
                    styles.hadithArabic,
                    { fontSize: hadithArabicFontSize },
                    arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
                  ]}
                >
                  {dailyHadith.arabic}
                </Text>
                <Text style={styles.hadithEnglish}>{dailyHadith.english}</Text>
                <Text style={styles.hadithSource}>({dailyHadith.source})</Text>

                {hadithReflection ? (
                  <View style={styles.reflectionBox}>
                    <Text style={styles.reflectionLabel}>{t.aiReflection}</Text>
                    <Text style={styles.reflectionText}>{hadithReflection}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.reflectionButton}
                    onPress={async () => {
                      if (loadingReflection || !dailyHadith) return;
                      setLoadingReflection(true);
                      try {
                        const reflection = await getAiInsight('hadith', {
                          arabic: dailyHadith.arabic,
                          english: dailyHadith.english,
                          source: dailyHadith.source,
                        }, undefined, lang);
                        setHadithReflection(reflection);
                      } catch {
                        setHadithReflection('Could not load reflection. Please try again.');
                      } finally {
                        setLoadingReflection(false);
                      }
                    }}
                    disabled={loadingReflection}
                  >
                    {loadingReflection ? (
                      <ActivityIndicator size="small" color={UI_COLORS.accent} />
                    ) : (
                      <Text style={styles.reflectionButtonText}>{t.aiReflection}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        )}

        {/* Month/year picker */}
        <Modal
          visible={showMonthPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMonthPicker(false)}
        >
          <Pressable style={styles.pickerBackdrop} onPress={() => setShowMonthPicker(false)}>
            <Pressable style={styles.pickerCard} onPress={() => undefined}>
              <Text style={styles.pickerTitle}>{t.selectMonthYear}</Text>

              <View style={styles.pickerYearRow}>
                <TouchableOpacity style={styles.pickerYearBtn} onPress={() => setPickerYear((y) => y - 1)}>
                  <Ionicons name="chevron-back" size={18} color={UI_COLORS.accent} />
                </TouchableOpacity>
                <Text style={styles.pickerYearText}>{pickerYear}</Text>
                <TouchableOpacity style={styles.pickerYearBtn} onPress={() => setPickerYear((y) => y + 1)}>
                  <Ionicons name="chevron-forward" size={18} color={UI_COLORS.accent} />
                </TouchableOpacity>
              </View>

              <View style={styles.pickerMonthGrid}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                  const isActive = m === hijriMonth && pickerYear === hijriYear;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.pickerMonthCell, isActive && styles.pickerMonthCellActive]}
                      onPress={() => {
                        setHijriMonth(m);
                        setHijriYear(pickerYear);
                        setShowMonthPicker(false);
                      }}
                    >
                      <Text style={[styles.pickerMonthText, isActive && styles.pickerMonthTextActive]}>
                        {getHijriMonthName(m, lang)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  introTile: {
    marginHorizontal: 0,
    marginBottom: 14,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  navChevron: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  monthTitle: { fontSize: 20, fontWeight: '700', color: UI_COLORS.text },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    backgroundColor: 'rgba(31,157,85,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(31,157,85,0.35)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 10,
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5ddb92',
  },
  weekdayHeader: {
    flexDirection: 'row',
    marginBottom: 8,
    backgroundColor: 'rgba(31,157,85,0.15)',
    paddingVertical: 8,
    borderRadius: 8,
    width: '100%',
    maxWidth: 400,
  },
  weekdayText: { flex: 1, textAlign: 'center', fontWeight: 'bold', color: UI_COLORS.text },
  gridWrapper: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  dayCell: {
    width: '14.2857%',
    aspectRatio: 0.92,
    padding: 2,
  },
  emptyCell: {
    width: '14.2857%',
    aspectRatio: 0.92,
    padding: 2,
  },
  dayCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 3,
  },
  ramadanCell: {
    backgroundColor: 'rgba(245,166,35,0.09)',
    borderColor: 'rgba(245,166,35,0.22)',
  },
  fridayCell: { backgroundColor: UI_COLORS.friday },
  todayCell: { backgroundColor: UI_COLORS.primary },
  selectedCell: { borderColor: UI_COLORS.accent, borderWidth: 2 },
  hijriDay: { fontSize: 15, fontWeight: '700', color: UI_COLORS.text },
  gregDay: { fontSize: 11, color: UI_COLORS.textMuted, marginTop: 2 },
  todayText: { color: UI_COLORS.white },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
    height: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  eventDot: { backgroundColor: '#f5a623' },
  whiteDayDot: { backgroundColor: 'rgba(255,255,255,0.85)' },
  fastDot: { backgroundColor: '#5ddb92' },
  noData: { fontSize: 16, textAlign: 'center', color: UI_COLORS.textMuted, marginTop: 50 },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
    width: '100%',
    maxWidth: 400,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: { fontSize: 11, color: UI_COLORS.textMuted },

  selectedDayContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(31,157,85,0.12)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(31,157,85,0.3)',
    width: '100%',
    maxWidth: 400,
  },
  selectedDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedDateBlock: {
    flex: 1,
    alignItems: 'center',
  },
  selectedDateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  selectedDateBig: {
    fontSize: 30,
    fontWeight: '800',
    color: UI_COLORS.white,
    lineHeight: 34,
  },
  selectedDateSub: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
    marginTop: 2,
  },
  selectedDateDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  badgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  eventBadge: {
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderColor: 'rgba(245,166,35,0.35)',
  },
  eventBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f5c778',
  },
  fastBadge: {
    backgroundColor: 'rgba(31,157,85,0.14)',
    borderColor: 'rgba(31,157,85,0.35)',
  },
  fastBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5ddb92',
  },
  onDateSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  onDateSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5ddb92',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  onDateInsightText: {
    fontSize: 14,
    color: UI_COLORS.text,
    lineHeight: 21,
    textAlign: 'center',
  },
  onDateArabicText: {
    marginBottom: 8,
    color: UI_COLORS.text,
    lineHeight: 36,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  onDateSourceText: {
    marginTop: 5,
    fontSize: 12,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  upcomingContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    width: '100%',
    maxWidth: 400,
    ...UI_SHADOWS.card,
  },
  upcomingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f5c778',
    textAlign: 'center',
    marginBottom: 12,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    gap: 10,
  },
  upcomingEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingName: {
    fontSize: 14,
    fontWeight: '600',
    color: UI_COLORS.text,
  },
  upcomingDate: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
    marginTop: 1,
  },
  countdownChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countdownChipSoon: {
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderColor: 'rgba(245,166,35,0.4)',
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: UI_COLORS.textMuted,
  },
  countdownTextSoon: {
    color: '#f5c778',
  },

  hadithContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    width: '100%',
    maxWidth: 400,
    ...UI_SHADOWS.card,
  },
  hadithTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: UI_COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  hadithArabic: {
    fontSize: 16,
    color: UI_COLORS.text,
    textAlign: 'right',
    marginBottom: 8,
  },
  hadithEnglish: {
    fontSize: 14,
    color: UI_COLORS.textMuted,
    textAlign: 'left',
    marginBottom: 8,
  },
  hadithSource: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  reflectionButton: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: UI_RADII.sm,
    borderWidth: 1,
    borderColor: UI_COLORS.accent,
    alignItems: 'center',
  },
  reflectionButtonText: {
    color: UI_COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  reflectionBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: 'rgba(45,127,184,0.15)',
    borderRadius: UI_RADII.sm,
    borderLeftWidth: 3,
    borderLeftColor: UI_COLORS.accent,
  },
  reflectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: UI_COLORS.accent,
    marginBottom: 6,
  },
  reflectionText: {
    fontSize: 14,
    lineHeight: 21,
    color: UI_COLORS.text,
  },

  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,18,31,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(18,46,63,0.97)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 20,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: UI_COLORS.text,
    textAlign: 'center',
    marginBottom: 14,
  },
  pickerYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  pickerYearBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerYearText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f5c778',
    minWidth: 70,
    textAlign: 'center',
  },
  pickerMonthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  pickerMonthCell: {
    width: '30%',
    paddingVertical: 10,
    borderRadius: UI_RADII.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  pickerMonthCellActive: {
    backgroundColor: UI_COLORS.primary,
    borderColor: UI_COLORS.primary,
  },
  pickerMonthText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  pickerMonthTextActive: {
    color: UI_COLORS.white,
  },
});
