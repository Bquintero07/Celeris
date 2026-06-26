# Testing Process Report — Celeris v1

**Date:** June 2025  
**System version:** 1.0  
**Scope:** Backend API · AI Agent · Web Frontend  
**Total test cases:** 228

---

## 1. Objective

Verify that the Celeris v1 platform works correctly, is secure against unauthorized cross-organization access, rejects invalid inputs, and produces consistent responses across all its components: REST API, Python AI agent, and web interface.

---

## 2. Testing Strategy

A four-layer complementary strategy was adopted:

```
┌─────────────────────────────────────────┐
│        E2E — Real browser               │  Complete user flows
├─────────────────────────────────────────┤
│     Integration — Real database         │  Persistence and tenant isolation
├─────────────────────────────────────────┤
│     Component — Isolated frontend       │  Rendering and UI contracts
├─────────────────────────────────────────┤
│     Unit — Pure logic                   │  Validation, permissions, calculations
└─────────────────────────────────────────┘
```

Unit and component tests run without external services. Integration and E2E tests require the database and server to be running.

---

## 3. Test Cases

### 3.1 Backend API — Cost Engine

**Framework:** Vitest · **Command:** `pnpm --filter api test` · **12 cases**

| ID | Test case | Expected result |
|----|----------|----------------|
| CE-01 | Zero margin when base_cost equals selling price | `margin = 0`, `marginPct = 0` |
| CE-02 | Margin with 20% markup | `margin = price * 0.2`, `marginPct ≈ 16.67` |
| CE-03 | No division by zero when revenue = 0 | `marginPct = 0` without error |
| CE-04 | Falls back to `unit_cost` when `base_cost` is null | Calculation uses the alternative field without errors |
| CE-05 | Negative margin when costs exceed revenue | `margin < 0`, `marginPct < 0` |
| CE-06 | Aggregates multiple items independently | Correct subtotals per category |
| CE-07 | 19% VAT on subtotal | `vat = subtotal * 0.19` |
| CE-08 | VAT rounds correctly for COP amounts | No incorrect decimals |
| CE-09 | Selling price = base × (1 + markup/100) | Markup price formula applied |
| CE-10 | 0% markup leaves price unchanged | `selling_price = base_cost` |
| CE-11 | Base cost recovered from selling price and markup | `base = selling / (1 + markup/100)` |
| CE-12 | Negative price accepted (credit) | No error, negative value propagated |

---

### 3.2 Backend API — Authentication and Module Middleware

**Framework:** Vitest · **6 cases**

| ID | Test case | Expected result |
|----|----------|----------------|
| MW-01 | `super_admin` always passes without querying DB | `next()` called, no Prisma query |
| MW-02 | Enabled module in organization allows access | `next()` called |
| MW-03 | Module NOT enabled blocks with 403 | `403 Forbidden` response |
| MW-04 | Organization with no enabled modules blocks with 403 | `403 Forbidden` response |
| MW-05 | Organization not found in DB blocks with 403 | `403 Forbidden` response |
| MW-06 | Missing `orgId` in auth context blocks with 403 | `403 Forbidden` response |

---

### 3.3 Backend API — Role-Based Access Control

**Framework:** Vitest · **18 cases**

