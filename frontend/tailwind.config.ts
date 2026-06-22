import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        dark: {
          950: "#050505",
          900: "#080808",
          800: "#0b0b0b",
          700: "#111111",
          600: "#161616",
          500: "#1f1f1f",
        },
        neon: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        accent: {
          cyan: "#22d3ee",
          emerald: "#10b981",
          amber: "#eab308",
          rose: "#f43f5e",
          purple: "#8b5cf6",
        },
        glass: {
          light: "rgba(255, 255, 255, 0.05)",
          medium: "rgba(255, 255, 255, 0.08)",
          heavy: "rgba(255, 255, 255, 0.12)",
          border: "rgba(255, 255, 255, 0.10)",
          "border-light": "rgba(255, 255, 255, 0.06)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "glow-blue":
          "radial-gradient(ellipse at center, rgba(37, 99, 235, 0.15), transparent 70%)",
        "glow-purple":
          "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.12), transparent 70%)",
        "hero-gradient":
          "linear-gradient(135deg, #050505 0%, #080808 50%, #111111 100%)",
        "card-gradient":
          "linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(139,92,246,0.03) 100%)",
        "brand-gradient":
          "linear-gradient(135deg, #2563eb 0%, #8b5cf6 50%, #22d3ee 100%)",
      },
      boxShadow: {
        glow: "0 0 24px rgba(37, 99, 235, 0.15)",
        "glow-lg": "0 0 48px rgba(37, 99, 235, 0.2)",
        "glow-xl": "0 0 60px rgba(37, 99, 235, 0.25)",
        "glow-sm": "0 0 10px rgba(37, 99, 235, 0.1)",
        "inner-glow": "inset 0 0 20px rgba(37, 99, 235, 0.04)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.4)",
        "glass-lg": "0 16px 48px rgba(0, 0, 0, 0.5)",
        float: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 8s ease-in-out infinite",
        "float-delayed": "float 6s ease-in-out 2s infinite",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        "gradient-shift": "gradientShift 8s ease infinite",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-down": "slideDown 0.4s ease-out",
        "slide-in-left": "slideInLeft 0.4s ease-out",
        "slide-in-right": "slideInRight 0.4s ease-out",
        "fade-in": "fadeIn 0.35s ease-out",
        "scale-in": "scaleIn 0.3s ease-out",
        "spin-slow": "spin 8s linear infinite",
        shimmer: "shimmer 2s linear infinite",
        "glow-border": "glowBorder 3s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)" },
        },
        gradientShift: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        slideUp: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-16px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(16px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.97)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glowBorder: {
          "0%, 100%": { borderColor: "rgba(37, 99, 235, 0.2)" },
          "50%": { borderColor: "rgba(37, 99, 235, 0.45)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;