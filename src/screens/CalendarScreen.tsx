import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../context/SettingsContext';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import { fetchRandomDailyHadith, DailyHadith } from '../services/hadithService';
import ScreenIntroTile from '../components/ScreenIntroTile';

const API_BASE = 'https://api.aladhan.com/v1';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
    month: { en: string };
    year: string;
  };
};

const FALLBACK_HADITH: DailyHadith = {
  arabic: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ',
  english: 'The best among you are those who learn the Quran and teach it.',
  source: 'Sahih al-Bukhari',
};

export default function CalendarScreen() {
  const [hijriMonth, setHijriMonth] = useState<number>(1);
  const [hijriYear, setHijriYear] = useState<number>(1447);
  const [monthData, setMonthData] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dailyHadith, setDailyHadith] = useState<DailyHadith | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const { settings } = useSettings();
  const isDark = settings.isDarkMode;
  const hadithArabicFontSize = Math.max(18, settings.arabicFontSize - 10);


  // Automatically set to today's Hijri month on first load
  useEffect(() => {
    const loadCurrentHijriMonth = async () => {
      try {
        const today = new Date();
        const formatted = today.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).replace(/\//g, '-');

        const response = await axios.get(`${API_BASE}/gToH/${formatted}`);
        if (response.data.code === 200) {
          const hijri = response.data.data.hijri;
          setHijriMonth(Number(hijri.month.number));
          setHijriYear(Number(hijri.year));
        }
      } catch (error) {
        console.error('Failed to load current Hijri month:', error);
      }
    };

    loadCurrentHijriMonth();
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
      // Check if we already have a Hadith cached for today
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

  const fetchHijriMonth = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/hToGCalendar/${hijriMonth}/${hijriYear}`);
      if (response.data.code === 200) {
        setMonthData(response.data.data);
      } else {
        Alert.alert('Error', 'Failed to load Islamic calendar');
      }
    } catch (error) {
      console.error('API error:', error);
      Alert.alert('Network Error', 'Please check your connection');
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

  const getMonthName = (month: number) => {
    const names = [
      'Muharram', 'Safar', 'Rabi\' I', 'Rabi\' II',
      'Jumada I', 'Jumada II', 'Rajab', 'Sha\'ban',
      'Ramadan', 'Shawwal', 'Dhul-Qa\'dah', 'Dhul-Hijjah'
    ];
    return names[month - 1] || 'Unknown';
  };

  const monthGrid = useMemo<(CalendarDay | null)[]>(() => {
    if (monthData.length === 0) return [];

    const firstWeekday = monthData[0].gregorian.weekday.en.toLowerCase();
    const firstWeekdayIndex = Math.max(
      WEEKDAYS.findIndex((weekday) => firstWeekday.startsWith(weekday.toLowerCase())),
      0
    );

    const leadingEmptyCells = Array.from({ length: firstWeekdayIndex }, () => null);
    const baseGrid = [...leadingEmptyCells, ...monthData];
    const trailingCellsCount = (7 - (baseGrid.length % 7)) % 7;
    const trailingEmptyCells = Array.from({ length: trailingCellsCount }, () => null);
    return [...baseGrid, ...trailingEmptyCells];
  }, [monthData]);

  const renderDay = (day: CalendarDay | null, index: number) => {
    if (!day) {
      return <View key={`empty-${index}`} style={styles.emptyCell} />;
    }

    const greg = day.gregorian;
    const hij = day.hijri;
    const isSelected = selectedDay?.gregorian.date === day.gregorian.date;

    const today = new Date();
    const isToday =
      Number(greg.day) === today.getDate() &&
      greg.month.number === today.getMonth() + 1 &&
      Number(greg.year) === today.getFullYear();

    return (
      <TouchableOpacity
        key={day.gregorian.date}
        style={styles.dayCell}
        onPress={() => setSelectedDay(day)}
      >
        <View style={[
          styles.dayCard,
          isDark && styles.darkCard,
          greg.weekday.en === 'Friday' && styles.fridayCell,
          isToday && styles.todayCell,
          isSelected && !isToday && styles.selectedCell,
        ]}>
          <Text style={[
            styles.hijriDay,
            isDark && !isToday && styles.darkText,
            isToday && styles.todayText,
          ]}>
            {hij.day}
          </Text>
          <Text style={[
            styles.gregDay,
            isDark && !isToday && styles.darkMutedText,
            isToday && styles.todayText,
          ]}>
            {greg.day}
          </Text>
          <Text style={[styles.gregMonthSmall, isDark && !isToday && styles.darkMutedText]}>
            {greg.month.en.substring(0, 3)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    //<SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isDark && styles.darkBg]}>
        <ScreenIntroTile
          title="Islamic Calendar"
          description="This calendar displays the current Islamic (Hijri) month with corresponding Gregorian dates. Tap any day to highlight it and view its full Hijri and Gregorian date details. The Hadith of the Day is shown below for daily reflection."
          isDark={isDark}
          style={styles.introTile}
        />

        <View style={styles.navigation}>
          <TouchableOpacity onPress={() => changeMonth(-1)}>
            <Text style={styles.navButton}>← Prev</Text>
          </TouchableOpacity>

          <Text style={[styles.monthTitle, isDark && styles.darkText]}>
            {getMonthName(hijriMonth)} {hijriYear} AH
          </Text>

          <TouchableOpacity onPress={() => changeMonth(1)}>
            <Text style={styles.navButton}>Next →</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#27ae60" />
        ) : monthData.length === 0 ? (
          <Text style={[styles.noData, isDark && styles.darkMutedText]}>No data available for this month</Text>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.scrollContent}>

              {/* Centered calendar grid wrapper */}
              <View style={styles.gridWrapper}>
                <View style={[styles.weekdayHeader, isDark && styles.darkWeekdayHeader]}>
                  {WEEKDAYS.map((weekday) => (
                    <Text key={weekday} style={[styles.weekdayText, isDark && styles.darkText]}>
                      {weekday}
                    </Text>
                  ))}
                </View>

                {/* Days grid */}
                <View style={styles.grid}>
                  {monthGrid.map((day, index) => renderDay(day, index))}
                </View>
              </View>

              {selectedDay && (
                <View style={[styles.selectedDayContainer, isDark && styles.darkSelectedDayContainer]}>
                  <Text style={styles.selectedDayTitle}>Selected Day</Text>
                  <Text style={[styles.selectedDayText, isDark && styles.darkText]}>
                    Hijri: {selectedDay.hijri.day} {selectedDay.hijri.month.en} {selectedDay.hijri.year} AH
                  </Text>
                  <Text style={[styles.selectedDayText, isDark && styles.darkText]}>
                    Gregorian: {selectedDay.gregorian.weekday.en}, {selectedDay.gregorian.day} {selectedDay.gregorian.month.en} {selectedDay.gregorian.year}
                  </Text>
                </View>
              )}

              {/* Hadith of the Day - displayed below the calendar */}
              {dailyHadith && (
                <View style={[styles.hadithContainer, isDark && styles.darkCard]}>
                  <Text style={[styles.hadithTitle, isDark && styles.darkText]}>Hadith of the Day</Text>
                  <Text style={[styles.hadithArabic, { fontSize: hadithArabicFontSize }, isDark && styles.darkText]}>
                    {dailyHadith.arabic}
                  </Text>
                  <Text style={[styles.hadithEnglish, isDark && styles.darkMutedText]}>{dailyHadith.english}</Text>
                  <Text style={[styles.hadithSource, isDark && styles.darkMutedText]}>({dailyHadith.source})</Text>
                </View>
              )}

              {/* Legend */}
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#27ae60' }]} />
                  <Text style={[styles.legendText, isDark && styles.darkText]}>Today</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#b3e0f9' }]} />
                  <Text style={[styles.legendText, isDark && styles.darkText]}>Friday (Jumu'ah)</Text>
                </View>
              </View>
            </ScrollView>
          </>
        )}
      </View>
    //</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: UI_COLORS.text },
  container: { flex: 1, backgroundColor: UI_COLORS.background, padding: 16 },
  darkBg: { backgroundColor: UI_COLORS.darkBackground },
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
    marginBottom: 16,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  navButton: { fontSize: 16, color: '#3498db' },
  monthTitle: { fontSize: 22, fontWeight: '600', color: UI_COLORS.text },
  weekdayHeader: { 
    flexDirection: 'row', 
    marginBottom: 8,
    backgroundColor: UI_COLORS.primarySoft,
    paddingVertical: 8,
    borderRadius: 8,
    width: '100%',
    maxWidth: 400,
  },
  darkWeekdayHeader: {
    backgroundColor: '#1f2d2f',
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
    aspectRatio: 1,
    padding: 2,
  },
  emptyCell: {
    width: '14.2857%',
    aspectRatio: 1,
    padding: 2,
  },
  dayCard: {
    flex: 1,
    backgroundColor: UI_COLORS.surface,
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: UI_COLORS.border,
  },
  darkCard: {
    backgroundColor: UI_COLORS.darkSurface,
    borderColor: '#30353b',
  },
  fridayCell: { backgroundColor: UI_COLORS.friday },
  todayCell: { backgroundColor: UI_COLORS.primary },
  selectedCell: { borderColor: UI_COLORS.accent, borderWidth: 2 },
  hijriDay: { fontSize: 16, fontWeight: '600', color: UI_COLORS.text },
  gregDay: { fontSize: 12, color: UI_COLORS.textMuted, marginTop: 4 },
  gregMonthSmall: { fontSize: 10, color: UI_COLORS.textMuted, marginTop: 2 },
  todayText: { color: UI_COLORS.white },
  noData: { fontSize: 18, textAlign: 'center', color: UI_COLORS.textMuted, marginTop: 50 },

  // Hadith of the Day - displayed below the calendar
  hadithContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.sm,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    width: '100%',
    maxWidth: 400,
    ...UI_SHADOWS.card,
  },
  selectedDayContainer: {
    marginTop: 18,
    padding: 14,
    backgroundColor: UI_COLORS.primarySoft,
    borderRadius: UI_RADII.sm,
    borderWidth: 1,
    borderColor: '#cde9d5',
    width: '100%',
    maxWidth: 400,
  },
  darkSelectedDayContainer: {
    backgroundColor: '#1f2d2f',
    borderColor: '#2f474a',
  },
  selectedDayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: UI_COLORS.primaryDeep,
    marginBottom: 6,
    textAlign: 'center',
  },
  selectedDayText: {
    fontSize: 14,
    color: UI_COLORS.text,
    textAlign: 'center',
    lineHeight: 20,
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
    fontFamily: 'AmiriQuran',
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

  // Legend at bottom
  legend: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginTop: 20, 
    marginBottom: 40 
  },
  legendItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: 16 
  },
  legendColor: { 
    width: 20, 
    height: 20, 
    borderRadius: 4, 
    marginRight: 8 
  },
  legendText: { fontSize: 14, color: UI_COLORS.text },
  darkText: { color: UI_COLORS.white },
  darkMutedText: { color: '#a8b3bd' },
});
