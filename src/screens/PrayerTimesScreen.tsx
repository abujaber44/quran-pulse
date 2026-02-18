import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../context/SettingsContext';
import debounce from 'lodash.debounce';

interface Prayer {
  name: string;
  time: string;
  enabled: boolean;
}

const CITY_STORAGE_KEY = 'prayer_city';
const PRAYER_PREFS_KEY = 'prayer_athan_prefs';
const DEFAULT_CITY = 'Makkah';

export default function PrayerTimesScreen() {
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [nextPrayer, setNextPrayer] = useState<string>('');
  const [city, setCity] = useState<string>(DEFAULT_CITY);
  const [loading, setLoading] = useState(true);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const { settings } = useSettings();
  const isDark = settings.isDarkMode;

  // Debounced city search for autocomplete using Nominatim
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim().length < 3) {
        setSuggestions([]);
        return;
      }

      setSuggestionsLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`
        );
        const data = await response.json();

        const cityNames = data
          .filter((c: any) => c.address.city || c.address.town)
          .map((c: any) => c.address.city || c.address.town);
        setSuggestions([...new Set(cityNames)] as string[]);
      } catch (err) {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    debouncedSearch(searchInput);
  }, [searchInput, debouncedSearch]);

  useEffect(() => {
    loadSavedData();
    requestPermissions();
  }, []);

  const loadSavedData = async () => {
    try {
      const savedCity = await AsyncStorage.getItem(CITY_STORAGE_KEY);
      const savedPrefs = await AsyncStorage.getItem(PRAYER_PREFS_KEY);

      const cityToUse = savedCity || DEFAULT_CITY;
      setCity(cityToUse);
      setSearchInput(''); // Keep search box empty on load

      let initialPrefs = { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true };
      if (savedPrefs) {
        initialPrefs = JSON.parse(savedPrefs);
      }

      loadPrayerTimes(cityToUse, initialPrefs);
    } catch (err) {
      loadPrayerTimes(DEFAULT_CITY);
    }
  };

  const saveCity = async (newCity: string) => {
    try {
      await AsyncStorage.setItem(CITY_STORAGE_KEY, newCity);
    } catch (err) {
      console.error('Failed to save city', err);
    }
  };

  const savePrayerPrefs = async (prefs: Record<string, boolean>) => {
    try {
      await AsyncStorage.setItem(PRAYER_PREFS_KEY, JSON.stringify(prefs));
    } catch (err) {
      console.error('Failed to save prayer preferences', err);
    }
  };

  const requestPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please enable notifications for Athan alerts');
    }
  };

  const getLocationAndCity = async () => {
    setFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to auto-detect city.');
        setFetchingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const reverse = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverse.length > 0) {
        const place = reverse[0];
        const cityName = place.city || place.region || place.country || DEFAULT_CITY;
        setCity(cityName);
        setSearchInput(''); // Clear search box
        saveCity(cityName);
        loadPrayerTimes(cityName);
      }
    } catch (err) {
      Alert.alert('Location Error', 'Could not detect location. Please enter city manually.');
    } finally {
      setFetchingLocation(false);
    }
  };

  const loadPrayerTimes = async (cityName: string, initialPrefs?: Record<string, boolean>) => {
    setLoading(true);
    try {
      const date = new Date();
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();

      const url = `https://api.aladhan.com/v1/timingsByCity/${day}-${month}-${year}?city=${encodeURIComponent(cityName)}&country=&method=2`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.code === 200 && data.data?.timings) {
        const timings = data.data.timings;
        const prayerList: Prayer[] = [
          { name: 'Fajr', time: timings.Fajr, enabled: initialPrefs?.Fajr ?? true },
          { name: 'Dhuhr', time: timings.Dhuhr, enabled: initialPrefs?.Dhuhr ?? true },
          { name: 'Asr', time: timings.Asr, enabled: initialPrefs?.Asr ?? true },
          { name: 'Maghrib', time: timings.Maghrib, enabled: initialPrefs?.Maghrib ?? true },
          { name: 'Isha', time: timings.Isha, enabled: initialPrefs?.Isha ?? true },
        ];

        setPrayers(prayerList);
        findNextPrayer(prayerList);
        await scheduleAthanNotifications(prayerList);
        setCity(cityName);
      } else {
        Alert.alert(
          'Invalid City',
          `No prayer times found for "${cityName}". Please select a valid city from suggestions or try a major city near you.`
        );
      }
    } catch (err) {
      Alert.alert('Network Error', 'Unable to fetch prayer times. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const findNextPrayer = (prayerList: Prayer[]) => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    for (const prayer of prayerList) {
      const [h, m] = prayer.time.split(':').map(Number);
      const prayerMinutes = h * 60 + m;
      if (prayerMinutes > currentTime) {
        setNextPrayer(prayer.name);
        return;
      }
    }
    setNextPrayer('Fajr (tomorrow)');
  };

  const scheduleAthanNotifications = async (prayerList: Prayer[]) => {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const today = new Date();
    for (const prayer of prayerList) {
      if (!prayer.enabled) continue;

      const [h, m] = prayer.time.split(':').map(Number);
      let triggerDate = new Date(today);
      triggerDate.setHours(h, m, 0, 0);

      if (triggerDate <= today) {
        triggerDate.setDate(triggerDate.getDate() + 1);
      }

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `حان الآن موعد صلاة ${prayer.name}`,
            body: '🕌 اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّداً الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ مَقَاماً مَحْمُوداً الَّذِي وَعَدْتَهُ، إَنَّكَ لَا تُخْلِفُ الْمِيعَادَ',
            sound: 'athan.mp3',
            priority: Notifications.AndroidNotificationPriority.HIGH,
            vibrate: [0, 250, 250, 250],
          },
          trigger: {
            type: 'timeInterval',
            seconds: (triggerDate.getTime() - today.getTime()) / 1000,
            repeats: false,
          },
        });
      } catch (error) {
        console.error(`Failed to schedule ${prayer.name}:`, error);
      }
    }
  };

  const togglePrayer = (index: number) => {
    const updated = [...prayers];
    updated[index].enabled = !updated[index].enabled;
    setPrayers(updated);

    const prefs = updated.reduce((acc, p) => {
      acc[p.name] = p.enabled;
      return acc;
    }, {} as Record<string, boolean>);
    savePrayerPrefs(prefs);

    scheduleAthanNotifications(updated);
  };

  const handleSelectSuggestion = (suggestedCity: string) => {
    setSearchInput(''); // Clear input after selection
    setSuggestions([]);
    loadPrayerTimes(suggestedCity);
  };

  const handleManualUpdate = () => {
    const trimmed = searchInput.trim();
    if (trimmed.length < 3) {
      Alert.alert('Invalid Input', 'Please enter at least 3 characters or select from suggestions.');
      return;
    }

    loadPrayerTimes(trimmed);
  };

  if (loading) {
    return (
      <View style={[styles.center, isDark && styles.darkBg]}>
        <ActivityIndicator size="large" color="#27ae60" />
        <Text style={[styles.loadingText, isDark && styles.darkText]}>
          Loading prayer times for {city}...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header: Athan Times for City */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Prayer Times & Athan</Text>
          
          <View style={styles.explanation}>
            <Text style={styles.explanationText}>
              Stay connected to your daily prayers with accurate athan times, Qibla direction, and reminders. Let each prayer be a moment of peace, gratitude, and renewal in your journey with Allah.
            </Text>
          </View>

          <Text style={[styles.headerTitle, isDark && styles.darkText]}>Athan Times for</Text>
          <Text style={[styles.cityName, isDark && styles.darkText]}>{city}</Text>

          {/* City Search with Autocomplete */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.cityInput}
              placeholder="Search or enter city name..."
              placeholderTextColor="#aaa"
              value={searchInput}
              onChangeText={(text) => {
                setSearchInput(text);
              }}
              autoCapitalize="words"
              autoCorrect={false}
            />

            {/* Suggestions dropdown – always rendered */}
            <View style={styles.suggestionsContainer}>
              {suggestionsLoading ? (
                <Text style={styles.loadingSuggestions}>Searching cities...</Text>
              ) : suggestions.length > 0 ? (
                suggestions.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectSuggestion(item)}
                  >
                    <Text style={styles.suggestionText}>{item}</Text>
                  </TouchableOpacity>
                ))
              ) : null}
            </View>

            {/* Manual update button (optional, for when no suggestions) */}
            {searchInput.trim().length >= 3 && suggestions.length === 0 && !suggestionsLoading && (
              <TouchableOpacity style={styles.updateButton} onPress={handleManualUpdate}>
                <Text style={styles.updateButtonText}>Update City</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* New explanation text between search box and Use My Location */}
        <View style={styles.guideTextContainer}>
          <Text style={styles.guideText}>
            Type a city name above to search and select, or tap "Use My Location" below to auto-detect your city. Prayer times are fetched for major cities worldwide.
          </Text>
        </View>

        {/* Use My Location – entire container is now the button */}
        <TouchableOpacity 
          style={[styles.locationContainer, isDark && styles.darkLocationContainer]}
          onPress={getLocationAndCity}
          disabled={fetchingLocation}
          activeOpacity={0.8}
        >
        <View style={styles.locationInner}>
          <Text style={styles.locationText}>
              {fetchingLocation ? 'Detecting...' : '➤ Use My Location'}
          </Text>
        </View>
        </TouchableOpacity>

        {/* Next Prayer */}
        <Text style={[styles.nextPrayer, isDark && styles.darkText]}>
          Next prayer: <Text style={styles.bold}>{nextPrayer}</Text>
        </Text>

        {/* Prayer Times Cards */}
        {prayers.map((prayer, i) => (
          <View key={i} style={[styles.prayerCard, isDark && styles.darkCard]}>
            <View>
              <Text style={[styles.prayerName, isDark && styles.darkText]}>{prayer.name}</Text>
              <Text style={[styles.prayerTime, isDark && styles.darkText]}>{prayer.time}</Text>
            </View>
            <Switch
              value={prayer.enabled}
              onValueChange={() => togglePrayer(i)}
              trackColor={{ false: '#ccc', true: '#27ae60' }}
              thumbColor={prayer.enabled ? '#fff' : '#f4f3f4'}
            />
          </View>
        ))}

        {/* Note */}
        <Text style={[styles.note, isDark && styles.darkText]}>
          Athan will play at prayer time even if app is closed
        </Text>

        {/* Extra space at bottom */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  darkBg: { backgroundColor: '#121212' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#2c3e50' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headerContainer: { alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 18, color: '#7f8c8d', marginBottom: 4 },
  cityName: { fontSize: 28, fontWeight: 'bold', color: '#2c3e50' },
  changeCityText: { fontSize: 16, color: '#3498db', marginTop: 8, textDecorationLine: 'underline' },
  nextPrayer: { fontSize: 20, textAlign: 'center', marginBottom: 24, color: '#2c3e50' },
  bold: { fontWeight: 'bold', color: '#27ae60' },
  prayerCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 24, 
    borderRadius: 20, 
    marginBottom: 16, 
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  darkCard: { backgroundColor: '#1e1e1e' },
  prayerName: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' },
  prayerTime: { fontSize: 16, color: '#27ae60', fontWeight: '600', marginTop: 4 },
  note: { fontSize: 14, color: '#7f8c8d', textAlign: 'center', marginTop: 24, fontStyle: 'italic' },
  darkText: { color: '#fff' },
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
    fontWeight: '700',
    color: '#1a3c34',
    textAlign: 'center',
    marginVertical: 20,
    letterSpacing: 0.5,
    fontFamily: 'AmiriQuran',
  },
  // Autocomplete styles
  searchContainer: {
    width: '100%',
    marginVertical: 12,
    position: 'relative',
    zIndex: 20,
  },
  cityInput: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2c3e50',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    zIndex: 20,
    maxHeight: 240,
    overflow: 'hidden',
    marginTop: 8,
  },
  suggestionsList: {
    flexGrow: 0,
  },
  suggestionItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  suggestionText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  loadingSuggestions: {
    padding: 16,
    textAlign: 'center',
    color: '#7f8c8d',
    fontSize: 14,
  },
  updateButton: {
    marginTop: 8,
    alignSelf: 'center',
    backgroundColor: '#27ae60',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  guideTextContainer: {
    marginTop: 16,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  guideText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationContainer: {
  alignItems: 'center',
  marginBottom: 24,
  backgroundColor: '#ffffff',
  borderRadius: 20,
  padding: 16,
  elevation: 4,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 6,
  width: '90%',
  alignSelf: 'center',
},
darkLocationContainer: {
  backgroundColor: '#1e1e1e',
},
locationInner: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
},
locationText: {
  fontSize: 16,
  color: '#27ae60',
  fontWeight: '600',
},
});