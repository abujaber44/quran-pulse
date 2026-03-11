import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { UI_COLORS, UI_RADII, UI_SHADOWS } from '../theme/ui';

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
      <View style={styles.accent} />
      <Text style={[styles.title, titleFontFamily ? { fontFamily: titleFontFamily } : null, isDark && styles.darkText]}>
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
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: UI_RADII.lg,
    borderWidth: 1,
    borderColor: '#cde9d5',
    backgroundColor: UI_COLORS.primarySoft,
    ...UI_SHADOWS.card,
  },
  darkTile: {
    backgroundColor: '#1f2d2f',
    borderColor: '#2f474a',
  },
  accent: {
    width: 56,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 10,
    backgroundColor: UI_COLORS.primary,
  },
  title: {
    fontSize: 32,
    textAlign: 'center',
    color: UI_COLORS.primaryDeep,
    fontWeight: '700',
    fontFamily: 'AmiriQuran',
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 16,
    textAlign: 'center',
    color: UI_COLORS.textMuted,
    fontStyle: 'italic',
  },
  description: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: UI_COLORS.text,
  },
  darkText: {
    color: UI_COLORS.white,
  },
  darkMutedText: {
    color: '#a8b3bd',
  },
});
