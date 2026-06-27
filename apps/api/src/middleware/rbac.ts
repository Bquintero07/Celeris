import type { NextFunction, Request, Response } from "express";
import { can } from "@celeris/shared";

/** Ensures the caller's roles grant the given permission. Super admin bypasses all checks. */
export function requirePermission(perm: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.ctx?.isSuperAdmin) return next();
    const roles = req.ctx?.roles ?? [];
    if (!can(roles, perm)) return res.status(403).json({ error: "Prohibido" });
    next();
  };
}
