import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppLanguage, getTranslations, LanguageContext } from './index';

const STORAGE_KEY = '@quran_pulse_language';

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<AppLanguage>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'ar' || saved === 'en') {
        setLang(saved);
        I18nManager.forceRTL(saved === 'ar');
      }
    });
  }, []);

  const setLanguage = useCallback(async (newLang: AppLanguage) => {
    setLang(newLang);
    await AsyncStorage.setItem(STORAGE_KEY, newLang);
    I18nManager.forceRTL(newLang === 'ar');
  }, []);

  const value = useMemo(() => ({
    lang,
    t: getTranslations(lang),
    setLanguage,
    isRTL: lang === 'ar',
  }), [lang, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
