// src/screens/AsmaAlHusnaScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSettings } from '../context/SettingsContext';

interface AllahName {
  number: number;
  name: string;
  transliteration: string;
  en: { meaning: string };
}

export default function AsmaAlHusnaScreen() {
  const [names, setNames] = useState<AllahName[]>([]);
  const [filteredNames, setFilteredNames] = useState<AllahName[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { settings } = useSettings();
  const isDark = settings.isDarkMode;

  useEffect(() => {
    fetchNames();
  }, []);

  const fetchNames = async () => {
    try {
      const response = await fetch('https://api.aladhan.com/v1/asmaAlHusna');
      const json = await response.json();
      if (json.code === 200) {
        setNames(json.data);
        setFilteredNames(json.data);
      } else {
        setError('Failed to load Asma Al-Husna');
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Real-time search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredNames(names);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = names.filter((item) => {
      return (
        item.name.includes(searchQuery) ||
        item.transliteration.toLowerCase().includes(query) ||
        item.en.meaning.toLowerCase().includes(query)
      );
    });

    setFilteredNames(filtered);
  }, [searchQuery, names]);

  const clearSearch = () => {
    setSearchQuery('');
  };

  const renderItem = ({ item }: { item: AllahName }) => (
    <View style={[styles.card, isDark && styles.darkCard]}>
      <View style={styles.numberCircle}>
        <Text style={styles.number}>{item.number}</Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.arabicName, { fontSize: settings.arabicFontSize }]}>
          {item.name}
        </Text>
        <Text style={[styles.transliteration, isDark && styles.darkText]}>
          {item.transliteration}
        </Text>
        <Text style={[styles.meaning, isDark && styles.darkText]}>
          {item.en.meaning}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, isDark && styles.darkContainer]}>
        <ActivityIndicator size="large" color="#27ae60" />
        <Text style={[styles.loadingText, isDark && styles.darkText]}>
          Loading Asma Al-Husna...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, isDark && styles.darkContainer]}>
        <Text style={[styles.errorText, isDark && styles.darkText]}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      {/* Search Bar */}
      <Text style={styles.title}>Asma'a Allah Al-Husna</Text>

      <View style={styles.explanation}>
        <Text style={styles.explanationText}>
          Explore the 99 Beautiful Names of Allah — each name a reflection of His perfect attributes. Reflect, remember, and draw closer to your Creator through His divine names.
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchWrapper, isDark && styles.darkSearchWrapper]}>
          <TextInput
            style={[styles.searchInput, isDark && styles.darkText]}
            placeholder="Search by name, transliteration or meaning..."
            placeholderTextColor="#aaa"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {searchQuery.length > 0 && (
            <TouchableWithoutFeedback onPress={clearSearch}>
              <View style={styles.clearButton}>
                <Text style={styles.clearIcon}>×</Text>
              </View>
            </TouchableWithoutFeedback>
          )}
        </View>
      </View>

      {/* List of Names */}
      <FlatList
        data={filteredNames}
        keyExtractor={(item) => item.number.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 10,
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
  },
  darkSearchWrapper: {
    backgroundColor: '#1e1e1e',
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
  list: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginVertical: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  darkCard: {
    backgroundColor: '#1e1e1e',
  },
  numberCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#27ae60',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  number: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  arabicName: {
    fontFamily: 'AmiriQuran',
    fontSize: 28,
    color: '#2c3e50',
    textAlign: 'right',
    marginBottom: 6,
  },
  transliteration: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
    marginBottom: 4,
  },
  meaning: {
    fontSize: 15,
    color: '#34495e',
    lineHeight: 22,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#2c3e50',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
    padding: 20,
  },
  darkText: {
    color: '#fff',
  },
  explanation: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    marginBottom: 16,
  },
  explanationText: {
    fontSize: 14,
    color: '#2c3e50',
    textAlign: 'center',
    lineHeight: 20,
  },
  title: {
  fontSize: 30,
  fontWeight: '700',          // slightly heavier than 'bold'
  color: '#1a3c34',           // deeper, richer green-teal (Islamic feel)
  textAlign: 'center',
  marginVertical: 20,
  letterSpacing: 0.5,         // subtle spacing for elegance
  fontFamily: 'AmiriQuran',   // if you want Quranic font (optional)
},
});