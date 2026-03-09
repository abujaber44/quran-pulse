// src/screens/SettingsScreen.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import ScreenIntroTile from '../components/ScreenIntroTile';

const FONT_MIN = 24;
const FONT_MAX = 48;
const FONT_STEP = 2;

const PAUSE_MIN = 3;
const PAUSE_MAX = 8;
const PAUSE_STEP = 1;

export default function SettingsScreen() {
  const { settings, updateSetting } = useSettings();
  const { arabicFontSize, memorizationPause } = settings;

  const resetFontSize = () => {
    void updateSetting('arabicFontSize', FONT_MIN);
  };

  const openAppSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert('Unavailable', 'Could not open app settings on this device.');
    });
  };

  const adjustArabicFontSize = (delta: number) => {
    const next = Math.max(FONT_MIN, Math.min(FONT_MAX, arabicFontSize + delta));
    void updateSetting('arabicFontSize', next);
  };

  const adjustMemorizationPause = (delta: number) => {
    const next = Math.max(PAUSE_MIN, Math.min(PAUSE_MAX, memorizationPause + delta));
    void updateSetting('memorizationPause', next);
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenIntroTile
          title="Settings"
          description="Adjust Arabic text size across Quran screens and set the memorization pause between repeated ayahs."
          style={styles.introTile}
        />

        {/* Arabic Font Size */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Arabic Font Size
          </Text>
          <Text style={styles.helperText}>
            Default is the smallest size. Increase only if you need larger text.
          </Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[styles.stepButton, arabicFontSize <= FONT_MIN && styles.stepButtonDisabled]}
              onPress={() => adjustArabicFontSize(-FONT_STEP)}
              disabled={arabicFontSize <= FONT_MIN}
            >
              <Text style={styles.stepButtonText}>−</Text>
            </TouchableOpacity>

            <View style={styles.valuePill}>
              <Text style={styles.valueText}>{arabicFontSize}</Text>
            </View>

            <TouchableOpacity
              style={[styles.stepButton, arabicFontSize >= FONT_MAX && styles.stepButtonDisabled]}
              onPress={() => adjustArabicFontSize(FONT_STEP)}
              disabled={arabicFontSize >= FONT_MAX}
            >
              <Text style={styles.stepButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.previewBox}>
            <Text
              style={[
                styles.previewArabic,
                {
                  fontSize: Math.max(18, arabicFontSize - 6),
                  lineHeight: Math.round(Math.max(18, arabicFontSize - 6) * 1.35),
                },
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
            </Text>
          </View>
        </View>

        {/* Memorization Pause */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Memorization Pause (seconds)
          </Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[styles.stepButton, memorizationPause <= PAUSE_MIN && styles.stepButtonDisabled]}
              onPress={() => adjustMemorizationPause(-PAUSE_STEP)}
              disabled={memorizationPause <= PAUSE_MIN}
            >
              <Text style={styles.stepButtonText}>−</Text>
            </TouchableOpacity>

            <View style={styles.valuePill}>
              <Text style={styles.valueText}>{memorizationPause}s</Text>
            </View>

            <TouchableOpacity
              style={[styles.stepButton, memorizationPause >= PAUSE_MAX && styles.stepButtonDisabled]}
              onPress={() => adjustMemorizationPause(PAUSE_STEP)}
              disabled={memorizationPause >= PAUSE_MAX}
            >
              <Text style={styles.stepButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>
            Range: {PAUSE_MIN}-{PAUSE_MAX} seconds
          </Text>
        </View>

        {/* Suggestions / quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.actionButton} onPress={resetFontSize}>
            <Text style={styles.actionButtonText}>Reset Font Size to Default</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={openAppSettings}>
            <Text style={styles.actionButtonText}>Open App System Settings</Text>
          </TouchableOpacity>
          <Text style={styles.helperText}>
            Tip: Athan notification on/off controls are available on the Prayer Times screen for each prayer.
          </Text>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI_COLORS.background },
  scroll: { padding: 20, paddingBottom: 42 },
  introTile: {
    marginHorizontal: 0,
    marginBottom: 16,
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
  sectionTitle: { fontSize: 17, fontWeight: '600', color: UI_COLORS.text, marginBottom: 8 },
  valueText: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: UI_COLORS.primary },
  helperText: { fontSize: 13, color: UI_COLORS.textMuted, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  stepperRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepButton: {
    width: 56,
    height: 48,
    borderRadius: UI_RADII.md,
    backgroundColor: UI_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: {
    opacity: 0.35,
  },
  stepButtonText: {
    fontSize: 28,
    lineHeight: 32,
    color: UI_COLORS.white,
    fontWeight: '700',
  },
  valuePill: {
    minWidth: 120,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: UI_RADII.md,
    backgroundColor: UI_COLORS.primarySoft,
    borderWidth: 1,
    borderColor: '#cde9d5',
  },
  previewBox: {
    marginTop: 12,
    width: '100%',
    minHeight: 68,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    borderRadius: UI_RADII.md,
    backgroundColor: UI_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  previewArabic: {
    width: '100%',
    color: UI_COLORS.text,
    textAlign: 'center',
    writingDirection: 'rtl',
    fontFamily: 'AmiriQuran',
  },
  actionButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    fontSize: 15,
    color: UI_COLORS.text,
    textAlign: 'center',
    fontWeight: '600',
  },
});
