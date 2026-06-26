import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate, validateUuidParams, AppRole } from "../lib/validate.js";

export const teamRouter = Router();

const rolesSchema = z.object({
  user_id: z.string().uuid(),
  role:    AppRole,
  action:  z.enum(["add", "remove"]),
});

// GET /api/team  — users in the org with their roles
teamRouter.get("/", async (req, res) => {
  const orgId = req.ctx?.orgId;
  if (!orgId) return res.status(403).json({ error: "No organization" });

  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      p.id, p.full_name, p.email, p.avatar_url,
      COALESCE(
        array_agg(ur.role::text) FILTER (WHERE ur.role IS NOT NULL),
        '{}'::text[]
      ) AS roles
    FROM public.profiles p
    LEFT JOIN public.user_roles ur
      ON ur.user_id = p.id AND ur.organization_id = ${orgId}::uuid
    WHERE p.organization_id = ${orgId}::uuid
    GROUP BY p.id, p.full_name, p.email, p.avatar_url
    ORDER BY p.full_name
  `;
  res.json(rows);
});

// POST /api/team/roles  { user_id, role, action: 'add'|'remove' }
teamRouter.post("/roles", validate(rolesSchema), async (req, res) => {
  const orgId = req.ctx?.orgId;
  if (!orgId) return res.status(403).json({ error: "No organization" });
  if (!req.ctx?.isSuperAdmin && !req.ctx?.roles.includes("admin")) {
    return res.status(403).json({ error: "Admin only" });
  }

  const { user_id, role, action } = req.body as {
    user_id: string; role: string; action: "add" | "remove";
  };

  if (action === "add") {
    await prisma.$executeRaw`
      INSERT INTO public.user_roles (user_id, role, organization_id)
      VALUES (${user_id}::uuid, ${role}::public.app_role, ${orgId}::uuid)
      ON CONFLICT DO NOTHING
    `;
  } else {
    await prisma.$executeRaw`
      DELETE FROM public.user_roles
      WHERE user_id = ${user_id}::uuid AND role = ${role}::public.app_role
        AND organization_id = ${orgId}::uuid
    `;
  }
  res.status(204).end();
});

// GET /api/team/join-code
teamRouter.get("/join-code", async (req, res) => {
  const orgId = req.ctx?.orgId;
  if (!orgId) return res.status(403).json({ error: "No organization" });
  if (!req.ctx?.isSuperAdmin && !req.ctx?.roles.includes("admin")) {
    return res.status(403).json({ error: "Admin only" });
  }

  const rows = await prisma.$queryRaw<{ join_code: string; name: string }[]>`
    SELECT join_code, name FROM public.organizations WHERE id = ${orgId}::uuid LIMIT 1
  `;
  if (!rows[0]) return res.status(404).json({ error: "Organization not found" });
  res.json({ join_code: rows[0].join_code, name: rows[0].name });
});
