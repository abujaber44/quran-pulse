import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const client = new Anthropic();

const SYSTEM_PROMPTS: Record<string, string> = {
  en: `You are a Quran search engine. Given a conceptual query, return 5-10 relevant Quranic verses as a JSON array.

CRITICAL RULES:
- Only return REAL verses with accurate surah IDs (1-114) and ayah numbers
- Never fabricate or guess verse references
- Return the response as a raw JSON array (no markdown, no code blocks)
- Each item must have: surahId (number), surahName (string), ayahNumber (number), verseKey (string like "2:255"), translation (brief English translation), relevance (1-2 sentence explanation of why this verse is relevant)

Example response format:
[{"surahId":2,"surahName":"Al-Baqarah","ayahNumber":255,"verseKey":"2:255","translation":"Allah - there is no deity except Him, the Ever-Living, the Sustainer of existence...","relevance":"Known as Ayat al-Kursi, this verse emphasizes Allah's supreme power and sovereignty."}]`,

  ar: `أنت محرك بحث في القرآن الكريم. بناءً على استفسار مفاهيمي، أرجع 5-10 آيات قرآنية ذات صلة كمصفوفة JSON.

قواعد حاسمة:
- أرجع فقط آيات حقيقية بأرقام سور دقيقة (1-114) وأرقام آيات صحيحة
- لا تختلق أو تخمن مراجع الآيات
- أرجع الاستجابة كمصفوفة JSON خام (بدون markdown أو كتل كود)
- كل عنصر يجب أن يحتوي: surahId (رقم)، surahName (اسم السورة بالعربية)، ayahNumber (رقم)، verseKey (مثل "2:255")، translation (ترجمة/نص الآية بالعربية)، relevance (جملة أو اثنتان بالعربية توضح سبب صلة هذه الآية)

مثال:
[{"surahId":2,"surahName":"البقرة","ayahNumber":255,"verseKey":"2:255","translation":"اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...","relevance":"تُعرف بآية الكرسي، وتؤكد على قدرة الله المطلقة وسيادته."}]`,
};

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

  const { query, lang } = req.body as { query?: string; lang?: string };
  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  const systemPrompt = SYSTEM_PROMPTS[lang === 'ar' ? 'ar' : 'en'];

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      // Arabic searches (8-10 results with full ayah text + relevance) can
      // exceed 2048 output tokens; truncated JSON then parsed as "no results".
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Find Quranic verses about: ${query.trim()}` }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const text = textBlock?.text ?? '[]';

    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    let results;
    try {
      results = JSON.parse(cleaned);
    } catch {
      // Truncated output: salvage the complete result objects by cutting at
      // the last complete "}" and closing the array.
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace > 0) {
        try {
          results = JSON.parse(`${cleaned.slice(0, lastBrace + 1)}]`);
          console.warn(`Salvaged ${(results as any[]).length} results from truncated AI response`);
        } catch {
          results = [];
        }
      } else {
        results = [];
      }
      if (!Array.isArray(results) || results.length === 0) {
        console.error('Failed to parse AI response:', text.slice(0, 500));
        results = [];
      }
    }

    const validated = (results as any[]).filter(
      (r: any) =>
        typeof r.surahId === 'number' &&
        r.surahId >= 1 &&
        r.surahId <= 114 &&
        typeof r.ayahNumber === 'number' &&
        typeof r.verseKey === 'string',
    );

    return res.status(200).json({ results: validated });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: 'Search failed. Please try again.' });
  }
}
