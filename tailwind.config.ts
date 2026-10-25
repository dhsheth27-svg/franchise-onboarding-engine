import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

// Dark theme by design: neutral and status scales are inverted (50 <-> 950) so that "light tint"
// classes read as dark tints and "dark text" classes read as light text on a near-black canvas.
type Scale = Record<string, string>;
const invert = (s: Scale): Scale => {
  const keys = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
  return Object.fromEntries(keys.map((k, i) => [k, s[keys[keys.length - 1 - i]]]));
};

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral (inverted): 50 = darkest panel, 900 = primary text.
        slate: {
          50: '#0C0C0E',
          100: '#151518',
          200: '#25252A',
          300: '#36363D',
          400: '#70707B',
          500: '#9A9AA4',
          600: '#B8B8C1',
          700: '#D2D2D9',
          800: '#E4E4E8',
          900: '#F4F4F6',
          950: '#FAFAFA',
        },
        emerald: invert(colors.emerald as Scale),
        teal: invert(colors.teal as Scale),
        amber: invert(colors.amber as Scale),
        sky: invert(colors.sky as Scale),
        rose: invert(colors.rose as Scale),
        // One accent: signal red-orange. Low steps are dark tints, 600 is the accent, high steps are light text.
        // One accent: electric violet. It is the only strong hue the status colours (green, teal,
        // amber, sky, rose) do not use, so "click here" never reads as "something is wrong".
        // Low steps are dark tints, 600 is the accent, high steps are light text.
        brand: {
          50: '#110C22',
          100: '#18112F',
          200: '#271C52',
          300: '#3C2B80',
          400: '#5E44E0',
          500: '#9077FF',
          600: '#7C5CFF',
          700: '#A592FF',
          800: '#C2B4FF',
          900: '#DFD7FF',
        },
        surface: '#0F0F11',
        canvas: '#060606',
        ink: '#FAFAFA',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 32px -18px rgba(0,0,0,0.9)',
        lift: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 48px -20px rgba(124,92,255,0.38)',
        btn: '0 10px 28px -10px rgba(124,92,255,0.85)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in': { from: { transform: 'translateX(32px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'scale-in': { from: { transform: 'scale(0.96)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'grow-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        'pulse-dot': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
      },
      animation: {
        'fade-up': 'fade-up 0.55s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.3s ease-out both',
        'slide-in': 'slide-in 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.22,1,0.36,1) both',
        'grow-x': 'grow-x 0.9s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.4s linear infinite',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