| ID | Test case | Expected result |
|----|----------|----------------|
| AC-01 | `admin` can perform any operation | `can()` = true for all permissions |
| AC-02 | `comercial` can view and edit events and quotes | `events.*`, `quotes.*` permissions active |
| AC-03 | `comercial` can manage clients and view inventory | `clients.manage`, `inventory.view` active |
| AC-04 | `comercial` cannot approve quotes or view restricted crew | `can("quotes.approve")` = false |
| AC-05 | `contable` can view events, margins, and analytics | Financial viewing permissions active |
| AC-06 | `contable` cannot edit events or create items | `can("events.edit")` = false |
| AC-07 | `logistica` can view assigned events, inventory, and export | Logistics permissions active |
| AC-08 | `logistica` cannot view margins or create events | `can("events.create")` = false |
| AC-09 | `personal` can only see assigned events and own crew info | Permissions restricted to crew_own |
| AC-10 | `personal` cannot see quotes, inventory, or analytics | `can("quotes.view")` = false |
| AC-11 | `viewer` can view events and basic data | Read-only permissions active |
| AC-12 | `viewer` cannot edit or see margins | `can("events.edit")` = false |
| AC-13 | Role union: `logistica + viewer` = combined permissions | Correct union of permission sets |
| AC-14 | Any `admin` in the role list grants full access | `can()` = true for everything |
| AC-15 | No roles = no permissions | `can()` = false for any permission |
| AC-16 | All roles defined in PERMISSIONS are covered | Completeness of the permission catalog |
| AC-17 | `requirePermission()` passes for `super_admin` without checking roles | `next()` without query |
| AC-18 | `requirePermission()` blocks with 403 when role lacks permission | `403 Forbidden` response |

---

### 3.4 Backend API — Multi-Tenant Isolation (mocked)

**Framework:** Vitest · **15 cases**

Verifies that every database call includes the correct `organization_id`.

| ID | Test case | Expected result |
|----|----------|----------------|
| TI-01 | `equipment.list()` passes `orgId` as parameter | Org UUID appears in query parameters |
| TI-02 | `equipment.upsert()` (INSERT) includes `orgId` | Insert is scoped to the correct organization |
| TI-03 | `equipment.remove()` filters by `orgId` | DELETE cannot affect another org's equipment |
| TI-04 | `suppliers.list()` passes `orgId` | Suppliers filtered by organization |
| TI-05 | `suppliers.remove()` filters by `orgId` | DELETE with correct scope |
| TI-06 | `personnel.list()` passes `orgId` | Personnel filtered by organization |
| TI-07 | `personnel.remove()` filters by `orgId` | DELETE with correct scope |
| TI-08 | `clients.list()` passes `orgId` | Clients filtered by organization |
| TI-09 | `clients.upsert()` (INSERT) includes `orgId` | Insert scoped to the org |
| TI-10 | `clients.remove()` filters by `orgId` | DELETE with correct scope |
| TI-11 | `analytics.marginsByEvent()` passes `orgId` | Financial metrics scoped to org |
| TI-12 | `analytics.marginsByClient()` passes `orgId` | Client analysis scoped to org |
| TI-13 | `analytics.revenueByPeriod()` passes `orgId` | Revenue by period scoped to org |
| TI-14 | Org A calls never include Org B's `orgId` | Parameters from A and B never mixed |
| TI-15 | Org B calls never include Org A's `orgId` | Bidirectional isolation verified |

---

### 3.5 Backend API — Input Validation

**Framework:** Vitest · **58 cases**

#### `validate()` middleware

| ID | Test case | Expected result |
|----|----------|----------------|
| VL-01 | Valid body passes and calls `next()` | Status 200, no errors |
| VL-02 | Missing required field → field-level error | Status 400, `field: "title"`, `message: "Required"` |
| VL-03 | Required field present but empty → custom message | Status 400, `message: "title is required"` |
| VL-04 | Invalid enum value lists accepted values | Status 400, message contains valid values |
| VL-05 | Numeric field receives string → type error | Status 400, field identified |
| VL-06 | Negative number in nonnegative field | Status 400, `message: "expected non-negative"` |
| VL-07 | Unknown fields stripped from body | `req.body` only contains schema-declared fields |
| VL-08 | Coerced data replaces `req.body` | `req.body` contains Zod-parsed value |
| VL-09 | Valid items array passes | `next()` called |
| VL-10 | `items` field is not an array → error | Status 400 |
| VL-11 | Invalid item at position 0 shows path `items.0.name` | Nested path in error |
| VL-12 | Empty items array is rejected | Status 400 |

#### `validateUuidParams()`

| ID | Test case | Expected result |
|----|----------|----------------|
| VL-13 | Valid UUID in single param → passes | `next()` called |
| VL-14 | Invalid UUID → error with parameter name | Status 400, names the parameter |
| VL-15 | Multiple valid UUIDs → passes | `next()` called |
| VL-16 | One invalid param among many → error naming the bad one | Status 400, only the bad parameter |
| VL-17 | Numeric string (non-UUID) → rejected | Status 400 |

