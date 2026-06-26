import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { genJoinCode } from "../lib/codes.js";
import { validate, validateUuidParams, OrgStatus } from "../lib/validate.js";
import { createAuthUser, setUserPassword, deleteAuthUser } from "../lib/supabaseAdmin.js";
import { getAgentConfig } from "../lib/agentConfig.js";

export const superRouter = Router();

function requireSuper(req: any, res: any, next: any) {
  if (!req.ctx?.isSuperAdmin) return res.status(403).json({ error: "Super admin only" });
  next();
}

const createOrgSchema = z.object({
  name:            z.string().min(1, "name is required"),
  slug:            z.string().regex(/^[a-z0-9-]+$/).optional(),
  enabled_modules: z.array(z.string()).optional(),
  status:          OrgStatus.optional(),
});

const updateOrgSchema = z.object({
  name:   z.string().min(1).optional(),
  slug:   z.string().regex(/^[a-z0-9-]+$/).optional(),
  status: OrgStatus.optional(),
});

const modulesSchema = z.object({
  enabled_modules: z.array(z.string()),
});

const toggleModuleSchema = z.object({
  module:  z.string().min(1),
  enabled: z.boolean(),
});

const statusSchema = z.object({
  status: OrgStatus,
});

const assignSchema = z.object({
  user_id:         z.string().uuid(),
  organization_id: z.string().uuid(),
  makeAdmin:       z.boolean().optional(),
});

const grantSchema = z.object({
  user_id: z.string().uuid(),
  grant:   z.boolean(),
});

const createUserSchema = z.object({
  email:           z.string().email(),
  password:        z.string().min(6),
  full_name:       z.string().min(1).optional(),
  organization_id: z.string().uuid().optional(),
  makeAdmin:       z.boolean().optional(),
});

const resetPwSchema = z.object({
  password: z.string().min(6),
});

const agentConfigSchema = z.object({
  model:               z.string().min(1),
  temperature:         z.number().min(0).max(2),
  max_tokens:          z.number().int().positive().nullable().optional(),
  quote_system_prompt: z.string().nullable().optional(),
  plan_system_prompt:  z.string().nullable().optional(),
});

// GET /api/super/check
superRouter.get("/check", (req, res) => {
  res.json(req.ctx?.isSuperAdmin ?? false);
});

// POST /api/super/bootstrap
superRouter.post("/bootstrap", async (req, res) => {
  const userId = req.ctx!.userId;
  const bootstrapped = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('celeris_super_admin_bootstrap'))`;
    const existing = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM public.user_roles WHERE role = 'super_admin'::public.app_role
    `;
    if (Number(existing[0]?.count ?? 0) > 0) return false;
    await tx.$executeRaw`
      INSERT INTO public.user_roles (user_id, role)
      VALUES (${userId}::uuid, 'super_admin'::public.app_role)
      ON CONFLICT DO NOTHING
    `;
    return true;
  });
  if (!bootstrapped) return res.status(403).json({ error: "Super admin already bootstrapped" });
  res.status(204).end();
});

