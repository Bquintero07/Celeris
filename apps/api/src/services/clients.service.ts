import type { AuthContext } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

export async function list(ctx: AuthContext) {
  if (!ctx.orgId) return [];
  return prisma.$queryRaw<any[]>`
    SELECT id, name, contact_name, email, phone, address, tax_id, notes, created_at, updated_at
    FROM public.clients
    WHERE organization_id = ${ctx.orgId}::uuid
    ORDER BY name
  `;
}

export async function upsert(ctx: AuthContext, data: {
  id?: string; name?: string; contact_name?: string; email?: string;
  phone?: string; address?: string; tax_id?: string; notes?: string;
}) {
  const { id, name, contact_name, email, phone, address, tax_id, notes } = data;

  if (id) {
    const rows = await prisma.$queryRaw<any[]>`
      UPDATE public.clients SET
        name         = COALESCE(${name         ?? null}, name),
        contact_name = COALESCE(${contact_name ?? null}, contact_name),
        email        = COALESCE(${email        ?? null}, email),
        phone        = COALESCE(${phone        ?? null}, phone),
        address      = COALESCE(${address      ?? null}, address),
        tax_id       = COALESCE(${tax_id       ?? null}, tax_id),
        notes        = COALESCE(${notes        ?? null}, notes),
        updated_at   = now()
      WHERE id = ${id}::uuid AND organization_id = ${ctx.orgId}::uuid
      RETURNING *
    `;
    return rows[0] ?? null;
  }

  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO public.clients
      (name, contact_name, email, phone, address, tax_id, notes, organization_id, created_by)
    VALUES (
      ${name ?? ""}, ${contact_name ?? null}, ${email ?? null},
      ${phone ?? null}, ${address ?? null}, ${tax_id ?? null},
      ${notes ?? null}, ${ctx.orgId}::uuid, ${ctx.userId}::uuid
    )
    RETURNING *
  `;
  return rows[0];
}

export async function remove(ctx: AuthContext, id: string) {
  await prisma.$executeRaw`
    DELETE FROM public.clients
    WHERE id = ${id}::uuid AND organization_id = ${ctx.orgId}::uuid
  `;
}
