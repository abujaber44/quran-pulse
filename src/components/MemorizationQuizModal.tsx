import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import {
  getMemorizationQuiz,
  type QuizQuestion,
  type BookmarkForQuiz,
} from '../services/aiService';
import {
  getQuizHistory,
  saveQuizResults,
  type QuizAttempt,
} from '../services/memorizationService';
import { fetchSurahs, fetchAyahs, fetchJuzs } from '../services/quranApi';
import { useLanguage } from '../i18n';
import { useSettings } from '../context/SettingsContext';
import { resolveArabicFontFamily } from '../theme/fonts';

interface MemorizationQuizModalProps {
  visible: boolean;
  onClose: () => void;
  bookmarks: BookmarkForQuiz[];
}

type QuizState = 'setup' | 'loading' | 'question' | 'feedback' | 'summary' | 'error';
type QuizScope = 'bookmarks' | 'surah' | 'juz';
type VerseRange = { surahId: number; from: number; to: number };

// Large scopes (a whole juz, a long surah) can't be sent to the AI in full —
// sample this many ayahs, in consecutive triplets so "what comes next"
// questions remain possible. Every quiz re-samples, so repeat quizzes on the
// same scope cover different verses.
const MAX_QUIZ_VERSES = 18;
const SAMPLE_WINDOW = 3;

const sampleVerseKeys = (ranges: VerseRange[]): Set<string> => {
  const picked = new Set<string>();
  const total = ranges.reduce((sum, r) => sum + (r.to - r.from + 1), 0);
  if (total <= MAX_QUIZ_VERSES) {
    for (const r of ranges) {
      for (let n = r.from; n <= r.to; n++) picked.add(`${r.surahId}:${n}`);
    }
    return picked;
  }
  let guard = 0;
  while (picked.size < MAX_QUIZ_VERSES && guard++ < 80) {
    const r = ranges[Math.floor(Math.random() * ranges.length)];
    const len = r.to - r.from + 1;
    const start = r.from + Math.floor(Math.random() * Math.max(1, len - SAMPLE_WINDOW + 1));
    for (let n = start; n < start + SAMPLE_WINDOW && n <= r.to; n++) {
      picked.add(`${r.surahId}:${n}`);
    }
  }
  return picked;
};

