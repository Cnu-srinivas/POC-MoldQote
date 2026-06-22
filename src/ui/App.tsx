import { useMemo, useState } from "react";
import {
  costStack,
  priceLadder,
  confidenceScore,
  toolingEstimate,
  validateQuoteInput,
} from "../engine/engine";
import type { CostInputs, ConfidenceFactors } from "../engine/types";
import {
  SEED_MARKUP_TIERS,
  ANCHOR_26144,
  ANCHOR_QTYS,
  ANCHOR_EXPECTED,
} from "../engine/seed";

const money = (n: number, dp = 2) =>
  Number.isFinite(n) ? n.toFixed(dp) : "—";

const NUM_FIELDS: [keyof CostInputs, string][] = [
  ["cav", "Cavities"],
  ["part_g", "Part wt (g)"],
  ["runner_g", "Runner wt (g)"],
  ["resin_lb", "Resin $/lb"],
  ["color_lb", "Color $/lb"],
  ["color_pct", "Color %"],
  ["purge_lbs", "Purge lbs"],
  ["machine_rate", "Machine $/hr"],
  ["cycle_s", "Cycle (s)"],
  ["setup_hours", "Setup hrs"],
  ["setup_rate", "Setup $/hr"],
  ["scrap_pct", "Scrap %"],
];

