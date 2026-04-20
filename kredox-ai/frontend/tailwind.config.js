/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)'
        },
        border: 'var(--border)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        text: {
          primary: 'var(--text-primary)',
          muted: 'var(--text-muted)'
        }
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        customer: ['Plus Jakarta Sans', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 20px var(--accent-glow)',
        card: '0 4px 24px rgba(13,27,62,0.08)'
      },
      backgroundImage: {
        grid:
          "linear-gradient(rgba(0,51,153,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,51,153,0.035) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};
