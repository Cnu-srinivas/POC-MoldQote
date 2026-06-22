/**
 * MoldQuote AI — Quote Engine type contract.
 *
 * DO NOT change these interfaces or the function signatures in engine.ts.
 * The automated grader imports these exact names and shapes. If you rename
 * or restructure them, the grader cannot score your submission.
 *
 * You MAY add private helper functions/types inside engine.ts.
 */

/** All per-part inputs needed to compute one cost stack. Weights in grams, money in USD. */
export interface CostInputs {
  cav: number; // cavities (mold produces this many parts per shot)
  part_g: number; // finished part weight, grams
  runner_g: number; // runner/sprue weight per shot, grams
  resin_lb: number; // resin price, $/lb
  color_lb: number; // colorant price, $/lb
  color_pct: number; // colorant loading, percent (e.g. 2 == 2%)
  purge_lbs: number; // resin purged at machine startup, lbs (one-time per run)
  machine_rate: number; // fully-loaded machine rate, $/hr
  cycle_s: number; // cycle time, seconds
  setup_hours: number; // machine setup labor, hours (one-time per run)
  setup_rate: number; // setup labor rate, $/hr
  insert_price: number; // price per insert, $/pc (0 = no inserts)
  insert_freight: number; // total freight for inserts, $ (one-time per run)
  inserts_per_part: number; // inserts consumed per finished part
  secondary_rate: number; // secondary-operation labor rate, $/hr (0 = none)
  secondary_pph: number; // secondary-operation parts per hour
  outside_cost: number; // outside/vendor op cost, $/pc (0 = none)
  outside_freight: number; // total freight for outside op, $ (one-time per run)
  outside_min_qty: number; // qty the outside freight is spread across (0 = none)
  scrap_pct: number; // scrap allowance, percent
}

/** The itemized per-part cost breakdown for one order quantity. All values in $/part. */
export interface CostStack {
  material: number;
  purge: number;
  molding: number;
  setup: number;
  insert: number;
  secondary: number;
  outside: number;
  parts_per_hour: number; // not a cost; the computed throughput
  shot_g: number; // not a cost; the computed shot weight
  total: number; // sum of the seven cost components
}

export interface MarkupTier {
  /** Upper bound (inclusive) for this tier. null == catch-all for everything above. */
  max_qty: number | null;
  markup_pct: number;
}

export interface LadderLine {
  order_qty: number;
  unit_cost: number; // full-precision cost/part (carry >= 5 decimals)
  markup_pct: number; // markup resolved for this qty
  unit_price: number; // full-precision sell price/part (carry >= 5 decimals)
}

export type LengthUnit = "inch" | "mm" | "cm";

export interface ToolingParams {
  tooling_class: "101" | "102" | "103" | "104" | "105";
  cavities: number;
  size_factor: number; // resolved from the max bounding-box dimension band
  complexity_factor: number; // resolved from side-actions/lifters band
  finish_material_factor: number; // product of any finish/material multipliers (1.0 if none)
  runner_adder: number; // $ added for hot runner, 0 for cold
}

export interface ToolingResult {
  low: number;
  point: number;
  high: number;
}

export interface ConfidenceFactors {
  material_matched: boolean;
  weight_from_cad: boolean;
  tonnage_within_capacity: boolean;
  cavitation_confirmed: boolean;
  cycle_from_cad: boolean;
  tooling_from_quote: boolean;
  qty_present_sane: boolean;
  tolerances_readable: boolean;
}

export interface ConfidenceResult {
  score: number; // 0..100
  band: "green" | "amber" | "red";
}
