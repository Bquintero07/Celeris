import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { genJoinCode } from "../lib/codes.js";

export const onboardingRouter = Router();

type StatusRow = { organization_id: string | null };

// GET /api/onboarding/status
onboardingRouter.get("/status", async (req, res) => {
  const userId = req.ctx!.userId;
  const isSuperAdmin = req.ctx!.isSuperAdmin;

  const rows = await prisma.$queryRaw<StatusRow[]>`
    SELECT organization_id FROM public.profiles WHERE id = ${userId}::uuid LIMIT 1
  `;
  const hasOrganization = !!rows[0]?.organization_id;
  res.json({ hasOrganization, isSuperAdmin });
});

// POST /api/onboarding/create-org  { name }
onboardingRouter.post("/create-org", async (req, res) => {
  const userId = req.ctx!.userId;
  const { name } = req.body as { name: string };
  if (!name?.trim()) return res.status(400).json({ error: "El nombre es obligatorio" });

  const joinCode = genJoinCode();

  type OrgRow = { id: string; name: string; join_code: string };
  const rows = await prisma.$queryRaw<OrgRow[]>`
    INSERT INTO public.organizations (name, join_code, primary_color, accent_color, created_by)
    VALUES (${name.trim()}, ${joinCode}, '#7C5CFF', '#22D3EE', ${userId}::uuid)
    RETURNING id, name, join_code
  `;
  const org = rows[0]!;

  await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE public.profiles SET organization_id = ${org.id}::uuid WHERE id = ${userId}::uuid
    `,
    prisma.$executeRaw`
      INSERT INTO public.user_roles (user_id, role, organization_id)
      VALUES (${userId}::uuid, 'admin'::public.app_role, ${org.id}::uuid)
      ON CONFLICT DO NOTHING
    `,
  ]);

  res.status(201).json(org);
});

// POST /api/onboarding/join  { code }
onboardingRouter.post("/join", async (req, res) => {
  const userId = req.ctx!.userId;
  const { code } = req.body as { code: string };
  if (!code?.trim()) return res.status(400).json({ error: "El código es obligatorio" });

  type OrgRow = { id: string; name: string };
  const orgs = await prisma.$queryRaw<OrgRow[]>`
    SELECT id, name FROM public.organizations WHERE join_code = ${code.trim().toUpperCase()} LIMIT 1
  `;
  if (!orgs[0]) return res.status(404).json({ error: "Código de invitación inválido" });
  const org = orgs[0];

  await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE public.profiles SET organization_id = ${org.id}::uuid WHERE id = ${userId}::uuid
    `,
    prisma.$executeRaw`
      INSERT INTO public.user_roles (user_id, role, organization_id)
      VALUES (${userId}::uuid, 'viewer'::public.app_role, ${org.id}::uuid)
      ON CONFLICT DO NOTHING
    `,
  ]);

  res.json(org);
});
