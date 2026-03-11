export type ArabicFontOptionId =
  | 'amiri_quran'
  | 'uthmanic_hafs_v22'
  | 'kfgqpc_nastaleeq'
  | 'digital_khatt_indopak'
  | 'system_arabic';

export type ArabicFontOption = {
  id: ArabicFontOptionId;
  label: string;
  fontFamily?: string;
};

export const DEFAULT_ARABIC_FONT_OPTION: ArabicFontOptionId = 'amiri_quran';

export const ARABIC_FONT_OPTIONS: ArabicFontOption[] = [
  { id: 'amiri_quran', label: 'Amiri Quran', fontFamily: 'AmiriQuran' },
  { id: 'uthmanic_hafs_v22', label: 'Uthmanic Hafs v22', fontFamily: 'UthmanicHafsV22' },
  { id: 'kfgqpc_nastaleeq', label: 'KFGQPC Nastaleeq', fontFamily: 'KFGQPCNastaleeq' },
  { id: 'digital_khatt_indopak', label: 'Digital Khatt IndoPak', fontFamily: 'DigitalKhattIndoPak' },
  { id: 'system_arabic', label: 'System Arabic', fontFamily: 'System' },
];

export const CUSTOM_FONT_ASSETS = {
  AmiriQuran: require('../../assets/fonts/Amiri-Regular.ttf'),
  UthmanicHafsV22: require('../../assets/fonts/UthmanicHafs_V22.ttf'),
  KFGQPCNastaleeq: require('../../assets/fonts/KFGQPCNastaleeq-Regular.ttf'),
  DigitalKhattIndoPak: require('../../assets/fonts/DigitalKhattIndoPak.otf'),
} as const;

export const isArabicFontOptionId = (value: unknown): value is ArabicFontOptionId =>
  typeof value === 'string' && ARABIC_FONT_OPTIONS.some((option) => option.id === value);

export const resolveArabicFontFamily = (fontId: unknown): string | undefined => {
  if (!isArabicFontOptionId(fontId)) {
    return ARABIC_FONT_OPTIONS.find((option) => option.id === DEFAULT_ARABIC_FONT_OPTION)?.fontFamily;
  }
  return ARABIC_FONT_OPTIONS.find((option) => option.id === fontId)?.fontFamily;
};
