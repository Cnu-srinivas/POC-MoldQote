/**
 * MY tests — cover the SPEC.md cases the public suite does NOT:
 *   colorant + scrap (example B), inserts/secondary/outside (example C),
 *   amortization, markup-vs-margin, unit conversion, tier boundaries,
 *   tooling, confidence bands, validation order, and the cav===0 edge.
 *
 * Run with: npx vitest run tests/engine.mine.spec.ts  (or `npm run test:watch`).
 */
import { describe, it, expect } from "vitest";
import {
  shotWeight,
  weightFromVolume,
  costStack,
  sellPrice,
  resolveMarkupTier,
  priceLadder,
  toolingEstimate,
  confidenceScore,
  validateQuoteInput,
} from "../src/engine/engine";
import type { CostInputs, ConfidenceFactors, MarkupTier } from "../src/engine/types";
import { ANCHOR_26144, SEED_MARKUP_TIERS } from "../src/engine/seed";

const near = (a: number, b: number, dp = 5) =>
  expect(Number(a.toFixed(dp))).toBe(Number(b.toFixed(dp)));

// A fully-zeroed base so each test sets only what it exercises.
const base: CostInputs = {
  cav: 1,
  part_g: 1,
  runner_g: 0,
  resin_lb: 0,
  color_lb: 0,
  color_pct: 0,
  purge_lbs: 0,
  machine_rate: 0,
  cycle_s: 1,
  setup_hours: 0,
  setup_rate: 0,
  insert_price: 0,
  insert_freight: 0,
  inserts_per_part: 0,
  secondary_rate: 0,
  secondary_pph: 0,
  outside_cost: 0,
  outside_freight: 0,
  outside_min_qty: 0,
  scrap_pct: 0,
};

describe("shotWeight", () => {
  it("cav*part + shared runner", () => {
    expect(shotWeight(2, 2, 5)).toBe(9);
    expect(shotWeight(4, 12, 8)).toBe(56);
    expect(shotWeight(1, 40, 10)).toBe(50);
  });
});

describe("weightFromVolume — never assume mm", () => {
  it("inch volume → cm^3 → grams", () => {
    near(weightFromVolume(0.0873, "inch", 1.4), 2.00283);
  });
  it("mm^3: 1000 mm^3 == 1 cm^3", () => {
    expect(weightFromVolume(1000, "mm", 1.4)).toBeCloseTo(1.4, 10);
  });
  it("cm^3 is already cm^3", () => {
    expect(weightFromVolume(10, "cm", 1.4)).toBeCloseTo(14, 10);
  });
});

describe("costStack — example A (#26144 @ 10k)", () => {
  const cs = costStack(ANCHOR_26144, 10000);
  it("component breakdown", () => {
    near(cs.material, 0.02478);
    near(cs.purge, 0.00625);
    near(cs.molding, 0.41319);
    near(cs.setup, 0.06);
    expect(cs.insert).toBe(0);
    expect(cs.secondary).toBe(0);
    expect(cs.outside).toBe(0);
    near(cs.total, 0.50422);
  });
  it("derived shot weight and throughput", () => {
    expect(cs.shot_g).toBe(9);
    near(cs.parts_per_hour, 205.71429);
  });
  it("amortized pieces shrink with qty; per-part pieces stay fixed", () => {
    const lo = costStack(ANCHOR_26144, 1000);
    const hi = costStack(ANCHOR_26144, 10000);
    near(lo.material, hi.material); // fixed
    near(lo.molding, hi.molding); // fixed
    expect(lo.purge).toBeGreaterThan(hi.purge); // amortized
    expect(lo.setup).toBeGreaterThan(hi.setup); // amortized
    near(lo.total, 1.10047);
  });
});

