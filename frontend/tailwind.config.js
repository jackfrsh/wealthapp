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
        'xs':   ['0.8125rem', { lineHeight: '1.25rem' }],   /* 13px */
        'sm':   ['0.9375rem', { lineHeight: '1.375rem' }],  /* 15px */
        'base': ['1.0625rem', { lineHeight: '1.625rem' }],  /* 17px — iOS default */
        'lg':   ['1.1875rem', { lineHeight: '1.75rem' }],   /* 19px */
        'xl':   ['1.375rem',  { lineHeight: '1.875rem' }],  /* 22px */
        '2xl':  ['1.625rem',  { lineHeight: '2rem' }],      /* 26px */
        '3xl':  ['2rem',      { lineHeight: '2.375rem' }],  /* 32px */
        '4xl':  ['2.5rem',    { lineHeight: '2.75rem' }],   /* 40px */
        '5xl':  ['3.25rem',   { lineHeight: '3.5rem' }],    /* 52px */
      },
      colors: {
        surface: {
          DEFAULT: '#f5f5f0',     /* warm off-white — not pure white */
          2: '#eeeee8',           /* slightly deeper for inset areas */
          3: '#e4e4de',           /* borders, dividers */
          dark: '#161921',        /* deep slate — not pure black */
          'dark-2': '#1c2029',    /* card surface in dark */
          'dark-3': '#242832',    /* elevated surface in dark */
        },
        ink: {
          DEFAULT: '#1a1a1a',
          2: '#2e2e2e',
          3: '#555555',
          muted: '#8c8c8c',
        },
        accent: {
          DEFAULT: '#3b7cc4',     /* trustworthy blue — slightly warmed */
          light: '#e8f0fa',
          dark: '#2d64a0',
        },
        gain: {
          DEFAULT: '#1a9a5e',     /* softer green — not neon */
          light: '#e6f7ef',
        },
        loss: {
          DEFAULT: '#d13415',
          light: '#fde8e3',
        },
        danger: {
          DEFAULT: '#d13415',
          light: '#fde8e3',
        },
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
      },
      boxShadow: {
        'card':      '0 1px 3px rgba(0,0,0,.03), 0 4px 12px rgba(0,0,0,.04)',
        'card-hover': '0 8px 30px rgba(0,0,0,.08), 0 2px 8px rgba(0,0,0,.04)',
        'card-lg':   '0 4px 24px rgba(0,0,0,.06), 0 1px 4px rgba(0,0,0,.03)',
        'glow':      '0 0 60px rgba(59,124,196,.08)',
        'inner-ring': 'inset 0 0 0 1px rgba(0,0,0,.04)',
      },
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '13':  '3.25rem',
        '18':  '4.5rem',
      },
      animation: {
        'fade-in':    'fadeIn .3s ease-out',
        'slide-up':   'slideUp .35s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '.6' },
        },
      },
    },
  },
  plugins: [],
}
