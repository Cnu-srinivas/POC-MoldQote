/**
 * PUBLIC sanity tests — run with `npm test`.
 *
 * These cover the #26144 calibration anchor only. Passing them means your engine
 * reproduces the one published quote. It does NOT mean you are done: the grader
 * runs a larger HIDDEN suite with cases that exercise color cost, scrap placement,
 * setup/purge amortization, markup-vs-margin, unit conversion, tier boundaries,
 * precision, tooling, confidence, and input validation.
 *
 * Read SPEC.md. Add your OWN tests below — we grade your tests too.
 */
import { describe, it, expect } from "vitest";
import {
  shotWeight,
  costStack,
  priceLadder,
  resolveMarkupTier,
} from "../src/engine/engine";
import { ANCHOR_26144, ANCHOR_QTYS, SEED_MARKUP_TIERS } from "../src/engine/seed";

const near = (a: number, b: number, dp = 5) =>
  expect(Number(a.toFixed(dp))).toBe(Number(b.toFixed(dp)));

describe("#26144 anchor", () => {
  it("shot weight = cav*part + runner", () => {
    expect(shotWeight(2, 2, 5)).toBe(9);
  });

  it("unit cost @ 10,000 = 0.50422", () => {
    const cs = costStack(ANCHOR_26144, 10000);
    near(cs.total, 0.50422);
  });

  it("reproduces the full published ladder (cost + rounded sell)", () => {
    const lines = priceLadder(
      ANCHOR_26144,
      ANCHOR_QTYS,
      SEED_MARKUP_TIERS,
      12750,
      true,
    );
    const expected = [
      { q: 1000, cost: 1.10047, sell: 1.36 },
      { q: 2000, cost: 0.76922, sell: 0.92 },
      { q: 5000, cost: 0.57047, sell: 0.67 },
      { q: 7000, cost: 0.53262, sell: 0.62 },
      { q: 10000, cost: 0.50422, sell: 0.59 },
    ];
    lines.forEach((ln, i) => {
      expect(ln.order_qty).toBe(expected[i].q);
      near(ln.unit_cost, expected[i].cost);
      expect(Math.round(ln.unit_price * 100) / 100).toBe(expected[i].sell);
    });
  });

  it("markup tier resolves by quantity", () => {
    expect(resolveMarkupTier(1000, SEED_MARKUP_TIERS)).toBe(24);
    expect(resolveMarkupTier(10000, SEED_MARKUP_TIERS)).toBe(16.5);
  });
});
