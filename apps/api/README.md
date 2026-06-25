# Celeris API

Express + Prisma (`$queryRaw`) server. All endpoints under `/api/*` require a valid Supabase JWT in the `Authorization: Bearer <token>` header.

Middleware chain per endpoint: **auth → requireModule → requirePermission → service**

- `auth` — verifies JWT, loads `ctx.userId / orgId / roles / isSuperAdmin`
- `requireModule(key)` — 403 if org has not enabled this feature module (super_admin bypasses)
- `requirePermission(perm)` — 403 if user's roles don't grant this permission (super_admin bypasses)

---

## Health

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/health` | None | `{ ok: true }` |

---

## Tenant

Module: always available.

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| GET | `/api/tenant/config` | any | — | `{ enabledModules, branding: { logoUrl, primary, accent, name }, roles, isSuperAdmin }` |

---

## Onboarding

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| GET | `/api/onboarding/status` | any | — | `{ hasOrganization: boolean, isSuperAdmin: boolean }` |
| POST | `/api/onboarding/create-org` | any | `{ name }` | `{ org }` — creates org + sets caller as admin |
| POST | `/api/onboarding/join` | any | `{ code }` | `{ org }` — joins org via 10-char join_code |

---

## Roles

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| GET | `/api/roles/mine` | any | — | `string[]` — all roles including `super_admin` |

---

## Organization (own tenant)

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| GET | `/api/org` | any | — | `{ id, name, slug, join_code, primary_color, accent_color, logo_url, enabled_modules, status }` |
| PATCH | `/api/org` | `admin.*` | `{ name?, primary_color?, accent_color?, logo_url? }` | updated org row |

---

## Dashboard

Module: always available.

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| GET | `/api/dashboard/stats` | any | — | `{ totalEvents, activeEvents, totalRevenue, totalBudget, teamMembers, equipmentItems }` |

---

## Events

Module: `events_quotes`

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| GET | `/api/events` | `events.view_all` | — | `Event[]` |
| POST | `/api/events` | `events.create` | `{ title, event_type, status?, start_date?, end_date?, location?, budget?, revenue?, attendees?, description?, ai_prompt? }` | `Event` (201) |
| GET | `/api/events/:id` | `events.view_all` | — | `Event & { items: EventItem[] }` |
| PATCH | `/api/events/:id` | `events.edit` | any event fields | updated `Event` |
| DELETE | `/api/events/:id` | `events.edit` | — | 204 |
| GET | `/api/events/:id/items` | `events.view_all` | — | `EventItem[]` |
| POST | `/api/events/:id/items` | `events.edit` | `{ item_type, item_name, quantity, unit_cost, total_cost, source?, notes? }` | `EventItem` (201) |
| POST | `/api/events/:id/items/bulk` | `events.edit` | `{ items: EventItem[] }` | `EventItem[]` |
| PATCH | `/api/events/items/:itemId` | `events.edit` | any item fields | updated `EventItem` |
| DELETE | `/api/events/items/:itemId` | `events.edit` | — | 204 |
| POST | `/api/events/:id/export/pdf` | `quotes.export` | — | `{ base64: string }` |
| POST | `/api/events/:id/export/excel` | `quotes.export` | — | `{ base64: string }` |

---

## Quotes (motor de cotización)

Module: `events_quotes`

The quote for an event is derived from its `event_items`. `unit_cost × quantity` is the base cost; `total_cost` is the selling price. The engine computes `margin`, `margin_pct` (margin / revenue), and `profit_pct` (margin / cost).

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| GET | `/api/quotes/:eventId` | `quotes.view` | — | `{ event, lines: QuoteLine[], summary: { totalCost, totalRevenue, totalMargin, totalMarginPct, totalProfitPct } }` |
| POST | `/api/quotes/:eventId/ai-suggest` | `quotes.edit` | `{ prompt?: string, budget?: number }` | `{ lines: QuoteSuggestLine[], notes: string[] }` |
| POST | `/api/quotes/:eventId/apply` | `quotes.edit` | `{ lines: QuoteSuggestLine[] }` | same as GET — quote with applied lines |

**QuoteLine fields** (extends `event_items`):
```
subtotal    number   unit_cost × quantity
revenue     number   total_cost (selling price)
margin      number   revenue − subtotal
margin_pct  number   margin / revenue × 100
profit_pct  number   margin / subtotal × 100 (markup %)
```

---

## Inventory (Equipment)

Module: `inventory`

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| GET | `/api/equipment` | `inventory.view` | — | `Equipment[]` |
| POST | `/api/equipment` | `inventory.edit` | `{ name, category, quantity?, unit_cost?, condition?, location?, notes? }` | `Equipment` (201) |
| POST | `/api/equipment` | `inventory.edit` | `{ id, ...fields }` | updated `Equipment` (200) |
| DELETE | `/api/equipment/:id` | `inventory.edit` | — | 204 |

`category` enum: `audio`, `video`, `lighting`, `staging`, `furniture`, `transport`, `extras`

---

## Suppliers

Module: `suppliers`

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| GET | `/api/suppliers` | `suppliers.view` | — | `Supplier[]` |
| POST | `/api/suppliers` | `suppliers.edit` | `{ name, category?, type?, contact_name?, email?, phone?, website?, rating?, notes? }` | `Supplier` (201) |
| POST | `/api/suppliers` | `suppliers.edit` | `{ id, ...fields }` | updated `Supplier` (200) |
| DELETE | `/api/suppliers/:id` | `suppliers.edit` | — | 204 |

`type` enum: `interno`, `externo`

---

## Personnel (Crew)

Module: `crew`

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| GET | `/api/personnel` | `crew.view` | — | `Personnel[]` |
| POST | `/api/personnel` | `crew.edit` | `{ full_name, role?, skills?: string[], available?, hourly_rate?, email?, phone?, notes? }` | `Personnel` (201) |
| POST | `/api/personnel` | `crew.edit` | `{ id, ...fields }` | updated `Personnel` (200) |
| DELETE | `/api/personnel/:id` | `crew.edit` | — | 204 |

---

## Team (users in org)

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| GET | `/api/team` | any | — | `{ id, full_name, email, avatar_url, roles: string[] }[]` |
| POST | `/api/team/roles` | `admin.*` | `{ user_id, role, action: 'add'\|'remove' }` | 204 |
| GET | `/api/team/join-code` | any | — | `{ join_code, name }` |

---

## AI

| Method | Path | Permission | Body | Response |
|--------|------|-----------|------|----------|
| POST | `/api/ai/generate` | any | `{ prompt, context? }` | proxied response from Python agent |

For per-event AI suggestions use `POST /api/quotes/:eventId/ai-suggest` instead.

---

## Super Admin

All routes (except `check` and `bootstrap`) require `isSuperAdmin = true`.

### Tenants

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/super/check` | — | `boolean` |
| POST | `/api/super/bootstrap` | — | 204 — grants super_admin to caller |
| GET | `/api/super/orgs` | — | `Org[]` with `member_count` and `enabled_modules` |
| GET | `/api/super/orgs/:id` | — | single `Org` |
| POST | `/api/super/orgs` | `{ name, slug?, enabled_modules?: string[], status? }` | created `Org` (201) |
| PATCH | `/api/super/orgs/:id` | `{ name?, slug?, status? }` | updated `Org` |
| PATCH | `/api/super/orgs/:id/modules` | `{ enabled_modules: string[] }` | `{ id, name, enabled_modules }` — replaces full list |
| PATCH | `/api/super/orgs/:id/modules/toggle` | `{ module: string, enabled: boolean }` | `{ id, name, enabled_modules }` — toggles one module |
| PATCH | `/api/super/orgs/:id/status` | `{ status: 'active'\|'inactive'\|'suspended' }` | `{ id, name, status }` |
| DELETE | `/api/super/orgs/:id` | — | 204 — permanent delete |

