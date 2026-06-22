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
