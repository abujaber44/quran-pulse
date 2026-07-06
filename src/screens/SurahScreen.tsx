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
import { recordAyahRead, saveLastRead } from '../services/readingProgressService';
import ShareAyahCard from '../components/ShareAyahCard';
import TajweedView from '../components/TajweedView';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAudio, useAudioProgress } from '../context/AudioContext';
import { useSettings } from '../context/SettingsContext';
import { useThemedAlert } from '../context/ThemedAlertContext';
import { getGlobalAyahNumber } from '../utils/quranUtils';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
// Delay before centering an ayah the user just expanded content on, so the
// new content (translation/tafseer/words) has laid out first.
const AYAH_FOCUS_DELAY_MS = 300;
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
  isExpanded: boolean;
  onToggleExpand: (ayahNum: number) => void;
  onContentExpanded?: (ayahNum: number) => void;
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
  isExpanded,
  onToggleExpand,
  onContentExpanded,
}: AyahItemProps) => {
  const { t } = useLanguage();
  const [showWords, setShowWords] = useState(false);
  const [words, setWords] = useState<WordByWord[]>([]);
  const [loadingWords, setLoadingWords] = useState(false);
  const [showTajweed, setShowTajweed] = useState(false);

  useEffect(() => {
    if (!isExpanded) {
      setShowWords(false);
      setShowTajweed(false);
    }
  }, [isExpanded]);

  const toggleWordByWord = async () => {
    if (showWords) { setShowWords(false); return; }
    if (words.length > 0) {
      setShowWords(true);
      onContentExpanded?.(ayah.verse_number);
      return;
    }
    setLoadingWords(true);
    try {
      const data = await fetchWordByWord(surahId, ayah.verse_number);
      setWords(data);
      setShowWords(true);
      onContentExpanded?.(ayah.verse_number);
    } catch { setWords([]); }
    finally { setLoadingWords(false); }
  };

  const hasExpandedContent = expandedTranslation === ayah.verse_number || expandedTafseer === ayah.verse_number || showWords || showTajweed;

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => onToggleExpand(ayah.verse_number)}
      style={[
        styles.ayahCard,
        isActiveAyah && styles.playingCard,
        isHighlighted && styles.highlightedCard,
      ]}
    >
      <View style={styles.ayahCardTopRow}>
        <Text style={styles.ayahNumberBadge}>
          {ayah.verse_number}
        </Text>
        <View style={styles.topRowIcons}>
          <TouchableOpacity onPress={() => onToggleBookmark(ayah.verse_number)} hitSlop={TOUCH_HIT_SLOP}>
            <Text style={[styles.topIcon, isBookmarked && styles.topIconActive]}>
              {isBookmarked ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
          {isActiveAyah ? (
            <Text style={styles.topIconPlaying}>●</Text>
          ) : !isAnyAyahPlaying ? (
            <TouchableOpacity onPress={() => onPlayAyah(ayah.verse_number)} hitSlop={TOUCH_HIT_SLOP}>
              <Text style={styles.topIcon}>▶</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Text
        style={[
          styles.ayahText,
          { fontSize: arabicFontSize, lineHeight: Math.max(arabicFontSize + 14, Math.round(arabicFontSize * 1.75)) },
          arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
        ]}
      >
        {ayah.text_uthmani}
      </Text>

      {isExpanded && (
        <View style={styles.actionBar}>
          <TouchableOpacity onPress={() => onToggleTranslation(ayah.verse_number)} style={[styles.actionBarBtn, expandedTranslation === ayah.verse_number && styles.actionBarBtnActive]} activeOpacity={0.7}>
            <MaterialCommunityIcons name="translate" size={20} color={expandedTranslation === ayah.verse_number ? UI_COLORS.primary : UI_COLORS.textMuted} />
            <Text style={[styles.actionBarLabel, expandedTranslation === ayah.verse_number && styles.actionBarLabelActive]}>Translation</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onToggleTafseer(ayah.verse_number)} style={[styles.actionBarBtn, expandedTafseer === ayah.verse_number && styles.actionBarBtnActive]} activeOpacity={0.7}>
            <MaterialCommunityIcons name="book-open-variant" size={20} color={expandedTafseer === ayah.verse_number ? UI_COLORS.primary : UI_COLORS.textMuted} />
            <Text style={[styles.actionBarLabel, expandedTafseer === ayah.verse_number && styles.actionBarLabelActive]}>Tafseer</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleWordByWord} style={[styles.actionBarBtn, showWords && styles.actionBarBtnActive]} activeOpacity={0.7}>
            <MaterialCommunityIcons name="abjad-arabic" size={20} color={showWords ? UI_COLORS.primary : UI_COLORS.textMuted} />
            <Text style={[styles.actionBarLabel, showWords && styles.actionBarLabelActive]}>Words</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowTajweed(!showTajweed)} style={[styles.actionBarBtn, showTajweed && styles.actionBarBtnActive]} activeOpacity={0.7}>
            <Ionicons name="color-palette-outline" size={20} color={showTajweed ? UI_COLORS.primary : UI_COLORS.textMuted} />
            <Text style={[styles.actionBarLabel, showTajweed && styles.actionBarLabelActive]}>Tajweed</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onAskAI(ayah)} style={styles.actionBarBtn} activeOpacity={0.7}>
            <MaterialCommunityIcons name="creation" size={20} color={UI_COLORS.accent} />
            <Text style={[styles.actionBarLabel, styles.actionBarLabelAccent]}>AI</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onShare?.({ arabicText: ayah.text_uthmani, translation: ayah.translation ?? '', verseKey: ayah.verse_key })} style={styles.actionBarBtn} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={20} color={UI_COLORS.textMuted} />
            <Text style={styles.actionBarLabel}>Share</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isExpanded && !hasExpandedContent && (
        <Text style={styles.tapHint}>•••</Text>
      )}

      {showWords && words.length > 0 && (
        <View style={styles.wordGrid}>
          {words.map((w) => (
            <View key={w.position} style={styles.wordCard}>
              <Text style={[styles.wordArabic, arabicFontFamily ? { fontFamily: arabicFontFamily } : null]}>{w.text_uthmani}</Text>
              <Text style={styles.wordTranslit}>{w.transliteration}</Text>
              <Text style={styles.wordMeaning}>{w.translation}</Text>
            </View>
          ))}
        </View>
      )}

      {showTajweed && (
        <TajweedView verseKey={ayah.verse_key} arabicFontFamily={arabicFontFamily} />
      )}

      {expandedTranslation === ayah.verse_number && (
        <View style={styles.expandedContent}>
          <Text style={styles.translationText}>{ayah.translation}</Text>
        </View>
      )}

      {expandedTafseer === ayah.verse_number && (
        <View style={styles.expandedContent}>
          <Text style={styles.tafseerText}>{currentTafseer}</Text>
        </View>
      )}
    </TouchableOpacity>
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
  const [expandedAyahNum, setExpandedAyahNum] = useState<number | null>(null);
  const [showSurahDesc, setShowSurahDesc] = useState(true);
  const hasAutoExpandedRef = useRef(false);

  useEffect(() => {
    if (ayahs.length > 0 && !hasAutoExpandedRef.current && expandedAyahNum === null) {
      AsyncStorage.getItem('@quran_pulse_ayah_toolbar_seen').then((seen) => {
        if (!seen) {
          hasAutoExpandedRef.current = true;
          setExpandedAyahNum(1);
          void AsyncStorage.setItem('@quran_pulse_ayah_toolbar_seen', 'true');
        }
      });
    }
  }, [ayahs.length]);

  // Holds the latest focusAyah (defined after the scroll helpers below) so
  // toggleExpandAyah can use it without reordering declarations.
  const focusAyahRef = useRef<(ayahNum: number) => void>(() => {});

  const toggleExpandAyah = useCallback((ayahNum: number) => {
    if (expandedAyahNum === ayahNum) {
      setExpandedTranslation(null);
      setExpandedTafseer(null);
      setExpandedAyahNum(null);
      return;
    }
    // Expanding an ayah to study it counts toward progress, same as playing it
    void recordAyahRead(surah.id, ayahNum, surah.verses_count);
    void saveLastRead({ surahId: surah.id, surahName: surah.name_simple, ayahNum, timestamp: Date.now() });
    setExpandedAyahNum(ayahNum);
    focusAyahRef.current(ayahNum);
  }, [expandedAyahNum, surah.id, surah.name_simple, surah.verses_count]);

  const flatListRef = useRef<FlatList<any>>(null);
  const initialAyahScrollInProgressRef = useRef(false);

  const navigation = useNavigation();

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
    stopListening,
    sound,
  } = useAudio();

  const { settings } = useSettings();
  const { showAlert } = useThemedAlert();
  const { t, lang } = useLanguage();

  const stopListeningRef = useRef(stopListening);
  stopListeningRef.current = stopListening;
  useEffect(() => {
    return () => { void stopListeningRef.current(); };
  }, []);

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
          fetchTranslations(surah.id, settings.translationId),
          getBookmarks(),
          fetchSurahInfo(surah.id, lang),
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
  }, [surah.id, settings.translationId]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Drop cached tafseer text when the tafsir source changes
  useEffect(() => {
    tafseerCacheRef.current = {};
    setExpandedTafseer(null);
    setCurrentTafseer('');
  }, [settings.tafsirSlug]);

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

  // Center an ayah the user just expanded content on. Only ever runs in
  // direct response to a tap on that ayah's controls — never from scroll
  // events or playback — and defers to the deep-link initial scroll.
  const focusAyah = useCallback((ayahNum: number) => {
    setTimeout(() => {
      if (initialAyahScrollInProgressRef.current) return;
      scrollToAyah(ayahNum, true);
    }, AYAH_FOCUS_DELAY_MS);
  }, [scrollToAyah]);
  focusAyahRef.current = focusAyah;

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
    void saveLastRead({ surahId: surah.id, surahName: surah.name_simple, ayahNum, timestamp: Date.now() });
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
      focusAyah(ayahNum);
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
    focusAyah(ayahNum);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const text = await fetchTafseer(surah.id, ayahNum, controller.signal, settings.tafsirSlug);
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
  }, [expandedTafseer, focusAyah, surah.id]);

  // New: Toggle translation (similar to toggleTafseer)
  const toggleTranslation = useCallback((ayahNum: number) => {
    if (expandedTranslation === ayahNum) {
      setExpandedTranslation(null);
    } else {
      setExpandedTranslation(ayahNum);
      focusAyah(ayahNum);
    }
  }, [expandedTranslation, focusAyah]);

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
        message: t.confirmBookmarkMemorize,
        variant: 'success',
        buttons: [
          {
            text: t.memorize,
            onPress: () => {
              void saveBookmarkWithTag(ayahNum, 'memorize');
            },
          },
          { text: t.cancel, role: 'cancel' },
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
        isExpanded={expandedAyahNum === item.verse_number}
        onToggleExpand={toggleExpandAyah}
        onContentExpanded={focusAyah}
      />
    );
  }, [
    focusAyah,
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
    expandedAyahNum,
    toggleExpandAyah,
  ]);

  return (
    <GlassBackground isDark={isDark}>
      <View style={styles.container}>
        {currentAyah?.surah === surah.id ? (
          <SurahPlayerBar
            surahId={surah.id}
            surahVersesCount={surah.verses_count}
            isDark={isDark}
            onPlayAyahByNumber={handlePlayAyah}
          />
        ) : (
          <TouchableOpacity activeOpacity={0.8} onPress={() => setShowSurahDesc(prev => !prev)}>
            <ScreenIntroTile
              title={surah.name_arabic}
              subtitle={showSurahDesc
                ? (surahInfo?.shortDescription
                  ? `${surah.name_simple} — ${surahInfo.shortDescription}`
                  : `${surah.name_simple} (${surah.translated_name.name})`)
                : undefined}
              titleFontFamily={arabicFontFamily}
              isDark={isDark}
              style={styles.introTile}
            />
          </TouchableOpacity>
        )}

        {surahInfo && (
          <View style={styles.surahInfoRow}>
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
        <View style={styles.controlsBar}>
          <TouchableOpacity style={styles.controlItem} onPress={() => setReciterModal(true)}>
            <Text style={styles.controlLabel}>{t.reciter}</Text>
            <Text style={styles.controlValue} numberOfLines={1}>
              {selectedReciter.name}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlItem} onPress={toggleMemorizationMode}>
            <Text style={styles.controlLabel}>{t.memorize}</Text>
            <Text style={[styles.controlValue, memorizationMode && styles.activeText]}>
              {memorizationMode ? t.on : t.off}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlItem} onPress={() => setRangeModal(true)}>
            <Text style={styles.controlLabel}>{t.repeat}</Text>
            <Text style={styles.controlValue}>
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
                <Text style={{ color: '#FFFFFF' }}>From Ayah:</Text>
                <TouchableOpacity onPress={() => setTempStart(Math.max(1, tempStart - 1))}>
                  <Text style={styles.rangeBtn}>−</Text>
                </TouchableOpacity>
                <Text style={styles.rangeNumber}>{tempStart}</Text>
                <TouchableOpacity onPress={() => setTempStart(Math.min(surah.verses_count, tempStart + 1))}>
                  <Text style={styles.rangeBtn}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.rangePicker}>
                <Text style={{ color: '#FFFFFF' }}>To Ayah:</Text>
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
            <View style={styles.shareModal}>
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
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  introTile: { marginBottom: 8 },
  controlsBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...UI_SHADOWS.card,
  },
  darkAyahCard: { backgroundColor: 'rgba(26, 38, 52, 0.75)', borderColor: 'rgba(255, 255, 255, 0.08)' },
  playingCard: { backgroundColor: 'rgba(31,157,85,0.2)', borderLeftWidth: 6, borderLeftColor: UI_COLORS.primary },
  highlightedCard: { backgroundColor: 'rgba(31,157,85,0.2)', borderColor: UI_COLORS.primary, borderWidth: 2 },
  ayahCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ayahNumberBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7BC4F0',
    backgroundColor: 'rgba(45,127,184,0.25)',
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
    gap: 12,
  },
  topIcon: {
    fontSize: 26,
    color: 'rgba(255,255,255,0.45)',
    padding: 4,
  },
  topIconActive: {
    color: '#f5a623',
  },
  topIconPlaying: {
    fontSize: 16,
    color: UI_COLORS.primary,
    padding: 4,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
  modal: { backgroundColor: 'rgba(23,56,77,0.95)', padding: 20, borderRadius: UI_RADII.md, width: '90%', maxHeight: '80%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: UI_COLORS.text },
  modalItem: { padding: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  modalItemText: { fontSize: 16, color: UI_COLORS.text },
  modalClose: { textAlign: 'center', padding: 14, color: UI_COLORS.danger, fontWeight: 'bold' },
  rangePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  rangeBtn: { fontSize: 28, paddingHorizontal: 20, color: '#FFFFFF' },
  rangeNumber: { fontSize: 24, marginHorizontal: 20, color: '#FFFFFF' },
  rangeActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  rangeActionBtn: { fontSize: 16, padding: 10, color: 'rgba(255,255,255,0.7)' },
  translationText: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'left',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  actionChip: {
    minHeight: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(45,127,184,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkActionChip: {
    backgroundColor: '#213241',
    borderColor: '#4d6376',
  },
  activeActionChip: {
    backgroundColor: 'rgba(31,157,85,0.2)',
    borderColor: 'rgba(31,157,85,0.4)',
  },
  actionChipText: {
    fontSize: 12,
    color: UI_COLORS.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  activeActionChipText: {
    color: '#5ddb92',
  },
  tafseerText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
    color: UI_COLORS.text,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
  surahReflection: {
    marginHorizontal: 20,
    marginBottom: 10,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
    textAlign: 'center',
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
    backgroundColor: 'rgba(23,56,77,0.95)',
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
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 10,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,217,230,0.25)',
  },
  actionBarBtn: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
    minWidth: 48,
  },
  actionBarBtnActive: {
    backgroundColor: 'rgba(31,157,85,0.12)',
  },
  actionBarLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: UI_COLORS.textMuted,
    textAlign: 'center',
  },
  darkActionBarLabel: {
    color: '#8aa0b0',
  },
  actionBarLabelActive: {
    color: UI_COLORS.primary,
    fontWeight: '700',
  },
  actionBarLabelAccent: {
    color: UI_COLORS.accent,
    fontWeight: '700',
  },
  tapHint: {
    textAlign: 'center',
    color: UI_COLORS.textLight,
    fontSize: 14,
    marginTop: 6,
    letterSpacing: 3,
  },
  expandedContent: {
    marginTop: 10,
    paddingTop: 10,
    paddingHorizontal: 4,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,217,230,0.2)',
  },
  bottomToggles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,217,230,0.3)',
    gap: 6,
  },
});
