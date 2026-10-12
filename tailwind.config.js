/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#F9B21A',
      },
      fontFamily: {
        body: ['Inter', 'system-ui', 'sans-serif'],
        invoice: ['Ubuntu', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
