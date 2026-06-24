const AI_API_BASE = process.env.EXPO_PUBLIC_AI_API_URL ?? 'http://localhost:3000';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export interface SearchResult {
  surahId: number;
  surahName: string;
  ayahNumber: number;
  verseKey: string;
  translation: string;
  relevance: string;
}

export interface QuizQuestion {
  type: 'identify_surah' | 'next_ayah' | 'fill_blank';
  prompt: string;
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
  return data.results;
}

export async function getMemorizationQuiz(
  bookmarks: BookmarkForQuiz[],
  history: QuizHistoryEntry[],
  signal?: AbortSignal,
): Promise<QuizQuestion[]> {
  const response = await fetch(`${AI_API_BASE}/api/memorization-coach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookmarks, history }),
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
  return data.insight;
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
