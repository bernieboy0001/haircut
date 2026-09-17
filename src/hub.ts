import {
  BitgetRestClient,
  loadConfig,
} from "@bitget-ai/bitget-agent-sdk";
import { installDnsFallback } from "./dns-fix.js";
import type { Mandate } from "./types.js";

// hub.ts is the ONLY file that talks to Bitget. It wraps the official
// @bitget-ai/bitget-agent-sdk (UTA v3). No homemade REST clients.
//
// Every call returns a typed envelope { ok, data, raw }. A failed call writes a
// diagnostic line to logs/events.jsonl and returns { ok: false } — callers keep
// running on market + account + paper data.

export interface Envelope<T = unknown> {
  ok: boolean;
  data: T | null;
  raw: unknown;
  error?: string;
}

/** The market surface marks.ts needs from the Hub. */
export interface HubClient {
  marketTicker(
    symbol: string,
    mandate: Mandate
  ): Promise<Envelope<{ last: number; price24h: number }>>;
  orderBook(
    symbol: string,
    mandate: Mandate,
    limit?: number
  ): Promise<Envelope<{ bids: [number, number][]; asks: [number, number][] }>>;
}

const CATEGORY_SPOT = "SPOT";
const CATEGORY_USDT_FUTURES = "USDT-FUTURES";

function categoryFor(symbol: string, mandate: Mandate): string {
  return symbol === mandate.sleeve.perp ? CATEGORY_USDT_FUTURES : CATEGORY_SPOT;
}

let client: BitgetRestClient | null = null;
let paperActive = false;

// The SDK/undici connection pool races when several fresh requests to the same
// origin are issued at once ("fetch failed"); issuing one at a time is reliable.
// Callers may still fan out (Promise.all) — the serialization is transparent.
let chain: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = chain.then(task, task);
  chain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function getClient(): BitgetRestClient {
  installDnsFallback();
  if (!client) {
    const config = loadConfig({
      modules: "account,trade,market,cryptoloans",
      paperTrading: true,
      surface: "intent",
    });
    paperActive = Boolean(config.paperTrading) || Boolean(process.env.BITGET_PAPER_TRADING);
    client = new BitgetRestClient(config);
  }
  return client;
}

function fmtError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

async function call<T = unknown>(
  operationId: string,
  args: Record<string, unknown>,
  mandate: Mandate,
  label: string,
  retries = 0
): Promise<Envelope<T>> {
  const c = getClient();
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await serialize(() => c.callOperation<T>(operationId, args));
      return { ok: true, data: result.data ?? null, raw: result.raw };
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }
  const msg = fmtError(lastErr);
  await logEvent(mandate, {
    kind: "error",
    topic: "hub",
    item: `${label} (${operationId})`,
    error: msg,
  }).catch(() => undefined);
  return { ok: false, data: null, raw: null, error: msg };
}

// --- market ---------------------------------------------------------------

export async function marketTicker(
  symbol: string,
  mandate: Mandate
): Promise<Envelope<{ last: number; price24h: number }>> {
  const res = await call<
    Record<string, unknown> | Array<Record<string, unknown>>
  >(
    "getTickers",
    { category: categoryFor(symbol, mandate), symbol },
    mandate,
    "ticker",
    2
  );
  if (!res.ok || res.data === null) return res as Envelope<{ last: number; price24h: number }>;
  const rows = Array.isArray(res.data) ? res.data : [res.data];
  const t = rows[0];
  return {
    ok: Boolean(t),
    data: t
      ? {
          last: Number(t.lastPrice ?? t.last ?? 0),
          price24h: Number(t.openPrice24h ?? t.open24h ?? 0),
        }
      : null,
    raw: res.raw,
  };
}

export async function orderBook(
  symbol: string,
  mandate: Mandate,
  limit = 20
): Promise<Envelope<{ bids: [number, number][]; asks: [number, number][] }>> {
  const res = await call<
    {
      bids?: Array<[string, string]>;
      asks?: Array<[string, string]>;
      b?: Array<[string, string]>;
      a?: Array<[string, string]>;
    }
  >(
    "getOrderbook",
    { category: categoryFor(symbol, mandate), symbol, limit: String(limit) },
    mandate,
    "orderbook",
    2
  );
  if (!res.ok || res.data === null)
    return res as unknown as Envelope<{ bids: [number, number][]; asks: [number, number][] }>;
  // Bitget v3 returns compact keys: b = bids, a = asks.
  const d = res.data;
  const norm = (side: [string, string][] | undefined): [number, number][] =>
    Array.isArray(side)
      ? side
          .map(([p, s]) => [Number(p), Number(s)] as [number, number])
          .filter(([p, s]) => Number.isFinite(p) && Number.isFinite(s) && p > 0 && s > 0)
      : [];
  return {
    ok: true,
    data: { bids: norm(d.bids ?? d.b), asks: norm(d.asks ?? d.a) },
    raw: res.raw,
  };
}

// --- account --------------------------------------------------------------

export interface AccountOverview {
  usdtEquity: number; // total equity in USDT (sum across modes)
  available: number;
  spotUsdt: number;
  futuresEquity: number;
}

