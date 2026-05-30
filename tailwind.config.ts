import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          500: "#2563eb",
          600: "#1d4ed8",
          900: "#172554",
        },
      },
      boxShadow: {
        soft: "0 20px 50px -30px rgba(15,23,42,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
