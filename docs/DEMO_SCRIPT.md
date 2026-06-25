# Celeris — Video Demo Script

**Duration:** 4–5 minutes  
**Format:** Screen recording with voiceover  
**Prerequisites:** Seed data applied (`pnpm seed`), both dev servers running, demo accounts logged out

---

## Setup (before recording)

- Open `http://localhost:5173` in a clean browser window (incognito recommended)
- Have the two demo credentials ready:
  - `admin@agencia-grande.demo` / `Demo1234!`
  - `admin@micro-productora.demo` / `Demo1234!`
- Browser zoom: 90%
- Window size: 1440 × 900

---

## Scene 1 — Sign in (0:00 – 0:20)

**Show:** Landing page → Sign in button

> "Celeris is a platform for event operations companies. Let me sign in as the admin of Agencia Grande."

**Action:** Click **Sign in** → enter `admin@agencia-grande.demo` / `Demo1234!` → click Sign in

**Expected:** Redirected to `/dashboard`

---

## Scene 2 — Dashboard overview (0:20 – 0:45)

**Show:** Dashboard with KPI cards and upcoming events

> "The dashboard shows live metrics: total events, personnel, equipment, and budget summary. Everything here is scoped to this organization — other tenants can't see any of this."

**Action:** Point to the four KPI cards and the "Upcoming Events" and "Recent Events" panels

**Pause:** Let the dashboard settle for 2 seconds before moving on

---

## Scene 3 — Event detail + margin KPIs (0:45 – 1:30)

**Action:** Click **Events** in the sidebar → click "Lanzamiento Tarjeta Élite 2026"

> "Here's an event in progress. Four KPI cards: total cost, projected revenue, margin, and profitability — updated in real time as items change."

**Action:** Scroll to the items table — show items grouped by category (Personnel, Equipment, Audio/Video…)

> "Items are grouped by category. Each item has a selling price. If the item has a cost below the selling price, a green markup badge appears — visible only to users who have the 'view margin' permission."

**Action:** Point to a green "+X%" badge on an item

---

## Scene 4 — AI quote generation (1:30 – 2:15)

> "Now the standout feature — AI quote generation."

**Action:** Click **Generate with AI** button

> "The AI agent receives the event description, budget, and available inventory, then generates a full Bill of Materials."

**Show:** Loading spinner for a few seconds → table of AI-suggested lines appears

> "Each line is editable. I can adjust quantity, days, unit cost, or markup before applying."

**Action:** Change the quantity of one line (e.g., from 2 to 3)

> "When I'm happy with the proposal, I click Apply."

**Action:** Click **Apply to event** → toast "AI quote applied" → items refresh

---

## Scene 5 — Approval flow (2:15 – 2:50)

**Show:** Approval status bar at the top of the event — badge shows "Draft"

> "Every quote has an approval flow. As comercial, I submit it for review."

**Action:** Click **Submit for review** → badge changes to "Under review" (yellow)

> "Now the director can approve or reject it."

**Action:** Click **Approve** → badge changes to "Approved" (green)

**Action:** Click **Mark as sent** → badge changes to "Sent" (blue)

> "Each transition is timestamped and logged. The audit trail is permanent."

---

## Scene 6 — PDF invoice (2:50 – 3:20)

**Show:** Still on the event detail page — top bar shows PDF and Excel buttons

> "Now I can generate an invoice — white-labeled with the agency's branding."

**Action:** Click **PDF** button → browser downloads `invoice-INV-XXXXXXXX.pdf`

**Action:** Open the PDF and zoom in

> "The header uses the organization's primary color. Client information is populated from the Clients module. Items are listed with quantities and unit prices. IVA 19% is calculated at the bottom."

**Pause 2 seconds on the PDF totals section**

> "Notice: no margin or markup columns. The client never sees what the agency's cost was."

---

## Scene 7 — Analytics (3:20 – 3:45)

**Action:** Click **Analytics** in the sidebar

> "The analytics module shows margin by event, revenue over time, and a breakdown by event type."

**Action:** Click **By client** toggle

> "Toggle to group by client — useful for understanding which accounts are most profitable."

**Show:** Chart re-renders with client names on the x-axis

---

## Scene 8 — Module gating (tenant switch) (3:45 – 4:15)

**Action:** Click avatar / sign out → sign in as `admin@micro-productora.demo` / `Demo1234!`

> "Let me switch to a smaller tenant — Micro Productora. They only have the Events, Crew and AI modules enabled."

**Show:** Sidebar — Analytics, Billing, Inventory, Suppliers tabs are absent

> "The platform adapts per tenant. Micro Productora's team can't access — or accidentally pay for — features they don't use."

**Action:** Try navigating directly to `http://localhost:5173/analytics`

> "Even if they type the URL directly, the API returns 403. Module gating is enforced server-side."

---

## Scene 9 — Closing (4:15 – 4:30)

**Show:** Return to Dashboard of Micro Productora

> "Celeris: AI-powered operations, real-time margin control, approval flows, and white-label invoicing — multi-tenant by design, deployable in minutes."

**Action:** Hold on the dashboard for 3 seconds

**End recording.**

---

## Post-production notes

- Add a lower-third text overlay at Scene 4 showing: "AI generates quote in < 30 seconds"
- Add a lower-third at Scene 6 showing: "PDF branded with client's colors — not 'Powered by Celeris'"
- Add a lower-third at Scene 8 showing: "403 enforced at API level — not just hidden in the UI"
- Background music: low-key instrumental, fade out at Scene 9
- Export at 1080p, 30fps
