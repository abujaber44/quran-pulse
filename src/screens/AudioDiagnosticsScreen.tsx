import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';
import ScreenIntroTile from '../components/ScreenIntroTile';
import { getAudioTrace, clearAudioTrace, type AudioDebugEvent } from '../services/audioDebugService';

// Hidden screen — not linked from any visible menu. Reached only via a
// long-press on the Settings title. Logs play/pause/finish/error events for
// both per-ayah and full-surah playback so background/lock-screen stopping
// issues can be diagnosed with real data instead of guesswork.
export default function AudioDiagnosticsScreen() {
  const [events, setEvents] = useState<AudioDebugEvent[]>([]);

  const load = useCallback(() => {
    void getAudioTrace().then(setEvents);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScreenIntroTile
          title="Audio Diagnostics"
          description="Recent playback events for per-ayah and surah audio, newest first. Hidden screen — not part of normal navigation."
          style={styles.introTile}
        />

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.refreshButton} onPress={load}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              void clearAudioTrace().then(load);
            }}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Events ({events.length})</Text>
          {events.length === 0 ? (
            <Text style={styles.emptyText}>No audio events logged yet. Play an ayah or a surah, then come back.</Text>
          ) : (
            events.map((event, index) => (
              <View key={`${event.at}-${index}`} style={styles.row}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>
                    [{event.source}] {event.type}
                  </Text>
                  <Text style={styles.rowTime}>{new Date(event.at).toLocaleTimeString()}</Text>
                </View>
                {event.detail ? <Text style={styles.rowDetail}>{event.detail}</Text> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI_COLORS.background },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 36 },
  introTile: { marginHorizontal: 0, marginBottom: 12 },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  refreshButton: {
    flex: 1,
    backgroundColor: UI_COLORS.primary,
    borderRadius: UI_RADII.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  refreshButtonText: { color: UI_COLORS.white, fontWeight: '700', fontSize: 13 },
  clearButton: {
    flex: 1,
    backgroundColor: 'rgba(231,76,60,0.15)',
    borderWidth: 1,
    borderColor: UI_COLORS.danger,
    borderRadius: UI_RADII.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  clearButtonText: { color: UI_COLORS.danger, fontWeight: '700', fontSize: 13 },
  sectionCard: {
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    borderRadius: UI_RADII.lg,
    padding: 14,
    marginBottom: 14,
    ...UI_SHADOWS.card,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: UI_COLORS.primaryDeep,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: UI_COLORS.textMuted,
    lineHeight: 21,
  },
  row: {
    borderTopWidth: 1,
    borderColor: UI_COLORS.border,
    paddingVertical: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: UI_COLORS.text,
    flex: 1,
    paddingRight: 8,
  },
  rowTime: {
    fontSize: 12,
    color: UI_COLORS.textMuted,
  },
  rowDetail: {
    marginTop: 2,
    fontSize: 12,
    color: UI_COLORS.textMuted,
    lineHeight: 18,
  },
});
