# Project: Haircut — Agentic LTV Risk Management on a Cross-Asset Sleeve

## Track
Agentic Trading → Cross-Asset Execution Agent

## What it does

Haircut manages LTV risk overnight on a single rToken + BTCUSDT perp sleeve across two parallel paper accounts:

- **Haircut** actively manages loan-to-value ratio by projecting collateral shocks, sizing delevers to a target LTV, arming one timed ticket for the open window, and chaining autopsies to prevent overnight state rewriting.
- **Naive** is the control twin: same marks, same sleeve. It buys the overnight rToken print when it is cheaper than the cash close, once per session, and holds. Judges see a number.

## Why it matters

Most crypto-lending risk management is reactive. Haircut proves that deterministic, schedule-aware LTV management can reduce peak drawdown, keep LTV below call, and avoid liquidation — without any AI guessing the math.

## What it prints

- **Peak LTV** vs call (0.85) and liq (0.91)
- **Min gap to call** (how much room remains)
- **Max drawdown** vs starting equity (10 000 USDT)
- **Overnight tax bps** paid on fills
- **Open-window PnL** during the 09:30–09:45 ET firing window

## Settlement (2026-09-20)

Run in shadow mode (no live cryptoloans module). All three autopsies STAND — no positions filled:
- Peak LTV: 0% (both books)
- Max drawdown: 0%
- Overnight tax on fills: 0 bps
- Open-window PnL: 0 USDT
- Autopsy chain: 2026-09-17 (184 bps), 2026-09-18 (315 bps), 2026-09-20 (47 bps)

## Constraints

- One rToken + BTCUSDT perp. No second stock.
- LLM may write a one-line reason string only. Never computes LTV, tax, size or verdict.
- Official Bitget Agent Hub only (MCP / bgc / SDK). No homemade REST client.
- Demo / paper-trading only. Live keys never in the repo.

## Materials

- **GitHub**: https://github.com/bernieboy0001/haircut
- **Dashboard**: live at `https://bernieboy0001.github.io/haircut/` (or deploy `web/dist/`)
- **Paper JSONL**: `logs/haircut.jsonl`, `logs/naive.jsonl`, `logs/events.jsonl`
- **Scoreboard**: `out/bakeoff.md`
- **60-second video**: `Demo.mp4` (or live recording)
- **X post**: with `#BitgetHackathon` and `@Bitget_AI`