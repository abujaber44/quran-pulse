import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchSurahs } from '../services/quranApi';
import { getBookmarks, removeBookmark, updateBookmarkNote, Bookmark, BookmarkTag } from '../services/bookmarkService';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSettings } from '../context/SettingsContext';
import { useThemedAlert } from '../context/ThemedAlertContext';
import { resolveArabicFontFamily } from '../theme/fonts';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import { UI_GLASS } from '../theme/ui';
import GlassBackground from '../components/GlassBackground';
import ScreenIntroTile from '../components/ScreenIntroTile';
import MemorizationQuizModal from '../components/MemorizationQuizModal';
import type { BookmarkForQuiz } from '../services/aiService';
import { useLanguage } from '../i18n';

type RootStackParamList = {
  Surah: {
    surah: any;
    surahs: any[];
    initialAyah: number;
    scrollNonce?: number;
  };
  // Add other routes here if needed
};

export default function BookmarksScreen() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [surahs, setSurahs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<'all' | BookmarkTag>('all');
  const [quizModalVisible, setQuizModalVisible] = useState(false);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { settings } = useSettings();
  const { showAlert } = useThemedAlert();
  const { t } = useLanguage();
  const isDark = settings.isDarkMode;
  const ayahFontSize = Math.max(24, settings.arabicFontSize - 6);
  const arabicFontFamily = resolveArabicFontFamily(settings.arabicFontFamily);

  const getTagLabel = (tag: BookmarkTag) => (tag === 'memorize' ? t.memorize : t.readRecite);
  const visibleBookmarks =
    selectedTag === 'all' ? bookmarks : bookmarks.filter((bookmark) => bookmark.tag === selectedTag);

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    try {
      const [bookmarkData, surahData] = await Promise.all([
        getBookmarks(),
        fetchSurahs(),
      ]);

      // Sort bookmarks by most recent
      bookmarkData.sort((a, b) => b.timestamp - a.timestamp);
      setBookmarks(bookmarkData);
      setSurahs(surahData);
    } catch (error) {
      console.error('Failed to load bookmarks or surahs', error);
      showAlert({
        title: 'Error',
        message: 'Could not load bookmarks',
        variant: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (surahId: number, ayahNum: number) => {
    await removeBookmark(surahId, ayahNum);
    loadData(); // Refresh list
    showAlert({
      title: t.removed,
      message: t.ayahRemovedFromBookmarks,
      variant: 'info',
    });
  };

  const handlePress = (item: Bookmark) => {
    const fullSurah = surahs.find(s => s.id === item.surahId);
    if (!fullSurah) {
      showAlert({
        title: 'Error',
        message: t.couldNotFindSurah,
        variant: 'danger',
      });
      return;
    }

    navigation.navigate('Surah', {
      surah: fullSurah,
      surahs: surahs,
      // Optional: scroll to specific ayah on load
      initialAyah: item.ayahNum,
      scrollNonce: Date.now()
    });
  };

  const renderItem = ({ item }: { item: Bookmark }) => (
    <TouchableOpacity style={styles.card} onPress={() => handlePress(item)}>
      <View style={styles.header}>
        <View>
          <Text style={styles.surahName}>{item.surahName}</Text>
          <Text style={styles.ayahNumber}>{t.ayah} {item.ayahNum}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.tagPill, item.tag === 'memorize' ? styles.tagMemorize : styles.tagRead]}>
            <Text style={styles.tagPillText}>{getTagLabel(item.tag)}</Text>
          </View>
        <TouchableOpacity onPress={() => handleRemove(item.surahId, item.ayahNum)}>
          <Text style={styles.removeText}>{t.remove}</Text>
        </TouchableOpacity>
        </View>
      </View>

      <Text
        style={[
          styles.ayahText,
          { fontSize: ayahFontSize, lineHeight: Math.round(ayahFontSize * 1.6) },
          arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
        ]}
      >
        {item.ayahText}
      </Text>
      <TextInput
        style={styles.noteInput}
        placeholder={t.addNote}
        placeholderTextColor={UI_COLORS.textLight}
        defaultValue={item.note ?? ''}
        onEndEditing={(e) => {
          const text = e.nativeEvent.text.trim();
          void updateBookmarkNote(item.surahId, item.ayahNum, text);
        }}
        multiline
        maxLength={200}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <GlassBackground isDark={isDark}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#27ae60" />
          <Text style={styles.loadingText}>{t.loadingBookmarks}</Text>
        </View>
      </GlassBackground>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <GlassBackground isDark={isDark}>
        <View style={styles.container}>
          <Text style={styles.emptyText}>
            {t.noBookmarks}
          </Text>
        </View>
      </GlassBackground>
    );
  }

  return (
    <GlassBackground isDark={isDark}>
    <View style={styles.container}>
      <ScreenIntroTile
        title={t.bookmarksTitle}
        description={t.bookmarksDescription}
        isDark={isDark}
        style={styles.introTile}
      />
      <View style={styles.filtersRow}>
        <TouchableOpacity
          style={[styles.filterChip, selectedTag === 'all' && styles.filterChipActive]}
          onPress={() => setSelectedTag('all')}
        >
          <Text style={[styles.filterChipText, selectedTag === 'all' && styles.filterChipTextActive]}>
            {t.all}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, selectedTag === 'memorize' && styles.filterChipActive]}
          onPress={() => setSelectedTag('memorize')}
        >
          <Text style={[styles.filterChipText, selectedTag === 'memorize' && styles.filterChipTextActive]}>
            {t.memorize}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, selectedTag === 'read_recite' && styles.filterChipActive]}
          onPress={() => setSelectedTag('read_recite')}
        >
          <Text style={[styles.filterChipText, selectedTag === 'read_recite' && styles.filterChipTextActive]}>
            {t.readRecite}
          </Text>
        </TouchableOpacity>
      </View>

      {selectedTag === 'memorize' && visibleBookmarks.length >= 1 && (
        <TouchableOpacity
          style={styles.coachButton}
          onPress={() => setQuizModalVisible(true)}
        >
          <Text style={styles.coachButtonText}>{t.aiCoach}</Text>
        </TouchableOpacity>
      )}

      {visibleBookmarks.length === 0 ? (
        <Text style={styles.filteredEmptyText}>
          {t.noBookmarksForTag}
        </Text>
      ) : null}
      <FlatList
        data={visibleBookmarks}
        keyExtractor={(item) => `${item.surahId}-${item.ayahNum}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />

      <MemorizationQuizModal
        visible={quizModalVisible}
        onClose={() => setQuizModalVisible(false)}
        bookmarks={bookmarks
          .filter((b) => b.tag === 'memorize')
          .map((b): BookmarkForQuiz => ({
            surahId: b.surahId,
            surahName: b.surahName,
            ayahNum: b.ayahNum,
            ayahText: b.ayahText,
            translation: b.translation,
          }))}
      />
      </View>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  introTile: { marginBottom: 12 },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: {
    backgroundColor: UI_COLORS.primary,
    borderColor: UI_COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
  },
  filterChipTextActive: {
    color: UI_COLORS.white,
  },
  filteredEmptyText: {
    fontSize: 14,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    borderRadius: UI_RADII.lg,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...UI_SHADOWS.card,
  },
  darkCard: {
    backgroundColor: 'rgba(26, 38, 52, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagMemorize: {
    backgroundColor: 'rgba(31,157,85,0.2)',
  },
  tagRead: {
    backgroundColor: 'rgba(45,127,184,0.2)',
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
  },
  surahName: {
    fontSize: 18,
    fontWeight: '600',
    color: UI_COLORS.text,
  },
  ayahNumber: {
    fontSize: 16,
    color: UI_COLORS.accent,
    marginTop: 4,
  },
  removeText: {
    color: UI_COLORS.danger,
    fontWeight: '700',
    fontSize: 14,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  ayahText: {
    fontSize: 26,
    textAlign: 'right',
    color: UI_COLORS.text,
    lineHeight: 42,
  },
  translation: {
    fontSize: 16,
    color: UI_COLORS.text,
    marginTop: 12,
    lineHeight: 24,
  },
  noteInput: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    fontSize: 13,
    color: UI_COLORS.text,
    fontStyle: 'italic',
  },
  darkNoteInput: {
    backgroundColor: 'rgba(26,38,52,0.5)',
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#e0e0e0',
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
    color: UI_COLORS.textMuted,
    marginTop: 100,
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: UI_COLORS.text,
    textAlign: 'center',
  },
  coachButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: UI_COLORS.accent,
    paddingVertical: 14,
    borderRadius: UI_RADII.sm,
    alignItems: 'center',
    ...UI_SHADOWS.card,
  },
  coachButtonText: {
    color: UI_COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  darkText: { color: UI_COLORS.white },
  darkMutedText: { color: '#a8b3bd' },
});