### Users

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/super/users` | — | `User[]` with `org_name` and `roles` |
| POST | `/api/super/assign` | `{ user_id, organization_id, makeAdmin?: boolean }` | 204 |
| POST | `/api/super/grant` | `{ user_id, grant: boolean }` | 204 — grant/revoke super_admin |

---

## Module catalog

| Key | Description |
|-----|-------------|
| `events_quotes` | Core — events and quoting engine (always enabled) |
| `inventory` | Equipment inventory |
| `suppliers` | Supplier directory |
| `crew` | Personnel / crew management |
| `ai_assistant` | AI quote suggestions |
| `analytics` | Analytics dashboard |
| `branding` | White-label branding settings |
| `approval` | Quote approval workflow |
| `billing` | Billing and invoicing |
| `notifications` | Email / push notifications |

## Permission reference

| Permission | Roles that have it |
|-----------|-------------------|
| `events.view_all` | admin, comercial, viewer |
| `events.view_assigned` | logistica, personal |
| `events.create` | admin, comercial |
| `events.edit` | admin, comercial |
| `quotes.view` | admin, comercial, logistica, viewer |
| `quotes.edit` | admin, comercial |
| `quotes.view_margin` | admin, comercial |
| `quotes.export` | admin, comercial |
| `inventory.view` | admin, comercial, logistica, viewer |
| `inventory.edit` | admin only (via `*`) |
| `suppliers.view` | admin, comercial, viewer |
| `suppliers.edit` | admin only (via `*`) |
| `crew.view` | admin, comercial |
| `crew.view_own` | logistica, personal |
| `crew.edit` | admin only (via `*`) |
| `analytics.view` | admin, comercial, viewer |
| `clients.manage` | admin, comercial |

`super_admin` bypasses all module and permission checks.
