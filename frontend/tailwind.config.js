/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#faf9f7',
          2: '#f3f1ed',
          3: '#eae7e1',
          dark: '#0c0c0c',
          'dark-2': '#161616',
          'dark-3': '#1e1e1e',
        },
        ink: {
          DEFAULT: '#0f0e0d',
          2: '#2a2826',
          3: '#4a4742',
          muted: '#9a9590',
        },
        accent: {
          DEFAULT: '#16a34a',
          light: '#dcfce7',
          dark: '#15803d',
        },
        danger: {
          DEFAULT: '#dc2626',
          light: '#fef2f2',
        },
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.02)',
        'card-hover': '0 8px 25px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.04)',
        glow: '0 0 40px rgba(22,163,74,.12)',
      },
      animation: {
        'fade-in': 'fadeIn .3s ease-out',
        'slide-up': 'slideUp .35s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.6' },
        },
      },
    },
  },
  plugins: [],
}
