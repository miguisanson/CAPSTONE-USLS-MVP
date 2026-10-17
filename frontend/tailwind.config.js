/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // University of St. La Salle institutional green
        brand: {
          50: "#edfaf1",
          100: "#d2f2db",
          200: "#a6e4ba",
          300: "#71d094",
          400: "#3fb673",
          500: "#1c9a59",
          600: "#0f7a44",
          700: "#0c6138",
          800: "#0d4e2f",
          900: "#0b4029",
        },
        canvas: "#f4f7f9",
        ink: "#0f172a",
      },
      fontFamily: {
        sans: ["'Open Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // Phase 5 design contract (.planning/phases/05-design-system/05-UI-SPEC.md sections 1-2).
      // 2xs = the 11px "micro" step that replaces text-[9px] / [10px] / [11px].
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      // Page content never stretches past 1440px on wide screens: max-w-page.
      maxWidth: {
        page: "90rem",
      },
      // One z-index scale instead of z-40 / 50 / [70] / [80] / [90] / [100] / [110].
      zIndex: {
        header: "30",
        drawer: "40",
        modal: "100",
        confirm: "110",
        toast: "120",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)",
        lift: "0 6px 24px rgba(15, 23, 42, 0.10)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
