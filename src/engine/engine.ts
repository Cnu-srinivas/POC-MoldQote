/**
 * MoldQuote AI — Quote Engine.
 *
 * THIS IS THE FILE YOU IMPLEMENT.
 *
 * Every function below currently throws. Replace the bodies so that the engine
 * reproduces the behavior described in SPEC.md. Keep the signatures exactly as
 * written — the grader calls these by name.
 *
 * Hard rules (see SPEC.md §"Engineering rules"):
 *   - Pure functions only. No I/O, no randomness, no Date.now(), no network, no LLM calls.
 *   - Compute in full floating point. Do NOT round intermediate values.
 *     Rounding to cents is a DISPLAY concern only (see the UI), never inside the engine.
 *   - `unit_cost` and `unit_price` are returned at full precision; the grader
 *     checks them to 5 decimal places.
 */

import type {
  CostInputs,
  CostStack,
  MarkupTier,
  LadderLine,
  LengthUnit,
  ToolingParams,
  ToolingResult,
  ConfidenceFactors,
  ConfidenceResult,
} from "./types";

// --- Physical constants (see SPEC.md §intro) ---
const GRAMS_PER_LB = 454;
const SECONDS_PER_HOUR = 3600;
const CM3_PER_CUBIC_INCH = 16.387064;
const MM3_PER_CM3 = 1000;

/** Shot weight in grams for one cycle: each cavity makes one part, plus one shared runner. */
export function shotWeight(cav: number, part_g: number, runner_g: number): number {
  return cav * part_g + runner_g;
}

/**
 * Convert a CAD solid volume to a part weight in grams.
 * `units` is the CAD file's length unit — NEVER assume millimeters.
 * density is g/cm^3.
 *
 * Convert the volume into cm^3 first, then multiply by density.
 */
export function weightFromVolume(volume: number, units: LengthUnit, density_g_cm3: number): number {
  let volume_cm3: number;
  switch (units) {
    case "inch":
      volume_cm3 = volume * CM3_PER_CUBIC_INCH;
      break;
    case "mm":
      volume_cm3 = volume / MM3_PER_CM3;
      break;
    case "cm":
      volume_cm3 = volume;
      break;
  }
  return volume_cm3 * density_g_cm3;
}

/** The itemized per-part cost stack for one order quantity. */
export function costStack(inputs: CostInputs, order_qty: number): CostStack {
  const {
    cav,
    part_g,
    runner_g,
    resin_lb,
    color_lb,
    color_pct,
    purge_lbs,
    machine_rate,
    cycle_s,
    setup_hours,
    setup_rate,
    insert_price,
    insert_freight,
    inserts_per_part,
    secondary_rate,
    secondary_pph,
    outside_cost,
    outside_freight,
    outside_min_qty,
  } = inputs;

  const shot_g = shotWeight(cav, part_g, runner_g);

  // Guard cav === 0 so the pure function never divides by zero (SPEC §2 edge behavior).
  // material, molding and parts_per_hour are 0 in that branch.
  const parts_per_hour = cav === 0 ? 0 : (SECONDS_PER_HOUR / cycle_s) * cav;

  // material: resin (+ colorant) consumed per part, priced per pound.
  // Grams of plastic attributable to one part = shot_g / cav. Colorant adds cost in
  // proportion to its price and loading percent.
  const grams_per_part = cav === 0 ? 0 : shot_g / cav;
  const lbs_per_part = grams_per_part / GRAMS_PER_LB;
  const price_per_lb = resin_lb + (color_pct / 100) * color_lb;
  const material = cav === 0 ? 0 : lbs_per_part * price_per_lb;

  // purge: one-time lbs charge (priced at resin rate) spread over the run.
  const purge = (purge_lbs * resin_lb) / order_qty;

  // molding: loaded machine $/hr divided by parts the press makes per hour.
  const molding = cav === 0 ? 0 : machine_rate / parts_per_hour;

  // setup: one-time setup labor (hours × rate) spread over the run.
  const setup = (setup_hours * setup_rate) / order_qty;

  // insert: per-insert price plus freight. Freight is one-time and spreads across the
  // TOTAL number of inserts in the run (order_qty * inserts_per_part) — a different
  // denominator than outside freight (SPEC §2 example C). 0 when insert_price === 0.
  const insert =
    insert_price === 0
      ? 0
      : insert_price + insert_freight / (order_qty * inserts_per_part);

  // secondary: in-house secondary op (labor rate ÷ throughput). 0 when rate or pph is 0.
  const secondary =
    secondary_rate === 0 || secondary_pph === 0 ? 0 : secondary_rate / secondary_pph;

  // outside: vendor op per-piece cost plus freight spread across the outside min qty.
  // 0 when there is no outside min qty.
  const outside =
    outside_min_qty === 0 ? 0 : outside_cost + outside_freight / outside_min_qty;

  const total = material + purge + molding + setup + insert + secondary + outside;

  return {
    material,
    purge,
    molding,
    setup,
    insert,
    secondary,
    outside,
    parts_per_hour,
    shot_g,
    total,
  };
}

