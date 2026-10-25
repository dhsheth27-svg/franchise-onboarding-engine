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
          400: '#5C5C66',
          500: '#80808A',
          600: '#A3A3AD',
          700: '#C6C6CE',
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
        brand: {
          50: '#1E0B07',
          100: '#2C110A',
          200: '#4A1A10',
          300: '#7C2615',
          400: '#D63A1E',
          500: '#FF5233',
          600: '#FF4122',
          700: '#FF6A4F',
          800: '#FF8C76',
          900: '#FFB7A8',
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
        lift: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 48px -20px rgba(255,65,34,0.35)',
        btn: '0 10px 28px -10px rgba(255,65,34,0.85)',
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
