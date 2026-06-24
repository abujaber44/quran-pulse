import axios from 'axios';

const BASE_URL = 'https://api.quran.com/api/v4';

export const fetchSurahs = async () => {
  const { data } = await axios.get(`${BASE_URL}/chapters`);
  return data.chapters;
};

import offlineQuran from '../data/quranText.json';

export const fetchAyahs = async (chapterId: number) => {
  try {
    const { data } = await axios.get(
      `${BASE_URL}/verses/by_chapter/${chapterId}?fields=text_uthmani&per_page=1000`
    );
    return data.verses;
  } catch {
    const surah = (offlineQuran as Record<string, { ayahs: Array<{ number: number; text: string }> }>)[String(chapterId)];
    if (!surah) return [];
    return surah.ayahs.map((a) => ({
      id: a.number,
      verse_number: a.number,
      verse_key: `${chapterId}:${a.number}`,
      text_uthmani: a.text,
    }));
  }
};

export const fetchTranslations = async (chapterId: number) => {
  const { data } = await axios.get(`${BASE_URL}/quran/translations/85`, {
    params: {
      chapter_number: chapterId,
    },
  });
  return data.translations;
};


export interface WordByWord {
  position: number;
  text_uthmani: string;
  translation: string;
  transliteration: string;
  char_type: string;
}

export const fetchWordByWord = async (chapterId: number, verseNumber: number): Promise<WordByWord[]> => {
  const { data } = await axios.get(
    `${BASE_URL}/verses/by_key/${chapterId}:${verseNumber}?language=en&words=true&word_fields=text_uthmani,translation`
  );
  const words = data.verse?.words;
  if (!Array.isArray(words)) return [];
  return words
    .filter((w: any) => w.char_type_name === 'word')
    .map((w: any) => ({
      position: w.position,
      text_uthmani: w.text_uthmani ?? w.text ?? '',
      translation: w.translation?.text ?? '',
      transliteration: w.transliteration?.text ?? '',
      char_type: w.char_type_name ?? 'word',
    }));
};

export interface SurahInfo {
  revelationPlace: 'makkah' | 'madinah';
  revelationOrder: number;
  nameSimple: string;
  nameArabic: string;
  versesCount: number;
  translatedName: string;
}

export const fetchSurahInfo = async (chapterId: number): Promise<SurahInfo | null> => {
  try {
    const { data } = await axios.get(`${BASE_URL}/chapters/${chapterId}`);
    const ch = data.chapter;
    return {
      revelationPlace: ch.revelation_place,
      revelationOrder: ch.revelation_order,
      nameSimple: ch.name_simple,
      nameArabic: ch.name_arabic,
      versesCount: ch.verses_count,
      translatedName: ch.translated_name?.name ?? '',
    };
  } catch {
    return null;
  }
};

export interface TajweedWord {
  text: string;
  rule: string | null;
}

export interface TajweedVerse {
  verseKey: string;
  words: TajweedWord[];
}

