export type AthkarItem = {
  id: string;
  title: string;
  text: string;
  repetitions: number;
  fadl?: string;
  hadithText?: string;
  source?: string;
};

export type AthkarContent = {
  morning: AthkarItem[];
  evening: AthkarItem[];
  source?: string;
};

const ENDPOINT_CANDIDATES = [
  process.env.EXPO_PUBLIC_ATHKAR_API_URL,
  'https://raw.githubusercontent.com/abujaber44/quran-pulse/main/cms/athkar.json',
  'https://raw.githubusercontent.com/nawafalqari/azkar-api/main/azkar.json',
  'https://raw.githubusercontent.com/abuanwar072/Azkar-Json/main/azkar.json',
].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

const textFromEntry = (entry: any): string => {
  const value =
    entry?.text ??
    entry?.content ??
    entry?.zekr ??
    entry?.zekir ??
    entry?.body ??
    entry?.desc ??
    '';
  return typeof value === 'string' ? value.trim() : '';
};

const titleFromEntry = (entry: any, fallback: string): string => {
  const value = entry?.title ?? entry?.name ?? entry?.category ?? fallback;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
};

const repetitionsFromEntry = (entry: any): number => {
  const raw = entry?.count ?? entry?.repeat ?? entry?.repetitions ?? entry?.times ?? 1;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.round(parsed);
};

const mapList = (items: any[], section: 'morning' | 'evening'): AthkarItem[] => {
  return items
    .map((entry, index) => {
      const text = textFromEntry(entry);
      if (!text) return null;

      return {
        id: `${section}-${index}-${text.slice(0, 14)}`,
        title: titleFromEntry(entry, section === 'morning' ? 'Morning Athkar' : 'Evening Athkar'),
        text,
        repetitions: repetitionsFromEntry(entry),
        fadl: typeof entry?.fadl === 'string' ? entry.fadl.trim() : undefined,
        hadithText:
          typeof (entry?.hadith_text ?? entry?.hadithText) === 'string'
            ? String(entry?.hadith_text ?? entry?.hadithText).trim()
            : undefined,
        source: typeof entry?.source === 'string' ? entry.source.trim() : undefined,
      } as AthkarItem;
    })
    .filter((entry): entry is AthkarItem => !!entry);
};

const isMorningCategory = (value: string) =>
  /morning|sabah|صبح|الصباح|أذكار الصباح/i.test(value);
const isEveningCategory = (value: string) =>
  /evening|masa|masaa|مساء|المساء|أذكار المساء/i.test(value);

const parseAthkarPayload = (payload: any): Omit<AthkarContent, 'source'> | null => {
  if (!payload) return null;

  // Shape A: direct keyed arrays
  const morningRaw =
    payload?.morning ??
    payload?.morning_athkar ??
    payload?.morningAzkar ??
    payload?.athkar_morning ??
    payload?.azkar_sabah ??
    payload?.أذكار_الصباح;
  const eveningRaw =
    payload?.evening ??
    payload?.evening_athkar ??
    payload?.eveningAzkar ??
    payload?.athkar_evening ??
    payload?.azkar_masaa ??
    payload?.أذكار_المساء;

  if (Array.isArray(morningRaw) || Array.isArray(eveningRaw)) {
    const morning = mapList(Array.isArray(morningRaw) ? morningRaw : [], 'morning');
    const evening = mapList(Array.isArray(eveningRaw) ? eveningRaw : [], 'evening');
    if (morning.length > 0 || evening.length > 0) {
      return { morning, evening };
    }
  }

  // Shape B: nested array container
  const container = payload?.data ?? payload?.items ?? payload?.azkar ?? payload?.athkar;
  if (Array.isArray(container)) {
    const morningEntries: any[] = [];
    const eveningEntries: any[] = [];

    container.forEach((entry) => {
      const category = String(entry?.category ?? entry?.section ?? entry?.type ?? entry?.title ?? '');
      if (isMorningCategory(category)) {
        if (Array.isArray(entry?.items)) morningEntries.push(...entry.items);
        else morningEntries.push(entry);
      } else if (isEveningCategory(category)) {
        if (Array.isArray(entry?.items)) eveningEntries.push(...entry.items);
        else eveningEntries.push(entry);
      }
    });

    const morning = mapList(morningEntries, 'morning');
    const evening = mapList(eveningEntries, 'evening');
    if (morning.length > 0 || evening.length > 0) {
      return { morning, evening };
    }
  }

  return null;
};

export async function fetchAthkarContentOnline(): Promise<AthkarContent | null> {
  for (const endpoint of ENDPOINT_CANDIDATES) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) continue;

      const payload = (await response.json()) as any;
      const parsed = parseAthkarPayload(payload);
      if (parsed && (parsed.morning.length > 0 || parsed.evening.length > 0)) {
        return {
          ...parsed,
          source: endpoint,
        };
      }
    } catch {
      // Try next endpoint
    }
  }
  return null;
}
