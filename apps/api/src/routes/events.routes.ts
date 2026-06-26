import { Router } from "express";
import { z } from "zod";
import { can, type AuthContext } from "@celeris/shared";
import { requireModule } from "../middleware/module.js";
import { requirePermission } from "../middleware/rbac.js";
import { prisma } from "../lib/prisma.js";
import { validate, validateUuidParams, EventType, EventStatus, ItemCategory } from "../lib/validate.js";

export const eventsRouter = Router();
eventsRouter.use(requireModule("events_quotes"));

/**
 * Full editors (events.edit: comercial/admin) can write items on any org event.
 * logistica (events.items.manage) can only write items on events it's assigned to
 * (i.e. it already has a personnel slot on that event).
 */
async function canWriteEventItems(ctx: AuthContext, eventId: string): Promise<boolean> {
  if (ctx.isSuperAdmin) return true;
  const roles = ctx.roles ?? [];
  if (can(roles, "events.edit")) return true;
  if (!can(roles, "events.items.manage")) return false;

  const assigned = await prisma.$queryRaw<any[]>`
    SELECT 1 FROM public.event_items ei
    JOIN public.personnel p ON p.id = ei.personnel_id AND p.user_id = ${ctx.userId}::uuid
    WHERE ei.event_id = ${eventId}::uuid AND ei.organization_id = ${ctx.orgId}::uuid
    LIMIT 1
  `;
  return !!assigned[0];
}

// GET /api/events
eventsRouter.get("/", async (req, res) => {
  const { orgId, userId, roles } = req.ctx!;
  if (!orgId) return res.json([]);

  const canViewAll = roles.includes("admin") || roles.includes("comercial") || roles.includes("viewer");
  const rows = canViewAll
    ? await prisma.$queryRaw<any[]>`
        SELECT id, title, event_type, status, approval_status, client_id,
               start_date, end_date, location, budget, revenue, attendees,
               description, ai_prompt, ai_summary, created_by, created_at, updated_at
        FROM public.events WHERE organization_id = ${orgId}::uuid ORDER BY start_date DESC NULLS LAST
      `
    : await prisma.$queryRaw<any[]>`
        SELECT DISTINCT e.id, e.title, e.event_type, e.status, e.approval_status,
               e.start_date, e.end_date, e.location, e.budget, e.revenue, e.attendees,
               e.description, e.client_id, e.created_at, e.updated_at
        FROM public.events e
        JOIN public.event_items ei ON ei.event_id = e.id
        JOIN public.personnel p ON p.id = ei.personnel_id AND p.user_id = ${userId}::uuid
        WHERE e.organization_id = ${orgId}::uuid
        ORDER BY e.start_date DESC NULLS LAST
      `;
  res.json(rows);
});

