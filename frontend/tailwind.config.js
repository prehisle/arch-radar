/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: '#F8F9FA',
        charcoal: '#2F3542',
        serene: '#4A90E2',
        sage: '#8DBE8B',
        coral: '#E57373',
        slate: '#CED4DA',
        sky: '#F0F8FF',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'sans-serif'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
