export type Coordinates = {
  latitude: number;
  longitude: number;
};

export const KAABA_COORDINATES: Coordinates = {
  latitude: 21.4225,
  longitude: 39.8262,
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

export const normalizeDegrees = (degrees: number): number => (degrees + 360) % 360;

export const calculateQiblaBearing = (origin: Coordinates): number => {
  const lat1 = toRadians(origin.latitude);
  const lon1 = toRadians(origin.longitude);
  const lat2 = toRadians(KAABA_COORDINATES.latitude);
  const lon2 = toRadians(KAABA_COORDINATES.longitude);

  const deltaLon = lon2 - lon1;
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
};

export const calculateDistanceToKaabaKm = (origin: Coordinates): number => {
  const earthRadiusKm = 6371;
  const lat1 = toRadians(origin.latitude);
  const lon1 = toRadians(origin.longitude);
  const lat2 = toRadians(KAABA_COORDINATES.latitude);
  const lon2 = toRadians(KAABA_COORDINATES.longitude);

  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};