const TAJWEED_RULE_NAMES: Record<string, { en: string; ar: string; color: string }> = {
  ghunnah: { en: 'Ghunnah (Nasalization)', ar: 'غنّة', color: '#FF7F50' },
  ham_wasl: { en: 'Hamzat al-Wasl', ar: 'همزة الوصل', color: '#AAAAAA' },
  idgham_ghunnah: { en: 'Idgham with Ghunnah', ar: 'إدغام بغنّة', color: '#169200' },
  idgham_mutajanisayn: { en: 'Idgham Mutajanisayn', ar: 'إدغام متجانسين', color: '#A1A1A1' },
  idgham_shafawi: { en: 'Idgham Shafawi', ar: 'إدغام شفوي', color: '#169200' },
  idgham_wo_ghunnah: { en: 'Idgham without Ghunnah', ar: 'إدغام بلا غنّة', color: '#169200' },
  ikhafa: { en: 'Ikhfa (Concealment)', ar: 'إخفاء', color: '#D500B7' },
  ikhafa_shafawi: { en: 'Ikhfa Shafawi', ar: 'إخفاء شفوي', color: '#D500B7' },
  iqlab: { en: 'Iqlab (Conversion)', ar: 'إقلاب', color: '#26BFFD' },
  laam_shamsiyah: { en: 'Lam Shamsiyyah', ar: 'لام شمسية', color: '#AAAAAA' },
  madda_normal: { en: 'Madd (Normal)', ar: 'مدّ طبيعي', color: '#537FFF' },
  madda_necessary: { en: 'Madd Lazim (Necessary)', ar: 'مدّ لازم', color: '#000EBC' },
  madda_obligatory: { en: 'Madd Wajib (Obligatory)', ar: 'مدّ واجب', color: '#2144C1' },
  madda_permissible: { en: 'Madd Ja\'iz (Permissible)', ar: 'مدّ جائز', color: '#4050FF' },
  qalaqah: { en: 'Qalqalah (Echo)', ar: 'قلقلة', color: '#DD0008' },
  slnt: { en: 'Silent Letter', ar: 'حرف ساكن', color: '#AAAAAA' },
};

export const getTajweedRuleInfo = () => TAJWEED_RULE_NAMES;

export const fetchTajweedVerse = async (verseKey: string): Promise<TajweedVerse | null> => {
  try {
    const { data } = await axios.get(
      `${BASE_URL}/quran/verses/uthmani_tajweed?verse_key=${verseKey}`
    );
    const verse = data.verses?.[0];
    if (!verse?.text_uthmani_tajweed) return null;

    const raw = verse.text_uthmani_tajweed as string;
    const words: TajweedWord[] = [];
    const regex = /<tajweed class=(\w+)>(.*?)<\/tajweed>|<span class=\w+>.*?<\/span>|([^<]+)/g;
    let match;

    while ((match = regex.exec(raw)) !== null) {
      if (match[1] && match[2]) {
        words.push({ text: match[2], rule: match[1] });
      } else if (match[3]) {
        const cleaned = match[3].trim();
        if (cleaned) words.push({ text: cleaned, rule: null });
      }
    }

    return { verseKey, words };
  } catch {
    return null;
  }
};

export const fetchTafseer = async (
  surahId: number,
  ayahNum: number,
  signal?: AbortSignal
) => {
  try {
    const response = await fetch(
      `https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/ar-tafsir-muyassar/${surahId}/${ayahNum}.json`,
      { signal }
    );
    
    if (!response.ok) {
      return 'Tafseer not available for this verse.';
    }
    
    const data = await response.json();
    return data.text || 'Tafseer not available for this verse.';
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error; // Re-throw to be caught in toggleTafseer
    }
    console.error('Tafseer load error:', error);
    return 'Failed to load tafseer. Check your connection.';
  }
};

// List of reciters that require leading zeros (001.mp3 format)
const RECITERS_WITH_LEADING_ZEROS = new Set([
  'saud_ash-shuraym/murattal'
  
]);

// List of reciters that use the special format with double slash // + 3-digit (001.mp3)
const RECITERS_WITH_DOUBLE_SLASH = new Set([
  'ahmed_ibn_3ali_al-3ajamy',
  'maher_almu3aiqly/year1422-1423',
  'yasser_ad-dussary'
]);

export const getSurahAudioUrl = (reciterId: string, surahNumber: number): string => {
  let fileName: string;
  let pathSeparator = '/';

  if (RECITERS_WITH_LEADING_ZEROS.has(reciterId)) {
    fileName = surahNumber.toString().padStart(3, '0');
  } else {
    fileName = surahNumber.toString();
  }
  if (RECITERS_WITH_DOUBLE_SLASH.has(reciterId)) {
    pathSeparator = '//';
    fileName = surahNumber.toString().padStart(3, '0');

    return `https://download.quranicaudio.com/quran/${reciterId}${pathSeparator}${fileName}.mp3`;
  }
  return `https://download.quranicaudio.com/qdc/${reciterId}${pathSeparator}${fileName}.mp3`;
};