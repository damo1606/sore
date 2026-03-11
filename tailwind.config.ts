import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        surface: "#f5f5f5",
        card: "#f9f9f9",
        border: "#e0e0e0",
        accent: "#00a854",
        danger: "#e53935",
        warning: "#f9a825",
        info: "#1565c0",
        muted: "#9e9e9e",
        subtle: "#616161",
      },
    },
  },
  plugins: [],
};

export default config;
