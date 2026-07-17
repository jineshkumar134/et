/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aqi: {
          good: '#22c55e',
          satisfactory: '#84cc16',
          moderate: '#eab308',
          poor: '#f97316',
          'very-poor': '#ef4444',
          severe: '#7c3aed',
        }
      }
    },
  },
  plugins: [],
}
