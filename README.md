# MoldQuote AI — Engineering Take-Home: The Quote Engine

Welcome, and thanks for taking this on. This exercise is the **trust core** of our
product: a deterministic engine that turns confirmed part inputs into an
injection-molding price quote. In production an estimator stakes their reputation on
these numbers, so the bar is correctness to the cent, clean code, and real tests —
not a demo that "mostly works."

## What you're building

You implement **`src/engine/engine.ts`** — a pure TypeScript module — so that it
reproduces the pricing behavior described in **[`SPEC.md`](./SPEC.md)**. A React UI is
already wired to your engine; when your engine is correct, the UI comes alive and shows
a real quote for our calibration part (#26144).

You are **not** building extraction, auth, a database, or a backend. Just the engine
(and any tests you add). The UI is provided — you should not need to touch it, though
you may read it.

## Ground rules

- **Use any tools you like, including AI assistants.** We assume you will. The task is
  built so that pasting the spec into an LLM will not get you a passing submission —
  the spec deliberately withholds the exact formulas and gives you worked examples to
  reverse-engineer instead. Budget **4–6 hours**.
- **Pure functions only.** No I/O, no network, no randomness, no `Date.now()`, no LLM
  calls inside the engine. Determinism is the whole point.
- **Full-precision math.** Never round intermediate values. Rounding to cents is a
  display concern only. We check `unit_cost` / `unit_price` to **5 decimal places**.
- **Don't change the signatures** in `engine.ts` or the types in `types.ts`. An
  automated grader imports them by name.
- **Write your own tests.** We grade your tests as well as your engine.

## Getting started

```bash
npm install
npm run dev      # opens the UI at http://localhost:5173 — shows "not implemented" until you build the engine
npm test         # runs the PUBLIC sanity tests (the #26144 anchor only)
```

Work against `npm test` and the UI's green/red "Check" column for the #26144 anchor.
Passing those is necessary but **not sufficient** — see the note in the test file.

## What "done" looks like

1. `npm test` is green.
2. In the UI (`npm run dev`), the #26144 price ladder shows **PASS** on every row, and
   the cost stack, confidence badge, and the send-gate behave as described in `SPEC.md`.
3. Your own tests cover the edge cases and validation in `SPEC.md`.

## Submitting

Commit your work (including your tests) and send us the repo (zip or git link). Include
a short `NOTES.md`: anything you reverse-engineered and weren't sure about, any
assumptions, and what you'd add next with more time.

Good luck.

---

# Solution — Submission

> Everything above is the original take-home brief. This section documents the
> completed submission.

The quote engine in [`src/engine/engine.ts`](./src/engine/engine.ts) is fully
implemented. All nine functions are done; every formula was **reverse-engineered from
the worked examples in [`SPEC.md`](./SPEC.md)** (the spec deliberately withholds them)
and verified to **5 decimal places** against examples A, B, and C.

## Status

| Check | Result |
|---|---|
| `npm test` (public #26144 anchor) | ✅ 4 / 4 pass |
| `tests/engine.mine.spec.ts` (my edge-case suite) | ✅ 36 / 36 pass |
| `tsc --noEmit` typecheck | ✅ clean |
| `npm run build` (incl. provided UI) | ✅ builds |

## How to run

```bash
npm install
npm test          # public anchor tests
npx vitest run    # full suite (public + my own tests)
npm run dev       # UI at http://localhost:5173 — #26144 ladder shows PASS on every row
```

## What was implemented

- **`shotWeight`** — `cav*part_g + runner_g`.
- **`weightFromVolume`** — converts CAD volume to cm³ first (inch ×16.387064, mm ÷1000,
  cm ×1), then × density. Never assumes millimeters.
- **`costStack`** — the seven per-part components: `material` (resin + colorant per lb),
  `purge` / `setup` (one-time costs amortized over `order_qty`), `molding` (machine rate
  ÷ parts-per-hour), and the optional `insert` / `secondary` / `outside` branches.
- **`sellPrice`** — `total × (1 + scrap%) × (1 + markup%)` (markup, **not** margin).
- **`resolveMarkupTier`**, **`priceLadder`** (with optional tooling amortization),
  **`toolingEstimate`**, **`confidenceScore`**, and **`validateQuoteInput`**.

## Where to look

- **Engine:** [`src/engine/engine.ts`](./src/engine/engine.ts)
- **My tests:** [`tests/engine.mine.spec.ts`](./tests/engine.mine.spec.ts) — covers
  examples B & C, amortization, unit conversion, tier boundaries, the `cav === 0` edge,
  and validation order.
- **Reverse-engineering notes & assumptions:** [`NOTES.md`](./NOTES.md) — including the
  one genuine ambiguity (the insert-freight denominator) and how the SPEC hint resolved it.
