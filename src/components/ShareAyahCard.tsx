import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UI_COLORS, UI_RADII } from '../theme/ui';
import { useLanguage } from '../i18n';
import { fetchShareNote, type ShareIntention } from '../services/aiService';

interface ShareAyahCardProps {
  arabicText: string;
  translation: string;
  verseKey: string;
  surahName: string;
  arabicFontFamily?: string;
}

type ShareTheme = {
  id: string;
  colors: [string, string];
  text: string;
  muted: string;
  accent: string;
  border: string;
};

// Curated card palettes. Colors are explicit (not UI_COLORS) so the captured
// image looks identical regardless of the app's light/dark mode.
const SHARE_THEMES: ShareTheme[] = [
  {
    id: 'night',
    colors: ['#17384d', '#0f2838'],
    text: '#f4f7f9',
    muted: 'rgba(244,247,249,0.72)',
    accent: '#57c7a5',
    border: 'rgba(255,255,255,0.15)',
  },
  {
    id: 'emerald',
    colors: ['#0e4429', '#1a6b3c'],
    text: '#f2fbf5',
    muted: 'rgba(242,251,245,0.75)',
    accent: '#ffd97a',
    border: 'rgba(255,255,255,0.18)',
  },
  {
    id: 'paper',
    colors: ['#faf3e3', '#efe2c6'],
    text: '#4a3520',
    muted: '#7a6a50',
    accent: '#a05e2c',
    border: 'rgba(74,53,32,0.2)',
  },
  {
    id: 'royal',
    colors: ['#231640', '#3b2364'],
    text: '#f3efff',
    muted: 'rgba(243,239,255,0.72)',
    accent: '#e0b95c',
    border: 'rgba(255,255,255,0.16)',
  },
  {
    id: 'minimal',
    colors: ['#ffffff', '#f2f5f6'],
    text: '#1e2a32',
    muted: '#5c6b75',
    accent: '#1f9d55',
    border: 'rgba(30,42,50,0.12)',
  },
];

const INTENTIONS: ShareIntention[] = [
  'comfort',
  'congratulate',
  'condolence',
  'encouragement',
  'gratitude',
];

