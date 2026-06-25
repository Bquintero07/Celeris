import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../supabase", () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }) } },
}));

import { api } from "../api";

describe("api request() — response handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined on 204 No Content instead of crashing on an empty body (regression)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(null, { status: 204 }),
    ));
    await expect(api.events.delete("evt-1")).resolves.toBeUndefined();
  });

  it("parses JSON on a normal 200 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "evt-1", title: "Test" }), { status: 200 }),
    ));
    await expect(api.events.get("evt-1")).resolves.toEqual({ id: "evt-1", title: "Test" });
  });

  it("throws with the response body text when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("Forbidden", { status: 403 }),
    ));
    await expect(api.events.get("evt-1")).rejects.toThrow("Forbidden");
  });
});
