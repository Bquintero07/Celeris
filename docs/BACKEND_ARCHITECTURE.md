# Backend Architecture & API Reference

`apps/api` is a Node.js + TypeScript + Express REST API. It is the **only** way the frontend (or anything else) reads or writes business data — Supabase is used directly by the client only for authentication and storage (see `docs/FRONTEND_ARCHITECTURE.md`).

## 1. Request Pipeline

Every request to `/api/*` passes through, in order:

```
1. CORS            cors({ origin: CORS_ORIGIN.split(",") })   — default http://localhost:5173
2. JSON body parser  express.json({ limit: "10mb" })
3. apiLimiter        300 req / 15 min per IP   (express-rate-limit)
4. auth              verifies the Supabase JWT (jose, HS256, SUPABASE_JWT_SECRET)
                     → loads profiles.organization_id + user_roles
                     → req.ctx = { userId, orgId, roles, isSuperAdmin }
5. [router-mounted]  sensitiveLimiter (20 req / 15 min) — only on /api/onboarding and /api/super
6. [router-level]    requireModule(key)   — checks organizations.enabled_modules; super_admin bypasses
7. [route-level]     requirePermission(p) — checks the permissions map below; super_admin bypasses
8. handler / service — prisma.$queryRaw / $executeRaw, always scoped by organization_id
```

`GET /health` is the only route mounted before the limiter/auth chain — used for container/platform health checks.

## 2. Folder Structure

```
apps/api/
  src/
    index.ts            App bootstrap: middleware, router mounting, listen()
    lib/prisma.ts        PrismaClient singleton
    middleware/
      auth.ts             JWT verification → req.ctx (AuthContext)
      module.ts            requireModule(moduleKey)
      rbac.ts               requirePermission(permission)
    routes/               One Express Router per resource (thin — validation + wiring)
    services/             DB access via $queryRaw/$executeRaw (one file per resource)
    __tests__/             Vitest suites (58 tests — see §7)
  prisma/
    schema.prisma          Hand-maintained model documentation.
                            NOT introspected, NOT prisma migrate.
```

**Why raw queries instead of the Prisma query builder?** The schema's real source of truth is `supabase/migrations/*.sql`. `schema.prisma` exists only so `prisma generate` can produce a typed `PrismaClient` for `$queryRaw`/`$executeRaw` — every actual query is hand-written parameterized SQL via tagged templates, which Prisma escapes safely (no string concatenation anywhere in the codebase).

## 3. Authentication

- The frontend signs in via Supabase Auth and attaches the resulting access token as `Authorization: Bearer <jwt>` on every API call.
- `middleware/auth.ts` verifies the token's signature with `jose.jwtVerify` against `SUPABASE_JWT_SECRET` — the API never calls out to Supabase to validate a session.
- The verified `sub` claim (user id) is used to look up the caller's `organization_id` and roles directly in Postgres, building `req.ctx`.
- A request with no/invalid/expired token gets `401` before reaching any route.

## 4. Authorization

### 4.1 Roles & Permissions

Defined in `packages/shared/src/permissions.ts` — the single source of truth shared by the API (`requirePermission`) and the web app (nav visibility).

| Role | Permissions |
|---|---|
| `admin` | `*` (everything) |
| `comercial` | `events.view_all`, `events.create`, `events.edit`, `quotes.view`, `quotes.edit`, `quotes.view_margin`, `quotes.export`, `clients.manage`, `inventory.view`, `suppliers.view`, `crew.view`, `analytics.view` |
| `contable` | `events.view_all`, `quotes.view`, `quotes.view_margin`, `quotes.export`, `analytics.view`, `clients.view` |
| `logistica` | `events.view_assigned`, `quotes.view`, `inventory.view`, `crew.view_own`, `quotes.export_own`, `clients.view` |
| `personal` | `events.view_assigned`, `crew.view_own` |
| `viewer` | `events.view_all`, `events.view`, `quotes.view`, `inventory.view`, `suppliers.view`, `analytics.view`, `clients.view` |
| `super_admin` | Bypasses every `requirePermission`/`requireModule` check; not part of the permission map |