// GET /api/events/:id
eventsRouter.get("/:id", validateUuidParams("id"), async (req, res) => {
  const { orgId } = req.ctx!;
  if (!orgId) return res.status(404).json({ error: "Not found" });

  const [events, items] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT * FROM public.events WHERE id = ${req.params.id}::uuid AND organization_id = ${orgId}::uuid LIMIT 1
    `,
    prisma.$queryRaw<any[]>`
      SELECT ei.*, e.name as equipment_name, s.name as supplier_name, p.full_name as personnel_name
      FROM public.event_items ei
      LEFT JOIN public.equipment e ON e.id = ei.equipment_id
      LEFT JOIN public.suppliers s ON s.id = ei.supplier_id
      LEFT JOIN public.personnel p ON p.id = ei.personnel_id
      WHERE ei.event_id = ${req.params.id}::uuid
      ORDER BY ei.category, ei.name
    `,
  ]);
  if (!events[0]) return res.status(404).json({ error: "Event not found" });
  res.json({ ...events[0], items });
});

const createEventSchema = z.object({
  title:       z.string().min(1, "title is required"),
  event_type:  EventType.optional(),
  status:      EventStatus.optional(),
  start_date:  z.string().datetime({ offset: true }).optional().nullable(),
  end_date:    z.string().datetime({ offset: true }).optional().nullable(),
  location:    z.string().optional().nullable(),
  budget:      z.number().nonnegative().optional().nullable(),
  revenue:     z.number().nonnegative().optional().nullable(),
  attendees:   z.number().int().nonnegative().optional().nullable(),
  description: z.string().optional().nullable(),
  ai_prompt:   z.string().optional().nullable(),
  ai_summary:  z.string().optional().nullable(),
  client_id:   z.string().uuid().optional().nullable(),
});

const updateEventSchema = createEventSchema.partial().extend({
  title: z.string().min(1).optional(),
});

const eventItemSchema = z.object({
  name:         z.string().min(1, "name is required"),
  category:     ItemCategory.optional(),
  description:  z.string().optional().nullable(),
  quantity:     z.number().int().positive().optional(),
  unit_cost:    z.number().nonnegative().optional(),
  equipment_id: z.string().uuid().optional().nullable(),
  supplier_id:  z.string().uuid().optional().nullable(),
  personnel_id: z.string().uuid().optional().nullable(),
  notes:        z.string().optional().nullable(),
});

const bulkItemsSchema = z.object({
  items: z.array(eventItemSchema).min(1, "items must be a non-empty array"),
});

const updateEventItemSchema = z.object({
  name:        z.string().min(1).optional(),
  category:    ItemCategory.optional(),
  quantity:    z.number().int().positive().optional(),
  unit_cost:   z.number().nonnegative().optional(),
  description: z.string().optional().nullable(),
  notes:       z.string().optional().nullable(),
});

const noteSchema = z.object({ note: z.string().optional() });

const exportSchema = z.object({
  currency: z.string().length(3).optional(),
});

// POST /api/events
eventsRouter.post("/", requirePermission("events.create"), validate(createEventSchema), async (req, res) => {
  const { orgId, userId } = req.ctx!;
  const { title, event_type, status, start_date, end_date, location, budget, revenue,
          attendees, description, ai_prompt, ai_summary } = req.body;

  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO public.events
      (title, event_type, status, start_date, end_date, location, budget, revenue,
       attendees, description, ai_prompt, ai_summary, organization_id, created_by)
    VALUES (
      ${title}, ${event_type ?? "otro"}::public.event_type,
      ${status ?? "borrador"}::public.event_status,
      ${start_date ?? null}::timestamptz, ${end_date ?? null}::timestamptz,
      ${location ?? null}, ${budget ?? null}::numeric, ${revenue ?? null}::numeric,
      ${attendees ?? null}::int, ${description ?? null},
      ${ai_prompt ?? null}, ${ai_summary ?? null},
      ${orgId}::uuid, ${userId}::uuid
    )
    RETURNING *
  `;
  res.status(201).json(rows[0]);
});

