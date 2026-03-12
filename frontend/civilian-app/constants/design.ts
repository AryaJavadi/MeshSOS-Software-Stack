export const colors = {
  // Backgrounds
  bg: '#0d1117',
  surface: '#161b22',
  surface2: '#1c2330',

  // Borders
  border: 'rgba(255,255,255,0.07)',

  // Text
  text: '#e6edf3',
  textMuted: '#7d8590',

  // Accent (purple)
  accent: '#a78bfa',
  accentDim: 'rgba(167,139,250,0.15)',
  accent2: '#7c3aed',

  // Status colors
  green: '#3fb950',
  greenDim: 'rgba(63,185,80,0.15)',
  greenBorder: 'rgba(63,185,80,0.2)',

  yellow: '#d29922',
  yellowDim: 'rgba(210,153,34,0.15)',
  yellowBorder: 'rgba(210,153,34,0.25)',

  red: '#f85149',
  redDim: 'rgba(248,81,73,0.12)',
  redBorder: 'rgba(248,81,73,0.25)',

  // Gateway
  gateway: '#f0b429',
  gatewayDim: 'rgba(240,180,41,0.15)',
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  full: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const typography = {
  // Display / hero values
  displayLg: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4, fontFamily: 'DM Sans' },
  displayMd: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3, fontFamily: 'DM Sans' },

  // Body
  bodyLg: { fontSize: 14, fontWeight: '400' as const, lineHeight: 22, fontFamily: 'DM Sans' },
  bodyMd: { fontSize: 13, fontWeight: '400' as const, lineHeight: 20, fontFamily: 'DM Sans' },
  bodySm: { fontSize: 12, fontWeight: '400' as const, lineHeight: 18, fontFamily: 'DM Sans' },

  // Labels (uppercase caps)
  labelLg: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.2, textTransform: 'uppercase' as const, fontFamily: 'DM Sans' },
  labelMd: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 1.0, textTransform: 'uppercase' as const, fontFamily: 'DM Sans' },
  labelSm: { fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const, fontFamily: 'DM Sans' },

  // Monospace (numeric / technical data)
  monoLg: { fontSize: 22, fontWeight: '700' as const, fontFamily: 'DM Mono' },
  monoMd: { fontSize: 13, fontWeight: '400' as const, fontFamily: 'DM Mono' },
  monoSm: { fontSize: 11, fontWeight: '400' as const, fontFamily: 'DM Mono' },
  monoXs: { fontSize: 10, fontWeight: '400' as const, fontFamily: 'DM Mono' },
} as const;

export const tabBarHeight = 72;
