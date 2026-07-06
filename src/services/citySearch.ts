// Shared city-name autocomplete used by the Prayer Times screen and the
// first-launch onboarding flow. Nominatim first, Open-Meteo as fallback.

type NominatimResult = {
  name?: string;
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
};

type OpenMeteoResult = {
  name?: string;
};

const dedupeCities = (values: string[]): string[] => {
  const cleaned = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(cleaned)];
};

const extractNominatimCity = (record: NominatimResult): string => {
  return (
    record.address?.city ||
    record.address?.town ||
    record.address?.village ||
    record.address?.municipality ||
    record.address?.county ||
    record.address?.state ||
    record.name ||
    record.display_name?.split(',')[0] ||
    ''
  );
};

export const fetchNominatimSuggestions = async (query: string): Promise<string[]> => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`,
    {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'QuranPulse/1.0 (https://abujaber44.github.io/quran-pulse/privacy/)',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Nominatim request failed: ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) return [];

  const cityNames = data.map((item) => extractNominatimCity(item as NominatimResult));
  return dedupeCities(cityNames).slice(0, 5);
};

export const fetchOpenMeteoSuggestions = async (query: string): Promise<string[]> => {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
  );

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { results?: OpenMeteoResult[] };
  const results = Array.isArray(payload.results) ? payload.results : [];
  return dedupeCities(results.map((item) => item.name || '')).slice(0, 5);
};

export const fetchCitySuggestions = async (query: string): Promise<string[]> => {
  let cityNames: string[] = [];
  try {
    cityNames = await fetchNominatimSuggestions(query);
  } catch {
    // Fall through to Open-Meteo
  }
  if (cityNames.length === 0) {
    cityNames = await fetchOpenMeteoSuggestions(query);
  }
  return cityNames;
};
