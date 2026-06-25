import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const orgRouter = Router();

// GET /api/org
orgRouter.get("/", async (req, res) => {
  const orgId = req.ctx?.orgId;
  if (!orgId) return res.status(403).json({ error: "No organization" });

  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, name, slug, join_code, primary_color, accent_color, logo_url, created_at, updated_at,
           COALESCE(enabled_modules, '{}') as enabled_modules,
           COALESCE(status, 'active') as status
    FROM public.organizations WHERE id = ${orgId}::uuid LIMIT 1
  `;
  if (!rows[0]) return res.status(404).json({ error: "Organization not found" });
  res.json(rows[0]);
});

// PATCH /api/org  { name?, primary_color?, accent_color?, logo_url? }
orgRouter.patch("/", async (req, res) => {
  const orgId = req.ctx?.orgId;
  if (!orgId) return res.status(403).json({ error: "No organization" });
  if (!req.ctx?.roles.includes("admin")) return res.status(403).json({ error: "Admin only" });

  const { name, primary_color, accent_color, logo_url } = req.body;

  await prisma.$executeRaw`
    UPDATE public.organizations SET
      name          = COALESCE(${name ?? null}, name),
      primary_color = COALESCE(${primary_color ?? null}, primary_color),
      accent_color  = COALESCE(${accent_color ?? null}, accent_color),
      logo_url      = COALESCE(${logo_url ?? null}, logo_url),
      updated_at    = now()
    WHERE id = ${orgId}::uuid
  `;

  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, name, slug, join_code, primary_color, accent_color, logo_url, updated_at
    FROM public.organizations WHERE id = ${orgId}::uuid LIMIT 1
  `;
  res.json(rows[0]);
});
