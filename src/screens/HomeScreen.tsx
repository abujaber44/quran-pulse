// src/screens/HomeScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // ← Updated import
import { fetchSurahs } from '../services/quranApi';
import { Surah } from '../types';

export default function HomeScreen({ navigation }: any) {
  const [surahs, setSurahs] = useState<Surah[]>([]);

  useEffect(() => {
    fetchSurahs().then(setSurahs);
  }, []);

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
        {/* Header with Settings in Top-Left */}
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

        <FlatList
          data={surahs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderSurah}
          contentContainerStyle={styles.list}
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
    padding: 10, 
    backgroundColor: '#f9f9f9ff', 
    borderRadius: 25, 
    marginRight: 16,
  },
  settingsIcon: { 
    fontSize: 24, 
    color: '#fff' 
  },
  titleContainer: { flex: 1 },
  title: { 
    fontSize: 36, 
    fontWeight: 'bold', 
    color: '#2c3e50', 
    fontFamily: 'AmiriQuran' 
  },
  subtitle: { 
    fontSize: 18, 
    color: '#7f8c8d', 
    marginTop: 4 
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