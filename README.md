# lamarzocco Cloudflare Worker

A Cloudflare Worker (TypeScript) that logs into the La Marzocco cloud API, caches tokens in KV, and exposes espresso/backflush stats.

## Endpoints

- `GET /stats` — stats payload
- `GET /openapi.json` — OpenAPI 3.0 document (when enabled)
- `GET /docs` — Swagger UI (when enabled)

## What it returns

`GET /stats` returns JSON with:
- Espresso counts: all‑time, this year, this month, this week, today
- Backflush counts: all‑time, this year, this month, this week, today
- Most recent espresso timestamp
- Most recent backflush timestamp (if provided by API trend data)

Counts are derived strictly from La Marzocco API responses. No local database is used.

## Architecture (services)

The worker is split into focused service modules:
- `src/services/lamarzocco.ts` orchestrates the flow.
- `src/services/installation.ts` manages installation keys + client registration.
- `src/services/auth.ts` handles sign‑in/refresh token lifecycle.
- `src/services/api.ts` wraps signed API calls and 401 retry.
- `src/services/machines.ts` resolves the target machine serial number.
- `src/services/stats.ts` aggregates counts and timestamps.
- `src/services/crypto.ts` handles request proof + signatures.
- `src/services/dates.ts` normalizes calendar windows.
- `src/services/types.ts` contains shared types.

## Request flow

```
HTTP GET /stats
  -> routes/stats.ts
    -> services/lamarzocco.fetchStats
      -> config/env.assertRequiredEnv
      -> services/installation.loadInstallationKey (KV cache)
      -> services/installation.ensureClientRegistered
      -> services/machines.resolveSerialNumber
      -> services/stats.fetchStatsForMachine
        -> services/api.apiGet (signed headers, retry on 401)
          -> services/auth.getAccessToken
            -> services/auth.signIn or refreshToken (KV cache)
```

## Setup

1. Create a KV namespace:

```bash
wrangler kv:namespace create LM_KV
wrangler kv:namespace create LM_KV --preview
```

2. Update `wrangler.toml` with the KV ids.

3. Set environment variables:

```bash
wrangler secret put LM_PASSWORD
```

You can set `LM_EMAIL` (and optional values) in `wrangler.toml` `[vars]`, or as secrets if you prefer.

Required:
- `LM_EMAIL` – La Marzocco app email
- `LM_PASSWORD` – La Marzocco app password

Optional:
- `ENABLE_SWAGGER` – `true` to expose `/openapi.json` and `/docs` (default `false`)
- `LM_MACHINE_ID` – serial number (optional; if you have exactly one machine, it will be auto-selected; if you have multiple machines, requests will fail until this is set)
- `LM_TIMEZONE` – IANA timezone (default `UTC`)
- `LM_WEEK_START` – `sunday` or `monday` (default `monday`)
- `LM_LAST_COFFEE_DAYS` – days to query for last espresso list (default `365`)
- `LM_INSTALLATION_ID` – fixed installation id; if omitted, one is generated and stored in KV
- `LM_API_BASE` – override API base (default `https://lion.lamarzocco.io/api/customer-app`)

## Develop & deploy

```bash
npm install
npm run dev
npm run deploy
```

## Notes

- The worker caches the installation key material and auth tokens in KV.
- “Backflush” values are based on the API’s flush counters/trend data; if the API doesn’t provide flush events, related fields will be `null` or `0`.
- Timestamps are returned in ISO‑8601 (UTC).
- `/docs` and `/openapi.json` are only exposed when `ENABLE_SWAGGER=true`.
