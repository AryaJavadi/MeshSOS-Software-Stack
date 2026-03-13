/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:           'var(--color-bg)',
        bg2:          'var(--color-bg2)',
        surface:      'var(--color-surface)',
        surface2:     'var(--color-surface2)',
        surface3:     'var(--color-surface3)',
        border:       'var(--color-border)',
        text:         'var(--color-text)',
        'text-dim':   'var(--color-text-dim)',
        'text-muted': 'var(--color-text-muted)',
        accent:       'var(--color-accent)',
        'accent-dim': 'var(--color-accent-dim)',
        green:        'var(--color-green)',
        yellow:       'var(--color-yellow)',
        red:          'var(--color-red)',
        blue:         'var(--color-blue)',
        orange:       'var(--color-orange)',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
