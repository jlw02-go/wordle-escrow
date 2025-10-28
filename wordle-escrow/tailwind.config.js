// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{components,pages,hooks,services,utils}/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'wordle-dark': '#121213',
        'wordle-light': '#d7dadc',
        'wordle-gray': '#3a3a3c',
        'wordle-yellow': '#b59f3b',
        'wordle-green': '#538d4e',
      },
    },
  },
  plugins: [],
}
