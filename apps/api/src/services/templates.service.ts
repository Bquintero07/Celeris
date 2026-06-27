import type { AuthContext } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

export async function list(ctx: AuthContext, eventType?: string) {
  if (!ctx.orgId) return [];
  if (eventType) {
    return prisma.$queryRaw<any[]>`
      SELECT id, name, event_type, description, created_at
      FROM public.event_templates
      WHERE organization_id = ${ctx.orgId}::uuid AND event_type = ${eventType}
      ORDER BY name
    `;
  }
  return prisma.$queryRaw<any[]>`
    SELECT id, name, event_type, description, created_at
    FROM public.event_templates
    WHERE organization_id = ${ctx.orgId}::uuid
    ORDER BY event_type, name
  `;
}

export async function get(ctx: AuthContext, id: string) {
  if (!ctx.orgId) return null;
  const [templates, items] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT * FROM public.event_templates
      WHERE id = ${id}::uuid AND organization_id = ${ctx.orgId}::uuid LIMIT 1
    `,
    prisma.$queryRaw<any[]>`
      SELECT * FROM public.template_items WHERE template_id = ${id}::uuid ORDER BY category, name
    `,
  ]);
  if (!templates[0]) return null;
  return { ...templates[0], items };
}

export async function create(ctx: AuthContext, data: {
  name: string; event_type: string; description?: string;
  items?: Array<{ category: string; name: string; quantity?: number; unit_cost?: number; markup_pct?: number; notes?: string }>;
}) {
  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO public.event_templates (name, event_type, description, organization_id, created_by)
    VALUES (${data.name}, ${data.event_type}, ${data.description ?? null}, ${ctx.orgId}::uuid, ${ctx.userId}::uuid)
    RETURNING *
  `;
  const template = rows[0];
  for (const item of data.items ?? []) {
    await prisma.$executeRaw`
      INSERT INTO public.template_items (template_id, category, name, quantity, unit_cost, markup_pct, notes)
      VALUES (
        ${template.id}::uuid,
        ${item.category}::public.item_category,
        ${item.name},
        ${item.quantity ?? 1}::numeric,
        ${item.unit_cost ?? 0}::numeric,
        ${item.markup_pct ?? 0}::numeric,
        ${item.notes ?? null}
      )
    `;
  }
  return get(ctx, template.id);
}

export async function remove(ctx: AuthContext, id: string) {
  await prisma.$executeRaw`
    DELETE FROM public.event_templates
    WHERE id = ${id}::uuid AND organization_id = ${ctx.orgId}::uuid
  `;
}

export async function applyToEvent(ctx: AuthContext, templateId: string, eventId: string) {
  if (!ctx.orgId) throw Object.assign(new Error("Sin organización"), { status: 403 });

  const [templates, items] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT id FROM public.event_templates
      WHERE id = ${templateId}::uuid AND organization_id = ${ctx.orgId}::uuid LIMIT 1
    `,
    prisma.$queryRaw<any[]>`
      SELECT * FROM public.template_items WHERE template_id = ${templateId}::uuid
    `,
  ]);

  if (!templates[0]) throw Object.assign(new Error("Plantilla no encontrada"), { status: 404 });

  const events = await prisma.$queryRaw<any[]>`
    SELECT id FROM public.events
    WHERE id = ${eventId}::uuid AND organization_id = ${ctx.orgId}::uuid LIMIT 1
  `;
  if (!events[0]) throw Object.assign(new Error("Evento no encontrado"), { status: 404 });

  const inserted: any[] = [];
  for (const item of items) {
    const baseCost        = Number(item.unit_cost);
    const markup          = Number(item.markup_pct ?? 0);
    const sellingUnitCost = baseCost * (1 + markup / 100);
    const rows = await prisma.$queryRaw<any[]>`
      INSERT INTO public.event_items
        (event_id, category, name, quantity, unit_cost, base_cost, markup_pct, notes, organization_id)
      VALUES (
        ${eventId}::uuid,
        ${item.category}::public.item_category,
        ${item.name},
        ${Number(item.quantity)}::numeric,
        ${sellingUnitCost}::numeric,
        ${baseCost}::numeric,
        ${markup}::numeric,
        ${item.notes ?? null},
        ${ctx.orgId}::uuid
      )
      RETURNING *
    `;
    inserted.push(rows[0]);
  }
  return inserted;
}
