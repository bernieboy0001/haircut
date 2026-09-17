import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bookImpactBps, maxFillableNotional, sessionTaxBps } from "../src/tax.js";
import type { CashClose } from "../src/types.js";

function makeClose(rtokenMid: number): CashClose {
  return {
    date: "2026-09-16",
    at: "2026-09-16T20:00:00.000Z",
    rtokenMid,
    perpMid: 75000,
    sessionTaxBps: 0,
    source: "close",
  };
}

describe("bookImpactBps", () => {
  it("returns finite bps for a well-filled order", () => {
    const asks: [number, number][] = [
      [100, 1],  // 100 USDT
      [101, 20], // 2020 USDT
    ];
    const impact = bookImpactBps(asks, 500, 100);
    assert.ok(Number.isFinite(impact), "expected finite impact");
    assert.ok(impact > 0, "expected positive slippage");
  });

  it("returns Infinity when book depth is insufficient", () => {
    const asks: [number, number][] = [[100, 1]]; // only 100 USDT visible
    const impact = bookImpactBps(asks, 1000, 100); // need 1000
    assert.equal(impact, Infinity, "visible depth < buyNotional → Infinity");
  });

  it("returns Infinity for empty asks", () => {
    assert.equal(bookImpactBps([], 1000, 100), Infinity);
  });

  it("returns Infinity when mid is zero", () => {
    assert.equal(bookImpactBps([[100, 10]], 100, 0), Infinity);
  });

  it("returns Infinity when buyNotional is zero", () => {
    assert.equal(bookImpactBps([[100, 10]], 0, 100), Infinity);
  });
});

describe("maxFillableNotional", () => {
  it("sums level notional correctly", () => {
    const asks: [number, number][] = [
      [99, 2],   // 198
      [100, 10], // 1000
    ];
    assert.equal(maxFillableNotional(asks), 1198);
  });

  it("returns 0 for empty asks", () => {
    assert.equal(maxFillableNotional([]), 0);
  });
});

describe("sessionTaxBps", () => {
  it("natural bps when mid is above close", () => {
    const close = makeClose(100);
    const bps = sessionTaxBps(101, close, 0);
    // |101/100 - 1| * 10000 = 100 bps
    assert.equal(bps, 100);
  });

  it("clamped to 0 when mid equals close", () => {
    assert.equal(sessionTaxBps(100, makeClose(100), 0), 0);
  });

  it("clamped at 500 for large moves", () => {
    assert.equal(sessionTaxBps(200, makeClose(100), 0), 500);
  });

  it("returns max(impactBps, 0) when close is invalid", () => {
    const badClose = makeClose(0);
    assert.equal(sessionTaxBps(100, badClose, 25), 25);
  });
});
