import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useThemedAlert } from '../context/ThemedAlertContext';
import debounce from 'lodash.debounce';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import GlassBackground from '../components/GlassBackground';
import ScreenIntroTile from '../components/ScreenIntroTile';
import { canScheduleExactAlarms, openExactAlarmSettings } from '../services/exactAlarmService';
import {
  ATHAN_CHANNEL_ID,
  ATHAN_REMINDER_CHANNEL_ID,
  ATHAN_NOTIFICATION_ID_PREFIX,
  ATHAN_NOTIFICATION_TITLE_PREFIX,
  ATHAN_REFRESH_REMINDER_ID,
  ATHAN_SCHEDULE_WINDOW_DAYS,
  buildAthanNotificationId,
} from '../utils/athanNotifications';
import { calculateDistanceToKaabaKm, calculateQiblaBearing, Coordinates } from '../utils/qiblaUtils';
import { useLanguage } from '../i18n';
import { schedulePrePrayerReminders } from '../services/prayerCountdownService';
import {
  PRAYER_NAMES,
  CALCULATION_METHODS,
  DEFAULT_METHOD_ID,
  fetchPrayerScheduleWindow,
  getCalculationMethod,
  saveCalculationMethod,
  parsePrayerTime,
  toLocalDateKey,
  dateKeyToLocalDate,
  type PrayerName,
  type PrayerScheduleDay,
} from '../services/prayerTimesService';

interface Prayer {
  name: string;
  time: string;
  enabled: boolean;
}

