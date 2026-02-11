# create-store-checkout

Creates a Stripe Checkout Session for store cart items.

## Required secrets

- `STRIPE_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Request

`POST` JSON:

```json
{
  "items": [{ "variantId": "uuid", "quantity": 1 }],
  "promoCode": "optional",
  "customerEmail": "optional",
  "successUrl": "https://theperforma.com/store?checkout=success",
  "cancelUrl": "https://theperforma.com/store?checkout=cancelled"
}
```

Pass Supabase access token in `Authorization: Bearer ...` when available.
Fan Vault login is required; requests without a valid bearer token are rejected.
