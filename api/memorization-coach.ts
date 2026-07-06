import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const client = new Anthropic();

function getSystemPrompt(lang: string) {
  if (lang === 'ar') {
    return `أنت مدرب حفظ القرآن الكريم. بناءً على قائمة الآيات التي يحفظها المستخدم وسجل اختباراته، أنشئ ٣-٥ أسئلة اختبار.

قواعد صارمة:
- جميع النصوص يجب أن تكون بالعربية فقط — لا تستخدم أي كلمة إنجليزية أبداً
- أنشئ الأسئلة فقط من الآيات المعطاة — لا تشر إلى آيات غير موجودة في القائمة
- ركّز على الآيات التي أخطأ فيها المستخدم سابقاً
- أعد مصفوفة JSON فقط (بدون markdown أو code blocks)
- نوّع بين أنواع الأسئلة
- استخدم أسماء السور بالعربية (مثل: "البقرة"، "آل عمران")
- اكتب السؤال في prompt بالعربية الكاملة

أنواع الأسئلة:
1. "identify_surah" — اعرض جزءاً من آية واسأل من أي سورة (٤ خيارات)
2. "next_ayah" — اعرض آية واسأل ماذا يأتي بعدها (إن وُجدت آيات متتالية)
3. "fill_blank" — اعرض آية مع كلمة محذوفة "___" وأعطِ ٤ خيارات

كل سؤال يجب أن يحتوي:
- type: "identify_surah" | "next_ayah" | "fill_blank"
- prompt: نص السؤال بالعربية
- options: مصفوفة من ٤ نصوص بالعربية
- correctAnswer: الخيار الصحيح (يجب أن يطابق أحد الخيارات تماماً)
- verseKey: مفتاح الآية (مثل "2:255")
- surahId: رقم السورة
- ayahNumber: رقم الآية

مثال:
[{"type":"identify_surah","prompt":"في أي سورة وردت هذه الآية: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ'؟","options":["البقرة","آل عمران","النساء","المائدة"],"correctAnswer":"البقرة","verseKey":"2:255","surahId":2,"ayahNumber":255}]`;
  }

  return `You are a Quran memorization coach. Given a list of verses the user is memorizing and their quiz history, generate 3-5 quiz questions to test their knowledge.

RULES:
- The user memorizes the Quran in ARABIC. Every verse quotation, verse excerpt, fill-in-the-blank text, and every answer option that contains verse text MUST use the original Arabic text exactly as provided — NEVER the English translation.
- Only the question wording itself (e.g. "Which surah contains this ayah?") is written in English. Surah-name options may use transliterated names (e.g. "Al-Baqarah").
- Only create questions from the provided verses — never reference verses not in the list
- Weight questions toward verses the user has gotten wrong (shown in history)
- Return a raw JSON array (no markdown, no code blocks)
- Mix question types for variety

Question types:
1. "identify_surah" — Show part of a verse in Arabic, ask which surah it's from (4 options, 1 correct)
2. "next_ayah" — Show a verse in Arabic, ask what comes next in Arabic (if consecutive verses exist in the list)
3. "fill_blank" — Show the Arabic verse with a key word replaced by "___", give 4 Arabic word options

Each question must have:
- type: "identify_surah" | "next_ayah" | "fill_blank"
- prompt: the question text (English wording, Arabic verse text)
- options: array of 4 strings
- correctAnswer: the correct option string (must match one of the options exactly)
- verseKey: which verse this tests (e.g. "2:255")
- surahId: number
- ayahNumber: number

Examples:
[{"type":"identify_surah","prompt":"Which surah contains this ayah: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ'?","options":["Al-Baqarah","Al-Imran","An-Nisa","Al-Maidah"],"correctAnswer":"Al-Baqarah","verseKey":"2:255","surahId":2,"ayahNumber":255},{"type":"fill_blank","prompt":"Complete the ayah: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ ___'","options":["الْقَيُّومُ","الْعَظِيمُ","الْكَرِيمُ","الْحَكِيمُ"],"correctAnswer":"الْقَيُّومُ","verseKey":"2:255","surahId":2,"ayahNumber":255}]`;
}

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

  const { bookmarks, history, lang } = req.body as { bookmarks?: BookmarkInput[]; history?: HistoryInput[]; lang?: string };

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
      system: getSystemPrompt(lang ?? 'en'),
      messages: [
        {
          role: 'user',
          content: lang === 'ar'
            ? `هذه الآيات التي أحفظها:\n${versesContext}${historyContext}\n\nأنشئ اختباراً لي باللغة العربية.`
            : `Here are the verses I'm memorizing:\n${versesContext}${historyContext}\n\nGenerate a quiz for me.`,
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
