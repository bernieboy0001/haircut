import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { currentSession, etTimestamp, etDate } from "./clock.js";
import {
  placePaperOrder,
  marketTicker,
  orderBook,
} from "./hub.js";
import { computeLtvState } from "./ltv.js";
import {
  decideClerk,
  decisionToAction,
  loadArmedTicket,
  clearArmedTicket,
  saveArmedTicket,
} from "./clerk.js";
import {
  decideNaive,
  markNaiveBought,
} from "./naive.js";
import {
  appendLog,
  appendEvent,
  ensureLogs,
} from "./snapshot.js";
import { loadLastHash, evaluateOvernightLock } from "./lock.js";
import { rebuildScoreboard } from "./scoreboard.js";
import type { BookState, Decision, LogRecord, Mandate, Marks, Session } from "./types.js";

// --- mandate --------------------------------------------------------------

function loadMandateJson(): Mandate {
  const raw = readFileSync(join(process.cwd(), "mandate.json"), "utf-8");
  return JSON.parse(raw) as Mandate;
}

// --- overnight lock check -------------------------------------------------

function loadAutopsyIndex(): { dates: string[]; newestHash: string | null } {
  let dates: string[] = [];
  try {
    dates = readdirSync(join(process.cwd(), "logs", "autopsies"))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -5))
      .sort();
  } catch {
    dates = [];
  }
  const newest = dates.at(-1) ?? null;
  let newestHash: string | null = null;
  if (newest) {
    try {
      const a = JSON.parse(
        readFileSync(join(process.cwd(), "logs", "autopsies", `${newest}.json`), "utf-8")
      ) as { hash?: unknown };
      newestHash = typeof a.hash === "string" ? a.hash : null;
    } catch {
      newestHash = null;
    }
  }
  return { dates, newestHash };
}

