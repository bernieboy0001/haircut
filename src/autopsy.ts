import { sessionTaxBps } from "./tax.js";
import type { Autopsy, CashClose, LogRecord } from "./types.js";

// autopsy.ts — pure builder for the first-autopsy base record. No IO, so the
// arithmetic (window range, action at open, tax vs open, peak LTV) is testable.
// `hash` is added by the caller (src/lock.ts → hashAutopsy).

export interface AutopsyInput {
  /** ET calendar date, YYYY-MM-DD. */
  date: string;
  /** The last cash close, or null before any close exists. */
  cashClose: CashClose | null;
  /** rToken mid at the time the autopsy pass runs. */
  openMid: number;
  /** BTCUSDT perp mid at the time the autopsy pass runs. */
  openPerpMid: number;
  /** Haircut rows from logs/haircut.jsonl (any session). */
  logRows: LogRecord[];
}

export function buildAutopsyBase(i: AutopsyInput): Omit<Autopsy, "hash"> {
  const closeMid = i.cashClose && i.cashClose.rtokenMid > 0 ? i.cashClose.rtokenMid : 0;

  // Only rows since the cash close belong to "the overnight".
  const afterClose = (r: LogRecord): boolean =>
    !i.cashClose ? true : new Date(r.ts).getTime() >= new Date(i.cashClose.at).getTime();
  const rows = i.logRows.filter(afterClose);
  const pxRows = rows.filter((r) => Number(r.px) > 0);
  // The open-window mid/action come from Haircut's own marks (Naive mirrors the
  // same market mid, so counting both would double each tick).
  const openRows = rows.filter(
    (r) => r.session === "OPEN_WINDOW" && r.account === "haircut"
  );
  const openPx = openRows.filter((r) => Number(r.px) > 0);

  // VWAP-ish: mean rToken mid over the open-window ticks; fall back to the
  // current mid when the window produced no ticks.
  const windowMid =
    openPx.length > 0
      ? openPx.reduce((s, r) => s + Number(r.px), 0) / openPx.length
      : i.openMid;

  const candidates = [closeMid, i.openMid, windowMid, ...pxRows.map((r) => Number(r.px))].filter(
    (v) => v > 0
  );
  const high = candidates.length > 0 ? Math.max(...candidates) : 0;
  const low = candidates.length > 0 ? Math.min(...candidates) : 0;

  const btcMove =
    i.cashClose && i.cashClose.perpMid > 0 && i.openPerpMid > 0
      ? Math.round((i.openPerpMid / i.cashClose.perpMid - 1) * 10_000) / 10_000
      : 0;

  const peakLtv = (account: "haircut" | "naive"): number =>
    rows
      .filter((r) => r.account === account)
      .reduce((m, r) => Math.max(m, Number(r.ltv ?? 0)), 0);

  const fired = openRows.some((r) => r.action === "FIRE");
  const closeForTax: CashClose =
    i.cashClose ?? {
      date: i.date,
      at: new Date(0).toISOString(),
      rtokenMid: 0,
      perpMid: 0,
      sessionTaxBps: 0,
      source: "close",
    };

  return {
    date: i.date,
    cash_close: closeMid,
    overnight_rtoken_high: high,
    overnight_rtoken_low: low,
    btc_move: btcMove,
    peak_ltv_haircut: peakLtv("haircut"),
    peak_ltv_naive: peakLtv("naive"),
    open_vwap_or_mid_0930_0945: windowMid,
    tax_vs_open_bps: sessionTaxBps(windowMid, closeForTax, 0),
    haircut_action_at_open: fired ? "FIRE" : "STAND",
  };
}
