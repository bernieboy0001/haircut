import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Mandate, Marks, Session } from "./types.js";

// naive.ts — the twin. Same marks as Haircut. Naive buys the overnight rToken
// print when it is cheaper than the cash close, once per session, and holds the
// perp. No LTV engine. It exists so the judges see a number.

const STATE_FILE = join(process.cwd(), "state", "naive.json");

export interface NaiveState {
  boughtSessionDate: string | null;
  perpNotional: number;
  rtokenNotional: number;
}

export function loadNaiveState(): NaiveState {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf-8")) as NaiveState;
    return { boughtSessionDate: s.boughtSessionDate ?? null, perpNotional: s.perpNotional ?? 0, rtokenNotional: s.rtokenNotional ?? 0 };
  } catch {
    return { boughtSessionDate: null, perpNotional: 0, rtokenNotional: 0 };
  }
}

export function saveNaiveState(s: NaiveState): void {
  mkdirSync(join(process.cwd(), "state"), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

export interface NaiveDecision {
  action: "BUY_RTOKEN_PRINT" | "HOLD";
  notionalUsdt: number;
  reason: string;
}

const FIXED_NOTIONAL = 200;

export function decideNaive(
  mandate: Mandate,
  session: Session,
  marks: Marks,
  previousCloseMid: number | null
): NaiveDecision {
  const today = dayTag();
  const state = loadNaiveState();
  const coldOpen = session === "OPEN_WINDOW";
  const cheaperThanClose =
    previousCloseMid !== null &&
    marks.mid.rtoken > 0 &&
    marks.mid.rtoken < previousCloseMid;

  if (coldOpen && cheaperThanClose && state.boughtSessionDate !== today) {
    return {
      action: "BUY_RTOKEN_PRINT",
      notionalUsdt: FIXED_NOTIONAL,
      reason: `buy $${FIXED_NOTIONAL} rToken print ${marks.mid.rtoken} < close ${previousCloseMid} (once/session)`,
    };
  }
  return { action: "HOLD", notionalUsdt: 0, reason: state.boughtSessionDate === today ? "already bought this session" : "no cheaper print" };
}

export function markNaiveBought(): void {
  const s = loadNaiveState();
  s.boughtSessionDate = dayTag();
  saveNaiveState(s);
}

function dayTag(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  )
    .toISOString()
    .slice(0, 10);
}