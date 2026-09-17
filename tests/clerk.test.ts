import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decideClerk, decisionToAction, type ClerkContext } from "../src/clerk.js";
import { computeLtvState } from "../src/ltv.js";
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

function makeBook(overrides: Partial<BookState> = {}): BookState {
  return {
    symbol: "rNVDAUSDT",
    collateralNotional: 0,
    perpNotional: 0,
    debt: 0,
    cash: 10_000,
    equity: 10_000,
    ...overrides,
  };
}

function buildLtv(book: BookState) {
  return computeLtvState(MANDATE, book, null, { liveLoan: false });
}

function baseCtx(overrides: Partial<ClerkContext> = {}): ClerkContext {
  const book = makeBook();
  return {
    mandate: MANDATE,
    session: "OVERNIGHT",
    book,
    ltv: buildLtv(book),
    lockOk: true,
    rtokenMid: 215.75,
    previousCloseMid: null,
    overnightTicket: null,
    ticketFired: false,
    today: "2026-09-17",
    ...overrides,
  };
}

describe("overnight BUY → REFUSE", () => {
  it("requested BUY_RTOKEN is REFUSE even when LTV is safe", () => {
    const d = decideClerk(baseCtx({ requested: "BUY_RTOKEN" }));
    assert.equal(d.intent, "REFUSE");
    assert.match(d.reason, /overnight_new_risk/i);
    assert.equal(decisionToAction(d), "REFUSE");
  });

  it("requested BUY_RTOKEN is REFUSE when LTV is also critical", () => {
    const book = makeBook({ debt: 833, collateralNotional: 1000 });
    const d = decideClerk(baseCtx({
      book,
      ltv: buildLtv(book),
      requested: "BUY_RTOKEN",
    }));
    assert.equal(d.intent, "REFUSE");
    assert.match(d.reason, /overnight_new_risk/i);
  });
});

describe("overnight high LTV → DELEVER (REPAY)", () => {
  it("REPAY intent when debt is available", () => {
    // mandate: shock_btc -0.05, beta 0.4 → factor 0.98
    // proj = 833 / (1000 * 0.98) = 0.85 → mustDelever = true
    const book = makeBook({ debt: 833, collateralNotional: 1000 });
    const d = decideClerk(baseCtx({ book, ltv: buildLtv(book) }));
    assert.equal(d.intent, "REPAY");
    assert.ok(d.amount > 0, `repay amount should be positive, got ${d.amount}`);
    assert.equal(decisionToAction(d), "REPAY");
    assert.match(d.reason, /DELEVER/i);
  });
});

describe("open window without arm → STAND", () => {
  it("no armed ticket → HOLD intent → STAND action", () => {
    const d = decideClerk(baseCtx({ session: "OPEN_WINDOW", ticketFired: false, overnightTicket: null }));
    assert.equal(d.intent, "HOLD", "intent is HOLD when no armed ticket");
    assert.equal(decisionToAction(d), "STAND", "HOLD maps to STAND action");
  });

  it("ticket already fired this window → HOLD → STAND (max 1)", () => {
    const d = decideClerk(baseCtx({ session: "OPEN_WINDOW", ticketFired: true }));
    assert.equal(d.intent, "HOLD");
    assert.equal(decisionToAction(d), "STAND");
  });
});

describe("overnight lock → REFUSE", () => {
  it("lockOk false overnight → REFUSE carrying the lock reason", () => {
    const d = decideClerk(baseCtx({
      lockOk: false,
      lockReason: "missing_autopsy_hash: no autopsy since close 2026-09-17",
    }));
    assert.equal(d.intent, "REFUSE");
    assert.match(d.reason, /missing_autopsy_hash/);
    assert.equal(decisionToAction(d), "REFUSE");
  });
});

