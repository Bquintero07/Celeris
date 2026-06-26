/**
 * Input validation middleware — validate() and validateUuidParams()
 * Tests: required fields, enum values, type coercion rejection, UUID params,
 *        unknown-field stripping, nested arrays, multi-param UUID checks.
 */
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  validate,
  validateUuidParams,
  EventType,
  EventStatus,
  ItemCategory,
  SupplierType,
  AppRole,
  OrgStatus,
} from "../lib/validate.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(body: unknown = {}, params: Record<string, string> = {}): any {
  return { body, params };
}

function makeRes() {
  let status: number | null = null;
  let json: any = null;
  const res: any = {
    status: (s: number) => { status = s; return res; },
    json:   (j: any)    => { json   = j; return res; },
    get capturedStatus() { return status; },
    get capturedJson()   { return json; },
  };
  return res;
}

// ── validate() ─────────────────────────────────────────────────────────────────

describe("validate()", () => {
  const schema = z.object({
    title:    z.string().min(1, "title is required"),
    budget:   z.number().nonnegative().optional(),
    status:   z.enum(["borrador", "confirmado"]).optional(),
  });

  it("calls next() and passes when body is valid", () => {
    const next = vi.fn();
    const req  = makeReq({ title: "Mi Evento", budget: 1000 });
    validate(schema)(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("returns 400 with field-level issues when a required field is missing", () => {
    const next = vi.fn();
    const res  = makeRes();
    validate(schema)(makeReq({}), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.capturedStatus).toBe(400);
    expect(res.capturedJson.error).toBe("Validation failed");
    expect(res.capturedJson.issues[0].field).toBe("title");
    // Zod emits "Required" when the field is absent; the custom message fires on empty string
    expect(res.capturedJson.issues[0].message).toBe("Required");
  });

  it("returns 400 with the custom message when a required field is an empty string", () => {
    const next = vi.fn();
    const res  = makeRes();
    validate(schema)(makeReq({ title: "" }), res, next);
    expect(res.capturedStatus).toBe(400);
    expect(res.capturedJson.issues[0].field).toBe("title");
    expect(res.capturedJson.issues[0].message).toBe("title is required");
  });

  it("returns 400 when enum value is invalid, listing accepted values in the message", () => {
    const next = vi.fn();
    const res  = makeRes();
    validate(schema)(makeReq({ title: "X", status: "en_progreso" }), res, next);
    expect(res.capturedStatus).toBe(400);
    const issue = res.capturedJson.issues[0];
    expect(issue.field).toBe("status");
    expect(issue.message).toMatch(/borrador/);
    expect(issue.message).toMatch(/confirmado/);
  });

  it("returns 400 when a number field receives a string", () => {
    const next = vi.fn();
    const res  = makeRes();
    validate(schema)(makeReq({ title: "X", budget: "mucho" }), res, next);
    expect(res.capturedStatus).toBe(400);
    expect(res.capturedJson.issues[0].field).toBe("budget");
  });

  it("returns 400 when budget is negative", () => {
    const next = vi.fn();
    const res  = makeRes();
    validate(schema)(makeReq({ title: "X", budget: -1 }), res, next);
    expect(res.capturedStatus).toBe(400);
    expect(res.capturedJson.issues[0].field).toBe("budget");
  });

  it("strips unknown fields from req.body after validation", () => {
    const next = vi.fn();
    const req  = makeReq({ title: "X", injected_field: "malicious" });
    validate(schema)(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.body).not.toHaveProperty("injected_field");
    expect(req.body.title).toBe("X");
  });

  it("replaces req.body with the parsed (coerced) data", () => {
    const next = vi.fn();
    const req  = makeReq({ title: "  Mi Evento  ", budget: 500 });
    validate(schema)(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ title: "  Mi Evento  ", budget: 500 });
  });
});

// ── validate() — nested array schema ──────────────────────────────────────────

describe("validate() — nested items array", () => {
  const bulkSchema = z.object({
    items: z.array(z.object({ name: z.string().min(1) })).min(1),
  });

  it("accepts a valid items array", () => {
    const next = vi.fn();
    validate(bulkSchema)(makeReq({ items: [{ name: "Escenario" }] }), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 400 when items is not an array", () => {
    const next = vi.fn();
    const res  = makeRes();
    validate(bulkSchema)(makeReq({ items: "not-array" }), res, next);
    expect(res.capturedStatus).toBe(400);
  });

  it("returns 400 with dotted path (items.0.name) when a nested field is invalid", () => {
    const next = vi.fn();
    const res  = makeRes();
    validate(bulkSchema)(makeReq({ items: [{ name: "" }] }), res, next);
    expect(res.capturedStatus).toBe(400);
    expect(res.capturedJson.issues[0].field).toBe("items.0.name");
  });

  it("returns 400 when items array is empty", () => {
    const next = vi.fn();
    const res  = makeRes();
    validate(bulkSchema)(makeReq({ items: [] }), res, next);
    expect(res.capturedStatus).toBe(400);
  });
});

// ── validateUuidParams() ───────────────────────────────────────────────────────

describe("validateUuidParams()", () => {
  const VALID_UUID   = "550e8400-e29b-41d4-a716-446655440000";
  const INVALID_UUID = "no-es-uuid";

  it("calls next() when a single param is a valid UUID", () => {
    const next = vi.fn();
    validateUuidParams("id")(makeReq({}, { id: VALID_UUID }), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 400 with the param name when the UUID is invalid", () => {
    const next = vi.fn();
    const res  = makeRes();
    validateUuidParams("id")(makeReq({}, { id: INVALID_UUID }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.capturedStatus).toBe(400);
    expect(res.capturedJson.error).toMatch(/id/);
    expect(res.capturedJson.error).toMatch(/UUID/);
  });

  it("validates multiple params and passes when all are valid UUIDs", () => {
    const next = vi.fn();
    validateUuidParams("id", "eventId")(
      makeReq({}, { id: VALID_UUID, eventId: VALID_UUID }),
      makeRes(),
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 400 naming the specific invalid param when one of many is bad", () => {
    const next = vi.fn();
    const res  = makeRes();
    validateUuidParams("id", "eventId")(
      makeReq({}, { id: VALID_UUID, eventId: INVALID_UUID }),
      res,
      next,
    );
    expect(res.capturedStatus).toBe(400);
    expect(res.capturedJson.error).toMatch(/eventId/);
  });

  it("returns 400 on a numeric string that is not a UUID", () => {
    const next = vi.fn();
    const res  = makeRes();
    validateUuidParams("id")(makeReq({}, { id: "12345" }), res, next);
    expect(res.capturedStatus).toBe(400);
  });
});

// ── DB enum schemas ────────────────────────────────────────────────────────────

describe("EventType enum — matches public.event_type in DB", () => {
  const valid = ["concierto", "charla", "exposicion", "privado", "publico", "corporativo", "boda", "otro"];
  it.each(valid)("accepts '%s'", (v) => expect(EventType.safeParse(v).success).toBe(true));
  it("rejects English values like 'concert'", () => expect(EventType.safeParse("concert").success).toBe(false));
  it("rejects empty string", () => expect(EventType.safeParse("").success).toBe(false));
});

describe("EventStatus enum — matches public.event_status in DB", () => {
  const valid = ["borrador", "planificacion", "confirmado", "en_curso", "finalizado", "cancelado"];
  it.each(valid)("accepts '%s'", (v) => expect(EventStatus.safeParse(v).success).toBe(true));
  it("rejects 'draft' (English alias)", () => expect(EventStatus.safeParse("draft").success).toBe(false));
});

describe("ItemCategory enum — matches public.item_category in DB", () => {
  const valid = [
    "personal", "catering", "equipo", "mobiliario", "audio_video",
    "iluminacion", "transporte", "seguridad", "permisos", "marketing", "extras",
  ];
  it.each(valid)("accepts '%s'", (v) => expect(ItemCategory.safeParse(v).success).toBe(true));
  it("rejects English agent categories ('equipment', 'crew', 'supplier')", () => {
    expect(ItemCategory.safeParse("equipment").success).toBe(false);
    expect(ItemCategory.safeParse("crew").success).toBe(false);
    expect(ItemCategory.safeParse("supplier").success).toBe(false);
  });
});

describe("SupplierType enum — matches public.supplier_type in DB", () => {
  it("accepts 'interno' and 'externo'", () => {
    expect(SupplierType.safeParse("interno").success).toBe(true);
    expect(SupplierType.safeParse("externo").success).toBe(true);
  });
  it("rejects anything else", () => {
    expect(SupplierType.safeParse("external").success).toBe(false);
  });
});

describe("AppRole enum — matches public.app_role in DB (including ALTER TYPE additions)", () => {
  const valid = ["admin", "comercial", "personal", "logistica", "viewer", "contable", "super_admin"];
  it.each(valid)("accepts '%s'", (v) => expect(AppRole.safeParse(v).success).toBe(true));
  it("rejects unknown roles", () => {
    expect(AppRole.safeParse("superuser").success).toBe(false);
    expect(AppRole.safeParse("owner").success).toBe(false);
  });
});

describe("OrgStatus enum — active/inactive/suspended", () => {
  it("accepts the three valid statuses", () => {
    expect(OrgStatus.safeParse("active").success).toBe(true);
    expect(OrgStatus.safeParse("inactive").success).toBe(true);
    expect(OrgStatus.safeParse("suspended").success).toBe(true);
  });
  it("rejects free-form strings", () => {
    expect(OrgStatus.safeParse("enabled").success).toBe(false);
    expect(OrgStatus.safeParse("deleted").success).toBe(false);
  });
});
