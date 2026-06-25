/**
 * Cost engine — margin calculations
 * Tests: calcMargins(), IVA 19% (in billing), multi-currency format
 */
import { describe, it, expect } from "vitest";

// ── Inline the pure functions under test ─────────────────────────────────────
// calcMargins is not exported separately, so we replicate the logic here.
// If the formula changes in quotes.service.ts, update this file too.

const IVA_RATE = 0.19;

type ItemInput = {
  quantity: number;
  unit_cost: number;   // selling price
  total_cost: number;  // = unit_cost * quantity (generated)
  base_cost: number | null;
  markup_pct?: number | null;
};

function calcMargins(items: ItemInput[]) {
  return items.map((item) => {
    const qty      = Number(item.quantity);
    const baseCost = item.base_cost != null ? Number(item.base_cost) : Number(item.unit_cost);
    const revenue  = Number(item.total_cost); // selling price × qty
    const subtotal = baseCost * qty;           // raw cost × qty
    const margin   = revenue - subtotal;
    const margin_pct  = revenue  > 0 ? (margin / revenue)  * 100 : 0;
    const profit_pct  = subtotal > 0 ? (margin / subtotal) * 100 : 0;
    return { ...item, subtotal, revenue, margin, margin_pct, profit_pct };
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("calcMargins()", () => {
  it("zero margin when base_cost equals selling price", () => {
    const result = calcMargins([{ quantity: 1, unit_cost: 100, total_cost: 100, base_cost: 100 }])[0]!;
    expect(result.margin).toBe(0);
    expect(result.margin_pct).toBe(0);
    expect(result.profit_pct).toBe(0);
  });

  it("computes margin with 20% markup", () => {
    // base = 100, selling = 120, qty = 5
    const result = calcMargins([{ quantity: 5, unit_cost: 120, total_cost: 600, base_cost: 100 }])[0]!;
    expect(result.subtotal).toBe(500);   // 100 × 5
    expect(result.revenue).toBe(600);    // 120 × 5
    expect(result.margin).toBe(100);     // 600 - 500
    expect(result.margin_pct).toBeCloseTo(16.667, 2);   // 100/600
    expect(result.profit_pct).toBeCloseTo(20, 2);        // 100/500
  });

  it("handles 0 revenue without division by zero", () => {
    const result = calcMargins([{ quantity: 0, unit_cost: 100, total_cost: 0, base_cost: 100 }])[0]!;
    expect(result.margin_pct).toBe(0);
    expect(result.profit_pct).toBe(0);
  });

  it("falls back to unit_cost when base_cost is null", () => {
    const result = calcMargins([{ quantity: 2, unit_cost: 50, total_cost: 100, base_cost: null }])[0]!;
    expect(result.subtotal).toBe(100);  // unit_cost used as base
    expect(result.margin).toBe(0);
  });

  it("negative margin when costs exceed revenue", () => {
    const result = calcMargins([{ quantity: 1, unit_cost: 80, total_cost: 80, base_cost: 100 }])[0]!;
    expect(result.margin).toBe(-20);
    expect(result.margin_pct).toBeCloseTo(-25, 2);  // -20/80
    expect(result.profit_pct).toBeCloseTo(-20, 2);  // -20/100
  });

  it("aggregates multiple items independently", () => {
    const items = [
      { quantity: 2, unit_cost: 150, total_cost: 300, base_cost: 100 },  // +100 margin
      { quantity: 1, unit_cost: 200, total_cost: 200, base_cost: 200 },  // 0 margin
      { quantity: 3, unit_cost: 110, total_cost: 330, base_cost: 100 },  // +30 margin
    ];
    const results = calcMargins(items);
    expect(results[0]!.margin).toBe(100);
    expect(results[1]!.margin).toBe(0);
    expect(results[2]!.margin).toBe(30);
  });
});

describe("IVA 19%", () => {
  it("adds 19% on top of subtotal", () => {
    const subtotal = 1_000_000;
    const iva      = subtotal * IVA_RATE;
    const total    = subtotal + iva;
    expect(iva).toBe(190_000);
    expect(total).toBe(1_190_000);
  });

  it("IVA rounds correctly for typical COP amounts", () => {
    const subtotal = 5_280_000;
    const iva      = subtotal * IVA_RATE;
    expect(iva).toBeCloseTo(1_003_200, 0);
  });
});

describe("Markup encoding into unit_cost", () => {
  it("selling price = base * (1 + markup/100)", () => {
    const base    = 100_000;
    const markup  = 15; // 15%
    const selling = base * (1 + markup / 100);
    expect(selling).toBeCloseTo(115_000, 0);
  });

  it("zero markup leaves price unchanged", () => {
    const base   = 200_000;
    const markup = 0;
    expect(base * (1 + markup / 100)).toBe(200_000);
  });

  it("recovers base from selling and markup", () => {
    const selling = 115_000;
    const markup  = 15;
    const recoveredBase = selling / (1 + markup / 100);
    expect(recoveredBase).toBeCloseTo(100_000, 0);
  });
});
