import { Link } from 'react-router-dom'
import { ArrowLeft, LineChart } from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import Reveal from '../components/Reveal'
import { useCountUp } from '../lib/useCountUp'
import { useInView } from '../lib/useInView'
import raw from '../data/snapshot.json'

// ---------------------------------------------------------------------------
// Types — mirrors haircut/skills/haircut/SKILL.md log + autopsy schemas.
// ---------------------------------------------------------------------------
type BookSummary = {
  equity: number
  peakLtv: number
  peakProjLtv: number
  taxOnFills: number
  actions: number
  lastTs: string | null
  lastPx: number | null
  lastSession: string | null
  lastAction: string | null
}

type Autopsy = {
  date: string
  cash_close: number
  overnight_rtoken_high: number
  overnight_rtoken_low: number
  btc_move: number
  peak_ltv_haircut: number
  peak_ltv_naive: number
  open_vwap_or_mid_0930_0945: number
  tax_vs_open_bps: number
  haircut_action_at_open: string
  hash: string
}

type LedgerRow = {
  ts: string
  et?: string
  account: string
  session: string
  action: string
  symbol: string
  px: number
  ltv: number
  tax_bps: number
}

type Snapshot = {
  generatedAt: string
  haircut: BookSummary | null
  naive: BookSummary | null
  autopsies: Autopsy[]
  ledger: LedgerRow[]
  ticket: {
    date: string
    symbol: string
    side: string
    price: number
    notionalUsdt: number
    active: boolean
    reason: string
  } | null
  lastHash: string | null
  hasAutopsy: boolean
}

const snap = raw as Snapshot
const START = 10_000
const CALL = 85

