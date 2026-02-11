# store-admin-action

Secure admin actions for store orders:
- refund
- cancel
- mark_shipped
- resend_download_link

Requires authenticated user in `store_admins`.

## Required secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` (refund/cancel checkout expiry)
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (resend digital link)
