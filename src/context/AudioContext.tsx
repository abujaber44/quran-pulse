// src/context/AudioContext.tsx
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import { getReciter, saveReciter } from '../services/storage';
import { getGlobalAyahNumber } from '../utils/quranUtils';
import { useSettings } from './SettingsContext';

interface Reciter {
  id: string;
  name: string;
}

const reciters = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy' },
  { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary' },
  { id: 'ar.minshawi', name: 'Muhammad Siddiq Al-Minshawi' },
  { id: 'ar.muhammadayyoub', name: 'Muhammad Ayyoub' },
  { id: 'ar.mahermuaiqly', name: 'Maher Al Muaiqly' },
  { id: 'ar.shaatree', name: 'Abu Bakr Ash-Shatri' },
  { id: 'ar.ahmedajamy', name: 'Ahmed ibn Ali al-Ajamy' },
];

const BASE_URL = 'https://cdn.islamic.network/quran/audio/128';

interface AudioContextType {
  currentAyah: { surah: number; ayah: number; global: number } | null;
  sound: Audio.Sound | null;
  selectedReciter: Reciter;
  repeatMode: 'none' | 'single' | 'range';
  repeatRange: { start: number; end: number } | null;
  memorizationMode: boolean;
  playAyah: (surah: number, ayah: number, global: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (millis: number) => Promise<void>;
  setReciter: (reciter: Reciter) => Promise<void>;
  setRepeatMode: (mode: 'none' | 'single' | 'range') => void;
  setRepeatRange: (start: number, end: number) => void;
  toggleMemorizationMode: () => void;
  downloadSurah: (surahId: number, totalVerses: number, surahs: any[]) => Promise<void>;
  stopListening: () => Promise<void>; // ← New: exit listening mode
}

interface AudioProgressContextType {
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);
const AudioProgressContext = createContext<AudioProgressContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [currentAyah, setCurrentAyah] = useState<{ surah: number; ayah: number; global: number } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [selectedReciter, setSelectedReciter] = useState<Reciter>(reciters[0]);
  const [repeatMode, setRepeatMode] = useState<'none' | 'single' | 'range'>('none');
  const [repeatRange, setRepeatRangeState] = useState<{ start: number; end: number } | null>(null);
  const setRepeatRange = useCallback((start: number, end: number) => setRepeatRangeState({ start, end }), []);
  const [memorizationMode, setMemorizationMode] = useState(false);

  const { settings } = useSettings();

  const toggleMemorizationMode = useCallback(() => setMemorizationMode(prev => !prev), []);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      interruptionModeIOS: 1,
      interruptionModeAndroid: 1,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true, // ← Enable background playback
    }).catch(e => console.warn('Audio mode setup failed:', e));
  }, []);

  useEffect(() => {
    const loadSavedReciter = async () => {
      try {
        const id = await getReciter();
        const rec = reciters.find(r => r.id === id) || reciters[0];
        setSelectedReciter(rec);
      } catch (e) {
        console.warn('Failed to load saved reciter');
      }
    };
    loadSavedReciter();
  }, []);

  const playAyah = useCallback(async (surah: number, ayah: number, global: number) => {
    console.log('playAyah called for:', { surah, ayah, global });

    if (sound) {
      await sound.unloadAsync();
    }

    try {
      const uri = `${BASE_URL}/${selectedReciter.id}/${global}.mp3`;
      console.log('Loading audio from:', uri);

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPositionMillis(status.positionMillis ?? 0);
          setDurationMillis(status.durationMillis ?? 0);
          setIsPlaying(status.isPlaying);

          if (status.didJustFinish) {
            console.log('Ayah finished');
            if (repeatMode === 'single') {
              newSound.replayAsync();
            } else if (memorizationMode) {
              setTimeout(() => {
                newSound.setPositionAsync(0);
                newSound.playAsync();
              }, settings.memorizationPause * 1000);
            }
          }
        }
      });

      setSound(newSound);
      setCurrentAyah({ surah, ayah, global });
    } catch (error) {
      console.error('Failed to play ayah:', error);
      Alert.alert('Audio Error', 'Could not play the recitation. Please check your internet connection.');
    }
  }, [memorizationMode, repeatMode, selectedReciter.id, settings.memorizationPause, sound]);

  const togglePlayPause = useCallback(async () => {
    if (sound) {
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await sound.pauseAsync();
        return;
      }
      await sound.playAsync();
    }
  }, [sound]);

  const seekTo = useCallback(async (millis: number) => {
    if (sound) {
      await sound.setPositionAsync(millis);
    }
  }, [sound]);

  const setReciter = useCallback(async (reciter: Reciter) => {
    setSelectedReciter(reciter);
    await saveReciter(reciter.id);
    if (currentAyah) {
      await playAyah(currentAyah.surah, currentAyah.ayah, currentAyah.global);
    }
  }, [currentAyah, playAyah]);

  const downloadSurah = useCallback(async (surahId: number, totalVerses: number, surahs: any[]) => {
    Alert.alert('Coming Soon', 'Offline download feature will be added in the next update.');
  }, []);

  // New: Stop listening and clear state
  const stopListening = useCallback(async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
    }
    setSound(null);
    setIsPlaying(false);
    setCurrentAyah(null);
    setPositionMillis(0);
    setDurationMillis(0);
  }, [sound]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const audioValue = useMemo<AudioContextType>(() => ({
    currentAyah,
    sound,
    selectedReciter,
    repeatMode,
    repeatRange,
    memorizationMode,
    playAyah,
    togglePlayPause,
    seekTo,
    setReciter,
    setRepeatMode,
    setRepeatRange,
    toggleMemorizationMode,
    downloadSurah,
    stopListening, // ← Exposed to all screens
  }), [
    currentAyah,
    sound,
    selectedReciter,
    repeatMode,
    repeatRange,
    memorizationMode,
    playAyah,
    togglePlayPause,
    seekTo,
    setReciter,
    setRepeatRange,
    toggleMemorizationMode,
    downloadSurah,
    stopListening,
  ]);

  const audioProgressValue = useMemo<AudioProgressContextType>(() => ({
    isPlaying,
    positionMillis,
    durationMillis,
  }), [isPlaying, positionMillis, durationMillis]);

  return (
    <AudioContext.Provider value={audioValue}>
      <AudioProgressContext.Provider value={audioProgressValue}>
        {children}
      </AudioProgressContext.Provider>
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}

export function useAudioProgress() {
  const context = useContext(AudioProgressContext);
  if (!context) {
    throw new Error('useAudioProgress must be used within an AudioProvider');
  }
  return context;
}
