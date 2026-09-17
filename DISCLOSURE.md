# Disclosure

This repository is a **demo / paper-only** project.

## Confirmed Hub facts (probe, 2026-09-16)

- Connectivity: `api.bitget.com` does **not** resolve via system DNS on this host
  (`getaddrinfo ENOTFOUND`); the SDK's DNS fallback in `src/dns-fix.js` (two pinned
  Cloudflare IPs) reaches the API. Those pinned IPs intermittently time out under the
  SDK's 10 s connect budget (`UND_ERR_CONNECT_TIMEOUT`), so read-only Hub calls are
  serialized and retried up to twice; **order placement is never retried** (avoids
  duplicate fills). The order book uses the v3 compact `b`/`a` keys.
- rToken symbol: **`RNVDAUSDT`** is a listed SPOT pair (probe data: `last ≈ 215`).
  Merchant case is accepted (`rNVDAUSDT` works).
- Perp sleeve: **`BTCUSDT`** (USDT-FUTURES) is listed, `markPrice` present.
- Loan module: **not available in the Bitget demo environment.** With a valid UTA
  demo key, `getLoanCoins` and `getBorrowOngoing` return HTTP 404 (Request URL NOT
  FOUND). `getAccountAssets` authenticates and returns normally, so the key is
  correct — the cryptoloans host simply is not served in demo. **Verdict:
  `loan_module = no` → Haircut operates on the shadow book.**
- Paper key provisioning: the key must be a **UTA demo key** created inside
  Futures → Demo Trading → API Keys. A live key with the SDK's `paptrading: 1`
  header is rejected with Bitget `code 40099 "exchange environment is incorrect"`.
- Test probes: `scripts/probe-public.ts` (detailed market/DNS/loan diagnostic) and
  `scripts/check-hub.sh` → `scripts/check-hub.ts` (five-line status report, real
  loan probe, no hardcoded DNS).

## Status

- **No live keys**: all API credentials are paper trading keys for the Bitget unified trading account (UTA v3). Live API keys are never committed to the repository.
- **Cloud network**: the host's system DNS cannot resolve `api.bitget.com`; the
  probe confirms the DNS fallback is the only path to the API on this machine.
- **Shadow book (confirmed mode)**: the live cryptoloans module is not served in
  the Bitget demo environment, so Haircut and Naive always run the shadow book: no
  loan is ever filled and no collateral is pledged. Haircut uses the published LTV
  bands (78 / 85 / 91) as projections. All LTV computations are deterministic
  arithmetic against the mandate's `shock_btc` and `beta_rtoken_to_btc` constants.
- **Naive is a shadow twin**: Naive runs on the same marks as Haircut and is logged for comparison. Its positions are tracked in `logs/naive.jsonl` and `state/naive.jsonl` and are not executed against any live orderbook unless the paper account explicitly supports a second sleeve.
- **LLM scope**: any LLM may write a one-line reason string. It must never compute LTV, tax, position size, or a verdict. All decision logic lives in deterministic code.
- **No guarantee of live accuracy**: paper trading, simulated LTV, and shadow positions may differ from real-market execution, slippage, and funding rates. The scoreboard (`out/bakeoff.md`) is a comparison metric, not an audited financial statement.

Disclosed per the hackathon submission requirements.