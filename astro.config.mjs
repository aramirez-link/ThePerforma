import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";

export default defineConfig({
  site: "https://theperforma.com",
  base: "/",
  output: "static",
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    mdx()
  ]
});
