import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#08111F",
        panel: "#0E1B2B",
        line: "rgba(148, 163, 184, 0.18)",
        mint: "#7CF2C3",
        cyan: "#79D7FF",
        violet: "#8B7CFF",
        iris: "#A86EFF",
        coral: "#FF8E6D",
        blush: "#FF6FB2",
        aqua: "#45E6D1",
        sand: "#EDE6D6",
      },
      boxShadow: {
        soft: "0 24px 80px rgba(8, 17, 31, 0.24)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(121, 215, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(121, 215, 255, 0.08) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
