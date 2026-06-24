import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@quran_pulse_search_history';
const MAX_ITEMS = 20;

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultCount: number;
}

export async function getSearchHistory(): Promise<SearchHistoryItem[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as SearchHistoryItem[];
}

export async function addSearchHistory(query: string, resultCount: number): Promise<void> {
  const history = await getSearchHistory();
  const filtered = history.filter(h => h.query.toLowerCase() !== query.toLowerCase());
  filtered.unshift({ query, timestamp: Date.now(), resultCount });
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_ITEMS)));
}

export async function clearSearchHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
