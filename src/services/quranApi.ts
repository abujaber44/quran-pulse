// src/services/quranApi.ts
import axios from 'axios';

const BASE_URL = 'https://api.quran.com/api/v4';

export const fetchSurahs = async () => {
  const { data } = await axios.get(`${BASE_URL}/chapters`);
  return data.chapters;
};

export const fetchAyahs = async (chapterId: number) => {
  const { data } = await axios.get(
    `${BASE_URL}/verses/by_chapter/${chapterId}?fields=text_uthmani&per_page=1000`
  );
  return data.verses;
};

export const fetchTranslations = async (chapterId: number) => {
  const { data } = await axios.get(`${BASE_URL}/quran/translations/85`, {
    params: {
      chapter_number: chapterId,
    },
  });
  return data.translations;
};


export const fetchTafseer = async (suraNumber: number, ayahNumber: number) => {
  try {
    const response = await axios.get(
      `http://api.quran-tafseer.com/tafseer/1/${suraNumber}/${ayahNumber}`,
    );
    return response.data.text || 'Tafseer not available.';
  } catch (error) {
    console.error('Tafseer error:', error.message);
    return 'Failed to load tafseer. Check your internet connection.';
  }
};