/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          base: '#090A10',
          surface: '#121424',
          elevated: '#1A1D36',
          border: '#2A2E54',
          glass: 'rgba(18, 20, 36, 0.75)',
        },
        brand: {
          purple: {
            DEFAULT: '#9333EA',
            light: '#C084FC',
            dark: '#6B21A8',
            glow: 'rgba(147, 51, 234, 0.45)',
          },
          pink: {
            DEFAULT: '#EC4899',
            light: '#F472B6',
            dark: '#BE185D',
            glow: 'rgba(236, 72, 153, 0.45)',
          },
          cyan: {
            DEFAULT: '#06B6D4',
            light: '#67E8F9',
            dark: '#0E7490',
            glow: 'rgba(6, 182, 212, 0.45)',
          },
          gold: {
            DEFAULT: '#FBBF24',
            light: '#FDE68A',
            glow: 'rgba(251, 191, 36, 0.5)',
          },
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        },
        text: {
          primary: '#F8FAFC',
          secondary: '#94A3B8',
          muted: '#64748B',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Cabinet Grotesk', 'sans-serif'],
      },
      boxShadow: {
        'neon-purple': '0 0 20px -3px rgba(147, 51, 234, 0.5), 0 0 10px -2px rgba(147, 51, 234, 0.3)',
        'neon-pink': '0 0 20px -3px rgba(236, 72, 153, 0.5), 0 0 10px -2px rgba(236, 72, 153, 0.3)',
        'neon-cyan': '0 0 20px -3px rgba(6, 182, 212, 0.5), 0 0 10px -2px rgba(6, 182, 212, 0.3)',
        'neon-gold': '0 0 20px -3px rgba(251, 191, 36, 0.6), 0 0 10px -2px rgba(251, 191, 36, 0.4)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-reaction': 'floatReaction 2.4s ease-out forwards',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite alternate',
      },
      keyframes: {
        floatReaction: {
          '0%': { transform: 'translateY(0) scale(0.6) rotate(0deg)', opacity: '0' },
          '15%': { opacity: '1', transform: 'translateY(-20px) scale(1.15) rotate(-6deg)' },
          '50%': { transform: 'translateY(-120px) scale(1) rotate(6deg)' },
          '100%': { transform: 'translateY(-260px) scale(0.85) rotate(-10deg)', opacity: '0' },
        },
        glowPulse: {
          'from': { boxShadow: '0 0 10px rgba(147, 51, 234, 0.4)' },
          'to': { boxShadow: '0 0 25px rgba(236, 72, 153, 0.7)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
