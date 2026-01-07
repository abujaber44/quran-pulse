// src/screens/PrayerTimesScreen.tsx
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../context/SettingsContext';

interface Prayer {
  name: string;
  time: string;
  enabled: boolean;
}

const CITY_STORAGE_KEY = 'prayer_city';
const PRAYER_PREFS_KEY = 'prayer_athan_prefs'; // For persisting toggle state
const DEFAULT_CITY = 'Makkah';

export default function PrayerTimesScreen() {
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [nextPrayer, setNextPrayer] = useState<string>('');
  const [city, setCity] = useState<string>(DEFAULT_CITY);
  const [loading, setLoading] = useState(true);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const { settings } = useSettings();
  const isDark = settings.isDarkMode;

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

      if (data.code === 200) {
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
      } else {
        Alert.alert('Not Found', `Could not find prayer times for "${cityName}". Try a nearby major city.`);
      }
    } catch (err) {
      Alert.alert('Network Error', 'Please check your internet connection.');
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

  // Your working notification scheduling (kept exactly as is)
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
            body: '🕌 الله أكبر الله أكبر',
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

    // Save toggle preferences
    const prefs = updated.reduce((acc, p) => {
      acc[p.name] = p.enabled;
      return acc;
    }, {} as Record<string, boolean>);
    savePrayerPrefs(prefs);

    scheduleAthanNotifications(updated);
  };

  const handleCityChange = (newCity: string) => {
    if (newCity.trim()) {
      setCity(newCity.trim());
      saveCity(newCity.trim());
      loadPrayerTimes(newCity.trim());
    }
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
    <KeyboardAvoidingView style={[styles.container, isDark && styles.darkBg]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header: Athan Times for City */}
      <View style={styles.headerContainer}>
        <Text style={[styles.headerTitle, isDark && styles.darkText]}>Athan Times for</Text>
        <Text style={[styles.cityName, isDark && styles.darkText]}>{city}</Text>
        <TouchableOpacity onPress={() => {
          Alert.prompt(
            'Change City',
            'Enter city name:',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Update', onPress: (value?: string) => value && handleCityChange(value) },
            ],
            'plain-text',
            city
          );
        }}>
          <Text style={styles.changeCityText}>Change City</Text>
        </TouchableOpacity>
      </View>

      {/* Use My Location */}
      <TouchableOpacity style={styles.locationBtn} onPress={getLocationAndCity} disabled={fetchingLocation}>
        <Text style={styles.locationText}>
          {fetchingLocation ? 'Detecting location...' : '📍 Use My Location'}
        </Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8f9fa' },
  darkBg: { backgroundColor: '#121212' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#2c3e50' },
  headerContainer: { alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 18, color: '#7f8c8d', marginBottom: 4 },
  cityName: { fontSize: 28, fontWeight: 'bold', color: '#2c3e50' },
  changeCityText: { fontSize: 16, color: '#3498db', marginTop: 8, textDecorationLine: 'underline' },
  locationBtn: { alignItems: 'center', padding: 16, marginBottom: 24 },
  locationText: { fontSize: 16, color: '#3498db', fontWeight: '600' },
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
});