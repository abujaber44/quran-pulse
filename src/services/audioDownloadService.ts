import * as FileSystem from 'expo-file-system/legacy';

const AUDIO_DIR = `${FileSystem.documentDirectory}audio/`;

const safeName = (id: string) => id.replace(/[^a-z0-9_-]/gi, '_');

async function ensureDir(path: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

// ---- Full-surah recitation files (Quran Player) ----

const surahDir = (reciterId: string) => `${AUDIO_DIR}surah/${safeName(reciterId)}/`;
const surahPath = (reciterId: string, surahId: number) => `${surahDir(reciterId)}${surahId}.mp3`;

export async function getLocalSurahAudioUri(reciterId: string, surahId: number): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(surahPath(reciterId, surahId));
    return info.exists && (info.size ?? 0) > 0 ? info.uri : null;
  } catch {
    return null;
  }
}

export async function getDownloadedSurahIds(reciterId: string): Promise<Set<number>> {
  try {
    const files = await FileSystem.readDirectoryAsync(surahDir(reciterId));
    return new Set(
      files
        .filter((f) => f.endsWith('.mp3'))
        .map((f) => Number(f.replace('.mp3', '')))
        .filter((n) => Number.isFinite(n))
    );
  } catch {
    return new Set();
  }
}

export async function downloadSurahAudio(
  reciterId: string,
  surahId: number,
  url: string,
  onProgress?: (fraction: number) => void
): Promise<string | null> {
  try {
    await ensureDir(surahDir(reciterId));
    const target = surahPath(reciterId, surahId);
    const resumable = FileSystem.createDownloadResumable(url, target, {}, (progress) => {
      if (onProgress && progress.totalBytesExpectedToWrite > 0) {
        onProgress(progress.totalBytesWritten / progress.totalBytesExpectedToWrite);
      }
    });
    const result = await resumable.downloadAsync();
    if (result && result.status === 200) return result.uri;
    await FileSystem.deleteAsync(target, { idempotent: true });
    return null;
  } catch {
    await FileSystem.deleteAsync(surahPath(reciterId, surahId), { idempotent: true }).catch(() => {});
    return null;
  }
}

export async function deleteSurahAudio(reciterId: string, surahId: number): Promise<void> {
  await FileSystem.deleteAsync(surahPath(reciterId, surahId), { idempotent: true }).catch(() => {});
}

// ---- Standalone named tracks (e.g. full athkar recitations) ----
// Same download/cache pattern as surah audio, but keyed by an arbitrary
// track id instead of reciter+surah.

const tracksDir = `${AUDIO_DIR}tracks/`;
const trackPath = (trackId: string) => `${tracksDir}${safeName(trackId)}.mp3`;

export async function getLocalTrackAudioUri(trackId: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(trackPath(trackId));
    return info.exists && (info.size ?? 0) > 0 ? info.uri : null;
  } catch {
    return null;
  }
}

export async function downloadTrackAudio(
  trackId: string,
  url: string,
  onProgress?: (fraction: number) => void
): Promise<string | null> {
  try {
    await ensureDir(tracksDir);
    const target = trackPath(trackId);
    const resumable = FileSystem.createDownloadResumable(url, target, {}, (progress) => {
      if (onProgress && progress.totalBytesExpectedToWrite > 0) {
        onProgress(progress.totalBytesWritten / progress.totalBytesExpectedToWrite);
      }
    });
    const result = await resumable.downloadAsync();
    if (result && result.status === 200) return result.uri;
    await FileSystem.deleteAsync(target, { idempotent: true });
    return null;
  } catch {
    await FileSystem.deleteAsync(trackPath(trackId), { idempotent: true }).catch(() => {});
    return null;
  }
}

export async function deleteTrackAudio(trackId: string): Promise<void> {
  await FileSystem.deleteAsync(trackPath(trackId), { idempotent: true }).catch(() => {});
}

// ---- Per-ayah audio cache (SurahScreen listening) ----
// Ayahs are cached transparently as they are played, so any ayah heard once
// replays offline.

const ayahDir = (reciterId: string) => `${AUDIO_DIR}ayah/${safeName(reciterId)}/`;
const ayahPath = (reciterId: string, globalAyah: number) => `${ayahDir(reciterId)}${globalAyah}.mp3`;

export async function getLocalAyahAudioUri(reciterId: string, globalAyah: number): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(ayahPath(reciterId, globalAyah));
    return info.exists && (info.size ?? 0) > 0 ? info.uri : null;
  } catch {
    return null;
  }
}

const ayahDownloadsInFlight = new Set<string>();

export function cacheAyahAudio(reciterId: string, globalAyah: number, url: string): void {
  const key = `${reciterId}:${globalAyah}`;
  if (ayahDownloadsInFlight.has(key)) return;
  ayahDownloadsInFlight.add(key);
  void (async () => {
    try {
      await ensureDir(ayahDir(reciterId));
      const target = ayahPath(reciterId, globalAyah);
      const info = await FileSystem.getInfoAsync(target);
      if (info.exists && (info.size ?? 0) > 0) return;
      const result = await FileSystem.downloadAsync(url, target);
      if (result.status !== 200) {
        await FileSystem.deleteAsync(target, { idempotent: true });
      }
    } catch {
      // Best effort — streaming still works without the cache
    } finally {
      ayahDownloadsInFlight.delete(key);
    }
  })();
}
