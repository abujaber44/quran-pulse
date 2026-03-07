import { getGlobalAyahNumber } from './quranUtils';

describe('getGlobalAyahNumber', () => {
  it('calculates the global ayah index based on prior surah verse counts', () => {
    const surahs = [
      { verses_count: 7 },
      { verses_count: 286 },
      { verses_count: 200 },
    ];

    expect(getGlobalAyahNumber(1, 1, surahs)).toBe(1);
    expect(getGlobalAyahNumber(2, 1, surahs)).toBe(8);
    expect(getGlobalAyahNumber(2, 286, surahs)).toBe(293);
    expect(getGlobalAyahNumber(3, 1, surahs)).toBe(294);
  });
});
