const ARABIC_DIACRITICS_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08FF]/;
const ARABIC_DIACRITICS_GLOBAL_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D4-\u08FF]/g;

const isIgnoredSearchChar = (char: string): boolean =>
  char === '\u0640' || ARABIC_DIACRITICS_REGEX.test(char);

const normalizeArabicCharForSearch = (char: string): string => {
  if (isIgnoredSearchChar(char)) return '';

  switch (char) {
    case 'إ':
    case 'أ':
    case 'آ':
    case 'ٱ':
      return 'ا';
    case 'ؤ':
      return 'و';
    case 'ئ':
    case 'ى':
      return 'ي';
    case 'ة':
      return 'ه';
    default:
      return char.toLowerCase();
  }
};

const buildNormalizedWithMap = (value: string): { normalized: string; map: number[] } => {
  let normalized = '';
  const map: number[] = [];
  let previousWasSpace = false;

  for (let index = 0; index < value.length; index += 1) {
    const normalizedChar = normalizeArabicCharForSearch(value[index]);
    if (!normalizedChar) continue;

    if (/\s/.test(normalizedChar)) {
      if (previousWasSpace) continue;
      previousWasSpace = true;
      normalized += ' ';
      map.push(index);
      continue;
    }

    previousWasSpace = false;
    normalized += normalizedChar;
    map.push(index);
  }

  let start = 0;
  while (start < normalized.length && normalized[start] === ' ') start += 1;
  let end = normalized.length;
  while (end > start && normalized[end - 1] === ' ') end -= 1;

  return {
    normalized: normalized.slice(start, end),
    map: map.slice(start, end),
  };
};

export const stripArabicDiacritics = (value: string): string =>
  value
    .replace(ARABIC_DIACRITICS_GLOBAL_REGEX, '')
    .replace(/\u0640/g, '');

export const normalizeArabicForSearch = (value: string): string =>
  buildNormalizedWithMap(value).normalized;

export const findSearchMatchRange = (
  text: string,
  query: string
): { start: number; end: number } | null => {
  const normalizedQuery = normalizeArabicForSearch(query);
  if (!normalizedQuery) return null;

  const { normalized: normalizedText, map } = buildNormalizedWithMap(text);
  const normalizedStart = normalizedText.indexOf(normalizedQuery);
  if (normalizedStart < 0) return null;

  const normalizedEnd = normalizedStart + normalizedQuery.length - 1;
  const start = map[normalizedStart];
  let end = map[normalizedEnd] + 1;
  while (end < text.length && isIgnoredSearchChar(text[end])) {
    end += 1;
  }
  if (start === undefined || end === undefined) return null;

  return { start, end };
};
