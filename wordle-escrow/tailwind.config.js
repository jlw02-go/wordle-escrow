/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{App,index}.tsx",
    "./{components,pages,hooks,services,utils}/**/*.{js,ts,jsx,tsx}",
  ],
  // This is the critical fix for the missing grid colors.
  // It tells Tailwind to never remove these classes during optimization.
  safelist: [
    'bg-wordle-green',
    'bg-wordle-yellow',
    'bg-wordle-gray',
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
