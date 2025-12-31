// src/services/quranApi.ts
import axios from 'axios';

const BASE_URL = 'https://api.quran.com/api/v4';

export const fetchSurahs = async () => {
  const { data } = await axios.get(`${BASE_URL}/chapters`);
  return data.chapters;
};

// Keep this exactly as your working version — audio depends on it
export const fetchAyahs = async (chapterId: number) => {
  const { data } = await axios.get(
    `${BASE_URL}/verses/by_chapter/${chapterId}?fields=text_uthmani&per_page=1000`
  );
  return data.verses;
};

// New: Separate call for English translation (Saheeh International - ID 131)
export const fetchTranslations = async (chapterId: number) => {
  const { data } = await axios.get(`${BASE_URL}/quran/translations/85`, {
    params: {
      chapter_number: chapterId,
    },
  });
  return data.translations;
};