import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UI_RADII } from '../theme/ui';

type ScreenIntroTileProps = {
  title: string;
  description?: string;
  subtitle?: string;
  isDark?: boolean;
  titleFontFamily?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export default function ScreenIntroTile({
  title,
  subtitle,
  isDark = false,
  titleFontFamily,
  style,
  children,
}: ScreenIntroTileProps) {
  return (
    <View style={[styles.tile, style]}>
      <View style={styles.accentLine}>
        <LinearGradient
          colors={['transparent', 'rgba(123,196,240,0.5)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentGradient}
        />
      </View>
      <Text style={styles.decorStar}>✦</Text>
      <Text style={[styles.title, titleFontFamily ? { fontFamily: titleFontFamily } : null]}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
      <View style={styles.accentLineBottom}>
        <LinearGradient
          colors={['transparent', 'rgba(123,196,240,0.3)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentGradient}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    borderRadius: UI_RADII.xl,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  accentLine: {
    width: '60%',
    height: 1,
    marginBottom: 8,
  },
  accentLineBottom: {
    width: '40%',
    height: 1,
    marginTop: 6,
  },
  accentGradient: {
    flex: 1,
  },
  decorStar: {
    fontSize: 12,
    color: 'rgba(123,196,240,0.5)',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'AmiriQuran',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
