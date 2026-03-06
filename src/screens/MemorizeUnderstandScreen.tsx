import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchSurahs } from '../services/quranApi';
import { Surah } from '../types';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';

export default function MemorizeUnderstandScreen({ navigation }: any) {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchSurahs().then((data) => {
      setSurahs(data);
      setFilteredSurahs(data);
    });
  }, []);

  // Real-time search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSurahs(surahs);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = surahs.filter((surah) => {
      return (
        surah.name_simple.toLowerCase().includes(query) ||
        surah.name_arabic.includes(searchQuery)
      );
    });

    setFilteredSurahs(filtered);
  }, [searchQuery, surahs]);

  // Clear search function
  const clearSearch = () => {
    setSearchQuery('');
  };

  const renderSurah = ({ item }: { item: Surah }) => (
    <TouchableOpacity
      style={styles.surahCard}
      onPress={() => navigation.navigate('Surah', { surah: item, surahs })}
    >
      <View style={styles.surahInfo}>
        <Text style={styles.surahNumber}>{item.id}</Text>
        <View>
          <Text style={styles.surahNameEnglish}>{item.name_simple}</Text>
          <Text style={styles.surahNameArabic}>{item.name_arabic}</Text>
        </View>
      </View>
      <Text style={styles.versesCount}>{item.verses_count} verses</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.container}>
        {/* <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate('Landing')}
        >
          <Text style={styles.backIcon}>← Home</Text>
        </TouchableOpacity> */}

        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Memorize & Understand</Text>
            <Text style={styles.subtitle}>Explore the Quran to memorize and reflect</Text>
          </View>
        </View>
        <View style={styles.explanation}>
                <Text style={styles.explanationText}>
                  A dedicated space to memorize and deeply understand the Quran. Listen, read, reflect, and repeat — ayah by ayah — until the words of Allah settle firmly in your heart and mind.
                </Text>
          </View>

        {/* Search Bar with Clear (×) Button */}
        <View style={styles.searchContainer}>
          <View style={styles.searchWrapper}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search Surah (English or Arabic)..."
              placeholderTextColor="#aaa"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Clear Button (×) */}
            {searchQuery.length > 0 && (
              <TouchableWithoutFeedback onPress={clearSearch}>
                <View style={styles.clearButton}>
                  <Text style={styles.clearIcon}>×</Text>
                </View>
              </TouchableWithoutFeedback>
            )}
          </View>
        </View>

        {/* Surahs List */}
        <FlatList
          data={filteredSurahs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderSurah}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: UI_COLORS.background },
  container: { flex: 1, backgroundColor: UI_COLORS.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 18,
  },
  settingsBtn: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingsIcon: {
    fontSize: 24,
    color: '#fff',
  },
  titleContainer: { flex: 1 },
  title: { 
    fontSize: 34, 
    fontWeight: 'bold', 
    color: UI_COLORS.primaryDeep, 
    fontFamily: 'AmiriQuran',
    textAlign: 'center', 
    letterSpacing: 0.4,
  },
  subtitle: { 
    fontSize: 17, 
    color: UI_COLORS.textMuted, 
    marginTop: 4,
    fontStyle: 'italic',
    textAlign: 'center', 
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: UI_COLORS.background,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...UI_SHADOWS.input,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: UI_COLORS.text,
  },
  clearButton: {
    paddingHorizontal: 16,
  },
  clearIcon: {
    fontSize: 20,
    color: UI_COLORS.textMuted,
  },
  featureButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap', // ← Allows wrapping on small screens
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  featureButton: {
    flex: 1,
    minWidth: 140, // Ensures buttons don't get too narrow
    backgroundColor: '#27ae60',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 10,
  },
  featureButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  list: { paddingHorizontal: 16, paddingBottom: 22 },
  surahCard: { 
    backgroundColor: UI_COLORS.surface,
    padding: 20, 
    marginVertical: 8, 
    borderRadius: UI_RADII.lg,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    borderLeftWidth: 5,
    borderLeftColor: UI_COLORS.primary,
    ...UI_SHADOWS.card,
  },
  surahInfo: { flexDirection: 'row', alignItems: 'center' },
  surahNumber: { fontSize: 24, fontWeight: 'bold', color: UI_COLORS.accent, marginRight: 20, width: 50, textAlign: 'center' },
  surahNameEnglish: { fontSize: 16, color: UI_COLORS.text, fontWeight: '600' },
  surahNameArabic: { fontFamily: 'AmiriQuran', fontSize: 24, color: UI_COLORS.text, marginTop: 4 },
  versesCount: { fontSize: 14, color: UI_COLORS.textMuted },
  backButton: { 
    padding: 6, 
    alignSelf: 'flex-start', // ← Align left
    marginTop: 40,
    marginLeft: 16,
    marginBottom: 20, // ← Increased space below so header appears clearly below
  },
  backIcon: { fontSize: 18, color: '#3498db', fontWeight: '600' },
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
});
