import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateOvernightLock,
  canonicalAutopsyJson,
  hashAutopsy,
} from "../src/lock.js";
import type { Autopsy } from "../src/types.js";

function sampleAutopsy(): Omit<Autopsy, "hash"> {
  return {
    date: "2026-09-16",
    cash_close: 215.0,
    overnight_rtoken_high: 220.0,
    overnight_rtoken_low: 210.0,
    btc_move: -0.01,
    peak_ltv_haircut: 0.82,
    peak_ltv_naive: 0,
    open_vwap_or_mid_0930_0945: 215.75,
    tax_vs_open_bps: 12,
    haircut_action_at_open: "STAND",
  };
}

describe("evaluateOvernightLock", () => {
  const base = {
    lastHash: null as string | null,
    closeCount: 0,
    lastCloseDate: null as string | null,
    autopsyDates: [] as string[],
    newestAutopsyHash: null as string | null,
  };

  it("no close yet → ok (nothing to cover)", () => {
    assert.equal(evaluateOvernightLock(base).ok, true);
  });

  it("first close, no autopsy yet → ok (night one)", () => {
    const res = evaluateOvernightLock({ ...base, closeCount: 1, lastCloseDate: "2026-09-16" });
    assert.equal(res.ok, true);
    assert.match(res.reason, /first night/i);
  });

  it("second close with no autopsy → fail (missing hash)", () => {
    const res = evaluateOvernightLock({ ...base, closeCount: 2, lastCloseDate: "2026-09-17" });
    assert.equal(res.ok, false);
    assert.match(res.reason, /missing_autopsy_hash/i);
  });

  it("autopsy present and hash present → ok", () => {
    const res = evaluateOvernightLock({
      lastHash: "abc123def456",
      closeCount: 2,
      lastCloseDate: "2026-09-17",
      autopsyDates: ["2026-09-17"],
      newestAutopsyHash: "abc123def456",
    });
    assert.equal(res.ok, true);
    assert.match(res.reason, /chain locked/);
  });

  it("autopsy file present but hash absent → fail", () => {
    const res = evaluateOvernightLock({
      lastHash: null,
      closeCount: 2,
      lastCloseDate: "2026-09-17",
      autopsyDates: ["2026-09-17"],
      newestAutopsyHash: "abc123def456",
    });
    assert.equal(res.ok, false);
    assert.match(res.reason, /hash file absent/i);
  });

  it("stored hash does not match the newest autopsy → fail (mismatch)", () => {
    const res = evaluateOvernightLock({
      lastHash: "abc123def456",
      closeCount: 2,
      lastCloseDate: "2026-09-17",
      autopsyDates: ["2026-09-17"],
      newestAutopsyHash: "deadbeef0000",
    });
    assert.equal(res.ok, false);
    assert.match(res.reason, /chain hash mismatch/i);
  });

  it("a close newer than the newest autopsy → fail (stale chain)", () => {
    const res = evaluateOvernightLock({
      lastHash: "abc123def456",
      closeCount: 3,
      lastCloseDate: "2026-09-18",
      autopsyDates: ["2026-09-17"],
      newestAutopsyHash: "abc123def456",
    });
    assert.equal(res.ok, false);
    assert.match(res.reason, /no autopsy since close 2026-09-18/i);
  });
});

describe("canonicalAutopsyJson", () => {
  it("returns a stable string with keys sorted", () => {
    const a = canonicalAutopsyJson(sampleAutopsy());
    const b = canonicalAutopsyJson(sampleAutopsy());
    assert.equal(a, b, "same input → same canonical string");
    const parsed = JSON.parse(a);
    const keys = Object.keys(parsed);
    const sorted = [...keys].sort();
    assert.deepEqual(keys, sorted, "keys are sorted alphabetically");
  });

  it("omits hash field if accidentally included", () => {
    const withHash = { ...sampleAutopsy(), hash: "should-not-appear" } as any;
    const canon = canonicalAutopsyJson(withHash);
    assert.ok(!canon.includes("hash"), "hash field must not appear in canonical form");
  });
});

describe("hashAutopsy", () => {
  it("returns a 64-character hex string (SHA-256)", () => {
    const h = hashAutopsy(sampleAutopsy());
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  it("deterministic for the same input", () => {
    assert.equal(hashAutopsy(sampleAutopsy()), hashAutopsy(sampleAutopsy()));
  });

  it("different input produces different hash", () => {
    const base = hashAutopsy(sampleAutopsy());
    const changed = hashAutopsy({ ...sampleAutopsy(), cash_close: 999 });
    assert.notEqual(base, changed);
  });

  it("ignores the hash field when computing the hash", () => {
    const h1 = hashAutopsy(sampleAutopsy());
    const h2 = hashAutopsy({ ...sampleAutopsy(), hash: "abc" } as any);
    assert.equal(h1, h2, "hash field is excluded from canonical computation");
  });
});
