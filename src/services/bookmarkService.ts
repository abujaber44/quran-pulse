import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOKMARKS_KEY = 'quran_pulse_bookmarks';

export type BookmarkTag = 'memorize' | 'read_recite';

export interface Bookmark {
  surahId: number;
  surahName: string;
  ayahNum: number;
  ayahText: string;
  translation: string;
  timestamp: number;
  tag: BookmarkTag;
}

export const addBookmark = async (bookmark: Bookmark): Promise<void> => {
  try {
    const existing = await getBookmarks();
    const updated = [bookmark, ...existing.filter(
      b => !(b.surahId === bookmark.surahId && b.ayahNum === bookmark.ayahNum)
    )];
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to add bookmark', error);
  }
};

export const removeBookmark = async (surahId: number, ayahNum: number): Promise<void> => {
  try {
    const existing = await getBookmarks();
    const updated = existing.filter(b => !(b.surahId === surahId && b.ayahNum === ayahNum));
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to remove bookmark', error);
  }
};

export const getBookmarks = async (): Promise<Bookmark[]> => {
  try {
    const data = await AsyncStorage.getItem(BOOKMARKS_KEY);
    if (!data) return [];

    const parsed = JSON.parse(data) as Array<Partial<Bookmark> & {
      surahId?: unknown;
      surahName?: unknown;
      ayahNum?: unknown;
      ayahText?: unknown;
      translation?: unknown;
      timestamp?: unknown;
      tag?: unknown;
    }>;

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => typeof item.surahId === 'number' && typeof item.ayahNum === 'number')
      .map((item) => ({
        surahId: Number(item.surahId),
        surahName: typeof item.surahName === 'string' ? item.surahName : '',
        ayahNum: Number(item.ayahNum),
        ayahText: typeof item.ayahText === 'string' ? item.ayahText : '',
        translation: typeof item.translation === 'string' ? item.translation : '',
        timestamp: typeof item.timestamp === 'number' ? item.timestamp : Date.now(),
        tag: item.tag === 'memorize' || item.tag === 'read_recite' ? item.tag : 'read_recite',
      }));
  } catch (error) {
    console.error('Failed to load bookmarks', error);
    return [];
  }
};

export const isBookmarked = async (surahId: number, ayahNum: number): Promise<boolean> => {
  const bookmarks = await getBookmarks();
  return bookmarks.some(b => b.surahId === surahId && b.ayahNum === ayahNum);
};
