import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAutopsyBase } from "../src/autopsy.js";
import type { CashClose, LogRecord } from "../src/types.js";

// 2026-09-16 19:20 ET === 2026-09-16T23:20:00Z (EDT, UTC-4)
const CLOSE: CashClose = {
  date: "2026-09-16",
  at: "2026-09-16T23:20:00.000Z",
  rtokenMid: 215,
  perpMid: 76000,
  sessionTaxBps: 0,
  source: "close",
};

function row(over: Partial<LogRecord>): LogRecord {
  return {
    ts: "2026-09-17T00:00:00.000Z",
    et: "2026-09-16T20:00",
    account: "haircut",
    session: "OVERNIGHT",
    action: "ARM",
    symbol: "rNVDAUSDT",
    px: 0,
    qty: 0,
    notional: 0,
    equity: 10000,
    ltv: 0,
    proj_ltv: 0,
    tax_bps: 0,
    btc_move_since_close: 0,
    reason: "x",
    hash: null,
    ok: true,
    hub: "paper",
    ...over,
  };
}

describe("buildAutopsyBase", () => {
  const overnightLow = row({ ts: "2026-09-17T01:00:00.000Z", px: 205, ltv: 0.1 });
  const overnightHigh = row({ ts: "2026-09-17T02:00:00.000Z", px: 213, ltv: 0.11 });
  const openNaive = row({
    ts: "2026-09-17T13:31:00.000Z",
    account: "naive",
    session: "OPEN_WINDOW",
    action: "STAND",
    px: 214,
    ltv: 0,
  });

  it("records FIRE and the overnight/window range", () => {
    const fire = row({
      ts: "2026-09-17T13:30:00.000Z",
      session: "OPEN_WINDOW",
      action: "FIRE",
      px: 214,
      ltv: 0.12,
    });
    const base = buildAutopsyBase({
      date: "2026-09-17",
      cashClose: CLOSE,
      openMid: 214.5,
      openPerpMid: 76320,
      logRows: [overnightLow, overnightHigh, fire, openNaive],
    });
    assert.equal(base.date, "2026-09-17");
    assert.equal(base.cash_close, 215);
    assert.equal(base.overnight_rtoken_high, 215); // close is the high
    assert.equal(base.overnight_rtoken_low, 205);
    assert.equal(base.open_vwap_or_mid_0930_0945, 214);
    assert.equal(base.haircut_action_at_open, "FIRE");
    assert.equal(base.btc_move, 0.0042);
    assert.equal(base.peak_ltv_haircut, 0.12);
    assert.equal(base.peak_ltv_naive, 0);
    // |214/215 - 1| * 10000 = 46.5 -> 47
    assert.equal(base.tax_vs_open_bps, 47);
  });

  it("records STAND when the window produced no FIRE", () => {
    const base = buildAutopsyBase({
      date: "2026-09-17",
      cashClose: CLOSE,
      openMid: 214.5,
      openPerpMid: 76320,
      logRows: [overnightLow, overnightHigh, openNaive],
    });
    assert.equal(base.haircut_action_at_open, "STAND");
    assert.equal(base.open_vwap_or_mid_0930_0945, 214.5); // falls back to current mid
  });

  it("ignores rows that predate the cash close", () => {
    const beforeClose = row({ ts: "2026-09-16T20:00:00.000Z", px: 999, ltv: 0.5 });
    const base = buildAutopsyBase({
      date: "2026-09-17",
      cashClose: CLOSE,
      openMid: 214.5,
      openPerpMid: 0,
      logRows: [beforeClose, overnightLow],
    });
    assert.equal(base.overnight_rtoken_high, 215); // 999 excluded
    assert.equal(base.overnight_rtoken_low, 205);
    assert.equal(base.peak_ltv_haircut, 0.1); // 0.5 excluded
    assert.equal(base.btc_move, 0); // no open perp mid
  });

  it("handles a missing cash close (night one)", () => {
    const base = buildAutopsyBase({
      date: "2026-09-17",
      cashClose: null,
      openMid: 214,
      openPerpMid: 76320,
      logRows: [overnightLow],
    });
    assert.equal(base.cash_close, 0);
    assert.equal(base.btc_move, 0);
    assert.equal(base.tax_vs_open_bps, 0);
    assert.equal(base.overnight_rtoken_low, 205);
    assert.equal(base.overnight_rtoken_high, 214);
  });
});
