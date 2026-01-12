/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // The Studio Reno brand colors - earthy, warm, conscious
        brand: {
          50: '#FAF8F5',
          100: '#F5F0E8',
          200: '#E8DFD3',
          300: '#D4C5B5',
          400: '#C9A86C',
          500: '#8B7355',
          600: '#6B5A45',
          700: '#4A3F30',
          800: '#3D3D3D',
          900: '#2A2A2A',
        },
        // Warm accent colors
        warm: {
          50: '#FDF8F3',
          100: '#F9EFE5',
          200: '#F2DCC8',
          300: '#E8C4A0',
          400: '#D4A574',
          500: '#C08552',
          600: '#A66B3D',
          700: '#8A5632',
          800: '#6E452A',
          900: '#5A3823',
        },
        // Keep amber for staff portal (functional orange)
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        heading: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body: ['Lato', 'sans-serif'],
        accent: ['Sacramento', 'cursive'],
        sans: ['Lato', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-warm': 'linear-gradient(135deg, #8B7355 0%, #C9A86C 100%)',
        'gradient-earth': 'linear-gradient(135deg, #6B5A45 0%, #8B7355 100%)',
      }
    },
  },
  plugins: [],
}
