/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}",
    "./content/**/*.{md,mdx,json}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b0b0f",
        noir: "#121218",
        ember: "#f2542d",
        gold: "#f3d38b",
        haze: "#9aa0a6"
      },
      fontFamily: {
        display: ["'Bodoni Moda'", "serif"],
        sans: ["'Space Grotesk'", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 40px rgba(242, 84, 45, 0.25)",
        halo: "0 0 120px rgba(243, 211, 139, 0.22)"
      },
      backgroundImage: {
        "radial-stage": "radial-gradient(1200px 600px at 50% 10%, rgba(242, 84, 45, 0.18), transparent 60%)",
        "noir-sheen": "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.0) 60%)"
      }
    }
  },
  plugins: []
};
