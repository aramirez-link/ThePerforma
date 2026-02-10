import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";

export default defineConfig({
  site: process.env.SITE || "https://example.github.io/the-performa",
  base: process.env.BASE || "/",
  output: "static",
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    mdx()
  ]
});
