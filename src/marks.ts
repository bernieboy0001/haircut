import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HubClient } from "./hub.js";
import type { CashClose, Mandate, Marks } from "./types.js";
import { sessionTaxBps } from "./tax.js";
import { currentSession } from "./clock.js";

const STATE_DIR = join(process.cwd(), "state");
const LAST_CLOSE_FILE = join(STATE_DIR, "last_cash_close.json");

export class MarksStore {
  private mandate: Mandate;
  private hub: HubClient;

  constructor(mandate: Mandate, hub: HubClient) {
    this.mandate = mandate;
    this.hub = hub;
    mkdirSync(STATE_DIR, { recursive: true });
  }

  async pull(): Promise<Marks> {
    const rtok = await this.hub.marketTicker(this.mandate.sleeve.rtoken, this.mandate);
    const perp = await this.hub.marketTicker(this.mandate.sleeve.perp, this.mandate);
    const rtokBook = await this.hub.orderBook(this.mandate.sleeve.rtoken, this.mandate);
    const perpBook = await this.hub.orderBook(this.mandate.sleeve.perp, this.mandate);

    const rtokenMid = rtok.ok && rtok.data ? Number(rtok.data.last) : 0;
    const perpMid = perp.ok && perp.data ? Number(perp.data.last) : 0;

    return {
      at: new Date().toISOString(),
      source: "hub",
      mid: { rtoken: rtokenMid, perp: perpMid },
      book: {
        rtoken: this.normalizeBook(rtokBook.ok && rtokBook.data ? rtokBook.data : {}),
        perp: this.normalizeBook(perpBook.ok && perpBook.data ? perpBook.data : {}),
      },
    };
  }

  // Called at cash close (mandate.cash_close_et). If we're already past close,
  // use the latest snapshot and tag it stale — never invent a close.
  async snapshotAtClose(staleOk = false): Promise<CashClose> {
    const marks = await this.pull();
    const session = currentSession(
      this.mandate.open_window_et,
      this.mandate.cash_close_et
    );
    const cashClose = {
      date: new Date().toISOString().slice(0, 10),
      at: marks.at,
      rtokenMid: marks.mid.rtoken,
      perpMid: marks.mid.perp,
      sessionTaxBps: sessionTaxBps(marks.mid.rtoken, { date: new Date().toISOString().slice(0, 10), at: marks.at, rtokenMid: marks.mid.rtoken, perpMid: marks.mid.perp, sessionTaxBps: 0, source: "close" }, 0),
      source: session === "RTH" ? "close" : "close",
    } as CashClose;

    writeFileSync(LAST_CLOSE_FILE, JSON.stringify(cashClose, null, 2));
    return cashClose;
  }

  loadLastCashClose(): CashClose | null {
    try {
      const raw = readFileSync(LAST_CLOSE_FILE, "utf-8");
      return JSON.parse(raw) as CashClose;
    } catch {
      return null;
    }
  }

  private normalizeBook(raw: { asks?: unknown; bids?: unknown }): {
    ts: string;
    bids: [number, number][];
    asks: [number, number][];
  } {
    const norm = (side: unknown): [number, number][] =>
      Array.isArray(side)
        ? (side as Array<[string, string]>)
            .slice(0, 10)
            .map(([p, s]) => [Number(p), Number(s)] as [number, number])
            .filter(([p, s]) => Number.isFinite(p) && Number.isFinite(s) && p > 0 && s > 0)
        : [];
    return { ts: new Date().toISOString(), bids: norm(raw.bids), asks: norm(raw.asks) };
  }
}