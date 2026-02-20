/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Inter"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        /* iOS-aligned scale for readability */
        xs: ['0.8125rem', { lineHeight: '1.25rem' }], /* 13px */
        sm: ['0.9375rem', { lineHeight: '1.375rem' }], /* 15px */
        base: ['1.0625rem', { lineHeight: '1.625rem' }], /* 17px — iOS default */
        lg: ['1.1875rem', { lineHeight: '1.75rem' }], /* 19px */
        xl: ['1.375rem', { lineHeight: '1.875rem' }], /* 22px */
        '2xl': ['1.625rem', { lineHeight: '2rem' }], /* 26px */
        '3xl': ['2rem', { lineHeight: '2.375rem' }], /* 32px */
        '4xl': ['2.5rem', { lineHeight: '2.75rem' }], /* 40px */
        '5xl': ['3.25rem', { lineHeight: '3.5rem' }], /* 52px */
      },

      /**
       * IMPORTANT:
       * These colors pull from CSS variables (defined in src/index.css).
       * Using rgb(var(--x) / <alpha-value>) keeps Tailwind opacity modifiers working:
       * e.g. bg-ink/10, border-surface-3/40, etc.
       */
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--bg-rgb) / <alpha-value>)', // app canvas
          2: 'rgb(var(--bg-inset-rgb) / <alpha-value>)', // inset / subtle fills
          3: 'rgb(var(--border-rgb) / <alpha-value>)', // borders/dividers
          dark: 'rgb(var(--bg-rgb) / <alpha-value>)',
          'dark-2': 'rgb(var(--bg-card-rgb) / <alpha-value>)',
          'dark-3': 'rgb(var(--bg-inset-rgb) / <alpha-value>)',
        },
        card: 'rgb(var(--bg-card-rgb) / <alpha-value>)',

        ink: {
          DEFAULT: 'rgb(var(--text-rgb) / <alpha-value>)',
          2: 'rgb(var(--text-2-rgb) / <alpha-value>)',
          3: 'rgb(var(--text-3-rgb) / <alpha-value>)',
          muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        },

        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          light: 'rgb(var(--accent-light-rgb) / <alpha-value>)',
          dark: 'rgb(var(--accent-dark-rgb) / <alpha-value>)',
        },

        gain: {
          DEFAULT: 'rgb(var(--positive-rgb) / <alpha-value>)',
          light: 'rgb(var(--positive-soft-rgb) / <alpha-value>)',
        },

        loss: {
          DEFAULT: 'rgb(var(--negative-rgb) / <alpha-value>)',
          light: 'rgb(var(--negative-soft-rgb) / <alpha-value>)',
        },

        danger: {
          DEFAULT: 'rgb(var(--negative-rgb) / <alpha-value>)',
          light: 'rgb(var(--negative-soft-rgb) / <alpha-value>)',
        },
      },

      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
      },

      /**
       * Shadows: using CSS vars keeps the “material” consistent across light/dark.
       * Your components can use: shadow-card, shadow-card-hover, shadow-card-lg
       */
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        'card-lg': 'var(--shadow-card-lg)',
        glow: 'var(--shadow-glow)',
        'inner-ring': 'var(--shadow-inner-ring)',
      },

      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '13': '3.25rem',
        '18': '4.5rem',
      },

      animation: {
        'fade-in': 'fadeIn .3s ease-out',
        'slide-up': 'slideUp .35s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        delta: 'deltaFlash .6s ease-out',
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
        deltaFlash: {
          '0%': { opacity: '1' },
          '30%': { opacity: '0.7' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
