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
  shortDescription: string;
}

export const fetchSurahInfo = async (chapterId: number, lang?: string): Promise<SurahInfo | null> => {
  try {
    const infoLang = lang === 'ar' ? 'ar' : 'en';
    const [chapRes, infoRes] = await Promise.all([
      axios.get(`${BASE_URL}/chapters/${chapterId}`),
      axios.get(`${BASE_URL}/chapters/${chapterId}/info?language=${infoLang}`).catch(() => null),
    ]);
    const ch = chapRes.data.chapter;
    const shortText = infoRes?.data?.chapter_info?.short_text ?? '';
    return {
      revelationPlace: ch.revelation_place,
      revelationOrder: ch.revelation_order,
      nameSimple: ch.name_simple,
      nameArabic: ch.name_arabic,
      versesCount: ch.verses_count,
      translatedName: ch.translated_name?.name ?? '',
      shortDescription: shortText,
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

const TAJWEED_RULE_NAMES: Record<string, { en: string; ar: string; color: string; descEn: string; descAr: string }> = {
  ghunnah: {
    en: 'Ghunnah (Nasalization)', ar: 'غنّة', color: '#FF9F40',
    descEn: 'Ghunnah is a nasal sound produced from the nose for approximately two counts. It occurs with the letters Noon (ن) and Meem (م) when they carry a shaddah. Hold the sound in your nasal passage while keeping your tongue relaxed. Example: "إنَّ" — the doubled Noon produces a clear nasal hum.',
    descAr: 'الغنّة صوت أنفي يخرج من الخيشوم بمقدار حركتين. تظهر عند النون والميم المشددتين. يُحبس الصوت في الأنف مع إرخاء اللسان. مثال: "إنَّ" — النون المشددة تُصدر صوتاً أنفياً واضحاً.',
  },
  ham_wasl: {
    en: 'Hamzat al-Wasl', ar: 'همزة الوصل', color: '#B0B0B0',
    descEn: 'Hamzat al-Wasl is a connecting hamza that is pronounced only at the beginning of speech but dropped when connected to the preceding word. It appears at the start of certain nouns, verbs, and particles like "ال" (the definite article). Example: "بِسْمِ اللَّهِ" — the alif of "الله" is silent because it connects to the previous word.',
    descAr: 'همزة الوصل تُنطق في بداية الكلام وتسقط عند الوصل بما قبلها. تأتي في أول بعض الأسماء والأفعال والحروف مثل "ال" التعريف. مثال: "بِسْمِ اللَّهِ" — ألف "الله" لا تُنطق لأنها موصولة بما قبلها.',
  },
  idgham_ghunnah: {
    en: 'Idgham with Ghunnah', ar: 'إدغام بغنّة', color: '#2EE87A',
    descEn: 'Idgham with Ghunnah occurs when a Noon Sakinah or Tanween is followed by one of four letters: Ya (ي), Noon (ن), Meem (م), or Waw (و) — remembered as "ينمو". The Noon merges into the following letter with a nasal sound held for two counts. Example: "مَن يَعمَل" is read as "مَيَّعمَل" with ghunnah.',
    descAr: 'الإدغام بغنة يحدث عندما تأتي النون الساكنة أو التنوين قبل أحد حروف "ينمو". تُدغم النون في الحرف التالي مع غنة بمقدار حركتين. مثال: "مَن يَعمَل" تُقرأ "مَيَّعمَل" مع غنة.',
  },
  idgham_mutajanisayn: {
    en: 'Idgham Mutajanisayn', ar: 'إدغام متجانسين', color: '#E0C878',
    descEn: 'Idgham Mutajanisayn occurs when two letters share the same articulation point but differ in characteristics. The first letter merges into the second. Examples include: Ta (ت) into Da (د), Tha (ذ) into Dha (ظ), and Ba (ب) into Meem (م). Example: "إِذ ظَّلَمُوا" — the Dhal merges into Dha.',
    descAr: 'الإدغام المتجانسين يحدث عند التقاء حرفين يتفقان في المخرج ويختلفان في الصفات، فيُدغم الأول في الثاني. مثل: التاء في الدال، والذال في الظاء. مثال: "إِذ ظَّلَمُوا" — الذال تُدغم في الظاء.',
  },
  idgham_shafawi: {
    en: 'Idgham Shafawi', ar: 'إدغام شفوي', color: '#7BEDA5',
    descEn: 'Idgham Shafawi occurs when a Meem Sakinah (مْ) is followed by another Meem (م). The two Meems merge into one with a shaddah and ghunnah for two counts. It is called "shafawi" (labial) because Meem is articulated from the lips. Example: "لَهُم مَّا" — the two Meems merge with nasal sound.',
    descAr: 'الإدغام الشفوي يحدث عند التقاء ميم ساكنة بميم متحركة، فتُدغمان في ميم واحدة مشددة مع غنة بمقدار حركتين. سُمي شفوياً لأن الميم تخرج من الشفتين. مثال: "لَهُم مَّا" — الميمان تندمجان مع غنة.',
  },
  idgham_wo_ghunnah: {
    en: 'Idgham without Ghunnah', ar: 'إدغام بلا غنّة', color: '#40C8A0',
    descEn: 'Idgham without Ghunnah occurs when a Noon Sakinah or Tanween is followed by Lam (ل) or Ra (ر). The Noon merges completely into the following letter without any nasal sound. The merging is complete with no trace of the Noon remaining. Example: "مِن رَّبِّهِم" is read as "مِرَّبِّهِم".',
    descAr: 'الإدغام بلا غنة يحدث عند مجيء النون الساكنة أو التنوين قبل اللام أو الراء. تُدغم النون في الحرف التالي بدون غنة إدغاماً كاملاً. مثال: "مِن رَّبِّهِم" تُقرأ "مِرَّبِّهِم".',
  },
  ikhafa: {
    en: 'Ikhfa (Concealment)', ar: 'إخفاء', color: '#E84BE0',
    descEn: 'Ikhfa means to conceal the Noon Sakinah or Tanween when followed by one of 15 letters (excluding those used in Idgham, Iqlab, and Idhar). The Noon is neither fully pronounced nor fully merged — it is hidden with a light ghunnah. The tongue position adjusts toward the following letter. Example: "مِنْ قَبْلِ" — the Noon is concealed before Qaf.',
    descAr: 'الإخفاء هو النطق بالنون الساكنة أو التنوين بحالة بين الإظهار والإدغام مع بقاء الغنة عند أحد حروفه الخمسة عشر. يتحول مخرج النون نحو الحرف التالي. مثال: "مِنْ قَبْلِ" — النون تُخفى قبل القاف.',
  },
  ikhafa_shafawi: {
    en: 'Ikhfa Shafawi', ar: 'إخفاء شفوي', color: '#C88BF0',
    descEn: 'Ikhfa Shafawi occurs when a Meem Sakinah (مْ) is followed by a Ba (ب). The Meem is concealed (not fully pronounced) with a light ghunnah for two counts while the lips remain close together. It is called "shafawi" because both letters are labial. Example: "تَرْمِيهِم بِحِجَارَة" — the Meem is concealed before Ba.',
    descAr: 'الإخفاء الشفوي يحدث عند التقاء ميم ساكنة بحرف الباء. تُخفى الميم مع غنة بمقدار حركتين والشفتان منطبقتان. سُمي شفوياً لأن الحرفين يخرجان من الشفتين. مثال: "تَرْمِيهِم بِحِجَارَة" — الميم تُخفى قبل الباء.',
  },
  iqlab: {
    en: 'Iqlab (Conversion)', ar: 'إقلاب', color: '#4DD4FF',
    descEn: 'Iqlab means converting the Noon Sakinah or Tanween into a Meem sound when followed by the letter Ba (ب). The converted Meem is then concealed with ghunnah for two counts. This is the only letter that triggers Iqlab. Example: "مِنْ بَعْدِ" is read as "مِمْبَعْدِ" with the Noon becoming a hidden Meem.',
    descAr: 'الإقلاب هو قلب النون الساكنة أو التنوين ميماً مخفاة مع غنة بمقدار حركتين عند حرف الباء. وهو الحرف الوحيد الذي يُوجب الإقلاب. مثال: "مِنْ بَعْدِ" تُقرأ "مِمْبَعْدِ" بقلب النون ميماً مخفاة.',
  },
  laam_shamsiyah: {
    en: 'Lam Shamsiyyah', ar: 'لام شمسية', color: '#D4A8FF',
    descEn: 'Lam Shamsiyyah (Sun Lam) occurs when the Lam of the definite article "ال" is followed by one of 14 "sun letters." The Lam becomes silent and the following letter is doubled (shaddah). The sun letters are: ت ث د ذ ر ز س ش ص ض ط ظ ل ن. Example: "الشَّمْس" — the Lam is silent and the Shin is doubled.',
    descAr: 'اللام الشمسية تحدث عندما تأتي لام "ال" التعريف قبل أحد الحروف الشمسية الأربعة عشر. تصبح اللام ساكنة ويُشدد الحرف التالي. الحروف الشمسية: ت ث د ذ ر ز س ش ص ض ط ظ ل ن. مثال: "الشَّمْس" — اللام لا تُنطق والشين مشددة.',
  },
  madda_normal: {
    en: 'Madd (Normal)', ar: 'مدّ طبيعي', color: '#5B9BFF',
    descEn: 'Madd Tabii (Natural Elongation) is the basic elongation of a vowel sound for exactly two counts. It occurs with the three madd letters: Alif (ا) after Fathah, Waw (و) after Dammah, and Ya (ي) after Kasrah, when no hamza or sukoon follows. Example: "قَالَ" — the Alif after Fathah is held for two counts.',
    descAr: 'المدّ الطبيعي هو إطالة الصوت بمقدار حركتين عند أحد حروف المد الثلاثة: الألف بعد الفتحة، والواو بعد الضمة، والياء بعد الكسرة، بشرط عدم وجود همزة أو سكون بعده. مثال: "قَالَ" — الألف بعد الفتحة تُمدّ حركتين.',
  },
  madda_necessary: {
    en: 'Madd Lazim (Necessary)', ar: 'مدّ لازم', color: '#3D6BFF',
    descEn: 'Madd Lazim (Necessary Elongation) occurs when a madd letter is followed by a letter with shaddah or sukoon in the same word. It is elongated for six counts obligatorily. This is the longest madd in tajweed. Example: "الْحَاقَّة" — the Alif before Qaf with shaddah requires six-count elongation.',
    descAr: 'المدّ اللازم يحدث عند مجيء حرف مد قبل حرف مشدد أو ساكن سكوناً أصلياً في نفس الكلمة. يُمدّ ست حركات وجوباً وهو أطول أنواع المد. مثال: "الْحَاقَّة" — الألف قبل القاف المشددة تُمدّ ست حركات.',
  },
  madda_obligatory: {
    en: 'Madd Wajib (Obligatory)', ar: 'مدّ واجب', color: '#70B8FF',
    descEn: 'Madd Wajib Muttasil (Connected Obligatory Elongation) occurs when a madd letter is followed by a hamza within the same word. It is elongated for four to five counts. Example: "جَاءَ" — the Alif is followed by Hamza in the same word, requiring elongation of 4-5 counts.',
    descAr: 'المدّ الواجب المتصل يحدث عند مجيء حرف مد قبل همزة في نفس الكلمة. يُمدّ أربع أو خمس حركات. مثال: "جَاءَ" — الألف قبل الهمزة في نفس الكلمة تُمدّ ٤-٥ حركات.',
  },
  madda_permissible: {
    en: 'Madd Ja\'iz (Permissible)', ar: 'مدّ جائز', color: '#A0D0FF',
    descEn: 'Madd Ja\'iz Munfasil (Separated Permissible Elongation) occurs when a madd letter at the end of a word is followed by a hamza at the beginning of the next word. It may be elongated for two, four, or five counts. Example: "فِي أَنفُسِهِمْ" — the Ya at the end of "في" meets the Hamza of "أنفسهم".',
    descAr: 'المدّ الجائز المنفصل يحدث عند مجيء حرف مد في آخر كلمة وهمزة في أول الكلمة التالية. يجوز مدّه حركتين أو أربع أو خمس. مثال: "فِي أَنفُسِهِمْ" — الياء في آخر "في" تلتقي بهمزة "أنفسهم".',
  },
  qalaqah: {
    en: 'Qalqalah (Echo)', ar: 'قلقلة', color: '#FF4D4D',
    descEn: 'Qalqalah is a slight bouncing or echoing sound produced when one of five letters — Qaf (ق), Taa (ط), Ba (ب), Jim (ج), Dal (د), remembered as "قطب جد" — has a sukoon. The letter is given a slight vibration rather than a full stop. Qalqalah is stronger at the end of a word or verse. Example: "أَحَدْ" — the Dal at the end has a clear echoing sound.',
    descAr: 'القلقلة اهتزاز صوتي يحدث عند سكون أحد حروفها الخمسة: ق ط ب ج د (قطب جد). يُنطق الحرف بنبرة ارتدادية بدلاً من السكون التام. تكون القلقلة أقوى في نهاية الكلمة أو الآية. مثال: "أَحَدْ" — الدال الساكنة في الآخر لها صوت قلقلة واضح.',
  },
  slnt: {
    en: 'Silent Letter', ar: 'حرف ساكن', color: '#88A8B8',
    descEn: 'A silent letter is a letter that is written in the Uthmani script but is not pronounced during recitation. These letters serve orthographic or grammatical purposes. They often appear as Alif after Waw al-Jama\'ah or in specific Quranic spellings. Example: "آمَنُوا" — the Alif after Waw is written but not pronounced.',
    descAr: 'الحرف الساكن هو حرف يُكتب في الرسم العثماني ولا يُنطق أثناء التلاوة. يأتي لأغراض إملائية أو نحوية، وغالباً يظهر كألف بعد واو الجماعة أو في رسم المصحف. مثال: "آمَنُوا" — الألف بعد الواو تُكتب ولا تُنطق.',
  },
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

const JUZ_START_PAGES: Record<number, number> = {
  1:1,2:22,3:42,4:62,5:82,6:102,7:121,8:142,9:162,10:182,
  11:201,12:222,13:242,14:262,15:282,16:302,17:322,18:342,19:362,20:382,
  21:402,22:422,23:442,24:462,25:482,26:502,27:522,28:542,29:562,30:582,
};

export const getJuzPageRange = (juzNumber: number): { start: number; end: number } => {
  const start = JUZ_START_PAGES[juzNumber] ?? 1;
  const nextJuz = JUZ_START_PAGES[juzNumber + 1];
  const end = nextJuz ? nextJuz - 1 : 604;
  return { start, end };
};

export const fetchVersePageNumber = async (surahId: number, ayahNum: number): Promise<number | null> => {
  try {
    const { data } = await axios.get(`${BASE_URL}/verses/by_key/${surahId}:${ayahNum}?fields=page_number`);
    return data.verse?.page_number ?? null;
  } catch {
    return null;
  }
};

