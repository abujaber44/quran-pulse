// src/screens/SettingsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudio } from '../context/AudioContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';

const SETTINGS_KEY = '@quran_pulse_settings';

export default function SettingsScreen() {
  const { memorizationMode } = useAudio(); // Just to show current state

  const [arabicFontSize, setArabicFontSize] = useState(32);
  const [memorizationPause, setMemorizationPause] = useState(4);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [autoPlayOnStart, setAutoPlayOnStart] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const saved = await AsyncStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const settings = JSON.parse(saved);
          setArabicFontSize(settings.arabicFontSize || 32);
          setMemorizationPause(settings.memorizationPause || 4);
          setIsDarkMode(settings.isDarkMode || false);
          setAutoPlayOnStart(settings.autoPlayOnStart !== false); // default true
        }
      } catch (e) {
        console.warn('Failed to load settings');
      }
    };
    loadSettings();
  }, []);

  // Save settings whenever they change
  useEffect(() => {
    const saveSettings = async () => {
      try {
        const settings = {
          arabicFontSize,
          memorizationPause,
          isDarkMode,
          autoPlayOnStart,
        };
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (e) {
        console.warn('Failed to save settings');
      }
    };
    saveSettings();
  }, [arabicFontSize, memorizationPause, isDarkMode, autoPlayOnStart]);

  // Placeholder for offline downloads (to be implemented later)
  const downloadedSurahs = ['Al-Fatihah', 'Al-Baqarah']; // Example

  const deleteDownload = (surah: string) => {
    Alert.alert('Delete Download', `Remove ${surah} from offline storage?`, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Deleted', `${surah} removed.`) },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, isDarkMode && styles.darkText]}>Settings</Text>

        {/* Arabic Font Size */}
        <View style={[styles.section, isDarkMode && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
            Arabic Font Size
          </Text>
          <Text style={[styles.valueText, isDarkMode && styles.darkText]}>
            {arabicFontSize}
          </Text>
          <Slider
            minimumValue={24}
            maximumValue={48}
            step={2}
            value={arabicFontSize}
            onValueChange={setArabicFontSize}
            minimumTrackTintColor="#27ae60"
            thumbTintColor="#27ae60"
          />
        </View>

        {/* Memorization Pause */}
        <View style={[styles.section, isDarkMode && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
            Memorization Pause (seconds)
          </Text>
          <Text style={[styles.valueText, isDarkMode && styles.darkText]}>
            {memorizationPause}s
          </Text>
          <Slider
            minimumValue={3}
            maximumValue={10}
            step={1}
            value={memorizationPause}
            onValueChange={setMemorizationPause}
            minimumTrackTintColor="#27ae60"
            thumbTintColor="#27ae60"
          />
        </View>

        {/* Theme */}
        <View style={[styles.section, isDarkMode && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
            Dark Mode
          </Text>
          <Switch value={isDarkMode} onValueChange={setIsDarkMode} thumbColor="#27ae60" />
        </View>

        {/* Auto-play on start */}
        <View style={[styles.section, isDarkMode && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
            Auto-play first ayah when opening surah
          </Text>
          <Switch value={autoPlayOnStart} onValueChange={setAutoPlayOnStart} thumbColor="#27ae60" />
        </View>

        {/* Offline Downloads */}
        <View style={[styles.section, isDarkMode && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>
            Offline Downloads
          </Text>
          {downloadedSurahs.length === 0 ? (
            <Text style={[styles.placeholder, isDarkMode && styles.darkText]}>
              No surahs downloaded yet
            </Text>
          ) : (
            downloadedSurahs.map((surah) => (
              <View key={surah} style={styles.downloadItem}>
                <Text style={[styles.downloadText, isDarkMode && styles.darkText]}>{surah}</Text>
                <TouchableOpacity onPress={() => deleteDownload(surah)}>
                  <Text style={styles.deleteBtn}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI_COLORS.background },
  darkContainer: { backgroundColor: UI_COLORS.darkBackground },
  scroll: { padding: 20, paddingBottom: 42 },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 14,
    color: UI_COLORS.primaryDeep,
    letterSpacing: 0.4,
    fontFamily: 'AmiriQuran',
  },
  section: {
    marginBottom: 16,
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    padding: 16,
    ...UI_SHADOWS.card,
  },
  darkSection: {
    backgroundColor: UI_COLORS.darkSurface,
    borderColor: '#30353b',
  },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: UI_COLORS.text, marginBottom: 8 },
  valueText: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 10, color: UI_COLORS.primary },
  placeholder: { fontStyle: 'italic', color: UI_COLORS.textMuted, textAlign: 'center' },
  downloadItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: UI_COLORS.border,
  },
  downloadText: { fontSize: 16, color: UI_COLORS.text },
  deleteBtn: { color: UI_COLORS.danger, fontWeight: '600' },
  darkText: { color: UI_COLORS.white },
});
