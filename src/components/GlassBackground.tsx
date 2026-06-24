import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UI_GRADIENTS } from '../theme/ui';

interface GlassBackgroundProps {
  isDark?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function GlassBackground({ isDark = false, children, style }: GlassBackgroundProps) {
  return (
    <LinearGradient
      colors={isDark ? UI_GRADIENTS.screenDark : UI_GRADIENTS.screenLight}
      style={[styles.container, style]}
    >
      <View style={[styles.orb, styles.orbTopRight, isDark && styles.orbDark]} />
      <View style={[styles.orb, styles.orbBottomLeft, isDark && styles.orbBlueDark]} />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTopRight: {
    top: -60,
    right: -40,
    width: 200,
    height: 200,
    backgroundColor: 'rgba(31,157,85,0.08)',
  },
  orbBottomLeft: {
    bottom: -80,
    left: -50,
    width: 220,
    height: 220,
    backgroundColor: 'rgba(45,127,184,0.06)',
  },
  orbDark: {
    backgroundColor: 'rgba(31,157,85,0.05)',
  },
  orbBlueDark: {
    backgroundColor: 'rgba(45,127,184,0.04)',
  },
});
