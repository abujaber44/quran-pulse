import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { UI_COLORS, UI_RADII } from '../theme/ui';
import { useLanguage } from '../i18n';

interface ShareAyahCardProps {
  arabicText: string;
  translation: string;
  verseKey: string;
  surahName: string;
  arabicFontFamily?: string;
}

export default function ShareAyahCard({
  arabicText,
  translation,
  verseKey,
  surahName,
  arabicFontFamily,
}: ShareAyahCardProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const { t } = useLanguage();

  const handleShare = useCallback(async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) return;

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `${surahName} ${verseKey}`,
        });
      } else {
        Alert.alert(t.error, 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
  }, [verseKey, surahName, t.error]);

  return (
    <View>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
        <View style={styles.card}>
          <View style={styles.topAccent} />
          <Text
            style={[
              styles.arabicText,
              arabicFontFamily ? { fontFamily: arabicFontFamily } : null,
            ]}
          >
            {arabicText}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.translationText}>{translation}</Text>
          <View style={styles.footer}>
            <Text style={styles.reference}>{surahName} — {verseKey}</Text>
            <Text style={styles.branding}>Quran Pulse</Text>
          </View>
        </View>
      </ViewShot>

      <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.8}>
        <Text style={styles.shareButtonText}>{t.shareAyah}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#17384d',
    borderRadius: 20,
    padding: 28,
    margin: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  topAccent: {
    width: 50,
    height: 4,
    borderRadius: 2,
    backgroundColor: UI_COLORS.primary,
    alignSelf: 'center',
    marginBottom: 20,
  },
  arabicText: {
    fontSize: 28,
    lineHeight: 48,
    textAlign: 'center',
    color: UI_COLORS.text,
    writingDirection: 'rtl',
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: UI_COLORS.border,
    alignSelf: 'center',
    marginVertical: 18,
  },
  translationText: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    color: UI_COLORS.textMuted,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  reference: {
    fontSize: 12,
    color: UI_COLORS.accent,
    fontWeight: '700',
  },
  branding: {
    fontSize: 11,
    color: UI_COLORS.textLight,
    fontWeight: '600',
  },
  shareButton: {
    marginTop: 10,
    backgroundColor: UI_COLORS.primary,
    paddingVertical: 12,
    borderRadius: UI_RADII.sm,
    alignItems: 'center',
  },
  shareButtonText: {
    color: UI_COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
