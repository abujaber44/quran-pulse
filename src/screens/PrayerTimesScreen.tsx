import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../context/SettingsContext';
import debounce from 'lodash.debounce';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import ScreenIntroTile from '../components/ScreenIntroTile';
import {
  ATHAN_CHANNEL_ID,
  ATHAN_NOTIFICATION_ID_PREFIX,
  ATHAN_NOTIFICATION_TITLE_PREFIX,
  buildAthanNotificationId,
} from '../utils/athanNotifications';

interface Prayer {
  name: string;
  time: string;
  enabled: boolean;
}

type Coordinates = {
  latitude: number;
  longitude: number;
};

type NominatimResult = {
  name?: string;
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
};

type OpenMeteoResult = {
  name?: string;
};

const CITY_STORAGE_KEY = 'prayer_city';
const PRAYER_PREFS_KEY = 'prayer_athan_prefs';
const DEFAULT_CITY = 'Makkah';
const KAABA_COORDINATES: Coordinates = {
  latitude: 21.4225,
  longitude: 39.8262,
};
const parsePrayerTime = (raw: string): { hour: number; minute: number } | null => {
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
};

const dedupeCities = (values: string[]): string[] => {
  const cleaned = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(cleaned)];
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

const normalizeDegrees = (degrees: number): number => (degrees + 360) % 360;

const calculateQiblaBearing = (origin: Coordinates): number => {
  const lat1 = toRadians(origin.latitude);
  const lon1 = toRadians(origin.longitude);
  const lat2 = toRadians(KAABA_COORDINATES.latitude);
  const lon2 = toRadians(KAABA_COORDINATES.longitude);

  const deltaLon = lon2 - lon1;
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
};

const extractNominatimCity = (record: NominatimResult): string => {
  return (
    record.address?.city ||
    record.address?.town ||
    record.address?.village ||
    record.address?.municipality ||
    record.address?.county ||
    record.address?.state ||
    record.name ||
    record.display_name?.split(',')[0] ||
    ''
  );
};

