# Test Documentation — Celeris v1

## Overview

Celeris v1 has an automated test suite split across two packages:

| Package | Command | Tests | Framework |
|---|---|---|---|
| `apps/api` | `pnpm --filter api test` | 116 | Vitest |
| `apps/web` | `pnpm --filter web test` | 8 | Vitest + jsdom + Testing Library |
| **Total** | | **124** | |

To run the full suite from the repo root:

```bash
pnpm --filter api test && pnpm --filter web test
```

---

## Backend (`apps/api`)

Test files live in `apps/api/src/__tests__/`.

### 1. `validate.test.ts` — 58 tests

Documents the input validation middleware (`src/lib/validate.ts`) and the database enum schemas.

#### `validate(schema)` middleware

| Scenario | Expected result |
|---|---|
| Valid body | `next()` called, `req.body` replaced with parsed data |
| Required field missing | `400` — `{ error: "Validation failed", issues: [{ field: "title", message: "Required" }] }` |
| Required field present but empty (`""`) | `400` — custom message (e.g. `"title is required"`) |
| Invalid enum value | `400` — message lists all accepted values |
| Negative number on a `nonnegative` field | `400` |
| String passed for a numeric field | `400` |
| Unknown fields in the body | Silently stripped — never reach the route handler |
| Nested array with invalid item | `400` — dotted path: `"items.0.name"` |
| Empty array when `min(1)` is required | `400` |

#### `validateUuidParams(...params)` middleware

| Scenario | Expected result |
|---|---|
| Param is a valid UUID | `next()` called |
| Param is not a UUID | `400` — `{ error: "Invalid id: must be a valid UUID" }` |
| Multiple params, all valid | `next()` called |
| Multiple params, one invalid | `400` — error message names the specific failing param |
| Numeric string (`"12345"`) | `400` |

#### DB enum schemas (Zod schemas that mirror PostgreSQL types exactly)

| Schema | PostgreSQL type | Accepted values |
|---|---|---|
| `EventType` | `public.event_type` | `concierto`, `charla`, `exposicion`, `privado`, `publico`, `corporativo`, `boda`, `otro` |
| `EventStatus` | `public.event_status` | `borrador`, `planificacion`, `confirmado`, `en_curso`, `finalizado`, `cancelado` |
| `ItemCategory` | `public.item_category` | `personal`, `catering`, `equipo`, `mobiliario`, `audio_video`, `iluminacion`, `transporte`, `seguridad`, `permisos`, `marketing`, `extras` |
| `SupplierType` | `public.supplier_type` | `interno`, `externo` |
| `AppRole` | `public.app_role` | `admin`, `comercial`, `personal`, `logistica`, `viewer`, `contable`, `super_admin` |
| `OrgStatus` | `text` column | `active`, `inactive`, `suspended` |

> **Important note:** `ItemCategory` only accepts Spanish values that match the DB. English category names returned by the Python agent (`equipment`, `crew`, `supplier`) are mapped to Spanish before reaching the DB in `quotes.service.ts`.

---

### 2. `middleware.test.ts` — 14 tests

Unit tests for `requireModule()` and `requirePermission()`.

#### `requireModule(key)`

| Scenario | Result |
|---|---|
| `super_admin` user | Passes without querying the DB |
| Module present in org's `enabled_modules` | Passes |
| Module **not** in `enabled_modules` | `403` |
| `enabled_modules` is empty | `403` |
| Org row not found | `403` |
| `orgId` missing from context | `403` |

#### `requirePermission(permission)`

| Role | Example test |
|---|---|
| `super_admin` | Passes any permission |
| `admin` | Passes any permission (wildcard) |
| `comercial` | Can view margin (`quotes.view_margin`) |
| `logistica` | Cannot view margin |
| `personal` | Cannot access quotes or approve events |
| `viewer` | Cannot create or edit |
| `contable` | Can export and view margin |
| Multi-role | `logistica + contable` can export |

---

### 3. `permissions.test.ts` — 22 tests

Tests for the `can(roles, permission)` function and the `PERMISSIONS` table in the shared package.

Covers all roles (`admin`, `comercial`, `contable`, `logistica`, `personal`, `viewer`) with positive and negative cases, multi-role aggregation, and that every role is defined in the permissions table.

---

### 4. `tenant-isolation.test.ts` — 12 tests

Verifies that queries always filter by `organization_id`. Prevents data leaks between tenants.

---

### 5. `cost-engine.test.ts` — 10 tests

Tests for cost, markup, and margin calculation on quote line items.

---

## Frontend (`apps/web`)

Test files live under `apps/web/src/`.

### 6. `src/lib/__tests__/api.test.ts` — 3 tests

Regression tests for the HTTP client (`src/lib/api.ts`).

| Scenario | Expected result |
|---|---|
| `204 No Content` response (e.g. after a `DELETE`) | Returns `undefined` instead of crashing trying to parse an empty body |
| `200` response with JSON | Returns the parsed object |
| `4xx/5xx` response | Throws an error with the response body text |

> **Documented regression:** before the fix, every delete silently broke UI refresh because `res.json()` failed on an empty body.

---

### 7. `src/lib/__tests__/labels.test.ts` — 4 tests

Tests for the labels module (`src/lib/labels.ts`).

| Scenario | Expected result |
|---|---|
| Known key in `EVENT_TYPE_LABELS` | Returns the mapped label |
| Unknown key | Returns the raw key as a fallback |
| All Spanish `item_category` DB enum values | Have a label defined in `CATEGORY_LABELS` |
| English agent categories (`equipment`, `crew`, `supplier`) | Also have a label (aliases) |

---

### 8. `src/pages/events/__tests__/EventDetail.test.tsx` — 1 test

Regression test for `EventDetail.tsx`.

| Scenario | Expected result |
|---|---|
| Event detail page loads with real data | Stops showing "Loading..." and displays the event title |

> **Documented regression:** the original bug read `data.event` when the API returns a flat `data` object directly. The page was stuck in infinite loading.

---

## Coverage and known gaps

### What is covered
- Authentication and permissions middleware (unit)
- Input validation for all API mutation endpoints
- DB enums: any migration that adds or removes values will break the tests
- Cost/margin calculation logic
- Multi-tenant isolation
- Frontend HTTP client behavior
- Critical frontend regressions (delete response, EventDetail shape)

### What is not covered (gaps)
- **Real DB integration**: API tests mock Prisma. Migration changes or schema drift are not detected automatically.
- **Full end-to-end routes**: no E2E tests (Playwright/Cypress). The full login → UI → API → DB flow is verified manually using `docs/SMOKE_TEST.md`.
- **Python agent**: the agent (`agent/`) has no automated test suite — Pydantic validates schemas at runtime, but there is no test suite.
- **Additional frontend pages**: only `EventDetail` has a component test. The other 10 pages were verified manually during the contract audit (see `docs/BACKEND_ARCHITECTURE.md`).
