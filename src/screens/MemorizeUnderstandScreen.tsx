import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchSurahs } from '../services/quranApi';
import { Surah } from '../types';
import { useSettings } from '../context/SettingsContext';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import ScreenIntroTile from '../components/ScreenIntroTile';

type QuranSearchEntry = {
  surahId: number;
  surahNameEnglish: string;
  surahNameArabic: string;
  ayahNumber: number;
  ayahText: string;
  ayahTextNormalized: string;
};

type SearchResultItem =
  | { type: 'surah'; key: string; surah: Surah }
  | {
      type: 'ayah';
      key: string;
      surahId: number;
      surahNameEnglish: string;
      surahNameArabic: string;
      ayahNumber: number;
      ayahText: string;
    };

const stripArabicDiacritics = (value: string): string =>
  value
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/\u0640/g, '');

const normalizeForSearch = (value: string): string =>
  stripArabicDiacritics(value)
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();

const renderHighlightedText = (
  text: string,
  query: string,
  baseStyle: any,
  highlightStyle: any
) => {
  const cleanQuery = query.trim();
  if (!cleanQuery) return <Text style={baseStyle}>{text}</Text>;

  const lowerText = text.toLowerCase();
  const lowerQuery = cleanQuery.toLowerCase();
  const start = lowerText.indexOf(lowerQuery);

  if (start === -1) return <Text style={baseStyle}>{text}</Text>;

  const end = start + cleanQuery.length;
  const before = text.slice(0, start);
  const match = text.slice(start, end);
  const after = text.slice(end);

  return (
    <Text style={baseStyle}>
      {before}
      <Text style={highlightStyle}>{match}</Text>
      {after}
    </Text>
  );
};

