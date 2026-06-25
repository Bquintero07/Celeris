/**
 * Middleware unit tests
 * Tests: requireModule() gating, requirePermission() RBAC, super_admin bypasses
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// vi.hoisted ensures variables are available when the vi.mock factory runs
const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: { $queryRaw: mockQueryRaw },
}));

const { requireModule }     = await import("../middleware/module.js");
const { requirePermission } = await import("../middleware/rbac.js");

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(ctx: Partial<Request["ctx"]> = {}): Partial<Request> {
  return {
    ctx: { userId: "u1", orgId: "org-1", roles: [], isSuperAdmin: false, ...ctx } as any,
  };
}

function makeRes() {
  let capturedStatus: number | null = null;
  let capturedJson: any = null;
  const res: any = {
    status: (s: number) => { capturedStatus = s; return res; },
    json:   (j: any)    => { capturedJson   = j; return res; },
    get capturedStatus() { return capturedStatus; },
    get capturedJson()   { return capturedJson; },
  };
  return res;
}

// ── requireModule ──────────────────────────────────────────────────────────────

describe("requireModule()", () => {
  beforeEach(() => mockQueryRaw.mockReset());

  it("bypasses for super_admin without DB call", async () => {
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: true });
    await requireModule("analytics")(req as any, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("allows request when module is in enabled_modules", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ enabled_modules: ["events_quotes", "analytics"] }]);
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: false, orgId: "org-1" });
    await requireModule("analytics")(req as any, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("blocks with 403 when module is NOT in enabled_modules", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ enabled_modules: ["events_quotes"] }]);
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: false, orgId: "org-1" });
    const res  = makeRes();
    await requireModule("analytics")(req as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.capturedStatus).toBe(403);
  });

  it("blocks with 403 when org has empty enabled_modules", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ enabled_modules: [] }]);
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: false, orgId: "org-1" });
    const res  = makeRes();
    await requireModule("analytics")(req as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.capturedStatus).toBe(403);
  });

  it("blocks with 403 when org row not found", async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: false, orgId: "org-1" });
    const res  = makeRes();
    await requireModule("events_quotes")(req as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.capturedStatus).toBe(403);
  });

  it("blocks with 403 when orgId is missing from context", async () => {
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: false, orgId: undefined as any });
    const res  = makeRes();
    await requireModule("events_quotes")(req as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.capturedStatus).toBe(403);
  });
});

// ── requirePermission ──────────────────────────────────────────────────────────

describe("requirePermission()", () => {
  it("bypasses for super_admin", () => {
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: true, roles: [] });
    const res  = makeRes();
    requirePermission("quotes.view_margin")(req as any, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.capturedStatus).toBeNull();
  });

  it("allows admin to do anything", () => {
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: false, roles: ["admin"] });
    requirePermission("quotes.view_margin")(req as any, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("allows comercial to view margin", () => {
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: false, roles: ["comercial"] });
    requirePermission("quotes.view_margin")(req as any, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("blocks logistica from viewing margin", () => {
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: false, roles: ["logistica"] });
    const res  = makeRes();
    requirePermission("quotes.view_margin")(req as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.capturedStatus).toBe(403);
  });

  it("blocks personal from accessing quotes", () => {
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: false, roles: ["personal"] });
    const res  = makeRes();
    requirePermission("quotes.view")(req as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.capturedStatus).toBe(403);
  });

  it("allows contable to view_margin", () => {
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: false, roles: ["contable"] });
    requirePermission("quotes.view_margin")(req as any, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("blocks user with no roles", () => {
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: false, roles: [] });
    const res  = makeRes();
    requirePermission("events.view")(req as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.capturedStatus).toBe(403);
  });

  it("multi-role: logistica + contable can export", () => {
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: false, roles: ["logistica", "contable"] as any });
    requirePermission("quotes.export")(req as any, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("personal cannot approve events", () => {
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: false, roles: ["personal"] });
    const res  = makeRes();
    requirePermission("events.approve")(req as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.capturedStatus).toBe(403);
  });

  it("viewer cannot create events", () => {
    const next = vi.fn();
    const req  = makeReq({ isSuperAdmin: false, roles: ["viewer"] });
    const res  = makeRes();
    requirePermission("events.create")(req as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.capturedStatus).toBe(403);
  });
});
