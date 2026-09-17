import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  BookState,
  Decision,
  LogRecord,
  LtvState,
  Mandate,
  Session,
} from "./types.js";
import { isOvernightOrWeekend, etDate, nextSessionDate } from "./clock.js";

// clerk.ts — Haircut's only write path. Deterministic, arithmetic-only.
//
//   OVERNIGHT / WEEKEND : if a BUY_RTOKEN is requested -> REFUSE (never add
//                         risk overnight); assert lock; if proj_ltv >= call
//                         -> DELEVER (repay first, then reduce perp) else
//                         ARM_OR_WAIT (arm at most one ticket).
//   OPEN_WINDOW          : FIRE_ARMED_OR_STAND (max 1 action).
//   RTH                  : no new Haircut risk.
//
// Rule of order: never send an order without appending a log line first
// (intent) and after (fill or reject). That is enforced by run.ts, which logs
// the returned Decision before execution and logs the outcome after.

// Decision intent -> strict log action (the one-to-many family names collapse
// to the log's vocabulary). SNAP is only ever written by record-close.ts.
export function decisionToAction(d: Decision): LogRecord["action"] {
  switch (d.intent) {
    case "REFUSE": return "REFUSE";
    case "REDUCE_PERP": return "REDUCE_PERP";
    case "REPAY": return "REPAY";
    case "ARM": return "ARM";
    case "FIRE_ARMED": return "FIRE";
    case "BUY_RTOKEN": return "BUY";
    case "HOLD": return "STAND";
    case "ADD_COLLATERAL": return "DELEVER";
  }
}

const TICKET_FILE = join(process.cwd(), "state", "ticket.json");

export interface ArmedTicket {
  date: string; // session date the ticket was armed for
  symbol: string;
  side: "buy" | "sell";
  price: number; // fill threshold
  notionalUsdt: number;
  active: boolean;
  reason: string;
}

export function loadArmedTicket(): ArmedTicket | null {
  try {
    return JSON.parse(readFileSync(TICKET_FILE, "utf-8")) as ArmedTicket;
  } catch {
    return null;
  }
}

export function saveArmedTicket(ticket: ArmedTicket): void {
  mkdirSync(join(process.cwd(), "state"), { recursive: true });
  writeFileSync(TICKET_FILE, JSON.stringify(ticket, null, 2));
}

export function clearArmedTicket(): void {
  try {
    writeFileSync(TICKET_FILE, JSON.stringify(null));
  } catch {
    /* ignore */
  }
}

export interface ClerkContext {
  mandate: Mandate;
  session: Session;
  book: BookState | null;
  ltv: LtvState;
  lockOk: boolean; // evaluateOvernightLock result
  lockReason?: string; // human-readable lock reason when lockOk is false
  rtokenMid: number;
  previousCloseMid: number | null; // last_cash_close rtoken mid
  overnightTicket: ArmedTicket | null;
  ticketFired: boolean;
  /** ET calendar date (YYYY-MM-DD). Defaults to today; injectable for tests. */
  today?: string;
  /** User-prompted action from the host agent envelope. Set by run.ts only. */
  requested?: "BUY_RTOKEN";
}

export function decideClerk(ctx: ClerkContext): Decision {
  const { mandate, session, ltv, rtokenMid, previousCloseMid, overnightTicket } = ctx;
  const today = ctx.today ?? etDate();

  if (isOvernightOrWeekend(session)) {
    // Never add new risk overnight. A requested buy is REFUSE, not silence.
    if (ctx.requested === "BUY_RTOKEN") {
      return { intent: "REFUSE", reason: "overnight_new_risk" };
    }
    if (!ctx.lockOk) {
      return { intent: "REFUSE", reason: ctx.lockReason ?? "missing_autopsy_hash" };
    }
    if (ltv.mustDelever) {
      // DELEVER: repay first (reduces debt directly), else reduce perp.
      if (ltv.debt > 0) {
        const repay = Math.min(ltv.debt, ltv.debt - mandate.ltv.target_after_delever * ltv.collateralMark * (1 + mandate.beta_rtoken_to_btc * mandate.shock_btc));
        return {
          intent: "REPAY",
          amount: Math.max(0, Math.round(Math.min(repay, ltv.debt) * 100) / 100),
          reason: `DELEVER: proj ${(ltv.projLtv * 100).toFixed(1)}% >= call ${(mandate.ltv.call * 100).toFixed(0)}% — repay ${repay.toFixed(0)} USDT`,
        };
      }
      if (ctx.book && ctx.book.perpNotional > 0) {
        const reduce = Math.min(
          ctx.book.perpNotional,
          ltv.debt - mandate.ltv.target_after_delever * ltv.collateralMark * (1 + mandate.beta_rtoken_to_btc * mandate.shock_btc)
        );
        return {
          intent: "REDUCE_PERP",
          notional: Math.max(0, Math.round(reduce * 100) / 100),
          reason: "DELEVER: no debt — reduce perp to target LTV",
        };
      }
      return { intent: "REFUSE", reason: "DELEVER required but no path available" };
    }

    // ARM_OR_WAIT: arm one ticket for the next session's open if not already armed.
    const target = nextSessionDate(today);
    if (overnightTicket && overnightTicket.active && overnightTicket.date === target) {
      return { intent: "HOLD", reason: `ticket already armed for ${target}` };
    }
    const armPrice = previousCloseMid ?? rtokenMid;
    if (armPrice <= 0) {
      return { intent: "HOLD", reason: "no reference price — cannot arm" };
    }
    const ladder = [Number((armPrice * 0.995).toFixed(4)), Number((armPrice * 1.005).toFixed(4))];
    return {
      intent: "ARM",
      ladder,
      targetDate: target,
      reason: `arm ticket for ${target} around ${armPrice}`,
    };
  }

  if (session === "OPEN_WINDOW") {
    if (ctx.ticketFired) return { intent: "HOLD", reason: "ticket already fired this window (max 1)" };
    if (overnightTicket && overnightTicket.active) {
      if (overnightTicket.date !== today) {
        return {
          intent: "HOLD",
          reason: `ticket armed for ${overnightTicket.date}, not today (${today})`,
        };
      }
      const hit = rtokenMid > 0 && overnightTicket.side === "buy" && rtokenMid <= overnightTicket.price;
      if (hit) {
        // Every FIRE must reference the last autopsy hash (chain not broken).
        if (!ctx.lockOk) {
          return { intent: "REFUSE", reason: ctx.lockReason ?? "missing_autopsy_hash" };
        }
        return {
          intent: "FIRE_ARMED",
          ticketNotional: overnightTicket.notionalUsdt,
          reduceOffset: 0,
          reason: `fire armed buy at <= ${overnightTicket.price} (mid ${rtokenMid})`,
        };
      }
    }
    return { intent: "HOLD", reason: "no armed ticket hit in open window" };
  }

  // RTH after the window: no new Haircut risk.
  return { intent: "HOLD", reason: "RTH — no new risk per mandate" };
}