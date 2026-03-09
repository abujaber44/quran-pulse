export interface Surah {
  id: number;
  name_simple: string;
  name_arabic: string;
  verses_count: number;
  translated_name: { language_name: string; name: string };
}

export interface Ayah {
  id: number;
  verse_number: number;
  verse_key: string;
  text_uthmani: string;
}

export type MiracleCategory = string;

export interface MiracleSourceLink {
  label: string;
  url: string;
}

export interface MiracleItem {
  id: string;
  category: MiracleCategory;
  title: string;
  summary: string;
  detail: string;
  ayahRefs: string[];
  tags: string[];
  sources: MiracleSourceLink[];
  caution?: string;
}
