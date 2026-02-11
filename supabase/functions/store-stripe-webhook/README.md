# store-stripe-webhook

Stripe webhook handler that syncs checkout/refund state to:
- `store_orders`
- `store_order_items`
- `store_order_events`

## Required secrets

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Stripe events

- `checkout.session.completed`
- `checkout.session.expired`
- `charge.refunded`
