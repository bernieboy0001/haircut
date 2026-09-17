import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { projectLtv, ltvFromState, computeLtvState } from "../src/ltv.js";
import type { BookState, Mandate } from "../src/types.js";

const MANDATE: Mandate = {
  name: "haircut",
  quote: "USDT",
  equity_start: "10000",
  sleeve: {
    rtoken: "rNVDAUSDT",
    perp: "BTCUSDT",
    perp_leverage: 3,
    max_rtoken_notional: "4000",
    max_perp_notional: "2000",
  },
  ltv: {
    initial: 0.78,
    call: 0.85,
    liq: 0.91,
    target_after_delever: 0.80,
  },
  shock_btc: -0.05,
  beta_rtoken_to_btc: 0.4,
  open_window_et: ["09:30", "09:45"],
  cash_close_et: "16:00",
  max_actions_per_open: 1,
  allow_overnight: ["refuse", "repay", "add_collateral", "reduce_perp", "arm"],
};

describe("projectLtv", () => {
  it("-5% BTC raises projected LTV above unshocked LTV (beta=1)", () => {
    const debt = 1000;
    const collateral = 2000;
    const baseline = ltvFromState({ debt, collateralMark: collateral });
    const projected = projectLtv(debt, collateral, -0.05, 1);
    // collateral drops 5% → 1900 → 1000/1900 = 0.5263 vs baseline 0.5
    assert.ok(projected > baseline, `expected projLtv ${projected} > baseline ${baseline}`);
    assert.ok(Math.abs(projected - 1000 / 1900) < 1e-10);
  });

  it("positive BTC move lowers projected LTV", () => {
    const projected = projectLtv(1000, 2000, 0.05, 1);
    // collateral grows 5% → 2100 → 1000/2100 = 0.476
    assert.ok(projected < 1000 / 2000);
    assert.ok(Math.abs(projected - 1000 / 2100) < 1e-10);
  });

  it("beta=0 means BTC shock has no effect", () => {
    const projected = projectLtv(1000, 2000, -0.05, 0);
    assert.equal(projected, 0.5);
  });
});

describe("ltvFromState", () => {
  it("debt / collateral = LTV", () => {
    assert.equal(ltvFromState({ debt: 1000, collateralMark: 2000 }), 0.5);
  });

  it("returns 1 when collateral is zero (fully impaired)", () => {
    assert.equal(ltvFromState({ debt: 1000, collateralMark: 0 }), 1);
  });
});

describe("computeLtvState — mustDelever", () => {
  function buildBook(debt: number, collateralNotional: number): BookState {
    return {
      symbol: "rNVDAUSDT",
      collateralNotional,
      perpNotional: 0,
      debt,
      cash: 10_000 - collateralNotional,
      equity: 10_000,
    };
  }

  it("mustDelever=true when projected LTV hits exactly 0.85 with -5% shock", () => {
    // mandate.shock_btc = -0.05, beta = 0.4 → factor = 0.98
    // proj = debt / (collateral * 0.98) = 0.85  →  debt = 0.85 * 0.98 * 1000 = 833
    const book = buildBook(833, 1000);
    const state = computeLtvState(MANDATE, book, null, { liveLoan: false });
    assert.ok(state.mustDelever, "mustDelever should be true at proj 0.85");
    assert.ok(Math.abs(state.projLtv - 0.85) < 0.005, `projLtv ≈ 0.85, got ${state.projLtv}`);
  });

  it("mustDelever=false when projected LTV is safely below call", () => {
    const book = buildBook(500, 1000);
    const state = computeLtvState(MANDATE, book, null, { liveLoan: false });
    assert.ok(!state.mustDelever, "should not delever at safe LTV");
    assert.ok(state.projLtv < MANDATE.ltv.call);
  });

  it("mustDelever=true for extreme debt (collateral fully shocked away)", () => {
    // very high debt → projLtv would be way above call
    const book = buildBook(1000, 1000);
    const state = computeLtvState(MANDATE, book, null, { liveLoan: false });
    assert.ok(state.mustDelever, "100% debt ratio should trigger delever");
  });
});
