import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../context/SettingsContext';
import { useThemedAlert } from '../context/ThemedAlertContext';
import { resolveArabicFontFamily } from '../theme/fonts';
import { fetchSurahs } from '../services/quranApi';
import { getSurahAudioUrl } from '../services/quranApi';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import ScreenIntroTile from '../components/ScreenIntroTile';
import { normalizeArabicForSearch } from '../utils/arabicSearch';
import CompactPlayerCard from '../components/CompactPlayerCard';

interface Surah {
  id: number;
  name_simple: string;
  name_arabic: string;
}

interface Reciter {
  id: string;
  name: string;
}

const RECITERS: Reciter[] = [
  { id: 'abdul_baset/mujawwad', name: 'Abdul Basit Mujawwad' },
  { id: 'abdul_baset/murattal', name: 'Abdul Basit Murattal' },
  { id: 'abdurrahmaan_as_sudais/murattal', name: 'Abdurrahmaan As-Sudais' },
  { id: 'abu_bakr_shatri/murattal', name: 'Abu Bakr Ash-Shatri' },
  { id: 'khalil_al_husary/murattal', name: 'Khalil Al-Husary' },
  { id: 'mishari_al_afasy/murattal', name: 'Mishari Al-Afasy' },
  { id: 'siddiq_minshawi/murattal', name: 'Siddiq Al-Minshawi' },
  { id: 'saud_ash-shuraym/murattal', name: 'Saud Ash-Shuraym' },
  { id: 'ahmed_ibn_3ali_al-3ajamy', name: 'Ahmed Ibn 3ali Al-3ajamy' },
  { id: 'maher_almu3aiqly/year1422-1423', name: 'Maher Almu3aiqly' },
  { id: 'yasser_ad-dussary', name: 'Yasser Ad-Dussary' },
];

const SELECTED_RECITER_KEY = 'quran_pulse_selected_reciter';

