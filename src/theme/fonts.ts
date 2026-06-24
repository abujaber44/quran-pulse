export type ArabicFontOptionId =
  | 'amiri_quran'
  | 'amiri_quran_dedicated'
  | 'scheherazade_new'
  | 'noto_naskh'
  | 'uthmanic_hafs_v22'
  | 'lateef'
  | 'kfgqpc_nastaleeq'
  | 'digital_khatt_indopak'
  | 'system_arabic';

export type ArabicFontOption = {
  id: ArabicFontOptionId;
  label: string;
  labelAr: string;
  fontFamily?: string;
};

export const DEFAULT_ARABIC_FONT_OPTION: ArabicFontOptionId = 'amiri_quran_dedicated';

export const ARABIC_FONT_OPTIONS: ArabicFontOption[] = [
  { id: 'amiri_quran', label: 'Amiri', labelAr: 'أميري', fontFamily: 'AmiriQuran' },
  { id: 'amiri_quran_dedicated', label: 'Amiri Quran', labelAr: 'أميري قرآن', fontFamily: 'AmiriQuranDedicated' },
  { id: 'scheherazade_new', label: 'Scheherazade', labelAr: 'شهرزاد', fontFamily: 'ScheherazadeNew' },
  { id: 'noto_naskh', label: 'Noto Naskh', labelAr: 'نوتو نسخ', fontFamily: 'NotoNaskhArabic' },
  { id: 'uthmanic_hafs_v22', label: 'Uthmanic Hafs', labelAr: 'عثماني حفص', fontFamily: 'UthmanicHafsV22' },
  { id: 'lateef', label: 'Lateef', labelAr: 'لطيف', fontFamily: 'Lateef' },
  { id: 'kfgqpc_nastaleeq', label: 'Nastaleeq', labelAr: 'نستعليق', fontFamily: 'KFGQPCNastaleeq' },
  { id: 'digital_khatt_indopak', label: 'IndoPak', labelAr: 'هندي باكستاني', fontFamily: 'DigitalKhattIndoPak' },
  { id: 'system_arabic', label: 'System', labelAr: 'خط النظام', fontFamily: 'System' },
];

export const CUSTOM_FONT_ASSETS = {
  AmiriQuran: require('../../assets/fonts/Amiri-Regular.ttf'),
  AmiriQuranDedicated: require('../../assets/fonts/AmiriQuran-Regular.ttf'),
  ScheherazadeNew: require('../../assets/fonts/ScheherazadeNew-Regular.ttf'),
  NotoNaskhArabic: require('../../assets/fonts/NotoNaskhArabic-Regular.ttf'),
  UthmanicHafsV22: require('../../assets/fonts/UthmanicHafs_V22.ttf'),
  Lateef: require('../../assets/fonts/Lateef-Regular.ttf'),
  KFGQPCNastaleeq: require('../../assets/fonts/KFGQPCNastaleeq-Regular.ttf'),
  DigitalKhattIndoPak: require('../../assets/fonts/DigitalKhattIndoPak.otf'),
} as const;

export const isArabicFontOptionId = (value: unknown): value is ArabicFontOptionId =>
  typeof value === 'string' && ARABIC_FONT_OPTIONS.some((option) => option.id === value);

export const resolveArabicFontFamily = (fontId: unknown): string | undefined => {
  if (!isArabicFontOptionId(fontId)) {
    return ARABIC_FONT_OPTIONS.find((option) => option.id === DEFAULT_ARABIC_FONT_OPTION)?.fontFamily;
  }
  const option = ARABIC_FONT_OPTIONS.find((o) => o.id === fontId);
  if (option?.fontFamily === 'System') return undefined;
  return option?.fontFamily;
};
