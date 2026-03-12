// ─── Theme colour palettes ────────────────────────────────────────────────────

export interface ThemeColors {
  // Backgrounds
  bg: string;
  surface: string;
  surface2: string;

  // Borders
  border: string;

  // Text
  text: string;
  textMuted: string;

  // Accent (purple)
  accent: string;
  accentDim: string;
  accent2: string;

  // Status colors
  green: string;
  greenDim: string;
  greenBorder: string;

  yellow: string;
  yellowDim: string;
  yellowBorder: string;

  red: string;
  redDim: string;
  redBorder: string;

  // Info blue
  blue: string;
  blueDim: string;
  blueBorder: string;

  // Gateway
  gateway: string;
  gatewayDim: string;
}

export const darkTheme: ThemeColors = {
  bg: '#0d1117',
  surface: '#161b22',
  surface2: '#1c2330',

  border: 'rgba(255,255,255,0.07)',

  text: '#e6edf3',
  textMuted: '#7d8590',

  accent: '#a78bfa',
  accentDim: 'rgba(167,139,250,0.15)',
  accent2: '#7c3aed',

  green: '#3fb950',
  greenDim: 'rgba(63,185,80,0.15)',
  greenBorder: 'rgba(63,185,80,0.2)',

  yellow: '#d29922',
  yellowDim: 'rgba(210,153,34,0.15)',
  yellowBorder: 'rgba(210,153,34,0.25)',

  red: '#f85149',
  redDim: 'rgba(248,81,73,0.12)',
  redBorder: 'rgba(248,81,73,0.25)',

  blue: '#388bfd',
  blueDim: 'rgba(56,139,253,0.15)',
  blueBorder: 'rgba(56,139,253,0.3)',

  gateway: '#f0b429',
  gatewayDim: 'rgba(240,180,41,0.15)',
};

export const lightTheme: ThemeColors = {
  bg: '#f5f5f0',
  surface: '#ffffff',
  surface2: '#f0f0eb',

  border: 'rgba(0,0,0,0.1)',

  text: '#1a1a1a',
  textMuted: '#4b5563',

  // Accent is green in light theme (matches mockup)
  accent: '#16a34a',
  accentDim: 'rgba(22,163,74,0.12)',
  accent2: '#15803d',

  green: '#16a34a',
  greenDim: 'rgba(22,163,74,0.12)',
  greenBorder: 'rgba(22,163,74,0.25)',

  yellow: '#d29922',
  yellowDim: 'rgba(210,153,34,0.15)',
  yellowBorder: 'rgba(210,153,34,0.25)',

  red: '#f85149',
  redDim: 'rgba(248,81,73,0.12)',
  redBorder: 'rgba(248,81,73,0.25)',

  blue: '#0969da',
  blueDim: 'rgba(9,105,218,0.12)',
  blueBorder: 'rgba(9,105,218,0.25)',

  gateway: '#d29922',
  gatewayDim: 'rgba(210,153,34,0.15)',
};