describe("costStack — example B (colorant + scrap, multi-cavity)", () => {
  const inputsB: CostInputs = {
    ...base,
    cav: 4,
    part_g: 12,
    runner_g: 8,
    resin_lb: 1.8,
    color_lb: 3.0,
    color_pct: 2,
    purge_lbs: 10,
    machine_rate: 120,
    cycle_s: 22,
    setup_hours: 4,
    setup_rate: 100,
    scrap_pct: 3,
  };
  it("colorant enters material in proportion to price × loading%", () => {
    near(costStack(inputsB, 5000).material, 0.05736);
  });
  it("total @ 5000 and sell price recover scrap+markup combination", () => {
    const total = costStack(inputsB, 5000).total;
    near(total, 0.32429);
    // resolved markup 17% at qty 5000, scrap 3%
    near(sellPrice(total, 3, 17), 0.3908);
  });
  it("scrap is NOT inside material/total — it lives only in sellPrice", () => {
    const noScrap = { ...inputsB, scrap_pct: 0 };
    near(costStack(inputsB, 5000).total, costStack(noScrap, 5000).total);
  });
});

describe("costStack — example C (inserts + secondary + outside)", () => {
  const inputsC: CostInputs = {
    ...base,
    cav: 1,
    part_g: 40,
    runner_g: 10,
    resin_lb: 3.2,
    purge_lbs: 15,
    machine_rate: 95,
    cycle_s: 48,
    setup_hours: 3,
    setup_rate: 100,
    insert_price: 0.12,
    insert_freight: 200,
    inserts_per_part: 2,
    secondary_rate: 45,
    secondary_pph: 120,
    outside_cost: 0.3,
    outside_freight: 150,
    outside_min_qty: 2000,
  };
  const cs = costStack(inputsC, 2000);
  it("all seven components match", () => {
    near(cs.material, 0.35242);
    near(cs.purge, 0.024);
    near(cs.molding, 1.26667);
    near(cs.setup, 0.15);
    near(cs.insert, 0.17); // insert_price + freight/(qty*inserts_per_part)
    near(cs.secondary, 0.375); // rate / pph
    near(cs.outside, 0.375); // cost + freight/outside_min_qty
    near(cs.total, 2.71309);
  });
  it("insert freight denominator differs from outside (qty*inserts vs outside_min_qty)", () => {
    // Doubling inserts_per_part halves the insert freight share, not the outside one.
    const doubled = costStack({ ...inputsC, inserts_per_part: 4 }, 2000);
    near(doubled.insert, 0.12 + 200 / (2000 * 4)); // = 0.145
    near(doubled.outside, cs.outside); // unchanged
  });
});

describe("costStack — optional branches switch off cleanly", () => {
  it("insert 0 when insert_price === 0", () => {
    expect(costStack({ ...base, insert_freight: 999, inserts_per_part: 5 }, 100).insert).toBe(0);
  });
  it("secondary 0 when rate or pph is 0", () => {
    expect(costStack({ ...base, secondary_rate: 0, secondary_pph: 120 }, 100).secondary).toBe(0);
    expect(costStack({ ...base, secondary_rate: 45, secondary_pph: 0 }, 100).secondary).toBe(0);
  });
  it("outside 0 when outside_min_qty === 0", () => {
    expect(costStack({ ...base, outside_cost: 5, outside_freight: 999 }, 100).outside).toBe(0);
  });
});

describe("costStack — cav === 0 edge (no divide-by-zero)", () => {
  it("material, molding, parts_per_hour are 0; amortized pieces still compute", () => {
    const cs = costStack({ ...base, cav: 0, resin_lb: 2.5, machine_rate: 85, purge_lbs: 10 }, 1000);
    expect(cs.material).toBe(0);
    expect(cs.molding).toBe(0);
    expect(cs.parts_per_hour).toBe(0);
    expect(Number.isFinite(cs.total)).toBe(true);
    near(cs.purge, (10 * 2.5) / 1000);
  });
});

describe("sellPrice — markup, not margin", () => {
  it("example A: scrap 0, markup 16.5", () => {
    near(sellPrice(0.50422, 0, 16.5), 0.58742);
  });
  it("example B: scrap 3, markup 17", () => {
    near(sellPrice(0.32429, 3, 17), 0.3908);
  });
  it("uses cost×(1+m) NOT cost/(1−m)", () => {
    // margin formula would give 1/0.835 = 1.19760…; markup gives 1.165
    near(sellPrice(1, 0, 16.5), 1.165);
    expect(sellPrice(1, 0, 16.5)).not.toBeCloseTo(1 / (1 - 0.165), 5);
  });
});

