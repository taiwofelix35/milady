/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        milady: {
          pink: '#f472b6',
          'pink-light': '#fce7f3',
          'pink-dark': '#db2777',
          purple: '#c084fc',
          'purple-light': '#f3e8ff',
          'purple-dark': '#9333ea',
          cream: '#fdf4ff',
          blush: '#fbcfe8',
          lavender: '#e9d5ff',
          rose: '#fda4af',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'milady-gradient': 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #fce7f3 100%)',
        'milady-card': 'linear-gradient(145deg, #fff0f9 0%, #f5f0ff 100%)',
        'milady-button': 'linear-gradient(135deg, #f472b6 0%, #c084fc 100%)',
        'milady-hero': 'linear-gradient(135deg, #fdf4ff 0%, #fce7f3 25%, #f3e8ff 50%, #fce7f3 75%, #fdf4ff 100%)',
      },
      boxShadow: {
        'milady': '0 4px 20px rgba(244, 114, 182, 0.15)',
        'milady-lg': '0 8px 40px rgba(244, 114, 182, 0.2)',
        'milady-hover': '0 8px 30px rgba(192, 132, 252, 0.25)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-pink': 'pulse-pink 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-pink': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.7 },
        },
      },
    },
  },
  plugins: [],
}
