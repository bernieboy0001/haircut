import type { BookState, LtvState, Mandate, Marks } from "./types.js";

// LTV engine. Order: real values, then arithmetic. Never an LLM.

export interface LtvInput {
  debt: number; // outstanding rToken loan debt in USDT (0 in shadow if none)
  collateralMark: number; // rToken collateral mark (USDT)
  book?: BookState;
}

export function ltvFromState(input: LtvInput): number {
  if (input.collateralMark <= 0) return 1; // no collateral = fully impaired
  return input.debt / input.collateralMark;
}

// Project LTV after `btcMove`, cross-shocking rToken by beta * btcMove.
export function projectLtv(
  debt: number,
  collateralMark: number,
  btcMove: number,
  beta: number
): number {
  const shock = beta * btcMove;
  const projectedCollateral = collateralMark * (1 + shock);
  if (projectedCollateral <= 0) return 1;
  return debt / projectedCollateral;
}

export function computeLtvState(
  mandate: Mandate,
  book: BookState | null,
  marks: Marks | null,
  opts: { liveLoan: boolean; btcMove?: number }
): LtvState {
  const btcMove = opts.btcMove ?? mandate.shock_btc;
  const mode: "live_loan" | "shadow" = opts.liveLoan ? "live_loan" : "shadow";

  // Debt source.
  const debt = book?.debt ?? 0;
  let collateralMark = marks?.mid.rtoken ?? 0;
  if (book && book.collateralNotional > 0) collateralMark = book.collateralNotional;

  const ltv = ltvFromState({ debt, collateralMark, book: book ?? undefined });
  const projLtv = projectLtv(debt, collateralMark, btcMove, mandate.beta_rtoken_to_btc);

  const mustDelever = projLtv >= mandate.ltv.call;
  return {
    mode,
    debt,
    collateralMark,
    ltv,
    projLtv,
    mustDelever,
    deleverTo: mandate.ltv.target_after_delever,
    reason: mustDelever
      ? `proj ${(projLtv * 100).toFixed(1)}% >= call ${(mandate.ltv.call * 100).toFixed(0)}%`
      : `proj ${(projLtv * 100).toFixed(1)}% < call ${(mandate.ltv.call * 100).toFixed(0)}%`,
  };
}

// Size the delever: reduce perp notional (or repay) so projected LTV falls to
// target. Deterministic arithmetic only.
export function sizeDeleverToTarget(
  currentNotional: number,
  debt: number,
  collateralMark: number,
  targetLtv: number,
  btcMove: number,
  beta: number
): number {
  // We need projLtv = (debt - reduce) / collateralAfter perp reduction.
  // Perp notional is uncorrelated-ish collateral; repay reduces debt directly.
  // Simple conservative path: reduce perp until target reached at shocked marks.
  const shockedCollateral = collateralMark * (1 + beta * btcMove);
  if (shockedCollateral <= 0) return currentNotional;
  const reduceNotionalNeeded = Math.max(0, debt - targetLtv * shockedCollateral);
  // Reduce perp notional by that much (or all of it if debt is gone).
  return Math.min(currentNotional, Math.max(0, Math.min(currentNotional, reduceNotionalNeeded)));
}