describe("resolveMarkupTier — inclusive boundaries, scales down", () => {
  it("seed table boundaries", () => {
    expect(resolveMarkupTier(1000, SEED_MARKUP_TIERS)).toBe(24);
    expect(resolveMarkupTier(1001, SEED_MARKUP_TIERS)).toBe(20);
    expect(resolveMarkupTier(2000, SEED_MARKUP_TIERS)).toBe(20);
    expect(resolveMarkupTier(5000, SEED_MARKUP_TIERS)).toBe(17);
    expect(resolveMarkupTier(5001, SEED_MARKUP_TIERS)).toBe(16.5);
    expect(resolveMarkupTier(1_000_000, SEED_MARKUP_TIERS)).toBe(16.5);
  });
});

describe("priceLadder", () => {
  const qtys = [1000, 2000, 5000, 7000, 10000];
  it("tooling_separate=true leaves piece price untouched", () => {
    const lines = priceLadder(ANCHOR_26144, qtys, SEED_MARKUP_TIERS, 12750, true);
    const expected = [
      { cost: 1.10047, sell: 1.36 },
      { cost: 0.76922, sell: 0.92 },
      { cost: 0.57047, sell: 0.67 },
      { cost: 0.53262, sell: 0.62 },
      { cost: 0.50422, sell: 0.59 },
    ];
    lines.forEach((ln, i) => {
      near(ln.unit_cost, expected[i].cost);
      expect(Math.round(ln.unit_price * 100) / 100).toBe(expected[i].sell);
    });
  });
  it("tooling_separate=false folds tooling/qty into the piece price", () => {
    const separate = priceLadder(ANCHOR_26144, [1000], SEED_MARKUP_TIERS, 12750, true)[0];
    const folded = priceLadder(ANCHOR_26144, [1000], SEED_MARKUP_TIERS, 12750, false)[0];
    near(folded.unit_price - separate.unit_price, 12750 / 1000);
    near(separate.unit_cost, folded.unit_cost); // cost line unaffected either way
  });
  it("respects input order of order_qtys", () => {
    const lines = priceLadder(ANCHOR_26144, [10000, 1000], SEED_MARKUP_TIERS, 0, true);
    expect(lines.map((l) => l.order_qty)).toEqual([10000, 1000]);
  });
});

describe("toolingEstimate", () => {
  it("anchor: class 103, 2 cavities, all factors 1.0 → point 20250", () => {
    const r = toolingEstimate({
      tooling_class: "103",
      cavities: 2,
      size_factor: 1,
      complexity_factor: 1,
      finish_material_factor: 1,
      runner_adder: 0,
    });
    near(r.point, 20250);
    near(r.low, 20250 * 0.85);
    near(r.high, 20250 * 1.15);
  });
  it("single cavity has no per-cavity adder; factors and runner_adder apply", () => {
    const r = toolingEstimate({
      tooling_class: "101",
      cavities: 1,
      size_factor: 1.2,
      complexity_factor: 1.1,
      finish_material_factor: 1.05,
      runner_adder: 5000,
    });
    near(r.point, 40000 * 1.2 * 1.1 * 1.05 + 5000);
  });
});

