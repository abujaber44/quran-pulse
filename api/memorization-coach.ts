import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a Quran memorization coach. Given a list of verses the user is memorizing and their quiz history, generate 3-5 quiz questions to test their knowledge.

RULES:
- Only create questions from the provided verses — never reference verses not in the list
- Weight questions toward verses the user has gotten wrong (shown in history)
- Return a raw JSON array (no markdown, no code blocks)
- Mix question types for variety

Question types:
1. "identify_surah" — Show part of a verse, ask which surah it's from (4 options, 1 correct)
2. "next_ayah" — Show a verse, ask what comes next (if consecutive verses exist in the list)
3. "fill_blank" — Show a verse with a key word replaced by "___", give 4 options

Each question must have:
- type: "identify_surah" | "next_ayah" | "fill_blank"
- prompt: the question text (include Arabic if relevant)
- options: array of 4 strings
- correctAnswer: the correct option string (must match one of the options exactly)
- verseKey: which verse this tests (e.g. "2:255")
- surahId: number
- ayahNumber: number

Example:
[{"type":"identify_surah","prompt":"Which surah contains: 'Allah - there is no deity except Him, the Ever-Living...'?","options":["Al-Baqarah","Al-Imran","An-Nisa","Al-Maidah"],"correctAnswer":"Al-Baqarah","verseKey":"2:255","surahId":2,"ayahNumber":255}]`;

interface BookmarkInput {
  surahId: number;
  surahName: string;
  ayahNum: number;
  ayahText: string;
  translation: string;
}

interface HistoryInput {
  verseKey: string;
  correct: boolean;
  timestamp: number;
}

const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 10;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { bookmarks, history } = req.body as { bookmarks?: BookmarkInput[]; history?: HistoryInput[] };

  if (!bookmarks || bookmarks.length < 1) {
    return res.status(400).json({ error: 'At least 1 memorized ayah is needed for a quiz.' });
  }

  const versesContext = bookmarks
    .map((b) => `- ${b.surahName} ${b.surahId}:${b.ayahNum} — "${b.ayahText}" (${b.translation})`)
    .join('\n');

  let historyContext = '';
  if (history && history.length > 0) {
    const weakVerses = history
      .filter((h) => !h.correct)
      .map((h) => h.verseKey);
    if (weakVerses.length > 0) {
      historyContext = `\n\nThe user has previously gotten these verses WRONG — prioritize them: ${weakVerses.join(', ')}`;
    }
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here are the verses I'm memorizing:\n${versesContext}${historyContext}\n\nGenerate a quiz for me.`,
        },
      ],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const text = textBlock?.text ?? '[]';

    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    let questions;
    try {
      questions = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse AI response:', text);
      questions = [];
    }

    const validated = (questions as any[]).filter(
      (q: any) =>
        typeof q.type === 'string' &&
        typeof q.prompt === 'string' &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        typeof q.correctAnswer === 'string' &&
        typeof q.verseKey === 'string',
    );

    return res.status(200).json({ questions: validated });
  } catch (error) {
    console.error('Quiz generation error:', error);
    return res.status(500).json({ error: 'Failed to generate quiz. Please try again.' });
  }
}
