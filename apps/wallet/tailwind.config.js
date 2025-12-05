/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "x3-black": "#000000",
        "x3-darker": "#050505",
        "x3-dark": "#0a0a0a",
        "x3-dark-gray": "#111111",
        "x3-gray": "#1a1a1a",
        "x3-orange": "#f97316",
        "x3-red": "#dc2626",
      },
    },
  },
  plugins: [],
};
