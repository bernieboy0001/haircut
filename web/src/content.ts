export const REPO_URL = 'https://github.com/bernieboy0001/haircut'

export const mandates = {
  equityStart: 10_000,
  rtoken: 'rNVDAUSDT',
  rtokenNotionalMax: 4_000,
  perp: 'BTCUSDT',
  perpNotionalMax: 2_000,
  perpLeverage: 3,
  ltv: {
    initial: 0.78,
    call: 0.85,
    liq: 0.91,
    targetAfterDelever: 0.80,
  },
  shockBtc: -5,
  betaRtokenToBtc: 0.4,
  openWindowEt: ['09:30', '09:45'],
  cashCloseEt: '19:20',
} as const

export const threeJobs = [
  {
    no: '01',
    job: 'Collateral for the loan',
    detail: 'Officially a yield wrapper — the price feed the loan is priced against.',
  },
  {
    no: '02',
    job: 'Something to buy',
    detail: 'In the paper demo it is also the overnight print Naive buys when it is cheaper than close.',
  },
  {
    no: '03',
    job: 'A position to liquidate',
    detail: 'Down to 9% the loan liquidates you. One asset, and it must be three things at once.',
  },
]

export const sessions = [
  {
    name: 'OPEN_WINDOW',
    window: '09:30 – 09:45 ET',
    rule: 'Fire one ticket armed for today, or stand. Max 1 action.',
  },
  {
    name: 'RTH',
    window: '09:45 – 19:20 ET',
    rule: 'No new risk. The day runs.',
  },
  {
    name: 'OVERNIGHT',
    window: '19:20 – 09:30 ET',
    rule: 'Project a 5% BTC shock. If projected LTV hits call, delever to target; else arm one ticket.',
  },
  {
    name: 'WEEKEND',
    window: 'Fri 19:20 → Mon 09:30 ET',
    rule: 'Solvency only — delever, never open.',
  },
]

export const scoreboardMetrics = [
  { label: 'Peak LTV', hint: 'vs call 85% / liq 91%' },
  { label: 'Min gap to call', hint: 'room left before delever' },
  { label: 'Max drawdown', hint: 'vs 10 000 USDT start' },
  { label: 'Overnight tax bps', hint: 'cost paid on fills' },
  { label: 'Open-window PnL', hint: '09:30–09:45 ET firing window' },
]