// ---------------------------------------------------------------------------
// Primitives — Swiss Pulse: numbers dominate, expo.out entrances.
// ---------------------------------------------------------------------------
function Num({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}: {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}) {
  const { ref, value: v } = useCountUp(value, { decimals })
  return (
    <span ref={ref} className={`font-nums font-mono ${className}`}>
      {prefix}
      {v.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}

function FillBar({ pct, tone = '' }: { pct: number; tone?: string }) {
  const { ref, inView } = useInView()
  return (
    <div ref={ref} className="eq-bar">
      <div className={`eq-fill ${tone}`} style={{ width: inView ? `${Math.min(Math.max(pct, 0), 100)}%` : '0%' }} />
    </div>
  )
}

function ActionBadge({ action }: { action: string }) {
  const tone =
    action === 'FIRE' || action === 'DELEVER' || action === 'BUY'
      ? 'badge-hot'
      : action === 'ARM'
        ? 'badge-arm'
        : 'badge-calm'
  return <span className={`badge ${tone}`}>{action}</span>
}

// ---------------------------------------------------------------------------
// Sections — data-in-motion: every number paired with visual weight,
// 2–3 metrics per row, no chart libraries, no gridlines, no legends.
// ---------------------------------------------------------------------------
function EquityDuel({ h, n }: { h: BookSummary; n: BookSummary }) {
  const books = [
    { name: 'Haircut', tone: 'ledger', s: h },
    { name: 'Naive', tone: 'bone', s: n },
  ]
  return (
    <div className="grid gap-px border border-line bg-line md:grid-cols-2">
      {books.map((b) => {
        const dd = ((b.s.equity - START) / START) * 100
        return (
          <Reveal key={b.name} className="bg-panel">
            <div className="p-7 sm:p-9">
              <p className="eyebrow-hard">{b.name} · equity</p>
              <p className="mt-3">
                <Num
                  value={b.s.equity}
                  decimals={2}
                  prefix="$"
                  className={`text-[64px] font-extrabold leading-none tracking-tight sm:text-[88px] ${
                    b.tone === 'ledger' ? 'text-ledger' : 'text-bone'
                  }`}
                />
              </p>
              <div className="mt-6">
                <FillBar pct={(b.s.equity / START) * 100} tone={b.tone === 'ledger' ? 'fill-ledger' : 'fill-bone'} />
              </div>
              <div className="mt-4 flex items-center justify-between font-mono text-[12px] uppercase tracking-[0.12em]">
                <span className="text-dim">
                  drawdown <Num value={dd} decimals={2} suffix="%" className="text-stone" />
                </span>
                <span className="text-dim">
                  {b.s.lastSession} · {b.s.lastAction}
                </span>
              </div>
            </div>
          </Reveal>
        )
      })}
    </div>
  )
}

function BandBar({ h, n }: { h: BookSummary; n: BookSummary }) {
  const marks = [
    { v: 78, label: 'initial 78', cls: 'tick-dim' },
    { v: 80, label: 'target 80', cls: 'tick-ledger' },
    { v: 85, label: 'call 85', cls: 'tick-blood' },
    { v: 91, label: 'liq 91', cls: 'tick-dim' },
  ]
  return (
    <Reveal className="relative overflow-hidden border border-line bg-panel">
      <span className="ghost-num" aria-hidden="true">
        85
      </span>
      <div className="relative p-7 sm:p-9">
        <div className="flex items-baseline justify-between gap-4">
          <p className="eyebrow-hard">Peak LTV vs bands</p>
          <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-dim">
            haircut <Num value={h.peakLtv * 100} decimals={1} suffix="%" className="text-blood" />
            <span className="mx-2 text-ghost">/</span>
            naive <Num value={n.peakLtv * 100} decimals={1} suffix="%" className="text-bone" />
          </p>
        </div>
        <div className="band mt-10" role="img" aria-label="Peak LTV against call and liquidation bands">
          <div className="band-line" />
          {marks.map((m) => (
            <div key={m.v} className="band-mark" style={{ left: `${m.v}%` }}>
              <span className={`band-tick ${m.cls}`} />
              <span className="band-label">{m.label}</span>
            </div>
          ))}
          <span className="band-peak peak-h" style={{ left: `${h.peakLtv * 100}%` }} title="Haircut peak" />
          <span className="band-peak peak-n" style={{ left: `${n.peakLtv * 100}%` }} title="Naive peak" />
        </div>
        <p className="mt-8 font-mono text-[12px] uppercase tracking-[0.12em] text-dim">
          gap to call · haircut <Num value={CALL - h.peakLtv * 100} decimals={1} suffix="pts" className="text-ledger" />
          <span className="mx-2 text-ghost">/</span>
          naive <Num value={CALL - n.peakLtv * 100} decimals={1} suffix="pts" className="text-stone" />
        </p>
      </div>
    </Reveal>
  )
}

function Trio({ h, n }: { h: BookSummary; n: BookSummary }) {
  const cells: { label: string; hint: string; value: number; suffix?: string; prefix?: string; decimals?: number }[] = [
    { label: 'Overnight tax on fills', hint: 'sum bps · both books', value: h.taxOnFills + n.taxOnFills, suffix: ' bps' },
    { label: 'Last mark', hint: `${h.lastSession} · rNVDAUSDT`, value: h.lastPx ?? 0, decimals: 2, prefix: '' },
    { label: 'Engine actions', hint: 'haircut + naive ticks', value: h.actions + n.actions, suffix: '' },
  ]
  return (
    <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
      {cells.map((c) => (
        <Reveal key={c.label} className="bg-panel">
          <div className="p-7">
            <p className="eyebrow-hard">{c.label}</p>
            <p className="mt-3">
              <Num
                value={c.value}
                decimals={c.decimals ?? 0}
                prefix={c.prefix ?? ''}
                suffix={c.suffix ?? ''}
                className="text-[48px] font-extrabold leading-none tracking-tight text-bone sm:text-[56px]"
              />
            </p>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">{c.hint}</p>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

function Ledger({ rows }: { rows: LedgerRow[] }) {
  return (
    <Reveal className="border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line-soft px-7 py-4">
        <p className="eyebrow-hard">Session ledger</p>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">{rows.length} rows</p>
      </div>
      <div className="overflow-x-auto">
        <table className="ledger w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {['Time', 'Book', 'Session', 'Action', 'Px', 'LTV'].map((c) => (
                <th key={c} className="px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map((r, i) => (
              <tr key={`${r.ts}-${r.account}-${i}`} className="ledger-row">
                <td className="px-6 py-3 font-mono text-[12px] text-stone">
                  {(r.et ?? r.ts).slice(5, 16).replace('T', ' ')}
                </td>
                <td className="px-6 py-3 font-mono text-[12px] uppercase tracking-[0.1em] text-dim">{r.account}</td>
                <td className="px-6 py-3 font-mono text-[12px] text-stone">{r.session}</td>
                <td className="px-6 py-3">
                  <ActionBadge action={r.action} />
                </td>
                <td className="px-6 py-3 font-mono text-[12px] text-bone">
                  {r.px ? r.px.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                </td>
                <td className="px-6 py-3 font-mono text-[12px] text-stone">
                  {r.ltv ? `${(r.ltv * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Reveal>
  )
}

function AutopsyChain({ autopsies, lastHash }: { autopsies: Autopsy[]; lastHash: string | null }) {
  return (
    <div className="grid gap-px border border-line bg-line md:grid-cols-2">
      {autopsies.map((a, i) => (
        <Reveal key={a.date} className="bg-panel">
          <div className="p-7">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[15px] font-semibold text-bone">{a.date}</p>
              <ActionBadge action={a.haircut_action_at_open} />
            </div>
            <p className="mt-4">
              <Num value={a.cash_close} decimals={2} className="text-[34px] font-extrabold tracking-tight text-dim" />
              <span className="mx-2 font-mono font-extrabold text-blood">→</span>
              <Num
                value={a.open_vwap_or_mid_0930_0945}
                decimals={2}
                className="text-[34px] font-extrabold tracking-tight text-bone"
              />
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[12px] uppercase tracking-[0.12em] text-dim">
              <span>
                tax <Num value={a.tax_vs_open_bps} suffix=" bps" className="text-stone" />
              </span>
              <span>
                btc <Num value={a.btc_move * 100} decimals={2} suffix="%" className="text-stone" />
              </span>
            </div>
            <p className="mt-4 truncate font-mono text-[11px] text-ghost" title={a.hash}>
              ⛓ {a.hash.slice(0, 16)}…{i === autopsies.length - 1 && lastHash ? ' · tip' : ''}
            </p>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Dashboard() {
  if (!snap.hasAutopsy || !snap.haircut || !snap.naive) {
    return (
      <div className="min-h-screen bg-ink">
        <Header />
        <main className="h-box flex min-h-[60vh] flex-col items-start justify-center py-24">
          <div className="flex items-center gap-3">
            <LineChart size={18} strokeWidth={1.5} className="text-blood" />
            <span className="eyebrow-hard">Live bake-off dashboard</span>
          </div>
          <h1 className="mt-6 max-w-xl text-[34px] font-semibold leading-tight tracking-tight text-bone sm:text-[44px]">
            The dashboard lands after the first autopsy.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-stone">
            Live rendering of peak LTV, gap-to-call, drawdown, overnight tax and open-window PnL — streaming from{' '}
            <span className="font-mono text-bone">logs/haircut.jsonl</span> and{' '}
            <span className="font-mono text-bone">logs/naive.jsonl</span> — goes live when the first 09:30–09:45 open
            window settles.
          </p>
          <Link
            to="/"
              className="mt-9 inline-flex items-center gap-2 bg-bone px-5 py-3 font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-blood hover:text-bone"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            Back to the brief
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  const { haircut: h, naive: n } = snap
  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <main className="dash-grid">
        <div className="h-box pb-20 pt-14 sm:pt-16">
          <Reveal>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <LineChart size={18} strokeWidth={1.5} className="text-blood" />
                <span className="eyebrow-hard">Live bake-off dashboard</span>
              </div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                {h.lastSession} · snapshot {snap.generatedAt.slice(0, 16).replace('T', ' ')}Z
              </p>
            </div>
          </Reveal>

          <div className="mt-8">
            <EquityDuel h={h} n={n} />
          </div>

          <div className="mt-6">
            <BandBar h={h} n={n} />
          </div>

          <div className="mt-6">
            <Trio h={h} n={n} />
          </div>

          <Reveal className="mt-6">
            <div className="flex items-center justify-between gap-6">
              <p className="eyebrow-hard">Autopsy chain</p>
              {snap.ticket?.active && (
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                  armed · {snap.ticket.side} {snap.ticket.symbol} ${snap.ticket.notionalUsdt.toLocaleString()} →{' '}
                  {snap.ticket.date}
                </p>
              )}
            </div>
          </Reveal>
          <div className="mt-4">
            <AutopsyChain autopsies={snap.autopsies} lastHash={snap.lastHash} />
          </div>

          <div className="mt-6">
            <Ledger rows={snap.ledger} />
          </div>

          <Reveal className="mt-10">
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-bone px-5 py-3 font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-blood hover:text-bone"
            >
              <ArrowLeft size={15} strokeWidth={2} />
              Back to the brief
            </Link>
          </Reveal>
        </div>
      </main>
      <Footer />
    </div>
  )
}
