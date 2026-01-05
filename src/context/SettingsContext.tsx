import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Settings {
  arabicFontSize: number;
  memorizationPause: number;
  isDarkMode: boolean;
  autoPlayOnStart: boolean;
}

const defaultSettings: Settings = {
  arabicFontSize: 34,
  memorizationPause: 4,
  isDarkMode: false,
  autoPlayOnStart: true,
};

const SettingsContext = createContext<{
  settings: Settings;
  updateSetting: (key: keyof Settings, value: any) => Promise<void>;
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
          setSettings({ ...defaultSettings, ...parsed });
        }
      } catch (e) {
        console.warn('Failed to load settings');
      }
    };
    loadSettings();
  }, []);

  const updateSetting = async (key: keyof Settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings); // Immediate re-render
    try {
      await AsyncStorage.setItem('@quran_pulse_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.warn('Failed to save setting');
    }
  };

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