import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { ActivityIndicator } from 'react-native';
import { fetchAyahs, fetchTranslations, fetchTafseer, fetchWordByWord, fetchSurahInfo, type WordByWord, type SurahInfo } from '../services/quranApi';
import { recordAyahRead } from '../services/readingProgressService';
import ShareAyahCard from '../components/ShareAyahCard';
import { useAudio, useAudioProgress } from '../context/AudioContext';
import { useSettings } from '../context/SettingsContext';
import { useThemedAlert } from '../context/ThemedAlertContext';
import { getGlobalAyahNumber } from '../utils/quranUtils';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { getBookmarks, addBookmark, removeBookmark, BookmarkTag } from '../services/bookmarkService';
import { resolveArabicFontFamily } from '../theme/fonts';
import { UI_COLORS, UI_RADII, UI_SHADOWS, UI_GLASS } from '../theme/ui';
import GlassBackground from '../components/GlassBackground';
import ScreenIntroTile from '../components/ScreenIntroTile';
import CompactPlayerCard from '../components/CompactPlayerCard';
import AskAyahModal from '../components/AskAyahModal';
import { useLanguage } from '../i18n';

const reciters = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy' },
  { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary' },
  { id: 'ar.minshawi', name: 'Muhammad Siddiq Al-Minshawi' },
  { id: 'ar.muhammadayyoub', name: 'Muhammad Ayyoub' },
  { id: 'ar.mahermuaiqly', name: 'Maher Al Muaiqly' },
  { id: 'ar.shaatree', name: 'Abu Bakr Ash-Shatri' },
  { id: 'ar.ahmedajamy', name: 'Ahmed ibn Ali al-Ajamy' },
];

const LIST_SCROLL_RETRY_DELAY_MS = 300;
const INITIAL_AYAH_SCROLL_RETRY_MS = 180;
const INITIAL_AYAH_SCROLL_MAX_ATTEMPTS = 6;
const TOUCH_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

type AyahItemProps = {
  ayah: any;
  isDark: boolean;
  arabicFontSize: number;
  arabicFontFamily?: string;
  isActiveAyah: boolean;
  isAnyAyahPlaying: boolean;
  isBookmarked: boolean;
  expandedTranslation: number | null;
  expandedTafseer: number | null;
  loadingTafseer: boolean;
  currentTafseer: string;
  onPlayAyah: (ayahNum: number) => void;
  onToggleBookmark: (ayahNum: number) => void;
  onToggleTranslation: (ayahNum: number) => void;
  onToggleTafseer: (ayahNum: number) => void;
  onAskAI: (ayah: any) => void;
  onShare?: (data: { arabicText: string; translation: string; verseKey: string }) => void;
  isHighlighted: boolean;
  surahId: number;
};

