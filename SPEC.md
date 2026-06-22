# SPEC — MoldQuote AI Quote Engine

This is the behavioral spec for `src/engine/engine.ts`. It describes **what** each
function must produce and gives you **worked examples** to reverse-engineer the exact
arithmetic from. It deliberately does **not** hand you ready-to-paste formulas. Your
job is to recover the model precisely enough to match every hidden case to the cent.

All weights are grams, all money is USD. Two physical constants you will need:

- **454** grams per pound
- **3600** seconds per hour

---

## 1. `shotWeight(cav, part_g, runner_g)`

The mass of plastic injected in one machine cycle: every cavity makes one part, plus a
single shared runner. Example: `shotWeight(2, 2, 5) === 9`.

---

## 2. `costStack(inputs, order_qty)` → per-part cost breakdown

Returns seven cost components (all **$/part**), plus `parts_per_hour`, `shot_g`, and
their sum as `total`. Some components are **per-cycle/per-part** costs; others are
**one-time run costs that amortize across `order_qty`** — that amortization is exactly
why small runs cost more per part. Figure out which is which from the examples.

The seven components:

| Component | What it represents |
|---|---|
| `material` | resin (and colorant) consumed per part, priced per pound. Colorant adds cost in proportion to the colorant price and the colorant loading percent. |
| `purge` | resin purged at machine startup (a one-time lbs charge), spread over the run. |
| `molding` | machine time per part: the loaded machine $/hr divided by how many parts the press makes per hour. Parts/hour comes from the cycle time and the number of cavities. |
| `setup` | setup labor (hours × rate, one-time) spread over the run. |
| `insert` | optional purchased inserts pressed into the part (per-piece price plus freight). `0` when `insert_price === 0`. |
| `secondary` | optional in-house secondary operation (labor rate ÷ throughput). `0` when its rate or throughput is `0`. |
| `outside` | optional outside/vendor operation (per-piece cost plus freight). `0` when there is no outside min qty. |
| **`total`** | the sum of the seven above. |

### Worked example A — part #26144 (the public anchor)

Inputs: `cav 2, part_g 2, runner_g 5, resin_lb 2.50, color 0, purge_lbs 25,
machine_rate 85, cycle_s 35, setup_hours 6, setup_rate 100`, all optional branches `0`,
`scrap 0`.

At **`order_qty = 10,000`** the components are:

| material | purge | molding | setup | insert | secondary | outside | **total** |
|---|---|---|---|---|---|---|---|
| 0.02478 | 0.00625 | 0.41319 | 0.06000 | 0 | 0 | 0 | **0.50422** |

`shot_g = 9`, `parts_per_hour = 205.714…`.

The same part across the ladder (only the amortized pieces move):

| order_qty | unit_cost (`total`) |
|---|---|
| 1,000 | 1.10047 |
| 2,000 | 0.76922 |
| 5,000 | 0.57047 |
| 7,000 | 0.53262 |
| 10,000 | 0.50422 |

> Recover `material`, `purge`, `molding`, and `setup` from these numbers and the inputs
> above. Note that `material` and `molding` are identical at every quantity, while
> `purge` and `setup` shrink as quantity grows.

### Worked example B — colorant + scrap (multi-cavity)

Inputs: `cav 4, part_g 12, runner_g 8, resin_lb 1.80, color_lb 3.00, color_pct 2,
purge_lbs 10, machine_rate 120, cycle_s 22, setup_hours 4, setup_rate 100, scrap 3`,
all optional branches `0`, `order_qty 5000`, resolved markup `17%`.

- `material = 0.05736` (use this to recover how colorant enters the material cost)
- `total = 0.32429`
- **sell price = 0.39080** (displays as `$0.39`) — use this with `total` to recover how
  scrap and markup combine (see §4).

### Worked example C — inserts + secondary + outside

Inputs: `cav 1, part_g 40, runner_g 10, resin_lb 3.20, purge_lbs 15, machine_rate 95,
cycle_s 48, setup_hours 3, setup_rate 100, insert_price 0.12, insert_freight 200,
inserts_per_part 2, secondary_rate 45, secondary_pph 120, outside_cost 0.30,
outside_freight 150, outside_min_qty 2000`, `order_qty 2000`.

| material | purge | molding | setup | insert | secondary | outside | **total** |
|---|---|---|---|---|---|---|---|
| 0.35242 | 0.02400 | 1.26667 | 0.15000 | 0.17000 | 0.37500 | 0.37500 | **2.71309** |

> Recover the three optional branches from these values. Note the freight terms are
> one-time charges and each is spread across a different denominator — work out which
> from the numbers. (`insert` freight and `outside` freight do **not** amortize over the
> same quantity.)

### Edge behavior inside `costStack`

