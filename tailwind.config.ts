import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // One accent: a bright royal blue. Status colours (emerald/amber/sky/rose) only where they carry meaning.
        brand: {
          50: '#EEF3FF',
          100: '#DCE6FF',
          200: '#BCD0FF',
          300: '#8EAFFF',
          400: '#5A86FF',
          500: '#3366FF',
          600: '#1F55F5',
          700: '#1745D6',
          800: '#1838AB',
          900: '#172F7E',
        },
        ink: '#0B1638',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,22,56,0.04), 0 8px 24px -12px rgba(11,22,56,0.12)',
        lift: '0 2px 4px rgba(11,22,56,0.05), 0 18px 40px -16px rgba(23,69,214,0.25)',
        btn: '0 6px 16px -6px rgba(31,85,245,0.55)',
      },
    },
  },
  plugins: [],
};
export default config;
