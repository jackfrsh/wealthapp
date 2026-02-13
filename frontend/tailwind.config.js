/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"Inter"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Inter"', 'ui-monospace', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#f8f9fa',
          2: '#f1f3f5',
          3: '#e9ecef',
          dark: '#0f1117',
          'dark-2': '#181b22',
          'dark-3': '#1f222b',
        },
        ink: {
          DEFAULT: '#0f0e0d',
          2: '#2a2826',
          3: '#4a4742',
          muted: '#868e96',
        },
        accent: {
          DEFAULT: '#3b82c4',
          light: '#e7f1fb',
          dark: '#2d6aa0',
        },
        gain: {
          DEFAULT: '#22a06b',
          light: '#e3fcef',
        },
        loss: {
          DEFAULT: '#de350b',
          light: '#ffebe6',
        },
        danger: {
          DEFAULT: '#de350b',
          light: '#ffebe6',
        },
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.02)',
        'card-hover': '0 8px 25px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.04)',
        glow: '0 0 40px rgba(59,130,196,.10)',
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
