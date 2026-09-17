# haircut — two paper accounts, one rToken sleeve

> **One rToken is doing three jobs. Overnight those jobs can liquidate you. Haircut only removes risk until the cash open.**

Two demo accounts start with 10 000 USDT each, the same sleeve (rNVDAUSDT + BTCUSDT perp), in the same week.
Haircut actively manages LTV through the night; Naive just buys the overnight print and holds.

---

## What you're looking at

| Component | Description |
|-----------|-------------|
| `mandate.json` | Source of truth for all caps, LTV bands and the sleeve. No agent may hardcode anything this file governs. |
| `src/hub.ts` | The only file that talks to Bitget — wraps the official `@bitget-ai/bitget-agent-sdk` (UTA v3). |
| `src/clerk.ts` | Haircut's deterministic decision engine. LTV is arithmetic, never an LLM. |
| `src/naive.ts` | The punching bag. Same marks. Buys the overnight print once per session, holds perp. |
| `src/lock.ts` | Chain-locks overnight state: each autopsy must reference the previous one, so records cannot be silently rewritten. |
| `logs/haircut.jsonl` | Haircut's full execution ledger. |
| `logs/naive.jsonl` | Naive's full execution ledger. |
| `logs/autopsies/` | One JSON file per autopsied day. Each contains the hash chain lock. |
| `out/bakeoff.md` | Scoreboard. Rebuilt after every meaningful action. |
| `scripts/` | Shell/TS entry points: `check-hub.sh`, `record-close.ts`, `record-open.ts` |

---

## Mandatory schedule (all times ET)

| When | What happens |
|------|-------------|
| **Wed** | Install Hub, confirm symbols, freeze mandate, open both books, snapshot marks |
| **Thu** | Engine complete. One forced REFUSE, one forced DELEVER on Haircut |
| **Fri 09:30–09:45** | First live `OPEN_WINDOW`. First autopsy. Rough 60 s tape |
| **Fri 19:20 → Mon 09:30** | Weekend solvency night. Haircut delever only |
| **Sun** | README, form draft, X draft. Feature freeze |
| **Mon 09:30–09:45** | Settlement row. Update `bakeoff.md` |
| **Mon before 23:59 UTC+8** | Submit form + links |

---

## Quick start

```bash
git clone https://github.com/bernieboy0001/haircut.git
cd haircut
npm install
cp .env.example .env        # fill BITGET_API_KEY / SECRET / PASSPHRASE
npm run tick                 # single tick
npm run close-snap           # cash-close snapshot
npm run open-window          # first open-window tick + autopsy
npm run typecheck            # TypeScript check
```

**Env keys — never committed:**

```
BITGET_API_KEY=
BITGET_SECRET_KEY=
BITGET_PASSPHRASE=
```

API keys are Bitget unified trading account (UTA) **paper trading** keys only. Live keys must never appear in this repository.

---

## How Haircut works

1. **Overnight / Weekend**: `clerk.ts` computes projected LTV (`projLtv`) by shocking rToken by `beta × btcMove` (default −5%). If `projLtv >= call (0.85)`, Haircut delevers to `target (0.80)` — repaying first if there's a live loan, otherwise reducing perp. Otherwise it arms at most one ticket for the next open window.
2. **OPEN_WINDOW (09:30–09:45 ET)**: Haircut may fire at most one ticket, and only a ticket armed for today, and only if the last autopsy hash exists (except night one). The LLM may write a one-line reason string but must never compute LTV, tax, size, or verdict.
3. **RTH (09:45–19:20 ET)**: No new Haircut risk.

---

## Disclosure

See [`DISCLOSURE.md`](DISCLOSURE.md) for the required shadow-book and paper-only language.