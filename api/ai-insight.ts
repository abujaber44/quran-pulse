import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const client = new Anthropic();

const PROMPTS: Record<string, Record<string, string>> = {
  miracle: {
    en: `You are a knowledgeable Islamic scholar explaining Quranic miracles. Given a miracle claim with its category, summary, and referenced ayahs:
- Provide a clear, educational explanation of why this is considered miraculous
- Reference relevant scientific or linguistic evidence where appropriate
- Mention what classical and modern scholars have said
- Be balanced — note if a claim is disputed among scholars
- Keep your response to 3-4 focused paragraphs
- Respond entirely in English.`,
    ar: `أنت عالم إسلامي ذو خبرة واسعة في شرح إعجاز القرآن. بناءً على ادعاء الإعجاز مع فئته وملخصه والآيات المرجعية:
- قدّم شرحاً واضحاً وتعليمياً لسبب اعتبار هذا إعجازاً
- أشر إلى الأدلة العلمية أو اللغوية ذات الصلة
- اذكر ما قاله العلماء الكلاسيكيون والمعاصرون
- كن متوازناً — أشر إذا كان الادعاء مختلفاً عليه
- اجعل إجابتك 3-4 فقرات مركّزة
- أجب بالكامل باللغة العربية.`,
  },
  hadith: {
    en: `You are a wise Islamic scholar providing a personal daily reflection on a hadith. Given the hadith text in Arabic and English with its source:
- Write a 2-3 sentence personal reflection connecting this hadith to daily life
- Include one practical action the reader can take today
- Be warm, encouraging, and concise
- Do not repeat the hadith text — the reader already sees it
- Respond entirely in English.`,
    ar: `أنت عالم إسلامي حكيم تقدّم تأملاً يومياً شخصياً حول حديث. بناءً على نص الحديث بالعربية والإنجليزية مع مصدره:
- اكتب 2-3 جمل تأمّل شخصي تربط الحديث بالحياة اليومية
- أضف إجراءً عملياً يمكن للقارئ اتخاذه اليوم
- كن دافئاً ومشجعاً وموجزاً
- لا تكرر نص الحديث — القارئ يراه بالفعل
- أجب بالكامل باللغة العربية.`,
  },
  share: {
    en: `You write a single short note to accompany a Quran verse that someone is sharing with a friend or family member.
- If an intention is provided (comfort, congratulate, condolence, encouragement, gratitude), write 1-2 warm, personal sentences connecting THIS specific verse to that intention, addressed gently to the recipient.
- If no intention is provided, write exactly one elegant sentence of reflection (tadabbur) on the verse.
- Never repeat or quote the verse text. No hashtags, no emojis, no greetings like "Dear...".
- Output only the note text, nothing else.
- Respond entirely in English.`,
    ar: `أنت تكتب ملاحظة قصيرة واحدة ترافق آية قرآنية يشاركها شخص مع صديق أو قريب.
- إذا وُجدت نية (مواساة، تهنئة، تعزية، تشجيع، امتنان)، اكتب جملة أو جملتين دافئتين شخصيتين تربطان هذه الآية تحديداً بتلك النية، موجّهة برفق إلى المتلقي.
- إذا لم تُذكر نية، اكتب جملة واحدة أنيقة من التدبر في الآية.
- لا تكرر نص الآية ولا تقتبسه. بدون وسوم أو رموز تعبيرية أو تحيات.
- أخرج نص الملاحظة فقط لا غير.
- أجب بالكامل باللغة العربية.`,
  },
  athkar: {
    en: `You are a knowledgeable Islamic scholar explaining a dhikr (remembrance of Allah). Given the dhikr text, its title, and repetition count:
- Explain the meaning of the Arabic words
- Describe the spiritual significance and benefits mentioned in hadith
- Explain when and why this dhikr is recited (morning, evening, or both)
- Keep your response to 2-3 concise paragraphs
- Respond entirely in English.`,
    ar: `أنت عالم إسلامي ذو خبرة في شرح الأذكار. بناءً على نص الذكر وعنوانه وعدد التكرار:
- اشرح معنى الكلمات العربية
- صف الأهمية الروحية والفوائد المذكورة في الأحاديث
- اشرح متى ولماذا يُقرأ هذا الذكر (صباحاً أو مساءً أو كليهما)
- اجعل إجابتك 2-3 فقرات موجزة
- أجب بالكامل باللغة العربية.`,
  },
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

  const { type, context, lang } = req.body as { type?: string; context?: Record<string, any>; lang?: string };

  if (!type || !context || !PROMPTS[type]) {
    return res.status(400).json({ error: 'Missing or invalid type. Must be: miracle, hadith, athkar, or share' });
  }

  const resolvedLang = lang === 'ar' ? 'ar' : 'en';

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
  } else if (type === 'share') {
    userMessage = `Verse: ${context.verseKey} (${context.surahName})
Arabic: ${context.arabicText}
Translation: ${context.translation}
Intention: ${context.intention || 'none — write a single reflection sentence'}`;
  } else if (type === 'athkar') {
    userMessage = `Title: ${context.title}
Arabic Text: ${context.text}
Repetitions: ${context.repetitions}
${context.fadl ? `Known Benefit: ${context.fadl}` : ''}`;
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: PROMPTS[type][resolvedLang],
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    return res.status(200).json({ insight: textBlock?.text ?? '' });
  } catch (error) {
    console.error('AI insight error:', error);
    return res.status(500).json({ error: 'Failed to generate insight. Please try again.' });
  }
}
