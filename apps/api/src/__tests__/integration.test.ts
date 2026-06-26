/**
 * DB Integration Tests
 *
 * These tests hit the real Supabase database — no Prisma mocks.
 * They run sequentially (pgbouncer connection_limit=1).
 *
 * Requirements:
 *   - DATABASE_URL env var must point to a live DB
 *   - "Agencia Grande Demo" org (ORG_ID) must exist
 *
 * Each suite cleans up the rows it creates.
 */
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../lib/prisma.js";
import * as clientSvc   from "../services/clients.service.js";
import * as equipSvc    from "../services/equipment.service.js";
import * as supplierSvc from "../services/suppliers.service.js";
import * as personnelSvc from "../services/personnel.service.js";
import type { AuthContext } from "@celeris/shared";

const ORG_A = "496d28b8-6424-42d4-bda2-0c2011fb3c9d"; // Agencia Grande Demo
const ORG_B = "190c6d68-8a44-4456-be17-916ebd771bdf"; // Micro Productora Demo

// Real user from auth.users (admin@agencia-grande.demo)
const ctxA: AuthContext = { userId: "6a71449c-fcce-4974-93f2-9478eae7fc4f", orgId: ORG_A, roles: ["admin"], isSuperAdmin: false };
const ctxB: AuthContext = { ...ctxA, orgId: ORG_B };

afterAll(async () => {
  await prisma.$disconnect();
});

// ── Clients ───────────────────────────────────────────────────────────────────

describe("clients — real DB", () => {
  let createdId: string;

  it("creates a client and it appears in the list", async () => {
    const row = await clientSvc.upsert(ctxA, { name: "__integration_client__" });
    createdId = row.id;
    expect(createdId).toMatch(/^[0-9a-f-]{36}$/);

    const list = await clientSvc.list(ctxA);
    expect(list.some((c: any) => c.id === createdId)).toBe(true);
  });

  it("updates the client name", async () => {
    await clientSvc.upsert(ctxA, { id: createdId, name: "__updated_client__" });
    const list = await clientSvc.list(ctxA);
    const row  = list.find((c: any) => c.id === createdId);
    expect(row?.name).toBe("__updated_client__");
  });

  it("org B cannot see org A's client (tenant isolation)", async () => {
    const other = await clientSvc.list(ctxB);
    expect(other.some((c: any) => c.id === createdId)).toBe(false);
  });

  it("deletes the client", async () => {
    await clientSvc.remove(ctxA, createdId);
    const list = await clientSvc.list(ctxA);
    expect(list.some((c: any) => c.id === createdId)).toBe(false);
  });
});

// ── Equipment ─────────────────────────────────────────────────────────────────

describe("equipment — real DB", () => {
  let createdId: string;

  it("creates equipment and it appears in the list", async () => {
    const row = await equipSvc.upsert(ctxA, {
      name: "__integration_gear__",
      category: "audio_video",
      quantity: 2,
      unit_cost: 50000,
      condition: null,
      location: null,
      notes: null,
    });
    createdId = row.id;
    expect(createdId).toMatch(/^[0-9a-f-]{36}$/);

    const list = await equipSvc.list(ctxA);
    expect(list.some((e: any) => e.id === createdId)).toBe(true);
  });

  it("updates equipment quantity via upsert", async () => {
    await equipSvc.upsert(ctxA, {
      id: createdId,
      name: "__integration_gear__",
      category: "audio_video",
      quantity: 7,
      unit_cost: 50000,
      condition: null,
      location: null,
      notes: null,
    });
    const list = await equipSvc.list(ctxA);
    const row  = list.find((e: any) => e.id === createdId);
    expect(Number(row?.quantity)).toBe(7);
  });

  it("org B cannot see org A's equipment (tenant isolation)", async () => {
    const other = await equipSvc.list(ctxB);
    expect(other.some((e: any) => e.id === createdId)).toBe(false);
  });

  it("deletes equipment", async () => {
    await equipSvc.remove(ctxA, createdId);
    const list = await equipSvc.list(ctxA);
    expect(list.some((e: any) => e.id === createdId)).toBe(false);
  });
});

// ── Suppliers ─────────────────────────────────────────────────────────────────

describe("suppliers — real DB", () => {
  let createdId: string;

  it("creates a supplier and it appears in the list", async () => {
    const row = await supplierSvc.upsert(ctxA, {
      name: "__integration_supplier__",
      type: "externo",
      category: null,
      contact_name: null,
      email: null,
      phone: null,
      website: null,
      rating: null,
      notes: null,
    });
    createdId = row.id;
    expect(createdId).toMatch(/^[0-9a-f-]{36}$/);

    const list = await supplierSvc.list(ctxA);
    expect(list.some((s: any) => s.id === createdId)).toBe(true);
  });

  it("org B cannot see org A's supplier (tenant isolation)", async () => {
    const other = await supplierSvc.list(ctxB);
    expect(other.some((s: any) => s.id === createdId)).toBe(false);
  });

  it("deletes the supplier", async () => {
    await supplierSvc.remove(ctxA, createdId);
    const list = await supplierSvc.list(ctxA);
    expect(list.some((s: any) => s.id === createdId)).toBe(false);
  });
});

// ── Personnel ─────────────────────────────────────────────────────────────────

describe("personnel — real DB", () => {
  let createdId: string;

  it("creates a person and they appear in the list", async () => {
    const row = await personnelSvc.upsert(ctxA, {
      full_name: "__integration_person__",
      role: null,
      skills: [],
      available: true,
      hourly_rate: null,
      email: null,
      phone: null,
      notes: null,
    });
    createdId = row.id;
    expect(createdId).toMatch(/^[0-9a-f-]{36}$/);

    const list = await personnelSvc.list(ctxA);
    expect(list.some((p: any) => p.id === createdId)).toBe(true);
  });

  it("org B cannot see org A's personnel (tenant isolation)", async () => {
    const other = await personnelSvc.list(ctxB);
    expect(other.some((p: any) => p.id === createdId)).toBe(false);
  });

  it("deletes the person", async () => {
    await personnelSvc.remove(ctxA, createdId);
    const list = await personnelSvc.list(ctxA);
    expect(list.some((p: any) => p.id === createdId)).toBe(false);
  });
});
