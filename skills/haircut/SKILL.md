# haircut skill

A stateful, schedule-aware paper trading system that manages LTV risk on one
rToken + BTCUSDT perp sleeve across two parallel accounts: **Haircut**
(LTV-managed) and **Naive** (plain overnight print buyer).

## Host agent rules — always

- **Always call `npm run tick`** rather than placing raw orders. The engine is
  the only write path. Never call `placePaperOrder` directly from chat.
- **If the user says "buy rNVDA" overnight, show the REFUSE envelope; do not
  argue.** Overnight is the no-new-risk window. Reply with the `REFUSE` log
  line (or `STAND`) and move on.
- **Never compute LTV in chat. Call the engine.** No arithmetic, no
  justification of a number you invented. Run `npm run tick` and read the log.
- **Paper only.** Live keys must never appear in the repo. The Hub is the sole
  Bitget access point; `hub` must always be `"paper"`.

## Strict log schema — one JSON object per line, both books

`logs/haircut.jsonl` and `logs/naive.jsonl` share the exact same schema:

```json
{
  "ts": "ISO-8601",
  "et": "YYYY-MM-DDTHH:MM",
  "account": "haircut|naive",
  "session": "OPEN_WINDOW|RTH|OVERNIGHT|WEEKEND",
  "action": "REFUSE|DELEVER|REPAY|REDUCE_PERP|ARM|FIRE|STAND|BUY|SNAP",
  "symbol": "",
  "px": 0,
  "qty": 0,
  "notional": 0,
  "equity": 0,
  "ltv": 0,
  "proj_ltv": 0,
  "tax_bps": 0,
  "btc_move_since_close": 0,
  "reason": "",
  "hash": null,
  "ok": true,
  "hub": "paper"
}
```

`reason` is the only LLM-optional field. Prefer fixed strings:
`overnight_new_risk`, `call_proximity`, `open_window`, `missing_autopsy_hash`.

## Autopsy — `logs/autopsies/YYYY-MM-DD.json`

```json
{
  "date": "",
  "cash_close": 0,
  "overnight_rtoken_high": 0,
  "overnight_rtoken_low": 0,
  "btc_move": 0,
  "peak_ltv_haircut": 0,
  "peak_ltv_naive": 0,
  "open_vwap_or_mid_0930_0945": 0,
  "tax_vs_open_bps": 0,
  "haircut_action_at_open": "FIRE|STAND",
  "hash": ""
}
```

Hash this object (`src/lock.ts` → SHA-256) and store the hash as plain text in
`state/last_hash.txt`.

## When to use

Use this skill when working on the haircut paper trading demo — building the
decision engine, running ticks, recording close/open snapshots, or updating the
bakeoff scoreboard.

## Key files

| File | Purpose |
|------|---------|
| `mandate.json` | Caps, LTV bands, sleeve — source of truth. |
| `src/clerk.ts` | Haircut decision engine (arithmetic-only, no LLM). |
| `src/naive.ts` | Naive twin: buys overnight print once/session, holds perp. |
| `src/lock.ts` | SHA-256 hash of autopsy + `state/last_hash.txt` chain. |
| `src/hub.ts` | Official Bitget SDK wrapper (sole Bitget access point). |
| `src/run.ts` | Main tick loop — one tick = mandates → marks → decide → execute → scoreboard. |
| `src/snapshot.ts` | Strict log schema writer (`appendLog`), events sink. |
| `src/scoreboard.ts` | Rebuilds `out/bakeoff.md` from both JSONL books. |
| `scripts/record-close.ts` | Cash-close snapshot at the mandated close (19:20 ET). |
| `scripts/record-open.ts` | First open-window autopsy (run at 09:45, end of the window). |
| `out/bakeoff.md` | Scoreboard rebuilt after every action. |

## Session schedule (all times America/New_York)

| Session | Window | Haircut action |
|---------|--------|----------------|
| `OPEN_WINDOW` | 09:30–09:45 | Fire one ticket armed for today (max 1), or STAND |
| `RTH` | 09:45–19:20 | No new risk |
| `OVERNIGHT` | 19:20–09:30 | Arm ticket, or delever if proj ≥ call |
| `WEEKEND` | Fri 19:20 → Mon 09:30 | Weekend solvency — delever only |

## LTV bands (from `mandate.json`)

- **initial** = 0.78
- **call** = 0.85 (triggers delever)
- **liq** = 0.91
- **target_after_delever** = 0.80

## Shadow book

When the live cryptoloans module is unavailable, Haircut and Naive operate in
shadow mode: no loan is filled, LTV is computed from the mandate's `shock_btc`
and `beta_rtoken_to_btc` against live marks. This is disclosed in
`DISCLOSURE.md` and `README.md`.