export async function accountOverview(
  mandate: Mandate
): Promise<Envelope<AccountOverview>> {
  const res = await call<Array<Record<string, unknown>>>(
    "getAccountAssets",
    {},
    mandate,
    "account_overview",
    2
  );
  if (!res.ok || res.data === null)
    return res as unknown as Envelope<AccountOverview>;
  const rows = res.data;
  let spotUsdt = 0;
  let futuresEquity = 0;
  let available = 0;
  for (const r of rows) {
    const coin = String(r.coin ?? "");
    if (coin !== "USDT") continue;
    spotUsdt += Number(r.spot ?? 0);
    futuresEquity += Number(r.equity ?? 0);
    available += Number(r.available ?? r.spot ?? 0);
  }
  const total = spotUsdt + futuresEquity;
  return {
    ok: true,
    data: { usdtEquity: total, available, spotUsdt, futuresEquity },
    raw: res.raw,
  };
}

// --- positions ------------------------------------------------------------

export interface PerpPosition {
  symbol: string;
  side: string; // long/short
  sizeNotional: number; // notional in USDT (signed)
  markUsdt: number;
}

export async function positions(
  symbol: string,
  mandate: Mandate
): Promise<Envelope<PerpPosition[]>> {
  const res = await call<Array<Record<string, unknown>>>(
    "getPositionInfo",
    { category: CATEGORY_USDT_FUTURES, symbol },
    mandate,
    "positions",
    2
  );
  if (!res.ok || res.data === null)
    return res as unknown as Envelope<PerpPosition[]>;
  const rows = res.data;
  const out: PerpPosition[] = rows
    .map((p) => {
      const side = String(p.posSide ?? p.side ?? "long");
      const notional = Number(p.notional ?? p.totalNotional ?? 0);
      return {
        symbol: String(p.symbol ?? symbol),
        side,
        sizeNotional: side === "short" ? -Math.abs(notional) : Math.abs(notional),
        markUsdt: Number(p.markPrice ?? 0),
      };
    })
    .filter((p) => p.sizeNotional !== 0);
  return { ok: true, data: out, raw: res.raw };
}

// --- paper order ----------------------------------------------------------

export interface PaperOrder {
  symbol: string;
  side: "buy" | "sell";
  orderType: "limit" | "market";
  qty: number;
  notional: number;
  reduceOnly: boolean;
  clientOid: string;
}

// Spot: qty is in base units. Futures market buy: qty in quote. We always send
// deterministic USD-values passed by the caller as `notionalUsdt`; for spot we
// derive qty from the current mid so the paper book stays honest.
export async function placePaperOrder(
  symbol: string,
  mandate: Mandate,
  side: "buy" | "sell",
  notionalUsdt: number,
  opts: {
    reduceOnly?: boolean;
    market?: boolean;
    referencePrice: number;
  }
): Promise<Envelope<PaperOrder>> {
  const qty = opts.market ? notionalUsdt : notionalUsdt / (opts.referencePrice || 1);
  const clientOid = `hc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await call<{ clientOid?: string; orderId?: string }>(
    "placeOrder",
    {
      category: categoryFor(symbol, mandate),
      symbol,
      side,
      orderType: "market",
      qty: String(qty),
      reduceOnly: opts.reduceOnly ? "yes" : "no",
      clientOid,
    },
    mandate,
    "paper_order"
  );
  if (!res.ok || res.data === null)
    return res as unknown as Envelope<PaperOrder>;
  const d = res.data;
  return {
    ok: true,
    data: {
      symbol,
      side,
      orderType: "market",
      qty,
      notional: notionalUsdt,
      reduceOnly: Boolean(opts.reduceOnly),
      clientOid: String(d.clientOid ?? clientOid),
    },
    raw: res.raw,
  };
}

// --- loans (cryptoloans module) ------------------------------------------

export async function loanDebts(
  mandate: Mandate
): Promise<Envelope<Array<Record<string, unknown>>>> {
  const res = await call<Record<string, unknown> | Array<Record<string, unknown>>>(
    "getLoanDebts",
    {},
    mandate,
    "loan_debts",
    2
  );
  if (!res.ok || res.data === null)
    return res as unknown as Envelope<Array<Record<string, unknown>>>;
  return { ok: true, data: Array.isArray(res.data) ? res.data : [res.data], raw: res.raw };
}

export async function loanCoins(coin: string, mandate: Mandate) {
  return call("getLoanCoins", { coin }, mandate, "loan_coins", 2);
}

export async function loanBorrowOngoing(mandate: Mandate) {
  return call("getBorrowOngoing", {}, mandate, "loan_borrow_ongoing", 2);
}

export async function repayCoins(
  orderId: string,
  method: "borrowed_coin" | "collateral",
  amountUsdt: number,
  mandate: Mandate
) {
  return call(
    "repayCoins",
    {
      orderId,
      method,
      repayAll: "no",
      amount: String(amountUsdt),
      repayUnlock: "yes",
    },
    mandate,
    "loan_repay"
  );
}

export async function revisePledge(
  orderId: string,
  pledgeCoin: string,
  amountUsdt: number,
  reviseType: "IN" | "OUT",
  mandate: Mandate
) {
  return call(
    "revisePledge",
    { orderId, amount: String(amountUsdt), pledgeCoin, reviseType },
    mandate,
    "loan_collateral"
  );
}

export function paperModeActive(): boolean {
  getClient();
  return paperActive;
}

// --- event log ------------------------------------------------------------

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export async function logEvent(
  mandate: Mandate,
  ev: Record<string, unknown>
): Promise<void> {
  try {
    mkdirSync(join(process.cwd(), "logs"), { recursive: true });
    appendFileSync(
      join(process.cwd(), "logs", "events.jsonl"),
      JSON.stringify({ ts: new Date().toISOString(), ...ev }) + "\n"
    );
  } catch {
    // never throw from the event sink
  }
}