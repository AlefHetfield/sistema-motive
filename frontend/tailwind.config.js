/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#5B7C99',
        secondary: '#343E48',
        surface: '#FFFFFF',
        background: '#F4F6F8',
      }
    },
  },
  plugins: [],
}