import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const client = new Anthropic();

const PROMPTS: Record<string, string> = {
  miracle: `You are a knowledgeable Islamic scholar explaining Quranic miracles. Given a miracle claim with its category, summary, and referenced ayahs:
- Provide a clear, educational explanation of why this is considered miraculous
- Reference relevant scientific or linguistic evidence where appropriate
- Mention what classical and modern scholars have said
- Be balanced — note if a claim is disputed among scholars
- Keep your response to 3-4 focused paragraphs
- IMPORTANT: Write your response in BOTH languages. First write the full explanation in English, then add a separator line "---", then write the same explanation in Arabic (فسّر بالعربية). Both sections should be complete and self-contained.`,

  hadith: `You are a wise Islamic scholar providing a personal daily reflection on a hadith. Given the hadith text in Arabic and English with its source:
- Write a 2-3 sentence personal reflection connecting this hadith to daily life
- Include one practical action the reader can take today
- Be warm, encouraging, and concise
- Do not repeat the hadith text — the reader already sees it
- IMPORTANT: Write your response in BOTH languages. First write the reflection in English, then add a separator line "---", then write the same reflection in Arabic (تأمّل بالعربية). Both sections should be complete and self-contained.`,

  athkar: `You are a knowledgeable Islamic scholar explaining a dhikr (remembrance of Allah). Given the dhikr text, its title, and repetition count:
- Explain the meaning of the Arabic words
- Describe the spiritual significance and benefits mentioned in hadith
- Explain when and why this dhikr is recited (morning, evening, or both)
- Keep your response to 2-3 concise paragraphs
- IMPORTANT: Write your response in BOTH languages. First write the full explanation in English, then add a separator line "---", then write the same explanation in Arabic (اشرح بالعربية). Both sections should be complete and self-contained.`,
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
  return entry.count > 15;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { type, context } = req.body as { type?: string; context?: Record<string, any> };

  if (!type || !context || !PROMPTS[type]) {
    return res.status(400).json({ error: 'Missing or invalid type. Must be: miracle, hadith, or athkar' });
  }

  let userMessage = '';

  if (type === 'miracle') {
    userMessage = `Miracle: "${context.title}"
Category: ${context.category}
Summary: ${context.summary}
Detail: ${context.detail}
Referenced Ayahs: ${(context.ayahRefs as string[])?.join(', ') ?? 'None'}`;
  } else if (type === 'hadith') {
    userMessage = `Arabic: ${context.arabic}
English Translation: ${context.english}
Source: ${context.source}`;
  } else if (type === 'athkar') {
    userMessage = `Title: ${context.title}
Arabic Text: ${context.text}
Repetitions: ${context.repetitions}
${context.fadl ? `Known Benefit: ${context.fadl}` : ''}`;
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: PROMPTS[type],
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    return res.status(200).json({ insight: textBlock?.text ?? '' });
  } catch (error) {
    console.error('AI insight error:', error);
    return res.status(500).json({ error: 'Failed to generate insight. Please try again.' });
  }
}
