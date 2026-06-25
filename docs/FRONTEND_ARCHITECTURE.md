# Frontend Architecture

`apps/web` is a React 19 single-page app built with Vite 6, routed with React Router v7, styled with Tailwind v4 + shadcn/ui (Radix primitives), and using TanStack Query for all server state. It never queries Postgres directly — every piece of business data goes through the API described in `docs/BACKEND_ARCHITECTURE.md`.

## 1. Folder Structure

```
apps/web/src/
  main.tsx               Entry point: QueryClientProvider + RouterProvider + Toaster
  router.tsx              All route definitions (createBrowserRouter)
  index.css
  components/
    AppLayout.tsx          Authenticated shell: sidebar nav, header, sign-out, onboarding gate
    ProtectedRoute.tsx       Session guard
    celeris-logo.tsx
    ui/                      shadcn/Radix primitives (button, dialog, table, sidebar, ...)
  pages/                    One file per screen, named to match its route
    events/                  EventsList, EventDetail, NewEvent
  lib/
    api.ts                   The ONLY HTTP client — every data call goes through here
    supabase.ts               Supabase client — auth + storage ONLY, never queried for data
    useTenantConfig.ts        Branding + enabled modules + roles for the current org
    use-my-roles.ts            Role/permission checks + the nav visibility map
    use-branding.tsx           Thin wrapper over useTenantConfig for branding fields
    currency.tsx                Currency context/formatter + switcher
    labels.ts                    Enum → human label maps (event types, statuses, categories)
    utils.ts
  hooks/use-mobile.tsx
```

## 2. Routing

`router.tsx` defines a flat tree:

```
/              Landing (public)
/auth          Auth — sign in / sign up (public)
ProtectedRoute  (requires a Supabase session)
  AppLayout      (sidebar shell + onboarding gate)
    /onboarding, /dashboard, /events, /events/new, /events/:id,
    /inventory, /suppliers, /personnel, /clients, /analytics,
    /billing, /team, /brand-settings, /admin
*              redirects to /
```

- **`ProtectedRoute`** reads `supabase.auth.getSession()` and subscribes to `onAuthStateChange`; renders nothing while loading, redirects to `/auth` if there's no session.
- **`AppLayout`** wraps every authenticated screen with `OnboardingGate`, which calls `GET /api/onboarding/status` and force-redirects to `/onboarding` if the user has no organization yet (super admins are exempt).

## 3. Authentication

- `lib/supabase.ts` creates a Supabase client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, used **exclusively** for `signInWithPassword`/`signUp`/`getSession`/`onAuthStateChange`/`signOut` and Storage (logo upload). It is never used to query business tables.
- `lib/api.ts`'s `request()` helper reads the current session's `access_token` and attaches it as `Authorization: Bearer <token>` on every call to the API.
- It also computes an org slug from the subdomain and sends it as `X-Org-Slug` — **this header is currently not read anywhere in the backend** (the API derives the org purely from the JWT's user → `profiles.organization_id`). It's a seam for a possible future "switch org by subdomain" feature, not an active mechanism today.

## 4. Data Fetching — the `api` client

`lib/api.ts` exports a single `api` object, namespaced per resource (`api.events.list()`, `api.equipment.upsert()`, `api.quotes.aiSuggest()`, …), each wrapping `fetch` against `${VITE_API_URL}/api/...`. Every page calls these through TanStack Query:

```ts
const { data, isLoading } = useQuery({ queryKey: ["events"], queryFn: () => api.events.list() });
```

Mutations call the corresponding `api.*` method directly inside an event handler, then `queryClient.invalidateQueries(...)` the affected key(s) — there is no global mutation abstraction; each page does this inline (see `Inventory.tsx` for the pattern: save → invalidate `["equipment"]` and `["dashboard"]`).

## 5. Page → API Map

| Page | Route | Calls |
|---|---|---|
| `Landing` | `/` | — (public marketing page) |
| `Auth` | `/auth` | Supabase Auth directly (no API call) |
| `Onboarding` | `/onboarding` | `api.onboarding.status/createOrg/joinOrg` |
| `Dashboard` | `/dashboard` | `api.dashboard.stats()` |
| `EventsList` | `/events` | `api.events.list()` |
| `NewEvent` | `/events/new` | `api.events.create()`, AI suggestion flow |
| `EventDetail` | `/events/:id` | `api.events.get/update/delete`, items CRUD, `api.quotes.*`, `api.approval.*`, export endpoints |
| `Inventory` | `/inventory` | `api.equipment.list/upsert/delete` |
| `Suppliers` | `/suppliers` | `api.suppliers.list/upsert/delete` |
| `Personnel` | `/personnel` | `api.personnel.list/upsert/delete` |
| `Clients` | `/clients` | `api.clients.list/create/update/delete` |
| `Analytics` | `/analytics` | `api.analytics.margins/revenue` |
| `Billing` | `/billing` | `api.billing.list/generateInvoice` |
| `Team` | `/team` | `api.team.list/setRole/joinCode` |
| `BrandSettings` | `/brand-settings` | `api.org.get/update` |
| `Admin` | `/admin` | `api.superAdmin.*` |

## 6. Role & Module Gating in the UI

`lib/use-my-roles.ts` fetches `GET /api/roles/mine` and exposes `useMyRoles()`:
- `can(permission)` — mirrors the backend's `can()` from `@celeris/shared`, so the same permission strings gate both the API and the UI.
- `canSeeNav(url, roles, enabledModules)` — combines two static maps in the same file, `NAV_MODULE` (which module a nav item requires) and `NAV_ACCESS` (which roles can see it), to filter the sidebar. `super_admin` always sees everything; `admin` sees everything except `/admin`'s entry is still role-gated to `super_admin` only.

This is **UI-only** gating — hiding a nav link does not replace the backend's `requireModule`/`requirePermission` checks, which remain the actual enforcement point.

## 7. Branding / White-Label

`useTenantConfig()` fetches `GET /api/tenant/config` and, on change, converts the org's hex `primary_color`/`accent_color` into OKLCH and writes them as CSS custom properties (`--brand-primary`, `--brand-accent`) on `document.documentElement` — Tailwind's theme reads these variables, so the whole UI re-themes per tenant without a rebuild.

## 8. Known Issues

- `Inventory.tsx`, `EventsList.tsx`, `Dashboard.tsx`, and the other CRUD pages checked all match their real API responses — no known frontend/backend contract mismatches as of the last review (2026-06-24; `GET /api/dashboard/stats` was reshaped to match `Dashboard.tsx`'s expected `{ counts, financial, upcoming, recent }` contract, see `docs/BACKEND_ARCHITECTURE.md`).

## 9. Build & Deploy

- Dev server: `pnpm dev:web` (Vite, default port `5173`)
- Build: `pnpm --filter @celeris/web build` (`tsc -b && vite build`) — `apps/web/vercel.json` builds `@celeris/shared` first so the bundle resolves the workspace package
- Deploy target: Vercel, root directory `apps/web` (see `docs/DEPLOY.md`)
