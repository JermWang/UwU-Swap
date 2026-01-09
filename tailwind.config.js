/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Cyberpunk Green/Black palette
        cyber: {
          green: '#00FF88',
          'green-light': '#4FFFB0',
          'green-dark': '#00CC6A',
          'green-glow': '#00FF88',
          neon: '#39FF14',
          mint: '#00FFCC',
          teal: '#00CED1',
          lime: '#ADFF2F',
        },
        // Dark backgrounds
        dark: {
          bg: '#0A0A0F',
          'bg-lighter': '#12121A',
          card: '#1A1A24',
          'card-hover': '#22222E',
          border: '#2A2A3A',
          'border-light': '#3A3A4A',
        },
        // Text colors
        text: {
          primary: '#FFFFFF',
          secondary: '#A0A0B0',
          muted: '#606070',
          accent: '#00FF88',
        },
        // Accent colors
        accent: {
          purple: '#8B5CF6',
          pink: '#EC4899',
          blue: '#3B82F6',
          orange: '#F97316',
        },
      },
      borderRadius: {
        'uwu': '20px',
        'uwu-lg': '28px',
        'uwu-xl': '36px',
        'uwu-2xl': '48px',
        'uwu-full': '9999px',
      },
      boxShadow: {
        'cyber': '0 4px 20px rgba(0, 255, 136, 0.15)',
        'cyber-lg': '0 8px 40px rgba(0, 255, 136, 0.25)',
        'cyber-glow': '0 0 30px rgba(0, 255, 136, 0.4)',
        'cyber-intense': '0 0 60px rgba(0, 255, 136, 0.6)',
        'dark': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'dark-lg': '0 8px 40px rgba(0, 0, 0, 0.7)',
      },
      fontFamily: {
        kawaii: ['Nunito', 'Comic Sans MS', 'cursive', 'sans-serif'],
        cute: ['Quicksand', 'Nunito', 'sans-serif'],
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-soft': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'sparkle': 'sparkle 1.5s ease-in-out infinite',
        'heart-beat': 'heartBeat 1.2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pop-in': 'popIn 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        sparkle: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.5, transform: 'scale(1.2)' },
        },
        heartBeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.1)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.1)' },
          '70%': { transform: 'scale(1)' },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideUp: {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: 0, transform: 'scale(0.8)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
      },
      backgroundImage: {
        'gradient-kawaii': 'linear-gradient(135deg, #FFB6C1 0%, #E6E6FA 50%, #98FB98 100%)',
        'gradient-sunset': 'linear-gradient(180deg, #FFD1DC 0%, #E6E6FA 50%, #87CEEB 100%)',
        'gradient-candy': 'linear-gradient(90deg, #FFB6C1 0%, #DDA0DD 50%, #87CEEB 100%)',
      },
    },
  },
  plugins: [],
};
