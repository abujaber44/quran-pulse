// src/screens/SurahScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { fetchAyahs, fetchTranslations } from '../services/quranApi';
import { useAudio } from '../context/AudioContext';
import { useSettings } from '../context/SettingsContext';
import { getGlobalAyahNumber } from '../utils/quranUtils';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const reciters = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy' },
  { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary' },
  { id: 'ar.minshawi', name: 'Muhammad Siddiq Al-Minshawi' },
  { id: 'ar.abdulsamad', name: 'Abdul Basit Abdul Samad (Murattal)' },
  { id: 'ar.abdulsamad_mujawwad', name: 'Abdul Basit Abdul Samad (Mujawwad)' },
  { id: 'ar.sudais', name: 'Abdur Rahman As-Sudais' },
  { id: 'ar.shuraym', name: 'Saud Ash-Shuraim' },
  { id: 'ar.maher', name: 'Maher Al Muaiqly' },
  { id: 'ar.ghamdi', name: 'Saad Al Ghamdi' },
  { id: 'ar.shatri', name: 'Abu Bakr Ash-Shatri' },
];

export default function SurahScreen({ route }: any) {
  const { surah, surahs } = route.params;
  const [ayahs, setAyahs] = useState<any[]>([]);
  const [reciterModal, setReciterModal] = useState(false);
  const [rangeModal, setRangeModal] = useState(false);
  const [tempStart, setTempStart] = useState(1);
  const [tempEnd, setTempEnd] = useState(surah.verses_count);
  const [expandedTafseer, setExpandedTafseer] = useState<number | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const ayahRefs = useRef<{ [key: number]: View | null }>({});

  const navigation = useNavigation();

  const {
    playAyah,
    togglePlayPause,
    seekTo,
    currentAyah,
    isPlaying,
    positionMillis,
    durationMillis,
    selectedReciter,
    setReciter,
    repeatMode,
    setRepeatMode,
    repeatRange,
    setRepeatRange,
    memorizationMode,
    toggleMemorizationMode,
    downloadSurah,
    sound,
  } = useAudio();

  const { settings } = useSettings();

  // Stop audio when leaving screen
  useEffect(() => {
    return () => {
      if (sound) {
        sound.stopAsync();
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Load Arabic ayahs + English translations (safe index-based merge)
  useEffect(() => {
    const loadData = async () => {
      try {
        const ayahsData = await fetchAyahs(surah.id);
        const translationsData = await fetchTranslations(surah.id);

        // Since translations come in exact order without verse_number, map by index
        const ayahsWithTranslation = ayahsData.map((ayah: any, index: number) => ({
          ...ayah,
          translation: translationsData[index]?.text || 'Translation not available',
          tafseer: 'Tafseer (detailed explanation) coming soon...',
        }));

        setAyahs(ayahsWithTranslation);
      } catch (error) {
        console.error('Error loading ayahs or translations:', error);
        // Fallback: load Arabic only
        const ayahsData = await fetchAyahs(surah.id);
        setAyahs(ayahsData.map((ayah: any) => ({
          ...ayah,
          translation: 'Translation unavailable (check connection)',
          tafseer: '',
        })));
      }
    };

    loadData();
  }, [surah.id]);

  // Auto-play first ayah if enabled
  useEffect(() => {
    if (settings.autoPlayOnStart && ayahs.length > 0 && !currentAyah) {
      handlePlayAyah(1);
    }
  }, [ayahs.length, settings.autoPlayOnStart]);

  // Auto next ayah (no skipping)
  useEffect(() => {
    if (!currentAyah || currentAyah.surah !== surah.id) return;

    if (durationMillis > 0 && positionMillis >= durationMillis - 300) {
      const timer = setTimeout(() => {
        if (repeatMode === 'range' && repeatRange && currentAyah.ayah === repeatRange.end) {
          const startGlobal = getGlobalAyahNumber(surah.id, repeatRange.start, surahs);
          playAyah(surah.id, repeatRange.start, startGlobal);
        } else if (repeatMode !== 'single' && !memorizationMode && currentAyah.ayah < surah.verses_count) {
          const nextGlobal = currentAyah.global + 1;
          playAyah(surah.id, currentAyah.ayah + 1, nextGlobal);
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [positionMillis, durationMillis, currentAyah, repeatMode, repeatRange, memorizationMode, surah.id, surahs]);

  // Auto-scroll to current ayah
  useEffect(() => {
    if (currentAyah && currentAyah.surah === surah.id) {
      const view = ayahRefs.current[currentAyah.ayah];
      if (view) {
        view.measureLayout(
          scrollRef.current as any,
          (x, y) => {
            scrollRef.current?.scrollTo({
              y: y - 150,
              animated: true,
            });
          },
          () => {}
        );
      }
    }
  }, [currentAyah]);

  const handlePlayAyah = (ayahNum: number) => {
    const global = getGlobalAyahNumber(surah.id, ayahNum, surahs);
    playAyah(surah.id, ayahNum, global);
  };

  const handlePreviousAyah = () => {
    if (currentAyah && currentAyah.ayah > 1) {
      const prevGlobal = currentAyah.global - 1;
      playAyah(surah.id, currentAyah.ayah - 1, prevGlobal);
    }
  };

  const handleNextAyah = () => {
    if (currentAyah && currentAyah.ayah < surah.verses_count) {
      const nextGlobal = currentAyah.global + 1;
      playAyah(surah.id, currentAyah.ayah + 1, nextGlobal);
    }
  };

  const formatTime = (ms: number) => {
    if (!ms) return '0:00';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTafseer = (ayahNum: number) => {
    setExpandedTafseer(expandedTafseer === ayahNum ? null : ayahNum);
  };

  const isDark = settings.isDarkMode;

  return (
    <SafeAreaView style={[styles.safeArea, isDark && styles.darkSafeArea]}>
      <View style={[styles.container, isDark && styles.darkContainer]}>
        {/* Header with Back Button */}
        <View style={[styles.header, isDark && styles.darkHeader]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.titleWrapper}>
            <Text style={[styles.surahArabic, { fontSize: settings.arabicFontSize }]}>{surah.name_arabic}</Text>
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

        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
          {ayahs.map((ayah) => (
            <TouchableOpacity
              key={ayah.verse_number}
              ref={(ref) => (ayahRefs.current[ayah.verse_number] = ref)}
              style={[
                styles.ayahCard,
                isDark && styles.darkAyahCard,
                currentAyah?.surah === surah.id && currentAyah?.ayah === ayah.verse_number && styles.playingCard,
              ]}
              onPress={() => handlePlayAyah(ayah.verse_number)}
            >
              <Text style={[styles.ayahText, { fontSize: settings.arabicFontSize }, isDark && styles.darkText]}>
                {ayah.text_uthmani}
              </Text>

              {/* English Translation */}
              <Text style={[styles.translationText, isDark && styles.darkText]}>
                {ayah.translation || 'Translation not available'}
              </Text>

              {/* Tafseer Toggle */}
              <TouchableOpacity onPress={() => toggleTafseer(ayah.verse_number)} style={styles.tafseerToggleBtn}>
                <Text style={[styles.tafseerToggle, isDark && styles.darkText]}>
                  {expandedTafseer === ayah.verse_number ? '↑ Hide Tafseer' : '↓ Show Tafseer'}
                </Text>
              </TouchableOpacity>

              {/* Expandable Tafseer */}
              {expandedTafseer === ayah.verse_number && (
                <Text style={[styles.tafseerText, isDark && styles.darkText]}>
                  {ayah.tafseer || 'Tafseer (detailed explanation) coming soon...'}
                </Text>
              )}

              <Text style={[styles.ayahNumberBottom, isDark && styles.darkText]}>
                {ayah.verse_number}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 150 }} />
        </ScrollView>

        {/* Player */}
        {currentAyah && currentAyah.surah === surah.id && (
          <View style={[styles.playerContainer, isDark && styles.darkPlayerContainer]}>
            <View style={[styles.playerCard, isDark && styles.darkPlayerCard]}>
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

                <TouchableOpacity onPress={handleNextAyah} disabled={currentAyah.ayah === surah.verses_count}>
                  <Text style={[styles.controlBtn, currentAyah.ayah === surah.verses_count && styles.disabledBtn, isDark && styles.darkText]}>
                    Next →
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

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
                  setRepeatRange({ start: tempStart, end: tempEnd });
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
  safeArea: { flex: 1, backgroundColor: '#2c3e50' },
  darkSafeArea: { backgroundColor: '#121212' },
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  darkContainer: { backgroundColor: '#121212' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2c3e50', paddingVertical: 20, paddingHorizontal: 16 },
  darkHeader: { backgroundColor: '#1e1e1e' },
  backBtn: { padding: 8 },
  backIcon: { fontSize: 28, color: '#fff' },
  titleWrapper: { flex: 1, alignItems: 'center' },
  surahArabic: { fontFamily: 'AmiriQuran', color: '#fff', fontWeight: 'bold' },
  surahEnglish: { color: '#bdc3c7', marginTop: 4 },
  controlsBar: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#ecf0f1', justifyContent: 'space-between' },
  darkControlsBar: { backgroundColor: '#1e1e1e', borderColor: '#333' },
  controlItem: { alignItems: 'center', flex: 1, padding: 10 },
  controlLabel: { fontSize: 12, color: '#7f8c8d' },
  controlValue: { fontSize: 14, fontWeight: '600', color: '#2c3e50', marginTop: 4 },
  activeText: { color: '#27ae60', fontWeight: 'bold' },
  downloadText: { fontSize: 20 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 180 },
  ayahCard: { backgroundColor: '#fff', padding: 28, marginBottom: 16, borderRadius: 20, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, position: 'relative' },
  darkAyahCard: { backgroundColor: '#1e1e1e' },
  playingCard: { backgroundColor: '#e8f5e9', borderLeftWidth: 6, borderLeftColor: '#27ae60' },
  ayahText: { fontFamily: 'AmiriQuran', lineHeight: 72, textAlign: 'right', color: '#2c3e50' },
  ayahNumberBottom: { position: 'absolute', bottom: 12, left: 16, fontSize: 18, color: '#3498db', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, fontWeight: 'bold' },
  playerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 20 },
  darkPlayerContainer: { backgroundColor: 'transparent' },
  playerCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.15, shadowRadius: 12 },
  darkPlayerCard: { backgroundColor: '#1e1e1e' },
  playerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  playerAyahNumber: { fontSize: 28, fontWeight: 'bold', color: '#3498db', marginRight: 12 },
  playerTitle: { fontSize: 18, fontWeight: '600', color: '#2c3e50' },
  slider: { width: '100%', height: 40 },
  timeText: { textAlign: 'center', color: '#7f8c8d', marginVertical: 8 },
  playerControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  controlBtn: { fontSize: 18, color: '#2c3e50', fontWeight: '600' },
  disabledBtn: { color: '#bdc3c7' },
  playPauseBtn: { fontSize: 64, color: '#27ae60' },
  darkText: { color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#fff', padding: 20, borderRadius: 16, width: '90%', maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  modalItem: { padding: 14, borderBottomWidth: 1, borderColor: '#eee' },
  modalItemText: { fontSize: 16 },
  modalClose: { textAlign: 'center', padding: 14, color: '#e74c3c', fontWeight: 'bold' },
  rangePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  rangeBtn: { fontSize: 28, paddingHorizontal: 20 },
  rangeNumber: { fontSize: 24, marginHorizontal: 20 },
  rangeActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  rangeActionBtn: { fontSize: 16, padding: 10 },
  translationText: {
    fontSize: 16,
    lineHeight: 28,
    textAlign: 'left',          // ← Changed from 'right' to 'left'
    color: '#2c3e50',
    marginTop: 12,
    paddingHorizontal: 16,     // Slightly more padding for better look
    fontStyle: 'italic',
  },
  tafseerToggleBtn: {
    marginTop: 12,
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
  },
  tafseerToggle: {
    fontSize: 14,
    color: '#27ae60',
    fontWeight: '600',
  },
  tafseerText: {
    fontSize: 15,
    lineHeight: 26,
    textAlign: 'left',          // ← Also left-aligned for English readability
    color: '#34495e',
    marginTop: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f0f4f8',
    padding: 14,
    borderRadius: 12,
  },
});