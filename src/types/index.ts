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