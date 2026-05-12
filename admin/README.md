# WaveX OS — Meta Mission Control

Operator-facing dashboard for **Omar**. Surfaces every customer subscription,
optimizer run, and pending injection queued by WaveX OS in one server-rendered
page.

> **This is not customer-facing.** It is a private console for the operator.
> Anyone without an `admin` claim on their Supabase JWT is rejected with 403.

## What it shows

Three panels rendered as plain HTML tables:

1. **Active subscriptions** — `user_id`, `tier`, `status`,
   `current_period_end`, `days_until_renewal`, `last_fleet_digest_received`.
2. **Recent optimizer runs** — `subscription_id`, `kind`, `model`,
   `cost_cents`, `status`, `ran_at` (sorted desc, limit 50).
3. **Pending injection queue** — `subscription_id`, `kind`, `expires_at`,
   `created_at` (sorted desc, limit 50; rows where `consumed_at IS NULL`).

The page is a single `GET /admin`. There is no SPA, no client-side fetch, and
no auth UI: the dashboard expects a Supabase JWT already in hand.

## How auth works

Each request is gated by a Supabase HS256 JWT carried either as
`Authorization: Bearer <token>` or the `sb-access-token` cookie set by the
Supabase JS client. The server itself verifies the JWT — no extra runtime —
and admits the request iff **all** of the following hold:

- Signature is valid against `SUPABASE_JWT_SECRET`.
- `exp` is in the future.
- `email` claim is present and listed in `ADMIN_USER_EMAILS`.
- `app_metadata.admin === true`.

Grant the admin flag once via the Supabase SQL editor:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"admin": true}'::jsonb
where email = 'operator@example.com';
```

## Environment

Copy `.env.example` to `.env` and fill in:

| Var                         | Required | Purpose                                              |
| --------------------------- | -------- | ---------------------------------------------------- |
| `SUPABASE_URL`              | yes      | `https://<YOUR_REF>.supabase.co`                     |
| `SUPABASE_SERVICE_ROLE_KEY` | yes      | Service-role key — server-side ONLY.                 |
| `SUPABASE_JWT_SECRET`       | yes      | Project JWT secret used to verify admin tokens.      |
| `ADMIN_USER_EMAILS`         | yes      | Comma-separated emails allowed to view the console.  |
| `PORT`                      | no       | Default `8080`.                                      |
| `HOST`                      | no       | Default `0.0.0.0`.                                   |
| `LOG_LEVEL`                 | no       | `trace`\|`debug`\|`info`\|`warn`\|`error`.           |

The server reads from the `wavex_os` schema via the Supabase JS client
(`db: { schema: 'wavex_os' }`). Required tables:

- `wavex_os.subscriptions`
- `wavex_os.optimizer_runs`
- `wavex_os.injection_queue`

## Run locally

```bash
cd admin
cp .env.example .env
# fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, ADMIN_USER_EMAILS
pnpm install
pnpm dev
# → http://localhost:8080/admin
```

The dashboard is intended to live behind `api.wavex-os.com/admin` in
production (or temporarily at the Supabase project URL
`https://<YOUR_REF>.supabase.co/admin` if you're proxying through Supabase
Edge). The server itself does not terminate TLS — front it with a managed
proxy.

## Files

```
admin/
  README.md             ← this file
  package.json          ← fastify + @supabase/supabase-js
  server.ts             ← Fastify routes, JWT verify, Supabase reads
  views/
    dashboard.html.ts   ← template-literal HTML renderer
  .env.example          ← required env vars (no secrets)
```

Total scaffold: under 600 LOC. No build step, no bundler — `tsx` runs it
directly.

## What is intentionally missing in V1

- No write endpoints. Read-only console.
- No pagination / search. Limit 50 per table is the hard ceiling.
- No auth UI. Bring your own JWT.
- No deploys. Hosting is a separate decision.