- `cav === 0` → `material`, `molding`, and `parts_per_hour` are `0` (mirrors the source
  sheet's `IF(cav=0, 0, …)`). The API layer rejects `cav <= 0` separately (see §6); this
  branch only exists so the pure function never divides by zero.

---

## 3. `weightFromVolume(volume, units, density_g_cm3)`

CAD gives a solid volume in the file's own length unit. **Never assume millimeters.**
Convert the volume to **cm³** first, then multiply by density.

- `inch` → multiply volume by **16.387064** to get cm³
- `mm` → 1 cm³ = 1000 mm³
- `cm` → already cm³

Example: `weightFromVolume(0.0873, "inch", 1.40) ≈ 2.00283` g.

---

## 4. `sellPrice(total, scrap_pct, markup_pct)` and markup

The sell price takes the per-part `total`, increases it by the **scrap allowance**, and
then applies the **markup**. Both are percentages applied to the cost — the price is the
cost *marked up*, it is not a margin. Recover the exact combination from example A
(`16.5%` markup, scrap `0`, `total 0.50422` → `sell 0.58742`) and example B (`scrap 3`,
`markup 17`, `total 0.32429` → `sell 0.39080`).

### Markup tiers — `resolveMarkupTier(order_qty, tiers)`

Markup **scales down** as quantity rises. A tier matches when `order_qty` is **≤** its
`max_qty`; the tier with `max_qty: null` is the catch-all for everything above the last
bound. Return the first matching tier's `markup_pct`. Seed table:

```
[ { max_qty: 1000, markup_pct: 24 },
  { max_qty: 2000, markup_pct: 20 },
  { max_qty: 5000, markup_pct: 17 },
  { max_qty: null, markup_pct: 16.5 } ]
```

So `1000 → 24`, `1001 → 20`, `5000 → 17`, `5001 → 16.5`. (Boundaries are inclusive.)

---

## 5. `priceLadder(inputs, order_qtys, tiers, tooling_cost, tooling_separate)`

For each quantity, in input order, return a `LadderLine`:

- `unit_cost` = `costStack(inputs, qty).total` at full precision
- `markup_pct` = `resolveMarkupTier(qty, tiers)`
- `unit_price` = the sell price (§4), **plus** tooling amortization **only when
  `tooling_separate === false`**: in that case add `tooling_cost / qty` to the unit
  price. When `tooling_separate === true` (the default) tooling is billed as its own
  one-time line and does **not** touch the piece price.

Return full precision; the UI rounds for display.

---

## 6. `validateQuoteInput(inputs, order_qtys)`

Throw an `Error` whose message **starts with** the matching code and a colon. Return
`void` if all good.

| Condition | Code |
|---|---|
| `cav` not an integer `> 0` | `CAV_INVALID` |
| `part_g <= 0` | `PART_WEIGHT_INVALID` |
| `cycle_s <= 0` | `CYCLE_INVALID` |
| any `order_qty` not an integer `> 0` (or empty list) | `QTY_INVALID` |
| `runner_g < 0` | `RUNNER_INVALID` |
| `scrap_pct < 0` | `SCRAP_INVALID` |

Check in the order listed (first failure wins).

---

## 7. `toolingEstimate(params)` → `{ low, point, high }`

Parametric mold cost:

```
point = (base_by_class + per_cavity_adder) * size_factor * complexity_factor
        * finish_material_factor + runner_adder
```

- `base_by_class`: `101 → 40000 · 102 → 28000 · 103 → 15000 · 104 → 8000 · 105 → 5000`
- `per_cavity_adder` = `35%` of the class base **per cavity beyond the first** =
  `0.35 * base * (cavities - 1)`
- `size_factor`, `complexity_factor`, `finish_material_factor`, `runner_adder` are passed
  in already resolved.
- `low = point * 0.85`, `high = point * 1.15`.

Anchor: class `103`, `2` cavities, all factors `1.0`, `runner_adder 0` → **`point = 20250`**.
(The real #26144 mold shipped at a `$12,750` override; the parametric point is only a
starting range.)

---

## 8. `confidenceScore(factors)` → `{ score, band }`

Sum the points for each `true` factor (a `false` factor scores `0`):

| Factor | Points |
|---|---|
| `material_matched` | 15 |
| `weight_from_cad` | 15 |
| `tonnage_within_capacity` | 15 |
| `cavitation_confirmed` | 10 |
| `cycle_from_cad` | 10 |
| `tooling_from_quote` | 15 |
| `qty_present_sane` | 10 |
| `tolerances_readable` | 10 |

Bands: `score >= 80 → "green"`, `60–79 → "amber"`, `< 60 → "red"`. A `score < 60` is what
blocks one-click send in the UI unless an owner overrides.

---

## Engineering rules (graded)

1. **Pure & deterministic.** No I/O, no rounding of intermediate values.
2. **Markup, not margin.** `price = cost × (1 + markup%)`. Never `cost / (1 − margin)`.
3. **Persist/return 5-decimal precision** for `unit_cost` and `unit_price`; round only
   for display.
4. **One-time costs amortize over quantity** (purge, setup, freight terms).
5. **Tooling is separate by default**; fold into the piece price only on explicit opt-in.
6. **Never assume CAD units are millimeters.**
