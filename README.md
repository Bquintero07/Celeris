# Celeris

**Celeris is a white-label, multi-tenant SaaS platform for ATL/BTL event-production agencies.** It replaces scattered spreadsheets with a single workspace covering the full operations cycle: AI-assisted quote generation, inventory and crew management, supplier tracking, client/CRM records, approval-flow invoicing, and real-time budget vs. revenue analytics — all under the agency's own branding, with strict role-based access control and per-tenant data isolation.

## Features

- **Events & quotes** — create events, build itemized quote lines, track margin/profit per line and per quote
- **AI quote assistant** — a dedicated agent suggests quote line items (equipment, crew, suppliers) from a natural-language brief and the tenant's own inventory
- **Inventory, suppliers & crew** — manage owned equipment, external suppliers, and personnel with availability/scheduling conflict checks
- **Clients (CRM)** — billing-ready client records with tax ID, contact info, and history
- **Approval workflow** — draft → review → approved → sent → rejected, with an immutable audit log
- **Billing & exports** — PDF invoices and Excel quote exports, with margin visibility gated by role
- **Analytics** — revenue and margin breakdowns by event, by client, and by period
- **Event templates** — reusable line-item sets to speed up recurring event types
- **White-label branding** — per-tenant logo and brand colors
- **Module gating** — each tenant only sees the feature modules enabled for their plan
- **Super-admin console** — cross-tenant management: create/suspend organizations, toggle modules, manage users

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, React Router v7, TanStack Query, Tailwind CSS v4, shadcn/ui (Radix) |
| API | Node.js, TypeScript, Express, Prisma (typed client, raw SQL queries) |
| AI agent | Python, FastAPI, OpenAI API |
| Database & Auth | Supabase (PostgreSQL, Auth, Row-Level Security, Storage) |
| Shared contracts | `packages/shared` — RBAC permissions map, module catalog, shared types |
| Deployment | Vercel (web), Render (api + agent), Docker for local/agent packaging |

## Architecture

```
apps/
  web/      React SPA — calls the API for all data, Supabase only for auth/storage
  api/      Express REST API — verifies Supabase JWTs, enforces RBAC + module gating,
            scopes every query by organization_id
packages/
  shared/   Single source of truth for roles, permissions, and module keys
agent/      FastAPI microservice — generates AI quote suggestions, called only by the API
supabase/
  migrations/  SQL schema and RLS policies — the source of truth for the database
```

**Multi-tenancy & security model**
- Every business table is scoped by `organization_id`; the API enforces this on every query and Postgres Row-Level Security enforces it again at the database layer as defense in depth.
- Authentication is Supabase JWT, verified server-side on every `/api/*` request.
- Authorization is role-based (`admin`, `comercial`, `contable`, `logistica`, `personal`, `viewer`, plus a cross-tenant `super_admin`) and feature-gated per tenant via the modules system.
- The AI agent is not publicly callable — it requires a shared secret (`AGENT_SHARED_SECRET`) sent only by the API.
- CORS is restricted to known frontend origins via `CORS_ORIGIN`, and all `/api/*` routes are rate-limited.

## Getting Started

### Prerequisites
- [pnpm](https://pnpm.io) v9 (`corepack enable` will pick up the version pinned in `package.json`)
- Node.js 20+
- Python 3.12+ (for the AI agent)
- A Supabase project (the database schema already lives in `supabase/migrations/`)

### Install
```bash
pnpm install
```

### Configure environment
Copy the example env files and fill in your own Supabase project's values:
```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env   # if present
cp agent/.env.example agent/.env
```
`AGENT_SHARED_SECRET` must be the **same value** in `apps/api/.env` and `agent/.env` — generate one with `openssl rand -hex 32`.

### Run each service
```bash
pnpm dev:api     # API on :3000
pnpm dev:web     # Web on :5173
cd agent && pip install -r requirements.txt && uvicorn app.main:app --reload   # Agent on :8000
```

### Or run the API + agent with Docker
```bash
docker compose up --build
pnpm dev:web   # web still runs outside Docker
```

## Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | web | Supabase project URL |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | web | Supabase public anon key (auth/storage only) |
| `SUPABASE_JWT_SECRET` | api | Verifies incoming Supabase JWTs |
| `DATABASE_URL` | api | Postgres connection (pooled, transaction mode) |
| `DIRECT_URL` | api | Postgres connection (direct, for migrations/introspection) |
| `AI_SERVICE_URL` | api | Base URL of the agent service |
| `AGENT_SHARED_SECRET` | api, agent | Mutual auth between the API and the agent |
| `CORS_ORIGIN` | api | Comma-separated list of allowed frontend origins |
| `OPENAI_API_KEY` | agent | OpenAI API key used for quote suggestions |
| `VITE_API_URL` | web | Base URL of the API |

See `docs/DEPLOY.md` for where to find each Supabase value and how to set these per environment.

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev:api` / `pnpm dev:web` | Run a single app in dev mode |
| `pnpm build` | Build all workspace packages |
| `pnpm test` | Run the API test suite (Vitest) |
| `pnpm lint` | Type-check all workspace packages |
| `pnpm seed` | Populate two demo tenants (requires `.env.seed`, see below) |
| `pnpm --filter @celeris/api prisma:generate` | Regenerate the Prisma client after a schema change |

## Database & Migrations

The SQL files in `supabase/migrations/` are the single source of truth for the schema — **never** run `prisma migrate`. After applying a new migration (`supabase db push`), update `apps/api/prisma/schema.prisma` by hand to match (it's documentation-as-code, not introspected) and run `prisma generate`.

To seed two demo tenants with sample inventory, events, and templates:
```bash
echo "SUPABASE_URL=...\nSUPABASE_SERVICE_ROLE_KEY=..." > .env.seed
pnpm seed
```

## Testing

```bash
pnpm --filter @celeris/api test
```

Covers cost/margin calculations, auth/RBAC middleware, the permissions map, and tenant-isolation guarantees.

## Deployment

- **Web** → Vercel (root directory `apps/web`, see `apps/web/vercel.json`)
- **API + Agent** → Render, defined as a single Blueprint in `render.yaml`
- **Database** → Supabase (no separate infra to manage)

Full step-by-step instructions, including which secrets to set on each platform, are in [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Further Documentation

| Document | Covers |
|---|---|
| [`docs/BACKEND_ARCHITECTURE.md`](docs/BACKEND_ARCHITECTURE.md) | API request pipeline, auth/RBAC/module model, full endpoint reference, AI agent contract |
| [`docs/FRONTEND_ARCHITECTURE.md`](docs/FRONTEND_ARCHITECTURE.md) | Routing, data-fetching pattern, page-to-API map, role/module UI gating, white-labeling |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Step-by-step deployment to Vercel/Render/Supabase |
| [`docs/TECHNICAL_DOCUMENT.md`](docs/TECHNICAL_DOCUMENT.md) | Diagrams (ER, sequence, CI) — note: some details (e.g. tenant-resolution flow, quote-route paths) predate the current implementation; the two architecture docs above are the up-to-date reference |

## License

Proprietary — all rights reserved.