> Note: `inventory.edit`, `suppliers.edit`, `crew.edit`, and `events.approve` are required by routes below but are **not granted to any role except `admin`** (via the `*` wildcard). In practice, only `admin`/`super_admin` can mutate inventory/suppliers/personnel or approve events today.

### 4.2 Modules (feature flags)

`events_quotes`, `inventory`, `suppliers`, `crew`, `ai_assistant`, `analytics`, `branding`, `approval`, `billing`, `notifications`. Stored per-tenant in `organizations.enabled_modules`; `requireModule(key)` 403s if the calling org doesn't have it enabled.

### 4.3 Multi-Tenant Isolation

Every service function takes `AuthContext` (which carries `orgId`) and every query is scoped with `WHERE organization_id = ${orgId}`. Postgres Row-Level Security re-enforces the same boundary at the database layer as defense in depth (see `supabase/migrations/`). Verified by `__tests__/tenant-isolation.test.ts`.

## 5. API Reference

All paths below are prefixed with `/api`. **Auth** column shows the module gate (if the router has one) and the permission required (if the route has one); `—` means authenticated-only (any role, any module).

### `/onboarding` *(rate-limited: 20/15min)*
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/status` | — | `{ hasOrganization, isSuperAdmin }` |
| POST | `/create-org` | — | `{ name }` → creates an org, caller becomes its `admin` |
| POST | `/join` | — | `{ code }` → joins an org via invite code as `viewer` |

### `/tenant`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/config` | — | `{ enabledModules, branding, roles, isSuperAdmin }` for the caller's org |

### `/roles`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/mine` | — | Caller's own role list |

### `/org`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | — | Caller's organization record |
| PATCH | `/` | admin only | `{ name?, primary_color?, accent_color?, logo_url? }` |

### `/dashboard`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stats` | — | `{ counts: { events, personnel, suppliers, equipment }, financial: { totalBudget, totalRevenue, margin, marginPct }, upcoming: Event[], recent: Event[] }` |

### `/team`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | — | Org members with their roles |
| POST | `/roles` | admin only | `{ user_id, role, action: "add"\|"remove" }` |
| GET | `/join-code` | — | `{ join_code, name }` |

### `/events` *(module: `events_quotes`)*
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | — | List events (full org list for admin/comercial/viewer; assigned-only for others) |
| GET | `/:id` | — | Event + its line items |
| POST | `/` | `events.create` | Create event |
| PATCH | `/:id` | `events.edit` | Update event |
| DELETE | `/:id` | `events.edit` | Delete event |
| POST | `/:id/items` | — ⚠️ | Add one line item *(no permission check — see Known Issues)* |
| POST | `/:id/items/bulk` | — ⚠️ | Add multiple line items *(no permission check)* |
| PATCH | `/items/:itemId` | — ⚠️ | Update a line item *(no permission check)* |
| DELETE | `/items/:itemId` | — ⚠️ | Delete a line item *(no permission check)* |
| POST | `/:id/submit` | `events.edit` | Approval flow: draft → review |
| POST | `/:id/approve` | `events.approve` | review → approved |
| POST | `/:id/reject` | `events.approve` | review → rejected |
| POST | `/:id/send` | `events.approve` | approved → sent |
| GET | `/:id/approval-log` | `events.edit` | Full audit trail of status transitions |
| POST | `/:id/export/pdf` | `quotes.export` | Invoice PDF (margin shown only to admin) |
| POST | `/:id/export/excel` | `quotes.export` | Quote as `.xlsx` (margin columns shown only to admin/contable) |

### `/quotes` *(module: `events_quotes`)*
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:eventId` | `quotes.view` | Quote lines with calculated cost/margin/profit |
| POST | `/:eventId/ai-suggest` | `quotes.edit` | Calls the AI agent for suggested line items |
| POST | `/:eventId/apply` | `quotes.edit` | Replaces an event's items with AI-suggested lines |

### `/equipment` *(module: `inventory`)*
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | `inventory.view` | List |
| POST | `/` | `inventory.edit` | Upsert (pass `id` to update) |
| DELETE | `/:id` | `inventory.edit` | Delete |

### `/suppliers` *(module: `suppliers`)* — same shape, `suppliers.view` / `suppliers.edit`
### `/personnel` *(module: `crew`)* — same shape, `crew.view` / `crew.edit`
### `/clients` *(module: `events_quotes`)* — same shape, `clients.view` / `clients.manage`

### `/availability` *(module: `inventory`)*
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/equipment?start&end&excludeEventId` | `inventory.view` | Equipment booked vs. available in a date range |
| GET | `/personnel?start&end&excludeEventId` | `crew.view` | Crew availability in a date range |

