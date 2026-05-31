import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        royal: "#5B168C",
        royalDark: "#35104F",
        lavender: "#F5EDFA",
        gold: "#C9A227",
        ink: "#18121F",
        muted: "#6B6472"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(53,16,79,0.10)"
      }
    }
  },
  plugins: []
};
export default config;
