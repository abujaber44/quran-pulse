import {
  findSearchMatchRange,
  normalizeArabicForSearch,
  stripArabicDiacritics,
} from './arabicSearch';

describe('stripArabicDiacritics', () => {
  it('removes Quranic diacritics and tatweel', () => {
    expect(stripArabicDiacritics('ٱلرَّحْمَٰن')).toBe('ٱلرحمن');
    expect(stripArabicDiacritics('ــالْقُرْآنُ')).toBe('القرآن');
    expect(stripArabicDiacritics('رَبِّ')).toBe('رب');
  });
});

describe('normalizeArabicForSearch', () => {
  it('normalizes common Arabic letter variants for search', () => {
    expect(normalizeArabicForSearch('إِنَّا')).toBe('انا');
    expect(normalizeArabicForSearch('قُرْآن')).toBe('قران');
    expect(normalizeArabicForSearch('الْهُدَى')).toBe('الهدي');
    expect(normalizeArabicForSearch('رَحْمَة')).toBe('رحمه');
  });

  it('makes with-diacritics and without-diacritics queries equivalent', () => {
    const surahName = 'ٱلْفَاتِحَة';
    const queryWithoutHarakat = 'الفاتحه';
    expect(normalizeArabicForSearch(surahName).includes(normalizeArabicForSearch(queryWithoutHarakat))).toBe(true);
  });
});

describe('findSearchMatchRange', () => {
  it('finds range when query omits diacritics', () => {
    const text = 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ';
    const query = 'الحمد لله';
    const range = findSearchMatchRange(text, query);
    expect(range).not.toBeNull();
    expect(text.slice(range!.start, range!.end)).toBe('ٱلْحَمْدُ لِلَّهِ');
  });

  it('finds range when query includes shadda/harakat', () => {
    const text = 'رَبِّ ٱلْعَٰلَمِينَ';
    const query = 'رب';
    const range = findSearchMatchRange(text, query);
    expect(range).not.toBeNull();
    expect(text.slice(range!.start, range!.end)).toBe('رَبِّ');
  });
});