const fetchNominatimSuggestions = async (query: string): Promise<string[]> => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`,
    {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'QuranPulse/1.0 (https://abujaber44.github.io/quran-pulse/privacy/)',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Nominatim request failed: ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) return [];

  const cityNames = data.map((item) => extractNominatimCity(item as NominatimResult));
  return dedupeCities(cityNames).slice(0, 5);
};

const fetchOpenMeteoSuggestions = async (query: string): Promise<string[]> => {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
  );

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { results?: OpenMeteoResult[] };
  const results = Array.isArray(payload.results) ? payload.results : [];
  return dedupeCities(results.map((item) => item.name || '')).slice(0, 5);
};

export default function PrayerTimesScreen({ navigation }: any) {
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [nextPrayer, setNextPrayer] = useState<string>('');
  const [city, setCity] = useState<string>(DEFAULT_CITY);
  const [loading, setLoading] = useState(true);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [currentCoordinates, setCurrentCoordinates] = useState<Coordinates | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [headingAccuracy, setHeadingAccuracy] = useState<number | null>(null);
  const [isCompassAvailable, setIsCompassAvailable] = useState(true);
  const hasVibratedForQiblaRef = useRef(false);
  const scheduleRunIdRef = useRef(0);

  const { settings } = useSettings();
  const isDark = settings.isDarkMode;

  // Debounced city search for autocomplete using Nominatim
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length < 3) {
        setSuggestions([]);
        setSuggestionsLoading(false);
        return;
      }

      setSuggestionsLoading(true);
      try {
        let cityNames = await fetchNominatimSuggestions(trimmedQuery);
        if (cityNames.length === 0) {
          cityNames = await fetchOpenMeteoSuggestions(trimmedQuery);
        }
        setSuggestions(cityNames);
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
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchInput, debouncedSearch]);

  useEffect(() => {
    const bootstrap = async () => {
      await requestPermissions();
      await loadSavedData();
    };
    bootstrap();
  }, []);

  useEffect(() => {
    let isActive = true;
    let subscription: Location.LocationSubscription | null = null;

    const startHeadingWatch = async () => {
      try {
        subscription = await Location.watchHeadingAsync(
          (headingData) => {
            if (!isActive) return;
            const resolvedHeading = headingData.trueHeading >= 0 ? headingData.trueHeading : headingData.magHeading;
            setHeading(resolvedHeading);
            setHeadingAccuracy(headingData.accuracy ?? null);
          },
          () => {
            if (!isActive) return;
            setIsCompassAvailable(false);
          }
        );
      } catch {
        if (!isActive) return;
        setIsCompassAvailable(false);
      }
    };

    void startHeadingWatch();

    return () => {
      isActive = false;
      subscription?.remove();
    };
  }, []);

  const resolveCoordinatesForCity = async (cityName: string): Promise<Coordinates | null> => {
    try {
      const geocoded = await Location.geocodeAsync(cityName);
      if (!Array.isArray(geocoded) || geocoded.length === 0) {
        return null;
      }
      return {
        latitude: geocoded[0].latitude,
        longitude: geocoded[0].longitude,
      };
    } catch {
      return null;
    }
  };

  const setupAndroidNotificationChannel = async () => {
    if (Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync(ATHAN_CHANNEL_ID, {
      name: 'Athan Alerts',
      description: 'Prayer time notifications with Athan sound',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#27ae60',
      enableLights: true,
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'athan.mp3',
    });
  };

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

      await loadPrayerTimes(cityToUse, initialPrefs);
    } catch (err) {
      await loadPrayerTimes(DEFAULT_CITY);
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
    await setupAndroidNotificationChannel();
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
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
      const detectedCoordinates: Coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentCoordinates(detectedCoordinates);
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
        loadPrayerTimes(cityName, undefined, detectedCoordinates);
      }
    } catch (err) {
      Alert.alert('Location Error', 'Could not detect location. Please enter city manually.');
    } finally {
      setFetchingLocation(false);
    }
  };

  const loadPrayerTimes = async (
    cityName: string,
    initialPrefs?: Record<string, boolean>,
    preferredCoordinates?: Coordinates
  ) => {
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
        saveCity(cityName);

        if (preferredCoordinates) {
          setCurrentCoordinates(preferredCoordinates);
        } else {
          const resolvedCoordinates = await resolveCoordinatesForCity(cityName);
          setCurrentCoordinates(resolvedCoordinates);
        }
      } else {
        Alert.alert(
          'Invalid City',
          `No prayer times found for "${cityName}". Please select a valid city from suggestions or try a major city near you.`
        );
        setSearchInput(''); 
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
      const parsed = parsePrayerTime(prayer.time);
      if (!parsed) continue;

      const prayerMinutes = parsed.hour * 60 + parsed.minute;
      if (prayerMinutes > currentTime) {
        setNextPrayer(prayer.name);
        return;
      }
    }
    setNextPrayer('Fajr (tomorrow)');
  };

  const scheduleAthanNotifications = async (prayerList: Prayer[]) => {
    const runId = ++scheduleRunIdRef.current;

    const isStaleRun = () => runId !== scheduleRunIdRef.current;

    try {
      const existingScheduled = await Notifications.getAllScheduledNotificationsAsync();
      if (isStaleRun()) return;

      const existingAthanIds = existingScheduled
        .filter((notification) => {
          const title = typeof notification.content.title === 'string' ? notification.content.title : '';
          const source = notification.content.data?.source;
          return (
            notification.identifier.startsWith(ATHAN_NOTIFICATION_ID_PREFIX) ||
            source === 'athan' ||
            title.startsWith(ATHAN_NOTIFICATION_TITLE_PREFIX)
          );
        })
        .map((notification) => notification.identifier);

      for (const id of existingAthanIds) {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch (cancelError) {
          console.warn(`Failed to cancel scheduled athan notification ${id}:`, cancelError);
        }
      }
      if (isStaleRun()) return;

      const today = new Date();
      for (const prayer of prayerList) {
        if (isStaleRun()) return;
        if (!prayer.enabled) continue;

        const parsed = parsePrayerTime(prayer.time);
        if (!parsed) {
          console.warn(`Skipping invalid prayer time for ${prayer.name}: ${prayer.time}`);
          continue;
        }

        const triggerDate = new Date(today);
        triggerDate.setHours(parsed.hour, parsed.minute, 0, 0);

        if (triggerDate <= today) {
          triggerDate.setDate(triggerDate.getDate() + 1);
        }

        try {
          const content: Notifications.NotificationContentInput = {
            title: `${ATHAN_NOTIFICATION_TITLE_PREFIX} ${prayer.name}`,
            body: '🕌 اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّداً الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ مَقَاماً مَحْمُوداً الَّذِي وَعَدْتَهُ، إَنَّكَ لَا تُخْلِفُ الْمِيعَادَ',
            sound: 'athan.mp3',
            priority: Notifications.AndroidNotificationPriority.HIGH,
            vibrate: [0, 250, 250, 250],
            data: { source: 'athan', prayerName: prayer.name },
          };

          if (Platform.OS === 'ios') {
            content.interruptionLevel = 'timeSensitive';
          }

          const trigger: Notifications.NotificationTriggerInput =
            Platform.OS === 'android'
              ? {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: triggerDate,
                  channelId: ATHAN_CHANNEL_ID,
                }
              : {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: triggerDate,
                };

          await Notifications.scheduleNotificationAsync({
            identifier: buildAthanNotificationId(prayer.name),
            content,
            trigger,
          });
        } catch (error) {
          console.error(`Failed to schedule ${prayer.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to refresh athan schedules:', error);
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

    void scheduleAthanNotifications(updated);
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

  const qiblaBearing = currentCoordinates ? calculateQiblaBearing(currentCoordinates) : null;
  const rotationToQibla = heading !== null && qiblaBearing !== null
    ? normalizeDegrees(qiblaBearing - heading)
    : null;
  const signedTurnDelta = heading !== null && qiblaBearing !== null
    ? ((qiblaBearing - heading + 540) % 360) - 180
    : null;
  const isFacingQibla = signedTurnDelta !== null && Math.abs(signedTurnDelta) <= 5;

  useEffect(() => {
    if (!isFacingQibla) {
      hasVibratedForQiblaRef.current = false;
      return;
    }

    if (hasVibratedForQiblaRef.current) {
      return;
    }

    hasVibratedForQiblaRef.current = true;
    Vibration.vibrate(150);
  }, [isFacingQibla]);

  const qiblaTurnInstruction = () => {
    if (signedTurnDelta === null) return 'Align your phone with North to start guidance.';
    const delta = Math.round(Math.abs(signedTurnDelta));
    if (delta <= 5) return 'You are facing Qibla.';
    return signedTurnDelta > 0 ? `Turn right ${delta}°` : `Turn left ${delta}°`;
  };

  const compassQuality = useMemo(() => {
    if (!isCompassAvailable) {
      return {
        label: 'Unavailable',
        badgeColor: UI_COLORS.danger,
        textColor: UI_COLORS.white,
        needsCalibrationPrompt: true,
        guidance: 'Compass sensor is unavailable on this device/runtime.',
      };
    }

    if (headingAccuracy === null) {
      return {
        label: 'Initializing',
        badgeColor: '#c98200',
        textColor: UI_COLORS.white,
        needsCalibrationPrompt: true,
        guidance: 'Move your phone slowly to initialize compass direction.',
      };
    }

    if (headingAccuracy <= 1) {
      return {
        label: 'Low Accuracy',
        badgeColor: '#c98200',
        textColor: UI_COLORS.white,
        needsCalibrationPrompt: true,
        guidance: 'Re-calibrate by moving phone in a figure-8 and keep away from metal objects.',
      };
    }

    if (headingAccuracy === 2) {
      return {
        label: 'Medium Accuracy',
        badgeColor: UI_COLORS.accent,
        textColor: UI_COLORS.white,
        needsCalibrationPrompt: true,
        guidance: 'Keep phone flat and away from magnetic interference for better heading confidence.',
      };
    }

    return {
      label: 'Calibrated',
      badgeColor: UI_COLORS.primary,
      textColor: UI_COLORS.white,
      needsCalibrationPrompt: false,
      guidance: '',
    };
  }, [headingAccuracy, isCompassAvailable]);

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
      style={[styles.container, isDark && styles.darkBg]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={[styles.container, isDark && styles.darkBg]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header: Athan Times for City */}
        <View style={styles.headerContainer}>
          <ScreenIntroTile
            title="Prayer Times & Athan"
            description="Stay connected to your daily prayers with accurate athan times, reminders, and live Qibla compass guidance. Calibrate your heading, align toward the Kaaba with turn-by-turn direction, and feel a gentle vibration when Qibla is reached."
            isDark={isDark}
            style={styles.introTile}
          />

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
              underlineColorAndroid="transparent"
            />

            {/* Suggestions dropdown */}
            {(suggestionsLoading || suggestions.length > 0) && (
              <View style={styles.suggestionsContainer}>
                {suggestionsLoading ? (
                  <Text style={styles.loadingSuggestions}>Searching cities...</Text>
                ) : (
                  suggestions.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectSuggestion(item)}
                    >
                      <Text style={styles.suggestionText}>{item}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

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

        <View style={[styles.qiblaCard, isDark && styles.darkCard]}>
          <Text style={[styles.qiblaTitle, isDark && styles.darkText]}>Qibla Compass</Text>
          <View style={styles.qiblaStatusRow}>
            <Text style={[styles.qiblaStatusLabel, isDark && styles.darkText]}>Compass Status</Text>
            <View style={[styles.qiblaStatusBadge, { backgroundColor: compassQuality.badgeColor }]}>
              <Text style={[styles.qiblaStatusBadgeText, { color: compassQuality.textColor }]}>
                {compassQuality.label}
              </Text>
            </View>
          </View>
          {qiblaBearing === null ? (
            <Text style={[styles.qiblaHint, isDark && styles.darkText]}>
              Choose a city or tap "Use My Location" to calculate Qibla direction.
            </Text>
          ) : (
            <>
              <View style={styles.qiblaCompassWrap}>
                <View style={styles.qiblaDial}>
                  <Text style={styles.qiblaNorth}>N</Text>
                  <View
                    style={[
                      styles.qiblaArrowWrap,
                      rotationToQibla !== null
                        ? { transform: [{ rotate: `${rotationToQibla}deg` }] }
                        : null,
                    ]}
                  >
                    <Text style={styles.qiblaArrow}>▲</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.qiblaMeta, isDark && styles.darkText]}>
                Qibla bearing: {Math.round(qiblaBearing)}°
                {heading !== null ? ` • Heading: ${Math.round(heading)}°` : ''}
              </Text>
              <Text style={styles.qiblaInstruction}>{qiblaTurnInstruction()}</Text>
              {compassQuality.needsCalibrationPrompt ? (
                <Text style={[styles.qiblaCalibration, isDark && styles.darkText]}>
                  {compassQuality.guidance}
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View style={[styles.diagnosticsCard, isDark && styles.darkCard]}>
          <Text style={[styles.diagnosticsTitle, isDark && styles.darkText]}>Athan Diagnostics</Text>
          <Text style={[styles.diagnosticsText, isDark && styles.darkText]}>
            Verify exact scheduled trigger timestamps, notification IDs, and channel settings on this device.
          </Text>
          <TouchableOpacity
            style={styles.diagnosticsButton}
            onPress={() => navigation.navigate('AthanDiagnostics', { city, prayers })}
          >
            <Text style={styles.diagnosticsButtonText}>Open Diagnostics</Text>
          </TouchableOpacity>
        </View>

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
  container: { flex: 1, backgroundColor: UI_COLORS.background },
  darkBg: { backgroundColor: UI_COLORS.darkBackground },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: UI_COLORS.text },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headerContainer: { alignItems: 'center', marginBottom: 24, width: '100%' },
  introTile: { width: '100%', marginHorizontal: 0, marginBottom: 12 },
  headerTitle: { fontSize: 18, color: UI_COLORS.textMuted, marginBottom: 4 },
  cityName: { fontSize: 28, fontWeight: 'bold', color: UI_COLORS.text },
  changeCityText: { fontSize: 16, color: UI_COLORS.accent, marginTop: 8, textDecorationLine: 'underline' },
  nextPrayer: { fontSize: 20, textAlign: 'center', marginBottom: 24, color: UI_COLORS.text },
  bold: { fontWeight: 'bold', color: UI_COLORS.primary },
  prayerCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: UI_COLORS.surface,
    padding: 24, 
    borderRadius: UI_RADII.lg,
    marginBottom: 16, 
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    borderLeftWidth: 5,
    borderLeftColor: UI_COLORS.primary,
    ...UI_SHADOWS.card,
  },
  darkCard: { backgroundColor: UI_COLORS.darkSurface, borderColor: '#30353b' },
  prayerName: { fontSize: 16, fontWeight: 'bold', color: UI_COLORS.text },
  prayerTime: { fontSize: 16, color: UI_COLORS.primary, fontWeight: '600', marginTop: 4 },
  note: { fontSize: 14, color: UI_COLORS.textMuted, textAlign: 'center', marginTop: 24, fontStyle: 'italic' },
  darkText: { color: UI_COLORS.white },
  // Autocomplete styles
  searchContainer: {
    width: '100%',
    marginVertical: 12,
    position: 'relative',
    zIndex: 20,
  },
  cityInput: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: UI_COLORS.text,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...UI_SHADOWS.input,
  },
  suggestionsContainer: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: UI_RADII.sm,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...UI_SHADOWS.card,
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
    borderColor: UI_COLORS.border,
  },
  suggestionText: {
    fontSize: 16,
    color: UI_COLORS.text,
  },
  loadingSuggestions: {
    padding: 16,
    textAlign: 'center',
    color: UI_COLORS.textMuted,
    fontSize: 14,
  },
  updateButton: {
    marginTop: 8,
    alignSelf: 'center',
    backgroundColor: UI_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: UI_RADII.xl,
  },
  updateButtonText: {
    color: UI_COLORS.white,
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
    color: UI_COLORS.textMuted,
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
  backgroundColor: UI_COLORS.surface,
  borderRadius: UI_RADII.lg,
  padding: 16,
  borderWidth: 1,
  borderColor: UI_COLORS.border,
  ...UI_SHADOWS.input,
  width: '90%',
  alignSelf: 'center',
},
darkLocationContainer: {
  backgroundColor: UI_COLORS.darkSurface,
  borderColor: '#30353b',
},
locationInner: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
},
locationText: {
  fontSize: 16,
  color: UI_COLORS.primary,
  fontWeight: '600',
},
qiblaCard: {
  backgroundColor: UI_COLORS.surface,
  borderRadius: UI_RADII.lg,
  borderWidth: 1,
  borderColor: UI_COLORS.border,
  padding: 16,
  marginBottom: 24,
  ...UI_SHADOWS.card,
},
qiblaTitle: {
  fontSize: 20,
  fontWeight: '700',
  color: UI_COLORS.text,
  textAlign: 'center',
  marginBottom: 12,
},
qiblaStatusRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
},
qiblaStatusLabel: {
  fontSize: 13,
  fontWeight: '600',
  color: UI_COLORS.textMuted,
},
qiblaStatusBadge: {
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 5,
},
qiblaStatusBadgeText: {
  fontSize: 11,
  fontWeight: '700',
},
qiblaHint: {
  fontSize: 14,
  textAlign: 'center',
  color: UI_COLORS.textMuted,
  lineHeight: 20,
},
qiblaCompassWrap: {
  alignItems: 'center',
  marginBottom: 10,
},
qiblaDial: {
  width: 150,
  height: 150,
  borderRadius: 75,
  borderWidth: 2,
  borderColor: UI_COLORS.border,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f7fbff',
},
qiblaNorth: {
  position: 'absolute',
  top: 8,
  fontSize: 16,
  fontWeight: '700',
  color: UI_COLORS.accent,
},
qiblaArrowWrap: {
  alignItems: 'center',
  justifyContent: 'center',
},
qiblaArrow: {
  fontSize: 38,
  color: UI_COLORS.primary,
},
qiblaMeta: {
  fontSize: 14,
  textAlign: 'center',
  color: UI_COLORS.textMuted,
  marginBottom: 6,
},
qiblaInstruction: {
  fontSize: 16,
  textAlign: 'center',
  color: UI_COLORS.primary,
  fontWeight: '700',
  marginBottom: 8,
},
qiblaCalibration: {
  fontSize: 13,
  textAlign: 'center',
  color: UI_COLORS.textMuted,
  lineHeight: 18,
  marginTop: 4,
},
diagnosticsCard: {
  backgroundColor: UI_COLORS.surface,
  borderRadius: UI_RADII.lg,
  borderWidth: 1,
  borderColor: UI_COLORS.border,
  padding: 16,
  marginBottom: 24,
  ...UI_SHADOWS.card,
},
diagnosticsTitle: {
  fontSize: 18,
  fontWeight: '700',
  color: UI_COLORS.text,
  marginBottom: 6,
},
diagnosticsText: {
  fontSize: 14,
  lineHeight: 21,
  color: UI_COLORS.textMuted,
},
diagnosticsButton: {
  alignSelf: 'flex-start',
  marginTop: 12,
  backgroundColor: UI_COLORS.accent,
  borderRadius: UI_RADII.md,
  paddingHorizontal: 14,
  paddingVertical: 10,
},
diagnosticsButtonText: {
  color: UI_COLORS.white,
  fontSize: 13,
  fontWeight: '700',
},
});
