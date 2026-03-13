import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchSurahs } from '../services/quranApi';
import { getBookmarks, removeBookmark, Bookmark, BookmarkTag } from '../services/bookmarkService';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSettings } from '../context/SettingsContext';
import { useThemedAlert } from '../context/ThemedAlertContext';
import { resolveArabicFontFamily } from '../theme/fonts';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import ScreenIntroTile from '../components/ScreenIntroTile';

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
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { settings } = useSettings();
  const { showAlert } = useThemedAlert();
  const isDark = settings.isDarkMode;
  const ayahFontSize = Math.max(24, settings.arabicFontSize - 6);
  const arabicFontFamily = resolveArabicFontFamily(settings.arabicFontFamily);

  const getTagLabel = (tag: BookmarkTag) => (tag === 'memorize' ? 'Memorize' : 'Read/Recite');
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
      title: 'Removed',
      message: 'Ayah removed from bookmarks',
      variant: 'info',
    });
  };

  const handlePress = (item: Bookmark) => {
    const fullSurah = surahs.find(s => s.id === item.surahId);
    if (!fullSurah) {
      showAlert({
        title: 'Error',
        message: 'Could not find surah data',
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
    console.log(`Navigating to Surah ${fullSurah.name_simple} at Ayah ${item.ayahNum}`);
  };

  const renderItem = ({ item }: { item: Bookmark }) => (
    <TouchableOpacity style={[styles.card, isDark && styles.darkCard]} onPress={() => handlePress(item)}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.surahName, isDark && styles.darkText]}>{item.surahName}</Text>
          <Text style={styles.ayahNumber}>Ayah {item.ayahNum}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.tagPill, item.tag === 'memorize' ? styles.tagMemorize : styles.tagRead]}>
            <Text style={styles.tagPillText}>{getTagLabel(item.tag)}</Text>
          </View>
        <TouchableOpacity onPress={() => handleRemove(item.surahId, item.ayahNum)}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
        </View>
      </View>

      <Text
        style={[
          styles.ayahText,
          { fontSize: ayahFontSize, lineHeight: Math.round(ayahFontSize * 1.6) },
          arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
          isDark && styles.darkText,
        ]}
      >
        {item.ayahText}
      </Text>
      <Text style={[styles.translation, isDark && styles.darkText]}>{item.translation}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.darkBg]}>
        <ActivityIndicator size="large" color="#27ae60" />
        <Text style={[styles.loadingText, isDark && styles.darkText]}>Loading bookmarks...</Text>
      </SafeAreaView>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.darkBg]}>
        <Text style={[styles.emptyText, isDark && styles.darkMutedText]}>
          No bookmarks yet. Tap ★ on any ayah to save it here.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    //<SafeAreaView style={styles.container}>
    <View style={[styles.container, isDark && styles.darkBg]}>
      <ScreenIntroTile
        title="My Bookmarks"
        description="Your personal collection of cherished ayahs, moments of reflection, and verses that touched your heart. Return here anytime to revisit what inspires and strengthens your connection with the Quran."
        isDark={isDark}
        style={styles.introTile}
      />
      <View style={styles.filtersRow}>
        <TouchableOpacity
          style={[styles.filterChip, selectedTag === 'all' && styles.filterChipActive]}
          onPress={() => setSelectedTag('all')}
        >
          <Text style={[styles.filterChipText, selectedTag === 'all' && styles.filterChipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, selectedTag === 'memorize' && styles.filterChipActive]}
          onPress={() => setSelectedTag('memorize')}
        >
          <Text style={[styles.filterChipText, selectedTag === 'memorize' && styles.filterChipTextActive]}>
            Memorize
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, selectedTag === 'read_recite' && styles.filterChipActive]}
          onPress={() => setSelectedTag('read_recite')}
        >
          <Text style={[styles.filterChipText, selectedTag === 'read_recite' && styles.filterChipTextActive]}>
            Read/Recite
          </Text>
        </TouchableOpacity>
      </View>
      {visibleBookmarks.length === 0 ? (
        <Text style={[styles.filteredEmptyText, isDark && styles.darkMutedText]}>
          No bookmarks found for this tag.
        </Text>
      ) : null}
      <FlatList
        data={visibleBookmarks}
        keyExtractor={(item) => `${item.surahId}-${item.ayahNum}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
      </View>
    //</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI_COLORS.background },
  darkBg: { backgroundColor: UI_COLORS.darkBackground },
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
    borderColor: UI_COLORS.border,
    backgroundColor: UI_COLORS.surface,
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
    backgroundColor: UI_COLORS.surface,
    padding: 20,
    borderRadius: UI_RADII.lg,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...UI_SHADOWS.card,
  },
  darkCard: {
    backgroundColor: UI_COLORS.darkSurface,
    borderColor: '#30353b',
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
    backgroundColor: '#d7efe1',
  },
  tagRead: {
    backgroundColor: '#d6ecfb',
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: UI_COLORS.primaryDeep,
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
  darkText: { color: UI_COLORS.white },
  darkMutedText: { color: '#a8b3bd' },
});
