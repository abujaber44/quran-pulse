import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Linking,
} from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { useThemedAlert } from '../context/ThemedAlertContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ARABIC_FONT_OPTIONS, resolveArabicFontFamily } from '../theme/fonts';
import { TRANSLATION_OPTIONS, TAFSIR_OPTIONS } from '../services/quranApi';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import { UI_GLASS } from '../theme/ui';
import GlassBackground from '../components/GlassBackground';
import ScreenIntroTile from '../components/ScreenIntroTile';
import { useLanguage } from '../i18n';
import { getReminderSettings, saveReminderSettings, type ReminderSettings } from '../services/dailyReminderService';
import { getKahfReminderSettings, saveKahfReminderSettings, type KahfReminderSettings } from '../services/fridayKahfService';

const FONT_MIN = 24;
const FONT_MAX = 48;
const FONT_STEP = 2;

const PAUSE_MIN = 3;
const PAUSE_MAX = 8;
const PAUSE_STEP = 1;

export default function SettingsScreen({ navigation }: any) {
  const { settings, updateSetting } = useSettings();
  const { showAlert } = useThemedAlert();
  const { lang, t, setLanguage } = useLanguage();
  const isDark = settings.isDarkMode;
  const { arabicFontSize, memorizationPause, arabicFontFamily } = settings;

  const [reminder, setReminder] = useState<ReminderSettings>({ enabled: false, hour: 20, minute: 0 });
  const [kahfReminder, setKahfReminder] = useState<KahfReminderSettings>({ enabled: true, hour: 9, minute: 0 });

  useEffect(() => {
    getReminderSettings().then(setReminder);
    getKahfReminderSettings().then(setKahfReminder);
  }, []);

  const toggleKahfReminder = async (enabled: boolean) => {
    const updated = { ...kahfReminder, enabled };
    setKahfReminder(updated);
    await saveKahfReminderSettings(updated, lang);
  };

  const adjustKahfHour = async (delta: number) => {
    const newHour = (kahfReminder.hour + delta + 24) % 24;
    const updated = { ...kahfReminder, hour: newHour };
    setKahfReminder(updated);
    if (updated.enabled) await saveKahfReminderSettings(updated, lang);
  };

  const toggleReminder = async (enabled: boolean) => {
    const updated = { ...reminder, enabled };
    setReminder(updated);
    await saveReminderSettings(updated, lang);
  };

  const adjustReminderHour = async (delta: number) => {
    const newHour = (reminder.hour + delta + 24) % 24;
    const updated = { ...reminder, hour: newHour };
    setReminder(updated);
    if (updated.enabled) await saveReminderSettings(updated, lang);
  };

  const formatTime = (h: number, m: number) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const resolvedArabicFontFamily = resolveArabicFontFamily(arabicFontFamily);

  const resetFontSize = () => {
    void updateSetting('arabicFontSize', FONT_MIN);
  };

  const resetArabicFontFamily = () => {
    void updateSetting('arabicFontFamily', ARABIC_FONT_OPTIONS[0].id);
  };

  const openAppSettings = () => {
    Linking.openSettings().catch(() => {
      showAlert({
        title: 'Unavailable',
        message: 'Could not open app settings on this device.',
        variant: 'info',
      });
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

  const adjustTranslation = (delta: number) => {
    const currentIndex = Math.max(
      0,
      TRANSLATION_OPTIONS.findIndex((option) => option.id === settings.translationId)
    );
    const nextIndex =
      (currentIndex + delta + TRANSLATION_OPTIONS.length) % TRANSLATION_OPTIONS.length;
    void updateSetting('translationId', TRANSLATION_OPTIONS[nextIndex].id);
  };

  const adjustTafsir = (delta: number) => {
    const currentIndex = Math.max(
      0,
      TAFSIR_OPTIONS.findIndex((option) => option.slug === settings.tafsirSlug)
    );
    const nextIndex = (currentIndex + delta + TAFSIR_OPTIONS.length) % TAFSIR_OPTIONS.length;
    void updateSetting('tafsirSlug', TAFSIR_OPTIONS[nextIndex].slug);
  };

  const adjustArabicFontFamily = (delta: number) => {
    const currentIndex = Math.max(
      0,
      ARABIC_FONT_OPTIONS.findIndex((option) => option.id === arabicFontFamily)
    );
    const nextIndex =
      (currentIndex + delta + ARABIC_FONT_OPTIONS.length) % ARABIC_FONT_OPTIONS.length;
    void updateSetting('arabicFontFamily', ARABIC_FONT_OPTIONS[nextIndex].id);
  };

  return (
    <GlassBackground isDark={isDark}>
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Long-press the title to reach the hidden diagnostics screens */}
        <TouchableOpacity
          activeOpacity={1}
          delayLongPress={1500}
          onLongPress={() =>
            showAlert({
              title: 'Diagnostics',
              message: 'Hidden developer tools',
              variant: 'info',
              buttons: [
                {
                  text: t.athanDiagnostics,
                  onPress: () => navigation?.navigate?.('AthanDiagnostics'),
                },
                {
                  text: 'Audio Diagnostics',
                  onPress: () => navigation?.navigate?.('AudioDiagnostics'),
                },
                { text: t.cancel, role: 'cancel' },
              ],
            })
          }
        >
        <ScreenIntroTile
          title="Settings"
          description="Adjust Arabic font style and size across Quran screens, and set the memorization pause between repeated ayahs."
          style={styles.introTile}
        />
        </TouchableOpacity>

        {/* Arabic Font Family */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Arabic Font Style</Text>
          <Text style={styles.helperText}>
            Switch between bundled and system Arabic rendering. You can add more font files later.
          </Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity style={styles.stepButton} onPress={() => adjustArabicFontFamily(-1)}>
              <Text style={styles.stepButtonText}>‹</Text>
            </TouchableOpacity>

            <View style={styles.valuePill}>
              <Text style={styles.valueTextSmall}>
                {(() => {
                  const opt = ARABIC_FONT_OPTIONS.find((option) => option.id === arabicFontFamily);
                  return lang === 'ar' ? opt?.labelAr : opt?.label;
                })() || 'Arabic Font'}
              </Text>
            </View>

            <TouchableOpacity style={styles.stepButton} onPress={() => adjustArabicFontFamily(1)}>
              <Text style={styles.stepButtonText}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.previewBox}>
            <Text
              style={[
                styles.previewArabic,
                resolvedArabicFontFamily ? { fontFamily: resolvedArabicFontFamily } : null,
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
            </Text>
          </View>
        </View>

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
                resolvedArabicFontFamily ? { fontFamily: resolvedArabicFontFamily } : null,
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

        {/* Translation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.translationSetting}</Text>
          <Text style={styles.helperText}>{t.translationSettingDesc}</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity style={styles.stepButton} onPress={() => adjustTranslation(-1)}>
              <Text style={styles.stepButtonText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.valuePill}>
              <Text style={styles.valueTextSmall}>
                {(() => {
                  const opt = TRANSLATION_OPTIONS.find((o) => o.id === settings.translationId);
                  return (lang === 'ar' ? opt?.labelAr : opt?.label) ?? '';
                })()}
              </Text>
            </View>
            <TouchableOpacity style={styles.stepButton} onPress={() => adjustTranslation(1)}>
              <Text style={styles.stepButtonText}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tafseer Source */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.tafsirSetting}</Text>
          <Text style={styles.helperText}>{t.tafsirSettingDesc}</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity style={styles.stepButton} onPress={() => adjustTafsir(-1)}>
              <Text style={styles.stepButtonText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.valuePill}>
              <Text style={styles.valueTextSmall}>
                {(() => {
                  const opt = TAFSIR_OPTIONS.find((o) => o.slug === settings.tafsirSlug);
                  return (lang === 'ar' ? opt?.labelAr : opt?.label) ?? '';
                })()}
              </Text>
            </View>
            <TouchableOpacity style={styles.stepButton} onPress={() => adjustTafsir(1)}>
              <Text style={styles.stepButtonText}>›</Text>
            </TouchableOpacity>
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

        {/* Daily Reminder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.dailyReminder}</Text>
          <Text style={styles.helperText}>{t.dailyReminderDesc}</Text>
          <View style={styles.reminderRow}>
            <Switch
              value={reminder.enabled}
              onValueChange={toggleReminder}
              trackColor={{ false: '#ccc', true: '#27ae60' }}
              thumbColor={reminder.enabled ? '#fff' : '#f4f3f4'}
            />
            <Text style={[styles.reminderStatus]}>
              {reminder.enabled ? t.reminderEnabled : t.reminderDisabled}
            </Text>
          </View>
          {reminder.enabled && (
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepButton} onPress={() => adjustReminderHour(-1)}>
                <Text style={styles.stepButtonText}>−</Text>
              </TouchableOpacity>
              <View style={styles.valuePill}>
                <Text style={styles.valueText}>{formatTime(reminder.hour, reminder.minute)}</Text>
              </View>
              <TouchableOpacity style={styles.stepButton} onPress={() => adjustReminderHour(1)}>
                <Text style={styles.stepButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Friday Al-Kahf Reminder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.kahfReminder}</Text>
          <Text style={styles.helperText}>{t.kahfReminderDesc}</Text>
          <View style={styles.reminderRow}>
            <Switch
              value={kahfReminder.enabled}
              onValueChange={toggleKahfReminder}
              trackColor={{ false: '#ccc', true: '#27ae60' }}
              thumbColor={kahfReminder.enabled ? '#fff' : '#f4f3f4'}
            />
            <Text style={[styles.reminderStatus]}>
              {kahfReminder.enabled ? t.reminderEnabled : t.reminderDisabled}
            </Text>
          </View>
          {kahfReminder.enabled && (
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepButton} onPress={() => adjustKahfHour(-1)}>
                <Text style={styles.stepButtonText}>−</Text>
              </TouchableOpacity>
              <View style={styles.valuePill}>
                <Text style={styles.valueText}>{formatTime(kahfReminder.hour, kahfReminder.minute)}</Text>
              </View>
              <TouchableOpacity style={styles.stepButton} onPress={() => adjustKahfHour(1)}>
                <Text style={styles.stepButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Language */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.language}</Text>
          <Text style={styles.helperText}>{t.languageDesc}</Text>
          <View style={styles.languageRow}>
            <TouchableOpacity
              style={[styles.languageOption, lang === 'en' && styles.languageOptionActive]}
              onPress={() => setLanguage('en')}
            >
              <Text style={[styles.languageOptionText, lang === 'en' && styles.languageOptionTextActive]}>
                English
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.languageOption, lang === 'ar' && styles.languageOptionActive]}
              onPress={() => setLanguage('ar')}
            >
              <Text style={[styles.languageOptionText, lang === 'ar' && styles.languageOptionTextActive]}>
                العربية
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Suggestions / quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.quickActions}</Text>
          <TouchableOpacity style={styles.actionButton} onPress={resetFontSize}>
            <Text style={styles.actionButtonText}>Reset Font Size to Default</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={resetArabicFontFamily}>
            <Text style={styles.actionButtonText}>Reset Arabic Font Style</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={openAppSettings}>
            <Text style={styles.actionButtonText}>Open App System Settings</Text>
          </TouchableOpacity>
          <Text style={styles.helperText}>
            Tip: Athan notification on/off controls are available on the Prayer Times screen for each prayer.
          </Text>
          <Text style={styles.helperText}>
            After restarting your phone, open Prayer Times once to refresh the next 7 days of athan notifications.
          </Text>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 42 },
  introTile: {
    marginHorizontal: 0,
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 16,
    ...UI_SHADOWS.card,
  },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: UI_COLORS.text, marginBottom: 8 },
  valueText: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: UI_COLORS.primary },
  valueTextSmall: { fontSize: 17, fontWeight: '700', textAlign: 'center', color: UI_COLORS.primary },
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
    backgroundColor: 'rgba(31,157,85,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(31,157,85,0.3)',
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
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  reminderStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: UI_COLORS.text,
  },
  languageRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  languageOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: UI_RADII.sm,
    borderWidth: 1.5,
    borderColor: UI_COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  languageOptionActive: {
    borderColor: UI_COLORS.primary,
    backgroundColor: 'rgba(31,157,85,0.2)',
  },
  languageOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
  },
  languageOptionTextActive: {
    color: '#5ddb92',
    fontWeight: '700',
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
