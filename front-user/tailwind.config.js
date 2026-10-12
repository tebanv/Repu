/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Variables CSS existentes (para componentes actuales)
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        'muted-foreground': 'var(--color-muted-foreground)',
        border: 'var(--color-border)',
        // Paleta Neon Noir Atómica (para auth y nuevos componentes)
        atomic: {
          cyan: {
            500: '#06b6d4',
            400: '#22d3ee',
            glow: 'rgba(6, 182, 212, 0.5)',
          },
          purple: {
            500: '#a855f7',
            400: '#c084fc',
            glow: 'rgba(168, 85, 247, 0.5)',
          },
          magenta: {
            500: '#d946ef',
            400: '#e879f9',
            glow: 'rgba(217, 70, 239, 0.5)',
          },
          slate: {
            950: '#020617',
            900: '#0f172a',
          }
        }
      },
      backgroundImage: {
        'noise-texture': `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-atomic': 'linear-gradient(135deg, #06b6d4 0%, #a855f7 50%, #d946ef 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-slower': 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 3s ease-in-out infinite',
        'electric-arc': 'electricArc 4s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 8s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': {
            opacity: '0.5',
            filter: 'brightness(1) blur(8px)',
          },
          '50%': {
            opacity: '1',
            filter: 'brightness(1.5) blur(12px)',
          },
        },
        electricArc: {
          '0%, 100%': {
            opacity: '0.2',
            strokeDashoffset: '0',
          },
          '50%': {
            opacity: '0.8',
            strokeDashoffset: '100',
          },
        },
        shimmer: {
          '0%': {
            transform: 'translateX(-100%)',
          },
          '100%': {
            transform: 'translateX(100%)',
          },
        },
        float: {
          '0%, 100%': {
            transform: 'translateY(0) translateX(0)',
            opacity: '0.3',
          },
          '25%': {
            transform: 'translateY(-30px) translateX(10px)',
            opacity: '0.7',
          },
          '50%': {
            transform: 'translateY(-60px) translateX(-5px)',
            opacity: '0.5',
          },
          '75%': {
            transform: 'translateY(-30px) translateX(-10px)',
            opacity: '0.8',
          },
        },
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(6, 182, 212, 0.5), 0 0 40px rgba(6, 182, 212, 0.3)',
        'neon-purple': '0 0 20px rgba(168, 85, 247, 0.5), 0 0 40px rgba(168, 85, 247, 0.3)',
        'neon-magenta': '0 0 20px rgba(217, 70, 239, 0.5), 0 0 40px rgba(217, 70, 239, 0.3)',
        'atomic': '0 0 30px rgba(6, 182, 212, 0.3), 0 0 60px rgba(168, 85, 247, 0.2)',
      },
      backdropBlur: {
        'xs': '2px',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'Montserrat', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