#### Database enums

| ID | Test case | Expected result |
|----|----------|----------------|
| VL-18 | `EventType`: all 8 Spanish values accepted | `safeParse().success = true` for each |
| VL-19 | `EventType`: English value `"concert"` rejected | `safeParse().success = false` |
| VL-20 | `EventStatus`: all 6 Spanish statuses accepted | All valid |
| VL-21 | `EventStatus`: `"draft"` (English) rejected | Invalid |
| VL-22 | `ItemCategory`: all 11 Spanish categories accepted | All valid |
| VL-23 | `ItemCategory`: `"equipment"`, `"crew"`, `"supplier"` (English) rejected | Invalid |
| VL-24 | `SupplierType`: `"interno"` and `"externo"` accepted | Valid |
| VL-25 | `SupplierType`: any other value rejected | Invalid |
| VL-26 | `AppRole`: all valid roles accepted (including `contable`, `super_admin`) | Valid |
| VL-27 | `AppRole`: unrecognized roles rejected | Invalid |
| VL-28 | `OrgStatus`: `active`, `inactive`, `suspended` accepted | Valid |
| VL-29 | `OrgStatus`: arbitrary strings rejected | Invalid |

---

### 3.6 AI Agent — Data Schemas

**Framework:** pytest · **36 cases**

| ID | Test case | Expected result |
|----|----------|----------------|
| AG-01 | `prompt` is required in `EventPlanRequest` | Validation error if absent |
| AG-02 | Minimal valid request: only `prompt` | `currency="COP"`, `template=None`, `budget_cap=None` by default |
| AG-03 | Full request with all optional fields | All fields parsed correctly |
| AG-04 | `EventPlanResponse` parses a valid plan | Object validated correctly |
| AG-05 | All 8 Spanish event types accepted in response | `event_type` valid for each value |
| AG-06 | English event type (e.g., `"concert"`) rejected in response | Pydantic validation error |
| AG-07 | `items` defaults to `[]` if absent | Empty list instead of `None` |
| AG-08 | All 11 Spanish item categories accepted in `EventPlanItem` | All valid |
| AG-09 | English category `"equipment"` rejected in plan item | Validation error |
| AG-10 | Category `"crew"` rejected in plan item | Validation error |
| AG-11 | `description` and `notes` optional in `EventPlanItem` | Parsed correctly without those fields |
| AG-12 | `QuoteRequest` requires `eventType` and `description` | Error if either is missing |
| AG-13 | Minimal valid quote request | Parsed correctly |
| AG-14 | `inventory` in quote accepts items with name and cost | Valid structure |
| AG-15 | `QuoteResponse` accepts English categories (`equipment`, `crew`, `supplier`) | Valid for quote lines |
| AG-16 | Spanish category rejected in `QuoteResponse` | Error (quotes use English categories) |
| AG-17 | `notes` defaults to `""` if absent in quote line | Empty string |

_(The remaining 19 cases cover parametrized variants of event types and categories.)_

---

### 3.7 AI Agent — Prompt Builder

**Framework:** pytest · **14 cases**

| ID | Test case | Expected result |
|----|----------|----------------|
| PR-01 | Quote prompt includes event type | `event_type` present in prompt text |
| PR-02 | Prompt includes event description | `description` present |
| PR-03 | Prompt includes currency | Currency code present |
| PR-04 | No inventory: placeholder appears in prompt | Text indicating empty inventory |
| PR-05 | With inventory: items injected with name, cost, and availability | Inventory data in the prompt |
| PR-06 | Prompt describes expected JSON format (lines, markup) | JSON schema described in text |
| PR-07 | Event plan prompt includes user's text (`prompt`) | User input present |
| PR-08 | Plan prompt includes currency | Currency code present |
| PR-09 | With `budget_cap`: limit injected with "Do not exceed" | Budget constraint in the prompt |
| PR-10 | Without `budget_cap`: message indicating no limit | Alternative text present |
| PR-11 | With `template`: template suggestion injected | Template hint in the prompt |
| PR-12 | Spanish enum values appear in the prompt | Categories like `personal`, `catering`, `equipo`, etc. |
| PR-13 | Prompt describes plan JSON format (estimated_budget, estimated_revenue, items) | Correct schema described |

