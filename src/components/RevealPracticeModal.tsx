import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import {
  getReviewSchedule,
  getDueVerseKeys,
  saveQuizResults,
  type QuizAttempt,
} from '../services/memorizationService';
import type { Bookmark } from '../services/bookmarkService';
import { useSettings } from '../context/SettingsContext';
import { resolveArabicFontFamily } from '../theme/fonts';
import { useLanguage } from '../i18n';

interface RevealPracticeModalProps {
  visible: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
}

// Hide-and-reveal recitation practice: show the verse reference and opening
// words, the user recites from memory, reveals, and self-grades. Results feed
// the same spaced-repetition schedule as the AI quiz.
export default function RevealPracticeModal({ visible, onClose, bookmarks }: RevealPracticeModalProps) {
  const { t } = useLanguage();
  const { settings } = useSettings();
  const arabicFontFamily = resolveArabicFontFamily(settings.arabicFontFamily);

  const [ordered, setOrdered] = useState<Bookmark[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<QuizAttempt[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    setRevealed(false);
    setResults([]);
    setFinished(false);

    // Due verses first, then the rest
    getReviewSchedule().then((schedule) => {
      const keys = bookmarks.map((b) => `${b.surahId}:${b.ayahNum}`);
      const due = new Set(getDueVerseKeys(keys, schedule));
      const sorted = [...bookmarks].sort((a, b) => {
        const aDue = due.has(`${a.surahId}:${a.ayahNum}`) ? 0 : 1;
        const bDue = due.has(`${b.surahId}:${b.ayahNum}`) ? 0 : 1;
        return aDue - bDue;
      });
      setOrdered(sorted);
    });
  }, [visible, bookmarks]);

  const current = ordered[index];
  const knownCount = results.filter((r) => r.correct).length;

  const grade = useCallback(
    (correct: boolean) => {
      if (!current) return;
      const attempt: QuizAttempt = {
        verseKey: `${current.surahId}:${current.ayahNum}`,
        correct,
        timestamp: Date.now(),
      };
      const nextResults = [...results, attempt];
      setResults(nextResults);
      if (index + 1 < ordered.length) {
        setIndex(index + 1);
        setRevealed(false);
      } else {
        void saveQuizResults(nextResults);
        setFinished(true);
      }
    },
    [current, results, index, ordered.length]
  );

  const firstWords = current ? current.ayahText.split(/\s+/).slice(0, 4).join(' ') : '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t.practice}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {ordered.length === 0 && (
              <Text style={styles.emptyText}>{t.noVersesToPractice}</Text>
            )}

            {!finished && current && (
              <View>
                <Text style={styles.progressText}>
                  {index + 1} / {ordered.length}
                </Text>

                <View style={styles.verseCard}>
                  <Text style={styles.verseRef}>
                    {current.surahName} · {t.ayah} {current.ayahNum}
                  </Text>
                  <Text
                    style={[styles.arabicHint, arabicFontFamily ? { fontFamily: arabicFontFamily } : null]}
                  >
                    {revealed ? current.ayahText : `${firstWords} …`}
                  </Text>
                  {revealed && !!current.translation && (
                    <Text style={styles.translation}>{current.translation}</Text>
                  )}
                </View>

                {!revealed ? (
                  <TouchableOpacity style={styles.revealButton} onPress={() => setRevealed(true)}>
                    <Text style={styles.revealButtonText}>{t.tapToReveal}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.gradeRow}>
                    <TouchableOpacity style={styles.stillLearningBtn} onPress={() => grade(false)}>
                      <Text style={styles.stillLearningText}>{t.stillLearning}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.knewItBtn} onPress={() => grade(true)}>
                      <Text style={styles.knewItText}>{t.knewIt}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {finished && (
              <View style={styles.centeredState}>
                <Text style={styles.summaryTitle}>{t.practiceComplete}</Text>
                <View style={styles.scoreCard}>
                  <Text style={styles.scoreBig}>
                    {knownCount}/{ordered.length}
                  </Text>
                  <Text style={styles.scoreLabel}>{t.practiceStats}</Text>
                </View>
                <TouchableOpacity style={styles.doneButton} onPress={onClose}>
                  <Text style={styles.doneButtonText}>{t.done}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  container: {
    flex: 1,
    marginTop: 60,
    backgroundColor: UI_COLORS.background,
    borderTopLeftRadius: UI_RADII.xl,
    borderTopRightRadius: UI_RADII.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: UI_COLORS.border,
    backgroundColor: UI_COLORS.surface,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: UI_COLORS.text },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: UI_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 16, color: UI_COLORS.textMuted, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 40 },
  emptyText: {
    fontSize: 15,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
  progressText: {
    fontSize: 13,
    color: UI_COLORS.textMuted,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  verseCard: {
    backgroundColor: UI_COLORS.surface,
    padding: 20,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    marginBottom: 20,
    ...UI_SHADOWS.card,
  },
  verseRef: {
    fontSize: 13,
    color: UI_COLORS.accent,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  arabicHint: {
    fontSize: 24,
    lineHeight: 44,
    color: UI_COLORS.text,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  translation: {
    fontSize: 14,
    lineHeight: 20,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
    marginTop: 14,
  },
  revealButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: UI_RADII.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  revealButtonText: { fontSize: 15, color: UI_COLORS.text, fontWeight: '600' },
  gradeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stillLearningBtn: {
    flex: 1,
    backgroundColor: 'rgba(231,76,60,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.4)',
    borderRadius: UI_RADII.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  stillLearningText: { fontSize: 15, color: UI_COLORS.danger, fontWeight: '700' },
  knewItBtn: {
    flex: 1,
    backgroundColor: 'rgba(31,157,85,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(31,157,85,0.5)',
    borderRadius: UI_RADII.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  knewItText: { fontSize: 15, color: UI_COLORS.primary, fontWeight: '700' },
  centeredState: { alignItems: 'center', paddingTop: 40 },
  summaryTitle: { fontSize: 22, fontWeight: '700', color: UI_COLORS.text, marginBottom: 20 },
  scoreCard: {
    backgroundColor: UI_COLORS.surface,
    padding: 30,
    borderRadius: UI_RADII.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    marginBottom: 20,
    width: '100%',
    ...UI_SHADOWS.card,
  },
  scoreBig: { fontSize: 48, fontWeight: '800', color: UI_COLORS.primary },
  scoreLabel: { fontSize: 16, color: UI_COLORS.text, marginTop: 8, textAlign: 'center' },
  doneButton: {
    backgroundColor: UI_COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: UI_RADII.sm,
  },
  doneButtonText: { color: UI_COLORS.white, fontWeight: '700', fontSize: 15 },
});
