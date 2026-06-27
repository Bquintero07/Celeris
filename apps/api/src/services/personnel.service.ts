import type { AuthContext } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

export async function list(ctx: AuthContext) {
  if (!ctx.orgId) return [];
  // is_busy = assigned to an event happening right now (not cancelled/finished).
  return prisma.$queryRaw<any[]>`
    SELECT p.id, p.full_name, p.role, p.skills, p.available, p.hourly_rate,
           p.email, p.phone, p.notes, p.user_id, p.created_at, p.updated_at,
           EXISTS (
             SELECT 1 FROM public.event_items ei
             JOIN public.events ev ON ev.id = ei.event_id
             WHERE ei.personnel_id = p.id
               AND ev.status NOT IN ('cancelado','finalizado')
               AND ev.start_date <= now()
               AND (ev.end_date IS NULL OR ev.end_date >= now())
           ) AS is_busy
    FROM public.personnel p
    WHERE p.organization_id = ${ctx.orgId}::uuid
    ORDER BY p.full_name
  `;
}

export async function upsert(ctx: AuthContext, data: {
  id?: string; full_name?: string; role?: string | null; skills?: string[];
  available?: boolean; hourly_rate?: number | null; email?: string | null;
  phone?: string | null; notes?: string | null;
}) {
  const { id, full_name, role, skills, available, hourly_rate, email, phone, notes } = data;
  const skillsArr = Array.isArray(skills) ? skills : [];

  if (id) {
    const rows = await prisma.$queryRaw<any[]>`
      UPDATE public.personnel SET
        full_name   = COALESCE(${full_name ?? null}, full_name),
        role        = COALESCE(${role ?? null}, role),
        skills      = COALESCE(${skillsArr.length ? skillsArr : null}::text[], skills),
        available   = COALESCE(${available ?? null}::boolean, available),
        hourly_rate = COALESCE(${hourly_rate ?? null}::numeric, hourly_rate),
        email       = COALESCE(${email ?? null}, email),
        phone       = COALESCE(${phone ?? null}, phone),
        notes       = COALESCE(${notes ?? null}, notes),
        updated_at  = now()
      WHERE id = ${id}::uuid AND organization_id = ${ctx.orgId}::uuid
      RETURNING *
    `;
    return rows[0] ?? null;
  }

  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO public.personnel
      (full_name, role, skills, available, hourly_rate, email, phone, notes, organization_id)
    VALUES (
      ${full_name ?? ""}, ${role ?? "staff"}, ${skillsArr}::text[],
      ${available ?? true}::boolean, ${hourly_rate ?? 0}::numeric,
      ${email ?? null}, ${phone ?? null}, ${notes ?? null},
      ${ctx.orgId}::uuid
    )
    RETURNING *
  `;
  return rows[0];
}

export async function remove(ctx: AuthContext, id: string) {
  await prisma.$executeRaw`
    DELETE FROM public.personnel
    WHERE id = ${id}::uuid AND organization_id = ${ctx.orgId}::uuid
  `;
}