// GET /api/super/orgs
superRouter.get("/orgs", requireSuper, async (_req, res) => {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT o.id, o.name, o.slug, o.join_code, o.primary_color, o.accent_color,
           o.logo_url, o.created_at,
           COALESCE(o.status, 'active') AS status,
           COALESCE(o.enabled_modules, '{}') AS enabled_modules,
           COUNT(p.id)::int AS member_count
    FROM public.organizations o
    LEFT JOIN public.profiles p ON p.organization_id = o.id
    GROUP BY o.id ORDER BY o.created_at DESC
  `;
  res.json(rows);
});

// GET /api/super/orgs/:id
superRouter.get("/orgs/:id", requireSuper, validateUuidParams("id"), async (req, res) => {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT o.id, o.name, o.slug, o.join_code, o.primary_color, o.accent_color,
           o.logo_url, o.created_at, o.status,
           COALESCE(o.enabled_modules, '{}') AS enabled_modules,
           COUNT(p.id)::int AS member_count
    FROM public.organizations o
    LEFT JOIN public.profiles p ON p.organization_id = o.id
    WHERE o.id = ${req.params.id}::uuid
    GROUP BY o.id
  `;
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// POST /api/super/orgs
superRouter.post("/orgs", requireSuper, validate(createOrgSchema), async (req, res) => {
  const { name, slug, enabled_modules, status } = req.body as {
    name: string; slug?: string; enabled_modules?: string[]; status?: string;
  };
  const joinCode = genJoinCode();
  const orgSlug = slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const modules = enabled_modules ?? ["events_quotes"];
  const orgStatus = status ?? "active";

  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO public.organizations
      (name, slug, join_code, primary_color, accent_color, enabled_modules, status, created_by)
    VALUES (
      ${name}, ${orgSlug}, ${joinCode}, '#7C5CFF', '#22D3EE',
      ${modules}::text[], ${orgStatus}, ${req.ctx!.userId}::uuid
    )
    RETURNING *
  `;
  res.status(201).json(rows[0]);
});

// PATCH /api/super/orgs/:id
superRouter.patch("/orgs/:id", requireSuper, validateUuidParams("id"), validate(updateOrgSchema), async (req, res) => {
  const { name, slug, status } = req.body as {
    name?: string; slug?: string; status?: string;
  };
  const rows = await prisma.$queryRaw<any[]>`
    UPDATE public.organizations SET
      name   = COALESCE(${name ?? null},   name),
      slug   = COALESCE(${slug ?? null},   slug),
      status = COALESCE(${status ?? null}, status)
    WHERE id = ${req.params.id}::uuid
    RETURNING *
  `;
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// PATCH /api/super/orgs/:id/modules
superRouter.patch("/orgs/:id/modules", requireSuper, validateUuidParams("id"), validate(modulesSchema), async (req, res) => {
  const modules: string[] = req.body.enabled_modules;
  const rows = await prisma.$queryRaw<any[]>`
    UPDATE public.organizations
    SET enabled_modules = ${modules}::text[]
    WHERE id = ${req.params.id}::uuid
    RETURNING id, name, enabled_modules
  `;
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// PATCH /api/super/orgs/:id/modules/toggle
superRouter.patch("/orgs/:id/modules/toggle", requireSuper, validateUuidParams("id"), validate(toggleModuleSchema), async (req, res) => {
  const { module, enabled } = req.body as { module: string; enabled: boolean };
  let rows: any[];
  if (enabled) {
    rows = await prisma.$queryRaw<any[]>`
      UPDATE public.organizations
      SET enabled_modules = array_append(
        COALESCE(enabled_modules, '{}'),
        ${module}
      )
      WHERE id = ${req.params.id}::uuid
        AND NOT (${module} = ANY(COALESCE(enabled_modules, '{}')))
      RETURNING id, name, enabled_modules
    `;
    if (!rows[0]) {
      rows = await prisma.$queryRaw<any[]>`
        SELECT id, name, enabled_modules FROM public.organizations WHERE id = ${req.params.id}::uuid
      `;
    }
  } else {
    rows = await prisma.$queryRaw<any[]>`
      UPDATE public.organizations
      SET enabled_modules = array_remove(COALESCE(enabled_modules, '{}'), ${module})
      WHERE id = ${req.params.id}::uuid
      RETURNING id, name, enabled_modules
    `;
  }
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// PATCH /api/super/orgs/:id/status
superRouter.patch("/orgs/:id/status", requireSuper, validateUuidParams("id"), validate(statusSchema), async (req, res) => {
  const { status } = req.body as { status: string };
  const rows = await prisma.$queryRaw<any[]>`
    UPDATE public.organizations SET status = ${status}
    WHERE id = ${req.params.id}::uuid
    RETURNING id, name, status
  `;
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// GET /api/super/users
superRouter.get("/users", requireSuper, async (_req, res) => {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT p.id, p.full_name, p.email, p.avatar_url, p.organization_id, o.name AS org_name,
           COALESCE(array_agg(ur.role::text) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
    FROM public.profiles p
    LEFT JOIN public.organizations o ON o.id = p.organization_id
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    GROUP BY p.id, p.full_name, p.email, p.avatar_url, p.organization_id, o.name
    ORDER BY p.full_name
  `;
  res.json(rows);
});

// POST /api/super/assign
superRouter.post("/assign", requireSuper, validate(assignSchema), async (req, res) => {
  const { user_id, organization_id, makeAdmin } = req.body;
  const role = makeAdmin ? "admin" : "viewer";

  await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE public.profiles SET organization_id = ${organization_id}::uuid WHERE id = ${user_id}::uuid
    `,
    prisma.$executeRaw`
      INSERT INTO public.user_roles (user_id, role, organization_id)
      VALUES (${user_id}::uuid, ${role}::public.app_role, ${organization_id}::uuid)
      ON CONFLICT DO NOTHING
    `,
  ]);
  res.status(204).end();
});

// POST /api/super/grant
superRouter.post("/grant", requireSuper, validate(grantSchema), async (req, res) => {
  const { user_id, grant } = req.body as { user_id: string; grant: boolean };
  if (grant) {
    await prisma.$executeRaw`
      INSERT INTO public.user_roles (user_id, role)
      VALUES (${user_id}::uuid, 'super_admin'::public.app_role)
      ON CONFLICT DO NOTHING
    `;
  } else {
    await prisma.$executeRaw`
      DELETE FROM public.user_roles
      WHERE user_id = ${user_id}::uuid AND role = 'super_admin'::public.app_role
    `;
  }
  res.status(204).end();
});

// DELETE /api/super/orgs/:id
superRouter.delete("/orgs/:id", requireSuper, validateUuidParams("id"), async (req, res) => {
  await prisma.$executeRaw`DELETE FROM public.organizations WHERE id = ${req.params.id}::uuid`;
  res.status(204).end();
});

// GET /api/super/orgs/:id/detail — read-only diagnostics: members + data counts
superRouter.get("/orgs/:id/detail", requireSuper, validateUuidParams("id"), async (req, res) => {
  const id = req.params.id;
  const orgRows = await prisma.$queryRaw<any[]>`
    SELECT id, name, slug, join_code, primary_color, accent_color, logo_url,
           created_at, COALESCE(status, 'active') AS status,
           COALESCE(enabled_modules, '{}') AS enabled_modules
    FROM public.organizations WHERE id = ${id}::uuid
  `;
  if (!orgRows[0]) return res.status(404).json({ error: "Not found" });

  const members = await prisma.$queryRaw<any[]>`
    SELECT p.id, p.full_name, p.email, p.avatar_url,
           COALESCE(array_agg(ur.role::text) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.organization_id = ${id}::uuid
    WHERE p.organization_id = ${id}::uuid
    GROUP BY p.id, p.full_name, p.email, p.avatar_url
    ORDER BY p.full_name
  `;

  const counts = await prisma.$queryRaw<any[]>`
    SELECT
      (SELECT COUNT(*)::int FROM public.events    WHERE organization_id = ${id}::uuid) AS events,
      (SELECT COUNT(*)::int FROM public.equipment WHERE organization_id = ${id}::uuid) AS equipment,
      (SELECT COUNT(*)::int FROM public.personnel WHERE organization_id = ${id}::uuid) AS personnel,
      (SELECT COUNT(*)::int FROM public.suppliers WHERE organization_id = ${id}::uuid) AS suppliers,
      (SELECT COUNT(*)::int FROM public.clients   WHERE organization_id = ${id}::uuid) AS clients
  `;

  res.json({ org: orgRows[0], members, counts: counts[0] ?? {} });
});

// POST /api/super/users — create an auth user (optionally attach to an org)
superRouter.post("/users", requireSuper, validate(createUserSchema), async (req, res) => {
  const { email, password, full_name, organization_id, makeAdmin } = req.body as z.infer<typeof createUserSchema>;
  let user;
  try {
    user = await createAuthUser({ email, password, full_name });
  } catch (e: any) {
    return res.status(e.status ?? 500).json({ error: e.message ?? "Could not create user" });
  }
  if (organization_id) {
    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE public.profiles SET organization_id = ${organization_id}::uuid WHERE id = ${user.id}::uuid
      `,
      prisma.$executeRaw`
        INSERT INTO public.user_roles (user_id, role, organization_id)
        VALUES (${user.id}::uuid, ${makeAdmin ? "admin" : "viewer"}::public.app_role, ${organization_id}::uuid)
        ON CONFLICT DO NOTHING
      `,
    ]);
  }
  res.status(201).json({ id: user.id, email: user.email });
});

