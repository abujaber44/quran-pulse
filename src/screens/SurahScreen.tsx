// src/screens/SurahScreen.tsx
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { fetchAyahs, fetchTranslations, fetchTafseer } from '../services/quranApi';
import { useAudio, useAudioProgress } from '../context/AudioContext';
import { useSettings } from '../context/SettingsContext';
import { getGlobalAyahNumber } from '../utils/quranUtils';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { getBookmarks, addBookmark, removeBookmark } from '../services/bookmarkService';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';

const reciters = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy' },
  { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary' },
  { id: 'ar.minshawi', name: 'Muhammad Siddiq Al-Minshawi' },
  { id: 'ar.muhammadayyoub', name: 'Muhammad Ayyoub' },
  { id: 'ar.mahermuaiqly', name: 'Maher Al Muaiqly' },
  { id: 'ar.shaatree', name: 'Abu Bakr Ash-Shatri' },
  { id: 'ar.ahmedajamy', name: 'Ahmed ibn Ali al-Ajamy' },
];

const LIST_FOOTER_HEIGHT = 130;
const LIST_SCROLL_RETRY_DELAY_MS = 300;
const INITIAL_AYAH_SCROLL_RETRY_MS = 180;
const INITIAL_AYAH_SCROLL_MAX_ATTEMPTS = 6;

type AyahItemProps = {
  ayah: any;
  isDark: boolean;
  isActiveAyah: boolean;
  isBookmarked: boolean;
  expandedTranslation: number | null;
  expandedTafseer: number | null;
  loadingTafseer: boolean;
  currentTafseer: string;
  onPlayAyah: (ayahNum: number) => void;
  onToggleBookmark: (ayahNum: number) => void;
  onToggleTranslation: (ayahNum: number) => void;
  onToggleTafseer: (ayahNum: number) => void;
};

