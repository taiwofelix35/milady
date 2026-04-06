/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        milady: {
          pink: "#FF69B4",
          "pink-light": "#FFB6C1",
          "pink-dark": "#C71585",
          cream: "#FFF0F5",
          blush: "#FFCCE5",
          purple: "#9B59B6",
          "purple-dark": "#6C3483",
          charcoal: "#1A1A2E",
          "charcoal-light": "#16213E",
        },
      },
      fontFamily: {
        milady: ["'Cinzel Decorative'", "'Georgia'", "serif"],
        body: ["'Raleway'", "'sans-serif'"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(255, 105, 180, 0.5)",
        "glow-sm": "0 0 10px rgba(255, 105, 180, 0.3)",
      },
      backgroundImage: {
        "milady-gradient": "linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)",
        "pink-gradient": "linear-gradient(135deg, #FF69B4 0%, #C71585 100%)",
        "card-gradient": "linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)",
      },
    },
  },
  plugins: [],
};
