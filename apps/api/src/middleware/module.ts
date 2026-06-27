import type { NextFunction, Request, Response } from "express";
import type { ModuleKey } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

type OrgRow = { enabled_modules: string[] | null };

export function requireModule(moduleKey: ModuleKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.ctx?.isSuperAdmin) return next();
    const orgId = req.ctx?.orgId;
    if (!orgId) return res.status(403).json({ error: "Sin organización" });

    const rows = await prisma.$queryRaw<OrgRow[]>`
      SELECT enabled_modules FROM public.organizations WHERE id = ${orgId}::uuid LIMIT 1
    `;
    const enabled = (rows[0]?.enabled_modules ?? []) as string[];
    if (!enabled.includes(moduleKey)) {
      return res.status(403).json({ error: `Module ${moduleKey} not enabled` });
    }
    next();
  };
}