function loadCloseCount(): number {
  try {
    const n = Number.parseInt(
      readFileSync(join(process.cwd(), "state", "close_count.txt"), "utf-8").trim(),
      10
    );
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function loadCloseDate(): string | null {
  try {
    const c = JSON.parse(
      readFileSync(join(process.cwd(), "state", "last_cash_close.json"), "utf-8")
    ) as { date?: unknown };
    return typeof c.date === "string" ? c.date : null;
  } catch {
    return null;
  }
}

function loadPreviousCloseMid(): number | null {
  try {
    const c = JSON.parse(
      readFileSync(join(process.cwd(), "state", "last_cash_close.json"), "utf-8")
    ) as { rtokenMid?: unknown };
    return typeof c.rtokenMid === "number" && c.rtokenMid > 0 ? c.rtokenMid : null;
  } catch {
    return null;
  }
}

// --- haircut execution ----------------------------------------------------

async function executeHaircut(decision: Decision, mandate: Mandate, ctx: {
  session: Session;
  et: string;
  rtokenMid: number;
  perpMid: number;
  ltv: number;
  projLtv: number;
  equity: number;
  taxBps: number;
  btcMoveSinceClose: number;
  lastHash: string | null;
}): Promise<void> {
  const action = decisionToAction(decision);

  if (decision.intent === "BUY_RTOKEN" || decision.intent === "FIRE_ARMED") {
    const notional =
      decision.intent === "FIRE_ARMED"
        ? decision.ticketNotional
        : Number(mandate.sleeve.max_rtoken_notional);
    const res = await placePaperOrder(mandate.sleeve.rtoken, mandate, "buy", notional, {
      market: true,
      reduceOnly: false,
      referencePrice: 0,
    });
    appendLog({
      ts: new Date().toISOString(),
      et: ctx.et,
      account: "haircut",
      session: ctx.session,
      action,
      symbol: mandate.sleeve.rtoken,
      px: ctx.rtokenMid,
      qty: notional,
      notional,
      equity: ctx.equity,
      ltv: ctx.ltv,
      proj_ltv: ctx.projLtv,
      tax_bps: ctx.taxBps,
      btc_move_since_close: ctx.btcMoveSinceClose,
      reason: decision.reason,
      hash: ctx.lastHash,
      ok: res.ok,
      hub: "paper",
    });
    if (res.ok) clearArmedTicket();
  }

  if (decision.intent === "REDUCE_PERP") {
    const res = await placePaperOrder(mandate.sleeve.perp, mandate, "sell", decision.notional, {
      market: true,
      reduceOnly: true,
      referencePrice: 0,
    });
    appendLog({
      ts: new Date().toISOString(),
      et: ctx.et,
      account: "haircut",
      session: ctx.session,
      action: "REDUCE_PERP",
      symbol: mandate.sleeve.perp,
      px: ctx.perpMid,
      qty: decision.notional,
      notional: decision.notional,
      equity: ctx.equity,
      ltv: ctx.ltv,
      proj_ltv: ctx.projLtv,
      tax_bps: ctx.taxBps,
      btc_move_since_close: ctx.btcMoveSinceClose,
      reason: decision.reason,
      hash: ctx.lastHash,
      ok: res.ok,
      hub: "paper",
    });
  }

  if (decision.intent === "REPAY") {
    appendLog({
      ts: new Date().toISOString(),
      et: ctx.et,
      account: "haircut",
      session: ctx.session,
      action: "REPAY",
      symbol: mandate.sleeve.rtoken,
      px: ctx.rtokenMid,
      qty: 0,
      notional: decision.amount,
      equity: ctx.equity,
      ltv: ctx.ltv,
      proj_ltv: ctx.projLtv,
      tax_bps: ctx.taxBps,
      btc_move_since_close: ctx.btcMoveSinceClose,
      reason: decision.reason,
      hash: ctx.lastHash,
      ok: true,
      hub: "paper",
    });
  }

  if (decision.intent === "ARM") {
    saveArmedTicket({
      date: decision.targetDate,
      symbol: mandate.sleeve.rtoken,
      side: "buy",
      price: decision.ladder[0],
      notionalUsdt: Number(mandate.sleeve.max_rtoken_notional),
      active: true,
      reason: decision.reason,
    });
    appendLog({
      ts: new Date().toISOString(),
      et: ctx.et,
      account: "haircut",
      session: ctx.session,
      action: "ARM",
      symbol: mandate.sleeve.rtoken,
      px: decision.ladder[0],
      qty: 0,
      notional: Number(mandate.sleeve.max_rtoken_notional),
      equity: ctx.equity,
      ltv: ctx.ltv,
      proj_ltv: ctx.projLtv,
      tax_bps: ctx.taxBps,
      btc_move_since_close: ctx.btcMoveSinceClose,
      reason: decision.reason,
      hash: ctx.lastHash,
      ok: true,
      hub: "paper",
    });
  }
}

// --- main tick ------------------------------------------------------------

async function pullMarks(mandate: Mandate): Promise<Marks> {
  const rtok = await marketTicker(mandate.sleeve.rtoken, mandate);
  const perp = await marketTicker(mandate.sleeve.perp, mandate);
  const rtokenMid = rtok.ok && rtok.data ? Number(rtok.data.last) : 0;
  const perpMid = perp.ok && perp.data ? Number(perp.data.last) : 0;

  const bookOf = async (symbol: string, cat: (side: [number, number][]) => [number, number][]) => {
    const b = await orderBook(symbol, mandate);
    const d = b.ok && b.data ? b.data : null;
    return {
      ts: new Date().toISOString(),
      bids: d ? cat(d.bids) : [],
      asks: d ? cat(d.asks) : [],
    };
  };
  const norm = (side: [number, number][]): [number, number][] =>
    side.filter(([p, s]) => Number.isFinite(p) && Number.isFinite(s) && p > 0 && s > 0);

  return {
    at: new Date().toISOString(),
    source: "hub",
    mid: { rtoken: rtokenMid, perp: perpMid },
    book: {
      rtoken: await bookOf(mandate.sleeve.rtoken, norm),
      perp: await bookOf(mandate.sleeve.perp, norm),
    },
  };
}

export async function tick(): Promise<number> {
  ensureLogs();
  const mandate = loadMandateJson();
  const session = currentSession(mandate.open_window_et, mandate.cash_close_et);
  const et = etTimestamp();
  const lastHash = loadLastHash();

  // Marks via SDK
  const marks = await pullMarks(mandate);
  const rtokenMid = marks.mid.rtoken;
  const perpMid = marks.mid.perp;

  // BTC move since last close
  let btcMoveSinceClose = 0;
  try {
    const closeRaw = readFileSync(join(process.cwd(), "state", "last_cash_close.json"), "utf-8");
    const close = JSON.parse(closeRaw);
    if (close.perpMid > 0 && perpMid > 0) {
      btcMoveSinceClose = Math.round(((perpMid / close.perpMid) - 1) * 10_000) / 10_000;
    }
  } catch { /* first tick or no close yet */ }

  // Haircut book (shadow: start 10 000, no live loan)
  const book: BookState = {
    symbol: mandate.sleeve.rtoken,
    collateralNotional: 0,
    perpNotional: 0,
    debt: 0,
    cash: 10_000,
    equity: 10_000,
  };

  const ltv = computeLtvState(mandate, book, marks, { liveLoan: false });
  const autopsyIndex = loadAutopsyIndex();
  const lock = evaluateOvernightLock({
    lastHash,
    closeCount: loadCloseCount(),
    lastCloseDate: loadCloseDate(),
    autopsyDates: autopsyIndex.dates,
    newestAutopsyHash: autopsyIndex.newestHash,
  });

  // Shared context for all haircut log lines
  const ctx = {
    session,
    et,
    rtokenMid,
    perpMid,
    ltv: Number(ltv.ltv.toFixed(4)),
    projLtv: Number(ltv.projLtv.toFixed(4)),
    equity: book.equity,
    taxBps: 0,
    btcMoveSinceClose,
    lastHash,
  };

  // Haircut decide
  const overnightTicket = loadArmedTicket();
  const decision = decideClerk({
    mandate,
    session,
    book,
    ltv,
    lockOk: lock.ok,
    lockReason: lock.reason,
    rtokenMid,
    previousCloseMid: loadPreviousCloseMid(),
    overnightTicket,
    ticketFired: overnightTicket === null,
    today: etDate(),
  });

  appendLog({
    ts: new Date().toISOString(),
    et,
    account: "haircut",
    session,
    action: decisionToAction(decision),
    symbol: mandate.sleeve.rtoken,
    px: rtokenMid,
    qty: 0,
    notional: 0,
    equity: book.equity,
    ltv: ctx.ltv,
    proj_ltv: ctx.projLtv,
    tax_bps: 0,
    btc_move_since_close: btcMoveSinceClose,
    reason: decision.reason,
    hash: lastHash,
    ok: true,
    hub: "paper",
  });

  await executeHaircut(decision, mandate, ctx);

  // Naive decide + mark (shadow)
  const naiveDecision = decideNaive(mandate, session, marks, null);
  appendLog({
    ts: new Date().toISOString(),
    et,
    account: "naive",
    session,
    action: naiveDecision.action === "BUY_RTOKEN_PRINT" ? "BUY" : "STAND",
    symbol: mandate.sleeve.rtoken,
    px: rtokenMid,
    qty: naiveDecision.action === "BUY_RTOKEN_PRINT" ? naiveDecision.notionalUsdt : 0,
    notional: naiveDecision.action === "BUY_RTOKEN_PRINT" ? naiveDecision.notionalUsdt : 0,
    equity: 10_000,
    ltv: 0,
    proj_ltv: 0,
    tax_bps: 0,
    btc_move_since_close: btcMoveSinceClose,
    reason: naiveDecision.reason,
    hash: null,
    ok: true,
    hub: "paper",
  });

  if (naiveDecision.action === "BUY_RTOKEN_PRINT") {
    markNaiveBought();
  }

  appendEvent({
    kind: "tick",
    session,
    rtoken_mid: rtokenMid,
    perp_mid: perpMid,
    btc_move_since_close: btcMoveSinceClose,
  });

  // Scoreboard
  rebuildScoreboard(mandate);
  return 0;
}

// CLI entry point for `npm run tick`
tick()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
