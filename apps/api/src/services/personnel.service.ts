import type { AuthContext } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

export async function list(ctx: AuthContext) {
  if (!ctx.orgId) return [];
  return prisma.$queryRaw<any[]>`
    SELECT id, full_name, role, skills, available, hourly_rate, email, phone, notes, user_id, created_at, updated_at
    FROM public.personnel
    WHERE organization_id = ${ctx.orgId}::uuid
    ORDER BY full_name
  `;
}

export async function upsert(ctx: AuthContext, data: {
  id?: string; full_name?: string; role?: string; skills?: string[];
  available?: boolean; hourly_rate?: number; email?: string; phone?: string; notes?: string;
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
