import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  arabicFontSize: number;
  memorizationPause: number;
  isDarkMode: boolean;
  autoPlayOnStart: boolean;
}

const defaultSettings: Settings = {
  arabicFontSize: 24,
  memorizationPause: 4,
  isDarkMode: false,
  autoPlayOnStart: false,
};

const clampArabicFontSize = (value: number) => {
  if (!Number.isFinite(value)) return defaultSettings.arabicFontSize;
  const clamped = Math.max(24, Math.min(48, value));
  return Math.round(clamped / 2) * 2;
};

const clampMemorizationPause = (value: number) => {
  if (!Number.isFinite(value)) return defaultSettings.memorizationPause;
  const clamped = Math.max(3, Math.min(8, value));
  return Math.round(clamped);
};

const SettingsContext = createContext<{
  settings: Settings;
  updateSetting: (key: keyof Settings, value: Settings[keyof Settings]) => Promise<void>;
}>({
  settings: defaultSettings,
  updateSetting: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const saved = await AsyncStorage.getItem('@quran_pulse_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setSettings({
            ...defaultSettings,
            ...parsed,
            arabicFontSize: clampArabicFontSize(Number(parsed?.arabicFontSize)),
            memorizationPause: clampMemorizationPause(Number(parsed?.memorizationPause)),
            isDarkMode: false,
            autoPlayOnStart: false,
          });
        }
      } catch (e) {
        console.warn('Failed to load settings');
      }
    };
    loadSettings();
  }, []);

  const updateSetting = useCallback(async (key: keyof Settings, value: Settings[keyof Settings]) => {
    setSettings((prev) => {
      const next = { ...prev };

      if (key === 'arabicFontSize') {
        next.arabicFontSize = clampArabicFontSize(Number(value));
      } else if (key === 'memorizationPause') {
        next.memorizationPause = clampMemorizationPause(Number(value));
      } else if (key === 'isDarkMode' || key === 'autoPlayOnStart') {
        // Dark mode and surah auto-play are intentionally disabled.
        next.isDarkMode = false;
        next.autoPlayOnStart = false;
      }

      AsyncStorage.setItem('@quran_pulse_settings', JSON.stringify(next)).catch(() => {
        console.warn('Failed to save setting');
      });
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
