import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { searchVerses, type SearchResult } from '../services/aiService';
import { Surah } from '../types';
import { useSettings } from '../context/SettingsContext';
import { useThemedAlert } from '../context/ThemedAlertContext';
import { resolveArabicFontFamily } from '../theme/fonts';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import ScreenIntroTile from '../components/ScreenIntroTile';
import debounce from 'lodash.debounce';

export default function MemorizeUnderstandScreen({ navigation }: any) {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiResults, setAiResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { settings } = useSettings();
  const { showAlert } = useThemedAlert();
  const isDark = settings.isDarkMode;
  const arabicNameFontSize = Math.max(20, settings.arabicFontSize - 10);
  const arabicFontFamily = resolveArabicFontFamily(settings.arabicFontFamily);

  useEffect(() => {
    fetchSurahs().then((data) => {
      setSurahs(data);
    });
  }, []);

  const surahLookupById = useMemo(
    () => new Map(surahs.map((surah) => [Number(surah.id), surah])),
    [surahs]
  );

  const performSearch = useMemo(
    () =>
      debounce(async (query: string) => {
        if (query.trim().length < 2) {
          setAiResults([]);
          setIsSearching(false);
          return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setIsSearching(true);
        setSearchError(null);

        try {
          const results = await searchVerses(query.trim(), controller.signal);
          if (!controller.signal.aborted) {
            setAiResults(results);
            setIsSearching(false);
          }
        } catch (error: unknown) {
          if ((error as Error).name === 'AbortError') return;
          if (!controller.signal.aborted) {
            setSearchError('Search failed. Please try again.');
            setAiResults([]);
            setIsSearching(false);
          }
        }
      }, 800),
    []
  );

  useEffect(() => {
    performSearch(searchQuery);
    return () => {
      performSearch.cancel();
    };
  }, [searchQuery, performSearch]);

  const clearSearch = () => {
    performSearch.cancel();
    abortRef.current?.abort();
    setSearchQuery('');
    setAiResults([]);
    setSearchError(null);
    setIsSearching(false);
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
          <Text
            style={[
              styles.surahNameArabic,
              { fontSize: arabicNameFontSize },
              arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
              isDark && styles.darkText,
            ]}
          >
            {item.name_arabic}
          </Text>
        </View>
      </View>
      <Text style={[styles.versesCount, isDark && styles.darkMutedText]}>{item.verses_count} verses</Text>
    </TouchableOpacity>
  );

  const renderAiResult = ({ item }: { item: SearchResult }) => {
    const targetSurah = surahLookupById.get(item.surahId);
    const handlePress = () => {
      if (!targetSurah) {
        showAlert({
          title: 'Error',
          message: 'Could not load the selected surah.',
          variant: 'danger',
        });
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
          <Text style={styles.resultBadge}>AI Match</Text>
          <Text style={styles.searchResultMeta}>{item.verseKey}</Text>
        </View>
        <Text style={[styles.searchResultTitle, isDark && styles.darkText]}>
          {item.surahName}
        </Text>
        <Text style={[styles.translationText, isDark && styles.darkMutedText]} numberOfLines={3}>
          {item.translation}
        </Text>
        <View style={styles.relevanceWrap}>
          <Text style={styles.relevanceLabel}>✦ </Text>
          <Text style={[styles.relevanceText, isDark && styles.darkMutedText]}>
            {item.relevance}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const isSearchMode = searchQuery.trim().length > 0;

  return (
    <SafeAreaView style={[styles.safeArea, isDark && styles.darkBg]} edges={['left', 'right', 'bottom']}>
      <View style={[styles.container, isDark && styles.darkBg]}>
        <ScreenIntroTile
          title="Memorize & Understand"
          subtitle="Explore the Quran to memorize and reflect"
          description="Search by concept — try 'patience', 'gratitude', 'story of Moses', or any topic. AI finds the most relevant verses for you."
          isDark={isDark}
          style={styles.introTile}
        />

        <View style={styles.searchContainer}>
          <View style={[styles.searchWrapper, isDark && styles.darkCard]}>
            <TextInput
              style={[styles.searchInput, isDark && styles.darkText]}
              placeholder="Search by concept (e.g. patience, gratitude)..."
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
              {isSearching ? 'Searching...' : `${aiResults.length} verses found`}
            </Text>
            <TouchableOpacity style={styles.searchDoneButton} onPress={Keyboard.dismiss}>
              <Text style={styles.searchDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {isSearching && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={UI_COLORS.primary} />
            <Text style={[styles.loadingRowText, isDark && styles.darkMutedText]}>
              AI is finding relevant verses...
            </Text>
          </View>
        )}

        {isSearchMode && searchError && <Text style={styles.errorText}>{searchError}</Text>}

        {isSearchMode ? (
          <FlatList
            data={aiResults}
            keyExtractor={(item) => item.verseKey}
            renderItem={renderAiResult}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              !isSearching ? (
                <Text style={[styles.emptyText, isDark && styles.darkMutedText]}>
                  {searchQuery.trim().length < 2
                    ? 'Type at least 2 characters to search...'
                    : 'No verses found. Try a different concept.'}
                </Text>
              ) : null
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
    justifyContent: 'space-between',
  },
  searchMetaText: {
    fontSize: 13,
    color: UI_COLORS.textMuted,
    fontWeight: '600',
  },
  searchDoneButton: {
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
  surahNameArabic: { fontSize: 24, color: UI_COLORS.text, marginTop: 4 },
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
  translationText: {
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textMuted,
    marginTop: 4,
  },
  relevanceWrap: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: UI_COLORS.border,
  },
  relevanceLabel: {
    fontSize: 13,
    color: UI_COLORS.accent,
  },
  relevanceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: UI_COLORS.textMuted,
    fontStyle: 'italic',
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
