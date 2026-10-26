import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Lavender dashboard theme: a deep violet frame, white panels, pastel stat cards and navy text.
        // Neutrals carry a slight violet tint so greys sit naturally on the lavender canvas.
        slate: {
          50: '#F7F7FD',
          100: '#EFEFF9',
          200: '#E2E2F2',
          300: '#C9C8E2',
          400: '#9B99BD',
          500: '#6C6A93',
          600: '#535180',
          700: '#3E3C68',
          800: '#2D2B55',
          900: '#221F4A',
          950: '#15123A',
        },
        // One accent: deep violet (the frame and primary buttons).
        brand: {
          50: '#F2F0FD',
          100: '#E5E1FA',
          200: '#CCC4F3',
          300: '#AA9DE8',
          400: '#8471DA',
          500: '#634CC8',
          600: '#4B33B2',
          700: '#3F2A99',
          800: '#33227B',
          900: '#2A1D62',
          950: '#1A123F',
        },
        // Pastel fills for stat cards (always with navy text).
        pastel: {
          cyan: '#D4F1FB',
          pink: '#FBDDE9',
          violet: '#E6E1FB',
          mint: '#D8F4E8',
        },
        surface: '#FFFFFF',
        canvas: '#E7E8F8',
        ink: '#221F4A',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 8px 28px -14px rgba(50,38,130,0.22)',
        lift: '0 26px 50px -22px rgba(50,38,130,0.40)',
        btn: '0 10px 22px -10px rgba(75,51,178,0.75)',
        paper: '0 30px 70px -28px rgba(50,38,130,0.45)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in': { from: { transform: 'translateX(32px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'scale-in': { from: { transform: 'scale(0.96)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'grow-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        'pulse-dot': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
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
        drift: 'drift 26s ease-in-out infinite',
        'drift-slow': 'drift 38s ease-in-out infinite reverse',
      },
    },
  },
  plugins: [],
};
export default config;
