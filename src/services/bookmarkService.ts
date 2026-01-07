import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOKMARKS_KEY = 'quran_pulse_bookmarks';

export interface Bookmark {
  surahId: number;
  surahName: string;
  ayahNum: number;
  ayahText: string;
  translation: string;
  timestamp: number;
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
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load bookmarks', error);
    return [];
  }
};

export const isBookmarked = async (surahId: number, ayahNum: number): Promise<boolean> => {
  const bookmarks = await getBookmarks();
  return bookmarks.some(b => b.surahId === surahId && b.ayahNum === ayahNum);
};