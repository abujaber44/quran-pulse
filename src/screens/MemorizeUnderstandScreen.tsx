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
import axios from 'axios';
import { fetchSurahs } from '../services/quranApi';
import { searchVerses, type SearchResult } from '../services/aiService';
import { getSearchHistory, addSearchHistory, clearSearchHistory, type SearchHistoryItem } from '../services/searchHistoryService';
import { Surah } from '../types';
import { useSettings } from '../context/SettingsContext';
import { useThemedAlert } from '../context/ThemedAlertContext';
import { resolveArabicFontFamily } from '../theme/fonts';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import { UI_GLASS } from '../theme/ui';
import GlassBackground from '../components/GlassBackground';
import ScreenIntroTile from '../components/ScreenIntroTile';
import debounce from 'lodash.debounce';
import { useLanguage } from '../i18n';

export default function MemorizeUnderstandScreen({ navigation }: any) {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiResults, setAiResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [browseMode, setBrowseMode] = useState<'surah' | 'juz'>('surah');
  const [juzData, setJuzData] = useState<any[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const { settings } = useSettings();
  const { showAlert } = useThemedAlert();
  const { t, lang } = useLanguage();
  const isDark = settings.isDarkMode;
  const arabicNameFontSize = Math.max(20, settings.arabicFontSize - 10);
  const arabicFontFamily = resolveArabicFontFamily(settings.arabicFontFamily);

  useEffect(() => {
    fetchSurahs().then((data) => {
      setSurahs(data);
    });
    getSearchHistory().then(setSearchHistory);
    axios.get('https://api.quran.com/api/v4/juzs').then(({ data }) => {
      const seen = new Set<number>();
      const unique = (data.juzs as any[]).filter((j) => {
        if (seen.has(j.juz_number)) return false;
        seen.add(j.juz_number);
        return true;
      });
      setJuzData(unique);
    }).catch(() => {});
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
          const results = await searchVerses(query.trim(), controller.signal, lang);
          if (!controller.signal.aborted) {
            setAiResults(results);
            setIsSearching(false);
            if (results.length > 0) {
              void addSearchHistory(query.trim(), results.length);
              getSearchHistory().then(setSearchHistory);
            }
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
      <Text style={[styles.versesCount, isDark && styles.darkMutedText]}>{item.verses_count} {t.verses}</Text>
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
          <Text style={styles.resultBadge}>{t.aiMatch}</Text>
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
    <GlassBackground isDark={isDark}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.container}>
        <ScreenIntroTile
          title={t.memorizeTitle}
          subtitle={t.memorizeSubtitle}
          description={t.memorizeDescription}
          isDark={isDark}
          style={styles.introTile}
        />

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, browseMode === 'surah' && styles.tabButtonActive, isDark && browseMode !== 'surah' && styles.darkCard]}
            onPress={() => setBrowseMode('surah')}
          >
            <Text style={[styles.tabButtonText, browseMode === 'surah' && styles.tabButtonTextActive, isDark && browseMode !== 'surah' && styles.darkMutedText]}>
              {t.browseBySurah}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, browseMode === 'juz' && styles.tabButtonActive, isDark && browseMode !== 'juz' && styles.darkCard]}
            onPress={() => setBrowseMode('juz')}
          >
            <Text style={[styles.tabButtonText, browseMode === 'juz' && styles.tabButtonTextActive, isDark && browseMode !== 'juz' && styles.darkMutedText]}>
              {t.browseByJuz}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={[styles.searchWrapper, isDark && styles.darkCard]}>
            <TextInput
              style={[styles.searchInput, isDark && styles.darkText]}
              placeholder={t.searchPlaceholder}
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

        {isSearchMode && !isSearching && aiResults.length > 0 && (
          <View style={styles.searchMetaRow}>
            <Text style={[styles.searchMetaText, isDark && styles.darkMutedText]}>
              {aiResults.length} {t.versesFound}
            </Text>
          </View>
        )}

        {isSearching && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={UI_COLORS.primary} />
            <Text style={[styles.loadingRowText, isDark && styles.darkMutedText]}>
              {t.aiSearching}
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
                    ? t.minCharsSearch
                    : t.noVersesFound}
                </Text>
              ) : null
            }
          />
        ) : browseMode === 'juz' ? (
          <FlatList
            data={juzData}
            keyExtractor={(item) => `juz-${item.id ?? item.juz_number}`}
            renderItem={({ item: juz }) => {
              const surahIds = Object.keys(juz.verse_mapping).map(Number);
              const firstSurahId = surahIds[0];
              const lastSurahId = surahIds[surahIds.length - 1];
              const firstSurah = surahLookupById.get(firstSurahId);
              const lastSurah = surahLookupById.get(lastSurahId);
              const firstAyahStr = juz.verse_mapping[String(firstSurahId)];
              const firstAyah = firstAyahStr ? Number(firstAyahStr.split('-')[0]) : 1;
              const lastAyahStr = juz.verse_mapping[String(lastSurahId)];
              const lastAyah = lastAyahStr ? Number(lastAyahStr.split('-')[1]) : undefined;
              const rangeText = firstSurah && lastSurah
                ? `${firstSurah.name_simple} ${firstAyah} — ${lastSurah.name_simple} ${lastAyah ?? ''}`
                : '';
              return (
                <TouchableOpacity
                  style={[styles.juzCard, isDark && styles.darkCard]}
                  onPress={() => firstSurah && navigateToSurah(firstSurah, firstAyah)}
                >
                  <View style={styles.juzHeader}>
                    <Text style={[styles.juzNumber, isDark && styles.darkText]}>{t.juz} {juz.juz_number}</Text>
                    <Text style={[styles.versesCount, isDark && styles.darkMutedText]}>{juz.verses_count} {t.verses}</Text>
                  </View>
                  <Text style={[styles.juzRange, isDark && styles.darkMutedText]}>{rangeText}</Text>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            data={surahs}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderBrowseSurah}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              searchHistory.length > 0 ? (
                <View style={styles.historySection}>
                  <View style={styles.historyHeader}>
                    <Text style={[styles.historyTitle, isDark && styles.darkText]}>{t.recentSearches}</Text>
                    <TouchableOpacity onPress={() => clearSearchHistory().then(() => setSearchHistory([]))}>
                      <Text style={styles.historyClear}>{t.clearHistory}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.historyChips}>
                    {searchHistory.map((item, idx) => (
                      <TouchableOpacity
                        key={`${item.query}-${idx}`}
                        style={[styles.historyChip, isDark && styles.darkCard]}
                        onPress={() => setSearchQuery(item.query)}
                      >
                        <Text style={[styles.historyChipText, isDark && styles.darkText]}>{item.query}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null
            }
          />
        )}
      </View>
      </SafeAreaView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  introTile: { marginBottom: 12 },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    padding: 20,
    marginVertical: 8,
    borderRadius: UI_RADII.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    borderLeftWidth: 5,
    borderLeftColor: UI_COLORS.primary,
    ...UI_SHADOWS.card,
  },
  searchResultCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    padding: 16,
    marginVertical: 6,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    ...UI_SHADOWS.card,
  },
  darkCard: { backgroundColor: 'rgba(26, 38, 52, 0.75)', borderColor: 'rgba(255, 255, 255, 0.08)' },
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
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: UI_RADII.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: UI_RADII.md,
  },
  tabButtonActive: {
    backgroundColor: UI_COLORS.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
  },
  tabButtonTextActive: {
    color: UI_COLORS.white,
  },
  historySection: {
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  historyClear: {
    fontSize: 13,
    color: UI_COLORS.primary,
    fontWeight: '600',
  },
  historyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: UI_RADII.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  historyChipText: {
    fontSize: 13,
    color: UI_COLORS.text,
  },
  juzCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    padding: 20,
    marginVertical: 8,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    borderLeftWidth: 5,
    borderLeftColor: UI_COLORS.accent,
    ...UI_SHADOWS.card,
  },
  juzHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  juzNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  juzRange: {
    fontSize: 13,
    color: UI_COLORS.textMuted,
    marginTop: 6,
  },
  darkText: { color: UI_COLORS.white },
  darkMutedText: { color: '#a8b3bd' },
});
