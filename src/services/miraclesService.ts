import { MIRACLES_FALLBACK } from '../data/miraclesFallback';
import { MiracleCategory, MiracleItem, MiracleSourceLink } from '../types';

export type MiraclesContentResult = {
  items: MiracleItem[];
  source: 'cms' | 'fallback';
  updatedAt?: string;
  warning?: string;
};

const CMS_TIMEOUT_MS = 9000;

const getCmsUrl = (): string => {
  const raw = process.env.EXPO_PUBLIC_MIRACLES_CMS_URL;
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/^['"]|['"]$/g, '');
};

const normalizeCategory = (value: unknown): MiracleCategory | null => {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  return cleaned;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
};

const normalizeSourceLinks = (value: unknown): MiracleSourceLink[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const source = item as { label?: unknown; url?: unknown };
      const label = typeof source?.label === 'string' ? source.label.trim() : '';
      const url = typeof source?.url === 'string' ? source.url.trim() : '';
      if (!label || !url || !/^https?:\/\//i.test(url)) return null;
      return { label, url };
    })
    .filter((item): item is MiracleSourceLink => item !== null);
};

const normalizeMiracleItem = (value: unknown, index: number): MiracleItem | null => {
  const raw = value as {
    id?: unknown;
    category?: unknown;
    title?: unknown;
    summary?: unknown;
    detail?: unknown;
    ayahRefs?: unknown;
    tags?: unknown;
    sources?: unknown;
    caution?: unknown;
  };

  const category = normalizeCategory(raw?.category);
  if (!category) return null;

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
  const detail = typeof raw.detail === 'string' ? raw.detail.trim() : '';
  if (!title || !summary || !detail) return null;

  const idBase = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : `${raw.category}-${index}`;
  const ayahRefs = toStringArray(raw.ayahRefs);
  const tags = toStringArray(raw.tags);
  const sources = normalizeSourceLinks(raw.sources);
  const caution = typeof raw.caution === 'string' && raw.caution.trim() ? raw.caution.trim() : undefined;

  return {
    id: idBase,
    category,
    title,
    summary,
    detail,
    ayahRefs,
    tags,
    sources,
    caution,
  };
};

const parseCmsPayload = (payload: unknown): { items: MiracleItem[]; updatedAt?: string } | null => {
  const root = payload as {
    items?: unknown;
    data?: { items?: unknown; updatedAt?: unknown };
    updatedAt?: unknown;
  };

  const rawItems = Array.isArray(root) ? root : Array.isArray(root?.items) ? root.items : root?.data?.items;
  if (!Array.isArray(rawItems)) return null;

  const normalized = rawItems
    .map((item, index) => normalizeMiracleItem(item, index))
    .filter((item): item is MiracleItem => item !== null);

  if (normalized.length === 0) return null;

  const updatedAtRaw = typeof root?.updatedAt === 'string' ? root.updatedAt : root?.data?.updatedAt;
  const updatedAt = typeof updatedAtRaw === 'string' ? updatedAtRaw : undefined;

  return { items: normalized, updatedAt };
};

export const fetchQuranMiraclesContent = async (): Promise<MiraclesContentResult> => {
  const cmsUrl = getCmsUrl();

  if (!cmsUrl) {
    return {
      items: MIRACLES_FALLBACK,
      source: 'fallback',
      warning: 'CMS URL is not configured. Set EXPO_PUBLIC_MIRACLES_CMS_URL to load remote content.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, CMS_TIMEOUT_MS);

  try {
    const response = await fetch(cmsUrl, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`CMS request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const parsed = parseCmsPayload(payload);

    if (!parsed) {
      throw new Error('CMS payload is invalid or empty.');
    }

    return {
      items: parsed.items,
      source: 'cms',
      updatedAt: parsed.updatedAt,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown CMS error';

    return {
      items: MIRACLES_FALLBACK,
      source: 'fallback',
      warning: `Showing fallback content because CMS could not be loaded (${reason}).`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};
