import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const rolesRouter = Router();

// GET /api/roles/mine
rolesRouter.get("/mine", async (req, res) => {
  const userId = req.ctx!.userId;
  const rows = await prisma.$queryRaw<{ role: string }[]>`
    SELECT role FROM public.user_roles WHERE user_id = ${userId}::uuid
  `;
  const roles = rows.map((r: { role: string }) => r.role);
  res.json(roles);
});