---

### 3.8 AI Agent — HTTP Routes

**Framework:** pytest + FastAPI TestClient · **12 cases**

| ID | Test case | Expected result |
|----|----------|----------------|
| RT-01 | `GET /health` returns 200 | `{"ok": true}` |
| RT-02 | `POST /quote/suggest` without auth header → 401 | `{"detail": "Unauthorized"}` |
| RT-03 | `POST /quote/suggest` with wrong secret → 401 | `{"detail": "Unauthorized"}` |
| RT-04 | `POST /event/plan` without auth → 401 | `{"detail": "Unauthorized"}` |
| RT-05 | `POST /quote/suggest` without required fields → 422 | Validation error with missing fields |
| RT-06 | `POST /quote/suggest` without `description` → 422 | Error indicating the missing field |
| RT-07 | Valid quote request with mocked OpenAI → 200 with lines | `{"lines": [...]}` with correct structure |
| RT-08 | OpenAI called exactly once per request | `mock.call_count == 1` |
| RT-09 | `POST /event/plan` without `prompt` → 422 | Validation error |
| RT-10 | Valid event plan → 200 with title, event type, and items | Complete plan response |
| RT-11 | Plan with `budget_cap` and `currency` → both in response | Financial data present |
| RT-12 | OpenAI returns invalid `event_type` → 500 | Server error (Pydantic rejects the value) |

---

### 3.9 Frontend — Web Components

**Framework:** Vitest + Testing Library · **25 cases**

| ID | Test case | Expected result |
|----|----------|----------------|
| FE-01 | `EventDetail`: renders loaded event (regression for `data.event` bug) | Event title visible, not "Loading" |
| FE-02 | `Dashboard`: shows "Dashboard" heading | h1 element visible |
| FE-03 | `Dashboard`: shows KPI values after load | Event and personnel numbers visible |
| FE-04 | `Dashboard`: shows upcoming event title | Event name in the list |
| FE-05 | `Dashboard`: shows empty state when no upcoming events | "No scheduled events" text visible |
| FE-06 | `EventsList`: shows "Events" heading | h1 element visible |
| FE-07 | `EventsList`: empty state when no events | "No events yet" visible |
| FE-08 | `EventsList`: shows event titles after load | Event name in the list |
| FE-09 | `Clients`: shows "Clients" heading | h1 element visible |
| FE-10 | `Clients`: shows client name after load | Name in the table |
| FE-11 | `Clients`: empty table when no clients | No data rows |
| FE-12 | `Suppliers`: shows "Suppliers" heading | h1 element visible |
| FE-13 | `Suppliers`: shows supplier name after load | Name in the card |
| FE-14 | `Personnel`: shows "Personnel" heading | h1 element visible |
| FE-15 | `Personnel`: shows person name after load | Name in the card |
| FE-16 | `Inventory`: shows "Inventory" heading | h1 element visible |
| FE-17 | `Inventory`: shows equipment name after load | Name in the card |
| FE-18 | `Inventory`: shows human-readable label, not internal DB value | "Audio / Video" visible, `audio_video` absent |

---

### 3.10 Integration — Real Database

**Framework:** Vitest (no mocks) · **14 cases**

