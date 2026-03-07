import axios from 'axios';

export type DailyHadith = {
  arabic: string;
  english: string;
  source: string;
};

type HadithApiRecord = {
  hadithArabic?: string;
  hadithEnglish?: string;
  book?: { bookName?: string };
};

const HADITH_API_URL = 'https://hadithapi.com/public/api/hadiths';

const getHadithApiKey = (): string => {
  const raw = process.env.EXPO_PUBLIC_HADITH_API_KEY;
  if (typeof raw !== 'string') return '';

  // Support accidental quoted values and escaped dollar signs from env files.
  return raw
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\\$/g, '$');
};

export const fetchRandomDailyHadith = async (): Promise<DailyHadith | null> => {
  const apiKey = getHadithApiKey();
  if (!apiKey) {
    console.warn('Hadith API key is missing. Set EXPO_PUBLIC_HADITH_API_KEY.');
    return null;
  }

  const response = await axios.get(HADITH_API_URL, {
    params: { apiKey },
  });

  const hadithList: HadithApiRecord[] | undefined = response?.data?.hadiths?.data;
  if (!Array.isArray(hadithList) || hadithList.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * hadithList.length);
  const hadith = hadithList[randomIndex];

  return {
    arabic: hadith.hadithArabic || 'No Arabic text available',
    english: hadith.hadithEnglish || 'No English text available',
    source: hadith.book?.bookName || 'Unknown source',
  };
};
