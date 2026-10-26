import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light "paper" theme. Neutrals are warm (stone-like) instead of cool grey so the app reads like
        // a well-kept ledger rather than a generic dashboard.
        slate: {
          50: '#FAF7F1',
          100: '#F2EDE3',
          200: '#E5DED0',
          300: '#D2C8B7',
          400: '#A39A8A',
          500: '#6F675A',
          600: '#575045',
          700: '#3F3A32',
          800: '#2B2722',
          900: '#1C1915',
          950: '#12100C',
        },
        // One accent: cobalt. No status colour (green, teal, amber, sky, rose) is close to it,
        // so "click here" never reads as "something is wrong".
        brand: {
          50: '#EEF1FF',
          100: '#DFE5FF',
          200: '#C3CDFF',
          300: '#9AAAFF',
          400: '#6A7FFB',
          500: '#3F5BF6',
          600: '#2443E8',
          700: '#1C34C2',
          800: '#1A2D9A',
          900: '#1A2A79',
          950: '#121A4A',
        },
        surface: '#FFFDF8',
        canvas: '#F4EFE6',
        ink: '#16140F',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(22,20,15,0.03), 0 1px 3px rgba(22,20,15,0.05)',
        lift: '0 1px 0 rgba(22,20,15,0.03), 0 22px 44px -24px rgba(22,20,15,0.32)',
        btn: '0 8px 20px -10px rgba(36,67,232,0.75)',
        paper: '0 1px 0 rgba(22,20,15,0.04), 0 30px 60px -30px rgba(22,20,15,0.35), 0 12px 24px -16px rgba(22,20,15,0.18)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in': { from: { transform: 'translateX(32px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'scale-in': { from: { transform: 'scale(0.96)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'grow-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        'pulse-dot': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        drift: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(6%,4%,0) scale(1.08)' },
          '66%': { transform: 'translate3d(-5%,6%,0) scale(0.95)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.55s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.3s ease-out both',
        'slide-in': 'slide-in 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.22,1,0.36,1) both',
        'grow-x': 'grow-x 0.9s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.4s linear infinite',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
        float: 'float 7s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite reverse',
        drift: 'drift 26s ease-in-out infinite',
        'drift-slow': 'drift 38s ease-in-out infinite reverse',
      },
    },
  },
  plugins: [],
};
export default config;
