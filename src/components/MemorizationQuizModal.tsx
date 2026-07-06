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
import { useLanguage } from '../i18n';
import { useSettings } from '../context/SettingsContext';
import { resolveArabicFontFamily } from '../theme/fonts';

interface MemorizationQuizModalProps {
  visible: boolean;
  onClose: () => void;
  bookmarks: BookmarkForQuiz[];
}

type QuizState = 'loading' | 'question' | 'feedback' | 'summary' | 'error';

export default function MemorizationQuizModal({
  visible,
  onClose,
  bookmarks,
}: MemorizationQuizModalProps) {
  const { t, lang } = useLanguage();
  const { settings } = useSettings();
  const arabicFontFamily = resolveArabicFontFamily(settings.arabicFontFamily);
  const [state, setState] = useState<QuizState>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [results, setResults] = useState<QuizAttempt[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const loadQuiz = useCallback(async () => {
    setState('loading');
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setResults([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const history = await getQuizHistory();
      const quizQuestions = await getMemorizationQuiz(bookmarks, history, controller.signal, lang);

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
  }, [bookmarks, lang, t]);

  useEffect(() => {
    if (visible && bookmarks.length >= 1) {
      void loadQuiz();
    } else if (visible) {
      // Auto-opened (e.g. from Stats) with no memorize-tagged ayahs yet
      setErrorMessage(t.noVersesToPractice);
      setState('error');
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [visible, loadQuiz, bookmarks.length, t.noVersesToPractice]);

  const handleClose = () => {
    abortRef.current?.abort();
    setState('loading');
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
            {state === 'loading' && (
              <View style={styles.centeredState}>
                <ActivityIndicator size="large" color={UI_COLORS.primary} />
                <Text style={styles.stateText}>{t.generatingQuiz}</Text>
              </View>
            )}

            {state === 'error' && (
              <View style={styles.centeredState}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadQuiz}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
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

                <TouchableOpacity style={styles.retryButton} onPress={loadQuiz}>
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
