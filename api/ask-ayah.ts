import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const client = new Anthropic();

const SYSTEM_PROMPTS: Record<string, string> = {
  en: `You are a knowledgeable Islamic scholar and Quran teacher. Answer questions about Quranic verses grounding your responses in classical tafsir sources (Ibn Kathir, Al-Tabari, Al-Qurtubi, Al-Sa'di).

Guidelines:
- Always reference which tafsir source you are drawing from
- Be respectful, precise, and educational
- When discussing Arabic grammar or linguistics, explain clearly for non-Arabic speakers
- If a question is outside your knowledge, say so honestly
- Keep responses focused and concise (2-4 paragraphs)
- You may reference related verses when relevant
- Respond entirely in English.`,

  ar: `أنت عالم إسلامي ومعلم قرآن ذو خبرة واسعة. أجب عن أسئلة الآيات القرآنية مستنداً إلى مصادر التفسير الكلاسيكية (ابن كثير، الطبري، القرطبي، السعدي).

الإرشادات:
- اذكر دائماً مصدر التفسير الذي تستند إليه
- كن محترماً ودقيقاً وتعليمياً
- إذا كان السؤال خارج نطاق معرفتك، قل ذلك بصدق
- اجعل الإجابات مركّزة وموجزة (2-4 فقرات)
- يمكنك الإشارة إلى آيات ذات صلة عند الحاجة
- أجب بالكامل باللغة العربية.`,
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  surahName: string;
  ayahNumber: number;
  verseKey: string;
  arabicText: string;
  translation: string;
  question: string;
  conversationHistory: ChatMessage[];
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

  const { surahName, ayahNumber, verseKey, arabicText, translation, question, conversationHistory, lang } = req.body as RequestBody & { lang?: string };

  if (!question || !verseKey) {
    return res.status(400).json({ error: 'Missing required fields: question, verseKey' });
  }

  const systemPrompt = SYSTEM_PROMPTS[lang === 'ar' ? 'ar' : 'en'];
  const contextPrompt = `The user is asking about Surah ${surahName}, Ayah ${ayahNumber} (${verseKey}):\n\nArabic: ${arabicText}\nTranslation: ${translation}`;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: contextPrompt },
    { role: 'assistant', content: lang === 'ar' ? 'فهمت. سأجيب عن أسئلة هذه الآية مستنداً إلى التفسير الكلاسيكي.' : 'I understand. I will answer questions about this ayah grounding my responses in classical tafsir.' },
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: question },
  ];

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    return res.status(200).json({ answer: textBlock?.text ?? '' });
  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: 'Failed to get AI response. Please try again.' });
  }
}
