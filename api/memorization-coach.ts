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
1. "identify_surah" — اعرض جزءاً من آية واسأل من أي سورة (٤ خيارات). لا تستخدم هذا النوع أبداً إذا كانت جميع الآيات من سورة واحدة — الإجابة معروفة سلفاً
2. "next_ayah" — اعرض آية واسأل ماذا يأتي بعدها (إن وُجدت آيات متتالية)
3. "fill_blank" — اعرض آية مع كلمة محذوفة "___" وأعطِ ٤ خيارات
4. "correct_wording" — اعرض ٤ صيغ كاملة للآية، واحدة فقط مطابقة تماماً للنص المعطى والباقي بتغييرات دقيقة في كلمة أو كلمتين (على غرار المتشابهات) — ضع صيغ الآية في options واترك ayahText فارغاً لهذا النوع. للآيات الطويلة (أكثر من ٢٠ كلمة) استخدم مقطعاً مكتمل المعنى من الآية بدلاً من نصها الكامل حتى تبقى الخيارات قصيرة

كل سؤال يجب أن يحتوي:
- type: "identify_surah" | "next_ayah" | "fill_blank"
- prompt: صيغة السؤال فقط بالعربية — لا تضع نص الآية داخل prompt أبداً
- ayahText: نص الآية أو مقتطفها بالعربية فقط (مع "___" في أسئلة إكمال الفراغ) — يُعرض في سطر مستقل
- options: مصفوفة من ٤ نصوص بالعربية
- correctAnswer: الخيار الصحيح (يجب أن يطابق أحد الخيارات تماماً)
- verseKey: مفتاح الآية (مثل "2:255")
- surahId: رقم السورة
- ayahNumber: رقم الآية

مثال:
[{"type":"identify_surah","prompt":"في أي سورة وردت هذه الآية؟","ayahText":"اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ","options":["البقرة","آل عمران","النساء","المائدة"],"correctAnswer":"البقرة","verseKey":"2:255","surahId":2,"ayahNumber":255}]`;
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
1. "identify_surah" — Show part of a verse in Arabic, ask which surah it's from (4 options, 1 correct). NEVER use this type when all verses are from a single surah — the answer is already known
2. "next_ayah" — Show a verse in Arabic, ask what comes next in Arabic (if consecutive verses exist in the list)
3. "fill_blank" — Show the Arabic verse with a key word replaced by "___", give 4 Arabic word options
4. "correct_wording" — Give 4 full Arabic versions of an ayah; exactly one matches the provided text, the others differ subtly by one or two words (mutashabihat-style). Put the versions in options and leave ayahText empty for this type. For long ayahs (over ~20 words) use a self-contained excerpt of the ayah instead of the full text so options stay short

Each question must have:
- type: "identify_surah" | "next_ayah" | "fill_blank"
- prompt: ONLY the question wording in English — never put Arabic verse text inside prompt (mixed-direction text renders badly)
- ayahText: ONLY the Arabic verse text or excerpt (with "___" for fill_blank questions) — it is displayed on its own line
- options: array of 4 strings
- correctAnswer: the correct option string (must match one of the options exactly)
- verseKey: which verse this tests (e.g. "2:255")
- surahId: number
- ayahNumber: number

Examples:
[{"type":"identify_surah","prompt":"Which surah contains this ayah?","ayahText":"اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ","options":["Al-Baqarah","Al-Imran","An-Nisa","Al-Maidah"],"correctAnswer":"Al-Baqarah","verseKey":"2:255","surahId":2,"ayahNumber":255},{"type":"fill_blank","prompt":"Complete the ayah:","ayahText":"اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ ___","options":["الْقَيُّومُ","الْعَظِيمُ","الْكَرِيمُ","الْحَكِيمُ"],"correctAnswer":"الْقَيُّومُ","verseKey":"2:255","surahId":2,"ayahNumber":255}]`;
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

  const { bookmarks, history, lang, scope } = req.body as {
    bookmarks?: BookmarkInput[];
    history?: HistoryInput[];
    lang?: string;
    scope?: { type?: string; surahCount?: number };
  };

  if (!bookmarks || bookmarks.length < 1) {
    return res.status(400).json({ error: 'At least 1 memorized ayah is needed for a quiz.' });
  }

  const versesContext = bookmarks
    .map((b) => `- ${b.surahName} ${b.surahId}:${b.ayahNum} — "${b.ayahText}" (${b.translation})`)
    .join('\n');

  let scopeContext = '';
  if (scope?.surahCount === 1) {
    scopeContext =
      lang === 'ar'
        ? '\n\nجميع الآيات من سورة واحدة — لا تستخدم أسئلة "identify_surah" إطلاقاً؛ ركّز على fill_blank و next_ayah و correct_wording.'
        : '\n\nAll verses are from a SINGLE surah — do NOT use any "identify_surah" questions; focus on fill_blank, next_ayah, and correct_wording instead.';
  }

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
      // Long-surah quizzes with correct_wording questions (4 full ayah
      // variants each) easily exceeded 2048 output tokens, truncating the
      // JSON mid-array and failing every parse.
      max_tokens: 8192,
      system: getSystemPrompt(lang ?? 'en'),
      messages: [
        {
          role: 'user',
          content: lang === 'ar'
            ? `هذه الآيات التي أحفظها:\n${versesContext}${scopeContext}${historyContext}\n\nأنشئ اختباراً لي باللغة العربية.`
            : `Here are the verses I'm memorizing:\n${versesContext}${scopeContext}${historyContext}\n\nGenerate a quiz for me.`,
        },
      ],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const text = textBlock?.text ?? '[]';

    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    let questions;
    try {
      questions = JSON.parse(cleaned);
    } catch {
      // Truncated output: salvage the complete question objects by cutting
      // at the last complete "}" and closing the array.
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace > 0) {
        try {
          questions = JSON.parse(`${cleaned.slice(0, lastBrace + 1)}]`);
          console.warn(`Salvaged ${(questions as any[]).length} questions from truncated AI response`);
        } catch {
          questions = [];
        }
      } else {
        questions = [];
      }
      if (!Array.isArray(questions) || questions.length === 0) {
        console.error('Failed to parse AI response:', text.slice(0, 500));
        questions = [];
      }
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
