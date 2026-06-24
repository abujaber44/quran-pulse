import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UI_COLORS, UI_RADII, UI_SHADOWS, UI_GLASS } from '../theme/ui';

type ScreenIntroTileProps = {
  title: string;
  description: string;
  subtitle?: string;
  isDark?: boolean;
  titleFontFamily?: string;
  style?: StyleProp<ViewStyle>;
};

export default function ScreenIntroTile({
  title,
  description,
  subtitle,
  isDark = false,
  titleFontFamily,
  style,
}: ScreenIntroTileProps) {
  return (
    <View style={[styles.tile, isDark && styles.darkTile, style]}>
      <LinearGradient
        colors={isDark ? ['rgba(31,157,85,0.15)', 'rgba(31,157,85,0.05)'] : ['rgba(31,157,85,0.12)', 'rgba(215,239,225,0.3)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBg}
      />
      <View style={styles.accentRow}>
        <View style={styles.accentLine} />
        <View style={styles.accentDot} />
        <View style={styles.accentLine} />
      </View>
      <Text style={[styles.title, titleFontFamily ? { fontFamily: titleFontFamily } : null, isDark && styles.darkTitle]}>
        {title}
      </Text>
      {subtitle ? <Text style={[styles.subtitle, isDark && styles.darkMutedText]}>{subtitle}</Text> : null}
      <Text style={[styles.description, isDark && styles.darkText]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: UI_RADII.xl,
    ...UI_GLASS.frosted,
    overflow: 'hidden',
    ...UI_SHADOWS.card,
  },
  darkTile: {
    ...UI_GLASS.frostedDark,
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: UI_RADII.xl,
  },
  accentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
  },
  accentLine: {
    width: 24,
    height: 2,
    borderRadius: 999,
    backgroundColor: UI_COLORS.primary,
    opacity: 0.5,
  },
  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: UI_COLORS.primary,
  },
  title: {
    fontSize: 30,
    textAlign: 'center',
    color: UI_COLORS.primaryDeep,
    fontWeight: '700',
    fontFamily: 'AmiriQuran',
    letterSpacing: 0.3,
  },
  darkTitle: {
    color: '#e0f0e8',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    textAlign: 'center',
    color: UI_COLORS.textMuted,
    fontStyle: 'italic',
  },
  description: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: UI_COLORS.text,
    opacity: 0.85,
  },
  darkText: {
    color: 'rgba(255,255,255,0.85)',
  },
  darkMutedText: {
    color: '#a8b3bd',
  },
});
