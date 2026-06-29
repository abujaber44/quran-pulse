import { Platform } from 'react-native';

export const UI_COLORS = {
  background: '#17384d',
  surface: 'rgba(255,255,255,0.08)',
  darkBackground: '#0f1923',
  darkSurface: 'rgba(255,255,255,0.06)',
  primary: '#1f9d55',
  primarySoft: '#d7efe1',
  primaryDeep: '#123b36',
  accent: '#2d7fb8',
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.6)',
  textLight: 'rgba(255,255,255,0.35)',
  border: 'rgba(255,255,255,0.15)',
  borderLight: 'rgba(255,255,255,0.08)',
  danger: '#e74c3c',
  warning: '#e0b900',
  friday: 'rgba(31,157,85,0.15)',
  white: '#ffffff',
} as const;

export const UI_RADII = {
  sm: 14,
  md: 18,
  lg: 22,
  xl: 26,
} as const;

const iosShadow = (color: string, offsetY: number, opacity: number, radius: number) =>
  Platform.OS === 'ios'
    ? { shadowColor: color, shadowOffset: { width: 0, height: offsetY }, shadowOpacity: opacity, shadowRadius: radius }
    : {};

export const UI_SHADOWS = {
  card: {
    ...iosShadow('#000', 4, 0.15, 12),
  },
  input: {
    ...iosShadow('#000', 2, 0.1, 8),
  },
  floating: {
    ...iosShadow('#000', -4, 0.2, 16),
  },
} as const;

export const UI_GLASS = {
  light: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
  },
  dark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
  },
  frosted: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
  },
  frostedDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
  },
  blurIntensity: 40,
} as const;

export const UI_GRADIENTS = {
  screenLight: ['#123b36', '#17384d', '#1a4a60'] as const,
  screenDark: ['#0a1520', '#0f1923', '#152030'] as const,
  heroLight: ['#123b36', '#17384d', '#1a4a60'] as const,
  heroDark: ['#080e14', '#0f1923', '#0a1520'] as const,
  primaryGlow: ['rgba(31,157,85,0.15)', 'rgba(31,157,85,0)'] as const,
  accentGlow: ['rgba(45,127,184,0.12)', 'rgba(45,127,184,0)'] as const,
} as const;
