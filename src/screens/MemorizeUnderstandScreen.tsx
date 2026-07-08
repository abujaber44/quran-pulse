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
import { getPageBookmark, getLastViewedPage, type PageBookmark } from './MushafReaderScreen';
import { Ionicons } from '@expo/vector-icons';
import { getSearchHistory, addSearchHistory, clearSearchHistory, type SearchHistoryItem } from '../services/searchHistoryService';
import { getBookmarks, type Bookmark } from '../services/bookmarkService';
import { getReviewSchedule, getDueVerseKeys } from '../services/memorizationService';
import MemorizationQuizModal from '../components/MemorizationQuizModal';
import RevealPracticeModal from '../components/RevealPracticeModal';
import type { BookmarkForQuiz } from '../services/aiService';
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
import { normalizeArabicForSearch } from '../utils/arabicSearch';

export default function MemorizeUnderstandScreen({ navigation }: any) {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiResults, setAiResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [browseMode, setBrowseMode] = useState<'surah' | 'juz'>('surah');
  const [juzData, setJuzData] = useState<any[]>([]);
  const [savedBookmark, setSavedBookmark] = useState<PageBookmark | null>(null);
  const [dueReviewCount, setDueReviewCount] = useState(0);
  const [memorizeBookmarks, setMemorizeBookmarks] = useState<Bookmark[]>([]);
  const [quizVisible, setQuizVisible] = useState(false);
  const [practiceVisible, setPracticeVisible] = useState(false);
  const [lastViewedPage, setLastViewedPage] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { settings } = useSettings();
  const { showAlert } = useThemedAlert();
  const { t, lang } = useLanguage();
  const isDark = settings.isDarkMode;
  const arabicNameFontSize = Math.max(20, settings.arabicFontSize - 10);
  const arabicFontFamily = resolveArabicFontFamily(settings.arabicFontFamily);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      getPageBookmark().then(setSavedBookmark);
      getLastViewedPage().then(setLastViewedPage);
      Promise.all([getBookmarks(), getReviewSchedule()])
        .then(([bookmarks, schedule]) => {
          const memorizeList = bookmarks.filter((b) => b.tag === 'memorize');
          setMemorizeBookmarks(memorizeList);
          setDueReviewCount(
            getDueVerseKeys(memorizeList.map((b) => `${b.surahId}:${b.ayahNum}`), schedule).length
          );
        })
        .catch(() => {});
    });
    return unsub;
  }, [navigation]);

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
          return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const rawResults = await searchVerses(query.trim(), controller.signal, lang);
          // Drop any result whose ayah number falls outside the surah's real
          // verse count — the AI recalls verses from training knowledge
          // rather than an indexed text search, so an occasional
          // out-of-range/hallucinated reference is possible. This is a plain
          // in-memory lookup against the already-loaded surah list, so it
          // adds no network or storage cost.
          const results = rawResults.filter((r) => {
            const surah = surahLookupById.get(r.surahId);
            return !!surah && r.ayahNumber >= 1 && r.ayahNumber <= surah.verses_count;
          });
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
    [lang, surahLookupById]
  );

  // Set the pending/empty state synchronously the moment the query changes,
  // so the "no verses found" empty-state can never flash during the 800ms
  // debounce wait — before the request (cached or fresh) has even started.
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setIsSearching(false);
      setAiResults([]);
      setSearchError(null);
    } else {
      setIsSearching(true);
      setSearchError(null);
    }
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
      style={styles.surahCard}
      onPress={() => navigateToSurah(item)}
    >
      <View style={styles.surahInfo}>
        <Text style={styles.surahNumber}>{item.id}</Text>
        <View>
          <Text style={styles.surahNameEnglish}>{item.name_simple}</Text>
          <Text
            style={[
              styles.surahNameArabic,
              { fontSize: arabicNameFontSize },
              arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
            ]}
          >
            {item.name_arabic}
          </Text>
        </View>
      </View>
      <Text style={styles.versesCount}>{item.verses_count} {t.verses}</Text>
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
        style={styles.searchResultCard}
        onPress={handlePress}
      >
        <View style={styles.resultBadgeRow}>
          <Text style={styles.resultBadge}>{t.aiMatch}</Text>
          <Text style={styles.searchResultMeta}>{item.verseKey}</Text>
        </View>
        <Text style={styles.searchResultTitle}>
          {item.surahName}
        </Text>
        <Text style={styles.translationText} numberOfLines={3}>
          {item.translation}
        </Text>
        <View style={styles.relevanceWrap}>
          <Text style={styles.relevanceLabel}>✦ </Text>
          <Text style={styles.relevanceText}>
            {item.relevance}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const isSearchMode = searchQuery.trim().length > 0;

  // Instant, offline surah-name matches (English, Arabic, or surah number)
  // shown above the AI results — surah navigation shouldn't need the network.
  const surahNameMatches = useMemo(() => {
    const query = searchQuery.trim();
    if (query.length === 0) return [];

    if (/^\d{1,3}$/.test(query)) {
      const byNumber = surahLookupById.get(Number(query));
      return byNumber ? [byNumber] : [];
    }

    if (query.length < 2) return [];
    const queryLower = query.toLowerCase();
    const queryArabic = normalizeArabicForSearch(query);

    return surahs
      .filter((surah) => {
        if (surah.name_simple.toLowerCase().includes(queryLower)) return true;
        if (surah.translated_name?.name?.toLowerCase().includes(queryLower)) return true;
        if (queryArabic && normalizeArabicForSearch(surah.name_arabic).includes(queryArabic)) return true;
        return false;
      })
      .slice(0, 5);
  }, [searchQuery, surahs, surahLookupById]);

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
            style={[styles.tabButton, browseMode === 'surah' && styles.tabButtonActive]}
            onPress={() => setBrowseMode('surah')}
          >
            <Text style={[styles.tabButtonText, browseMode === 'surah' && styles.tabButtonTextActive]}>
              {t.browseBySurah}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, browseMode === 'juz' && styles.tabButtonActive]}
            onPress={() => setBrowseMode('juz')}
          >
            <Text style={[styles.tabButtonText, browseMode === 'juz' && styles.tabButtonTextActive]}>
              {t.browseByJuz}
            </Text>
          </TouchableOpacity>
        </View>

        {browseMode === 'surah' && (
          <View style={styles.practiceRow}>
            <TouchableOpacity
              style={styles.practiceRowButton}
              activeOpacity={0.8}
              onPress={() => setQuizVisible(true)}
            >
              <Text style={styles.practiceRowText}>✏️ {t.takeQuiz}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.practiceRowButton}
              activeOpacity={0.8}
              onPress={() => setPracticeVisible(true)}
            >
              <Text style={styles.practiceRowText}>🎙 {t.practice}</Text>
              {dueReviewCount > 0 && (
                <View style={styles.practiceBadge}>
                  <Text style={styles.practiceBadgeText}>{dueReviewCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {browseMode === 'surah' ? (
          <View style={styles.searchContainer}>
            <View style={styles.searchWrapper}>
              <TextInput
                style={styles.searchInput}
                placeholder={t.searchPlaceholder}
                placeholderTextColor="rgba(255,255,255,0.35)"
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
                    <Text style={styles.clearIcon}>×</Text>
                  </View>
                </TouchableWithoutFeedback>
              )}
            </View>
          </View>
        ) : savedBookmark || lastViewedPage ? (
          <TouchableOpacity
            style={styles.continueReadingCard}
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate('MushafReader', {
                juzNumber: 1,
                initialPage: savedBookmark?.page ?? lastViewedPage,
              })
            }
          >
            <Ionicons
              name={savedBookmark ? 'bookmark' : 'time-outline'}
              size={20}
              color={savedBookmark ? '#f5a623' : 'rgba(255,255,255,0.55)'}
            />
            <View style={styles.continueReadingContent}>
              <Text style={styles.continueReadingLabel}>{t.continueFrom}</Text>
              <Text style={styles.continueReadingTitle}>
                {t.page} {savedBookmark?.page ?? lastViewedPage}
                {savedBookmark?.ayahNumber ? ` · ${t.ayah} ${savedBookmark.ayahNumber}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        ) : null}

        {isSearchMode && !isSearching && aiResults.length > 0 && (
          <View style={styles.searchMetaBlock}>
            <Text style={styles.searchMetaText}>
              {aiResults.length} {t.versesFound}
            </Text>
            <Text style={styles.searchMetaHint}>{t.notExhaustiveHint}</Text>
          </View>
        )}

        {isSearching && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={UI_COLORS.primary} />
            <Text style={styles.loadingRowText}>
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
            ListHeaderComponent={
              surahNameMatches.length > 0 ? (
                <View style={styles.surahMatchSection}>
                  {surahNameMatches.map((surah) => (
                    <TouchableOpacity
                      key={`surah-match-${surah.id}`}
                      style={styles.surahCard}
                      onPress={() => navigateToSurah(surah)}
                    >
                      <View style={styles.surahInfo}>
                        <Text style={styles.surahNumber}>{surah.id}</Text>
                        <View>
                          <Text style={styles.surahNameEnglish}>{surah.name_simple}</Text>
                          <Text
                            style={[
                              styles.surahNameArabic,
                              { fontSize: arabicNameFontSize },
                              arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
                            ]}
                          >
                            {surah.name_arabic}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.surahMatchBadge}>{t.surahTab} →</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null
            }
            ListEmptyComponent={
              !isSearching && surahNameMatches.length === 0 ? (
                <Text style={styles.emptyText}>
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
                  style={styles.juzCard}
                  onPress={() => navigation.navigate('MushafReader', { juzNumber: juz.juz_number })}
                >
                  <View style={styles.juzHeader}>
                    <Text style={styles.juzNumber}>{t.juz} {juz.juz_number}</Text>
                    <Text style={styles.versesCount}>{juz.verses_count} {t.verses}</Text>
                  </View>
                  <Text style={styles.juzRange}>{rangeText}</Text>
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
                    <Text style={styles.historyTitle}>{t.recentSearches}</Text>
                    <TouchableOpacity onPress={() => clearSearchHistory().then(() => setSearchHistory([]))}>
                      <Text style={styles.historyClear}>{t.clearHistory}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.historyChips}>
                    {searchHistory.map((item, idx) => (
                      <TouchableOpacity
                        key={`${item.query}-${idx}`}
                        style={styles.historyChip}
                        onPress={() => setSearchQuery(item.query)}
                      >
                        <Text style={styles.historyChipText}>{item.query}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null
            }
          />
        )}
      </View>

      <MemorizationQuizModal
        visible={quizVisible}
        onClose={() => setQuizVisible(false)}
        bookmarks={memorizeBookmarks.map((b): BookmarkForQuiz => ({
          surahId: b.surahId,
          surahName: b.surahName,
          ayahNum: b.ayahNum,
          ayahText: b.ayahText,
          translation: b.translation,
        }))}
      />

      <RevealPracticeModal
        visible={practiceVisible}
        onClose={() => setPracticeVisible(false)}
        bookmarks={memorizeBookmarks}
      />
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
  practiceRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  practiceRowButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    backgroundColor: 'rgba(155,89,182,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(155,89,182,0.3)',
    borderRadius: UI_RADII.lg,
  },
  practiceRowText: {
    fontSize: 14,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  practiceBadge: {
    backgroundColor: 'rgba(155,89,182,0.4)',
    borderRadius: UI_RADII.xl,
    minWidth: 22,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  practiceBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#e3c8ef',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
  searchMetaBlock: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchMetaText: {
    fontSize: 13,
    color: UI_COLORS.textMuted,
    fontWeight: '600',
  },
  searchMetaHint: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    marginVertical: 8,
    borderRadius: UI_RADII.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderLeftWidth: 5,
    borderLeftColor: UI_COLORS.primary,
    ...UI_SHADOWS.card,
  },
  searchResultCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginVertical: 6,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...UI_SHADOWS.card,
  },
  darkCard: { backgroundColor: 'rgba(26, 38, 52, 0.75)', borderColor: 'rgba(255, 255, 255, 0.08)' },
  surahMatchSection: {
    marginBottom: 4,
  },
  surahMatchBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: UI_COLORS.accent,
  },
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
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: UI_RADII.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  historyChipText: {
    fontSize: 13,
    color: UI_COLORS.text,
  },
  juzCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    marginVertical: 8,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
  continueReadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    backgroundColor: 'rgba(45,127,184,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(45,127,184,0.25)',
    borderRadius: UI_RADII.lg,
    gap: 12,
  },
  continueReadingContent: {
    flex: 1,
  },
  continueReadingLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
  continueReadingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: UI_COLORS.white,
    marginTop: 2,
  },
  darkText: { color: UI_COLORS.white },
  darkMutedText: { color: '#a8b3bd' },
});