// PATCH /api/events/:id
eventsRouter.patch("/:id", validateUuidParams("id"), requirePermission("events.edit"), validate(updateEventSchema), async (req, res) => {
  const { orgId } = req.ctx!;
  const { title, event_type, status, start_date, end_date, location,
          budget, revenue, attendees, description, ai_prompt, ai_summary, client_id } = req.body;

  const rows = await prisma.$queryRaw<any[]>`
    UPDATE public.events SET
      title       = COALESCE(${title ?? null}, title),
      event_type  = COALESCE(${event_type ?? null}::public.event_type, event_type),
      status      = COALESCE(${status ?? null}::public.event_status, status),
      start_date  = COALESCE(${start_date ?? null}::timestamptz, start_date),
      end_date    = COALESCE(${end_date ?? null}::timestamptz, end_date),
      location    = COALESCE(${location ?? null}, location),
      budget      = COALESCE(${budget ?? null}::numeric, budget),
      revenue     = COALESCE(${revenue ?? null}::numeric, revenue),
      attendees   = COALESCE(${attendees ?? null}::int, attendees),
      description = COALESCE(${description ?? null}, description),
      ai_prompt   = COALESCE(${ai_prompt ?? null}, ai_prompt),
      ai_summary  = COALESCE(${ai_summary ?? null}, ai_summary),
      client_id   = COALESCE(${client_id ?? null}::uuid, client_id),
      updated_at  = now()
    WHERE id = ${req.params.id}::uuid AND organization_id = ${orgId}::uuid
    RETURNING *
  `;
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// DELETE /api/events/:id
eventsRouter.delete("/:id", validateUuidParams("id"), requirePermission("events.edit"), async (req, res) => {
  const { orgId } = req.ctx!;
  await prisma.$executeRaw`
    DELETE FROM public.events WHERE id = ${req.params.id}::uuid AND organization_id = ${orgId}::uuid
  `;
  res.status(204).end();
});

// POST /api/events/:id/items
eventsRouter.post("/:id/items", validateUuidParams("id"), validate(eventItemSchema), async (req, res) => {
  const ctx = req.ctx!;
  const { orgId } = ctx;
  const event = await prisma.$queryRaw<any[]>`
    SELECT id FROM public.events WHERE id = ${req.params.id}::uuid AND organization_id = ${orgId}::uuid LIMIT 1
  `;
  if (!event[0]) return res.status(404).json({ error: "Event not found" });
  if (!(await canWriteEventItems(ctx, req.params.id as string))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { category, name, description, quantity, unit_cost,
          equipment_id, supplier_id, personnel_id, notes } = req.body;

  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO public.event_items
      (event_id, category, name, description, quantity, unit_cost,
       equipment_id, supplier_id, personnel_id, notes, organization_id)
    VALUES (
      ${req.params.id}::uuid,
      ${category ?? "extras"}::public.item_category,
      ${name}, ${description ?? null},
      ${quantity ?? 1}::int, ${unit_cost ?? 0}::numeric,
      ${equipment_id ?? null}::uuid, ${supplier_id ?? null}::uuid,
      ${personnel_id ?? null}::uuid, ${notes ?? null}, ${orgId}::uuid
    )
    RETURNING *
  `;
  res.status(201).json(rows[0]);
});

// POST /api/events/:id/items/bulk
eventsRouter.post("/:id/items/bulk", validateUuidParams("id"), validate(bulkItemsSchema), async (req, res) => {
  const ctx = req.ctx!;
  const { orgId } = ctx;
  const event = await prisma.$queryRaw<any[]>`
    SELECT id FROM public.events WHERE id = ${req.params.id}::uuid AND organization_id = ${orgId}::uuid LIMIT 1
  `;
  if (!event[0]) return res.status(404).json({ error: "Event not found" });
  if (!(await canWriteEventItems(ctx, req.params.id as string))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { items } = req.body as { items: any[] };
  for (const item of items ?? []) {
    await prisma.$executeRaw`
      INSERT INTO public.event_items
        (event_id, category, name, description, quantity, unit_cost, organization_id)
      VALUES (
        ${req.params.id}::uuid,
        ${item.category ?? "extras"}::public.item_category,
        ${item.name}, ${item.description ?? null},
        ${item.quantity ?? 1}::int, ${item.unit_cost ?? 0}::numeric,
        ${orgId}::uuid
      )
    `;
  }
  res.status(204).end();
});

// PATCH /api/events/items/:itemId
eventsRouter.patch("/items/:itemId", validateUuidParams("itemId"), validate(updateEventItemSchema), async (req, res) => {
  const ctx = req.ctx!;
  const { orgId } = ctx;
  const item = await prisma.$queryRaw<any[]>`
    SELECT event_id FROM public.event_items WHERE id = ${req.params.itemId}::uuid AND organization_id = ${orgId}::uuid LIMIT 1
  `;
  if (!item[0]) return res.status(404).json({ error: "Item not found" });
  if (!(await canWriteEventItems(ctx, item[0].event_id))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { name, category, quantity, unit_cost, description, notes } = req.body;

  const rows = await prisma.$queryRaw<any[]>`
    UPDATE public.event_items SET
      name        = COALESCE(${name ?? null}, name),
      category    = COALESCE(${category ?? null}::public.item_category, category),
      quantity    = COALESCE(${quantity ?? null}::numeric, quantity),
      unit_cost   = COALESCE(${unit_cost ?? null}::numeric, unit_cost),
      description = COALESCE(${description ?? null}, description),
      notes       = COALESCE(${notes ?? null}, notes),
      updated_at  = now()
    WHERE id = ${req.params.itemId}::uuid AND organization_id = ${orgId}::uuid
    RETURNING *
  `;
  res.json(rows[0]);
});

// DELETE /api/events/items/:itemId
eventsRouter.delete("/items/:itemId", validateUuidParams("itemId"), async (req, res) => {
  const ctx = req.ctx!;
  const { orgId } = ctx;
  const item = await prisma.$queryRaw<any[]>`
    SELECT event_id FROM public.event_items WHERE id = ${req.params.itemId}::uuid AND organization_id = ${orgId}::uuid LIMIT 1
  `;
  if (!item[0]) return res.status(404).json({ error: "Item not found" });
  if (!(await canWriteEventItems(ctx, item[0].event_id))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  await prisma.$executeRaw`
    DELETE FROM public.event_items WHERE id = ${req.params.itemId}::uuid AND organization_id = ${orgId}::uuid
  `;
  res.status(204).end();
});

// ── Approval flow ────────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:    ["review"],
  review:   ["approved", "rejected"],
  approved: ["sent", "rejected"],
  sent:     [],
  rejected: ["draft"],
};

async function doTransition(
  orgId: string, eventId: string, userId: string,
  to: string, note: string | undefined,
  res: any,
) {
  const events = await prisma.$queryRaw<any[]>`
    SELECT approval_status FROM public.events
    WHERE id = ${eventId}::uuid AND organization_id = ${orgId}::uuid LIMIT 1
  `;
  if (!events[0]) return res.status(404).json({ error: "Event not found" });

  const from = events[0].approval_status ?? "draft";
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    return res.status(422).json({ error: `Cannot transition from '${from}' to '${to}'` });
  }

  await prisma.$executeRaw`
    UPDATE public.events SET approval_status = ${to}, updated_at = now()
    WHERE id = ${eventId}::uuid AND organization_id = ${orgId}::uuid
  `;
  await prisma.$executeRaw`
    INSERT INTO public.approval_log (event_id, organization_id, from_status, to_status, actor_id, note)
    VALUES (${eventId}::uuid, ${orgId}::uuid, ${from}, ${to}, ${userId}::uuid, ${note ?? null})
  `;
  return res.json({ approval_status: to });
}

eventsRouter.post("/:id/submit", validateUuidParams("id"), requirePermission("events.edit"), validate(noteSchema), async (req, res) => {
  const { orgId, userId } = req.ctx!;
  return doTransition(orgId!, req.params.id as string, userId!, "review", req.body.note, res);
});

eventsRouter.post("/:id/approve", validateUuidParams("id"), requirePermission("events.approve"), validate(noteSchema), async (req, res) => {
  const { orgId, userId } = req.ctx!;
  return doTransition(orgId!, req.params.id as string, userId!, "approved", req.body.note, res);
});

eventsRouter.post("/:id/send", validateUuidParams("id"), requirePermission("events.approve"), validate(noteSchema), async (req, res) => {
  const { orgId, userId } = req.ctx!;
  return doTransition(orgId!, req.params.id as string, userId!, "sent", req.body.note, res);
});

eventsRouter.post("/:id/reject", validateUuidParams("id"), requirePermission("events.approve"), validate(noteSchema), async (req, res) => {
  const { orgId, userId } = req.ctx!;
  return doTransition(orgId!, req.params.id as string, userId!, "rejected", req.body.note, res);
});

eventsRouter.get("/:id/approval-log", validateUuidParams("id"), requirePermission("events.edit"), async (req, res) => {
  const { orgId } = req.ctx!;
  const rows = await prisma.$queryRaw<any[]>`
    SELECT al.*, pr.full_name AS actor_name
    FROM public.approval_log al
    LEFT JOIN public.profiles pr ON pr.id = al.actor_id
    WHERE al.event_id = ${req.params.id}::uuid AND al.organization_id = ${orgId}::uuid
    ORDER BY al.created_at ASC
  `;
  res.json(rows);
});

// ── Exports ───────────────────────────────────────────────────────────────────
import * as billing from "../services/billing.service.js";
import ExcelJS from "exceljs";

eventsRouter.post("/:id/export/pdf", validateUuidParams("id"), requirePermission("quotes.export"), validate(exportSchema), async (req, res) => {
  try {
    const result = await billing.generateInvoice(req.ctx!, req.params.id as string, {
      currency: req.body.currency ?? "COP",
      showMargin: req.ctx!.isSuperAdmin || (req.ctx!.roles ?? []).includes("admin"),
    });
    res.json(result);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

eventsRouter.post("/:id/export/excel", validateUuidParams("id"), requirePermission("quotes.export"), validate(exportSchema), async (req, res) => {
  const { orgId, isSuperAdmin, roles } = req.ctx!;
  const canSeeMargin = isSuperAdmin || (roles ?? []).includes("admin") || (roles ?? []).includes("contable");
  const eventId = req.params.id as string;
  const currency = req.body.currency ?? "COP";

  const events = await prisma.$queryRaw<any[]>`
    SELECT e.*, c.name AS client_name FROM public.events e
    LEFT JOIN public.clients c ON c.id = e.client_id
    WHERE e.id = ${eventId}::uuid AND e.organization_id = ${orgId}::uuid LIMIT 1
  `;
  if (!events[0]) return res.status(404).json({ error: "Not found" });

  const items = await prisma.$queryRaw<any[]>`
    SELECT category, name, quantity, unit_cost, total_cost, base_cost, markup_pct, notes
    FROM public.event_items WHERE event_id = ${eventId}::uuid ORDER BY category, name
  `;

  const fmt = (n: number) =>
    `${currency} ${n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Quote");

  ws.columns = [
    { header: "Category",    key: "category",   width: 14 },
    { header: "Description", key: "name",        width: 30 },
    { header: "Qty",         key: "quantity",    width: 8  },
    { header: "Unit Cost",   key: "unit_cost",   width: 14 },
    { header: "Total",       key: "total_cost",  width: 14 },
    ...(canSeeMargin ? [
      { header: "Base Cost",  key: "base_cost",  width: 14 },
      { header: "Markup %",   key: "markup_pct", width: 10 },
      { header: "Margin",     key: "margin",     width: 14 },
      { header: "Margin %",   key: "margin_pct", width: 10 },
    ] : []),
    { header: "Notes",       key: "notes",       width: 24 },
  ];

  for (const item of items) {
    const baseCost  = Number(item.base_cost  ?? item.unit_cost);
    const total     = Number(item.total_cost);
    const rawCost   = baseCost * Number(item.quantity);
    const margin    = total - rawCost;
    const marginPct = total > 0 ? (margin / total * 100) : 0;
    ws.addRow({
      ...item,
      quantity:    Number(item.quantity),
      unit_cost:   fmt(Number(item.unit_cost)),
      total_cost:  fmt(total),
      base_cost:   fmt(baseCost),
      markup_pct:  Number(item.markup_pct ?? 0),
      margin:      fmt(margin),
      margin_pct:  Number(marginPct.toFixed(2)),
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `quote-${eventId.substring(0, 8)}.xlsx`;
  res.json({ base64: Buffer.from(buffer).toString("base64"), filename });
});
