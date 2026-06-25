# Deployment Guide

Celeris runs as three services:

| Service | Runtime | Platform | URL pattern |
|---------|---------|----------|-------------|
| `apps/web` | Vite + React | Vercel | `https://your-domain.com` |
| `apps/api` | Node + Express | Render | `https://celeris-api.onrender.com` |
| `agent` | Python + FastAPI | Render | `https://celeris-agent.onrender.com` |

The database is hosted on Supabase (PostgreSQL + Auth + Storage). No custom DB infra needed.

---

## Prerequisites

- [pnpm](https://pnpm.io) v9
- Supabase project (free tier is fine)
- Vercel account (free tier)
- Render account (free tier)
- OpenAI API key

---

## 1 — Apply database migrations

All schema migrations live in `supabase/migrations/`. Apply them **in order** from the Supabase SQL Editor (Dashboard → SQL Editor → New query):

1. All migrations from `supabase/migrations/` that came from the reference repo
2. `20260615_tenant_modules_and_onboarding.sql`
3. `20260619_event_items_margin_fields.sql`
4. `20260619_rbac_event_assignment_policy.sql`
5. `20260620_clients.sql`
6. `20260620_approval_flow.sql`
7. `20260620_event_templates.sql`

> **Never** run `prisma migrate`. Prisma is used **read-only** (`prisma db pull` to sync the schema).

---

## 2 — Environment variables

### Supabase values (used by all services)
Find these in your Supabase Dashboard → Project Settings → API and → Database:

| Variable | Where to find |
|----------|---------------|
| `SUPABASE_URL` | API → Project URL |
| `SUPABASE_ANON_KEY` | API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | API → service_role key (keep secret) |
| `SUPABASE_JWT_SECRET` | API → JWT Secret |
| `DATABASE_URL` | Database → Connection string → Transaction mode (port 6543) |
| `DIRECT_URL` | Database → Connection string → Direct (port 5432) |

Copy `.env.example` to `.env` and fill the values.

---

## 3 — Deploy AI Agent on Render

1. Go to [render.com](https://render.com) → New → Blueprint
2. Connect your GitHub repo and Render will read `render.yaml` automatically
3. Set secret environment variables:
   - `OPENAI_API_KEY` — your OpenAI key
4. Deploy. Note the public URL (e.g. `https://celeris-agent.onrender.com`)

---

## 4 — Deploy API on Render

The `render.yaml` blueprint creates the `celeris-api` service automatically alongside the agent.

Set these secret environment variables in the Render dashboard:
- `DATABASE_URL` — Supabase transaction pooler URL (port 6543)
- `DIRECT_URL` — Supabase direct URL (port 5432)
- `SUPABASE_JWT_SECRET`
- `AI_SERVICE_URL` — URL of the agent from step 3 (e.g. `https://celeris-agent.onrender.com`)

After the first successful deploy, note the API URL (e.g. `https://celeris-api.onrender.com`).

### Health check
```
curl https://celeris-api.onrender.com/health
# → {"ok":true}
```

---

## 5 — Deploy Web on Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import your repository
2. Set **Root Directory** to `apps/web`
3. Vercel will auto-detect `vercel.json` and use its `buildCommand`
4. Set environment variables:
   - `VITE_SUPABASE_URL` — same as `SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` — same as `SUPABASE_ANON_KEY`
   - `VITE_API_URL` — API URL from step 4 (e.g. `https://celeris-api.onrender.com`)
5. Deploy.

> The `buildCommand` in `vercel.json` builds `@celeris/shared` first so the web bundle resolves the shared package correctly.

---

## 6 — Seed demo data (optional)

Create a `.env.seed` file at the repo root:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Then run:
```bash
pnpm seed
```

This creates two demo tenants with different enabled module sets and pre-populated inventory, events, and templates.

---

## 7 — Run locally with Docker

Both `api` and `agent` can run as containers. The web dev server runs outside Docker.

```bash
# Copy and fill env file
cp .env.example .env

# Build and start api + agent
docker compose up --build

# In a separate terminal, run the web dev server
pnpm dev:web
```

Open `http://localhost:5173`.

The Docker build context is the **monorepo root** (the `docker-compose.yml` sets `context: .`), so Docker has access to all packages.

---

## TODO: custom domains

- Vercel: Dashboard → Project → Settings → Domains → Add your domain
- Render: Dashboard → Service → Settings → Custom Domain
- Supabase: no custom domain needed unless using Auth redirect URLs (update in Authentication → URL Configuration)

---

## CORS configuration

The API currently allows all origins (`cors({ origin: "*" })`). For production, restrict to your Vercel domain:

```ts
// apps/api/src/index.ts
app.use(cors({ origin: ["https://your-domain.com"] }));
```

---

## Render free-tier note

Free Render services spin down after 15 minutes of inactivity and take ~30 seconds to wake. For demo purposes this is fine. For production, upgrade to the Starter plan ($7/month per service) to avoid cold starts.
