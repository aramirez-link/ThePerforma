# The Performa

Premium, cinematic entertainer website built with Astro, React islands, and Tailwind CSS. Designed for GitHub Pages deployment.

## Local dev

```bash
npm install
npm run dev
```

## Fan Vault Cloud Sync (Supabase)

The Fan Vault profile system supports cross-device sync when Supabase is configured.

1. Create a Supabase project.
2. Run `supabase/fan_vault_schema.sql` in the Supabase SQL editor.
3. In Supabase Auth, enable Email provider.
4. Add env vars to your deployment and local shell:

```bash
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Without these env vars, Fan Vault falls back to local device storage only.

## Live stream notification blast (Resend + Twilio)

This repo now includes a Supabase Edge Function at `supabase/functions/go-live-blast/index.ts` that sends "Chip Lee is live" alerts to opted-in users from `fan_live_subscriptions`.

1. Re-run `supabase/fan_vault_schema.sql` so these objects exist:
- `fan_live_subscriptions` (now includes `sms_phone`)
- `fan_live_dispatches` (audit log of blasts)

2. Deploy the functions:

```bash
supabase functions deploy go-live-blast
supabase functions deploy track-live-engagement
```

3. Set function secrets:

```bash
supabase secrets set LIVE_BLAST_TOKEN=your_long_secret
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set RESEND_FROM_EMAIL=alerts@theperforma.com
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=xxxxxxxx
supabase secrets set TWILIO_FROM_NUMBER=+14045550123
```

4. Trigger blast when you go live:

```bash
curl -X POST "https://YOUR_PROJECT_REF.functions.supabase.co/go-live-blast" \
  -H "Authorization: Bearer YOUR_LIVE_BLAST_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-operator: chip-lee" \
  -d '{"status":"live","title":"Chip Lee Live Now","streamUrl":"https://theperforma.com/live","platform":"youtube","sendEmail":true,"sendSms":true}'
```

5. Optional "stream ended" update:

```bash
curl -X POST "https://YOUR_PROJECT_REF.functions.supabase.co/go-live-blast" \
  -H "Authorization: Bearer YOUR_LIVE_BLAST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"offline","title":"Chip Lee Stream Closed","streamUrl":"https://theperforma.com/live","platform":"youtube","sendEmail":true,"sendSms":false}'
```

Windows shortcut script:

```powershell
.\scripts\go-live-blast.ps1 -ProjectRef YOUR_PROJECT_REF -Token YOUR_LIVE_BLAST_TOKEN -Status live -Title "Chip Lee Live Now" -StreamUrl "https://theperforma.com/live" -Platform youtube -SendEmail $true -SendSms $true
```

Operator gating for in-site console and health panel:

```bash
PUBLIC_OPERATOR_EMAILS=you@example.com,ops@example.com
```

Only these emails (Fan Vault users) can access operator controls and dispatch metrics in UI.

Dispatch metrics:
- `go-live-blast` supports `GET` (token protected) for dispatch rows.
- `track-live-engagement` logs email opens/clicks and powers health panel counts.

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
- Replace `/` links with real endpoints.
- Add real events, watch links, and story media.