export default function ShareAyahCard({
  arabicText,
  translation,
  verseKey,
  surahName,
  arabicFontFamily,
}: ShareAyahCardProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const { t, lang } = useLanguage();

  const [theme, setTheme] = useState<ShareTheme>(SHARE_THEMES[0]);
  const [intention, setIntention] = useState<ShareIntention | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [loadingNote, setLoadingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const intentionLabels: Record<ShareIntention, string> = {
    comfort: t.intentComfort,
    congratulate: t.intentCongratulate,
    condolence: t.intentCondolence,
    encouragement: t.intentEncouragement,
    gratitude: t.intentGratitude,
  };

  const generateNote = useCallback(async (selectedIntention: ShareIntention | null) => {
    setLoadingNote(true);
    setNoteError(null);
    try {
      const note = await fetchShareNote({
        surahName,
        verseKey,
        arabicText,
        translation,
        intention: selectedIntention,
        lang,
      });
      if (!mountedRef.current) return;
      setAiNote(note.length > 0 ? note : null);
      if (note.length === 0) setNoteError(t.aiNoteFailed);
    } catch {
      if (!mountedRef.current) return;
      setNoteError(t.aiNoteFailed);
    } finally {
      if (mountedRef.current) setLoadingNote(false);
    }
  }, [surahName, verseKey, arabicText, translation, lang, t.aiNoteFailed]);

  const selectIntention = useCallback((value: ShareIntention) => {
    setIntention((prev) => (prev === value ? null : value));
  }, []);

  const handleShare = useCallback(async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) return;

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `${surahName} ${verseKey}`,
        });
      } else {
        Alert.alert(t.error, 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
  }, [verseKey, surahName, t.error]);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
        <LinearGradient colors={theme.colors} style={styles.card}>
          <View style={[styles.topAccent, { backgroundColor: theme.accent }]} />
          <Text
            style={[
              styles.arabicText,
              { color: theme.text },
              arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
            ]}
          >
            {arabicText}
          </Text>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.translationText, { color: theme.muted }]}>{translation}</Text>

          {aiNote ? (
            <View style={styles.noteWrap}>
              <Text style={[styles.noteSpark, { color: theme.accent }]}>✦</Text>
              <Text style={[styles.noteText, { color: theme.text }]}>{aiNote}</Text>
            </View>
          ) : null}

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Text style={[styles.reference, { color: theme.accent }]}>
              {surahName} — {verseKey}
            </Text>
            <Text style={[styles.branding, { color: theme.muted }]}>Quran Pulse</Text>
          </View>
        </LinearGradient>
      </ViewShot>

      {/* Theme swatches */}
      <View style={styles.swatchRow}>
        {SHARE_THEMES.map((option) => (
          <TouchableOpacity
            key={option.id}
            onPress={() => setTheme(option)}
            style={[
              styles.swatchOuter,
              theme.id === option.id && styles.swatchOuterActive,
            ]}
          >
            <LinearGradient colors={option.colors} style={styles.swatchInner} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Intention chips */}
      <Text style={styles.sectionLabel}>{t.shareIntentionLabel}</Text>
      <View style={styles.chipRow}>
        {INTENTIONS.map((value) => (
          <TouchableOpacity
            key={value}
            onPress={() => selectIntention(value)}
            style={[styles.chip, intention === value && styles.chipActive]}
          >
            <Text style={[styles.chipText, intention === value && styles.chipTextActive]}>
              {intentionLabels[value]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* AI note controls */}
      {aiNote === null ? (
        <TouchableOpacity
          style={styles.aiButton}
          onPress={() => void generateNote(intention)}
          disabled={loadingNote}
          activeOpacity={0.8}
        >
          {loadingNote ? (
            <ActivityIndicator size="small" color={UI_COLORS.white} />
          ) : (
            <Text style={styles.aiButtonText}>{t.aiAddNote}</Text>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.noteControlsRow}>
          <TouchableOpacity
            style={styles.noteControlBtn}
            onPress={() => void generateNote(intention)}
            disabled={loadingNote}
          >
            {loadingNote ? (
              <ActivityIndicator size="small" color={UI_COLORS.accent} />
            ) : (
              <>
                <Ionicons name="refresh" size={15} color={UI_COLORS.accent} />
                <Text style={styles.noteControlText}>{t.aiRegenerateNote}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.noteControlBtn}
            onPress={() => {
              setAiNote(null);
              setNoteError(null);
            }}
            disabled={loadingNote}
          >
            <Ionicons name="close" size={16} color={UI_COLORS.textMuted} />
            <Text style={[styles.noteControlText, { color: UI_COLORS.textMuted }]}>
              {t.aiRemoveNote}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {noteError ? <Text style={styles.errorText}>{noteError}</Text> : null}

      <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.8}>
        <Text style={styles.shareButtonText}>{t.shareAyah}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 28,
    margin: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  topAccent: {
    width: 50,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  arabicText: {
    fontSize: 28,
    lineHeight: 48,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  divider: {
    width: 60,
    height: 1,
    alignSelf: 'center',
    marginVertical: 18,
  },
  translationText: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  noteWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 6,
  },
  noteSpark: {
    fontSize: 13,
    lineHeight: 20,
  },
  noteText: {
    flexShrink: 1,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  reference: {
    fontSize: 12,
    fontWeight: '700',
  },
  branding: {
    fontSize: 11,
    fontWeight: '600',
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 14,
  },
  swatchOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchOuterActive: {
    borderColor: UI_COLORS.accent,
  },
  swatchInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  sectionLabel: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: UI_RADII.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: {
    borderColor: UI_COLORS.accent,
    backgroundColor: 'rgba(45,127,184,0.25)',
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
  },
  chipTextActive: {
    color: UI_COLORS.white,
  },
  aiButton: {
    marginTop: 12,
    backgroundColor: UI_COLORS.accent,
    paddingVertical: 11,
    borderRadius: UI_RADII.sm,
    alignItems: 'center',
  },
  aiButtonText: {
    color: UI_COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  noteControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
  },
  noteControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  noteControlText: {
    fontSize: 13,
    fontWeight: '600',
    color: UI_COLORS.accent,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: UI_COLORS.danger,
    textAlign: 'center',
  },
  shareButton: {
    marginTop: 10,
    backgroundColor: UI_COLORS.primary,
    paddingVertical: 12,
    borderRadius: UI_RADII.sm,
    alignItems: 'center',
  },
  shareButtonText: {
    color: UI_COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
