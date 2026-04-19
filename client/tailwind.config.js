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
        display: ['Sora', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        customer: ['Plus Jakarta Sans', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 20px var(--accent-glow)',
        card: '0 24px 70px rgba(0,0,0,0.28)'
      },
      backgroundImage: {
        grid:
          "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};
