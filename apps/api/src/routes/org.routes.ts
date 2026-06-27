import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../lib/validate.js";

export const orgRouter = Router();

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "must be a valid hex color (#rrggbb)");

const updateOrgSchema = z.object({
  name:          z.string().min(1).optional(),
  primary_color: hexColor.optional().nullable(),
  accent_color:  hexColor.optional().nullable(),
  logo_url:      z.string().url().optional().nullable(),
});

// GET /api/org
orgRouter.get("/", async (req, res) => {
  const orgId = req.ctx?.orgId;
  if (!orgId) return res.status(403).json({ error: "Sin organización" });

  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, name, slug, join_code, primary_color, accent_color, logo_url, created_at, updated_at,
           COALESCE(enabled_modules, '{}') as enabled_modules,
           COALESCE(status, 'active') as status
    FROM public.organizations WHERE id = ${orgId}::uuid LIMIT 1
  `;
  if (!rows[0]) return res.status(404).json({ error: "Organización no encontrada" });
  res.json(rows[0]);
});

// PATCH /api/org  { name?, primary_color?, accent_color?, logo_url? }
orgRouter.patch("/", validate(updateOrgSchema), async (req, res) => {
  const orgId = req.ctx?.orgId;
  if (!orgId) return res.status(403).json({ error: "Sin organización" });
  if (!req.ctx?.isSuperAdmin && !req.ctx?.roles.includes("admin")) {
    return res.status(403).json({ error: "Solo administradores" });
  }

  const current = await prisma.$queryRaw<any[]>`
    SELECT name, primary_color, accent_color, logo_url
    FROM public.organizations WHERE id = ${orgId}::uuid LIMIT 1
  `;
  if (!current[0]) return res.status(404).json({ error: "Organización no encontrada" });

  const body = req.body as Record<string, unknown>;
  const name          = "name"          in body ? body.name          : current[0].name;
  const primary_color = "primary_color" in body ? body.primary_color : current[0].primary_color;
  const accent_color  = "accent_color"  in body ? body.accent_color  : current[0].accent_color;
  const logo_url      = "logo_url"      in body ? body.logo_url      : current[0].logo_url;

  await prisma.$executeRaw`
    UPDATE public.organizations SET
      name          = ${name},
      primary_color = ${primary_color},
      accent_color  = ${accent_color},
      logo_url      = ${logo_url},
      updated_at    = now()
    WHERE id = ${orgId}::uuid
  `;

  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, name, slug, join_code, primary_color, accent_color, logo_url, updated_at
    FROM public.organizations WHERE id = ${orgId}::uuid LIMIT 1
  `;
  res.json(rows[0]);
});
