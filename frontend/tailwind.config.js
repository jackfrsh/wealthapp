/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1.25rem', // 20px
        sm: '1.5rem', // 24px
        lg: '2rem', // 32px
        xl: '2.5rem', // 40px
        '2xl': '3rem', // 48px
      },
      screens: {
        xl: '1280px',
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        display: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Inter"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.9375rem', { lineHeight: '1.375rem' }],
        base: ['1.0625rem', { lineHeight: '1.625rem' }],
        lg: ['1.1875rem', { lineHeight: '1.75rem' }],
        xl: ['1.375rem', { lineHeight: '1.875rem' }],
        '2xl': ['1.625rem', { lineHeight: '2rem' }],
        '3xl': ['2rem', { lineHeight: '2.375rem' }],
        '4xl': ['2.5rem', { lineHeight: '2.75rem' }],
        '5xl': ['3.25rem', { lineHeight: '3.5rem' }],
      },

      letterSpacing: {
        tightish: '-0.015em',
        tighterish: '-0.02em',
      },

      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        150: '150ms',
        180: '180ms',
        220: '220ms',
        280: '280ms',
      },

      colors: {
        surface: {
          DEFAULT: 'rgb(var(--bg-rgb) / <alpha-value>)',
          2: 'rgb(var(--bg-inset-rgb) / <alpha-value>)',
          3: 'rgb(var(--border-rgb) / <alpha-value>)',
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

      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        'card-lg': 'var(--shadow-card-lg)',
        glow: 'var(--shadow-glow)',
        'inner-ring': 'var(--shadow-inner-ring)',
      },

      animation: {
        'fade-in': 'fadeIn .3s ease-out',
        'slide-up': 'slideUp .35s ease-out',
        delta: 'deltaFlash .6s ease-out',
      },

      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
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