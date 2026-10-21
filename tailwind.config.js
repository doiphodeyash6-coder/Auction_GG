/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#202522',
        paper: '#f5f3ee',
        moss: '#596b50',
        clay: '#c86f4a',
        line: '#e4e1d8',
      },
      fontFamily: {
        display: ['Georgia', 'Times New Roman', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: { soft: '0 18px 60px rgba(32, 37, 34, .08)' },
    },
  },
  plugins: [],
};
