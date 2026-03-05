import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';


const publicHadithKey='$2y$10$lIz3MVDZTOL4NNpxnHQtq6CfeXSYjTwpVDa2oKBeAk51PxSvXS6'

const API_BASE = 'https://api.aladhan.com/v1';

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

type DailyHadith = {
  arabic: string;
  english: string;
  source: string;
};

export default function CalendarScreen() {
  const [hijriMonth, setHijriMonth] = useState<number>(1);
  const [hijriYear, setHijriYear] = useState<number>(1447);
  const [monthData, setMonthData] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dailyHadith, setDailyHadith] = useState<DailyHadith | null>(null);


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

      // Fetch new Hadith from hadithapi.com
      const response = await axios.get(`https://hadithapi.com/public/api/hadiths?apiKey=${publicHadithKey}`);

      if (response.data.status === 200 && response.data.hadiths.data.length > 0) {
        // Select a RANDOM Hadith from the list
        const randomIndex = Math.floor(Math.random() * response.data.hadiths.data.length);
        const hadith = response.data.hadiths.data[randomIndex];

        const formatted = {
          arabic: hadith.hadithArabic || 'No Arabic text available',
          english: hadith.hadithEnglish || 'No English text available',
          source: hadith.book?.bookName || 'Unknown source',
        };

        setDailyHadith(formatted);

        // Cache for today
        await AsyncStorage.setItem('dailyHadith', JSON.stringify(formatted));
        await AsyncStorage.setItem('dailyHadithDate', today);
      }
    } catch (error) {
      console.error('Hadith fetch error:', error);
      // Fallback Hadith if API fails
      setDailyHadith({
        arabic: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ',
        english: 'The best among you are those who learn the Quran and teach it.',
        source: 'Sahih al-Bukhari'
      });
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

  const renderDay = (day: CalendarDay) => {
    const greg = day.gregorian;
    const hij = day.hijri;

    // Check if this day is today
    const today = new Date();
    const isToday =
      Number(greg.day) === today.getDate() &&
      greg.month.number === today.getMonth() + 1 &&
      Number(greg.year) === today.getFullYear();

    return (
      <TouchableOpacity
        key={day.gregorian.date}
        style={[
          styles.dayCell,
          isToday && styles.todayCell,
          greg.weekday.en === 'Friday' && styles.fridayCell,
        ]}
        onPress={() => {
          const hadithText = dailyHadith
            ? `Hadith of the Day:\n\nArabic: ${dailyHadith.arabic}\n\nEnglish: ${dailyHadith.english}\n\n(${dailyHadith.source})`
            : 'Hadith loading...';

          Alert.alert(
            `${hij.day} ${hij.month.en} ${hij.year} AH`,
            `${greg.weekday.en}, ${greg.day} ${greg.month.en} ${greg.year}\n\n${hadithText}`
          );
        }}
      >
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
        {/* Small Gregorian month name */}
        <Text style={styles.gregMonthSmall}>
          {greg.month.en.substring(0, 3)}  {/* e.g., "Feb" */}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    //<SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Islamic Calendar</Text>

        <View style={styles.explanation}>
          <Text style={styles.explanationText}>
            This calendar displays the current Islamic (Hijri) month with corresponding Gregorian dates. 
            Tap any day to see its full details, including the Hadith of the Day for reflection and inspiration.
          </Text>
        </View>

        <View style={styles.navigation}>
          <TouchableOpacity onPress={() => changeMonth(-1)}>
            <Text style={styles.navButton}>← Prev</Text>
          </TouchableOpacity>

          <Text style={styles.monthTitle}>
            {getMonthName(hijriMonth)} {hijriYear} AH
          </Text>

          <TouchableOpacity onPress={() => changeMonth(1)}>
            <Text style={styles.navButton}>Next →</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#27ae60" />
        ) : monthData.length === 0 ? (
          <Text style={styles.noData}>No data available for this month</Text>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.scrollContent}>

              {/* Centered calendar grid wrapper */}
              <View style={styles.gridWrapper}>
                {/* Days grid */}
                <View style={styles.grid}>
                  {monthData.map(day => renderDay(day))}
                </View>
              </View>

              {/* Hadith of the Day - displayed below the calendar */}
              {dailyHadith && (
                <View style={styles.hadithContainer}>
                  <Text style={styles.hadithTitle}>Hadith of the Day</Text>
                  <Text style={styles.hadithArabic}>{dailyHadith.arabic}</Text>
                  <Text style={styles.hadithEnglish}>{dailyHadith.english}</Text>
                  <Text style={styles.hadithSource}>({dailyHadith.source})</Text>
                </View>
              )}

              {/* Legend */}
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#27ae60' }]} />
                  <Text style={styles.legendText}>Today</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#b3e0f9' }]} />
                  <Text style={styles.legendText}>Friday (Jumu'ah)</Text>
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
  scrollContent: { 
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: UI_COLORS.primaryDeep,
    textAlign: 'center',
    marginVertical: 20,
    letterSpacing: 0.5,
    fontFamily: 'AmiriQuran',
  },
  navigation: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
    width: '100%',
    maxWidth: 400,
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
  weekdayText: { flex: 1, textAlign: 'center', fontWeight: 'bold', color: UI_COLORS.text },
  gridWrapper: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'center',
    width: '100%',
  },
  dayCell: { 
    width: '13.5%', 
    aspectRatio: 1, 
    margin: 2, 
    backgroundColor: UI_COLORS.surface,
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: UI_COLORS.border,
  },
  fridayCell: { backgroundColor: UI_COLORS.friday },
  todayCell: { backgroundColor: UI_COLORS.primary },
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
  explanation: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: UI_COLORS.primarySoft,
    borderRadius: UI_RADII.sm,
    borderWidth: 1,
    borderColor: '#cde9d5',
    marginBottom: 16,
  },
  explanationText: {
    fontSize: 14,
    color: UI_COLORS.text,
    textAlign: 'center',
    lineHeight: 21,
  },
});