// POST /api/super/users/:id/reset-password
superRouter.post("/users/:id/reset-password", requireSuper, validateUuidParams("id"), validate(resetPwSchema), async (req, res) => {
  try {
    await setUserPassword(String(req.params.id), (req.body as z.infer<typeof resetPwSchema>).password);
  } catch (e: any) {
    return res.status(e.status ?? 500).json({ error: e.message ?? "Could not reset password" });
  }
  res.status(204).end();
});

// DELETE /api/super/users/:id — removes auth user (profiles/user_roles cascade)
superRouter.delete("/users/:id", requireSuper, validateUuidParams("id"), async (req, res) => {
  if (req.params.id === req.ctx!.userId) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }
  try {
    await deleteAuthUser(String(req.params.id));
  } catch (e: any) {
    return res.status(e.status ?? 500).json({ error: e.message ?? "Could not delete user" });
  }
  res.status(204).end();
});

// GET /api/super/agent/config
superRouter.get("/agent/config", requireSuper, async (_req, res) => {
  res.json(await getAgentConfig());
});

// PUT /api/super/agent/config
superRouter.put("/agent/config", requireSuper, validate(agentConfigSchema), async (req, res) => {
  const c = req.body as z.infer<typeof agentConfigSchema>;
  await prisma.$executeRaw`
    INSERT INTO public.agent_config
      (id, model, temperature, max_tokens, quote_system_prompt, plan_system_prompt, updated_at, updated_by)
    VALUES (1, ${c.model}, ${c.temperature}, ${c.max_tokens ?? null},
            ${c.quote_system_prompt ?? null}, ${c.plan_system_prompt ?? null}, now(), ${req.ctx!.userId}::uuid)
    ON CONFLICT (id) DO UPDATE SET
      model = EXCLUDED.model, temperature = EXCLUDED.temperature, max_tokens = EXCLUDED.max_tokens,
      quote_system_prompt = EXCLUDED.quote_system_prompt, plan_system_prompt = EXCLUDED.plan_system_prompt,
      updated_at = now(), updated_by = EXCLUDED.updated_by
  `;
  res.json(await getAgentConfig());
});

// GET /api/super/agent/health — proxy the Python agent's health probe
superRouter.get("/agent/health", requireSuper, async (_req, res) => {
  const agentUrl = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
  try {
    const r = await fetch(`${agentUrl}/health`, { signal: AbortSignal.timeout(4000) });
    res.json({ ok: r.ok });
  } catch {
    res.json({ ok: false });
  }
});
