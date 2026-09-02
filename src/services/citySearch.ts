// Shared city-name autocomplete used by the Prayer Times screen and the
// first-launch onboarding flow. Nominatim first, Open-Meteo as fallback.
//
// Both providers return coordinates alongside the name, so every suggestion
// we show is also cached as lat/long. Prayer times are computed locally from
// those coordinates (see prayerTimesService), which is why resolving a city
// to a point on the globe — not to a provider's idea of a "valid city" — is
// the only lookup the schedule depends on.

import AsyncStorage from '@react-native-async-storage/async-storage';

export type CityCoordinates = {
  latitude: number;
  longitude: number;
};

const COORD_CACHE_PREFIX = '@qp_city_coords:';

const coordCacheKey = (cityName: string): string =>
  COORD_CACHE_PREFIX + cityName.trim().toLowerCase();

const isUsableCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isUsableCoordinates = (value: unknown): value is CityCoordinates => {
  const candidate = value as CityCoordinates | null;
  return (
    !!candidate &&
    isUsableCoordinate(candidate.latitude) &&
    isUsableCoordinate(candidate.longitude) &&
    Math.abs(candidate.latitude) <= 90 &&
    Math.abs(candidate.longitude) <= 180
  );
};

export const cacheCityCoordinates = (cityName: string, coords: CityCoordinates): void => {
  if (!cityName.trim() || !isUsableCoordinates(coords)) return;
  AsyncStorage.setItem(coordCacheKey(cityName), JSON.stringify(coords)).catch(() => {});
};

export const getCachedCityCoordinates = async (
  cityName: string
): Promise<CityCoordinates | null> => {
  try {
    const raw = await AsyncStorage.getItem(coordCacheKey(cityName));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isUsableCoordinates(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

type NominatimResult = {
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
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
  latitude?: number;
  longitude?: number;
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

const extractNominatimCoordinates = (record: NominatimResult): CityCoordinates | null => {
  const latitude = Number(record.lat);
  const longitude = Number(record.lon);
  return isUsableCoordinates({ latitude, longitude }) ? { latitude, longitude } : null;
};

/** Name → coordinates for the results we just parsed, in provider order. */
const collectPairs = (
  entries: Array<{ name: string; coords: CityCoordinates | null }>
): Map<string, CityCoordinates> => {
  const pairs = new Map<string, CityCoordinates>();
  for (const entry of entries) {
    const name = entry.name.trim();
    if (!name || !entry.coords) continue;
    if (!pairs.has(name)) pairs.set(name, entry.coords);
  }
  return pairs;
};

const cachePairs = (pairs: Map<string, CityCoordinates>): void => {
  pairs.forEach((coords, name) => cacheCityCoordinates(name, coords));
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

  const records = data as NominatimResult[];
  cachePairs(
    collectPairs(
      records.map((record) => ({
        name: extractNominatimCity(record),
        coords: extractNominatimCoordinates(record),
      }))
    )
  );

  const cityNames = records.map((item) => extractNominatimCity(item));
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

  cachePairs(
    collectPairs(
      results.map((item) => ({
        name: item.name || '',
        coords: isUsableCoordinates({ latitude: item.latitude, longitude: item.longitude })
          ? { latitude: item.latitude as number, longitude: item.longitude as number }
          : null,
      }))
    )
  );

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

const geocodeViaNominatim = async (cityName: string): Promise<CityCoordinates | null> => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&addressdetails=1&limit=1`,
    {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'QuranPulse/1.0 (https://abujaber44.github.io/quran-pulse/privacy/)',
      },
    }
  );
  if (!response.ok) return null;

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data) || data.length === 0) return null;
  return extractNominatimCoordinates(data[0] as NominatimResult);
};

const geocodeViaOpenMeteo = async (cityName: string): Promise<CityCoordinates | null> => {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as { results?: OpenMeteoResult[] };
  const first = Array.isArray(payload.results) ? payload.results[0] : undefined;
  if (!first) return null;

  const coords = { latitude: first.latitude, longitude: first.longitude };
  return isUsableCoordinates(coords) ? (coords as CityCoordinates) : null;
};

/**
 * Resolve a city name to coordinates: cache first (so a city picked once
 * keeps working with no network at all), then Nominatim, then Open-Meteo.
 * Returns null only when the name is unknown to both providers.
 */
export const geocodeCity = async (cityName: string): Promise<CityCoordinates | null> => {
  const trimmed = cityName.trim();
  if (!trimmed) return null;

  const cached = await getCachedCityCoordinates(trimmed);
  if (cached) return cached;

  for (const lookup of [geocodeViaNominatim, geocodeViaOpenMeteo]) {
    try {
      const coords = await lookup(trimmed);
      if (coords) {
        cacheCityCoordinates(trimmed, coords);
        return coords;
      }
    } catch {
      // Try the next provider
    }
  }

  return null;
};
