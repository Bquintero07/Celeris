# Celeris — Smoke Test Guide

End-to-end verification of all major flows. Run after applying all migrations and
the demo seed. Two paths: **automated seed** (recommended) or **manual sign-up**.

---

## 0. Prerequisites

### Apply all migrations (Supabase SQL Editor — run in order)

```
supabase/migrations/
  ├── [ref repo migrations — from event-ai-genius-ref/supabase/migrations/]
  ├── 20260615_tenant_modules_and_onboarding.sql
  ├── 20260619_event_items_margin_fields.sql
  ├── 20260619_rbac_event_assignment_policy.sql
  ├── 20260620_clients.sql
  ├── 20260620_approval_flow.sql
  └── 20260620_event_templates.sql
```

### Run the seed

```bash
# 1. Create .env.seed (never committed)
cat > .env.seed <<'EOF'
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
EOF

# 2. Run
pnpm tsx scripts/seed.ts
```

**Expected output:** Two tenants created with credentials printed at the end.

| Tenant | Email | Password | Modules |
|--------|-------|----------|---------|
| Agencia Grande Demo | admin@agencia-grande.demo | Demo1234! | All modules |
| Micro Productora Demo | admin@micro-productora.demo | Demo1234! | events_quotes, crew, ai_assistant only |

---

## 1. Auth flow

### 1a. Sign in as Agencia Grande admin

1. Open `http://localhost:5173?org=agencia-grande` (dev) or the Vercel URL.
2. Click **Sign in**, enter `admin@agencia-grande.demo` / `Demo1234!`.
3. **Expected:** redirected to `/dashboard` — no onboarding prompt because the org exists.

### 1b. Module gating check

- Sidebar shows: Dashboard, Events, Clients, Inventory, Personnel, Suppliers, Analytics, Billing, Team.
- Switch tenant: open `http://localhost:5173?org=micro-productora` and sign in.
- **Expected:** Inventory, Suppliers, Analytics, Billing tabs are **hidden** (not in enabled_modules).

---

## 2. Events

### 2a. View event list

1. Click **Events** in the sidebar.
2. **Expected:** Event "Lanzamiento Tarjeta Élite 2026" appears in the list.

### 2b. Open event detail

1. Click the event.
2. **Expected:**
   - 4 KPI cards: Total Cost, Revenue, Margin, Profitability.
   - Approval status badge shows **draft**.
   - 8 line items grouped by category.
   - "Generate with AI", "Use template", "Assign personnel" buttons visible.

### 2c. Edit event

1. Change the Location field.
2. Click **Save**.
3. **Expected:** Toast "Saved", field persists on refresh.

---

## 3. Quote engine — cost / margin

1. In event detail, scroll to the items table.
2. Change a `unit_cost` value and click outside (blur).
3. **Expected:**
   - KPI "Total Cost" updates.
   - "Margin" and "Profitability" update accordingly.
   - If the item has `base_cost` < `unit_cost`, a green "+X%" markup badge appears.

### Margin gating

1. Sign in as a user with role **logistica** (no `quotes.view_margin` permission).
2. Open the same event.
3. **Expected:** Margin and Profitability KPI cards are **not shown**. Markup badge hidden.

---

## 4. Approval flow

1. Sign in as admin.
2. Open the event. Status = **draft**.
3. Click **Submit for review** → status changes to **review**.
4. Click **Approve** → status changes to **approved**.
5. Click **Mark as sent** → status changes to **sent**.
6. **Expected after each step:** badge color changes, correct button set is shown.

---

## 5. Templates

1. Click **Use template** in the items card.
2. **Expected:** Dialog lists "Lanzamiento Corporativo" template.
3. Click **Apply**.
4. **Expected:** Template items are bulk-inserted; toast confirms count.

---

## 6. AI — Generate with AI

> **Note:** Requires the Python agent running (`pnpm dev:agent` or Render deploy).

1. Open the event.
2. Click **Generate with AI**.
3. **Expected:**
   - Loading spinner while agent processes.
   - Table of suggested quote lines (editable: name, qty, days, unit cost, markup).
   - AI notes section below.
4. Edit one line (change qty).
5. Click **Apply to event**.
6. **Expected:** Lines replace existing items. Toast "AI quote applied".

