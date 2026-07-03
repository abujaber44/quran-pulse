import * as FileSystem from 'expo-file-system/legacy';

const PAGES_DIR = `${FileSystem.documentDirectory}mushaf-pages/`;
const TOTAL_PAGES = 604;

export const getPageImageUrl = (page: number) =>
  `https://raw.githubusercontent.com/akram-seid/quran-hd-images/main/images/${String(page).padStart(3, '0')}.jpg`;

const localPath = (page: number) => `${PAGES_DIR}${String(page).padStart(3, '0')}.jpg`;

let dirReady = false;
async function ensureDir(): Promise<void> {
  if (dirReady) return;
  const info = await FileSystem.getInfoAsync(PAGES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PAGES_DIR, { intermediates: true });
  }
  dirReady = true;
}

const inFlight = new Map<number, Promise<string | null>>();

export async function ensurePageDownloaded(page: number): Promise<string | null> {
  if (page < 1 || page > TOTAL_PAGES) return null;
  const existing = inFlight.get(page);
  if (existing) return existing;

  const task = (async (): Promise<string | null> => {
    try {
      await ensureDir();
      const path = localPath(page);
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && (info.size ?? 0) > 0) return path;
      const result = await FileSystem.downloadAsync(getPageImageUrl(page), path);
      if (result.status === 200) return path;
      await FileSystem.deleteAsync(path, { idempotent: true });
      return null;
    } catch {
      return null;
    } finally {
      inFlight.delete(page);
    }
  })();

  inFlight.set(page, task);
  return task;
}

/**
 * Returns the page image as a base64 data URI (downloading it first if needed),
 * or null if the page is not available locally and cannot be fetched.
 * Data URIs render reliably inside WebView HTML on both platforms.
 */
export async function getPageDataUri(page: number): Promise<string | null> {
  const path = await ensurePageDownloaded(page);
  if (!path) return null;
  try {
    const base64 = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return null;
  }
}

/** Fire-and-forget: warm the local cache around the current page (reading direction first). */
export function prefetchAroundPage(currentPage: number, ahead: number = 5): void {
  for (let i = 1; i <= ahead; i++) {
    void ensurePageDownloaded(currentPage + i);
  }
  void ensurePageDownloaded(currentPage - 1);
}
