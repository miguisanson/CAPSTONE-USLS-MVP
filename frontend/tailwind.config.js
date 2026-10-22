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
        // Muted text must reach 4.5:1 on white, the page background (canvas #f4f7f9) and slate-100 (WCAG 1.4.3; I-092).
        // Tailwind's slate-500 (#64748b) is 4.42:1 on canvas and slate-400 (#94a3b8) is 2.4:1, and both are used as
        // muted text all over the app, so the two steps are darkened here once instead of editing every page:
        // 400 = 5.7:1 on white / 5.3 on canvas / 5.2 on slate-100 / 4.6 on slate-200; 500 = 6.6:1 on white. Backgrounds that use
        // bg-slate-400 (status dots) get the same darker grey.
        slate: {
          400: "#586880",
          500: "#4e5e74",
        },
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
