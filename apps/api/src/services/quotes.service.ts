import type { AuthContext, QuoteSuggestLine, QuoteSuggestResponse } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

type EventItem = {
  id: string; event_id: string; category: string; name: string;
  quantity: number; unit_cost: number; total_cost: number;
  base_cost: number | null; markup_pct: number | null;
  notes: string | null; created_at: string;
};

type QuoteLine = EventItem & {
  subtotal: number;   // base_cost * quantity (raw cost)
  revenue: number;    // total_cost = unit_cost * quantity (selling price)
  margin: number;     // revenue - subtotal
  margin_pct: number; // margin / revenue * 100
  profit_pct: number; // margin / subtotal * 100
};

function calcMargins(items: EventItem[]): QuoteLine[] {
  return items.map((item) => {
    const qty     = Number(item.quantity);
    const baseCost = item.base_cost != null ? Number(item.base_cost) : Number(item.unit_cost);
    const revenue  = Number(item.total_cost); // = unit_cost * quantity (selling price)
    const subtotal = baseCost * qty;          // raw cost
    const margin   = revenue - subtotal;
    const margin_pct  = revenue  > 0 ? (margin / revenue)  * 100 : 0;
    const profit_pct  = subtotal > 0 ? (margin / subtotal) * 100 : 0;
    return { ...item, subtotal, revenue, margin, margin_pct, profit_pct };
  });
}

export async function getQuote(ctx: AuthContext, eventId: string) {
  if (!ctx.orgId) return null;

  const events = await prisma.$queryRaw<any[]>`
    SELECT id, title, event_type, status, start_date, end_date, location, budget, revenue, attendees
    FROM public.events
    WHERE id = ${eventId}::uuid AND organization_id = ${ctx.orgId}::uuid
    LIMIT 1
  `;
  const event = events[0];
  if (!event) return null;

  const items = await prisma.$queryRaw<EventItem[]>`
    SELECT id, event_id, category, name, quantity, unit_cost, total_cost,
           base_cost, markup_pct, notes, created_at
    FROM public.event_items
    WHERE event_id = ${eventId}::uuid
    ORDER BY category, name
  `;

  const lines = calcMargins(items);
  const totalCost    = lines.reduce((s, l) => s + l.subtotal, 0);
  const totalRevenue = lines.reduce((s, l) => s + l.revenue, 0);
  const totalMargin  = totalRevenue - totalCost;
  const totalMarginPct  = totalRevenue > 0 ? (totalMargin / totalRevenue)  * 100 : 0;
  const totalProfitPct  = totalCost   > 0 ? (totalMargin / totalCost)      * 100 : 0;

  return {
    event,
    lines,
    summary: { totalCost, totalRevenue, totalMargin, totalMarginPct, totalProfitPct },
  };
}

export async function aiSuggest(
  ctx: AuthContext,
  eventId: string,
  opts: { prompt?: string; budget?: number; currency?: string },
): Promise<QuoteSuggestResponse> {
  const aiUrl = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
  if (!ctx.orgId) throw Object.assign(new Error("No organization"), { status: 403 });

  // Fetch event, org inventory and crew in parallel
  const [events, equipRows, crewRows] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT id, title, event_type, description, budget, attendees, ai_prompt
      FROM public.events
      WHERE id = ${eventId}::uuid AND organization_id = ${ctx.orgId}::uuid
      LIMIT 1
    `,
    prisma.$queryRaw<any[]>`
      SELECT id, name, unit_cost AS "unitCost", quantity AS available
      FROM public.equipment
      WHERE organization_id = ${ctx.orgId}::uuid
    `,
    prisma.$queryRaw<any[]>`
      SELECT id, full_name AS name, role, hourly_rate, available, skills
      FROM public.personnel
      WHERE organization_id = ${ctx.orgId}::uuid AND available = true
    `,
  ]);

  const event = events[0];
  if (!event) throw Object.assign(new Error("Event not found"), { status: 404 });

  // Build the payload that matches the agent's QuoteRequest schema
  const agentPayload = {
    eventType: event.event_type ?? "corporativo",
    description: opts.prompt ?? event.description ?? event.ai_prompt ?? event.title ?? "",
    currency: opts.currency ?? "COP",
    inventory: equipRows.map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
      unitCost: Number(r.unitCost),
      available: Number(r.available),
    })),
    crew: crewRows.map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
      role: String(r.role ?? ""),
      hourlyRate: Number(r.hourly_rate),
      available: Boolean(r.available),
      skills: r.skills ?? [],
    })),
  };

  const resp = await fetch(`${aiUrl}/quote/suggest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AGENT_SHARED_SECRET ?? ""}`,
    },
    body: JSON.stringify(agentPayload),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw Object.assign(new Error(`AI service error: ${text}`), { status: resp.status });
  }
  return resp.json() as Promise<QuoteSuggestResponse>;
}

export async function applyLines(
  ctx: AuthContext,
  eventId: string,
  lines: QuoteSuggestLine[],
) {
  if (!ctx.orgId) throw Object.assign(new Error("No organization"), { status: 403 });

  const events = await prisma.$queryRaw<any[]>`
    SELECT id FROM public.events
    WHERE id = ${eventId}::uuid AND organization_id = ${ctx.orgId}::uuid LIMIT 1
  `;
  if (!events[0]) throw Object.assign(new Error("Event not found"), { status: 404 });

  await prisma.$executeRaw`DELETE FROM public.event_items WHERE event_id = ${eventId}::uuid`;

  for (const line of lines) {
    // total_cost is GENERATED ALWAYS AS (quantity * unit_cost) — cannot be inserted.
    // unit_cost stores the selling price; base_cost stores the original cost.
    const baseCost        = Number(line.unitCost);
    const qty             = Number(line.quantity);
    const markup          = Number(line.markup ?? 0);
    const sellingUnitCost = baseCost * (1 + markup / 100);
    await prisma.$executeRaw`
      INSERT INTO public.event_items
        (event_id, category, name, quantity, unit_cost, base_cost, markup_pct, notes, organization_id)
      VALUES (
        ${eventId}::uuid,
        ${line.category}::public.item_category,
        ${line.name},
        ${qty}::numeric,
        ${sellingUnitCost}::numeric,
        ${baseCost}::numeric,
        ${markup}::numeric,
        ${line.availability ?? null},
        ${ctx.orgId}::uuid
      )
    `;
  }

  return getQuote(ctx, eventId);
}
