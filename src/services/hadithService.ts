import dailyHadiths from '../data/dailyHadiths.json';

export type DailyHadith = {
  arabic: string;
  english: string;
  source: string;
};

export const fetchRandomDailyHadith = async (): Promise<DailyHadith | null> => {
  if (!dailyHadiths.length) return null;

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const index = dayOfYear % dailyHadiths.length;

  return dailyHadiths[index] as DailyHadith;
};
