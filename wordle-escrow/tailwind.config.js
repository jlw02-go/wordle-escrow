/** @type {import('tailwindcss').Config} */
export default {
  // This is the critical fix. This pattern tells Tailwind to only scan
  // your source code files for CSS classes, preventing it from scanning
  // the massive node_modules folder, which solves the memory issue.
  content: [
    "./index.html",
    "./{App,index}.tsx",
    "./{components,pages,hooks,services,utils}/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // This section correctly adds your custom colors to Tailwind's theme.
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
