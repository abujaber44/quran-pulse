import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UI_GRADIENTS } from '../theme/ui';

interface GlassBackgroundProps {
  isDark?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function GlassBackground({ children, style }: GlassBackgroundProps) {
  return (
    <LinearGradient
      colors={UI_GRADIENTS.heroLight}
      style={[styles.container, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