export default function MemorizeUnderstandScreen({ navigation }: any) {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [quranIndex, setQuranIndex] = useState<QuranSearchEntry[] | null>(null);
  const [isIndexLoading, setIsIndexLoading] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const isIndexRequestInFlightRef = useRef(false);

  const { settings } = useSettings();
  const isDark = settings.isDarkMode;
  const arabicNameFontSize = Math.max(20, settings.arabicFontSize - 10);

  useEffect(() => {
    fetchSurahs().then((data) => {
      setSurahs(data);
    });
  }, []);

  const surahLookupById = useMemo(
    () => new Map(surahs.map((surah) => [Number(surah.id), surah])),
    [surahs]
  );

  const ensureQuranIndex = useCallback(async () => {
    if (quranIndex || isIndexRequestInFlightRef.current || surahs.length === 0) return;

    isIndexRequestInFlightRef.current = true;
    setIsIndexLoading(true);
    setIndexError(null);

    try {
      const response = await fetch('https://api.alquran.cloud/v1/quran/quran-uthmani');
      const payload = (await response.json()) as any;
      const apiSurahs = payload?.data?.surahs;

      if (!response.ok || !Array.isArray(apiSurahs)) {
        throw new Error('Invalid Quran search response');
      }

      const entries: QuranSearchEntry[] = [];

      for (const apiSurah of apiSurahs) {
        const surahId = Number(apiSurah.number);
        const surahMeta = surahLookupById.get(surahId);
        const surahNameEnglish =
          surahMeta?.name_simple || apiSurah.englishName || `Surah ${surahId}`;
        const surahNameArabic = surahMeta?.name_arabic || apiSurah.name || '';
        const ayahs = Array.isArray(apiSurah.ayahs) ? apiSurah.ayahs : [];

        for (const ayah of ayahs) {
          const ayahNumber = Number(ayah.numberInSurah);
          const ayahText = typeof ayah.text === 'string' ? ayah.text : '';
          const ayahTextNormalized = normalizeForSearch(ayahText);

          if (!ayahText || !ayahTextNormalized || !Number.isFinite(ayahNumber)) continue;

          entries.push({
            surahId,
            surahNameEnglish,
            surahNameArabic,
            ayahNumber,
            ayahText: stripArabicDiacritics(ayahText),
            ayahTextNormalized,
          });
        }
      }

      setQuranIndex(entries);
      setIndexError(null);
    } catch (error) {
      console.error('Global Quran search index load failed:', error);
      setIndexError('Could not load full Quran search right now. Please try again.');
    } finally {
      isIndexRequestInFlightRef.current = false;
      setIsIndexLoading(false);
    }
  }, [quranIndex, surahs.length, surahLookupById]);

  const trimmedSearch = searchQuery.trim();
  const normalizedQuery = useMemo(() => normalizeForSearch(trimmedSearch), [trimmedSearch]);

  useEffect(() => {
    if (trimmedSearch.length < 2) return;
    if (!quranIndex && surahs.length > 0) {
      void ensureQuranIndex();
    }
  }, [trimmedSearch.length, quranIndex, surahs.length, ensureQuranIndex]);

  const surahNameMatches = useMemo(() => {
    if (!trimmedSearch) return surahs;
    return surahs.filter((surah) => {
      return (
        normalizeForSearch(surah.name_simple).includes(normalizedQuery) ||
        normalizeForSearch(surah.name_arabic).includes(normalizedQuery)
      );
    });
  }, [surahs, trimmedSearch, normalizedQuery]);

  const ayahMatches = useMemo(() => {
    if (!trimmedSearch || normalizedQuery.length < 2 || !quranIndex) {
      return { items: [] as QuranSearchEntry[], totalCount: 0 };
    }

    const matches: QuranSearchEntry[] = [];
    let totalCount = 0;
    for (const entry of quranIndex) {
      if (entry.ayahTextNormalized.includes(normalizedQuery)) {
        totalCount += 1;
        if (matches.length < 60) {
          matches.push(entry);
        }
      }
    }
    return { items: matches, totalCount };
  }, [trimmedSearch, normalizedQuery, quranIndex]);

  const ayahMatchCount = ayahMatches.totalCount;

  const searchResults = useMemo<SearchResultItem[]>(() => {
    if (!trimmedSearch) return [];

    const surahResults: SearchResultItem[] = surahNameMatches.slice(0, 20).map((surah) => ({
      type: 'surah',
      key: `surah-${surah.id}`,
      surah,
    }));

    const ayahResults: SearchResultItem[] = ayahMatches.items.map((entry, index) => ({
      type: 'ayah',
      key: `ayah-${entry.surahId}-${entry.ayahNumber}-${index}`,
      surahId: entry.surahId,
      surahNameEnglish: entry.surahNameEnglish,
      surahNameArabic: entry.surahNameArabic,
      ayahNumber: entry.ayahNumber,
      ayahText: entry.ayahText,
    }));

    return [...surahResults, ...ayahResults];
  }, [trimmedSearch, surahNameMatches, ayahMatches.items]);

  const clearSearch = () => {
    setSearchQuery('');
  };

  const navigateToSurah = useCallback(
    (surah: Surah, initialAyah?: number) => {
      const params: any = { surah, surahs };
      if (initialAyah) {
        params.initialAyah = initialAyah;
        params.scrollNonce = Date.now();
      }
      navigation.navigate('Surah', params);
    },
    [navigation, surahs]
  );

  const renderBrowseSurah = ({ item }: { item: Surah }) => (
    <TouchableOpacity
      style={[styles.surahCard, isDark && styles.darkCard]}
      onPress={() => navigateToSurah(item)}
    >
      <View style={styles.surahInfo}>
        <Text style={styles.surahNumber}>{item.id}</Text>
        <View>
          <Text style={[styles.surahNameEnglish, isDark && styles.darkText]}>{item.name_simple}</Text>
          <Text style={[styles.surahNameArabic, { fontSize: arabicNameFontSize }, isDark && styles.darkText]}>
            {item.name_arabic}
          </Text>
        </View>
      </View>
      <Text style={[styles.versesCount, isDark && styles.darkMutedText]}>{item.verses_count} verses</Text>
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }: { item: SearchResultItem }) => {
    if (item.type === 'surah') {
      return (
        <TouchableOpacity
          style={[styles.searchResultCard, isDark && styles.darkCard]}
          onPress={() => navigateToSurah(item.surah)}
        >
          <View style={styles.resultBadgeRow}>
            <Text style={styles.resultBadge}>Surah Match</Text>
          </View>
          {renderHighlightedText(
            item.surah.name_simple,
            trimmedSearch,
            [styles.searchResultTitle, isDark && styles.darkText],
            styles.highlightText
          )}
          {renderHighlightedText(
            item.surah.name_arabic,
            trimmedSearch,
            [styles.searchResultArabic, isDark && styles.darkText],
            styles.highlightText
          )}
        </TouchableOpacity>
      );
    }

    const targetSurah = surahLookupById.get(item.surahId);
    const handlePress = () => {
      if (!targetSurah) {
        Alert.alert('Error', 'Could not load the selected surah.');
        return;
      }
      navigateToSurah(targetSurah, item.ayahNumber);
    };

    return (
      <TouchableOpacity
        style={[styles.searchResultCard, isDark && styles.darkCard]}
        onPress={handlePress}
      >
        <View style={styles.resultBadgeRow}>
          <Text style={styles.resultBadge}>Ayah Match</Text>
          <Text style={styles.searchResultMeta}>Ayah {item.ayahNumber}</Text>
        </View>
        {renderHighlightedText(
          item.surahNameEnglish,
          trimmedSearch,
          [styles.searchResultTitle, isDark && styles.darkText],
          styles.highlightText
        )}
        <Text style={[styles.searchResultSubMeta, isDark && styles.darkMutedText]}>
          {item.surahNameArabic}
        </Text>
        {renderHighlightedText(
          item.ayahText,
          stripArabicDiacritics(trimmedSearch),
          [styles.searchResultAyahText, isDark && styles.darkText],
          styles.highlightText
        )}
      </TouchableOpacity>
    );
  };

  const isSearchMode = trimmedSearch.length > 0;
  const shouldShowGlobalLoading =
    isSearchMode && normalizedQuery.length >= 2 && !quranIndex && isIndexLoading;

  return (
    <SafeAreaView style={[styles.safeArea, isDark && styles.darkBg]} edges={['left', 'right', 'bottom']}>
      <View style={[styles.container, isDark && styles.darkBg]}>
        <ScreenIntroTile
          title="Memorize & Understand"
          subtitle="Explore the Quran to memorize and reflect"
          description="A dedicated space to memorize, reflect, and understand the Quran ayah by ayah, with deep search across all surahs and smart bookmark folders so you can save ayahs under Memorize or Read/Recite."
          isDark={isDark}
          style={styles.introTile}
        />

        <View style={styles.searchContainer}>
          <View style={[styles.searchWrapper, isDark && styles.darkCard]}>
            <TextInput
              style={[styles.searchInput, isDark && styles.darkText]}
              placeholder="Search Surah or Quran words..."
              placeholderTextColor="#aaa"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
            />

            {searchQuery.length > 0 && (
              <TouchableWithoutFeedback onPress={clearSearch}>
                <View style={styles.clearButton}>
                  <Text style={[styles.clearIcon, isDark && styles.darkMutedText]}>×</Text>
                </View>
              </TouchableWithoutFeedback>
            )}
          </View>
        </View>

        {isSearchMode && (
          <View style={styles.searchMetaRow}>
            <Text style={[styles.searchMetaText, isDark && styles.darkMutedText]}>
              Surah matches {surahNameMatches.length}
            </Text>
            <Text style={[styles.searchMetaText, isDark && styles.darkMutedText]}>
              Ayah matches {ayahMatchCount}
            </Text>
            <TouchableOpacity style={styles.searchDoneButton} onPress={Keyboard.dismiss}>
              <Text style={styles.searchDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {shouldShowGlobalLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={UI_COLORS.primary} />
            <Text style={[styles.loadingRowText, isDark && styles.darkMutedText]}>
              Searching the full Quran...
            </Text>
          </View>
        )}

        {isSearchMode && indexError && <Text style={styles.errorText}>{indexError}</Text>}

        {isSearchMode ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.key}
            renderItem={renderSearchResult}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={[styles.emptyText, isDark && styles.darkMutedText]}>
                No matches found. Try another word or surah name.
              </Text>
            }
          />
        ) : (
          <FlatList
            data={surahs}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderBrowseSurah}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: UI_COLORS.background },
  container: { flex: 1, backgroundColor: UI_COLORS.background },
  darkBg: { backgroundColor: UI_COLORS.darkBackground },
  introTile: { marginBottom: 12 },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: UI_COLORS.background,
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
    paddingVertical: 14,
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 8,
    gap: 8,
  },
  loadingRowText: {
    fontSize: 13,
    color: UI_COLORS.textMuted,
  },
  searchMetaRow: {
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchMetaText: {
    fontSize: 13,
    color: UI_COLORS.textMuted,
    fontWeight: '600',
  },
  searchDoneButton: {
    marginLeft: 'auto',
    backgroundColor: UI_COLORS.primary,
    borderRadius: UI_RADII.xl,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchDoneButtonText: {
    color: UI_COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    color: UI_COLORS.danger,
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 13,
    paddingHorizontal: 16,
  },
  list: { paddingHorizontal: 16, paddingBottom: 22 },
  surahCard: {
    backgroundColor: UI_COLORS.surface,
    padding: 20,
    marginVertical: 8,
    borderRadius: UI_RADII.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    borderLeftWidth: 5,
    borderLeftColor: UI_COLORS.primary,
    ...UI_SHADOWS.card,
  },
  searchResultCard: {
    backgroundColor: UI_COLORS.surface,
    padding: 16,
    marginVertical: 6,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...UI_SHADOWS.card,
  },
  darkCard: { backgroundColor: UI_COLORS.darkSurface, borderColor: '#30353b' },
  surahInfo: { flexDirection: 'row', alignItems: 'center' },
  surahNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: UI_COLORS.accent,
    marginRight: 20,
    width: 50,
    textAlign: 'center',
  },
  surahNameEnglish: { fontSize: 16, color: UI_COLORS.text, fontWeight: '600' },
  surahNameArabic: { fontFamily: 'AmiriQuran', fontSize: 24, color: UI_COLORS.text, marginTop: 4 },
  versesCount: { fontSize: 14, color: UI_COLORS.textMuted },
  resultBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultBadge: {
    fontSize: 11,
    color: UI_COLORS.white,
    backgroundColor: UI_COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
    fontWeight: '700',
  },
  searchResultMeta: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
    fontWeight: '600',
  },
  searchResultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  searchResultArabic: {
    fontSize: 24,
    marginTop: 4,
    color: UI_COLORS.text,
    fontFamily: 'AmiriQuran',
  },
  searchResultSubMeta: {
    fontSize: 15,
    marginTop: 2,
    color: UI_COLORS.textMuted,
    fontFamily: 'AmiriQuran',
  },
  searchResultAyahText: {
    fontSize: 15,
    lineHeight: 24,
    marginTop: 8,
    color: UI_COLORS.text,
    textAlign: 'right',
    fontFamily: 'AmiriQuran',
  },
  highlightText: {
    backgroundColor: '#ffe58f',
    color: UI_COLORS.primaryDeep,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 15,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
  darkText: { color: UI_COLORS.white },
  darkMutedText: { color: '#a8b3bd' },
});
