import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0a",
        surface: "#111111",
        card: "#161616",
        border: "#222222",
        accent: "#00e676",
        danger: "#ff1744",
        warning: "#ffd740",
        info: "#448aff",
        muted: "#555555",
        subtle: "#888888",
      },
    },
  },
  plugins: [],
};

export default config;
