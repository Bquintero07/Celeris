/**
 * Multi-tenant isolation tests
 *
 * Strategy: mock Prisma, inject AuthContext with a specific orgId, then verify
 * that every DB call includes that orgId as a parameter — never a different one.
 *
 * This guards against accidental removal of the organization_id filter.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthContext, Role } from "@celeris/shared";

// ── Mock prisma before importing services ─────────────────────────────────────
const mockQueryRaw   = vi.fn().mockResolvedValue([]);
const mockExecuteRaw = vi.fn().mockResolvedValue(BigInt(1));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    $queryRaw:   (...args: any[]) => mockQueryRaw(...args),
    $executeRaw: (...args: any[]) => mockExecuteRaw(...args),
  },
}));

// ── Import services after mock ────────────────────────────────────────────────
const equipSvc    = await import("../services/equipment.service.js");
const supplierSvc = await import("../services/suppliers.service.js");
const personnelSvc = await import("../services/personnel.service.js");
const clientSvc   = await import("../services/clients.service.js");
const analyticsSvc = await import("../services/analytics.service.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function ctx(orgId: string, roles: Role[] = ["admin"]): AuthContext {
  return { userId: "user-1", orgId, roles, isSuperAdmin: false };
}

/**
 * Extract all interpolated values from tagged-template-literal calls to
 * prisma.$queryRaw. In Vitest, a call `$queryRaw\`... ${val} ...\`` registers as
 * $queryRaw(templateParts, val) where templateParts is a TemplateStringsArray.
 * We capture every non-TemplateStringsArray argument across all calls.
 */
function capturedParams(): any[] {
  const params: any[] = [];
  for (const call of [...mockQueryRaw.mock.calls, ...mockExecuteRaw.mock.calls]) {
    // call[0] is TemplateStringsArray, call[1..] are interpolated values
    for (let i = 1; i < call.length; i++) {
      params.push(call[i]);
    }
  }
  return params;
}

function resetMocks() {
  mockQueryRaw.mockReset().mockResolvedValue([]);
  mockExecuteRaw.mockReset().mockResolvedValue(BigInt(1));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Multi-tenant isolation — services always filter by orgId", () => {
  beforeEach(resetMocks);

  describe("equipment.service", () => {
    it("list() passes orgId as parameter", async () => {
      await equipSvc.list(ctx(ORG_A));
      const params = capturedParams();
      expect(params).toContain(ORG_A);
      expect(params).not.toContain(ORG_B);
    });

    it("upsert() (insert) passes orgId", async () => {
      await equipSvc.upsert(ctx(ORG_A), { name: "Speaker", category: "audio_video", quantity: 1, unit_cost: 100 });
      const params = capturedParams();
      expect(params).toContain(ORG_A);
    });

    it("remove() passes orgId so cross-org delete is impossible", async () => {
      await equipSvc.remove(ctx(ORG_A), "item-id-1");
      const params = capturedParams();
      expect(params).toContain(ORG_A);
      expect(params).not.toContain(ORG_B);
    });
  });

  describe("suppliers.service", () => {
    it("list() passes orgId", async () => {
      await supplierSvc.list(ctx(ORG_A));
      expect(capturedParams()).toContain(ORG_A);
    });

    it("remove() scopes to orgId", async () => {
      await supplierSvc.remove(ctx(ORG_A), "sup-id");
      expect(capturedParams()).toContain(ORG_A);
    });
  });

  describe("personnel.service", () => {
    it("list() passes orgId", async () => {
      await personnelSvc.list(ctx(ORG_A));
      expect(capturedParams()).toContain(ORG_A);
    });

    it("remove() scopes to orgId", async () => {
      await personnelSvc.remove(ctx(ORG_A), "person-id");
      expect(capturedParams()).toContain(ORG_A);
    });
  });

  describe("clients.service", () => {
    it("list() passes orgId", async () => {
      await clientSvc.list(ctx(ORG_A));
      expect(capturedParams()).toContain(ORG_A);
    });

    it("upsert() (insert) passes orgId", async () => {
      await clientSvc.upsert(ctx(ORG_A), { name: "ACME" });
      expect(capturedParams()).toContain(ORG_A);
    });

    it("remove() scopes to orgId", async () => {
      await clientSvc.remove(ctx(ORG_A), "client-id");
      expect(capturedParams()).toContain(ORG_A);
    });
  });

  describe("analytics.service", () => {
    it("marginsByEvent() passes orgId", async () => {
      await analyticsSvc.marginsByEvent(ctx(ORG_A));
      expect(capturedParams()).toContain(ORG_A);
    });

    it("marginsByClient() passes orgId", async () => {
      await analyticsSvc.marginsByClient(ctx(ORG_A));
      expect(capturedParams()).toContain(ORG_A);
    });

    it("revenueByPeriod() passes orgId", async () => {
      await analyticsSvc.revenueByPeriod(ctx(ORG_A));
      expect(capturedParams()).toContain(ORG_A);
    });
  });

  describe("cross-org isolation proof", () => {
    it("orgA calls never include orgB params", async () => {
      await equipSvc.list(ctx(ORG_A));
      await clientSvc.list(ctx(ORG_A));
      const params = capturedParams();
      expect(params).toContain(ORG_A);
      expect(params.filter((p) => p === ORG_B)).toHaveLength(0);
    });

    it("orgB calls never include orgA params", async () => {
      await equipSvc.list(ctx(ORG_B));
      await supplierSvc.list(ctx(ORG_B));
      const params = capturedParams();
      expect(params).toContain(ORG_B);
      expect(params.filter((p) => p === ORG_A)).toHaveLength(0);
    });
  });
});
