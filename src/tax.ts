import type { CashClose } from "./types.js";

// Session tax: the cost of carrying the rToken loan across a cash close.
// taxBps is applied to the rtoken collateral notional when the position is
// held through the mandate.cash_close_et cash close.

export function sessionTaxBps(
  mid: number,
  cashClose: CashClose,
  impactBps: number
): number {
  if (!cashClose || !isFinite(mid) || cashClose.rtokenMid <= 0) {
    return Math.round(Math.max(impactBps, 0));
  }
  const natural = Math.abs((mid / cashClose.rtokenMid - 1) * 10000);
  return Math.round(Math.min(Math.max(natural, 0), 500));
}

// Walk the ask side to buy `buyNotional` USDT worth of a symbol whose top of
// book midpoint is `mid`. If the visible depth cannot fill the order, return
// Infinity — the caller treats that as REFUSE, never a guessed price.
// Returns impact in bps (positive = slippage against the buyer).
export function bookImpactBps(
  asks: Array<[number, number]>,
  buyNotional: number,
  mid: number
): number {
  if (asks.length === 0 || mid <= 0 || buyNotional <= 0) return Infinity;
  let remaining = buyNotional;
  let totalNotional = 0;
  let avgPrice = 0;
  for (const [price, size] of asks) {
    if (price <= 0 || size <= 0) continue;
    const levelNotional = price * size;
    const move = Math.min(remaining, levelNotional);
    avgPrice += price * move;
    totalNotional += move;
    remaining -= move;
    if (remaining <= 1e-9) break;
  }
  if (remaining > 1e-9) return Infinity;
  const fillPrice = avgPrice / totalNotional;
  return ((fillPrice - mid) / mid) * 10000;
}

export function maxFillableNotional(
  asks: Array<[number, number]>
): number {
  let notional = 0;
  for (const [price, size] of asks) {
    if (price > 0 && size > 0) notional += price * size;
  }
  return notional;
}