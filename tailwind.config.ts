import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        card: "var(--color-card)",
        border: "var(--color-border)",
        accent: "var(--color-accent)",
        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
        info: "var(--color-info)",
        muted: "var(--color-muted)",
        subtle: "var(--color-subtle)",
        text: "var(--color-text)",
      },
    },
  },
  plugins: [],
};

export default config;
