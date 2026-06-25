import type { NextFunction, Request, Response } from "express";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { AuthContext, Role } from "@celeris/shared";
import { prisma } from "../lib/prisma.js";

const supabaseUrl = process.env.SUPABASE_URL!;
const JWKS = createRemoteJWKSet(
  new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
);

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

    const { payload } = await jwtVerify(token, JWKS);
    const userId = payload.sub as string;

    const profiles = await prisma.$queryRaw<ProfileRow[]>`
      SELECT organization_id FROM public.profiles WHERE id = ${userId}::uuid LIMIT 1
    `;
    const roleRows = await prisma.$queryRaw<RoleRow[]>`
      SELECT role FROM public.user_roles WHERE user_id = ${userId}::uuid
    `;

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
  } catch (err) {
    console.error("[auth] token error:", err);
    return res.status(401).json({ error: "Invalid token" });
  }
}
