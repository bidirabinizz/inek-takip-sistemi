/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          green: "#00ffb4",
          dark: "#050d1a",
          darkBlue: "#0a1628",
          lightGray: "#c9d6e8",
          gray: "#8899aa",
          darkGray: "#4a6070",
          red: "#ff4d6d",
          blue: "#7dd3fc",
          purple: "#a78bfa",
          amber: "#fbbf24",
          yellow: "#f0c040",
        }
      },
      backgroundImage: {
        'cyber-gradient': 'linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #050d1a 100%)',
      },
      animation: {
        'pulse-custom': 'pulse-custom 1.5s infinite',
      },
      keyframes: {
        'pulse-custom': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        }
      },
      fontFamily: {
        mono: ["'Courier New'", 'monospace'],
      },
      boxShadow: {
        'cyber-glow': '0 0 12px rgba(0,255,180,0.15)',
      },
    },
  },
  plugins: [],
}