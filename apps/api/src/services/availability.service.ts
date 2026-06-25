import type { AuthContext } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

type EquipmentAvail = {
  id: string; name: string; category: string;
  total_qty: number; reserved_qty: number; available_qty: number;
};

type PersonnelAvail = {
  id: string; full_name: string; role: string;
  available: boolean; is_assigned: boolean;
};

export async function equipmentInRange(
  ctx: AuthContext,
  start: string,
  end: string,
  excludeEventId?: string,
): Promise<EquipmentAvail[]> {
  if (!ctx.orgId) return [];

  // Count units already committed to overlapping events
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      e.id,
      e.name,
      e.category,
      e.quantity                                                     AS total_qty,
      COALESCE(
        SUM(ei.quantity) FILTER (
          WHERE ev.start_date < ${end}::timestamptz
            AND ev.end_date   > ${start}::timestamptz
            AND ev.status NOT IN ('cancelado','finalizado')
            AND (${excludeEventId ?? null}::uuid IS NULL OR ev.id <> ${excludeEventId ?? null}::uuid)
        ), 0
      )::numeric                                                     AS reserved_qty
    FROM public.equipment e
    LEFT JOIN public.event_items ei ON ei.equipment_id = e.id
    LEFT JOIN public.events      ev ON ev.id           = ei.event_id
    WHERE e.organization_id = ${ctx.orgId}::uuid
    GROUP BY e.id, e.name, e.category, e.quantity
    ORDER BY e.name
  `;

  return rows.map((r: any) => ({
    ...r,
    total_qty:     Number(r.total_qty),
    reserved_qty:  Number(r.reserved_qty),
    available_qty: Math.max(0, Number(r.total_qty) - Number(r.reserved_qty)),
  }));
}

export async function personnelInRange(
  ctx: AuthContext,
  start: string,
  end: string,
  excludeEventId?: string,
): Promise<PersonnelAvail[]> {
  if (!ctx.orgId) return [];

  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      p.id,
      p.full_name,
      p.role,
      p.available,
      EXISTS (
        SELECT 1
        FROM public.event_items ei
        JOIN public.events      ev ON ev.id = ei.event_id
        WHERE ei.personnel_id  = p.id
          AND ev.start_date    < ${end}::timestamptz
          AND ev.end_date      > ${start}::timestamptz
          AND ev.status NOT IN ('cancelado','finalizado')
          AND (${excludeEventId ?? null}::uuid IS NULL OR ev.id <> ${excludeEventId ?? null}::uuid)
      ) AS is_assigned
    FROM public.personnel p
    WHERE p.organization_id = ${ctx.orgId}::uuid
    ORDER BY p.full_name
  `;

  return rows as PersonnelAvail[];
}