export default function MemorizationQuizModal({
  visible,
  onClose,
  bookmarks,
}: MemorizationQuizModalProps) {
  const { t, lang } = useLanguage();
  const { settings } = useSettings();
  const arabicFontFamily = resolveArabicFontFamily(settings.arabicFontFamily);
  const [state, setState] = useState<QuizState>('setup');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [results, setResults] = useState<QuizAttempt[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [surahs, setSurahs] = useState<any[]>([]);
  const [pickerMode, setPickerMode] = useState<'surah' | 'juz'>('surah');
  const [selectedSurahId, setSelectedSurahId] = useState<number | null>(null);
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastScopeRef = useRef<QuizScope | null>(null);

  useEffect(() => {
    if (visible) {
      setState('setup');
      setSelectedSurahId(null);
      setSelectedJuz(null);
      lastScopeRef.current = null;
      fetchSurahs().then(setSurahs).catch(() => {});
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [visible]);

  const buildRanges = useCallback(async (scope: QuizScope): Promise<VerseRange[]> => {
    if (scope === 'bookmarks') {
      // Users memorize sequentially: test each bookmarked surah from its
      // start up to the furthest bookmarked ayah.
      const maxBySurah = new Map<number, number>();
      for (const b of bookmarks) {
        maxBySurah.set(b.surahId, Math.max(maxBySurah.get(b.surahId) ?? 0, b.ayahNum));
      }
      return [...maxBySurah.entries()].map(([surahId, to]) => ({ surahId, from: 1, to }));
    }
    if (scope === 'surah' && selectedSurahId) {
      const surah = surahs.find((s: any) => Number(s.id) === selectedSurahId);
      return surah ? [{ surahId: selectedSurahId, from: 1, to: Number(surah.verses_count) }] : [];
    }
    if (scope === 'juz' && selectedJuz) {
      const juzs = await fetchJuzs();
      const juz = (juzs as any[]).find((j) => j.juz_number === selectedJuz);
      if (!juz?.verse_mapping) return [];
      return Object.entries(juz.verse_mapping as Record<string, string>).map(([surahIdStr, range]) => {
        const [from, to] = String(range).split('-').map(Number);
        return { surahId: Number(surahIdStr), from: from || 1, to: to || from || 1 };
      });
    }
    return [];
  }, [bookmarks, selectedSurahId, selectedJuz, surahs]);

  const buildQuizVerses = useCallback(async (scope: QuizScope): Promise<BookmarkForQuiz[]> => {
    const ranges = await buildRanges(scope);
    if (ranges.length === 0) return [];

    const picked = sampleVerseKeys(ranges);
    const surahIds = [...new Set([...picked].map((key) => Number(key.split(':')[0])))];

    const textBySurah = new Map<number, Map<number, string>>();
    for (const surahId of surahIds) {
      const ayahs = await fetchAyahs(surahId);
      textBySurah.set(
        surahId,
        new Map((ayahs as any[]).map((a) => [Number(a.verse_number), a.text_uthmani as string]))
      );
    }

    const items: BookmarkForQuiz[] = [];
    for (const key of picked) {
      const [surahIdStr, ayahStr] = key.split(':');
      const surahId = Number(surahIdStr);
      const ayahNum = Number(ayahStr);
      const ayahText = textBySurah.get(surahId)?.get(ayahNum);
      if (!ayahText) continue;
      const surah = surahs.find((s: any) => Number(s.id) === surahId);
      items.push({
        surahId,
        surahName: surah
          ? (lang === 'ar' ? surah.name_arabic : surah.name_simple)
          : `Surah ${surahId}`,
        ayahNum,
        ayahText,
        translation: '',
      });
    }
    items.sort((a, b) => a.surahId - b.surahId || a.ayahNum - b.ayahNum);
    return items;
  }, [buildRanges, surahs, lang]);

  const startQuiz = useCallback(async (scope: QuizScope) => {
    lastScopeRef.current = scope;
    setState('loading');
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setResults([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const verses = await buildQuizVerses(scope);
      if (verses.length === 0) {
        setErrorMessage(t.couldNotGenerateQuiz);
        setState('error');
        return;
      }

      const history = await getQuizHistory();
      const surahCount = new Set(verses.map((v) => v.surahId)).size;
      const quizQuestions = await getMemorizationQuiz(verses, history, controller.signal, lang, {
        type: scope,
        surahCount,
      });

      if (controller.signal.aborted) return;
      if (quizQuestions.length === 0) {
        setErrorMessage(t.couldNotGenerateQuiz);
        setState('error');
        return;
      }

      setQuestions(quizQuestions);
      setState('question');
    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') return;
      setErrorMessage('Failed to load quiz. Please try again.');
      setState('error');
    }
  }, [buildQuizVerses, lang, t]);

  const retryQuiz = useCallback(() => {
    if (lastScopeRef.current) {
      void startQuiz(lastScopeRef.current);
    } else {
      setState('setup');
    }
  }, [startQuiz]);

  const handleClose = () => {
    abortRef.current?.abort();
    setState('setup');
    onClose();
  };

  const handleAnswer = (answer: string) => {
    if (selectedAnswer !== null) return;

    const question = questions[currentIndex];
    const correct = answer === question.correctAnswer;

    setSelectedAnswer(answer);
    setResults((prev) => [
      ...prev,
      { verseKey: question.verseKey, correct, timestamp: Date.now() },
    ]);
    setState('feedback');
  };

  const handleNext = async () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setState('question');
    } else {
      await saveQuizResults(results);
      setState('summary');
    }
  };

  const currentQuestion = questions[currentIndex];
  const correctCount = results.filter((r) => r.correct).length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t.aiMemorizationCoach}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {state === 'setup' && (
              <View>
                <Text style={styles.setupTitle}>{t.quizSetupTitle}</Text>

                {bookmarks.length > 0 && (
                  <TouchableOpacity
                    style={styles.scopeCard}
                    activeOpacity={0.8}
                    onPress={() => void startQuiz('bookmarks')}
                  >
                    <Text style={styles.scopeCardTitle}>📌 {t.quizMyBookmarks}</Text>
                    <Text style={styles.scopeCardHint}>{t.quizBookmarksHint}</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.setupDivider}>{t.quizChooseScope}</Text>

                <View style={styles.pickerTabs}>
                  <TouchableOpacity
                    style={[styles.pickerTab, pickerMode === 'surah' && styles.pickerTabActive]}
                    onPress={() => setPickerMode('surah')}
                  >
                    <Text style={[styles.pickerTabText, pickerMode === 'surah' && styles.pickerTabTextActive]}>
                      {t.surahTab}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pickerTab, pickerMode === 'juz' && styles.pickerTabActive]}
                    onPress={() => setPickerMode('juz')}
                  >
                    <Text style={[styles.pickerTabText, pickerMode === 'juz' && styles.pickerTabTextActive]}>
                      {t.juz}
                    </Text>
                  </TouchableOpacity>
                </View>

                {pickerMode === 'surah' ? (
                  <ScrollView style={styles.surahList} nestedScrollEnabled>
                    {surahs.map((surah: any) => {
                      const id = Number(surah.id);
                      const isSelected = selectedSurahId === id;
                      return (
                        <TouchableOpacity
                          key={id}
                          style={[styles.surahRow, isSelected && styles.surahRowActive]}
                          onPress={() => setSelectedSurahId(id)}
                        >
                          <Text style={[styles.surahRowText, isSelected && styles.surahRowTextActive]}>
                            {id}. {lang === 'ar' ? surah.name_arabic : surah.name_simple}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <View style={styles.juzGrid}>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((juzNumber) => {
                      const isSelected = selectedJuz === juzNumber;
                      return (
                        <TouchableOpacity
                          key={juzNumber}
                          style={[styles.juzPill, isSelected && styles.juzPillActive]}
                          onPress={() => setSelectedJuz(juzNumber)}
                        >
                          <Text style={[styles.juzPillText, isSelected && styles.juzPillTextActive]}>
                            {juzNumber}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.startButton,
                    !(pickerMode === 'surah' ? selectedSurahId : selectedJuz) && styles.startButtonDisabled,
                  ]}
                  disabled={!(pickerMode === 'surah' ? selectedSurahId : selectedJuz)}
                  onPress={() => void startQuiz(pickerMode)}
                >
                  <Text style={styles.startButtonText}>{t.startQuiz}</Text>
                </TouchableOpacity>
              </View>
            )}

            {state === 'loading' && (
              <View style={styles.centeredState}>
                <ActivityIndicator size="large" color={UI_COLORS.primary} />
                <Text style={styles.stateText}>{t.generatingQuiz}</Text>
              </View>
            )}

            {state === 'error' && (
              <View style={styles.centeredState}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={retryQuiz}>
                  <Text style={styles.retryButtonText}>{t.retry}</Text>
                </TouchableOpacity>
              </View>
            )}

            {(state === 'question' || state === 'feedback') && currentQuestion && (
              <View>
                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>
                    {t.question} {currentIndex + 1} {t.of} {questions.length}
                  </Text>
                  <Text style={styles.scoreText}>
                    {correctCount}/{results.length} {t.correct}
                  </Text>
                </View>

                <View style={styles.questionCard}>
                  <Text style={styles.questionType}>
                    {currentQuestion.type === 'identify_surah'
                      ? t.identifySurah
                      : currentQuestion.type === 'next_ayah'
                        ? t.whatComesNext
                        : currentQuestion.type === 'correct_wording'
                          ? t.chooseWording
                          : t.fillInBlank}
                  </Text>
                  <Text style={styles.questionPrompt}>{currentQuestion.prompt}</Text>
                  {currentQuestion.ayahText ? (
                    <Text
                      style={[
                        styles.questionAyah,
                        arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
                      ]}
                    >
                      {currentQuestion.ayahText}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.optionsWrap}>
                  {currentQuestion.options.map((option) => {
                    const isSelected = selectedAnswer === option;
                    const isCorrect = option === currentQuestion.correctAnswer;
                    const showResult = state === 'feedback';

                    return (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.optionButton,
                          showResult && isCorrect && styles.optionCorrect,
                          showResult && isSelected && !isCorrect && styles.optionWrong,
                        ]}
                        onPress={() => handleAnswer(option)}
                        disabled={state === 'feedback'}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            showResult && isCorrect && styles.optionTextCorrect,
                            showResult && isSelected && !isCorrect && styles.optionTextWrong,
                          ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {state === 'feedback' && (
                  <View style={styles.feedbackWrap}>
                    <Text style={styles.feedbackText}>
                      {selectedAnswer === currentQuestion.correctAnswer
                        ? `✅ ${t.correctAnswer}`
                        : `❌ ${t.incorrectAnswer} ${currentQuestion.correctAnswer}`}
                    </Text>
                    <Text style={styles.feedbackVerse}>
                      {t.verse}: {currentQuestion.verseKey}
                    </Text>
                    <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                      <Text style={styles.nextButtonText}>
                        {currentIndex + 1 < questions.length ? t.nextQuestion : t.seeResults}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {state === 'summary' && (
              <View style={styles.centeredState}>
                <Text style={styles.summaryTitle}>{t.quizComplete}</Text>
                <View style={styles.scoreCard}>
                  <Text style={styles.scoreBig}>
                    {correctCount}/{questions.length}
                  </Text>
                  <Text style={styles.scoreLabel}>
                    {correctCount === questions.length
                      ? t.perfectScore
                      : correctCount >= questions.length * 0.7
                        ? t.greatJob
                        : t.keepPracticing}
                  </Text>
                </View>

                {results.filter((r) => !r.correct).length > 0 && (
                  <View style={styles.weakArea}>
                    <Text style={styles.weakTitle}>{t.reviewVerses}</Text>
                    {[...new Set(results.filter((r) => !r.correct).map((r) => r.verseKey))].map((vk) => (
                        <Text key={vk} style={styles.weakVerse}>
                          • {vk}
                        </Text>
                      ))}
                  </View>
                )}

                <TouchableOpacity style={styles.retryButton} onPress={() => setState('setup')}>
                  <Text style={styles.retryButtonText}>{t.takeAnotherQuiz}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
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
  setupTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: UI_COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  scopeCard: {
    backgroundColor: 'rgba(31,157,85,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(31,157,85,0.35)',
    borderRadius: UI_RADII.lg,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  scopeCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  scopeCardHint: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  setupDivider: {
    fontSize: 13,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 10,
  },
  pickerTabs: {
    flexDirection: 'row',
    borderRadius: UI_RADII.md,
    overflow: 'hidden',
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    marginBottom: 12,
  },
  pickerTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
  },
  pickerTabActive: {
    backgroundColor: UI_COLORS.primary,
  },
  pickerTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
  },
  pickerTabTextActive: {
    color: UI_COLORS.white,
  },
  surahList: {
    maxHeight: 280,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    borderRadius: UI_RADII.md,
    marginBottom: 14,
  },
  surahRow: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: UI_COLORS.border,
  },
  surahRowActive: {
    backgroundColor: 'rgba(31,157,85,0.25)',
  },
  surahRowText: {
    fontSize: 14.5,
    color: UI_COLORS.text,
  },
  surahRowTextActive: {
    fontWeight: '700',
  },
  juzGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 14,
  },
  juzPill: {
    width: 46,
    height: 40,
    borderRadius: UI_RADII.md,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  juzPillActive: {
    backgroundColor: UI_COLORS.primary,
    borderColor: UI_COLORS.primary,
  },
  juzPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: UI_COLORS.text,
  },
  juzPillTextActive: {
    color: UI_COLORS.white,
  },
  startButton: {
    backgroundColor: UI_COLORS.primary,
    borderRadius: UI_RADII.sm,
    paddingVertical: 13,
    alignItems: 'center',
  },
  startButtonDisabled: {
    opacity: 0.4,
  },
  startButtonText: {
    color: UI_COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  centeredState: { alignItems: 'center', paddingTop: 60 },
  stateText: { fontSize: 15, color: UI_COLORS.textMuted, marginTop: 16, fontStyle: 'italic' },
  errorText: { fontSize: 15, color: UI_COLORS.danger, textAlign: 'center', marginBottom: 16 },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  progressText: { fontSize: 13, color: UI_COLORS.textMuted, fontWeight: '600' },
  scoreText: { fontSize: 13, color: UI_COLORS.primary, fontWeight: '600' },
  questionCard: {
    backgroundColor: UI_COLORS.surface,
    padding: 20,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    marginBottom: 20,
    ...UI_SHADOWS.card,
  },
  questionType: { fontSize: 13, color: UI_COLORS.accent, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  questionPrompt: { fontSize: 16, lineHeight: 26, color: UI_COLORS.text, textAlign: 'center' },
  questionAyah: {
    fontSize: 21,
    lineHeight: 38,
    color: UI_COLORS.text,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 12,
  },
  optionsWrap: { gap: 10 },
  optionButton: {
    backgroundColor: UI_COLORS.surface,
    padding: 16,
    borderRadius: UI_RADII.sm,
    borderWidth: 1.5,
    borderColor: UI_COLORS.border,
  },
  optionText: { fontSize: 15, color: UI_COLORS.text, textAlign: 'center' },
  optionCorrect: { borderColor: UI_COLORS.primary, backgroundColor: 'rgba(31,157,85,0.2)' },
  optionTextCorrect: { color: UI_COLORS.primaryDeep, fontWeight: '700' },
  optionWrong: { borderColor: UI_COLORS.danger, backgroundColor: 'rgba(231,76,60,0.15)' },
  optionTextWrong: { color: UI_COLORS.danger, fontWeight: '700' },
  feedbackWrap: { marginTop: 20, alignItems: 'center' },
  feedbackText: { fontSize: 16, fontWeight: '700', color: UI_COLORS.text, marginBottom: 4 },
  feedbackVerse: { fontSize: 13, color: UI_COLORS.textMuted, marginBottom: 16 },
  nextButton: {
    backgroundColor: UI_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: UI_RADII.sm,
  },
  nextButtonText: { color: UI_COLORS.white, fontWeight: '700', fontSize: 15 },
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
  weakArea: {
    backgroundColor: 'rgba(201,165,78,0.15)',
    padding: 16,
    borderRadius: UI_RADII.sm,
    width: '100%',
    marginBottom: 20,
  },
  weakTitle: { fontSize: 14, fontWeight: '700', color: UI_COLORS.text, marginBottom: 8 },
  weakVerse: { fontSize: 14, color: UI_COLORS.textMuted, marginBottom: 4 },
  retryButton: {
    backgroundColor: UI_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: UI_RADII.sm,
    marginBottom: 12,
  },
  retryButtonText: { color: UI_COLORS.white, fontWeight: '700', fontSize: 15 },
  doneButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  doneButtonText: { color: UI_COLORS.textMuted, fontWeight: '600', fontSize: 15 },
});
