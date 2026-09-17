export type Session = "OPEN_WINDOW" | "RTH" | "OVERNIGHT" | "WEEKEND";

export type LogAction =
  | "REFUSE"
  | "DELEVER"
  | "REPAY"
  | "REDUCE_PERP"
  | "ARM"
  | "FIRE"
  | "STAND"
  | "BUY"
  | "SNAP";

export type Intent =
  | "BUY_RTOKEN"
  | "HOLD"
  | "REDUCE_PERP"
  | "REPAY"
  | "ADD_COLLATERAL"
  | "ARM"
  | "FIRE_ARMED"
  | "REFUSE";

export type Decision =
  | { intent: "BUY_RTOKEN"; reason: string }
  | { intent: "HOLD"; reason: string }
  | { intent: "REDUCE_PERP"; notional: number; reason: string }
  | { intent: "REPAY"; amount: number; reason: string }
  | { intent: "ADD_COLLATERAL"; amount: number; reason: string }
  | { intent: "ARM"; ladder: number[]; targetDate: string; reason: string }
  | { intent: "FIRE_ARMED"; ticketNotional: number; reduceOffset: number; reason: string }
  | { intent: "REFUSE"; reason: string };

export interface Mandate {
  name: string;
  quote: string;
  equity_start: string;
  sleeve: {
    rtoken: string;
    perp: string;
    perp_leverage: number;
    max_rtoken_notional: string;
    max_perp_notional: string;
  };
  ltv: {
    initial: number;
    call: number;
    liq: number;
    target_after_delever: number;
  };
  shock_btc: number;
  beta_rtoken_to_btc: number;
  open_window_et: string[];
  cash_close_et: string;
  max_actions_per_open: number;
  allow_overnight: string[];
}

export interface Marks {
  at: string;
  source: "hub" | "stale";
  cash_close_source?: "close" | "stale";
  mid: {
    rtoken: number;
    perp: number;
  };
  book: {
    rtoken: {
      ts: string;
      bids: [number, number][];
      asks: [number, number][];
    };
    perp: {
      ts: string;
      bids: [number, number][];
      asks: [number, number][];
    };
  };
}

export interface CashClose {
  date: string;
  at: string;
  rtokenMid: number;
  perpMid: number;
  sessionTaxBps: number;
  source: "close" | "stale";
}

export interface BookState {
  symbol: string;
  collateralNotional: number;
  perpNotional: number;
  debt: number;
  cash: number;
  equity: number;
}

export interface LtvState {
  mode: "live_loan" | "shadow";
  debt: number;
  collateralMark: number;
  ltv: number;
  projLtv: number;
  mustDelever: boolean;
  deleverTo: number;
  reason: string;
}

// --- Strict log schema (one JSONL line for haircut.jsonl / naive.jsonl) ----

export interface LogRecord {
  ts: string;                    // ISO-8601
  et: string;                    // YYYY-MM-DDTHH:MM (America/New_York)
  account: "haircut" | "naive";
  session: Session;
  action: LogAction;
  symbol: string;
  px: number;
  qty: number;
  notional: number;
  equity: number;
  ltv: number;
  proj_ltv: number;
  tax_bps: number;
  btc_move_since_close: number;
  reason: string;
  hash: string | null;
  ok: boolean;
  hub: string;
}

// --- Autopsy schema (logs/autopsies/YYYY-MM-DD.json) ---------------------

export interface Autopsy {
  date: string;
  cash_close: number;
  overnight_rtoken_high: number;
  overnight_rtoken_low: number;
  btc_move: number;
  peak_ltv_haircut: number;
  peak_ltv_naive: number;
  open_vwap_or_mid_0930_0945: number;
  tax_vs_open_bps: number;
  haircut_action_at_open: "FIRE" | "STAND";
  hash: string;
}