const AyahItem = memo(({
  ayah,
  isDark,
  isActiveAyah,
  isBookmarked,
  expandedTranslation,
  expandedTafseer,
  loadingTafseer,
  currentTafseer,
  onPlayAyah,
  onToggleBookmark,
  onToggleTranslation,
  onToggleTafseer,
}: AyahItemProps) => {
  return (
    <TouchableOpacity
      style={[
        styles.ayahCard,
        isDark && styles.darkAyahCard,
        isActiveAyah && styles.playingCard,
      ]}
      onPress={() => onPlayAyah(ayah.verse_number)}
    >
      <TouchableOpacity
        style={styles.bookmarkBtn}
        onPress={() => onToggleBookmark(ayah.verse_number)}
      >
        <Text style={[
          styles.bookmarkIcon,
          isBookmarked && styles.bookmarkedIcon,
        ]}>
          {isBookmarked ? '★' : '☆'}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.ayahText, { fontSize: 24 }, isDark && styles.darkText]}>
        {ayah.text_uthmani}
      </Text>

      <View style={styles.bottomToggles}>
        <TouchableOpacity onPress={() => onToggleTranslation(ayah.verse_number)} style={styles.tafseerToggleBtn}>
          <Text style={[styles.tafseerToggle, isDark && styles.darkText]}>
            {expandedTranslation === ayah.verse_number ? '↑ Hide Translation' : '↓ Show Translation'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => onToggleTafseer(ayah.verse_number)} style={styles.tafseerToggleBtn}>
          <Text style={[styles.tafseerToggle, isDark && styles.darkText]}>
            {expandedTafseer === ayah.verse_number
              ? (loadingTafseer ? 'Loading...' : '↑ Hide Tafseer')
              : '↓ Show Tafseer'}
          </Text>
        </TouchableOpacity>
      </View>

      {expandedTranslation === ayah.verse_number && (
        <Text style={[styles.translationText, isDark && styles.darkText]}>
          {ayah.translation}
        </Text>
      )}

      {expandedTafseer === ayah.verse_number && (
        <Text style={[styles.tafseerText, isDark && styles.darkText]}>
          {currentTafseer}
        </Text>
      )}

      <Text style={[styles.ayahNumberBottom, isDark && styles.darkText]}>
        {ayah.verse_number}
      </Text>
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

  const formatTime = (ms: number) => {
    if (!ms) return '0:00';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.playerContainer, isDark && styles.darkPlayerContainer]}>
      <View style={[styles.playerCard, isDark && styles.darkPlayerCard]}>
        <TouchableOpacity style={styles.exitButton} onPress={stopListening}>
          <Text style={styles.exitIcon}>×</Text>
        </TouchableOpacity>

        <View style={styles.playerHeader}>
          <Text style={styles.playerAyahNumber}>{currentAyah.ayah}</Text>
          <Text style={[styles.playerTitle, isDark && styles.darkText]}>Currently Playing</Text>
        </View>

        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={durationMillis || 1}
          value={positionMillis}
          onSlidingComplete={seekTo}
          minimumTrackTintColor="#27ae60"
          thumbTintColor="#27ae60"
        />

        <Text style={[styles.timeText, isDark && styles.darkText]}>
          {formatTime(positionMillis)} / {formatTime(durationMillis)}
        </Text>

        <View style={styles.playerControls}>
          <TouchableOpacity onPress={handlePreviousAyah} disabled={currentAyah.ayah === 1}>
            <Text style={[styles.controlBtn, currentAyah.ayah === 1 && styles.disabledBtn, isDark && styles.darkText]}>
              ← Prev
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlayPause}>
            <Text style={styles.playPauseBtn}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleNextAyah} disabled={currentAyah.ayah === surahVersesCount}>
            <Text style={[styles.controlBtn, currentAyah.ayah === surahVersesCount && styles.disabledBtn, isDark && styles.darkText]}>
              Next →
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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

  // For cancelling previous tafseer fetch
  const abortControllerRef = useRef<AbortController | null>(null);
  const tafseerCacheRef = useRef<Record<number, string>>({});

  // Track bookmarked ayahs
  const [bookmarkedAyahs, setBookmarkedAyahs] = useState<Set<string>>(new Set());

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
    sound,
  } = useAudio();

  const { settings } = useSettings();

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
        const [ayahsData, translationsData, allBookmarks] = await Promise.all([
          fetchAyahs(surah.id),
          fetchTranslations(surah.id),
          getBookmarks(),
        ]);

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

  // Scroll to bookmark-selected ayah once the list is ready.
  useEffect(() => {
    const initialAyah = Number(route.params?.initialAyah);
    if (!Number.isFinite(initialAyah) || initialAyah <= 0 || ayahs.length === 0) return;

    initialAyahScrollInProgressRef.current = true;
    const timer = setTimeout(() => {
      scrollToAyahWithRetry(initialAyah);
    }, 350);

    return () => {
      clearTimeout(timer);
      initialAyahScrollInProgressRef.current = false;
    };
  }, [ayahs.length, route.params?.initialAyah, route.params?.scrollNonce, scrollToAyahWithRetry]);

  const handlePlayAyah = useCallback((ayahNum: number) => {
    const global = getGlobalAyahNumber(surah.id, ayahNum, surahs);
    playAyah(surah.id, ayahNum, global);
  }, [playAyah, surah.id, surahs]);

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
      if (error.name === 'AbortError') {
        console.log('Tafseer fetch cancelled');
      } else {
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
      Alert.alert('Removed', 'Ayah removed from bookmarks');
    } else {
      const ayah = ayahs.find(a => a.verse_number === ayahNum);
      if (ayah) {
        await addBookmark({
          surahId: surah.id,
          surahName: surah.name_simple,
          ayahNum: ayah.verse_number,
          ayahText: ayah.text_uthmani,
          translation: ayah.translation,
          timestamp: Date.now(),
        });
        setBookmarkedAyahs(prev => new Set(prev).add(key));
        Alert.alert('Saved', 'Ayah added to bookmarks');
      }
    }
  }, [ayahs, bookmarkedAyahs, surah.id]);

  const isDark = settings.isDarkMode;
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

    return (
      <AyahItem
        ayah={item}
        isDark={isDark}
        isActiveAyah={isActiveAyah}
        isBookmarked={isBookmarked}
        expandedTranslation={expandedTranslation}
        expandedTafseer={expandedTafseer}
        loadingTafseer={loadingTafseer}
        currentTafseer={currentTafseer}
        onPlayAyah={handlePlayAyah}
        onToggleBookmark={toggleBookmark}
        onToggleTranslation={toggleTranslation}
        onToggleTafseer={toggleTafseer}
      />
    );
  }, [
    bookmarkedAyahs,
    surah.id,
    currentAyahNumForThisSurah,
    isDark,
    expandedTranslation,
    expandedTafseer,
    loadingTafseer,
    currentTafseer,
    handlePlayAyah,
    toggleBookmark,
    toggleTranslation,
    toggleTafseer,
  ]);

  return (
    <SafeAreaView style={[styles.safeArea, isDark && styles.darkSafeArea]}>
      <View style={[styles.container, isDark && styles.darkContainer]}>
        {/* Header with Back Button */}
        <View style={[styles.header, isDark && styles.darkHeader]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.titleWrapper}>
            <Text style={[styles.surahArabic, { fontSize: 36 }]}>{surah.name_arabic}</Text>
            <Text style={[styles.surahEnglish, isDark && styles.darkText]}>({surah.translated_name.name})</Text>
          </View>
        </View>

        {/* Controls Bar */}
        <View style={[styles.controlsBar, isDark && styles.darkControlsBar]}>
          <TouchableOpacity style={styles.controlItem} onPress={() => setReciterModal(true)}>
            <Text style={[styles.controlLabel, isDark && styles.darkText]}>Reciter</Text>
            <Text style={[styles.controlValue, isDark && styles.darkText]} numberOfLines={1}>
              {selectedReciter.name}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlItem} onPress={toggleMemorizationMode}>
            <Text style={[styles.controlLabel, isDark && styles.darkText]}>Memorize</Text>
            <Text style={[styles.controlValue, memorizationMode && styles.activeText, isDark && styles.darkText]}>
              {memorizationMode ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlItem} onPress={() => setRangeModal(true)}>
            <Text style={[styles.controlLabel, isDark && styles.darkText]}>Repeat</Text>
            <Text style={[styles.controlValue, isDark && styles.darkText]}>
              {repeatMode === 'range' && repeatRange 
                ? `${repeatRange.start}-${repeatRange.end}` 
                : repeatMode.charAt(0).toUpperCase() + repeatMode.slice(1)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlItem} onPress={() => {
            Alert.alert('Coming Soon', 'Offline download feature will be added in the next update.');
          }}>
            <Text style={[styles.controlLabel, isDark && styles.darkText]}>Download</Text>
            <Text style={styles.downloadText}>⬇</Text>
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
          ListFooterComponent={<View style={{ height: LIST_FOOTER_HEIGHT }} />}
        />

        <SurahPlayerBar
          surahId={surah.id}
          surahVersesCount={surah.verses_count}
          isDark={isDark}
          onPlayAyahByNumber={handlePlayAyah}
        />

        {/* Reciter Modal */}
        <Modal visible={reciterModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Choose Reciter</Text>
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
                  <Text style={styles.rangeActionBtn}>No Repeat</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setRepeatMode('single'); setRangeModal(false); }}>
                  <Text style={styles.rangeActionBtn}>Repeat Single</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setRepeatRange(tempStart, tempEnd);
                  setRepeatMode('range');
                  setRangeModal(false);
                }}>
                  <Text style={[styles.rangeActionBtn, { color: '#27ae60' }]}>Repeat Range</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: UI_COLORS.text },
  darkSafeArea: { backgroundColor: UI_COLORS.darkBackground },
  container: { flex: 1, backgroundColor: UI_COLORS.background },
  darkContainer: { backgroundColor: UI_COLORS.darkBackground },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: UI_COLORS.text, paddingVertical: 18, paddingHorizontal: 16 },
  darkHeader: { backgroundColor: UI_COLORS.darkSurface },
  backBtn: { padding: 8 },
  backIcon: { fontSize: 28, color: UI_COLORS.white },
  titleWrapper: { flex: 1, alignItems: 'center' },
  surahArabic: { fontFamily: 'AmiriQuran', color: UI_COLORS.white, fontWeight: 'bold' },
  surahEnglish: { color: UI_COLORS.textLight, marginTop: 4 },
  controlsBar: {
    flexDirection: 'row',
    backgroundColor: UI_COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: UI_COLORS.border,
    justifyContent: 'space-between',
  },
  darkControlsBar: { backgroundColor: '#1e1e1e', borderColor: '#333' },
  controlItem: { alignItems: 'center', flex: 1, padding: 10 },
  controlLabel: { fontSize: 12, color: UI_COLORS.textMuted },
  controlValue: { fontSize: 14, fontWeight: '600', color: UI_COLORS.text, marginTop: 4 },
  activeText: { color: UI_COLORS.primary, fontWeight: 'bold' },
  downloadText: { fontSize: 20 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 180 },
  ayahCard: {
    backgroundColor: UI_COLORS.surface,
    padding: 28,
    marginBottom: 16,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    position: 'relative',
    ...UI_SHADOWS.card,
  },
  darkAyahCard: { backgroundColor: '#1e1e1e' },
  playingCard: { backgroundColor: UI_COLORS.primarySoft, borderLeftWidth: 6, borderLeftColor: UI_COLORS.primary },
  ayahText: { fontFamily: 'AmiriQuran', lineHeight: 56, textAlign: 'right', color: UI_COLORS.text, fontSize: 24 },
  ayahNumberBottom: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    fontSize: 14,
    color: UI_COLORS.accent,
    backgroundColor: UI_COLORS.surface,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: UI_RADII.sm,
    fontWeight: 'bold',
  },
  playerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 20 },
  darkPlayerContainer: { backgroundColor: 'transparent' },
  playerCard: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...UI_SHADOWS.floating,
  },
  darkPlayerCard: { backgroundColor: UI_COLORS.darkSurface, borderColor: '#30353b' },
  playerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  playerAyahNumber: { fontSize: 20, fontWeight: 'bold', color: UI_COLORS.accent, marginRight: 12 },
  playerTitle: { fontSize: 13, fontWeight: '600', color: UI_COLORS.text },
  slider: { width: '100%', height: 40 },
  timeText: { textAlign: 'center', color: UI_COLORS.textMuted, marginVertical: 8 },
  playerControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  controlBtn: { fontSize: 18, color: UI_COLORS.primary, fontWeight: '600' },
  disabledBtn: { color: UI_COLORS.textLight },
  playPauseBtn: { fontSize: 40, color: UI_COLORS.primary },
  darkText: { color: UI_COLORS.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: UI_COLORS.surface, padding: 20, borderRadius: UI_RADII.md, width: '90%', maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: UI_COLORS.text },
  modalItem: { padding: 14, borderBottomWidth: 1, borderColor: UI_COLORS.border },
  modalItemText: { fontSize: 16 },
  modalClose: { textAlign: 'center', padding: 14, color: UI_COLORS.danger, fontWeight: 'bold' },
  rangePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  rangeBtn: { fontSize: 28, paddingHorizontal: 20 },
  rangeNumber: { fontSize: 24, marginHorizontal: 20 },
  rangeActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  rangeActionBtn: { fontSize: 16, padding: 10 },
  translationText: {
    fontSize: 16,
    lineHeight: 28,
    textAlign: 'left',
    color: '#2c3e50',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  tafseerToggleBtn: {
    marginTop: 16,
    alignSelf: 'flex-start', // ← Changed to left for translation
    paddingHorizontal: 16,
    paddingVertical: 6
  },
  tafseerToggle: {
    fontSize: 16,
    color: UI_COLORS.primary,
    fontWeight: '600',
  },
  tafseerText: {
    fontSize: 15,
    lineHeight: 26,
    textAlign: 'right',
    color: UI_COLORS.text,
    marginTop: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f0f4f8',
    padding: 14,
    borderRadius: 12,
  },
  bookmarkBtn: {
    position: 'absolute',
    top: 7,
    left: 2,  
    zIndex: 10,
    padding: 8,
  },
  bookmarkIcon: {
    fontSize: 26,
    color: UI_COLORS.textLight, 
  },
  bookmarkedIcon: {
    color: UI_COLORS.warning,
  },
  // New: Bottom toggles container for alignment
  bottomToggles: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  // New: Exit button on player card
  exitButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 7,
    padding: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 5,
  },
  exitIcon: {
    fontSize: 24,
    color: UI_COLORS.danger,
    fontWeight: 'bold',
  },
});
