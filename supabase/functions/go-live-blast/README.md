# go-live-blast Edge Function

Sends live-stream notifications to opted-in Fan Vault users.

Channels:
- Email via Resend
- SMS via Twilio

## Request

`POST /go-live-blast` for blasts.

`GET /go-live-blast` returns recent dispatch rows with opens/clicks (token required).

Headers:
- `Authorization: Bearer <LIVE_BLAST_TOKEN>`
- `Content-Type: application/json`
- `x-operator: <optional label>`

Body:

```json
{
  "status": "live",
  "title": "Chip Lee Pop-Up Fan Stream",
  "streamUrl": "https://theperforma.com/live",
  "platform": "youtube",
  "message": "",
  "sendEmail": true,
  "sendSms": true
}
```

## Deploy

```bash
supabase functions deploy go-live-blast
supabase functions deploy track-live-engagement
```

## Required secrets

```bash
supabase secrets set LIVE_BLAST_TOKEN=your_long_secret
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set RESEND_FROM_EMAIL=alerts@theperforma.com
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=xxxxxxxx
supabase secrets set TWILIO_FROM_NUMBER=+14045550123
```

`TWILIO_*` secrets are only required if you enable `sendSms`.

## Trigger example

```bash
curl -X POST "https://YOUR_PROJECT_REF.functions.supabase.co/go-live-blast" \
  -H "Authorization: Bearer YOUR_LIVE_BLAST_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-operator: chip-lee" \
  -d '{"status":"live","title":"Chip Lee Live Now","streamUrl":"https://theperforma.com/live","platform":"youtube","sendEmail":true,"sendSms":true}'
```
