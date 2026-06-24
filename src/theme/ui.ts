import { Platform } from 'react-native';

export const UI_COLORS = {
  background: '#eaf2f8',
  surface: '#ffffff',
  darkBackground: '#0f1923',
  darkSurface: '#1a2634',
  primary: '#1f9d55',
  primarySoft: '#d7efe1',
  primaryDeep: '#123b36',
  accent: '#2d7fb8',
  text: '#17384d',
  textMuted: '#5f7384',
  textLight: '#a8b7c3',
  border: '#c8d9e6',
  danger: '#e74c3c',
  warning: '#e0b900',
  friday: '#d6ecfb',
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
    ...iosShadow('#1a3a5c', 4, 0.08, 16),
  },
  input: {
    ...iosShadow('#1a3a5c', 2, 0.06, 10),
  },
  floating: {
    ...iosShadow('#0d1f30', -4, 0.15, 20),
  },
} as const;

export const UI_GLASS = {
  light: {
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 1,
  },
  dark: {
    backgroundColor: 'rgba(26, 38, 52, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
  },
  frosted: {
    backgroundColor: 'rgba(255, 255, 255, 0.80)',
    borderColor: 'rgba(200, 217, 230, 0.5)',
    borderWidth: 1,
  },
  frostedDark: {
    backgroundColor: 'rgba(26, 38, 52, 0.85)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
  },
  blurIntensity: 40,
} as const;

export const UI_GRADIENTS = {
  screenLight: ['#e8f4fd', '#dfedf7', '#eaf2f8'] as const,
  screenDark: ['#0a1520', '#0f1923', '#152030'] as const,
  heroLight: ['#123b36', '#17384d', '#1a4a60'] as const,
  heroDark: ['#080e14', '#0f1923', '#0a1520'] as const,
  primaryGlow: ['rgba(31,157,85,0.15)', 'rgba(31,157,85,0)'] as const,
  accentGlow: ['rgba(45,127,184,0.12)', 'rgba(45,127,184,0)'] as const,
} as const;
