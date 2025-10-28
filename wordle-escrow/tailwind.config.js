/** @type {import('tailwindcss').Config} */
export default {
  // This tells Tailwind to scan all of your HTML, TSX, and JS files
  // in the root directory and all subdirectories for class names.
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // This section adds your custom colors to Tailwind's theme.
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
