// src/screens/BookmarksScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchSurahs } from '../services/quranApi';
import { getBookmarks, removeBookmark, Bookmark } from '../services/bookmarkService';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';

type RootStackParamList = {
  Surah: {
    surah: any;
    surahs: any[];
    initialAyah: number;
  };
  // Add other routes here if needed
};

export default function BookmarksScreen() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [surahs, setSurahs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

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
      Alert.alert('Error', 'Could not load bookmarks');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (surahId: number, ayahNum: number) => {
    await removeBookmark(surahId, ayahNum);
    loadData(); // Refresh list
    Alert.alert('Removed', 'Ayah removed from bookmarks');
  };

  const handlePress = (item: Bookmark) => {
    const fullSurah = surahs.find(s => s.id === item.surahId);
    if (!fullSurah) {
      Alert.alert('Error', 'Could not find surah data');
      return;
    }

    navigation.navigate('Surah', {
      surah: fullSurah,
      surahs: surahs,
      // Optional: scroll to specific ayah on load
      initialAyah: item.ayahNum,
    });
  };

  const renderItem = ({ item }: { item: Bookmark }) => (
    <TouchableOpacity style={styles.card} onPress={() => handlePress(item)}>
      <View style={styles.header}>
        <View>
          <Text style={styles.surahName}>{item.surahName}</Text>
          <Text style={styles.ayahNumber}>Ayah {item.ayahNum}</Text>
        </View>
        <TouchableOpacity onPress={() => handleRemove(item.surahId, item.ayahNum)}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.ayahText}>{item.ayahText}</Text>
      <Text style={styles.translation}>{item.translation}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#27ae60" />
        <Text style={styles.loadingText}>Loading bookmarks...</Text>
      </SafeAreaView>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emptyText}>
          No bookmarks yet. Tap ★ on any ayah to save it here.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    //<SafeAreaView style={styles.container}>
    <View style={styles.container}>
      <Text style={styles.title}>My Bookmarks</Text>
      
            <View style={styles.explanation}>
              <Text style={styles.explanationText}>
                Your personal collection of cherished ayahs, moments of reflection, and verses that touched your heart. Return here anytime to revisit what inspires and strengthens your connection with the Quran.
              </Text>
            </View>
      <FlatList
        data={bookmarks}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
    fontSize: 17,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  ayahText: {
    fontFamily: 'AmiriQuran',
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
  explanation: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: UI_COLORS.primarySoft,
    borderRadius: UI_RADII.sm,
    borderWidth: 1,
    borderColor: '#cde9d5',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  explanationText: {
    fontSize: 14,
    color: UI_COLORS.text,
    textAlign: 'center',
    lineHeight: 21,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: UI_COLORS.primaryDeep,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 14,
    letterSpacing: 0.5,
    fontFamily: 'AmiriQuran',
  },
});
