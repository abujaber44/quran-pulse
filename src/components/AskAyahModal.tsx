import React, { useState, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import { askAboutAyah, type ChatMessage } from '../services/aiService';
import { useLanguage } from '../i18n';

interface AskAyahModalProps {
  visible: boolean;
  onClose: () => void;
  surahName: string;
  ayahNumber: number;
  verseKey: string;
  arabicText: string;
  translation: string;
}

// Suggestions are now derived from t inside the component

export default function AskAyahModal({
  visible,
  onClose,
  surahName,
  ayahNumber,
  verseKey,
  arabicText,
  translation,
}: AskAyahModalProps) {
  const { t, lang } = useLanguage();
  const SUGGESTIONS = [t.whatIsContext, t.explainGrammar, t.whatDoScholarsSay, t.relatedVerses];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setInputText('');
    setLoading(false);
    onClose();
  }, [onClose]);

  const sendQuestion = useCallback(async (question: string) => {
    if (!question.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: question.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const answer = await askAboutAyah({
        surahName,
        ayahNumber,
        verseKey,
        arabicText,
        translation,
        question: question.trim(),
        conversationHistory: messages,
        signal: controller.signal,
        lang,
      });

      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') return;
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: t.couldNotGetResponse },
      ]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [loading, messages, surahName, ayahNumber, verseKey, arabicText, translation]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
    <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
      <Text style={[styles.bubbleText, item.role === 'user' && styles.userBubbleText]}>
        {item.content}
      </Text>
    </View>
  ), []);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>{t.askAboutAyah} {verseKey}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {surahName} — Ayah {ayahNumber}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>✨ {t.askAiAboutAyah}</Text>
              <Text style={styles.emptySubtitle}>
                {t.tafsirGroundedExplanations}
              </Text>
              <View style={styles.suggestionsWrap}>
                {SUGGESTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.suggestionChip}
                    onPress={() => sendQuestion(s)}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(_, i) => String(i)}
              renderItem={renderMessage}
              contentContainerStyle={styles.messageList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              ListFooterComponent={
                loading ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator size="small" color={UI_COLORS.primary} />
                    <Text style={styles.loadingText}>{t.thinking}</Text>
                  </View>
                ) : null
              }
            />
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder={t.askQuestion}
              placeholderTextColor={UI_COLORS.textLight}
              multiline
              maxLength={500}
              editable={!loading}
              onSubmitEditing={() => sendQuestion(inputText)}
              blurOnSubmit
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
              onPress={() => sendQuestion(inputText)}
              disabled={!inputText.trim() || loading}
            >
              <Text style={styles.sendText}>→</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
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
  headerTextWrap: { flex: 1 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: UI_COLORS.textMuted,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: UI_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeText: {
    fontSize: 16,
    color: UI_COLORS.textMuted,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  suggestionsWrap: {
    width: '100%',
    gap: 10,
  },
  suggestionChip: {
    backgroundColor: UI_COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: UI_RADII.sm,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...UI_SHADOWS.input,
  },
  suggestionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  bubble: {
    maxWidth: '85%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: UI_RADII.md,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: UI_COLORS.primary,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...UI_SHADOWS.card,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
    color: UI_COLORS.text,
  },
  userBubbleText: {
    color: UI_COLORS.white,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: UI_COLORS.textMuted,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 32 : 10,
    backgroundColor: UI_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: UI_COLORS.border,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: UI_COLORS.background,
    borderRadius: UI_RADII.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: UI_COLORS.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: UI_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: UI_COLORS.textLight,
  },
  sendText: {
    fontSize: 20,
    color: UI_COLORS.white,
    fontWeight: '700',
  },
});
