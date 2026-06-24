import { createContext, useContext } from 'react';
import en from './en';
import ar from './ar';

export type AppLanguage = 'en' | 'ar';
export type TranslationKeys = keyof typeof en;
export type Translations = Record<TranslationKeys, string>;

const translations: Record<AppLanguage, Translations> = { en, ar };

export function getTranslations(lang: AppLanguage): Translations {
  return translations[lang];
}

export const LanguageContext = createContext<{
  lang: AppLanguage;
  t: Translations;
  setLanguage: (lang: AppLanguage) => void;
  isRTL: boolean;
}>({
  lang: 'en',
  t: en,
  setLanguage: () => {},
  isRTL: false,
});

export function useLanguage() {
  return useContext(LanguageContext);
}
