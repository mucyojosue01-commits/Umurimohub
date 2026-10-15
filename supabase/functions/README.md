# MoMo Pay setup

This integration uses the MTN MoMo Collection API. The app stores payment intents first, then the server-side function sends a provider request. A payment is **never** marked paid from a browser action or an unverified callback payload.

## Supabase secrets

Set these secrets in the UmurimoHub Supabase project before enabling live payments:

- `MOMO_SUBSCRIPTION_KEY` — MTN Collection API subscription key
- `MOMO_API_USER` — MTN API user UUID
- `MOMO_API_KEY` — MTN API key
- `MOMO_BASE_URL` — optional; defaults to `https://sandbox.momodeveloper.mtn.com`
- `MOMO_TARGET_ENVIRONMENT` — optional; defaults to `sandbox`; use the exact target environment MTN assigned to the account

The standard Supabase `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` runtime values are also required. Never put provider credentials in frontend environment variables or commit them to Git.

## Deploy

From the repository root, after reviewing the provider account and sandbox credentials:

```sh
supabase functions deploy momo-pay-initiate
supabase functions deploy momo-pay-status
supabase functions deploy momo-pay-callback --no-verify-jwt
supabase secrets set MOMO_SUBSCRIPTION_KEY=... MOMO_API_USER=... MOMO_API_KEY=... MOMO_TARGET_ENVIRONMENT=sandbox
```

Configure MTN's callback URL to the deployed `momo-pay-callback` endpoint if callback delivery is enabled for the merchant account. The callback handler verifies payment status by querying MTN's authenticated status endpoint; it does not trust the callback body as proof of payment.

## Workflow

- Contract proposals record the agreed plan: `milestone` or `full_contract`.
- Milestone payments are only created for approved milestones and use the amount stored in the database.
- Full-contract payments can start only after the contract is completed and use the contract's stored amount.
- Provider requests move transactions to `processing`; only verified provider status can move them to `paid` or `failed`.
- Contract parties can open payment disputes; platform administrators can record a resolution.
- Dashboard totals use transactions visible to the authenticated user under contract-party RLS.

Until MTN credentials are supplied and the functions are deployed, the UI explicitly reports that provider setup is missing and does not claim that money was charged.
