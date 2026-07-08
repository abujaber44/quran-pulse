import AsyncStorage from '@react-native-async-storage/async-storage';

const AI_API_BASE = process.env.EXPO_PUBLIC_AI_API_URL ?? 'http://localhost:3000';

const CACHE_PREFIX = '@qp_ai_cache:';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function cacheKey(parts: unknown[]): string {
  return CACHE_PREFIX + parts.map(p => typeof p === 'string' ? p : JSON.stringify(p)).join('|');
}

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw) as { ts: number; data: T };
    if (Date.now() - ts > CACHE_TTL_MS) {
      void AsyncStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCache(key: string, data: unknown): void {
  void AsyncStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })).catch(() => {});
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export interface SearchResult {
  surahId: number;
  surahName: string;
  ayahNumber: number;
  verseKey: string;
  translation: string;
  relevance: string;
}

export interface QuizScopeInfo {
  type: 'bookmarks' | 'surah' | 'juz';
  /** Distinct surahs in the verse pool — 1 means identify_surah is pointless */
  surahCount: number;
}

export interface QuizQuestion {
  type: 'identify_surah' | 'next_ayah' | 'fill_blank' | 'correct_wording';
  prompt: string;
  /** Arabic verse text/excerpt, rendered on its own line under the prompt */
  ayahText?: string;
  options: string[];
  correctAnswer: string;
  verseKey: string;
  surahId: number;
  ayahNumber: number;
}

export interface BookmarkForQuiz {
  surahId: number;
  surahName: string;
  ayahNum: number;
  ayahText: string;
  translation: string;
}

export interface QuizHistoryEntry {
  verseKey: string;
  correct: boolean;
  timestamp: number;
}

export async function askAboutAyah(params: {
  surahName: string;
  ayahNumber: number;
  verseKey: string;
  arabicText: string;
  translation: string;
  question: string;
  conversationHistory: ChatMessage[];
  signal?: AbortSignal;
  lang?: string;
}): Promise<string> {
  const { signal, ...body } = params;

  const response = await fetch(`${AI_API_BASE}/api/ask-ayah`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as { error?: string }).error ?? 'Failed to get AI response');
  }

  const data = (await response.json()) as { answer: string };
  return data.answer;
}

export async function searchVerses(
  query: string,
  signal?: AbortSignal,
  lang?: string,
): Promise<SearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase();
  const key = cacheKey(['search', normalizedQuery, lang ?? 'en']);
  const cached = await getCached<SearchResult[]>(key);
  // An empty cached array is treated as a miss: a transient backend failure
  // (e.g. truncated AI output) must not pin a query to "no results" for the
  // whole cache TTL on this device.
  if (cached && cached.length > 0) return cached;

  const response = await fetch(`${AI_API_BASE}/api/search-verses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, lang: lang ?? 'en' }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as { error?: string }).error ?? 'Search failed');
  }

  const data = (await response.json()) as { results: SearchResult[] };
  if (data.results.length > 0) {
    setCache(key, data.results);
  }
  return data.results;
}

export async function getMemorizationQuiz(
  bookmarks: BookmarkForQuiz[],
  history: QuizHistoryEntry[],
  signal?: AbortSignal,
  lang?: string,
  scope?: QuizScopeInfo,
): Promise<QuizQuestion[]> {
  const response = await fetch(`${AI_API_BASE}/api/memorization-coach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookmarks, history, lang: lang ?? 'en', scope }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as { error?: string }).error ?? 'Failed to generate quiz');
  }

  const data = (await response.json()) as { questions: QuizQuestion[] };
  return data.questions;
}

export async function getAiInsight(
  type: 'miracle' | 'hadith' | 'athkar',
  context: Record<string, unknown>,
  signal?: AbortSignal,
  lang?: string,
): Promise<string> {
  const key = cacheKey(['insight', type, context, lang ?? 'en']);
  const cached = await getCached<string>(key);
  if (cached) return cached;

  const response = await fetch(`${AI_API_BASE}/api/ai-insight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, context, lang: lang ?? 'en' }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as { error?: string }).error ?? 'Failed to get AI insight');
  }

  const data = (await response.json()) as { insight: string };
  setCache(key, data.insight);
  return data.insight;
}

export type ShareIntention =
  | 'comfort'
  | 'congratulate'
  | 'condolence'
  | 'encouragement'
  | 'gratitude';

/**
 * A short AI note to accompany a shared ayah: a personal dedication when an
 * intention is given, or a single reflection sentence otherwise.
 * Deliberately uncached so "Regenerate" returns fresh text.
 */
export async function fetchShareNote(params: {
  surahName: string;
  verseKey: string;
  arabicText: string;
  translation: string;
  intention: ShareIntention | null;
  lang?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { signal, lang, intention, ...context } = params;

  const response = await fetch(`${AI_API_BASE}/api/ai-insight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'share',
      context: { ...context, intention: intention ?? '' },
      lang: lang ?? 'en',
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as { error?: string }).error ?? 'Failed to generate note');
  }

  const data = (await response.json()) as { insight: string };
  return data.insight.trim();
}

export interface DailyAyah {
  surahId: number;
  surahName: string;
  ayahNumber: number;
  verseKey: string;
  arabicText: string;
  translation: string;
  reason: string;
}

export async function fetchDailyPersonalizedAyah(
  recentSurahs: string[],
  bookmarkTags: string[],
  lang?: string,
  signal?: AbortSignal,
): Promise<DailyAyah | null> {
  const today = new Date().toISOString().split('T')[0];

  const response = await fetch(`${AI_API_BASE}/api/daily-ayah`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recentSurahs, bookmarkTags, today, lang: lang ?? 'en' }),
    signal,
  });

  if (!response.ok) return null;

  const data = (await response.json()) as { ayah: DailyAyah };
  return data.ayah ?? null;
}