type NextPrayerInfo = {
  name: string;
  time: string;
  remainingMs: number;
  isTomorrow: boolean;
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

const formatTimeFromRaw = (raw: string): string => {
  const parsed = parsePrayerTime(raw);
  if (!parsed) return raw;
  return `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`;
};

const formatCountdown = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getNextPrayerInfo = (prayerList: Prayer[], now: Date): NextPrayerInfo | null => {
  for (const prayer of prayerList) {
    const parsed = parsePrayerTime(prayer.time);
    if (!parsed) continue;

    const prayerDate = new Date(now);
    prayerDate.setHours(parsed.hour, parsed.minute, 0, 0);
    if (prayerDate > now) {
      return {
        name: prayer.name,
        time: formatTimeFromRaw(prayer.time),
        remainingMs: prayerDate.getTime() - now.getTime(),
        isTomorrow: false,
      };
    }
  }

  const firstValidPrayer = prayerList.find((prayer) => parsePrayerTime(prayer.time));
  if (!firstValidPrayer) return null;

  const parsedFirst = parsePrayerTime(firstValidPrayer.time);
  if (!parsedFirst) return null;

  const tomorrowPrayerDate = new Date(now);
  tomorrowPrayerDate.setDate(tomorrowPrayerDate.getDate() + 1);
  tomorrowPrayerDate.setHours(parsedFirst.hour, parsedFirst.minute, 0, 0);

  return {
    name: firstValidPrayer.name,
    time: formatTimeFromRaw(firstValidPrayer.time),
    remainingMs: tomorrowPrayerDate.getTime() - now.getTime(),
    isTomorrow: true,
  };
};

/**
 * Fraction of the interval between the previous prayer and the next one
 * that has elapsed — drives the hero progress bar.
 */
const getIntervalProgress = (prayerList: Prayer[], now: Date, next: NextPrayerInfo | null): number => {
  if (!next) return 0;

  const nextParsed = parsePrayerTime(next.time);
  if (!nextParsed) return 0;
  const nextDate = new Date(now);
  if (next.isTomorrow) nextDate.setDate(nextDate.getDate() + 1);
  nextDate.setHours(nextParsed.hour, nextParsed.minute, 0, 0);

  // Latest prayer already past today; before Fajr, approximate with
  // yesterday's Isha using today's time (close enough for a progress bar)
  let prevDate: Date | null = null;
  for (const prayer of prayerList) {
    const parsed = parsePrayerTime(prayer.time);
    if (!parsed) continue;
    const candidate = new Date(now);
    candidate.setHours(parsed.hour, parsed.minute, 0, 0);
    if (candidate <= now && (!prevDate || candidate > prevDate)) {
      prevDate = candidate;
    }
  }
  if (!prevDate) {
    const isha = prayerList.find((p) => p.name === 'Isha');
    const parsedIsha = isha ? parsePrayerTime(isha.time) : null;
    if (!parsedIsha) return 0;
    prevDate = new Date(now);
    prevDate.setDate(prevDate.getDate() - 1);
    prevDate.setHours(parsedIsha.hour, parsedIsha.minute, 0, 0);
  }

  const total = nextDate.getTime() - prevDate.getTime();
  if (total <= 0) return 0;
  const elapsed = now.getTime() - prevDate.getTime();
  return Math.min(1, Math.max(0, elapsed / total));
};

const dedupeCities = (values: string[]): string[] => {
  const cleaned = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(cleaned)];
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
  const [prayerScheduleWindow, setPrayerScheduleWindow] = useState<PrayerScheduleDay[]>([]);
  const [scheduleFromCache, setScheduleFromCache] = useState(false);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [city, setCity] = useState<string>(DEFAULT_CITY);
  const [methodId, setMethodId] = useState<number>(DEFAULT_METHOD_ID);
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [showWeekly, setShowWeekly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [currentCoordinates, setCurrentCoordinates] = useState<Coordinates | null>(null);
  const [exactAlarmEnabled, setExactAlarmEnabled] = useState<boolean>(Platform.OS !== 'android');
  const scheduleRunIdRef = useRef(0);
  const exactAlarmPromptShownRef = useRef(false);
  const methodIdRef = useRef(DEFAULT_METHOD_ID);

  const { settings } = useSettings();
  const { showAlert } = useThemedAlert();
  const { t, lang } = useLanguage();
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
    const timer = setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
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

  const setupAndroidNotificationChannels = async () => {
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
      sound: 'athan_v2.mp3',
    });

    await Notifications.setNotificationChannelAsync(ATHAN_REMINDER_CHANNEL_ID, {
      name: 'Athan Schedule Reminders',
      description: 'Reminder to open Prayer Times and refresh next 7 days of athan schedules',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#27ae60',
      enableLights: true,
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  };

  const checkExactAlarmAccess = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const granted = await canScheduleExactAlarms();
    setExactAlarmEnabled(granted);
    if (granted) {
      exactAlarmPromptShownRef.current = false;
    }
    return granted;
  }, []);

  const promptExactAlarmAccess = useCallback(() => {
    if (Platform.OS !== 'android') return;
    if (exactAlarmPromptShownRef.current) return;
    exactAlarmPromptShownRef.current = true;

    showAlert({
      title: 'Enable Exact Athan Timing',
      message:
        'To keep Athan alerts exactly on time, allow "Alarms & reminders" for Quran Pulse in Android settings.',
      variant: 'info',
      buttons: [
        { text: 'Not now', role: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            void openExactAlarmSettings().finally(() => {
              setTimeout(() => {
                void checkExactAlarmAccess();
              }, 1200);
            });
          },
        },
      ],
    });
  }, [checkExactAlarmAccess, showAlert]);

  const loadSavedData = async () => {
    try {
      const savedCity = await AsyncStorage.getItem(CITY_STORAGE_KEY);
      const savedPrefs = await AsyncStorage.getItem(PRAYER_PREFS_KEY);
      const savedMethod = await getCalculationMethod();
      setMethodId(savedMethod);
      methodIdRef.current = savedMethod;

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
    await setupAndroidNotificationChannels();
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    if (status !== 'granted') {
      showAlert({
        title: 'Permission required',
        message: 'Please enable notifications for Athan alerts',
        variant: 'info',
      });
    }

    const exactAlarmAllowed = await checkExactAlarmAccess();
    if (!exactAlarmAllowed) {
      promptExactAlarmAccess();
    }
  };

  const getLocationAndCity = async () => {
    setFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission denied',
          message: 'Location permission is required to auto-detect city.',
          variant: 'info',
        });
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
      showAlert({
        title: 'Location Error',
        message: 'Could not detect location. Please enter city manually.',
        variant: 'danger',
      });
    } finally {
      setFetchingLocation(false);
    }
  };

  const loadPrayerTimes = async (
    cityName: string,
    initialPrefs?: Record<string, boolean>,
    preferredCoordinates?: Coordinates,
    methodOverride?: number
  ) => {
    setLoading(true);
    try {
      const method = methodOverride ?? methodIdRef.current;
      const today = new Date();
      const result = await fetchPrayerScheduleWindow(
        cityName,
        method,
        today,
        ATHAN_SCHEDULE_WINDOW_DAYS
      );
      const scheduleWindow = result.days;

      if (scheduleWindow.length > 0) {
        const todayKey = toLocalDateKey(today);
        const todaySchedule =
          scheduleWindow.find((entry) => entry.dateKey === todayKey) || scheduleWindow[0];
        const timings = todaySchedule.timings;
        const prayerList: Prayer[] = PRAYER_NAMES.map((name) => ({
          name,
          time: timings[name],
          enabled: initialPrefs?.[name] ?? prayers.find((p) => p.name === name)?.enabled ?? true,
        }));

        setPrayerScheduleWindow(scheduleWindow);
        setScheduleFromCache(result.fromCache);
        setPrayers(prayerList);
        await scheduleAthanNotifications(prayerList, scheduleWindow);
        void schedulePrePrayerReminders(prayerList);
        setCity(cityName);
        saveCity(cityName);

        if (preferredCoordinates) {
          setCurrentCoordinates(preferredCoordinates);
        } else {
          const resolvedCoordinates = await resolveCoordinatesForCity(cityName);
          setCurrentCoordinates(resolvedCoordinates);
        }
      } else {
        setPrayerScheduleWindow([]);
        setScheduleFromCache(false);
        showAlert({
          title: 'Invalid City',
          message: `No prayer times found for "${cityName}". Please select a valid city from suggestions or try a major city near you.`,
          variant: 'danger',
        });
        setSearchInput('');
      }
    } catch (err) {
      setPrayerScheduleWindow([]);
      setScheduleFromCache(false);
      showAlert({
        title: 'Network Error',
        message: 'Unable to fetch prayer times. Please check your internet connection.',
        variant: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMethod = (newMethodId: number) => {
    setShowMethodModal(false);
    if (newMethodId === methodId) return;
    setMethodId(newMethodId);
    methodIdRef.current = newMethodId;
    void saveCalculationMethod(newMethodId);
    void loadPrayerTimes(city, undefined, currentCoordinates ?? undefined, newMethodId);
  };

  const scheduleAthanNotifications = async (
    prayerList: Prayer[],
    scheduleWindow: PrayerScheduleDay[]
  ) => {
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

      const existingReminderIds = existingScheduled
        .filter((notification) => {
          const source = notification.content.data?.source;
          return (
            notification.identifier === ATHAN_REFRESH_REMINDER_ID ||
            source === 'athan-refresh-reminder'
          );
        })
        .map((notification) => notification.identifier);

      const idsToCancel = [...new Set([...existingAthanIds, ...existingReminderIds])];

      for (const id of idsToCancel) {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch (cancelError) {
          console.warn(`Failed to cancel scheduled notification ${id}:`, cancelError);
        }
      }
      if (isStaleRun()) return;

      const exactAlarmAllowed = await checkExactAlarmAccess();
      if (!exactAlarmAllowed) {
        promptExactAlarmAccess();
      }
      if (isStaleRun()) return;

      if (scheduleWindow.length === 0) {
        console.warn('Skipping athan scheduling because no 7-day prayer schedule is available.');
        return;
      }

      const now = new Date();
      for (const prayer of prayerList) {
        if (isStaleRun()) return;
        if (!prayer.enabled) continue;

        for (const daySchedule of scheduleWindow) {
          const prayerName = prayer.name as PrayerName;
          const rawTime = daySchedule.timings[prayerName];
          const parsed = parsePrayerTime(rawTime);
          if (!parsed) {
            console.warn(
              `Skipping invalid prayer time for ${prayer.name} on ${daySchedule.dateKey}: ${rawTime}`
            );
            continue;
          }

          const triggerDate = dateKeyToLocalDate(daySchedule.dateKey, parsed.hour, parsed.minute);

          if (triggerDate <= now) continue;

          try {
            const content: Notifications.NotificationContentInput = {
              title: `${ATHAN_NOTIFICATION_TITLE_PREFIX} ${prayer.name}`,
              body: '🕌 اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّداً الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ مَقَاماً مَحْمُوداً الَّذِي وَعَدْتَهُ، إَنَّكَ لَا تُخْلِفُ الْمِيعَادَ',
              sound: 'athan_v2.mp3',
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
              identifier: buildAthanNotificationId(prayer.name, triggerDate),
              content,
              trigger,
            });
          } catch (error) {
            console.error(`Failed to schedule ${prayer.name} on ${triggerDate.toISOString()}:`, error);
          }
        }
      }

      if (isStaleRun()) return;

      const reminderDate = new Date(now);
      reminderDate.setDate(reminderDate.getDate() + Math.max(scheduleWindow.length - 1, 0));
      reminderDate.setHours(9, 0, 0, 0);
      if (reminderDate <= now) {
        reminderDate.setDate(reminderDate.getDate() + 1);
      }

      try {
        const reminderContent: Notifications.NotificationContentInput = {
          title: 'Refresh Athan Schedule',
          body: 'Open Prayer Times to schedule the next 7 days of athan notifications.',
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
          data: { source: 'athan-refresh-reminder', targetScreen: 'PrayerTimes' },
        };

        const reminderTrigger: Notifications.NotificationTriggerInput =
          Platform.OS === 'android'
            ? {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: reminderDate,
                channelId: ATHAN_REMINDER_CHANNEL_ID,
              }
            : {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: reminderDate,
              };

        await Notifications.scheduleNotificationAsync({
          identifier: ATHAN_REFRESH_REMINDER_ID,
          content: reminderContent,
          trigger: reminderTrigger,
        });
      } catch (reminderError) {
        console.error('Failed to schedule athan refresh reminder:', reminderError);
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

    void scheduleAthanNotifications(updated, prayerScheduleWindow);
    void schedulePrePrayerReminders(updated);
  };

  const handleSelectSuggestion = (suggestedCity: string) => {
    setSearchInput(''); // Clear input after selection
    setSuggestions([]);
    loadPrayerTimes(suggestedCity);
  };

  const handleManualUpdate = () => {
    const trimmed = searchInput.trim();
    if (trimmed.length < 3) {
      showAlert({
        title: 'Invalid Input',
        message: 'Please enter at least 3 characters or select from suggestions.',
        variant: 'danger',
      });
      return;
    }

    loadPrayerTimes(trimmed);
  };

  const qiblaBearing = currentCoordinates ? calculateQiblaBearing(currentCoordinates) : null;
  const distanceToKaabaKm = currentCoordinates ? calculateDistanceToKaabaKm(currentCoordinates) : null;
  const nextPrayer = useMemo(() => getNextPrayerInfo(prayers, new Date(countdownNow)), [prayers, countdownNow]);
  const intervalProgress = useMemo(
    () => getIntervalProgress(prayers, new Date(countdownNow), nextPrayer),
    [prayers, countdownNow, nextPrayer]
  );

  const todaySchedule = useMemo(() => {
    const todayKey = toLocalDateKey(new Date());
    return prayerScheduleWindow.find((entry) => entry.dateKey === todayKey) ?? prayerScheduleWindow[0];
  }, [prayerScheduleWindow]);

  const hijriToday = lang === 'ar' ? todaySchedule?.hijriDateAr : todaySchedule?.hijriDate;
  const gregorianToday = new Date(countdownNow).toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const selectedMethod = CALCULATION_METHODS.find((m) => m.id === methodId) ?? CALCULATION_METHODS[0];

  const PRAYER_ICONS: Record<string, string> = { Fajr: '🌅', Dhuhr: '☀️', Asr: '🌤️', Maghrib: '🌇', Isha: '🌙' };
  const PRAYER_LABELS: Record<string, string> = { Fajr: t.fajr, Dhuhr: t.dhuhr, Asr: t.asr, Maghrib: t.maghrib, Isha: t.isha };

  const isPrayerPast = (prayerTime: string): boolean => {
    const parsed = parsePrayerTime(prayerTime);
    if (!parsed) return false;
    const now = new Date();
    const pDate = new Date(now);
    pDate.setHours(parsed.hour, parsed.minute, 0, 0);
    return pDate <= now;
  };

  if (loading) {
    return (
      <GlassBackground isDark={isDark}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#27ae60" />
          <Text style={styles.loadingText}>
            {t.loadingPrayerTimesFor} {city}...
          </Text>
        </View>
      </GlassBackground>
    );
  }

  return (
    <GlassBackground isDark={isDark}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro */}
        <View style={styles.headerContainer}>
          <ScreenIntroTile
            title={t.prayerTimesTitle}
            description={t.prayerTimesDescription}
            isDark={isDark}
            style={styles.introTile}
          />
        </View>

        {/* Next Prayer hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroDatesRow}>
            <Text style={styles.heroCity}>📍 {city}</Text>
            <View style={styles.heroDates}>
              {hijriToday ? <Text style={styles.heroHijri}>{hijriToday}</Text> : null}
              <Text style={styles.heroGregorian}>{gregorianToday}</Text>
            </View>
          </View>

          <Text style={styles.heroLabel}>{t.nextPrayer}</Text>
          {nextPrayer ? (
            <>
              <View style={styles.heroPrayerRow}>
                <Text style={styles.heroPrayerName}>
                  {PRAYER_ICONS[nextPrayer.name] ?? '🕌'} {PRAYER_LABELS[nextPrayer.name] ?? nextPrayer.name}
                </Text>
                <Text style={styles.heroPrayerTime}>{nextPrayer.time}</Text>
              </View>
              <Text style={styles.heroCountdown}>{formatCountdown(nextPrayer.remainingMs)}</Text>
              <View style={styles.heroBarTrack}>
                <View style={[styles.heroBarFill, { width: `${Math.round(intervalProgress * 100)}%` }]} />
              </View>
            </>
          ) : (
            <Text style={styles.heroCountdown}>{t.prayerScheduleUnavailable}</Text>
          )}

          {scheduleFromCache ? (
            <View style={styles.offlineNotice}>
              <Ionicons name="cloud-offline-outline" size={13} color="#f5c778" />
              <Text style={styles.offlineNoticeText}>{t.offlineTimesNotice}</Text>
            </View>
          ) : null}
        </View>

        {/* City and search controls */}
        <View style={styles.cityPanel}>
          <View style={styles.cityHeaderRow}>
            <View style={styles.cityHeaderText}>
              <Text style={styles.headerTitle}>{t.athanTimesFor}</Text>
              <Text style={styles.cityName}>{city}</Text>
            </View>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={getLocationAndCity}
              disabled={fetchingLocation}
              activeOpacity={0.7}
            >
              {fetchingLocation ? (
                <ActivityIndicator size="small" color={UI_COLORS.primary} />
              ) : (
                <Text style={styles.locationButtonText}>{t.locate}</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={15} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
              <TextInput
                style={styles.cityInput}
                placeholder={t.searchCity}
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={searchInput}
                onChangeText={(text) => {
                  setSearchInput(text);
                }}
                autoCapitalize="words"
                autoCorrect={false}
                underlineColorAndroid="transparent"
              />
              {searchInput.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchInput(''); setSuggestions([]); }}>
                  <Text style={styles.searchClear}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {(suggestionsLoading || suggestions.length > 0) && (
              <View style={styles.suggestionsContainer}>
                {suggestionsLoading ? (
                  <View style={styles.suggestionsLoadingRow}>
                    <ActivityIndicator size="small" color={UI_COLORS.primary} />
                    <Text style={styles.loadingSuggestions}>{t.searchingText}</Text>
                  </View>
                ) : (
                  suggestions.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectSuggestion(item)}
                    >
                      <Text style={styles.suggestionIcon}>📍</Text>
                      <Text style={styles.suggestionText}>{item}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {searchInput.trim().length >= 3 && suggestions.length === 0 && !suggestionsLoading && (
              <TouchableOpacity style={styles.updateButton} onPress={handleManualUpdate}>
                <Text style={styles.updateButtonText}>{t.useThisCity} "{searchInput.trim()}"</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Calculation method */}
          <TouchableOpacity style={styles.methodRow} onPress={() => setShowMethodModal(true)}>
            <Text style={styles.methodLabel}>{t.calcMethod}</Text>
            <View style={styles.methodValueWrap}>
              <Text style={styles.methodValue}>
                {lang === 'ar' ? selectedMethod.labelAr : selectedMethod.label}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.4)" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Qibla Summary */}
        {qiblaBearing !== null && (
          <View style={styles.qiblaCard}>
            <View style={styles.qiblaSummaryRow}>
              <View style={styles.qiblaSummaryPill}>
                <Text style={styles.qiblaSummaryLabel}>🧭 {t.qiblaShort}</Text>
                <Text style={styles.qiblaSummaryValue}>{Math.round(qiblaBearing)}°</Text>
              </View>
              <View style={styles.qiblaSummaryPill}>
                <Text style={styles.qiblaSummaryLabel}>🕋 {t.distanceShort}</Text>
                <Text style={styles.qiblaSummaryValue}>
                  {distanceToKaabaKm !== null ? `${distanceToKaabaKm.toFixed(0)} km` : '--'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.qiblaOpenButton}
                onPress={() => navigation.navigate('QiblaCompass', { city, coordinates: currentCoordinates })}
              >
                <Text style={styles.qiblaOpenButtonText}>{t.openFullQiblaCompass}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t.todaysPrayerSchedule}</Text>

        {/* Prayer Times Cards */}
        {prayers.map((prayer, i) => {
          const isNext = nextPrayer?.name === prayer.name && !nextPrayer?.isTomorrow;
          const past = isPrayerPast(prayer.time);
          return (
            <React.Fragment key={prayer.name}>
              <View
                style={[
                  styles.prayerCard,
                  isNext && styles.prayerCardNext,
                  past && styles.prayerCardPast,
                ]}
              >
                <View style={styles.prayerCardLeft}>
                  <Text style={styles.prayerIcon}>{PRAYER_ICONS[prayer.name] ?? '🕌'}</Text>
                  <View>
                    <Text style={[styles.prayerName, past && styles.prayerNamePast]}>
                      {PRAYER_LABELS[prayer.name] ?? prayer.name}
                    </Text>
                    <Text style={[styles.prayerTime, past && styles.prayerTimePast]}>
                      {formatTimeFromRaw(prayer.time)}
                    </Text>
                    {isNext && nextPrayer && (
                      <Text style={styles.prayerCountdownInline}>
                        {formatCountdown(nextPrayer.remainingMs)}
                      </Text>
                    )}
                  </View>
                </View>
                <Switch
                  value={prayer.enabled}
                  onValueChange={() => togglePrayer(i)}
                  trackColor={{ false: '#ccc', true: '#27ae60' }}
                  thumbColor={prayer.enabled ? '#fff' : '#f4f3f4'}
                />
              </View>

              {/* Sunrise marker between Fajr and Dhuhr */}
              {prayer.name === 'Fajr' && todaySchedule?.timings.Sunrise ? (
                <View style={styles.sunriseRow}>
                  <Text style={styles.sunriseText}>
                    🌄 {t.sunriseLabel} · {formatTimeFromRaw(todaySchedule.timings.Sunrise)}
                  </Text>
                </View>
              ) : null}
            </React.Fragment>
          );
        })}

        {/* Night worship times */}
        {todaySchedule && (todaySchedule.timings.Midnight || todaySchedule.timings.Lastthird) ? (
          <View style={styles.nightCard}>
            <Text style={styles.nightTitle}>🌌 {t.nightTimes}</Text>
            <Text style={styles.nightSubtitle}>{t.nightTimesSubtitle}</Text>
            <View style={styles.nightRow}>
              {todaySchedule.timings.Midnight ? (
                <View style={styles.nightPill}>
                  <Text style={styles.nightPillLabel}>{t.midnightLabel}</Text>
                  <Text style={styles.nightPillValue}>{formatTimeFromRaw(todaySchedule.timings.Midnight)}</Text>
                </View>
              ) : null}
              {todaySchedule.timings.Lastthird ? (
                <View style={styles.nightPill}>
                  <Text style={styles.nightPillLabel}>{t.lastThirdLabel}</Text>
                  <Text style={styles.nightPillValue}>{formatTimeFromRaw(todaySchedule.timings.Lastthird)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Weekly timetable */}
        {prayerScheduleWindow.length > 1 && (
          <View style={styles.weeklyCard}>
            <TouchableOpacity style={styles.weeklyHeader} onPress={() => setShowWeekly((v) => !v)}>
              <Text style={styles.weeklyTitle}>📅 {t.weeklyTimetable}</Text>
              <Ionicons
                name={showWeekly ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="rgba(255,255,255,0.5)"
              />
            </TouchableOpacity>

            {showWeekly && (
              <View style={styles.weeklyTable}>
                <View style={styles.weeklyRow}>
                  <Text style={[styles.weeklyCell, styles.weeklyHeadCell, styles.weeklyDayCell]}></Text>
                  {PRAYER_NAMES.map((name) => (
                    <Text key={name} style={[styles.weeklyCell, styles.weeklyHeadCell]}>
                      {(PRAYER_LABELS[name] ?? name).slice(0, 6)}
                    </Text>
                  ))}
                </View>
                {prayerScheduleWindow.map((day) => {
                  const date = dateKeyToLocalDate(day.dateKey);
                  const isToday = day.dateKey === toLocalDateKey(new Date());
                  const weekday = date.toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { weekday: 'short' });
                  return (
                    <View key={day.dateKey} style={[styles.weeklyRow, isToday && styles.weeklyRowToday]}>
                      <Text style={[styles.weeklyCell, styles.weeklyDayCell, isToday && styles.weeklyCellToday]}>
                        {weekday} {date.getDate()}
                      </Text>
                      {PRAYER_NAMES.map((name) => (
                        <Text
                          key={name}
                          style={[styles.weeklyCell, isToday && styles.weeklyCellToday]}
                        >
                          {formatTimeFromRaw(day.timings[name])}
                        </Text>
                      ))}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>{t.tools}</Text>

        <View style={styles.diagnosticsCard}>
          <Text style={styles.diagnosticsTitle}>{t.athanDiagnostics}</Text>
          <Text style={styles.diagnosticsText}>
            {t.athanDiagnosticsDesc}
          </Text>
          <TouchableOpacity
            style={styles.diagnosticsButton}
            onPress={() => navigation.navigate('AthanDiagnostics', { city, prayers })}
          >
            <Text style={styles.diagnosticsButtonText}>{t.openDiagnostics}</Text>
          </TouchableOpacity>
        </View>

        {/* Note */}
        <Text style={styles.note}>{t.athanScheduleNote}</Text>
        {Platform.OS === 'android' && !exactAlarmEnabled ? (
          <TouchableOpacity style={styles.exactAlarmWarningCard} onPress={promptExactAlarmAccess}>
            <Text style={styles.exactAlarmWarningTitle}>{t.exactAlarmWarningTitle}</Text>
            <Text style={styles.exactAlarmWarningText}>{t.exactAlarmWarningBody}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Extra space at bottom */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>

    {/* Calculation method picker */}
    <Modal
      visible={showMethodModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowMethodModal(false)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setShowMethodModal(false)}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.modalTitle}>{t.calcMethod}</Text>
          {CALCULATION_METHODS.map((method) => {
            const isActive = method.id === methodId;
            return (
              <TouchableOpacity
                key={method.id}
                style={[styles.methodOption, isActive && styles.methodOptionActive]}
                onPress={() => handleSelectMethod(method.id)}
              >
                <Text style={[styles.methodOptionText, isActive && styles.methodOptionTextActive]}>
                  {lang === 'ar' ? method.labelAr : method.label}
                </Text>
                {isActive && <Ionicons name="checkmark" size={16} color="#5ddb92" />}
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: UI_COLORS.text },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headerContainer: { alignItems: 'center', marginBottom: 8, width: '100%' },
  introTile: { width: '100%', marginHorizontal: 0, marginBottom: 12 },

  heroCard: {
    backgroundColor: 'rgba(31,157,85,0.12)',
    borderRadius: UI_RADII.xl,
    borderWidth: 1,
    borderColor: 'rgba(31,157,85,0.3)',
    padding: 16,
    marginBottom: 14,
    ...UI_SHADOWS.card,
  },
  heroDatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  heroCity: {
    fontSize: 14,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  heroDates: {
    alignItems: 'flex-end',
  },
  heroHijri: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5ddb92',
  },
  heroGregorian: {
    fontSize: 11,
    color: UI_COLORS.textMuted,
    marginTop: 1,
  },
  heroLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: UI_COLORS.textMuted,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroPrayerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 4,
  },
  heroPrayerName: {
    fontSize: 22,
    fontWeight: '800',
    color: UI_COLORS.white,
  },
  heroPrayerTime: {
    fontSize: 16,
    fontWeight: '700',
    color: UI_COLORS.textMuted,
  },
  heroCountdown: {
    fontSize: 30,
    color: UI_COLORS.primary,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  heroBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginTop: 12,
  },
  heroBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: UI_COLORS.primary,
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
  },
  offlineNoticeText: {
    fontSize: 11,
    color: '#f5c778',
    fontWeight: '600',
  },

  cityPanel: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 14,
    marginBottom: 14,
    ...UI_SHADOWS.card,
  },
  cityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cityHeaderText: { flex: 1, marginRight: 10 },
  headerTitle: { fontSize: 12, color: UI_COLORS.textMuted, fontWeight: '600' },
  cityName: { fontSize: 20, fontWeight: '800', color: UI_COLORS.text, marginTop: 1 },
  locationButton: {
    backgroundColor: 'rgba(45,127,184,0.15)',
    borderWidth: 1,
    borderColor: UI_COLORS.accent,
    borderRadius: UI_RADII.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  locationButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: UI_COLORS.accent,
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  methodLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
  },
  methodValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  methodValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5ddb92',
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: UI_COLORS.text,
    marginBottom: 10,
    marginTop: 2,
  },
  prayerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: UI_RADII.lg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderLeftWidth: 4,
    borderLeftColor: UI_COLORS.primary,
    ...UI_SHADOWS.card,
  },
  prayerCardNext: {
    borderLeftColor: UI_COLORS.accent,
    borderLeftWidth: 5,
    backgroundColor: 'rgba(45,127,184,0.15)',
  },
  prayerCardPast: {
    opacity: 0.5,
  },
  prayerCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  prayerIcon: {
    fontSize: 24,
  },
  prayerName: { fontSize: 15, fontWeight: 'bold', color: UI_COLORS.text },
  prayerNamePast: { color: UI_COLORS.textMuted },
  prayerTime: { fontSize: 15, color: UI_COLORS.primary, fontWeight: '600', marginTop: 3 },
  prayerTimePast: { color: UI_COLORS.textMuted },
  prayerCountdownInline: {
    fontSize: 12,
    color: UI_COLORS.accent,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  sunriseRow: {
    alignItems: 'center',
    marginTop: -4,
    marginBottom: 10,
  },
  sunriseText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(245,199,120,0.85)',
  },

  nightCard: {
    backgroundColor: 'rgba(130,110,220,0.1)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(130,110,220,0.25)',
    padding: 14,
    marginTop: 4,
    marginBottom: 14,
  },
  nightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b0a0f0',
    textAlign: 'center',
    marginBottom: 2,
  },
  nightSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginBottom: 10,
  },
  nightRow: {
    flexDirection: 'row',
    gap: 10,
  },
  nightPill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: UI_RADII.md,
    paddingVertical: 9,
  },
  nightPillLabel: {
    fontSize: 11,
    color: UI_COLORS.textMuted,
    marginBottom: 3,
    textAlign: 'center',
  },
  nightPillValue: {
    fontSize: 16,
    fontWeight: '700',
    color: UI_COLORS.text,
  },

  weeklyCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 14,
    marginBottom: 18,
    ...UI_SHADOWS.card,
  },
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weeklyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  weeklyTable: {
    marginTop: 12,
  },
  weeklyRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  weeklyRowToday: {
    backgroundColor: 'rgba(31,157,85,0.14)',
    borderRadius: UI_RADII.sm,
  },
  weeklyCell: {
    flex: 1,
    fontSize: 11,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  weeklyHeadCell: {
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
  },
  weeklyDayCell: {
    flex: 1.2,
    textAlign: 'left',
    paddingLeft: 4,
    fontWeight: '700',
  },
  weeklyCellToday: {
    color: '#5ddb92',
  },

  note: { fontSize: 13, color: UI_COLORS.textMuted, textAlign: 'center', marginTop: 20, fontStyle: 'italic', lineHeight: 19 },
  exactAlarmWarningCard: {
    marginTop: 12,
    backgroundColor: 'rgba(224,185,0,0.15)',
    borderColor: 'rgba(224,185,0,0.3)',
    borderWidth: 1,
    borderRadius: UI_RADII.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  exactAlarmWarningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e0b900',
    marginBottom: 2,
    textAlign: 'center',
  },
  exactAlarmWarningText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Autocomplete
  searchContainer: {
    width: '100%',
    position: 'relative',
    zIndex: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  cityInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    color: UI_COLORS.text,
  },
  searchClear: {
    fontSize: 16,
    color: UI_COLORS.textMuted,
    fontWeight: '600',
    paddingLeft: 8,
  },
  suggestionsContainer: {
    backgroundColor: 'rgba(18,46,63,0.97)',
    borderRadius: UI_RADII.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...UI_SHADOWS.card,
    zIndex: 20,
    maxHeight: 240,
    overflow: 'hidden',
    marginTop: 8,
  },
  suggestionsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  suggestionIcon: {
    fontSize: 14,
  },
  suggestionText: {
    fontSize: 15,
    color: UI_COLORS.text,
  },
  loadingSuggestions: {
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
    fontSize: 14,
    fontWeight: '600',
  },

  // Qibla summary
  qiblaCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 12,
    marginBottom: 16,
    ...UI_SHADOWS.card,
  },
  qiblaSummaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  qiblaSummaryPill: {
    flex: 1,
    borderRadius: UI_RADII.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  qiblaSummaryLabel: {
    fontSize: 11,
    color: UI_COLORS.textMuted,
    marginBottom: 2,
  },
  qiblaSummaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: UI_COLORS.text,
  },
  qiblaOpenButton: {
    justifyContent: 'center',
    backgroundColor: UI_COLORS.accent,
    borderRadius: UI_RADII.md,
    paddingHorizontal: 12,
  },
  qiblaOpenButtonText: {
    color: UI_COLORS.white,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  diagnosticsCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 16,
    marginBottom: 24,
    ...UI_SHADOWS.card,
  },
  diagnosticsTitle: {
    fontSize: 17,
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

  // Method picker modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,18,31,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(18,46,63,0.97)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: UI_COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  methodOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: UI_RADII.sm,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  methodOptionActive: {
    backgroundColor: 'rgba(31,157,85,0.15)',
    borderColor: 'rgba(31,157,85,0.4)',
  },
  methodOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
    flexShrink: 1,
  },
  methodOptionTextActive: {
    color: UI_COLORS.text,
  },
});
