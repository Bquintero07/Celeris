import { Router } from "express";
import type { TenantConfig } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

export const tenantRouter = Router();

type OrgRow = {
  name: string;
  enabled_modules: string[] | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
};

// GET /api/tenant/config -> modules + branding + roles for the current tenant
tenantRouter.get("/config", async (req, res) => {
  const orgId = req.ctx?.orgId;
  if (!orgId) return res.status(403).json({ error: "Sin organización" });

  const rows = await prisma.$queryRaw<OrgRow[]>`
    SELECT name, enabled_modules, logo_url, primary_color, accent_color
    FROM public.organizations WHERE id = ${orgId}::uuid LIMIT 1
  `;
  if (!rows[0]) return res.status(404).json({ error: "Organización no encontrada" });
  const org = rows[0];

  const config: TenantConfig = {
    enabledModules: (org.enabled_modules ?? [
      "events_quotes", "inventory", "suppliers", "crew",
      "ai_assistant", "analytics", "branding",
    ]) as TenantConfig["enabledModules"],
    branding: {
      logoUrl: org.logo_url ?? null,
      primary: org.primary_color ?? "#7C5CFF",
      accent: org.accent_color ?? "#22D3EE",
      name: org.name,
    },
    roles: req.ctx?.roles ?? [],
    isSuperAdmin: req.ctx?.isSuperAdmin ?? false,
  };
  res.json(config);
});