/**
 * Apply scrap allowance and markup to a per-part total cost, returning the sell price/part.
 * Both scrap and markup are percentages applied to the cost (markup, not margin):
 *   price = total × (1 + scrap%) × (1 + markup%)
 */
export function sellPrice(total: number, scrap_pct: number, markup_pct: number): number {
  return total * (1 + scrap_pct / 100) * (1 + markup_pct / 100);
}

/**
 * Resolve the markup percent for a given order quantity from the tier table.
 * A tier matches when order_qty <= its max_qty (inclusive); max_qty: null is the
 * catch-all for everything above the last bound. First matching tier wins.
 */
export function resolveMarkupTier(order_qty: number, tiers: MarkupTier[]): number {
  for (const tier of tiers) {
    if (tier.max_qty === null || order_qty <= tier.max_qty) {
      return tier.markup_pct;
    }
  }
  // No catch-all tier present and qty exceeds every bound.
  throw new Error(`NO_MARKUP_TIER: no tier matches order_qty ${order_qty}`);
}

/**
 * Build the full volume-break price ladder.
 * For each order_qty: compute the cost stack, resolve the markup tier, compute the
 * sell price, and (if tooling is folded in) amortize tooling across that quantity.
 */
export function priceLadder(
  inputs: CostInputs,
  order_qtys: number[],
  tiers: MarkupTier[],
  tooling_cost: number,
  tooling_separate: boolean,
): LadderLine[] {
  return order_qtys.map((order_qty) => {
    const unit_cost = costStack(inputs, order_qty).total;
    const markup_pct = resolveMarkupTier(order_qty, tiers);
    const sell = sellPrice(unit_cost, inputs.scrap_pct, markup_pct);
    // Tooling is separate by default; fold into the piece price only on explicit opt-in.
    const unit_price = tooling_separate ? sell : sell + tooling_cost / order_qty;
    return { order_qty, unit_cost, markup_pct, unit_price };
  });
}

/** Parametric tooling estimate. Returns a point estimate plus a low/high range. */
export function toolingEstimate(params: ToolingParams): ToolingResult {
  const {
    tooling_class,
    cavities,
    size_factor,
    complexity_factor,
    finish_material_factor,
    runner_adder,
  } = params;

  const base_by_class: Record<ToolingParams["tooling_class"], number> = {
    "101": 40000,
    "102": 28000,
    "103": 15000,
    "104": 8000,
    "105": 5000,
  };

  const base = base_by_class[tooling_class];
  // 35% of the class base per cavity beyond the first.
  const per_cavity_adder = 0.35 * base * (cavities - 1);
  const point =
    (base + per_cavity_adder) *
      size_factor *
      complexity_factor *
      finish_material_factor +
    runner_adder;

  return {
    low: point * 0.85,
    point,
    high: point * 1.15,
  };
}

/** Deterministic 0..100 confidence score with traffic-light band. */
export function confidenceScore(factors: ConfidenceFactors): ConfidenceResult {
  const weights: Record<keyof ConfidenceFactors, number> = {
    material_matched: 15,
    weight_from_cad: 15,
    tonnage_within_capacity: 15,
    cavitation_confirmed: 10,
    cycle_from_cad: 10,
    tooling_from_quote: 15,
    qty_present_sane: 10,
    tolerances_readable: 10,
  };

  let score = 0;
  for (const key of Object.keys(weights) as (keyof ConfidenceFactors)[]) {
    if (factors[key]) score += weights[key];
  }

  const band: ConfidenceResult["band"] =
    score >= 80 ? "green" : score >= 60 ? "amber" : "red";

  return { score, band };
}

/**
 * Validate confirmed inputs before the engine runs.
 * Throw an Error whose message STARTS WITH one of these codes (followed by ": ..."):
 *   CAV_INVALID, PART_WEIGHT_INVALID, CYCLE_INVALID, QTY_INVALID, RUNNER_INVALID, SCRAP_INVALID
 * Return void if everything is valid. Checks run in order; first failure wins.
 */
export function validateQuoteInput(inputs: CostInputs, order_qtys: number[]): void {
  if (!Number.isInteger(inputs.cav) || inputs.cav <= 0) {
    throw new Error(`CAV_INVALID: cav must be an integer > 0 (got ${inputs.cav})`);
  }
  if (inputs.part_g <= 0) {
    throw new Error(`PART_WEIGHT_INVALID: part_g must be > 0 (got ${inputs.part_g})`);
  }
  if (inputs.cycle_s <= 0) {
    throw new Error(`CYCLE_INVALID: cycle_s must be > 0 (got ${inputs.cycle_s})`);
  }
  if (order_qtys.length === 0 || !order_qtys.every((q) => Number.isInteger(q) && q > 0)) {
    throw new Error(`QTY_INVALID: every order_qty must be an integer > 0 and the list non-empty`);
  }
  if (inputs.runner_g < 0) {
    throw new Error(`RUNNER_INVALID: runner_g must be >= 0 (got ${inputs.runner_g})`);
  }
  if (inputs.scrap_pct < 0) {
    throw new Error(`SCRAP_INVALID: scrap_pct must be >= 0 (got ${inputs.scrap_pct})`);
  }
}