const AyahItem = memo(({
  ayah,
  isDark,
  arabicFontSize,
  arabicFontFamily,
  isActiveAyah,
  isAnyAyahPlaying,
  isBookmarked,
  expandedTranslation,
  expandedTafseer,
  loadingTafseer,
  currentTafseer,
  onPlayAyah,
  onToggleBookmark,
  onToggleTranslation,
  onToggleTafseer,
  onAskAI,
  onShare,
  isHighlighted,
  surahId,
}: AyahItemProps) => {
  const { t } = useLanguage();
  const [showWords, setShowWords] = useState(false);
  const [words, setWords] = useState<WordByWord[]>([]);
  const [loadingWords, setLoadingWords] = useState(false);

  const toggleWordByWord = async () => {
    if (showWords) {
      setShowWords(false);
      return;
    }
    if (words.length > 0) {
      setShowWords(true);
      return;
    }
    setLoadingWords(true);
    try {
      const data = await fetchWordByWord(surahId, ayah.verse_number);
      setWords(data);
      setShowWords(true);
    } catch {
      setWords([]);
    } finally {
      setLoadingWords(false);
    }
  };
  return (
    <View
      style={[
        styles.ayahCard,
        isDark && styles.darkAyahCard,
        isActiveAyah && styles.playingCard,
        isHighlighted && styles.highlightedCard,
      ]}
    >
      <View style={styles.ayahCardTopRow}>
        <Text style={[styles.ayahNumberBadge, isDark && styles.darkAyahNumberBadge]}>
          {ayah.verse_number}
        </Text>
        <View style={styles.topRowIcons}>
          <TouchableOpacity
            onPress={() => onToggleBookmark(ayah.verse_number)}
            hitSlop={TOUCH_HIT_SLOP}
            activeOpacity={0.7}
          >
            <Text style={[styles.topIcon, isBookmarked && styles.topIconActive]}>
              {isBookmarked ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
          {isActiveAyah ? (
            <Text style={styles.topIconPlaying}>●</Text>
          ) : !isAnyAyahPlaying ? (
            <TouchableOpacity
              onPress={() => onPlayAyah(ayah.verse_number)}
              hitSlop={TOUCH_HIT_SLOP}
              activeOpacity={0.7}
            >
              <Text style={styles.topIcon}>▶</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Text
        style={[
          styles.ayahText,
          {
            fontSize: arabicFontSize,
            lineHeight: Math.max(arabicFontSize + 14, Math.round(arabicFontSize * 1.75)),
          },
          arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
          isDark && styles.darkText,
        ]}
      >
        {ayah.text_uthmani}
      </Text>

      <View style={styles.bottomToggles}>
        <TouchableOpacity
          onPress={() => onToggleTranslation(ayah.verse_number)}
          style={[styles.actionChip, isDark && styles.darkActionChip, expandedTranslation === ayah.verse_number && styles.activeActionChip]}
          hitSlop={TOUCH_HIT_SLOP}
          activeOpacity={0.85}
        >
          <Text style={[styles.actionChipText, isDark && styles.darkText, expandedTranslation === ayah.verse_number && styles.activeActionChipText]}>
            {expandedTranslation === ayah.verse_number ? t.hideTranslation : t.showTranslation}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onToggleTafseer(ayah.verse_number)}
          style={[styles.actionChip, isDark && styles.darkActionChip, expandedTafseer === ayah.verse_number && styles.activeActionChip]}
          hitSlop={TOUCH_HIT_SLOP}
          activeOpacity={0.85}
        >
          <Text style={[styles.actionChipText, isDark && styles.darkText, expandedTafseer === ayah.verse_number && styles.activeActionChipText]}>
            {expandedTafseer === ayah.verse_number ? (loadingTafseer ? t.loading : t.hideTafseer) : t.showTafseer}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleWordByWord}
          style={[styles.actionChip, isDark && styles.darkActionChip, showWords && styles.activeActionChip]}
          hitSlop={TOUCH_HIT_SLOP}
          activeOpacity={0.85}
        >
          <Text style={[styles.actionChipText, isDark && styles.darkText, showWords && styles.activeActionChipText]}>
            {loadingWords ? '...' : showWords ? t.hideWordByWord : t.wordByWord}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onAskAI(ayah)}
          style={[styles.actionChip, isDark && styles.darkActionChip, styles.aiChip]}
          hitSlop={TOUCH_HIT_SLOP}
          activeOpacity={0.85}
        >
          <Text style={styles.aiChipText}>{t.askAi}</Text>
        </TouchableOpacity>
      </View>

      {showWords && words.length > 0 && (
        <View style={styles.wordGrid}>
          {words.map((w) => (
            <View key={w.position} style={[styles.wordCard, isDark && styles.darkWordCard]}>
              <Text style={[styles.wordArabic, arabicFontFamily ? { fontFamily: arabicFontFamily } : null]}>
                {w.text_uthmani}
              </Text>
              <Text style={styles.wordTranslit}>{w.transliteration}</Text>
              <Text style={[styles.wordMeaning, isDark && styles.darkText]}>{w.translation}</Text>
            </View>
          ))}
        </View>
      )}

      {expandedTranslation === ayah.verse_number && (
        <View>
          <Text style={[styles.translationText, isDark && styles.darkText]}>{ayah.translation}</Text>
          <TouchableOpacity
            style={styles.shareChip}
            onPress={() => onShare?.({ arabicText: ayah.text_uthmani, translation: ayah.translation, verseKey: ayah.verse_key })}
            activeOpacity={0.8}
          >
            <Text style={styles.shareChipText}>{t.shareAyah}</Text>
          </TouchableOpacity>
        </View>
      )}

      {expandedTafseer === ayah.verse_number && (
        <Text style={[styles.tafseerText, isDark && styles.darkText]}>{currentTafseer}</Text>
      )}
    </View>
  );
});

type SurahPlayerBarProps = {
  surahId: number;
  surahVersesCount: number;
  isDark: boolean;
  onPlayAyahByNumber: (ayahNum: number) => void;
};

