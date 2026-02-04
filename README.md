<div align="center">
  <h1><strong>lamarzocco-cloudflare-worker ☕️</strong></h1>
  <p>Cloudflare Worker exposing a REST API for fetching status and stats from a La Marzocco machine.</p>
</div>

<hr />

<div align="center">
  <a href="#%EF%B8%8F-deploy">☁️ Deploy</a>&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="#-getting-started">🚀 Getting Started</a>&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="#-api">🧭 API</a>
</div>

<hr />

## ☁️ Deploy

One-click deploy with Cloudflare:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/simonbs/lamarzocco-cloudflare-worker)

## 🚀 Getting Started

1. Install dependencies.

```sh
npm install
```

2. Create KV namespaces.

```sh
wrangler kv namespace create lamarzocco
```

3. Create local config files (to avoid modifying tracked files).

```sh
cp .dev.vars.example .dev.vars
cp wrangler.toml wrangler.local.toml
```

4. Update `wrangler.local.toml` with your KV namespace ID.

5. Set at least these local values in `.dev.vars`: `LM_EMAIL` and `LM_PASSWORD`.

6. Start local development.

```sh
wrangler dev --config wrangler.local.toml
```

7. Set production secrets and deploy.

```sh
wrangler secret put LM_EMAIL
wrangler secret put LM_PASSWORD
wrangler deploy --config wrangler.local.toml
```

## 🧭 API

| Method | Path | Description | Availability |
| --- | --- | --- | --- |
| `GET` | `/stats` | Aggregated coffee/flush/backflush stats, recent espressos, and period totals. | Always |
| `GET` | `/status` | Machine status widgets (state, doses, scale, image URL). | Always |
| `GET` | `/openapi.json` | OpenAPI 3.0 schema for this worker. | `ENABLE_SWAGGER=true` |
| `GET` | `/docs` | Swagger UI powered by `/openapi.json`. | `ENABLE_SWAGGER=true` |

Key response data:
- `/stats`: totals, recent espressos, last backflush timestamp, and 24h/7d/30d/60d/90d/365d totals.
- `/status`: machine state, brew-by-weight doses, scale connectivity/battery, and machine image URL.

## ⚙️ Configuration

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `KV` | Binding (KV namespace) | Yes | None | Stores installation keys and auth token cache. |
| `LM_EMAIL` | Secret / env var | Yes | None | La Marzocco app email used for sign-in. |
| `LM_PASSWORD` | Secret / env var | Yes | None | La Marzocco app password used for sign-in. |
| `LM_MACHINE_ID` | Env var | No | Auto-select when possible | Machine serial number. Set this if your account has multiple machines. |
| `LM_TIMEZONE` | Env var | No | `UTC` | IANA timezone used when calculating period windows. |
| `LM_LAST_COFFEE_DAYS` | Env var | No | `365` | Number of days to fetch in the recent espresso list query. |
| `LM_INSTALLATION_ID` | Secret / env var | No | Auto-generated | Fixed installation ID. If unset, one is generated and cached in KV. |
| `LM_API_BASE` | Env var | No | `https://lion.lamarzocco.io/api/customer-app` | Override API base URL. |
| `ENABLE_SWAGGER` | Env var | No | `false` | Set to `true` to expose `/docs` and `/openapi.json`. |

## 🛠️ Development

| Command | Description |
| --- | --- |
| `npm run lint` | Run ESLint checks. |
| `npm run typecheck` | Run TypeScript type checking. |
| `npm test` | Run test suite. |
| `npm run deploy` | Deploy using tracked Wrangler config. |
| `wrangler deploy --config wrangler.local.toml` | Deploy with local, untracked config. |
