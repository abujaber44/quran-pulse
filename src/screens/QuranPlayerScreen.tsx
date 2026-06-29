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
import { UI_GLASS } from '../theme/ui';
import GlassBackground from '../components/GlassBackground';
import ScreenIntroTile from '../components/ScreenIntroTile';
import { normalizeArabicForSearch } from '../utils/arabicSearch';
import CompactPlayerCard from '../components/CompactPlayerCard';
import { useLanguage } from '../i18n';

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
  const { t } = useLanguage();
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

  const loadAndPlayAudio = async () => {
    if (!selectedSurah) return;

    setIsLoading(true);
    try {
      const url = getSurahAudioUrl(selectedReciter.id, selectedSurah.id);
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

  // Auto-advance to next surah when playback finishes
  useEffect(() => {
    if (playerStatus.didJustFinish) {
      handleNext();
    }
  }, [playerStatus.didJustFinish, handleNext]);

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
        selectedSurah?.id === item.id && styles.selectedSurahItem,
      ]}
      onPress={() => setSelectedSurah(item)}
    >
      <Text style={styles.surahNumber}>{item.id}</Text>
      <View>
        <Text style={styles.surahEnglish}>{item.name_simple}</Text>
        <Text
          style={[
            styles.surahArabic,
            { fontSize: arabicNameFontSize },
            arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
          ]}
        >
          {item.name_arabic}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <GlassBackground isDark={isDark}>
    <View style={styles.container}>
      <ScreenIntroTile
        title={t.quranPlayerTitle}
        description={t.quranPlayerDesc}
        isDark={isDark}
        style={styles.introTile}
      />

      <TouchableOpacity
        style={styles.reciterSelector}
        onPress={() => setReciterModalVisible(true)}
      >
        <Text style={styles.reciterLabel}>{t.reciter}</Text>
        <Text style={styles.selectedReciterText}>
          {selectedReciter.name}
        </Text>
      </TouchableOpacity>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <TextInput
            style={styles.searchInput}
            placeholder={t.searchSurahs}
            placeholderTextColor="rgba(255,255,255,0.35)"
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

      {/* In-content Player */}
      {selectedSurah && (
        <CompactPlayerCard
          isDark={isDark}
          badgeLabel={String(selectedSurah.id)}
          title={t.nowPlaying}
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
            <Text style={styles.modalTitle}>{t.selectReciter}</Text>
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
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  reciterSelector: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: UI_RADII.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  darkReciterSelector: {
    backgroundColor: 'rgba(26, 38, 52, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  reciterLabel: { fontSize: 16, color: UI_COLORS.textMuted },
  selectedReciterText: { fontSize: 18, fontWeight: '600', color: UI_COLORS.text },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...UI_SHADOWS.input,
  },
  darkSearchWrapper: {
    backgroundColor: 'rgba(26, 38, 52, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    borderRadius: UI_RADII.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderLeftWidth: 5,
    borderLeftColor: UI_COLORS.accent,
    ...UI_SHADOWS.card,
  },
  darkSurahItem: {
    backgroundColor: 'rgba(26, 38, 52, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  selectedSurahItem: { backgroundColor: 'rgba(31,157,85,0.2)', borderColor: 'rgba(31,157,85,0.4)' },
  surahNumber: { fontSize: 20, fontWeight: 'bold', color: UI_COLORS.accent, width: 50, textAlign: 'center' },
  surahEnglish: { fontSize: 18, color: UI_COLORS.text, fontWeight: '600' },
  surahArabic: { fontSize: 22, color: UI_COLORS.text, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: 'rgba(23,56,77,0.95)', padding: 20, borderRadius: UI_RADII.md, width: '90%', maxHeight: '80%' },
  reciterModal: { backgroundColor: 'rgba(23,56,77,0.95)', padding: 20, borderRadius: UI_RADII.md, width: '90%', maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: UI_COLORS.text },
  reciterModalItem: { padding: 14, borderBottomWidth: 1, borderColor: UI_COLORS.border },
  reciterModalText: { fontSize: 16, color: UI_COLORS.text },
  modalClose: { textAlign: 'center', padding: 14, color: UI_COLORS.danger, fontWeight: 'bold' },
  darkText: { color: UI_COLORS.white },
  introTile: { marginBottom: 12 },
});