const SurahPlayerBar = memo(({ surahId, surahVersesCount, isDark, onPlayAyahByNumber }: SurahPlayerBarProps) => {
  const {
    currentAyah,
    togglePlayPause,
    seekTo,
    stopListening,
    repeatMode,
    repeatRange,
    memorizationMode,
  } = useAudio();
  const { isPlaying, positionMillis, durationMillis } = useAudioProgress();
  const isCurrentSurah = !!currentAyah && currentAyah.surah === surahId;

  useEffect(() => {
    if (!isCurrentSurah || !currentAyah) {
      return;
    }

    if (durationMillis <= 0 || positionMillis < durationMillis - 300) {
      return;
    }

    const timer = setTimeout(() => {
      if (repeatMode === 'range' && repeatRange && currentAyah.ayah === repeatRange.end) {
        onPlayAyahByNumber(repeatRange.start);
      } else if (repeatMode !== 'single' && !memorizationMode && currentAyah.ayah < surahVersesCount) {
        onPlayAyahByNumber(currentAyah.ayah + 1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    currentAyah?.ayah,
    durationMillis,
    memorizationMode,
    onPlayAyahByNumber,
    positionMillis,
    repeatMode,
    repeatRange,
    isCurrentSurah,
    surahVersesCount,
  ]);

  if (!isCurrentSurah || !currentAyah) {
    return null;
  }

  const handlePreviousAyah = () => {
    if (currentAyah.ayah > 1) {
      onPlayAyahByNumber(currentAyah.ayah - 1);
    }
  };

  const handleNextAyah = () => {
    if (currentAyah.ayah < surahVersesCount) {
      onPlayAyahByNumber(currentAyah.ayah + 1);
    }
  };

  return (
    <CompactPlayerCard
      isDark={isDark}
      badgeLabel={String(currentAyah.ayah)}
      title="Now Playing"
      subtitle={`Surah ${surahId}`}
      currentMs={positionMillis}
      durationMs={durationMillis}
      isPlaying={isPlaying}
      disablePrev={currentAyah.ayah === 1}
      disableNext={currentAyah.ayah === surahVersesCount}
      onPrev={handlePreviousAyah}
      onNext={handleNextAyah}
      onTogglePlay={() => {
        void togglePlayPause();
      }}
      onSeek={(value) => {
        void seekTo(value);
      }}
      onClose={() => {
        void stopListening();
      }}
      layout="inline"
    />
  );
});

export default function SurahScreen({ route }: any) {
  const { surah, surahs } = route.params;
  const [ayahs, setAyahs] = useState<any[]>([]);
  const [reciterModal, setReciterModal] = useState(false);
  const [rangeModal, setRangeModal] = useState(false);
  const [tempStart, setTempStart] = useState(1);
  const [tempEnd, setTempEnd] = useState(surah.verses_count);
  const [expandedTafseer, setExpandedTafseer] = useState<number | null>(null);
  const [currentTafseer, setCurrentTafseer] = useState<string>('');
  const [loadingTafseer, setLoadingTafseer] = useState(false);
  const [expandedTranslation, setExpandedTranslation] = useState<number | null>(null); // New: for translation
  const [askAyah, setAskAyah] = useState<{ ayahNumber: number; verseKey: string; arabicText: string; translation: string } | null>(null);

  // For cancelling previous tafseer fetch
  const abortControllerRef = useRef<AbortController | null>(null);
  const tafseerCacheRef = useRef<Record<number, string>>({});

  // Track bookmarked ayahs
  const [bookmarkedAyahs, setBookmarkedAyahs] = useState<Set<string>>(new Set());
  const [highlightAyah, setHighlightAyah] = useState<number | null>(null);
  const [shareAyah, setShareAyah] = useState<{ arabicText: string; translation: string; verseKey: string } | null>(null);
  const [surahInfo, setSurahInfo] = useState<SurahInfo | null>(null);

  const flatListRef = useRef<FlatList<any>>(null);
  const initialAyahScrollInProgressRef = useRef(false);

  const navigation = useNavigation();
  const handleBackPress = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MemorizeUnderstand' as never);
  }, [navigation]);

  const {
    playAyah,
    currentAyah,
    selectedReciter,
    setReciter,
    repeatMode,
    setRepeatMode,
    repeatRange,
    setRepeatRange,
    memorizationMode,
    toggleMemorizationMode,
    sound,
  } = useAudio();

  const { settings } = useSettings();
  const { showAlert } = useThemedAlert();
  const { t } = useLanguage();

  useEffect(() => {
    return () => {
      if (sound) {
        sound.stopAsync();
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Load Arabic ayahs + English translations
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      tafseerCacheRef.current = {};
      setExpandedTafseer(null);
      setCurrentTafseer('');
      setExpandedTranslation(null);

      try {
        const [ayahsData, translationsData, allBookmarks, info] = await Promise.all([
          fetchAyahs(surah.id),
          fetchTranslations(surah.id),
          getBookmarks(),
          fetchSurahInfo(surah.id),
        ]);
        setSurahInfo(info);

        const ayahsWithTranslation = ayahsData.map((ayah: any, index: number) => ({
          ...ayah,
          translation: translationsData[index]?.text || 'Translation not available',
        }));

        if (!isMounted) return;
        setAyahs(ayahsWithTranslation);

        const bookmarks = new Set<string>(
          allBookmarks
            .filter((bookmark) => bookmark.surahId === surah.id)
            .map((bookmark) => `${bookmark.surahId}-${bookmark.ayahNum}`)
        );
        setBookmarkedAyahs(bookmarks);
      } catch (error) {
        console.error('Error loading ayahs or translations:', error);
        try {
          const ayahsData = await fetchAyahs(surah.id);
          const allBookmarks = await getBookmarks();
          if (!isMounted) return;

          setAyahs(ayahsData.map((ayah: any) => ({
            ...ayah,
            translation: 'Translation unavailable',
          })));

          const bookmarks = new Set<string>(
            allBookmarks
              .filter((bookmark) => bookmark.surahId === surah.id)
              .map((bookmark) => `${bookmark.surahId}-${bookmark.ayahNum}`)
          );
          setBookmarkedAyahs(bookmarks);
        } catch (fallbackError) {
          console.error('Fallback ayah fetch failed:', fallbackError);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [surah.id]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const scrollToAyah = useCallback((ayahNum: number, animated: boolean) => {
    if (!flatListRef.current || ayahs.length === 0) return;

    const targetAyahNum = Number(ayahNum);
    if (!Number.isFinite(targetAyahNum)) return;

    const index = ayahs.findIndex((item) => Number(item.verse_number) === targetAyahNum);
    if (index < 0 || index >= ayahs.length) return;

    try {
      flatListRef.current.scrollToIndex({ index, animated, viewPosition: 0.45 });
    } catch {
      // Ignore stale list index during rapid list/layout updates.
    }
  }, [ayahs]);

  const scrollToAyahWithRetry = useCallback((ayahNum: number, attempt = 0) => {
    if (!flatListRef.current || ayahs.length === 0) {
      initialAyahScrollInProgressRef.current = false;
      return;
    }

    const targetAyahNum = Number(ayahNum);
    if (!Number.isFinite(targetAyahNum) || targetAyahNum <= 0) {
      initialAyahScrollInProgressRef.current = false;
      return;
    }

    const index = ayahs.findIndex((item) => Number(item.verse_number) === targetAyahNum);
    if (index < 0 || index >= ayahs.length) {
      initialAyahScrollInProgressRef.current = false;
      return;
    }

    try {
      flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.45 });
      initialAyahScrollInProgressRef.current = false;
    } catch {
      if (attempt >= INITIAL_AYAH_SCROLL_MAX_ATTEMPTS) {
        initialAyahScrollInProgressRef.current = false;
        return;
      }
      setTimeout(() => {
        scrollToAyahWithRetry(targetAyahNum, attempt + 1);
      }, INITIAL_AYAH_SCROLL_RETRY_MS);
    }
  }, [ayahs]);

  // Auto-scroll current ayah into view.
  useEffect(() => {
    if (initialAyahScrollInProgressRef.current) return;
    if (!currentAyah || currentAyah.surah !== surah.id) return;
    scrollToAyah(currentAyah.ayah, true);
  }, [currentAyah, scrollToAyah, surah.id]);

  // Scroll to bookmark-selected ayah once the list is ready, then flash highlight.
  useEffect(() => {
    const initialAyah = Number(route.params?.initialAyah);
    if (!Number.isFinite(initialAyah) || initialAyah <= 0 || ayahs.length === 0) return;

    initialAyahScrollInProgressRef.current = true;

    // Step 1: Quick jump without animation to get close
    const jumpTimer = setTimeout(() => {
      scrollToAyahWithRetry(initialAyah);
    }, 300);

    // Step 2: Flash highlight after scroll settles (generous delay)
    const flashTimer = setTimeout(() => {
      let flashCount = 0;
      const flashInterval = setInterval(() => {
        flashCount++;
        if (flashCount > 6) {
          clearInterval(flashInterval);
          setHighlightAyah(null);
          return;
        }
        setHighlightAyah(flashCount % 2 === 1 ? initialAyah : null);
      }, 400);
    }, 1500);

    return () => {
      clearTimeout(jumpTimer);
      clearTimeout(flashTimer);
      initialAyahScrollInProgressRef.current = false;
      setHighlightAyah(null);
    };
  }, [ayahs.length, route.params?.initialAyah, route.params?.scrollNonce, scrollToAyahWithRetry]);

  const handlePlayAyah = useCallback((ayahNum: number) => {
    const global = getGlobalAyahNumber(surah.id, ayahNum, surahs);
    playAyah(surah.id, ayahNum, global);
    void recordAyahRead(surah.id, ayahNum, surah.verses_count);
  }, [playAyah, surah.id, surahs, surah.verses_count]);

  // Fixed toggleTafseer — prevents flash of previous tafseer
  const toggleTafseer = useCallback(async (ayahNum: number) => {
    if (expandedTafseer === ayahNum) {
      setExpandedTafseer(null);
      return;
    }

    const cached = tafseerCacheRef.current[ayahNum];
    if (cached) {
      setCurrentTafseer(cached);
      setLoadingTafseer(false);
      setExpandedTafseer(ayahNum);
      return;
    }

    // Cancel any previous fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear old tafseer immediately
    setCurrentTafseer('');
    setLoadingTafseer(true);
    setExpandedTafseer(ayahNum);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const text = await fetchTafseer(surah.id, ayahNum, controller.signal);
      if (!controller.signal.aborted) {
        tafseerCacheRef.current[ayahNum] = text;
        setCurrentTafseer(text);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Tafseer load error:', error);
        if (!controller.signal.aborted) {
          setCurrentTafseer('Failed to load tafseer. Check your connection.');
        }
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingTafseer(false);
      }
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [expandedTafseer, surah.id]);

  // New: Toggle translation (similar to toggleTafseer)
  const toggleTranslation = useCallback((ayahNum: number) => {
    if (expandedTranslation === ayahNum) {
      setExpandedTranslation(null);
    } else {
      setExpandedTranslation(ayahNum);
    }
  }, [expandedTranslation]);

  const saveBookmarkWithTag = useCallback(async (ayahNum: number, tag: BookmarkTag) => {
    const key = `${surah.id}-${ayahNum}`;
    const ayah = ayahs.find(a => a.verse_number === ayahNum);
    if (!ayah) return;

    await addBookmark({
      surahId: surah.id,
      surahName: surah.name_simple,
      ayahNum: ayah.verse_number,
      ayahText: ayah.text_uthmani,
      translation: ayah.translation,
      timestamp: Date.now(),
      tag,
    });
    setBookmarkedAyahs(prev => new Set(prev).add(key));
    showAlert({
      title: t.save,
      message: `${t.ayah} → ${tag === 'memorize' ? t.memorize : t.readRecite}`,
      variant: 'success',
    });
  }, [ayahs, showAlert, surah.id, surah.name_simple]);

  // Toggle bookmark
  const toggleBookmark = useCallback(async (ayahNum: number) => {
    const key = `${surah.id}-${ayahNum}`;
    const isBookmarked = bookmarkedAyahs.has(key);

    if (isBookmarked) {
      await removeBookmark(surah.id, ayahNum);
      setBookmarkedAyahs(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
      showAlert({
        title: t.removed,
        message: t.ayahRemovedFromBookmarks,
        variant: 'info',
      });
    } else {
      showAlert({
        title: t.saveBookmark,
        message: t.chooseBookmarkTag,
        variant: 'info',
        buttons: [
          { text: t.cancel, role: 'cancel' },
          {
            text: t.memorize,
            onPress: () => {
              void saveBookmarkWithTag(ayahNum, 'memorize');
            },
          },
          {
            text: t.readRecite,
            onPress: () => {
              void saveBookmarkWithTag(ayahNum, 'read_recite');
            },
          },
        ],
      });
    }
  }, [bookmarkedAyahs, saveBookmarkWithTag, showAlert, surah.id]);

  const handleAskAI = useCallback((ayah: any) => {
    setAskAyah({
      ayahNumber: ayah.verse_number,
      verseKey: ayah.verse_key,
      arabicText: ayah.text_uthmani,
      translation: ayah.translation ?? '',
    });
  }, []);

  const isDark = settings.isDarkMode;
  const ayahArabicFontSize = Math.max(24, settings.arabicFontSize);
  const arabicFontFamily = resolveArabicFontFamily(settings.arabicFontFamily);
  const currentAyahNumForThisSurah = currentAyah?.surah === surah.id ? currentAyah?.ayah : null;

  const listExtraData = useMemo(() => ({
    expandedTranslation,
    expandedTafseer,
    currentTafseer,
    loadingTafseer,
    currentAyahNumForThisSurah,
    bookmarkedAyahs,
    isDark,
  }), [
    expandedTranslation,
    expandedTafseer,
    currentTafseer,
    loadingTafseer,
    currentAyahNumForThisSurah,
    bookmarkedAyahs,
    isDark,
  ]);

  const onScrollToIndexFailed = useCallback(({
    index,
    averageItemLength,
    highestMeasuredFrameIndex,
  }: {
    index: number;
    averageItemLength: number;
    highestMeasuredFrameIndex: number;
  }) => {
    setTimeout(() => {
      if (!flatListRef.current || ayahs.length === 0) return;
      const safeIndex = Math.max(0, Math.min(index, ayahs.length - 1));

       if (averageItemLength > 0) {
        const measuredIndex = Math.max(0, Math.min(safeIndex, highestMeasuredFrameIndex + 1));
        flatListRef.current.scrollToOffset({
          offset: measuredIndex * averageItemLength,
          animated: false,
        });
      }

      flatListRef.current.scrollToIndex({ index: safeIndex, animated: true, viewPosition: 0.45 });
    }, LIST_SCROLL_RETRY_DELAY_MS);
  }, [ayahs.length]);

  const renderAyahItem = useCallback(({ item }: { item: any }) => {
    const isBookmarked = bookmarkedAyahs.has(`${surah.id}-${item.verse_number}`);
    const isActiveAyah = currentAyahNumForThisSurah === item.verse_number;
    const isAnyAyahPlaying = currentAyahNumForThisSurah !== null;

    return (
      <AyahItem
        ayah={item}
        isDark={isDark}
        arabicFontSize={ayahArabicFontSize}
        arabicFontFamily={arabicFontFamily}
        isActiveAyah={isActiveAyah}
        isAnyAyahPlaying={isAnyAyahPlaying}
        isBookmarked={isBookmarked}
        expandedTranslation={expandedTranslation}
        expandedTafseer={expandedTafseer}
        loadingTafseer={loadingTafseer}
        currentTafseer={currentTafseer}
        onPlayAyah={handlePlayAyah}
        onToggleBookmark={toggleBookmark}
        onToggleTranslation={toggleTranslation}
        onToggleTafseer={toggleTafseer}
        onAskAI={handleAskAI}
        onShare={setShareAyah}
        isHighlighted={highlightAyah === item.verse_number}
        surahId={surah.id}
      />
    );
  }, [
    bookmarkedAyahs,
    surah.id,
    currentAyahNumForThisSurah,
    isDark,
    ayahArabicFontSize,
    expandedTranslation,
    expandedTafseer,
    loadingTafseer,
    currentTafseer,
    handlePlayAyah,
    toggleBookmark,
    toggleTranslation,
    toggleTafseer,
    handleAskAI,
    highlightAyah,
  ]);

  return (
    <GlassBackground isDark={isDark}>
    <SafeAreaView style={[styles.safeArea, isDark && styles.darkSafeArea]}>
      <View style={[styles.container, isDark && styles.darkContainer]}>
        {/* Header with Back Button */}
        <View style={[styles.header, isDark && styles.darkHeader]}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>

          <View style={styles.titleWrapper}>
            <Text style={[styles.headerTitle, isDark && styles.darkText]}>Quran Pulse</Text>
          </View>
          <View style={styles.headerRightSpacer} />
        </View>

        {currentAyah?.surah === surah.id ? (
          <SurahPlayerBar
            surahId={surah.id}
            surahVersesCount={surah.verses_count}
            isDark={isDark}
            onPlayAyahByNumber={handlePlayAyah}
          />
        ) : (
          <ScreenIntroTile
            title={surah.name_arabic}
            subtitle={`${surah.name_simple} (${surah.translated_name.name})`}
            description={t.surahDescription}
            titleFontFamily={arabicFontFamily}
            isDark={isDark}
            style={styles.introTile}
          />
        )}

        {surahInfo && (
          <View style={[styles.surahInfoRow, isDark && styles.darkSurahInfoRow]}>
            <View style={styles.surahInfoChip}>
              <Text style={styles.surahInfoIcon}>{surahInfo.revelationPlace === 'makkah' ? '🕋' : '🕌'}</Text>
              <Text style={styles.surahInfoText}>{surahInfo.revelationPlace === 'makkah' ? t.meccan : t.medinan}</Text>
            </View>
            <View style={styles.surahInfoChip}>
              <Text style={styles.surahInfoIcon}>📜</Text>
              <Text style={styles.surahInfoText}>{t.revelationOrder}: {surahInfo.revelationOrder}</Text>
            </View>
            <View style={styles.surahInfoChip}>
              <Text style={styles.surahInfoIcon}>📖</Text>
              <Text style={styles.surahInfoText}>{surahInfo.versesCount} {t.numberOfVerses}</Text>
            </View>
          </View>
        )}

        {/* Controls Bar */}
        <View style={[styles.controlsBar, isDark && styles.darkControlsBar]}>
          <TouchableOpacity style={styles.controlItem} onPress={() => setReciterModal(true)}>
            <Text style={[styles.controlLabel, isDark && styles.darkText]}>{t.reciter}</Text>
            <Text style={[styles.controlValue, isDark && styles.darkText]} numberOfLines={1}>
              {selectedReciter.name}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlItem} onPress={toggleMemorizationMode}>
            <Text style={[styles.controlLabel, isDark && styles.darkText]}>{t.memorize}</Text>
            <Text style={[styles.controlValue, memorizationMode && styles.activeText, isDark && styles.darkText]}>
              {memorizationMode ? t.on : t.off}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlItem} onPress={() => setRangeModal(true)}>
            <Text style={[styles.controlLabel, isDark && styles.darkText]}>{t.repeat}</Text>
            <Text style={[styles.controlValue, isDark && styles.darkText]}>
              {repeatMode === 'range' && repeatRange
                ? `${repeatRange.start}-${repeatRange.end}`
                : repeatMode === 'none' ? t.noRepeat : repeatMode === 'single' ? t.repeatSingle : t.repeatRange}
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={flatListRef}
          data={ayahs}
          keyExtractor={(item) => String(item.verse_number)}
          renderItem={renderAyahItem}
          contentContainerStyle={styles.scrollContent}
          extraData={listExtraData}
          onScrollToIndexFailed={onScrollToIndexFailed}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={11}
          ListFooterComponent={<View style={styles.listFooter} />}
        />

        {/* Reciter Modal */}
        <Modal visible={reciterModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>{t.chooseReciter}</Text>
              <FlatList
                data={reciters}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setReciter(item);
                      setReciterModal(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity onPress={() => setReciterModal(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Repeat Range Modal */}
        <Modal visible={rangeModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Set Repeat Range</Text>
              <View style={styles.rangePicker}>
                <Text>From Ayah:</Text>
                <TouchableOpacity onPress={() => setTempStart(Math.max(1, tempStart - 1))}>
                  <Text style={styles.rangeBtn}>−</Text>
                </TouchableOpacity>
                <Text style={styles.rangeNumber}>{tempStart}</Text>
                <TouchableOpacity onPress={() => setTempStart(Math.min(surah.verses_count, tempStart + 1))}>
                  <Text style={styles.rangeBtn}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.rangePicker}>
                <Text>To Ayah:</Text>
                <TouchableOpacity onPress={() => setTempEnd(Math.max(tempStart, tempEnd - 1))}>
                  <Text style={styles.rangeBtn}>−</Text>
                </TouchableOpacity>
                <Text style={styles.rangeNumber}>{tempEnd}</Text>
                <TouchableOpacity onPress={() => setTempEnd(Math.min(surah.verses_count, tempEnd + 1))}>
                  <Text style={styles.rangeBtn}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.rangeActions}>
                <TouchableOpacity onPress={() => { setRepeatMode('none'); setRangeModal(false); }}>
                  <Text style={styles.rangeActionBtn}>{t.noRepeat}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setRepeatMode('single'); setRangeModal(false); }}>
                  <Text style={styles.rangeActionBtn}>{t.repeatSingle}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setRepeatRange(tempStart, tempEnd);
                  setRepeatMode('range');
                  setRangeModal(false);
                }}>
                  <Text style={[styles.rangeActionBtn, { color: '#27ae60' }]}>{t.repeatRange}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <AskAyahModal
          visible={askAyah !== null}
          onClose={() => setAskAyah(null)}
          surahName={surah.name_simple}
          ayahNumber={askAyah?.ayahNumber ?? 0}
          verseKey={askAyah?.verseKey ?? ''}
          arabicText={askAyah?.arabicText ?? ''}
          translation={askAyah?.translation ?? ''}
        />

        <Modal visible={shareAyah !== null} animationType="slide" transparent onRequestClose={() => setShareAyah(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.shareModal, isDark && styles.darkShareModal]}>
              {shareAyah && (
                <ShareAyahCard
                  arabicText={shareAyah.arabicText}
                  translation={shareAyah.translation}
                  verseKey={shareAyah.verseKey}
                  surahName={surah.name_simple}
                  arabicFontFamily={arabicFontFamily}
                />
              )}
              <TouchableOpacity style={styles.shareCloseBtn} onPress={() => setShareAyah(null)}>
                <Text style={styles.shareCloseBtnText}>{t.close}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  darkSafeArea: {},
  container: { flex: 1 },
  darkContainer: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  darkHeader: { backgroundColor: 'rgba(26, 38, 52, 0.75)', borderColor: 'rgba(255, 255, 255, 0.08)' },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: UI_RADII.lg,
    backgroundColor: '#ecf6ff',
    borderWidth: 1,
    borderColor: '#bfd9ec',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backIcon: { fontSize: 20, color: UI_COLORS.accent, marginRight: 4, fontWeight: '700' },
  backLabel: { fontSize: 14, color: UI_COLORS.accent, fontWeight: '700' },
  titleWrapper: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: UI_COLORS.text },
  headerRightSpacer: { width: 96 },
  introTile: { marginBottom: 8 },
  controlsBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    justifyContent: 'space-between',
    borderRadius: UI_RADII.lg,
    marginHorizontal: 16,
    marginBottom: 6,
    ...UI_SHADOWS.input,
  },
  darkControlsBar: { backgroundColor: 'rgba(26, 38, 52, 0.75)', borderColor: 'rgba(255, 255, 255, 0.08)' },
  controlItem: { alignItems: 'center', flex: 1, paddingHorizontal: 4, paddingVertical: 4 },
  controlLabel: { fontSize: 11, color: UI_COLORS.textMuted },
  controlValue: { fontSize: 11, fontWeight: '600', color: UI_COLORS.text, marginTop: 2, textAlign: 'center' },
  activeText: { color: UI_COLORS.primary, fontWeight: 'bold' },
  darkMutedText: { color: '#a8b3bd' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8 },
  listFooter: { height: 10 },
  ayahCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    ...UI_SHADOWS.card,
  },
  darkAyahCard: { backgroundColor: 'rgba(26, 38, 52, 0.75)', borderColor: 'rgba(255, 255, 255, 0.08)' },
  playingCard: { backgroundColor: UI_COLORS.primarySoft, borderLeftWidth: 6, borderLeftColor: UI_COLORS.primary },
  highlightedCard: { backgroundColor: UI_COLORS.primarySoft, borderColor: UI_COLORS.primary, borderWidth: 2 },
  ayahCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ayahNumberBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: UI_COLORS.accent,
    backgroundColor: 'rgba(45,127,184,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  darkAyahNumberBadge: {
    backgroundColor: 'rgba(45,127,184,0.2)',
    color: '#94c4e7',
  },
  topRowIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  topIcon: {
    fontSize: 20,
    color: UI_COLORS.textLight,
  },
  topIconActive: {
    color: '#f5a623',
  },
  topIconPlaying: {
    fontSize: 14,
    color: UI_COLORS.primary,
  },
  ayahText: {
    lineHeight: 56,
    textAlign: 'right',
    writingDirection: 'rtl',
    color: UI_COLORS.text,
    fontSize: 24,
    flexShrink: 1,
  },
  aiChip: {
    borderColor: UI_COLORS.accent,
    backgroundColor: 'rgba(45,127,184,0.08)',
  },
  aiChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: UI_COLORS.accent,
  },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,217,230,0.3)',
  },
  wordCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(200,217,230,0.4)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 70,
  },
  darkWordCard: {
    backgroundColor: 'rgba(26,38,52,0.6)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  wordArabic: {
    fontSize: 20,
    color: UI_COLORS.text,
    fontWeight: '600',
    marginBottom: 3,
  },
  wordTranslit: {
    fontSize: 10,
    color: UI_COLORS.accent,
    fontWeight: '600',
    marginBottom: 2,
  },
  wordMeaning: {
    fontSize: 10,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
  },
  darkText: { color: UI_COLORS.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: 'rgba(255, 255, 255, 0.65)', padding: 20, borderRadius: UI_RADII.md, width: '90%', maxHeight: '80%', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.45)' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: UI_COLORS.text },
  modalItem: { padding: 14, borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.45)' },
  modalItemText: { fontSize: 16, color: UI_COLORS.text },
  modalClose: { textAlign: 'center', padding: 14, color: UI_COLORS.danger, fontWeight: 'bold' },
  rangePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  rangeBtn: { fontSize: 28, paddingHorizontal: 20 },
  rangeNumber: { fontSize: 24, marginHorizontal: 20 },
  rangeActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  rangeActionBtn: { fontSize: 16, padding: 10 },
  translationText: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'left',
    color: '#2c3e50',
    marginTop: 8,
  },
  actionChip: {
    flex: 1,
    minHeight: 32,
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: '#b6d2e8',
    backgroundColor: '#ecf6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkActionChip: {
    backgroundColor: '#213241',
    borderColor: '#4d6376',
  },
  activeActionChip: {
    backgroundColor: UI_COLORS.primarySoft,
    borderColor: '#84c2a0',
  },
  actionChipText: {
    fontSize: 12,
    color: UI_COLORS.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  activeActionChipText: {
    color: '#1f6b45',
  },
  tafseerText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
    color: UI_COLORS.text,
    marginTop: 8,
    backgroundColor: '#f0f4f8',
    padding: 10,
    borderRadius: 12,
  },
  surahInfoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: 'rgba(200,217,230,0.4)',
  },
  darkSurahInfoRow: {
    backgroundColor: 'rgba(26,38,52,0.5)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  surahInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  surahInfoIcon: {
    fontSize: 14,
  },
  surahInfoText: {
    fontSize: 11,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
  },
  shareChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(31,157,85,0.1)',
    borderWidth: 1,
    borderColor: UI_COLORS.primary,
    borderRadius: UI_RADII.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  shareChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: UI_COLORS.primary,
  },
  shareModal: {
    backgroundColor: '#fff',
    borderRadius: UI_RADII.xl,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  darkShareModal: {
    backgroundColor: '#1a2634',
  },
  shareCloseBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  shareCloseBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
  },
  bottomToggles: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,217,230,0.3)',
    gap: 8,
  },
});
