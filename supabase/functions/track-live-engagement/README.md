# track-live-engagement Edge Function

Tracks email engagement for live blast notifications.

Events:
- `open` via tracking pixel
- `click` via tracked redirect URL

## Endpoint

`GET /track-live-engagement?event=open|click&dispatch_id=<id>&recipient=<email>&url=<target>`

- For `open`: returns a 1x1 GIF.
- For `click`: logs event then redirects to `url`.

## Deploy

```bash
supabase functions deploy track-live-engagement
```

No direct auth is used because this is email-link traffic. The function writes only constrained event rows.

