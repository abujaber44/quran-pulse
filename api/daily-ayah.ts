import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const client = new Anthropic();

const SYSTEM_PROMPTS: Record<string, string> = {
  en: `You are a wise Islamic scholar who selects a daily Quran verse for a Muslim app user. Based on their reading history, bookmarks, and the current date, pick ONE ayah that is relevant, inspiring, and connects to their spiritual journey.

Return a raw JSON object (no markdown, no code blocks) with:
- surahId (number 1-114)
- surahName (string)
- ayahNumber (number)
- verseKey (string like "2:255")
- arabicText (the verse in Arabic)
- translation (brief English translation)
- reason (1-2 sentences explaining why this ayah was chosen for them today)

Pick REAL verses only. Be thoughtful — connect the ayah to their reading patterns or the time of year.`,

  ar: `أنت عالم إسلامي حكيم يختار آية قرآنية يومية لمستخدم تطبيق مسلم. بناءً على تاريخ قراءتهم ومفضلاتهم والتاريخ الحالي، اختر آية واحدة ملهمة ومرتبطة برحلتهم الروحية.

أرجع كائن JSON خام (بدون markdown أو كتل كود) يحتوي:
- surahId (رقم 1-114)
- surahName (اسم السورة بالعربية)
- ayahNumber (رقم)
- verseKey (مثل "2:255")
- arabicText (الآية بالعربية)
- translation (ترجمة/معنى مختصر بالعربية)
- reason (جملة أو اثنتان بالعربية توضح سبب اختيار هذه الآية لهم اليوم)

اختر آيات حقيقية فقط. كن مدروساً — اربط الآية بأنماط قراءتهم أو الوقت من السنة.`,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recentSurahs, bookmarkTags, today, lang } = req.body as {
    recentSurahs?: string[];
    bookmarkTags?: string[];
    today?: string;
    lang?: string;
  };

  const resolvedLang = lang === 'ar' ? 'ar' : 'en';

  let userContext = `Today's date: ${today ?? new Date().toISOString().split('T')[0]}\n`;

  if (recentSurahs && recentSurahs.length > 0) {
    userContext += `Recently read surahs: ${recentSurahs.join(', ')}\n`;
  } else {
    userContext += `This user is new — they haven't read any surahs yet. Pick a welcoming, foundational verse.\n`;
  }

  if (bookmarkTags && bookmarkTags.length > 0) {
    userContext += `Bookmarked themes: ${bookmarkTags.join(', ')}\n`;
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPTS[resolvedLang],
      messages: [{ role: 'user', content: userContext }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const text = textBlock?.text ?? '{}';
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    if (!result.surahId || !result.verseKey) {
      return res.status(500).json({ error: 'Invalid response from AI' });
    }

    return res.status(200).json({ ayah: result });
  } catch (error) {
    console.error('Daily ayah error:', error);
    return res.status(500).json({ error: 'Failed to generate daily ayah' });
  }
}
