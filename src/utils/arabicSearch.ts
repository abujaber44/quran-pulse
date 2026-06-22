const DIACRITICS_RE = /[ؐ-ًؚ-ٰٟۖ-ۭࣔ-ࣿـ]/g;

const ALEF_VARIANTS_RE = /[إأآٱ]/g;
const WAW_HAMZA_RE = /ؤ/g;
const YAA_VARIANTS_RE = /[ئى]/g;
const TAA_MARBUTA_RE = /ة/g;

export function normalizeArabicForSearch(value: string): string {
  return value
    .replace(DIACRITICS_RE, '')
    .replace(ALEF_VARIANTS_RE, 'ا')
    .replace(WAW_HAMZA_RE, 'و')
    .replace(YAA_VARIANTS_RE, 'ي')
    .replace(TAA_MARBUTA_RE, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
