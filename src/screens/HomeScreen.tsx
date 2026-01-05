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

export default function HomeScreen({ navigation }: any) {
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header with Settings */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.settingsBtn} 
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>Quran Pulse</Text>
            <Text style={styles.subtitle}>Memorize • Recite • Understand</Text>
          </View>
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

        {/* Feature Buttons */}
        <View style={styles.featureButtonsContainer}>
          {/* Asma Al-Husna Button */}
          <TouchableOpacity
            style={styles.featureButton}
            onPress={() => navigation.navigate('AsmaAlHusna')}
          >
            <Text style={styles.featureButtonText}>Asma Al-Husna</Text>
          </TouchableOpacity>

          {/* Prayer Times Button */}
          <TouchableOpacity
            style={styles.featureButton}
            onPress={() => navigation.navigate('PrayerTimes')}
          >
            <Text style={styles.featureButtonText}>Prayer Times & Athan</Text>
          </TouchableOpacity>
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
  safeArea: { flex: 1, backgroundColor: '#2c3e50' },
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingTop: 20,
    paddingBottom: 20,
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
    fontSize: 36, 
    fontWeight: 'bold', 
    color: '#2c3e50', 
    fontFamily: 'AmiriQuran',
    textAlign: 'center', 
  },
  subtitle: { 
    fontSize: 18, 
    color: '#7f8c8d', 
    marginTop: 4,
    fontStyle: 'italic',
    textAlign: 'center', 
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#f8f9fa',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2c3e50',
  },
  clearButton: {
    paddingHorizontal: 16,
  },
  clearIcon: {
    fontSize: 20,
    color: '#7f8c8d',
  },
  featureButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  featureButton: {
    flex: 1,
    backgroundColor: '#27ae60',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  featureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  list: { paddingHorizontal: 16 },
  surahCard: { 
    backgroundColor: '#fff', 
    padding: 20, 
    marginVertical: 8, 
    borderRadius: 18, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    elevation: 6, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 3 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 6 
  },
  surahInfo: { flexDirection: 'row', alignItems: 'center' },
  surahNumber: { fontSize: 24, fontWeight: 'bold', color: '#3498db', marginRight: 20, width: 50, textAlign: 'center' },
  surahNameEnglish: { fontSize: 18, color: '#2c3e50', fontWeight: '600' },
  surahNameArabic: { fontFamily: 'AmiriQuran', fontSize: 28, color: '#2c3e50', marginTop: 4 },
  versesCount: { fontSize: 14, color: '#7f8c8d' },
});