# The Performa

Premium, cinematic entertainer website built with Astro, React islands, and Tailwind CSS. Designed for GitHub Pages deployment.

## Local dev

```bash
npm install
npm run dev
```

## Editing content

- `content/events.json` Upcoming events
- `content/watch.json` Featured reels
- `content/listen.json` Embedded listening links
- `content/gallery.json` Gallery assets and tags
- `content/drops.json` Fan club drops
- `content/story/*.mdx` Long-form story chapters

Placeholder media lives in `public/media/`. Replace with real images, videos, and PDFs.

## Deploying to GitHub Pages

1. Push to `main`.
2. The GitHub Actions workflow in `.github/workflows/deploy.yml` builds and deploys `dist/`.

### Base path + custom domain

Astro uses `SITE` and `BASE` env vars in `astro.config.mjs`.

- For a repo at `https://github.com/ORG/REPO`, Pages base path should be `/REPO/`.
- For a custom domain, set `BASE` to `/` and `SITE` to `https://your-domain.com`.

Update these in the workflow or override locally:

```bash
SITE=https://org.github.io/repo/ BASE=/repo/ npm run build
```

## Performance, a11y, SEO checklist

- Replace placeholder media with optimized, compressed assets.
- Keep WebGL hero only on the home page and ensure `prefers-reduced-motion` support remains.
- Ensure embeds have titles and `loading="lazy"` where possible.
- Add real OG images per page (replace `/public/media/og-default.svg`).
- Verify schema JSON-LD details in `src/pages/*.astro`.
- Run Lighthouse on `index`, `live`, and `watch` pages.

## TODO placeholders

- Update `public/media/press-kit.pdf` with real press kit.
- Replace `https://example.com` links with real endpoints.
- Add real events, watch links, and story media.
