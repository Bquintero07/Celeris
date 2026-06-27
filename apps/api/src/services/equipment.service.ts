import type { AuthContext } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

export async function list(ctx: AuthContext) {
  if (!ctx.orgId) return [];
  // reserved_qty = units committed to ongoing/upcoming events (not cancelled/finished).
  const rows = await prisma.$queryRaw<any[]>`
    SELECT e.id, e.name, e.category, e.subcategory, e.quantity, e.unit_cost,
           e.condition, e.location, e.notes, e.created_at, e.updated_at,
           COALESCE(SUM(ei.quantity) FILTER (
             WHERE ev.status NOT IN ('cancelado','finalizado')
               AND (ev.end_date IS NULL OR ev.end_date > now())
           ), 0)::numeric AS reserved_qty
    FROM public.equipment e
    LEFT JOIN public.event_items ei ON ei.equipment_id = e.id
    LEFT JOIN public.events      ev ON ev.id           = ei.event_id
    WHERE e.organization_id = ${ctx.orgId}::uuid
    GROUP BY e.id
    ORDER BY e.name
  `;
  return rows.map((r: any) => {
    const reserved = Number(r.reserved_qty);
    return { ...r, reserved_qty: reserved, available_qty: Math.max(0, Number(r.quantity) - reserved) };
  });
}

export async function upsert(ctx: AuthContext, data: {
  id?: string; name?: string; category?: string | null; subcategory?: string | null; quantity?: number;
  unit_cost?: number; condition?: string | null; location?: string | null; notes?: string | null;
}) {
  const { id, name, category, subcategory, quantity, unit_cost, condition, location, notes } = data;

  if (id) {
    const rows = await prisma.$queryRaw<any[]>`
      UPDATE public.equipment SET
        name        = COALESCE(${name ?? null}, name),
        category    = COALESCE(${category ?? null}::public.item_category, category),
        subcategory = COALESCE(${subcategory ?? null}, subcategory),
        quantity    = COALESCE(${quantity ?? null}::int, quantity),
        unit_cost   = COALESCE(${unit_cost ?? null}::numeric, unit_cost),
        condition   = COALESCE(${condition ?? null}, condition),
        location    = COALESCE(${location ?? null}, location),
        notes       = COALESCE(${notes ?? null}, notes),
        updated_at  = now()
      WHERE id = ${id}::uuid AND organization_id = ${ctx.orgId}::uuid
      RETURNING *
    `;
    return rows[0] ?? null;
  }

  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO public.equipment
      (name, category, subcategory, quantity, unit_cost, condition, location, notes, organization_id)
    VALUES (
      ${name ?? ""}, ${category ?? "extras"}::public.item_category, ${subcategory ?? null},
      ${quantity ?? 1}::int, ${unit_cost ?? 0}::numeric,
      ${condition ?? null}, ${location ?? null}, ${notes ?? null},
      ${ctx.orgId}::uuid
    )
    RETURNING *
  `;
  return rows[0];
}

export async function remove(ctx: AuthContext, id: string) {
  await prisma.$executeRaw`
    DELETE FROM public.equipment
    WHERE id = ${id}::uuid AND organization_id = ${ctx.orgId}::uuid
  `;
}
