import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          bg: 'var(--bg)',
          card: 'var(--card)',
          'card-hover': 'var(--card-hover)',
          border: 'var(--border)',
          'border-hover': 'var(--border-hover)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        accent: {
          start: 'var(--accent-start)',
          mid: 'var(--accent-mid)',
          end: 'var(--accent-end)',
          glow: 'var(--accent-glow)',
        },
        sidebar: {
          bg: 'var(--sidebar-bg)',
          hover: 'var(--sidebar-hover)',
          active: 'var(--sidebar-active)',
        },
        navbar: {
          bg: 'var(--navbar-bg)',
        },
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, var(--accent-start), var(--accent-mid), var(--accent-end))',
        'accent-gradient-h': 'linear-gradient(90deg, var(--accent-start), var(--accent-mid), var(--accent-end))',
        'accent-gradient-v': 'linear-gradient(180deg, var(--accent-start), var(--accent-mid), var(--accent-end))',
        'card-gradient': 'linear-gradient(135deg, var(--card), var(--card-hover))',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        glow: '0 0 20px var(--accent-glow)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 12px var(--accent-glow)' },
          '50%': { boxShadow: '0 0 24px var(--accent-glow)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