---

## 7. Clients

1. Click **Clients** in the sidebar.
2. **Expected:** "Banco Nacional de Colombia" row is visible.
3. Click **Add client**, fill in form, click **Save**.
4. **Expected:** New client appears in the table.

---

## 8. Inventory availability

> Verify via API (no dedicated UI page yet):

```bash
curl "http://localhost:3000/api/availability/equipment?start=2026-08-01T00:00:00Z&end=2026-08-03T00:00:00Z" \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Org-Slug: agencia-grande"
```

**Expected:** JSON array with `available_qty` correctly subtracting units committed to overlapping events.

---

## 9. Analytics

1. Click **Analytics** in the sidebar.
2. **Expected:**
   - 3 KPI cards: Total Revenue, Total Cost, Gross Margin.
   - Bar chart "Margin by event" with at least 1 bar.
   - Line chart "Revenue over time" (may be empty if no `start_date` on events).
3. Toggle **By client** grouper.
4. **Expected:** Chart re-renders with client names on x-axis.

---

## 10. Billing — PDF invoice

1. First approve the event (step 4 above).
2. Click **Billing** in the sidebar.
3. **Expected:** Event "Lanzamiento Tarjeta Élite 2026" appears with status **approved**.
4. Click **PDF**.
5. **Expected:** Browser downloads `invoice-INV-XXXXXXXX.pdf`.
6. Open the PDF:
   - Header shows org name and primary color.
   - "Bill To" section shows client info.
   - Items table with categories, quantities, prices.
   - Subtotal + IVA 19% + TOTAL row.
   - Footer: "This document is not a fiscal invoice (DIAN)."
   - **Margin columns are absent** (client-facing PDF never shows margin).

---

## 11. Excel export (internal)

1. Go back to the event.
2. Click **Excel** button in the top bar.
3. **Expected:** `quote-XXXXXXXX.xlsx` downloaded.
4. Open the file:
   - Columns: Category, Description, Qty, Unit Cost, Total.
   - **Admin only:** additional columns Base Cost, Markup %, Margin, Margin %.

---

## 12. Module gating — 403 from API

Sign in as Micro Productora admin and call an endpoint for a disabled module:

```bash
curl "http://localhost:3000/api/analytics/margins" \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Org-Slug: micro-productora"
```

**Expected:** `403 Forbidden` — `analytics` module not enabled for this tenant.

---

## 13. Multi-tenant isolation

1. Sign in as Agencia Grande admin.
2. Note an event ID.
3. Sign in as Micro Productora admin.
4. Try to fetch that event ID:

```bash
curl "http://localhost:3000/api/events/<agencia-event-id>" \
  -H "Authorization: Bearer <micro-productora-jwt>" \
  -H "X-Org-Slug: micro-productora"
```

**Expected:** `404 Not found` — org filter prevents cross-tenant reads.

---

## 14. RBAC — personnel role restrictions

1. Create a user with role **personal** in Agencia Grande.
2. Sign in as that user.
3. Open `/events`.
4. **Expected:** Only events where this user is assigned via `event_items.personnel_id` appear.
5. Try to navigate to `/analytics`.
6. **Expected:** Tab is hidden (NAV_ACCESS check).

---

## Checklist summary

| # | Test | Pass |
|---|------|------|
| 1 | Auth + onboarding routing | ☐ |
| 2 | Module gating (nav hidden for micro-productora) | ☐ |
| 3 | Event CRUD | ☐ |
| 4 | Cost / margin KPIs update on item edit | ☐ |
| 5 | Margin hidden for logistica role | ☐ |
| 6 | Approval flow Draft→Review→Approved→Sent | ☐ |
| 7 | Template apply | ☐ |
| 8 | AI generate + apply | ☐ |
| 9 | Clients CRUD | ☐ |
| 10 | Analytics charts render | ☐ |
| 11 | Billing PDF download + IVA correct | ☐ |
| 12 | Excel export (admin sees margin columns) | ☐ |
| 13 | Module 403 (analytics disabled on micro-productora) | ☐ |
| 14 | Multi-tenant 404 isolation | ☐ |
| 15 | RBAC personnel role sees only assigned events | ☐ |
