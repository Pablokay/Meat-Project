/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        // Warm eco palette (Homedine-inspired)
        cream: '#f7f4ec',
        paper: '#fdfbf5',
        sand: '#efe9dc',
        forest: {
          DEFAULT: '#2f4034',
          50: '#eef2ec',
          100: '#dbe4d7',
          300: '#9fb398',
          400: '#75906c',
          500: '#556c4e',
          600: '#3d5442',
          700: '#2f4034',
          800: '#243027',
          900: '#1a231c',
        },
        sage: {
          DEFAULT: '#8aa084',
          50: '#f0f3ee',
          100: '#e4ebe0',
          200: '#cddac6',
          300: '#adc0a4',
          400: '#8aa084',
          500: '#6f8a68',
          600: '#586f53',
        },
        clay: '#bd7a52',
      },
      boxShadow: {
        soft: '0 10px 40px -12px rgba(47, 64, 52, 0.18)',
        card: '0 6px 24px -10px rgba(47, 64, 52, 0.15)',
      },
    },
  },
  plugins: [],
};
