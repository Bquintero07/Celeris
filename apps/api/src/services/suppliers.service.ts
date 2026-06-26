import type { AuthContext } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

export async function list(ctx: AuthContext) {
  if (!ctx.orgId) return [];
  return prisma.$queryRaw<any[]>`
    SELECT id, name, category, type, contact_name, email, phone, website, rating, notes, created_at, updated_at
    FROM public.suppliers
    WHERE organization_id = ${ctx.orgId}::uuid
    ORDER BY name
  `;
}

export async function upsert(ctx: AuthContext, data: {
  id?: string; name?: string; category?: string | null; type?: string | null;
  contact_name?: string | null; email?: string | null; phone?: string | null;
  website?: string | null; rating?: number | null; notes?: string | null;
}) {
  const { id, name, category, type, contact_name, email, phone, website, rating, notes } = data;

  if (id) {
    const rows = await prisma.$queryRaw<any[]>`
      UPDATE public.suppliers SET
        name         = COALESCE(${name ?? null}, name),
        category     = COALESCE(${category ?? null}, category),
        type         = COALESCE(${type ?? null}::public.supplier_type, type),
        contact_name = COALESCE(${contact_name ?? null}, contact_name),
        email        = COALESCE(${email ?? null}, email),
        phone        = COALESCE(${phone ?? null}, phone),
        website      = COALESCE(${website ?? null}, website),
        rating       = COALESCE(${rating ?? null}::numeric, rating),
        notes        = COALESCE(${notes ?? null}, notes),
        updated_at   = now()
      WHERE id = ${id}::uuid AND organization_id = ${ctx.orgId}::uuid
      RETURNING *
    `;
    return rows[0] ?? null;
  }

  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO public.suppliers
      (name, category, type, contact_name, email, phone, website, rating, notes, organization_id, created_by)
    VALUES (
      ${name ?? ""}, ${category ?? "General"},
      ${type ?? "externo"}::public.supplier_type,
      ${contact_name ?? null}, ${email ?? null}, ${phone ?? null},
      ${website ?? null}, ${rating ?? null}::numeric, ${notes ?? null},
      ${ctx.orgId}::uuid, ${ctx.userId}::uuid
    )
    RETURNING *
  `;
  return rows[0];
}

export async function remove(ctx: AuthContext, id: string) {
  await prisma.$executeRaw`
    DELETE FROM public.suppliers
    WHERE id = ${id}::uuid AND organization_id = ${ctx.orgId}::uuid
  `;
}
