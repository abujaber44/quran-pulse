export const UI_COLORS = {
  background: '#eaf2f8',
  surface: '#ffffff',
  darkBackground: '#121212',
  darkSurface: '#1e1e1e',
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

export const UI_SHADOWS = {
  card: {
    elevation: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  input: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  floating: {
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
} as const;