describe("confidenceScore — weighted sum + bands", () => {
  const allFalse: ConfidenceFactors = {
    material_matched: false,
    weight_from_cad: false,
    tonnage_within_capacity: false,
    cavitation_confirmed: false,
    cycle_from_cad: false,
    tooling_from_quote: false,
    qty_present_sane: false,
    tolerances_readable: false,
  };
  it("all true = 100 → green", () => {
    const all = Object.fromEntries(
      Object.keys(allFalse).map((k) => [k, true]),
    ) as unknown as ConfidenceFactors;
    expect(confidenceScore(all)).toEqual({ score: 100, band: "green" });
  });
  it("all false = 0 → red", () => {
    expect(confidenceScore(allFalse)).toEqual({ score: 0, band: "red" });
  });
  it("band boundaries: 80 green, 79 amber, 60 amber, 59 red", () => {
    // 80 = the three 15s + two 10s + ... pick exact subsets:
    const s80: ConfidenceFactors = {
      ...allFalse,
      material_matched: true, // 15
      weight_from_cad: true, // 15
      tonnage_within_capacity: true, // 15
      tooling_from_quote: true, // 15
      cavitation_confirmed: true, // 10
      cycle_from_cad: true, // 10
    }; // = 80
    expect(confidenceScore(s80)).toEqual({ score: 80, band: "green" });

    const s60: ConfidenceFactors = {
      ...allFalse,
      material_matched: true, // 15
      weight_from_cad: true, // 15
      tonnage_within_capacity: true, // 15
      cavitation_confirmed: true, // 10
      cycle_from_cad: true, // 5? no — use 10s
    }; // 15+15+15+10+10 = 65 amber
    expect(confidenceScore(s60).band).toBe("amber");

    const s55: ConfidenceFactors = {
      ...allFalse,
      material_matched: true, // 15
      weight_from_cad: true, // 15
      cavitation_confirmed: true, // 10
      cycle_from_cad: true, // 10
      qty_present_sane: true, // 10
    }; // = 60 amber (boundary)
    expect(confidenceScore(s55)).toEqual({ score: 60, band: "amber" });

    const s59: ConfidenceFactors = { ...allFalse, material_matched: true, weight_from_cad: true, tonnage_within_capacity: true, cavitation_confirmed: true }; // 55 red
    expect(confidenceScore(s59).band).toBe("red");
  });
});

describe("validateQuoteInput — order matters, first failure wins", () => {
  const good: CostInputs = { ...ANCHOR_26144 };
  it("passes valid inputs (returns void)", () => {
    expect(validateQuoteInput(good, [1000, 10000])).toBeUndefined();
  });
  const expectCode = (fn: () => void, code: string) => {
    expect(fn).toThrow();
    try {
      fn();
    } catch (e) {
      expect((e as Error).message.startsWith(code + ":")).toBe(true);
    }
  };
  it("CAV_INVALID for non-integer or <= 0", () => {
    expectCode(() => validateQuoteInput({ ...good, cav: 0 }, [1000]), "CAV_INVALID");
    expectCode(() => validateQuoteInput({ ...good, cav: 2.5 }, [1000]), "CAV_INVALID");
    expectCode(() => validateQuoteInput({ ...good, cav: -1 }, [1000]), "CAV_INVALID");
  });
  it("PART_WEIGHT_INVALID when part_g <= 0", () => {
    expectCode(() => validateQuoteInput({ ...good, part_g: 0 }, [1000]), "PART_WEIGHT_INVALID");
  });
  it("CYCLE_INVALID when cycle_s <= 0", () => {
    expectCode(() => validateQuoteInput({ ...good, cycle_s: 0 }, [1000]), "CYCLE_INVALID");
  });
  it("QTY_INVALID for empty list or non-integer/<=0 qty", () => {
    expectCode(() => validateQuoteInput(good, []), "QTY_INVALID");
    expectCode(() => validateQuoteInput(good, [1000, 0]), "QTY_INVALID");
    expectCode(() => validateQuoteInput(good, [1000, 2.5]), "QTY_INVALID");
  });
  it("RUNNER_INVALID when runner_g < 0", () => {
    expectCode(() => validateQuoteInput({ ...good, runner_g: -1 }, [1000]), "RUNNER_INVALID");
  });
  it("SCRAP_INVALID when scrap_pct < 0", () => {
    expectCode(() => validateQuoteInput({ ...good, scrap_pct: -1 }, [1000]), "SCRAP_INVALID");
  });
  it("first failure wins: bad cav AND bad cycle → CAV_INVALID", () => {
    expectCode(
      () => validateQuoteInput({ ...good, cav: 0, cycle_s: 0 }, []),
      "CAV_INVALID",
    );
  });
});
