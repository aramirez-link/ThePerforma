# live Edge Function

Control-plane endpoints for Performa Live multi-stream sessions.

## Routes

- `POST /live/session.create`
- `POST /live/session.sync`
- `POST /live/destination.upsert`
- `POST /live/session.start`
- `POST /live/session.end`
- `POST /live/webhook`
- `POST /live/public.status`

## Required runtime secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LIVE_SECRET_ENCRYPTION_KEY` (base64 encoded 32-byte key for AES-256-GCM)

## Optional runtime secrets

- `CF_STREAM_ACCOUNT_ID`
- `CF_STREAM_API_TOKEN`
- `LIVE_WEBHOOK_SECRET` (HMAC SHA-256 verification for webhook payloads)

If Cloudflare secrets are absent, the function uses a mock adapter for local/dev behavior.

## Deploy

```bash
supabase functions deploy live
```

## Test

```bash
deno test supabase/functions/live
```
