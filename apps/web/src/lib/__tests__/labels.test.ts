import { describe, it, expect } from "vitest";
import { CATEGORY_LABELS, EVENT_TYPE_LABELS, label } from "../labels";

describe("label()", () => {
  it("returns the mapped label for a known key", () => {
    expect(label(EVENT_TYPE_LABELS, "concierto")).toBe("Concert");
  });

  it("falls back to the raw key when unmapped", () => {
    expect(label(EVENT_TYPE_LABELS, "unknown_type")).toBe("unknown_type");
  });
});

describe("CATEGORY_LABELS", () => {
  it("covers every public.item_category DB enum value (Spanish)", () => {
    const dbEnumValues = [
      "personal", "catering", "equipo", "mobiliario", "audio_video",
      "iluminacion", "transporte", "seguridad", "permisos", "marketing", "extras",
    ];
    for (const v of dbEnumValues) expect(CATEGORY_LABELS[v]).toBeDefined();
  });

  it("also covers the AI agent's English categories (quotes.service.ts maps them before insert)", () => {
    for (const v of ["equipment", "crew", "supplier"]) {
      expect(CATEGORY_LABELS[v]).toBeDefined();
    }
  });
});
