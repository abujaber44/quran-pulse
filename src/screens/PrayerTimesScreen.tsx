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

const PRAYER_STORAGE_KEY = 'prayer_city';
const DEFAULT_CITY = 'Makkah';

export default function PrayerTimesScreen() {
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [nextPrayer, setNextPrayer] = useState<string>('');
  const [city, setCity] = useState<string>(DEFAULT_CITY);
  const [loading, setLoading] = useState(true);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const { settings } = useSettings();
  const isDark = settings.isDarkMode;

  // Load saved city on mount
  useEffect(() => {
    loadSavedCity();
    requestPermissions();
  }, []);

  const loadSavedCity = async () => {
    try {
      const saved = await AsyncStorage.getItem(PRAYER_STORAGE_KEY);
      if (saved) {
        setCity(saved);
        loadPrayerTimes(saved);
      } else {
        loadPrayerTimes(DEFAULT_CITY);
      }
    } catch (err) {
      loadPrayerTimes(DEFAULT_CITY);
    }
  };

  const saveCity = async (newCity: string) => {
    try {
      await AsyncStorage.setItem(PRAYER_STORAGE_KEY, newCity);
    } catch (err) {
      console.error('Failed to save city', err);
    }
  };

  const requestPermissions = async () => {
    await Notifications.requestPermissionsAsync();
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

  const loadPrayerTimes = async (cityName: string) => {
    setLoading(true);
    try {
      const date = new Date();
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();

      const url = `http://api.aladhan.com/v1/timingsByCity/${day}-${month}-${year}?city=${encodeURIComponent(cityName)}&country=&method=5`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.code === 200) {
        const timings = data.data.timings;
        const prayerList: Prayer[] = [
          { name: 'Fajr', time: timings.Fajr, enabled: true },
          { name: 'Dhuhr', time: timings.Dhuhr, enabled: true },
          { name: 'Asr', time: timings.Asr, enabled: true },
          { name: 'Maghrib', time: timings.Maghrib, enabled: true },
          { name: 'Isha', time: timings.Isha, enabled: true },
        ];

        setPrayers(prayerList);
        findNextPrayer(prayerList);
        scheduleAthanNotifications(prayerList);
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

  const scheduleAthanNotifications = async (prayerList: Prayer[]) => {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const today = new Date();
    for (const prayer of prayerList) {
      if (!prayer.enabled) continue;

      const [h, m] = prayer.time.split(':').map(Number);
      let trigger = new Date(today);
      trigger.setHours(h, m, 0, 0);

      if (trigger <= today) {
        trigger.setDate(trigger.getDate() + 1);
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `حان الآن موعد صلاة ${prayer.name}`,
          body: '🕌 الله أكبر الله أكبر',
          sound: true, // This triggers your custom athan.mp3
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrate: [0, 250, 250, 250],
        },
        trigger: trigger as unknown as Notifications.NotificationTriggerInput,
      });
    }
  };

  const togglePrayer = (index: number) => {
    const updated = [...prayers];
    updated[index].enabled = !updated[index].enabled;
    setPrayers(updated);
    scheduleAthanNotifications(updated);
  };

  const handleCitySubmit = () => {
    if (city.trim()) {
      saveCity(city.trim());
      loadPrayerTimes(city.trim());
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
      <View style={styles.cityRow}>
        <TextInput
          style={[styles.cityInput, isDark && styles.darkInput]}
          placeholder="Enter city (e.g., London, Riyadh)"
          placeholderTextColor="#aaa"
          value={city}
          onChangeText={setCity}
          onSubmitEditing={handleCitySubmit}
        />
        <TouchableOpacity style={styles.refreshBtn} onPress={handleCitySubmit}>
          <Text style={styles.refreshText}>Go</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.locationBtn} onPress={getLocationAndCity} disabled={fetchingLocation}>
        <Text style={styles.locationText}>
          {fetchingLocation ? 'Detecting...' : '📍 Use My Location'}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.nextPrayer, isDark && styles.darkText]}>
        Next prayer: <Text style={styles.bold}>{nextPrayer}</Text>
      </Text>

      {prayers.map((prayer, i) => (
        <View key={i} style={[styles.prayerRow, isDark && styles.darkRow]}>
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
  cityRow: { flexDirection: 'row', marginBottom: 12 },
  cityInput: { flex: 1, padding: 14, backgroundColor: '#fff', borderRadius: 16, elevation: 4 },
  darkInput: { backgroundColor: '#1e1e1e', color: '#fff' },
  refreshBtn: { backgroundColor: '#27ae60', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 16, marginLeft: 10 },
  refreshText: { color: '#fff', fontWeight: '600' },
  locationBtn: { alignItems: 'center', padding: 12, marginBottom: 20 },
  locationText: { fontSize: 16, color: '#3498db', fontWeight: '600' },
  nextPrayer: { fontSize: 18, textAlign: 'center', marginBottom: 20, color: '#2c3e50' },
  bold: { fontWeight: 'bold', color: '#27ae60' },
  prayerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 12, elevation: 4 },
  darkRow: { backgroundColor: '#1e1e1e' },
  prayerName: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50' },
  prayerTime: { fontSize: 24, color: '#27ae60', fontWeight: '600' },
  note: { fontSize: 13, color: '#7f8c8d', textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
  darkText: { color: '#fff' },
});