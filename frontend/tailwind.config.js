/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        sjsu: {
          50: '#eef6ff',
          100: '#d9ecff',
          500: '#0a58ca', // SJSU blue
        }
      }
    }
  },
  plugins: [],
}