### `/analytics` *(module: `analytics`)*
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/margins?since&until&groupBy=event\|client` | `analytics.view` | Margin breakdown |
| GET | `/revenue?since&until` | `analytics.view` | Revenue by month |

### `/billing` *(module: `billing`)*
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | `quotes.export` | Invoices derived from approved/sent events |
| POST | `/:eventId/invoice` | `quotes.export` | Generate the invoice PDF |

### `/templates` *(module: `events_quotes`)*
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/?event_type=` | `events.view` | List templates |
| GET | `/:id` | `events.view` | Template + its items |
| POST | `/` | `events.edit` | Create template |
| DELETE | `/:id` | `events.edit` | Delete template |
| POST | `/:id/apply/:eventId` | `events.edit` | Bulk-insert a template's items into an event |

### `/super` *(cross-tenant; rate-limited: 20/15min)*
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/check` | — | `boolean` — is the caller a super admin |
| POST | `/bootstrap` | — | Become `super_admin`, **only if none exists yet** (returns 403 otherwise) |
| GET | `/orgs` | super admin | List every tenant |
| GET | `/orgs/:id` | super admin | Tenant detail |
| POST | `/orgs` | super admin | Create a tenant |
| PATCH | `/orgs/:id` | super admin | Update name/slug/status |
| PATCH | `/orgs/:id/modules` | super admin | Set the full enabled-modules list |
| PATCH | `/orgs/:id/modules/toggle` | super admin | Toggle one module |
| PATCH | `/orgs/:id/status` | super admin | Activate/suspend/deactivate |
| DELETE | `/orgs/:id` | super admin | **Permanently** delete a tenant and its data |
| GET | `/users` | super admin | List every user across every tenant |
| POST | `/assign` | super admin | Move a user into an org |
| POST | `/grant` | super admin | Grant or revoke `super_admin` |

### `/ai`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/generate` | — ⚠️ | Proxies to the agent's `/quote/suggest` *(not module/permission-gated — see Known Issues)* |

## 6. The AI Agent

A separate Python/FastAPI service (`agent/`), called only by `apps/api` (never by the browser). The API forwards `Authorization: Bearer ${AGENT_SHARED_SECRET}`; the agent rejects any request that doesn't present the matching secret. See `agent/app/main.py`.

```
POST /api/quotes/:eventId/ai-suggest
  → API fetches the event + the org's available equipment/crew
  → API calls agent POST /quote/suggest { eventType, description, currency, inventory, crew }
    (Authorization: Bearer AGENT_SHARED_SECRET)
  → Agent builds a prompt, calls OpenAI in JSON mode, validates the response with Pydantic
  → API returns { lines, notes } to the frontend for review
POST /api/quotes/:eventId/apply { lines }
  → API deletes the event's existing items and inserts the (edited) suggested lines
```

## 7. Testing

```bash
pnpm --filter @celeris/api test
```

| Suite | Covers |
|---|---|
| `permissions.test.ts` | `can()` per role, multi-role aggregation, wildcard, empty roles |
| `cost-engine.test.ts` | Margin/markup formulas, IVA 19%, edge cases |
| `middleware.test.ts` | `requireModule`, `requirePermission`, super-admin bypass |
| `tenant-isolation.test.ts` | Every service call is scoped by `orgId`; no cross-org leakage |

58/58 passing as of the last full run.

## 8. Known Issues / Gaps

- `POST /api/events/:id/items` (and `/items/bulk`, `PATCH`/`DELETE /items/:itemId`) have no `requirePermission` guard, and the insert doesn't verify the target event belongs to the caller's organization before writing.
- `POST /api/ai/generate` has no `requireModule("ai_assistant")` or permission check — any authenticated user can trigger an OpenAI call regardless of their org's enabled modules.
- `super_admin` is the only role that can manage other tenants; once granted (via the now-gated `/bootstrap`) it bypasses every other check in the system by design.
