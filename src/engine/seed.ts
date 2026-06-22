/** Seed data used by the UI. You do not need to edit this file. */
import type { CostInputs, MarkupTier } from "./types";

/** Volume-tiered markup (markup scales DOWN as quantity rises). Per-shop tunable in the real product. */
export const SEED_MARKUP_TIERS: MarkupTier[] = [
  { max_qty: 1000, markup_pct: 24 },
  { max_qty: 2000, markup_pct: 20 },
  { max_qty: 5000, markup_pct: 17 },
  { max_qty: null, markup_pct: 16.5 },
];

/** Part #26144 (Nylon 6, 33% glass-filled) — the public calibration anchor. */
export const ANCHOR_26144: CostInputs = {
  cav: 2,
  part_g: 2,
  runner_g: 5,
  resin_lb: 2.5,
  color_lb: 0,
  color_pct: 0,
  purge_lbs: 25,
  machine_rate: 85,
  cycle_s: 35,
  setup_hours: 6,
  setup_rate: 100,
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

export const ANCHOR_QTYS = [1000, 2000, 5000, 7000, 10000];

/**
 * The published Central Plastics quote for #26144 — what "correct" looks like in the UI.
 * unit_cost is exact; sell is the seed-tier result (rounds to the published ladder within 1 cent).
 */
export const ANCHOR_EXPECTED = {
  shot_g: 9,
  lines: [
    { order_qty: 1000, unit_cost: 1.10047, markup_pct: 24, unit_price_display: 1.36 },
    { order_qty: 2000, unit_cost: 0.76922, markup_pct: 20, unit_price_display: 0.92 },
    { order_qty: 5000, unit_cost: 0.57047, markup_pct: 17, unit_price_display: 0.67 },
    { order_qty: 7000, unit_cost: 0.53262, markup_pct: 16.5, unit_price_display: 0.62 },
    { order_qty: 10000, unit_cost: 0.50422, markup_pct: 16.5, unit_price_display: 0.59 },
  ],
};
