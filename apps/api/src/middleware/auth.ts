import type { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";
import type { AuthContext, Role } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { ctx?: AuthContext; }
  }
}

type ProfileRow = { organization_id: string | null };
type RoleRow = { role: string };

export async function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const { payload } = await jwtVerify(token, secret);
    const userId = payload.sub as string;

    const [profiles, roleRows] = await Promise.all([
      prisma.$queryRaw<ProfileRow[]>`
        SELECT organization_id FROM public.profiles WHERE id = ${userId}::uuid LIMIT 1
      `,
      prisma.$queryRaw<RoleRow[]>`
        SELECT role FROM public.user_roles WHERE user_id = ${userId}::uuid
      `,
    ]);

    const profile = profiles[0];
    const allRoles = roleRows.map((r: RoleRow) => r.role);
    const isSuperAdmin = allRoles.includes("super_admin");
    const roles = allRoles.filter((r: string) => r !== "super_admin") as Role[];

    req.ctx = {
      userId,
      orgId: profile?.organization_id ?? null,
      roles,
      isSuperAdmin,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
