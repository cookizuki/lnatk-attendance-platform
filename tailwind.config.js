/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        band: 'var(--band)',
        stripe: 'var(--stripe)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',

        page: 'var(--bg)',
        surface: 'var(--panel)',
        'surface-2': 'var(--band)',
        'surface-2-subtle': 'var(--stripe)',
        'app-border': 'var(--line)',
        'app-border-strong': 'var(--line-strong)',
        'app-text': 'var(--ink)',
        'app-muted': 'var(--muted)',
        brand: {
          50: '#f6f4ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        obsidian: {
          950: '#0a0a0d',
          900: '#101015',
          850: '#16161c',
          800: 'rgba(255,255,255,0.10)',
          700: 'rgba(255,255,255,0.18)',
        },
      },
      transitionDuration: {
        DEFAULT: '120ms',
        120: '120ms',
      },
    },
  },
  plugins: [],
};