export function App() {
  const [inputs, setInputs] = useState<CostInputs>({ ...ANCHOR_26144 });
  const [toolingCost, setToolingCost] = useState(12750);
  const [toolingSeparate, setToolingSeparate] = useState(true);
  const [ownerOverride, setOwnerOverride] = useState(false);

  // Confidence factors mirror the #26144 acceptance quote (tooling is an override, so it loses points).
  const factors: ConfidenceFactors = {
    material_matched: true,
    weight_from_cad: true,
    tonnage_within_capacity: true,
    cavitation_confirmed: true,
    cycle_from_cad: true,
    tooling_from_quote: false,
    qty_present_sane: true,
    tolerances_readable: true,
  };

  const set = (k: keyof CostInputs, v: string) =>
    setInputs((p) => ({ ...p, [k]: v === "" ? 0 : Number(v) }));

  const result = useMemo(() => {
    try {
      validateQuoteInput(inputs, ANCHOR_QTYS);
      const lines = priceLadder(
        inputs,
        ANCHOR_QTYS,
        SEED_MARKUP_TIERS,
        toolingCost,
        toolingSeparate,
      );
      const stack = costStack(inputs, ANCHOR_QTYS[ANCHOR_QTYS.length - 1]);
      const conf = confidenceScore(factors);
      const tooling = toolingEstimate({
        tooling_class: "103",
        cavities: inputs.cav,
        size_factor: 1.0,
        complexity_factor: 1.0,
        finish_material_factor: 1.0,
        runner_adder: 0,
      });
      return { lines, stack, conf, tooling, error: null as string | null };
    } catch (e) {
      return { error: (e as Error).message } as any;
    }
  }, [inputs, toolingCost, toolingSeparate]);

  const isAnchor =
    JSON.stringify(inputs) === JSON.stringify(ANCHOR_26144) &&
    toolingSeparate;

  const blocked = result.conf && result.conf.score < 60 && !ownerOverride;

  return (
    <div className="wrap">
      <h1>MoldQuote AI — Quote Calculator</h1>
      <p className="sub">
        Deterministic engine demo · part #26144 (Nylon 6, 33% GF) preloaded ·
        edit any input to recompute live
      </p>

      <div className="grid">
        {/* ---------------- INPUTS ---------------- */}
        <div>
          <div className="panel">
            <h2>Confirmed Inputs</h2>
            <div className="row2">
              {NUM_FIELDS.map(([k, label]) => (
                <div key={k}>
                  <label>{label}</label>
                  <input
                    className="mono"
                    type="number"
                    value={String(inputs[k])}
                    onChange={(e) => set(k, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <button
              style={{ marginTop: 14 }}
              onClick={() => {
                setInputs({ ...ANCHOR_26144 });
                setToolingCost(12750);
                setToolingSeparate(true);
              }}
            >
              Reset to #26144
            </button>
          </div>

          <div className="panel">
            <h2>Tooling</h2>
            <label>Tooling cost (toolmaker quote / override)</label>
            <input
              className="mono"
              type="number"
              value={String(toolingCost)}
              onChange={(e) => setToolingCost(Number(e.target.value))}
            />
            <div className="flex" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={toolingSeparate}
                onChange={(e) => setToolingSeparate(e.target.checked)}
              />
              <span className="muted">
                Bill tooling as a separate one-time line (default)
              </span>
            </div>
            <p className="note">
              Parametric point estimate (class 103):{" "}
              <span className="mono">
                {result.tooling ? `$${money(result.tooling.point, 0)}` : "—"}
              </span>
            </p>
          </div>
        </div>

        {/* ---------------- OUTPUT ---------------- */}
        <div>
          {result.error ? (
            <div className="panel">
              <h2>Engine output</h2>
              <div className="err">
                {result.error.startsWith("NotImplemented")
                  ? "Engine not implemented yet — implement src/engine/engine.ts and this view comes alive.\n\n" +
                    result.error
                  : result.error}
              </div>
            </div>
          ) : (
            <>
              {/* Confidence + gate */}
              <div className="panel">
                <div className="between">
                  <h2 style={{ margin: 0 }}>Confidence</h2>
                  <span className={`badge ${result.conf.band}`}>
                    {result.conf.score} · {result.conf.band.toUpperCase()}
                  </span>
                </div>
                <div className="between" style={{ marginTop: 14 }}>
                  <label className="flex" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      style={{ width: "auto" }}
                      checked={ownerOverride}
                      onChange={(e) => setOwnerOverride(e.target.checked)}
                    />
                    <span className="muted">Owner override</span>
                  </label>
                  <button disabled={blocked}>
                    {blocked ? "Send blocked (confidence < 60)" : "Send quote"}
                  </button>
                </div>
              </div>

              {/* Cost stack */}
              <div className="panel">
                <h2>Cost stack — $/part @ {ANCHOR_QTYS[ANCHOR_QTYS.length - 1].toLocaleString()}</h2>
                <table className="mono">
                  <tbody>
                    {(
                      [
                        ["Material", result.stack.material],
                        ["Purge", result.stack.purge],
                        ["Molding", result.stack.molding],
                        ["Setup", result.stack.setup],
                        ["Insert", result.stack.insert],
                        ["Secondary", result.stack.secondary],
                        ["Outside", result.stack.outside],
                      ] as [string, number][]
                    ).map(([k, v]) => (
                      <tr key={k}>
                        <td>{k}</td>
                        <td>{money(v, 5)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td>
                        <strong>Total cost</strong>
                      </td>
                      <td>
                        <strong>{money(result.stack.total, 5)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="note">
                  Shot weight {money(result.stack.shot_g, 1)} g · parts/hr{" "}
                  {money(result.stack.parts_per_hour, 1)}
                </p>
              </div>

              {/* Price ladder */}
              <div className="panel">
                <h2>Volume-break price ladder</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Qty</th>
                      <th>Unit cost</th>
                      <th>Markup</th>
                      <th>Unit price</th>
                      {isAnchor && <th>Published</th>}
                      {isAnchor && <th>Check</th>}
                    </tr>
                  </thead>
                  <tbody className="mono">
                    {result.lines.map((ln: any, i: number) => {
                      const exp = ANCHOR_EXPECTED.lines[i];
                      const disp = Math.round(ln.unit_price * 100) / 100;
                      const pass =
                        isAnchor &&
                        Math.abs(ln.unit_cost - exp.unit_cost) < 0.000005 &&
                        disp === exp.unit_price_display;
                      return (
                        <tr key={ln.order_qty}>
                          <td>{ln.order_qty.toLocaleString()}</td>
                          <td>{money(ln.unit_cost, 5)}</td>
                          <td>{money(ln.markup_pct, 1)}%</td>
                          <td>${money(disp, 2)}</td>
                          {isAnchor && <td>${money(exp.unit_price_display, 2)}</td>}
                          {isAnchor && (
                            <td>
                              <span className={`pill ${pass ? "pass" : "fail"}`}>
                                {pass ? "PASS" : "FAIL"}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="tooling-line">
                  <span>
                    Tooling{" "}
                    <span className="muted">
                      ({toolingSeparate ? "separate one-time line" : "amortized into piece price"})
                    </span>
                  </span>
                  <span className="mono">${money(toolingCost, 0)}</span>
                </div>

                {isAnchor && (
                  <p className="note">
                    Green = engine reproduces the published Central Plastics quote
                    for #26144. This panel only validates the public anchor; the
                    hidden grader checks the adversarial cases.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
