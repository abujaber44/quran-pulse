// src/screens/QuranPlayerScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../context/SettingsContext';
import { fetchSurahs } from '../services/quranApi';
import { getSurahAudioUrl } from '../services/quranApi';

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
  const isDark = settings.isDarkMode;

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

    const query = searchQuery.toLowerCase().trim();
    const filtered = allSurahs.filter((surah) =>
      surah.name_simple.toLowerCase().includes(query) ||
      surah.name_arabic.includes(searchQuery)
    );
    setSurahs(filtered);
  }, [searchQuery, allSurahs]);

  // Auto-scroll to selected surah when it changes
  useEffect(() => {
    if (selectedSurah && flatListRef.current) {
      const index = surahs.findIndex(s => s.id === selectedSurah.id);
      if (index !== -1) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.5, // Center the item
          });
        }, 300);
      }
    }
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
    if (!selectedSurah) {
      return;
    }

    player.setActiveForLockScreen(
      true,
      {
        title: `${selectedSurah.id}. ${selectedSurah.name_simple}`,
        artist: selectedReciter.name,
        albumTitle: 'Quran Pulse',
      },
      {
        showSeekBackward: true,
        showSeekForward: true,
      }
    );
  }, [player, selectedSurah, selectedReciter]);

  // Auto-next when playback reaches end
  useEffect(() => {
    if (playerStatus.didJustFinish) {
      handleNext();
    }
  }, [playerStatus.didJustFinish]);

  // Cleanup lock-screen controls
  useEffect(() => {
    return () => {
      player.clearLockScreenControls();
    };
  }, [player]);

  const loadAndPlayAudio = async () => {
    if (!selectedSurah) return;

    setIsLoading(true);
    try {
      const url = getSurahAudioUrl(selectedReciter.id, selectedSurah.id);
      console.log('🎵 Playing Audio URL:', url);
      player.replace({ uri: url });
      player.play();
    } catch (error) {
      console.error('Audio error:', error);
      Alert.alert('Error', 'Failed to load audio');
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

  const formatTime = (ms: number) => {
    if (!ms) return '0:00';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        <Text style={styles.surahArabic}>{item.name_arabic}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      {/* Reciter Selector */}
      <Text style={styles.title}>Listen to Quran</Text>
      
      <View style={styles.explanation}>
        <Text style={styles.explanationText}>
          Listen to the beautiful recitation of the Quran with your favorite reciters. Let the words of Allah soothe your soul, guide your day, and bring tranquility to your heart.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.reciterSelector}
        onPress={() => setReciterModalVisible(true)}
      >
        <Text style={[styles.reciterLabel, isDark && styles.darkText]}>Reciter</Text>
        <Text style={[styles.selectedReciterText, isDark && styles.darkText]}>
          {selectedReciter.name}
        </Text>
      </TouchableOpacity>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <TextInput
            style={styles.searchInput}
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
                <Text style={styles.clearIcon}>×</Text>
              </View>
            </TouchableWithoutFeedback>
          )}
        </View>
      </View>

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

      {/* Fixed Player at Bottom */}
      {selectedSurah && (
        <View style={[styles.playerContainer, isDark && styles.darkPlayerContainer]}>
          <View style={[styles.playerCard, isDark && styles.darkPlayerCard]}>
            <View style={styles.playerHeader}>
              <Text style={styles.playerAyahNumber}>{selectedSurah.id}</Text>
              <Text style={[styles.playerTitle, isDark && styles.darkText]}>
                Currently Playing
              </Text>
            </View>

            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={(playerStatus.duration || 0) * 1000 || 1}
              value={(playerStatus.currentTime || 0) * 1000}
              onSlidingComplete={seekTo}
              minimumTrackTintColor="#27ae60"
              thumbTintColor="#27ae60"
            />

            <Text style={[styles.timeText, isDark && styles.darkText]}>
              {formatTime((playerStatus.currentTime || 0) * 1000)} / {formatTime((playerStatus.duration || 0) * 1000)}
            </Text>

            <View style={styles.playerControls}>
              <TouchableOpacity onPress={handlePrevious} disabled={selectedSurah.id === 1}>
                <Text style={[
                  styles.controlBtn,
                  selectedSurah.id === 1 && styles.disabledBtn,
                  isDark && styles.darkText
                ]}>
                  ← Prev
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={togglePlayPause}>
                <Text style={styles.playPauseBtn}>
                  {isLoading ? '⏳' : playerStatus.playing ? '⏸' : '▶'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleNext} disabled={selectedSurah.id === 114}>
                <Text style={[
                  styles.controlBtn,
                  selectedSurah.id === 114 && styles.disabledBtn,
                  isDark && styles.darkText
                ]}>
                  Next →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

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
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  darkContainer: { backgroundColor: '#121212' },
  reciterSelector: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reciterLabel: { fontSize: 16, color: '#7f8c8d' },
  selectedReciterText: { fontSize: 18, fontWeight: '600', color: '#2c3e50' },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2c3e50',
  },
  clearButton: { paddingHorizontal: 16 },
  clearIcon: { fontSize: 20, color: '#7f8c8d' },
  surahList: { paddingHorizontal: 16, paddingBottom: 200 },
  surahItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    elevation: 4,
  },
  selectedSurahItem: { backgroundColor: '#e8f5e9' },
  surahNumber: { fontSize: 20, fontWeight: 'bold', color: '#3498db', width: 50, textAlign: 'center' },
  surahEnglish: { fontSize: 18, color: '#2c3e50', fontWeight: '600' },
  surahArabic: { fontFamily: 'AmiriQuran', fontSize: 22, color: '#2c3e50', marginTop: 4 },
  playerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  darkPlayerContainer: { backgroundColor: 'transparent' },
  playerCard: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 12, 
    elevation: 12, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: -6 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 12 
  },
  darkPlayerCard: { backgroundColor: '#1e1e1e' },
  playerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  playerAyahNumber: { fontSize: 20, fontWeight: 'bold', color: '#3498db', marginRight: 12 },
  playerTitle: { fontSize: 13, fontWeight: '600', color: '#2c3e50' },
  slider: { width: '100%', height: 40 },
  timeText: { textAlign: 'center', color: '#7f8c8d', marginVertical: 8 },
  playerControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  controlBtn: { fontSize: 18, color: '#27ae60', fontWeight: '600' },
  disabledBtn: { color: '#bdc3c7' },
  playPauseBtn: { fontSize: 40, color: '#27ae60' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#fff', padding: 20, borderRadius: 16, width: '90%', maxHeight: '80%' },
  reciterModal: { backgroundColor: '#fff', padding: 20, borderRadius: 16, width: '90%', maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  reciterModalItem: { padding: 14, borderBottomWidth: 1, borderColor: '#eee' },
  reciterModalText: { fontSize: 16 },
  modalClose: { textAlign: 'center', padding: 14, color: '#e74c3c', fontWeight: 'bold' },
  darkText: { color: '#fff' },
  explanation: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    marginBottom: 16,
  },
  explanationText: {
    fontSize: 14,
    color: '#2c3e50',
    textAlign: 'center',
    lineHeight: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',          // slightly heavier than 'bold'
    color: '#1a3c34',           // deeper, richer green-teal (Islamic feel)
    textAlign: 'center',
    marginVertical: 20,
    letterSpacing: 0.5,         // subtle spacing for elegance
    fontFamily: 'AmiriQuran',   // if you want Quranic font (optional)
  },
});