export default function QuranPlayerScreen() {
  const [allSurahs, setAllSurahs] = useState<Surah[]>([]);
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [selectedReciter, setSelectedReciter] = useState<Reciter>(RECITERS[0]);
  const [reciterModalVisible, setReciterModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const playerStatus = useAudioPlayerStatus(player);

  const { settings } = useSettings();
  const { showAlert } = useThemedAlert();
  const isDark = settings.isDarkMode;
  const arabicNameFontSize = Math.max(18, settings.arabicFontSize - 10);
  const arabicFontFamily = resolveArabicFontFamily(settings.arabicFontFamily);

  const applyLockScreenControls = useCallback((surah: Surah | null) => {
    if (!surah) {
      try {
        player.setActiveForLockScreen(false);
      } catch {
        // Player may already be disposed during teardown.
      }
      return;
    }

    try {
      player.setActiveForLockScreen(
        true,
        {
          title: `${surah.id}. ${surah.name_simple}`,
          artist: selectedReciter.name,
          albumTitle: 'Quran Pulse',
        },
        {
          showSeekBackward: true,
          showSeekForward: true,
        }
      );
    } catch (error) {
      console.warn('Lock screen controls unavailable:', error);
    }
  }, [player, selectedReciter.name]);

  // Load surahs
  useEffect(() => {
    fetchSurahs().then((data) => {
      setAllSurahs(data);
      setSurahs(data);
    });
  }, []);

  // Load saved reciter preference
  useEffect(() => {
    const loadSavedReciter = async () => {
      try {
        const savedId = await AsyncStorage.getItem(SELECTED_RECITER_KEY);
        if (savedId) {
          const savedReciter = RECITERS.find(r => r.id === savedId);
          if (savedReciter) {
            setSelectedReciter(savedReciter);
          }
        }
      } catch (error) {
        console.error('Failed to load saved reciter:', error);
      }
    };
    loadSavedReciter();
  }, []);

  // Save reciter when changed
  useEffect(() => {
    const saveReciter = async () => {
      try {
        await AsyncStorage.setItem(SELECTED_RECITER_KEY, selectedReciter.id);
      } catch (error) {
        console.error('Failed to save reciter:', error);
      }
    };
    saveReciter();
  }, [selectedReciter]);

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSurahs(allSurahs);
      return;
    }

    const query = normalizeArabicForSearch(searchQuery);
    const filtered = allSurahs.filter((surah) =>
      normalizeArabicForSearch(surah.name_simple).includes(query) ||
      normalizeArabicForSearch(surah.name_arabic).includes(query)
    );
    setSurahs(filtered);
  }, [searchQuery, allSurahs]);

  // Auto-scroll to selected surah when it changes
  useEffect(() => {
    if (!selectedSurah || !flatListRef.current) {
      return;
    }

    if (surahs.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      const index = surahs.findIndex(s => s.id === selectedSurah.id);
      if (index < 0 || index >= surahs.length) {
        return;
      }

      try {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5, // Center the item
        });
      } catch {
        // Ignore stale/race scroll requests when list size changes during search.
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedSurah, surahs]);

  // Configure background playback behavior
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
      shouldRouteThroughEarpiece: false,
      allowsRecording: false,
    }).catch((error) => {
      console.error('Failed to configure audio mode:', error);
    });
  }, []);

  // Load and play audio when surah or reciter changes
  useEffect(() => {
    if (selectedSurah) {
      void loadAndPlayAudio();
    }
  }, [selectedSurah, selectedReciter]);

  // Activate lock-screen controls for current surah
  useEffect(() => {
    applyLockScreenControls(selectedSurah);
  }, [applyLockScreenControls, selectedSurah]);

  // Auto-next when playback reaches end
  useEffect(() => {
    if (playerStatus.didJustFinish) {
      handleNext();
    }
  }, [playerStatus.didJustFinish]);

  const loadAndPlayAudio = async () => {
    if (!selectedSurah) return;

    setIsLoading(true);
    try {
      const url = getSurahAudioUrl(selectedReciter.id, selectedSurah.id);
      console.log('🎵 Playing Audio URL:', url);
      player.replace({ uri: url });
      player.play();
      // Re-apply metadata after replacing track to keep lock screen controls active on auto-next.
      applyLockScreenControls(selectedSurah);
    } catch (error) {
      console.error('Audio error:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to load audio',
        variant: 'danger',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayPause = async () => {
    if (!selectedSurah) {
      return;
    }

    if (!playerStatus.isLoaded) {
      await loadAndPlayAudio();
      return;
    }

    if (playerStatus.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handlePrevious = () => {
    if (!selectedSurah) return;
    const index = allSurahs.findIndex(s => s.id === selectedSurah.id);
    if (index > 0) {
      setSelectedSurah(allSurahs[index - 1]);
    }
  };

  const handleNext = () => {
    if (!selectedSurah) return;
    const index = allSurahs.findIndex(s => s.id === selectedSurah.id);
    if (index < allSurahs.length - 1) {
      setSelectedSurah(allSurahs[index + 1]);
    }
  };

  const seekTo = async (value: number) => {
    if (playerStatus.isLoaded) {
      await player.seekTo(value / 1000);
    }
  };

  const closePlayer = () => {
    try {
      player.pause();
    } catch {
      // Ignore stale player state.
    }
    applyLockScreenControls(null);
    setSelectedSurah(null);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const renderReciter = ({ item }: { item: Reciter }) => (
    <TouchableOpacity
      style={styles.reciterModalItem}
      onPress={() => {
        setSelectedReciter(item);
        setReciterModalVisible(false);
      }}
    >
      <Text style={styles.reciterModalText}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderSurah = ({ item }: { item: Surah }) => (
    <TouchableOpacity
      style={[
        styles.surahItem,
        isDark && styles.darkSurahItem,
        selectedSurah?.id === item.id && styles.selectedSurahItem,
      ]}
      onPress={() => setSelectedSurah(item)}
    >
      <Text style={styles.surahNumber}>{item.id}</Text>
      <View>
        <Text style={[styles.surahEnglish, isDark && styles.darkText]}>{item.name_simple}</Text>
        <Text
          style={[
            styles.surahArabic,
            { fontSize: arabicNameFontSize },
            arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
            isDark && styles.darkText,
          ]}
        >
          {item.name_arabic}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <ScreenIntroTile
        title="Listen to Quran"
        description="Listen to the beautiful recitation of the Quran with your favorite reciters. Let the words of Allah soothe your soul, guide your day, and bring tranquility to your heart."
        isDark={isDark}
        style={styles.introTile}
      />

      <TouchableOpacity
        style={[styles.reciterSelector, isDark && styles.darkReciterSelector]}
        onPress={() => setReciterModalVisible(true)}
      >
        <Text style={[styles.reciterLabel, isDark && styles.darkText]}>Reciter</Text>
        <Text style={[styles.selectedReciterText, isDark && styles.darkText]}>
          {selectedReciter.name}
        </Text>
      </TouchableOpacity>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchWrapper, isDark && styles.darkSearchWrapper]}>
          <TextInput
            style={[styles.searchInput, isDark && styles.darkText]}
            placeholder="Search Surah..."
            placeholderTextColor="#aaa"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableWithoutFeedback onPress={clearSearch}>
              <View style={styles.clearButton}>
                <Text style={[styles.clearIcon, isDark && styles.darkText]}>×</Text>
              </View>
            </TouchableWithoutFeedback>
          )}
        </View>
      </View>

      {/* In-content Player */}
      {selectedSurah && (
        <CompactPlayerCard
          isDark={isDark}
          badgeLabel={String(selectedSurah.id)}
          title="Now Playing"
          subtitle={selectedSurah.name_simple}
          currentMs={(playerStatus.currentTime || 0) * 1000}
          durationMs={(playerStatus.duration || 0) * 1000}
          isPlaying={!!playerStatus.playing}
          isBusy={isLoading}
          disablePrev={selectedSurah.id === 1}
          disableNext={selectedSurah.id === 114}
          onPrev={handlePrevious}
          onNext={handleNext}
          onTogglePlay={() => {
            void togglePlayPause();
          }}
          onSeek={(value) => {
            void seekTo(value);
          }}
          onClose={closePlayer}
          layout="inline"
        />
      )}

      {/* Surah List with auto-scroll */}
      <FlatList
        ref={flatListRef}
        data={surahs}
        renderItem={renderSurah}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.surahList}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
      />

      {/* Reciter Modal */}
      <Modal visible={reciterModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.reciterModal}>
            <Text style={styles.modalTitle}>Choose Reciter</Text>
            <FlatList
              data={RECITERS}
              renderItem={renderReciter}
              keyExtractor={(item) => item.id}
            />
            <TouchableOpacity onPress={() => setReciterModalVisible(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI_COLORS.background },
  darkContainer: { backgroundColor: UI_COLORS.darkBackground },
  reciterSelector: {
    padding: 16,
    backgroundColor: UI_COLORS.surface,
    borderBottomWidth: 1,
    borderColor: UI_COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  darkReciterSelector: {
    backgroundColor: UI_COLORS.darkSurface,
    borderColor: '#30353b',
  },
  reciterLabel: { fontSize: 16, color: UI_COLORS.textMuted },
  selectedReciterText: { fontSize: 18, fontWeight: '600', color: UI_COLORS.text },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...UI_SHADOWS.input,
  },
  darkSearchWrapper: {
    backgroundColor: UI_COLORS.darkSurface,
    borderColor: '#30353b',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: UI_COLORS.text,
  },
  clearButton: { paddingHorizontal: 16 },
  clearIcon: { fontSize: 20, color: UI_COLORS.textMuted },
  surahList: { paddingHorizontal: 16, paddingBottom: 12 },
  surahItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI_COLORS.surface,
    padding: 16,
    borderRadius: UI_RADII.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    borderLeftWidth: 5,
    borderLeftColor: UI_COLORS.accent,
    ...UI_SHADOWS.card,
  },
  darkSurahItem: {
    backgroundColor: UI_COLORS.darkSurface,
    borderColor: '#30353b',
  },
  selectedSurahItem: { backgroundColor: UI_COLORS.primarySoft, borderColor: '#bde2c8' },
  surahNumber: { fontSize: 20, fontWeight: 'bold', color: UI_COLORS.accent, width: 50, textAlign: 'center' },
  surahEnglish: { fontSize: 18, color: UI_COLORS.text, fontWeight: '600' },
  surahArabic: { fontSize: 22, color: UI_COLORS.text, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: UI_COLORS.surface, padding: 20, borderRadius: UI_RADII.md, width: '90%', maxHeight: '80%' },
  reciterModal: { backgroundColor: UI_COLORS.surface, padding: 20, borderRadius: UI_RADII.md, width: '90%', maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: UI_COLORS.text },
  reciterModalItem: { padding: 14, borderBottomWidth: 1, borderColor: UI_COLORS.border },
  reciterModalText: { fontSize: 16, color: UI_COLORS.text },
  modalClose: { textAlign: 'center', padding: 14, color: UI_COLORS.danger, fontWeight: 'bold' },
  darkText: { color: UI_COLORS.white },
  introTile: { marginBottom: 12 },
});