| ID | Test case | Expected result |
|----|----------|----------------|
| INT-01 | Create client → appears in list | UUID returned; name in `list()` |
| INT-02 | Update client name | `name` field updated in DB |
| INT-03 | Org B cannot see Org A's client | `list()` from Org B does not contain the created ID |
| INT-04 | Delete client | ID absent in subsequent `list()` |
| INT-05 | Create equipment → appears in list | UUID returned; name in `list()` |
| INT-06 | Update equipment quantity | `quantity = 7` in DB |
| INT-07 | Org B cannot see Org A's equipment | Isolation confirmed |
| INT-08 | Delete equipment | ID absent in subsequent `list()` |
| INT-09 | Create supplier → appears in list | UUID returned; name in `list()` |
| INT-10 | Org B cannot see Org A's supplier | Isolation confirmed |
| INT-11 | Delete supplier | ID absent in subsequent `list()` |
| INT-12 | Create personnel record → appears in list | UUID returned; name in `list()` |
| INT-13 | Org B cannot see Org A's personnel | Isolation confirmed |
| INT-14 | Delete personnel record | ID absent in subsequent `list()` |

---

### 3.11 E2E — Full Browser (Playwright)

**Framework:** Playwright Chromium · **11 cases**

| ID | Test case | Expected result |
|----|----------|----------------|
| E2E-01 | Login with valid demo credentials | Redirect to `/dashboard` or `/onboarding` |
| E2E-02 | Dashboard: KPI cards are visible | 4 cards (Events, Personnel, Suppliers, Equipment) visible |
| E2E-03 | Dashboard: financial section visible | "Total Budget" and "Projected Revenue" on screen |
| E2E-04 | Dashboard: "New AI Event" button navigates to `/events/new` | URL changes correctly |
| E2E-05 | Clients page loads without getting stuck | Heading visible, "Loading…" disappears |
| E2E-06 | Suppliers page loads without getting stuck | Heading visible, "Loading…" disappears |
| E2E-07 | Personnel page loads without getting stuck | Heading visible, "Loading…" disappears |
| E2E-08 | Inventory page loads without getting stuck | Heading visible, "Loading…" disappears |
| E2E-09 | Search field in Suppliers is interactive | Accepts text and retains the value |
| E2E-10 | Inventory does not show internal value `audio_video` | String `audio_video` does not appear on screen |
| E2E-11 | Events list loads and resolves loading state | "Loading…" disappears within 15 seconds |

---

## 4. Findings — Bugs Fixed During Testing

| # | Component | Issue | Fix |
|---|-----------|-------|-----|
| 1 | `team.routes.ts` | Role action not validated; `else` branch always executed DELETE | Validation with enum `["add","remove"]` |
| 2 | `super.routes.ts` | `grant` field accepted truthy/falsy values instead of strict boolean | `z.boolean()` in schema |
| 3 | `super.routes.ts` | Organization `status` accepted arbitrary strings written to DB | Restricted to valid `OrgStatus` enum |
| 4 | `ai.routes.ts` | AI generation route had no input validation | Full schema with required `prompt` |
| 5 | `auth.ts` | HS256 with Supabase shared JWT secret rejected real tokens | Migrated to ES256 with remote JWKS |
| 6 | `auth.ts` | `Promise.all` with pgbouncer `connection_limit=1` caused P2024 errors | Changed to sequential queries |

---

## 5. Coverage Summary

| Layer | Cases | Framework | Environment |
|-------|-------|-----------|-------------|
| Backend API — pure logic | 116 | Vitest | No external services |
| AI Agent — Python | 62 | pytest | No external services |
| Frontend — components | 25 | Vitest + Testing Library | No external services |
| Integration — real DB | 14 | Vitest | Active Supabase |
| E2E — browser | 11 | Playwright | Supabase + Docker + Vite |
| **Total** | **228** | | |

---

## 6. How to Run Tests

```bash
# Unit and component tests (no external services)
pnpm --filter api test
pnpm --filter web test
pytest agent/tests/ -v

# Integration tests (requires active DB)
pnpm vitest run integration

# E2E tests (requires full stack)
docker compose up -d
pnpm dev:web &
pnpm --filter web test:e2e
```

---

## 7. Known Limitations

- E2E tests use demo account credentials. Flows dependent on role permissions (e.g., "Add client" button) do not run in automated mode because the roles query does not resolve within Playwright's saved session context.
- Integration tests operate on the demo organization in Supabase. Records created during testing are deleted at the end of each suite.
- The Python agent is tested with a mocked OpenAI. The quality of real model responses is not covered by automated tests.
