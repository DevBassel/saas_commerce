# Deploying to Railway

Four Railway services built from this repository root, plus a Railway Postgres plugin:

| Railway service | Package | Dockerfile | Healthcheck |
| --- | --- | --- | --- |
| `api` | `saas_store_api` | `apps/api/Dockerfile` | `/api/v1/health` |
| `tenant_store` | `tenant_store` | `apps/tenant_store/Dockerfile` | `/` |
| `store_owner_dashboard` | `tenant_dash` | `apps/store_owner_dashboard/Dockerfile` | `/` |
| `super_admin_dashboard` | `super_admin_dash` | `apps/super_admin_dashboard/Dockerfile` | `/` |

Every service uses the **repository root** as its build context and the Dockerfile path above,
e.g. `railway up --dockerfile apps/api/Dockerfile` (or set the Dockerfile path in the service
settings and deploy the repo root). Add a **Postgres** plugin to the same project.

## Build variables

Railway passes service variables to the build, so build-time env (Vite `VITE_*` and Next
`NEXT_PUBLIC_*`) must be set as service variables too. Point each frontend at the API's public
domain using Railway references:

- `store_owner_dashboard` and `super_admin_dashboard`:
  - `VITE_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}/api/v1`
- `tenant_store`:
  - `NEXT_PUBLIC_BACKEND_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}/api/v1`
  - `NEXT_PUBLIC_APP_ROOT_DOMAIN=<your-root-domain>` (e.g. `example.com`)
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<stripe publishable key>`

Changing any of these requires rebuilding the affected frontend, because they are inlined at build
time.

## Runtime variables

### `api`

- `APP_PORT=${{PORT}}` (the API reads `APP_PORT` and has no `PORT` fallback).
- `NODE_ENV=production`.
- Postgres plugin references:
  - `DB_HOST=${{Postgres.PGHOST}}`
  - `DB_PORT=${{Postgres.PGPORT}}`
  - `DB_USERNAME=${{Postgres.PGUSER}}`
  - `DB_PASSWORD=${{Postgres.PGPASSWORD}}`
  - `DB_NAME=${{Postgres.PGDATABASE}}`
- `DB_SSL=true`.
- `DB_SYNCHRONIZE=true`.
- `DB_SYNCHRONIZE_TENANTS=true` — optional opt-in that lets tenant `tenant_<slug>` schemas be
  created while `NODE_ENV=production`. See the caveat below.
- JWT secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (≥32 chars, no placeholders).
- `JWT_ISSUER`, `JWT_AUDIENCE` (required explicitly in production).
- `APP_ROOT_DOMAIN`, `CORS_ORIGIN`, plus the remaining non-secret groups (`APP_NAME`, `API_PREFIX`,
  `API_VERSION`, `BCRYPT_ROUNDS`, `LOG_LEVEL`, `THROTTLE_TTL`, `THROTTLE_LIMIT`, `CORS_CREDENTIALS`,
  `TENANT_POOL_SIZE`, `TENANT_STORAGE_CAPACITY_BYTES`, `MAX_FILE_SIZE`, `MAX_PRODUCT_IMAGES`).
- R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (≥32 chars), `R2_BUCKET`,
  `R2_PUBLIC_URL`.
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (≥32 chars), `STRIPE_PUBLISHABLE_KEY`
  (Joi-required at boot even though the payments module is not implemented yet).

### `tenant_store`

- `NEXTAUTH_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}`, `NEXTAUTH_SECRET` (random ≥32 chars).
- The standalone Next server reads `PORT` (Railway injects it) and `HOSTNAME` (image sets
  `0.0.0.0`).

### Dashboards

- No runtime variables; `VITE_API_URL` is baked in at build time. The `serve` process binds
  `${PORT:-3000}`.

## Healthchecks

- API: `/api/v1/health` (reports DB + R2).
- Storefront and dashboards: `/`.

## Caveats

- **Tenant subdomains need a wildcard custom domain.** Tenant resolution is subdomain-based
  (`<tenant>.<APP_ROOT_DOMAIN>`); Railway's default `*.up.railway.app` domains do not support
  wildcard subdomains. Add a custom domain with a wildcard DNS record (`*.<root>` →
  `*.up.railway.app`) on the `tenant_store` (and, for per-tenant dashboard hosts, the dashboard)
  service.
- **`DB_SYNCHRONIZE_TENANTS=true` mutates production schema on boot.** There is no migrations
  system; this flag is a stopgap. Turn it off after the first successful tenant provisioning.
- **Joi requires Stripe + R2 values at boot** even though payments are unimplemented; a deploy
  without real keys fails validation.
- **Build-time frontend env** means an API domain change requires rebuilding the three frontends.
- `next.config.ts` `remotePatterns` hardcodes an `r2.dev` host; a custom R2/CDN domain still needs a
  code change.
