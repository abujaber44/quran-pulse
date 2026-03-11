import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../context/SettingsContext';
import { resolveArabicFontFamily } from '../theme/fonts';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import { fetchAthkarContentOnline, AthkarItem } from '../services/athkarService';
import ScreenIntroTile from '../components/ScreenIntroTile';

interface AllahName {
  number: number;
  name: string;
  transliteration: string;
  en: { meaning: string };
}

type FeatureTab = 'athkar' | 'tasbeeh' | 'asma';
type AthkarPeriod = 'morning' | 'evening';

const TASBEEH_TARGET = 33;
const TASBEEH_BEAD_COUNT = 11;
const TASBEEH_STORAGE_KEY = '@quran_pulse_tasbeeh_daily_state';
const TASBEEH_WORDS = [
  'سُبْحَانَ اللَّهِ',
  'الْحَمْدُ لِلَّهِ',
  'لَا إِلَهَ إِلَّا اللَّهُ',
  'اللَّهُ أَكْبَرُ',
];

type TasbeehDailyState = {
  dateKey: string;
  count: number;
  roundIndex: number;
  cycles: number;
};

const MORNING_ATHKAR: AthkarItem[] = [
  {
    id: 'morning-1',
    title: 'Ayat Al-Kursi',
    repetitions: 1,
    text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ...',
  },
  {
    id: 'morning-2',
    title: 'Al-Ikhlas, Al-Falaq, An-Nas',
    repetitions: 3,
    text: 'قُلْ هُوَ اللَّهُ أَحَدٌ... قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ... قُلْ أَعُوذُ بِرَبِّ النَّاسِ...',
  },
  {
    id: 'morning-3',
    title: 'Morning Declaration',
    repetitions: 1,
    text: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ...',
  },
  {
    id: 'morning-4',
    title: 'By Allah We Enter Morning',
    repetitions: 1,
    text: 'اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ',
  },
  {
    id: 'morning-5',
    title: 'Contentment With Allah',
    repetitions: 3,
    text: 'رَضِيتُ بِاللَّهِ رَبًّا وَبِالْإِسْلَامِ دِينًا وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا',
  },
  {
    id: 'morning-6',
    title: 'Hasbi Allah',
    repetitions: 7,
    text: 'حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
  },
  {
    id: 'morning-7',
    title: 'Protection Supplication',
    repetitions: 3,
    text: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
  },
  {
    id: 'morning-8',
    title: 'Refuge in Allah’s Perfect Words',
    repetitions: 3,
    text: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
  },
];

const EVENING_ATHKAR: AthkarItem[] = [
  {
    id: 'evening-1',
    title: 'Ayat Al-Kursi',
    repetitions: 1,
    text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ...',
  },
  {
    id: 'evening-2',
    title: 'Al-Ikhlas, Al-Falaq, An-Nas',
    repetitions: 3,
    text: 'قُلْ هُوَ اللَّهُ أَحَدٌ... قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ... قُلْ أَعُوذُ بِرَبِّ النَّاسِ...',
  },
  {
    id: 'evening-3',
    title: 'Evening Declaration',
    repetitions: 1,
    text: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ...',
  },
  {
    id: 'evening-4',
    title: 'By Allah We Enter Evening',
    repetitions: 1,
    text: 'اللَّهُمَّ بِكَ أَمْسَيْنَا وَبِكَ أَصْبَحْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ الْمَصِيرُ',
  },
  {
    id: 'evening-5',
    title: 'Contentment With Allah',
    repetitions: 3,
    text: 'رَضِيتُ بِاللَّهِ رَبًّا وَبِالْإِسْلَامِ دِينًا وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا',
  },
  {
    id: 'evening-6',
    title: 'Hasbi Allah',
    repetitions: 7,
    text: 'حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
  },
  {
    id: 'evening-7',
    title: 'Protection Supplication',
    repetitions: 3,
    text: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
  },
  {
    id: 'evening-8',
    title: 'Seeking Wellbeing',
    repetitions: 1,
    text: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ',
  },
];

const getLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AthkarScreen() {
  const [activeFeature, setActiveFeature] = useState<FeatureTab>('athkar');
  const [athkarPeriod, setAthkarPeriod] = useState<AthkarPeriod>('morning');
  const [morningAthkar, setMorningAthkar] = useState<AthkarItem[]>(MORNING_ATHKAR);
  const [eveningAthkar, setEveningAthkar] = useState<AthkarItem[]>(EVENING_ATHKAR);
  const [athkarSource, setAthkarSource] = useState<'fallback' | 'online'>('fallback');
  const [athkarLoading, setAthkarLoading] = useState(true);
  const [athkarSourceLabel, setAthkarSourceLabel] = useState<string>('');

  const [names, setNames] = useState<AllahName[]>([]);
  const [filteredNames, setFilteredNames] = useState<AllahName[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [namesLoading, setNamesLoading] = useState(true);
  const [namesError, setNamesError] = useState<string | null>(null);

  const [tasbeehCount, setTasbeehCount] = useState(0);
  const [tasbeehRoundIndex, setTasbeehRoundIndex] = useState(0);
  const [tasbeehCycles, setTasbeehCycles] = useState(0);
  const [tasbeehStateReady, setTasbeehStateReady] = useState(false);

  const { settings } = useSettings();
  const isDark = settings.isDarkMode;
  const arabicFontFamily = resolveArabicFontFamily(settings.arabicFontFamily);
  const athkarArabicFontSize = Math.max(24, settings.arabicFontSize - 2);
  const activeBeadIndex = tasbeehCount === 0 ? -1 : (tasbeehCount - 1) % TASBEEH_BEAD_COUNT;
  const activeAthkarList = useMemo(
    () => (athkarPeriod === 'morning' ? morningAthkar : eveningAthkar),
    [athkarPeriod, morningAthkar, eveningAthkar]
  );

  useEffect(() => {
    const fetchNames = async () => {
      try {
        const response = await fetch('https://api.aladhan.com/v1/asmaAlHusna');
        const json = await response.json();
        if (json.code === 200) {
          setNames(json.data);
          setFilteredNames(json.data);
          setNamesError(null);
        } else {
          setNamesError('Failed to load Asma Al-Husna');
        }
      } catch {
        setNamesError('Network error. Please check your connection.');
      } finally {
        setNamesLoading(false);
      }
    };

    void fetchNames();
  }, []);

  useEffect(() => {
    const loadTasbeehState = async () => {
      try {
        const savedRaw = await AsyncStorage.getItem(TASBEEH_STORAGE_KEY);
        if (!savedRaw) {
          return;
        }

        const saved = JSON.parse(savedRaw) as TasbeehDailyState;
        const today = getLocalDateKey();
        if (!saved || saved.dateKey !== today) {
          return;
        }

        const safeCount = Math.max(0, Math.min(TASBEEH_TARGET, Number(saved.count) || 0));
        const safeRound = Math.max(0, Math.min(TASBEEH_WORDS.length - 1, Number(saved.roundIndex) || 0));
        const safeCycles = Math.max(0, Number(saved.cycles) || 0);

        setTasbeehCount(safeCount);
        setTasbeehRoundIndex(safeRound);
        setTasbeehCycles(safeCycles);
      } catch (loadError) {
        console.warn('Failed to load tasbeeh daily state:', loadError);
      } finally {
        setTasbeehStateReady(true);
      }
    };

    void loadTasbeehState();
  }, []);

  useEffect(() => {
    if (!tasbeehStateReady) {
      return;
    }

    const persistTasbeehState = async () => {
      const payload: TasbeehDailyState = {
        dateKey: getLocalDateKey(),
        count: tasbeehCount,
        roundIndex: tasbeehRoundIndex,
        cycles: tasbeehCycles,
      };

      try {
        await AsyncStorage.setItem(TASBEEH_STORAGE_KEY, JSON.stringify(payload));
      } catch (saveError) {
        console.warn('Failed to save tasbeeh daily state:', saveError);
      }
    };

    void persistTasbeehState();
  }, [tasbeehCount, tasbeehRoundIndex, tasbeehCycles, tasbeehStateReady]);

  useEffect(() => {
    const loadAthkarOnline = async () => {
      setAthkarLoading(true);
      try {
        const online = await fetchAthkarContentOnline();
        if (online) {
          setMorningAthkar(online.morning.length > 0 ? online.morning : MORNING_ATHKAR);
          setEveningAthkar(online.evening.length > 0 ? online.evening : EVENING_ATHKAR);
          setAthkarSource('online');
          setAthkarSourceLabel(online.source || 'Online source');
          return;
        }
      } catch {
        // fallback remains
      } finally {
        setAthkarLoading(false);
      }

      setMorningAthkar(MORNING_ATHKAR);
      setEveningAthkar(EVENING_ATHKAR);
      setAthkarSource('fallback');
      setAthkarSourceLabel('Built-in fallback');
    };

    void loadAthkarOnline();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredNames(names);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = names.filter((item) => {
      return (
        item.name.includes(searchQuery) ||
        item.transliteration.toLowerCase().includes(query) ||
        item.en.meaning.toLowerCase().includes(query)
      );
    });

    setFilteredNames(filtered);
  }, [searchQuery, names]);

  const clearSearch = () => {
    setSearchQuery('');
  };

  const handleTasbeehPress = () => {
    setTasbeehCount((prevCount) => {
      if (prevCount < TASBEEH_TARGET) {
        return prevCount + 1;
      }

      setTasbeehRoundIndex((prevRound) => {
        const nextRound = (prevRound + 1) % TASBEEH_WORDS.length;
        if (nextRound === 0) {
          setTasbeehCycles((prevCycles) => prevCycles + 1);
        }
        return nextRound;
      });

      return 1;
    });
  };

  const resetTasbeeh = () => {
    setTasbeehCount(0);
    setTasbeehRoundIndex(0);
    setTasbeehCycles(0);
  };

  const showAudioPlaceholder = () => {
    Alert.alert('Audio Coming Soon', 'Athkar audio playback support will be added in a future update.');
  };

  const renderAsmaItem = ({ item }: { item: AllahName }) => (
    <View style={[styles.card, isDark && styles.darkCard]}>
      <View style={styles.numberCircle}>
        <Text style={styles.number}>{item.number}</Text>
      </View>

      <View style={styles.content}>
        <Text
          style={[
            styles.arabicName,
            { fontSize: settings.arabicFontSize },
            arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
          ]}
        >
          {item.name}
        </Text>
        <Text style={[styles.transliteration, isDark && styles.darkText]}>
          {item.transliteration}
        </Text>
        <Text style={[styles.meaning, isDark && styles.darkText]}>
          {item.en.meaning}
        </Text>
      </View>
    </View>
  );

  const renderAthkarItem = ({ item }: { item: AthkarItem }) => (
    <View style={[styles.athkarCard, isDark && styles.darkCard]}>
      <View style={styles.athkarHeader}>
        <Text style={styles.athkarTitle}>{item.title}</Text>
        <View style={styles.athkarHeaderRight}>
          <View style={styles.repeatBadge}>
            <Text style={styles.repeatBadgeText}>x{item.repetitions}</Text>
          </View>
          <TouchableOpacity style={styles.audioSoonButton} onPress={showAudioPlaceholder}>
            <Text style={styles.audioSoonButtonText}>Audio</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text
        style={[
          styles.athkarText,
          { fontSize: athkarArabicFontSize, lineHeight: Math.round(athkarArabicFontSize * 1.45) },
          arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
          isDark && styles.darkText,
        ]}
      >
        {item.text}
      </Text>
    </View>
  );

  const renderAthkarSection = () => (
    <>
      <View style={styles.athkarMetaRow}>
        <Text style={styles.athkarMetaText}>
          Source: {athkarSource === 'online' ? 'Online' : 'Fallback'}
        </Text>
        {athkarSourceLabel ? <Text style={styles.athkarMetaText}>{athkarSourceLabel}</Text> : null}
      </View>

      <View style={styles.periodTabs}>
        <TouchableOpacity
          style={[styles.periodTab, athkarPeriod === 'morning' && styles.periodTabActive]}
          onPress={() => setAthkarPeriod('morning')}
        >
          <Text style={[styles.periodTabText, athkarPeriod === 'morning' && styles.periodTabTextActive]}>
            Morning Athkar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodTab, athkarPeriod === 'evening' && styles.periodTabActive]}
          onPress={() => setAthkarPeriod('evening')}
        >
          <Text style={[styles.periodTabText, athkarPeriod === 'evening' && styles.periodTabTextActive]}>
            Evening Athkar
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeAthkarList}
        keyExtractor={(item) => item.id}
        renderItem={renderAthkarItem}
        ListHeaderComponent={
          athkarLoading ? (
            <View style={styles.athkarLoadingBox}>
              <ActivityIndicator size="small" color={UI_COLORS.primary} />
              <Text style={styles.athkarLoadingText}>Loading athkar...</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </>
  );

  const renderTasbeehSection = () => (
    <ScrollView contentContainerStyle={styles.tasbeehScroll} showsVerticalScrollIndicator={false}>
      <View style={[styles.tasbeehCard, isDark && styles.darkCard]}>
        <View style={styles.tasbeehContent}>
          <Text style={styles.tasbeehTitle}>Tasbeeh 33x</Text>

          <View style={styles.counterRow}>
            <View style={styles.counterBlock}>
              <Text style={styles.counterValue}>{tasbeehCount}</Text>
              <Text style={styles.counterLabel}>Count</Text>
            </View>
            <View style={styles.counterBlock}>
              <Text style={styles.counterValue}>{tasbeehRoundIndex + 1}</Text>
              <Text style={styles.counterLabel}>Round</Text>
            </View>
          </View>

          <View style={styles.wordCard}>
            <Text
              style={[
                styles.wordText,
                arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
              ]}
            >
              {TASBEEH_WORDS[tasbeehRoundIndex]}
            </Text>
          </View>

          <Text style={styles.helperText}>
            Tap beads to count to 33, then continue to next dhikr word.
          </Text>
          <Text style={styles.helperText}>
            Full cycles completed: {tasbeehCycles}
          </Text>

          <TouchableOpacity style={styles.resetButton} onPress={resetTasbeeh}>
            <Text style={styles.resetButtonText}>Reset Tasbeeh</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.beadChain}
          onPress={handleTasbeehPress}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {Array.from({ length: TASBEEH_BEAD_COUNT }).map((_, index) => {
            const isActiveBead = index === activeBeadIndex;
            return (
              <View
                key={`bead-${index}`}
                style={[
                  styles.bead,
                  isDark && styles.darkBead,
                  isActiveBead && styles.activeBead,
                ]}
              />
            );
          })}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderAsmaSection = () => (
    <>
      <View style={styles.searchContainer}>
        <View style={[styles.searchWrapper, isDark && styles.darkSearchWrapper]}>
          <TextInput
            style={[styles.searchInput, isDark && styles.darkText]}
            placeholder="Search by name, transliteration or meaning..."
            placeholderTextColor="#aaa"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {searchQuery.length > 0 && (
            <TouchableWithoutFeedback onPress={clearSearch}>
              <View style={styles.clearButton}>
                <Text style={styles.clearIcon}>×</Text>
              </View>
            </TouchableWithoutFeedback>
          )}
        </View>
      </View>

      {namesLoading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={UI_COLORS.primary} />
          <Text style={styles.loadingText}>Loading Asma Al-Husna...</Text>
        </View>
      ) : namesError ? (
        <View style={styles.stateBox}>
          <Text style={styles.errorText}>{namesError}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNames}
          keyExtractor={(item) => item.number.toString()}
          renderItem={renderAsmaItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </>
  );

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <ScreenIntroTile
        title="Athkar Screen"
        description="Morning and evening athkar are primary, with built-in Tasbeeh 33x and the full 99 Names of Allah in one place."
        isDark={isDark}
        style={styles.introTile}
      />

      <View style={styles.featureTabs}>
        <TouchableOpacity
          style={[styles.featureTab, activeFeature === 'athkar' && styles.featureTabActive]}
          onPress={() => setActiveFeature('athkar')}
        >
          <Text style={[styles.featureTabText, activeFeature === 'athkar' && styles.featureTabTextActive]}>
            Athkar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.featureTab, activeFeature === 'tasbeeh' && styles.featureTabActive]}
          onPress={() => setActiveFeature('tasbeeh')}
        >
          <Text style={[styles.featureTabText, activeFeature === 'tasbeeh' && styles.featureTabTextActive]}>
            Tasbeeh
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.featureTab, activeFeature === 'asma' && styles.featureTabActive]}
          onPress={() => setActiveFeature('asma')}
        >
          <Text style={[styles.featureTabText, activeFeature === 'asma' && styles.featureTabTextActive]}>
            Asma Al-Husna
          </Text>
        </TouchableOpacity>
      </View>

      {activeFeature === 'athkar' && renderAthkarSection()}
      {activeFeature === 'tasbeeh' && renderTasbeehSection()}
      {activeFeature === 'asma' && renderAsmaSection()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_COLORS.background,
  },
  darkContainer: {
    backgroundColor: UI_COLORS.darkBackground,
  },
  introTile: {
    marginBottom: 8,
  },
  featureTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: UI_RADII.lg,
    backgroundColor: '#e9f4ed',
    borderWidth: 1,
    borderColor: '#cde9d5',
    overflow: 'hidden',
  },
  featureTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  featureTabActive: {
    backgroundColor: UI_COLORS.primary,
  },
  featureTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: UI_COLORS.primaryDeep,
  },
  featureTabTextActive: {
    color: UI_COLORS.white,
  },
  periodTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: UI_RADII.lg,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    overflow: 'hidden',
  },
  athkarMetaRow: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    borderRadius: UI_RADII.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  athkarMetaText: {
    fontSize: 11,
    color: UI_COLORS.textMuted,
  },
  athkarLoadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  athkarLoadingText: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  periodTabActive: {
    backgroundColor: UI_COLORS.primarySoft,
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: UI_COLORS.textMuted,
  },
  periodTabTextActive: {
    color: UI_COLORS.primaryDeep,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  athkarCard: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: '#9ec46f',
    padding: 14,
    marginBottom: 10,
    ...UI_SHADOWS.card,
  },
  athkarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  athkarHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  athkarTitle: {
    fontSize: 14,
    color: UI_COLORS.primaryDeep,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  repeatBadge: {
    backgroundColor: '#edf7f1',
    borderWidth: 1,
    borderColor: '#cde9d5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  repeatBadgeText: {
    fontSize: 12,
    color: UI_COLORS.primaryDeep,
    fontWeight: '700',
  },
  audioSoonButton: {
    borderWidth: 1,
    borderColor: '#cde9d5',
    backgroundColor: '#f7fbf9',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  audioSoonButtonText: {
    fontSize: 11,
    color: UI_COLORS.textMuted,
    fontWeight: '600',
  },
  athkarText: {
    color: UI_COLORS.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tasbeehScroll: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  tasbeehCard: {
    marginBottom: 12,
    padding: 14,
    borderRadius: UI_RADII.lg,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    flexDirection: 'row',
    ...UI_SHADOWS.card,
  },
  tasbeehContent: {
    flex: 1,
  },
  tasbeehTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: UI_COLORS.primaryDeep,
    marginBottom: 8,
  },
  counterRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 10,
  },
  counterBlock: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#eef7f1',
    borderWidth: 1,
    borderColor: '#cde9d5',
    borderRadius: UI_RADII.md,
    paddingVertical: 6,
  },
  counterValue: {
    fontSize: 26,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  counterLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
  },
  wordCard: {
    backgroundColor: '#edf7f5',
    borderWidth: 1,
    borderColor: '#d3ece6',
    borderRadius: UI_RADII.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  wordText: {
    fontSize: 30,
    color: UI_COLORS.text,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 42,
  },
  helperText: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  resetButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: UI_RADII.md,
    backgroundColor: UI_COLORS.primary,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: UI_COLORS.white,
  },
  beadChain: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 12,
    paddingVertical: 4,
  },
  bead: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: '#9fe2c2',
    borderWidth: 1,
    borderColor: '#76cfaa',
  },
  darkBead: {
    backgroundColor: '#35614d',
    borderColor: '#447862',
  },
  activeBead: {
    backgroundColor: UI_COLORS.primary,
    borderColor: UI_COLORS.primary,
    transform: [{ scale: 1.08 }],
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  darkSearchWrapper: {
    backgroundColor: '#1e1e1e',
    borderColor: '#30353b',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...UI_SHADOWS.input,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: UI_COLORS.text,
  },
  clearButton: {
    paddingHorizontal: 16,
  },
  clearIcon: {
    fontSize: 20,
    color: UI_COLORS.textMuted,
  },
  stateBox: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.lg,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...UI_SHADOWS.card,
  },
  darkCard: {
    backgroundColor: '#1e1e1e',
    borderColor: '#30353b',
  },
  numberCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: UI_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  number: {
    color: UI_COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  arabicName: {
    fontSize: 28,
    color: UI_COLORS.text,
    textAlign: 'right',
    marginBottom: 6,
  },
  transliteration: {
    fontSize: 16,
    color: UI_COLORS.accent,
    fontWeight: '600',
    marginBottom: 4,
  },
  meaning: {
    fontSize: 15,
    color: UI_COLORS.text,
    lineHeight: 22,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: UI_COLORS.text,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: UI_COLORS.danger,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  darkText: {
    color: UI_COLORS.white,
  },
});
