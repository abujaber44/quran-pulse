import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import debounce from 'lodash.debounce';
import GlassBackground from '../components/GlassBackground';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import { useLanguage } from '../i18n';
import { useSettings } from '../context/SettingsContext';
import { fetchCitySuggestions } from '../services/citySearch';

export const ONBOARDING_DONE_KEY = '@qp_onboarding_done';
const CITY_STORAGE_KEY = 'prayer_city'; // same key the Prayer Times screen reads

export default function OnboardingScreen({ navigation }: any) {
  const { lang, t, setLanguage } = useLanguage();
  const { settings } = useSettings();
  const isDark = settings.isDarkMode;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cityInput, setCityInput] = useState('');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);

  const debouncedSearch = useMemo(
    () =>
      debounce(async (query: string) => {
        const trimmed = query.trim();
        if (trimmed.length < 3) {
          setSuggestions([]);
          setSuggestionsLoading(false);
          return;
        }
        setSuggestionsLoading(true);
        try {
          setSuggestions(await fetchCitySuggestions(trimmed));
        } catch {
          setSuggestions([]);
        } finally {
          setSuggestionsLoading(false);
        }
      }, 500),
    []
  );

  useEffect(() => {
    debouncedSearch(cityInput);
    return () => {
      debouncedSearch.cancel();
    };
  }, [cityInput, debouncedSearch]);

  const chooseCity = (city: string) => {
    setSelectedCity(city);
    setCityInput('');
    setSuggestions([]);
    Keyboard.dismiss();
    AsyncStorage.setItem(CITY_STORAGE_KEY, city).catch(() => {});
  };

  const detectLocation = async () => {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const position = await Location.getCurrentPositionAsync({});
      const places = await Location.reverseGeocodeAsync(position.coords);
      const place = places[0];
      const cityName = place?.city || place?.region || place?.country;
      if (cityName) chooseCity(cityName);
    } catch {
      // Silent — the user can still type a city or skip
    } finally {
      setDetecting(false);
    }
  };

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, '1').catch(() => {});
    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
  };

  const enableNotifications = async () => {
    setRequestingPermission(true);
    try {
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    } catch {
      // Permission dialog failed — nothing else to do here
    } finally {
      setRequestingPermission(false);
      void finish();
    }
  };

  return (
    <GlassBackground isDark={isDark}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.dotsRow}>
            {[1, 2, 3].map((n) => (
              <View key={n} style={[styles.dot, step === n && styles.dotActive]} />
            ))}
          </View>

          {step === 1 && (
            <View style={styles.card}>
              <Text style={styles.welcome}>{t.onboardingWelcome}</Text>
              <Text style={styles.stepTitle}>{t.onboardingLanguageTitle}</Text>
              <Text style={styles.stepDesc}>{t.onboardingLanguageDesc}</Text>
              <View style={styles.languageRow}>
                <TouchableOpacity
                  style={[styles.languageOption, lang === 'en' && styles.languageOptionActive]}
                  onPress={() => setLanguage('en')}
                >
                  <Text style={[styles.languageOptionText, lang === 'en' && styles.languageOptionTextActive]}>
                    English
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.languageOption, lang === 'ar' && styles.languageOptionActive]}
                  onPress={() => setLanguage('ar')}
                >
                  <Text style={[styles.languageOptionText, lang === 'ar' && styles.languageOptionTextActive]}>
                    العربية
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(2)}>
                <Text style={styles.primaryButtonText}>{t.onboardingContinue}</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.card}>
              <Text style={styles.stepTitle}>{t.onboardingCityTitle}</Text>
              <Text style={styles.stepDesc}>{t.onboardingCityDesc}</Text>

              <TouchableOpacity
                style={styles.detectButton}
                onPress={detectLocation}
                disabled={detecting}
              >
                {detecting ? (
                  <ActivityIndicator size="small" color={UI_COLORS.white} />
                ) : (
                  <Text style={styles.detectButtonText}>📌 {t.onboardingDetectLocation}</Text>
                )}
              </TouchableOpacity>

              <TextInput
                style={styles.cityInput}
                placeholder={t.onboardingCityPlaceholder}
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={cityInput}
                onChangeText={setCityInput}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {suggestionsLoading && (
                <Text style={styles.suggestionHint}>{t.searchingText}</Text>
              )}
              {suggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestionRow}
                  onPress={() => chooseCity(suggestion)}
                >
                  <Text style={styles.suggestionText}>📍 {suggestion}</Text>
                </TouchableOpacity>
              ))}

              {selectedCity && (
                <Text style={styles.selectedCity}>✓ {selectedCity}</Text>
              )}

              <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(3)}>
                <Text style={styles.primaryButtonText}>{t.onboardingContinue}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipButton} onPress={() => setStep(3)}>
                <Text style={styles.skipButtonText}>{t.onboardingSkip}</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View style={styles.card}>
              <Text style={styles.stepTitle}>{t.onboardingNotifTitle}</Text>
              <Text style={styles.stepDesc}>{t.onboardingNotifDesc}</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={enableNotifications}
                disabled={requestingPermission}
              >
                {requestingPermission ? (
                  <ActivityIndicator size="small" color={UI_COLORS.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>{t.onboardingEnableNotifs}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipButton} onPress={() => void finish()}>
                <Text style={styles.skipButtonText}>{t.onboardingSkip}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: UI_COLORS.accent,
    width: 22,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 22,
    ...UI_SHADOWS.card,
  },
  welcome: {
    fontSize: 14,
    fontWeight: '700',
    color: UI_COLORS.accent,
    textAlign: 'center',
    marginBottom: 6,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: UI_COLORS.text,
    textAlign: 'center',
  },
  stepDesc: {
    fontSize: 14,
    lineHeight: 21,
    color: UI_COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  languageRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  languageOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: UI_RADII.md,
    borderWidth: 1.5,
    borderColor: UI_COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  languageOptionActive: {
    borderColor: UI_COLORS.primary,
    backgroundColor: 'rgba(31,157,85,0.2)',
  },
  languageOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: UI_COLORS.textMuted,
  },
  languageOptionTextActive: {
    color: '#5ddb92',
    fontWeight: '700',
  },
  detectButton: {
    backgroundColor: UI_COLORS.accent,
    borderRadius: UI_RADII.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  detectButtonText: {
    color: UI_COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  cityInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: UI_RADII.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: UI_COLORS.text,
  },
  suggestionHint: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  suggestionRow: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  suggestionText: {
    fontSize: 15,
    color: UI_COLORS.text,
  },
  selectedCity: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5ddb92',
    textAlign: 'center',
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: UI_COLORS.primary,
    borderRadius: UI_RADII.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: UI_COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: UI_COLORS.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
