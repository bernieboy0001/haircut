import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { currentSession, etTimestamp, etDate } from "../src/clock.js";
import { appendEvent, ensureLogs } from "../src/snapshot.js";
import { clearArmedTicket } from "../src/clerk.js";
import { hashAutopsy, saveLastHash } from "../src/lock.js";
import { buildAutopsyBase } from "../src/autopsy.js";
import type { Autopsy, CashClose, Mandate, LogRecord } from "../src/types.js";

// scripts/record-open.ts — run at the END of the 09:30–09:45 ET OPEN_WINDOW,
// after the firing tick has executed. By then the window decision is in the
// log, so the autopsy records the real action (FIRE/STAND) and the window's
// rToken range. It then clears the armed ticket as cleanup. Writes
// logs/autopsies/YYYY-MM-DD.json and chains the hash into state/last_hash.txt.

function readJsonl(path: string): LogRecord[] {
  try {
    return readFileSync(path, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as LogRecord);
  } catch {
    return [];
  }
}

async function recordOpen(): Promise<number> {
  ensureLogs();
  const mandate: Mandate = JSON.parse(
    readFileSync(join(process.cwd(), "mandate.json"), "utf-8")
  );
  const session = currentSession(mandate.open_window_et, mandate.cash_close_et);

  // Pull marks
  let rtokenMid = 0;
  let perpMid = 0;
  try {
    const { marketTicker } = await import("../src/hub.js");
    const [rtok, perp] = await Promise.all([
      marketTicker(mandate.sleeve.rtoken, mandate),
      marketTicker(mandate.sleeve.perp, mandate),
    ]);
    rtokenMid = rtok.ok && rtok.data ? Number(rtok.data.last) : 0;
    perpMid = perp.ok && perp.data ? Number(perp.data.last) : 0;
  } catch {
    appendEvent({ kind: "error", session, error: "marks unavailable at open" });
  }

  // Last cash close (the reference for overnight range, BTC move, tax)
  let cashClose: CashClose | null = null;
  try {
    cashClose = JSON.parse(
      readFileSync(join(process.cwd(), "state", "last_cash_close.json"), "utf-8")
    ) as CashClose;
  } catch { /* no close yet */ }

  const hairLog = readJsonl(join(process.cwd(), "logs", "haircut.jsonl"));
  const base = buildAutopsyBase({
    date: etDate(),
    cashClose,
    openMid: rtokenMid,
    openPerpMid: perpMid,
    logRows: hairLog,
  });
  const hash = hashAutopsy(base);
  const autopsy: Autopsy = { ...base, hash };

  mkdirSync(join(process.cwd(), "logs", "autopsies"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "logs", "autopsies", `${base.date}.json`),
    JSON.stringify(autopsy, null, 2)
  );
  saveLastHash(hash);
  clearArmedTicket();

  appendEvent({
    kind: "autopsy",
    session: "OPEN_WINDOW",
    date: base.date,
    cash_close: base.cash_close,
    open_mid: base.open_vwap_or_mid_0930_0945,
    btc_move: base.btc_move,
    hash,
  });

  console.log(
    `autopsy ${base.date}: cash_close=${base.cash_close} open=${base.open_vwap_or_mid_0930_0945} action=${base.haircut_action_at_open} hash=${hash.slice(0, 12)}`
  );
  return 0;
}

recordOpen()
  .then((c) => { process.exitCode = c; })
  .catch((e) => { console.error(e); process.exitCode = 1; });
