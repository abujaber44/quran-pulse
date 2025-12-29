export const getGlobalAyahNumber = (surahId: number, ayahNumber: number, surahs: any[]): number => {
  let total = 0;
  for (let i = 0; i < surahId - 1; i++) {
    total += surahs[i].verses_count;
  }
  return total + ayahNumber;
};