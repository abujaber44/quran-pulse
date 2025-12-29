import axios from 'axios';
import { Surah, Ayah } from '../types';

const BASE_URL = 'https://api.quran.com/api/v4';

export const fetchSurahs = async (): Promise<Surah[]> => {
  const { data } = await axios.get(`${BASE_URL}/chapters`);
  return data.chapters;
};

export const fetchAyahs = async (chapterId: number): Promise<Ayah[]> => {
  const { data } = await axios.get(
    `${BASE_URL}/verses/by_chapter/${chapterId}?fields=text_uthmani&per_page=1000`
  );
  return data.verses;
};