describe("FIRE requires the autopsy hash chain", () => {
  const ticket = {
    date: "2026-09-17",
    symbol: "rNVDAUSDT",
    side: "buy" as const,
    price: 220,
    notionalUsdt: 4000,
    active: true,
    reason: "armed",
  };

  it("armed ticket hit but lock broken → REFUSE (no FIRE)", () => {
    const d = decideClerk(baseCtx({
      session: "OPEN_WINDOW",
      ticketFired: false,
      overnightTicket: ticket,
      rtokenMid: 215,
      lockOk: false,
      lockReason: "missing_autopsy_hash: no autopsy since close 2026-09-17",
    }));
    assert.equal(d.intent, "REFUSE");
    assert.match(d.reason, /missing_autopsy_hash/);
    assert.equal(decisionToAction(d), "REFUSE");
  });

  it("armed ticket hit with lock ok → FIRE", () => {
    const d = decideClerk(baseCtx({
      session: "OPEN_WINDOW",
      ticketFired: false,
      overnightTicket: ticket,
      rtokenMid: 215,
      lockOk: true,
    }));
    assert.equal(d.intent, "FIRE_ARMED");
    assert.equal(decisionToAction(d), "FIRE");
  });
});

describe("open window ticket date gate", () => {
  const futureTicket = {
    date: "2026-09-18", // armed for tomorrow, not today (2026-09-17)
    symbol: "rNVDAUSDT",
    side: "buy" as const,
    price: 220,
    notionalUsdt: 4000,
    active: true,
    reason: "armed",
  };

  it("ticket armed for tomorrow does not fire today, even on a price hit", () => {
    const d = decideClerk(baseCtx({
      session: "OPEN_WINDOW",
      ticketFired: false,
      overnightTicket: futureTicket,
      rtokenMid: 215, // below threshold
      lockOk: true,
    }));
    assert.equal(d.intent, "HOLD");
    assert.match(d.reason, /not today/);
    assert.equal(decisionToAction(d), "STAND");
  });
});

describe("overnight ARM dedupe and target date", () => {
  // Healthy book so LTV is safe and the overnight branch reaches ARM.
  const book = makeBook({ collateralNotional: 1000 });
  const safe = { book, ltv: buildLtv(book) };

  it("does not re-arm when a ticket is already armed for the next session", () => {
    const ticket = {
      date: "2026-09-18", // next session after 2026-09-17
      symbol: "rNVDAUSDT",
      side: "buy" as const,
      price: 220,
      notionalUsdt: 4000,
      active: true,
      reason: "armed",
    };
    const d = decideClerk(baseCtx({ session: "OVERNIGHT", overnightTicket: ticket, ...safe }));
    assert.equal(d.intent, "HOLD");
    assert.match(d.reason, /already armed for 2026-09-18/);
  });

  it("arms with targetDate = next session when none is armed", () => {
    const d = decideClerk(baseCtx({ session: "OVERNIGHT", previousCloseMid: 215.75, ...safe }));
    assert.equal(d.intent, "ARM");
    if (d.intent !== "ARM") throw new Error("unreachable");
    assert.equal(d.targetDate, "2026-09-18");
    assert.match(d.reason, /for 2026-09-18/);
  });

  it("re-arms (new target) when the stored ticket is for a stale date", () => {
    const stale = {
      date: "2026-09-16",
      symbol: "rNVDAUSDT",
      side: "buy" as const,
      price: 220,
      notionalUsdt: 4000,
      active: true,
      reason: "armed",
    };
    const d = decideClerk(baseCtx({ session: "OVERNIGHT", overnightTicket: stale, previousCloseMid: 215.75, ...safe }));
    assert.equal(d.intent, "ARM");
    if (d.intent !== "ARM") throw new Error("unreachable");
    assert.equal(d.targetDate, "2026-09-18");
  });
});

describe("decisionToAction mapping", () => {
  it("all intents map to the expected action", () => {
    assert.equal(decisionToAction({ intent: "REFUSE", reason: "x" }), "REFUSE");
    assert.equal(decisionToAction({ intent: "HOLD", reason: "x" }), "STAND");
    assert.equal(decisionToAction({ intent: "ARM", ladder: [100], targetDate: "2026-09-18", reason: "x" }), "ARM");
    assert.equal(decisionToAction({ intent: "BUY_RTOKEN", reason: "x" }), "BUY");
    assert.equal(decisionToAction({ intent: "REPAY", amount: 100, reason: "x" }), "REPAY");
    assert.equal(decisionToAction({ intent: "REDUCE_PERP", notional: 100, reason: "x" }), "REDUCE_PERP");
    assert.equal(decisionToAction({ intent: "ADD_COLLATERAL", amount: 100, reason: "x" }), "DELEVER");
    assert.equal(decisionToAction({ intent: "FIRE_ARMED", ticketNotional: 100, reduceOffset: 0, reason: "x" }), "FIRE");
  });
});
