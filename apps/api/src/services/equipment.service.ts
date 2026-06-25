import type { AuthContext } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

export async function list(ctx: AuthContext) {
  if (!ctx.orgId) return [];
  return prisma.$queryRaw<any[]>`
    SELECT id, name, category, quantity, unit_cost, condition, location, notes, created_at, updated_at
    FROM public.equipment
    WHERE organization_id = ${ctx.orgId}::uuid
    ORDER BY name
  `;
}

export async function upsert(ctx: AuthContext, data: {
  id?: string; name?: string; category?: string; quantity?: number;
  unit_cost?: number; condition?: string; location?: string; notes?: string;
}) {
  const { id, name, category, quantity, unit_cost, condition, location, notes } = data;

  if (id) {
    const rows = await prisma.$queryRaw<any[]>`
      UPDATE public.equipment SET
        name       = COALESCE(${name ?? null}, name),
        category   = COALESCE(${category ?? null}::public.item_category, category),
        quantity   = COALESCE(${quantity ?? null}::int, quantity),
        unit_cost  = COALESCE(${unit_cost ?? null}::numeric, unit_cost),
        condition  = COALESCE(${condition ?? null}, condition),
        location   = COALESCE(${location ?? null}, location),
        notes      = COALESCE(${notes ?? null}, notes),
        updated_at = now()
      WHERE id = ${id}::uuid AND organization_id = ${ctx.orgId}::uuid
      RETURNING *
    `;
    return rows[0] ?? null;
  }

  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO public.equipment
      (name, category, quantity, unit_cost, condition, location, notes, organization_id)
    VALUES (
      ${name ?? ""}, ${category ?? "extras"}::public.item_category,
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
