# X post — draft

Post at FINAL submission (after Mon 09:45 ET settlement), once numbers are real.

Repo: https://github.com/bernieboy0001/haircut
Dashboard: https://bernieboy0001.github.io/haircut/

## Main post

An agent that manages loan-to-value (LTV) risk overnight — with zero AI guessing
the math.

Haircut is a deterministic, schedule-aware agent running two paper accounts on one
rToken + BTCUSDT perp sleeve:

- **Haircut** projects collateral shocks every overnight tick, sizes a delever to a
  target LTV, and arms exactly one ticket for the 09:30–09:45 ET open.
- **Naive** (control twin) buys a cheaper-than-close overnight print, once, and holds.

Same marks. Same sleeve. Different rule.

Scoreboard (10 000 USDT start):
- Peak LTV vs call 0.85 / liq 0.91: `<PEAK_LTV>%`
- Min gap to call: `<GAP>%`
- Max drawdown: `<DD>%`
- Overnight tax bps: `<TAX>`
- Open-window PnL: `<PNL> USDT`

Every overnight write is chained to a SHA-256 autopsy — no state rewriting, no
silent second tries.

Repo: https://github.com/bernieboy0001/haircut

#BitgetHackathon @Bitget_AI

## Alt (shorter)

Two bots, one BTC sleeve, 10k each. One armors LTV overnight, one buys cheap
prints. Same market, different rules — the scoreboard decides.
Repo: https://github.com/bernieboy0001/haircut #BitgetHackathon @Bitget_AI

## Notes

- Mention `Demo.mp4` in a second post when the video is final.
- Use `/X` + docs in replies if hacked: README is the runbook.