import AsyncStorage from '@react-native-async-storage/async-storage';

const TRACE_KEY = '@qp_audio_debug_trace';
const MAX_EVENTS = 60;

export interface AudioDebugEvent {
  at: number;
  source: 'ayah' | 'surah';
  type: string;
  detail?: string;
}

/**
 * Fire-and-forget event log for diagnosing background/lock-screen playback
 * issues. Every call is wrapped so a logging failure can never affect actual
 * playback — this is purely observational.
 */
export function logAudioEvent(source: AudioDebugEvent['source'], type: string, detail?: string): void {
  void (async () => {
    try {
      const raw = await AsyncStorage.getItem(TRACE_KEY);
      const events: AudioDebugEvent[] = raw ? JSON.parse(raw) : [];
      events.push({ at: Date.now(), source, type, detail });
      while (events.length > MAX_EVENTS) events.shift();
      await AsyncStorage.setItem(TRACE_KEY, JSON.stringify(events));
    } catch {
      // Diagnostics must never throw into the audio code path
    }
  })();
}

export async function getAudioTrace(): Promise<AudioDebugEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(TRACE_KEY);
    if (!raw) return [];
    const events = JSON.parse(raw) as AudioDebugEvent[];
    return Array.isArray(events) ? events.slice().reverse() : [];
  } catch {
    return [];
  }
}

export async function clearAudioTrace(): Promise<void> {
  await AsyncStorage.removeItem(TRACE_KEY).catch(() => {});
}
