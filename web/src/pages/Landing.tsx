import { ArrowDownRight, ArrowUpRight, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import Reveal from '../components/Reveal'
import Tape from '../components/Tape'
import { useCountUp } from '../lib/useCountUp'
import { mandates, threeJobs, sessions, scoreboardMetrics } from '../content'

function Stat({ target, suffix = '', className = '' }: { target: number; suffix?: string; className?: string }) {
  const { ref, value } = useCountUp(target, { decimals: 0 })
  return (
    <span ref={ref} className={`font-nums font-mono ${className}`}>
      {suffix === 'USDT' ? Math.round(value).toLocaleString() : value}
      {suffix}
    </span>
  )
}

function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title">
      <div className="h-box pb-16 pt-16 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <Reveal>
              <div className="flex items-center gap-3">
                <span className="eyebrow">Agentic LTV risk · paper bake-off</span>
                <span className="hidden h-px w-8 bg-line sm:block" />
              </div>
            </Reveal>
            <Reveal>
              <h1
                id="hero-title"
                className="mt-6 max-w-xl text-[40px] font-semibold leading-[1.08] tracking-tight text-bone sm:text-[56px]"
              >
                One rToken is doing three jobs. Overnight those jobs can{' '}
                <span className="text-blood">liquidate you</span>.
              </h1>
            </Reveal>
            <Reveal>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-stone">
                Haircut manages loan-to-value risk through the night on a single
                rToken + BTCUSDT perp sleeve — projecting shocks, sizing delevers,
                and letting a deterministic engine make every call.
              </p>
            </Reveal>
            <Reveal className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                to="/dashboard"
                className="sheen group inline-flex items-center gap-2 bg-bone px-5 py-3 font-mono text-[13px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-blood hover:text-bone"
              >
                View scoreboard
                <ArrowUpRight size={15} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <a
                href="#rules"
                className="group inline-flex items-center gap-2 border border-line px-5 py-3 font-mono text-[13px] uppercase tracking-[0.12em] text-bone transition-colors hover:border-blood hover:text-blood"
              >
                The rules
                <ArrowDownRight size={15} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5" />
              </a>
            </Reveal>
          </div>

          <Reveal>
            <div className="animate-float border border-line bg-panel">
              <div className="flex items-center justify-between border-b border-line-soft px-5 py-3">
                <p className="eyebrow">Mandate card</p>
                <span className="flex items-center gap-1.5 font-nums font-mono text-[11px] uppercase tracking-[0.14em] text-ledger">
                  <span className="h-1.5 w-1.5 rounded-full bg-ledger animate-pulse-dot" />
                  shadow
                </span>
              </div>
              <dl className="divide-y divide-line-soft">
                <div className="flex items-center justify-between px-5 py-3.5">
                  <dt className="text-[13px] text-dim">Equity start</dt>
                  <dd className="font-nums font-mono text-[15px] text-bone">
                    <Stat target={mandates.equityStart} suffix=" USDT" />
                  </dd>
                </div>
                <div className="flex items-center justify-between px-5 py-3.5">
                  <dt className="text-[13px] text-dim">rToken max notional</dt>
                  <dd className="font-nums font-mono text-[15px] text-bone">
                    <Stat target={mandates.rtokenNotionalMax} suffix=" USDT" />
                  </dd>
                </div>
                <div className="flex items-center justify-between px-5 py-3.5">
                  <dt className="text-[13px] text-dim">BTC shock model</dt>
                  <dd className="font-nums font-mono text-[15px] text-bone">
                    −{mandates.shockBtc}% × β {mandates.betaRtokenToBtc}
                  </dd>
                </div>
                <div className="grid grid-cols-3 divide-x divide-line-soft">
                  {(['initial', 'call', 'liq'] as const).map((k) => (
                    <div key={k} className="px-5 py-4">
                      <p className="eyebrow">{k}</p>
                      <p
                        className={`font-nums mt-1 font-mono text-[20px] ${
                          k === 'call' ? 'text-blood' : k === 'liq' ? 'text-dim' : 'text-bone'
                        }`}
                      >
                        <Stat target={Math.round(mandates.ltv[k] * 100)} suffix="%" />
                      </p>
                    </div>
                  ))}
                </div>
              </dl>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function PullQuote() {
  return (
    <section className="rule-x bg-panel">
      <div className="h-box py-12">
        <Reveal>
          <p className="max-w-3xl text-[22px] font-medium leading-snug tracking-tight text-bone sm:text-[30px]">
            Haircut only removes risk until the cash open.{' '}
            <span className="text-dim">Naive just buys the overnight print and holds.</span>{' '}
            Same marks. Same sleeve. Different rule.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

function Sleeve() {
  return (
    <section id="sleeve" className="h-box scroll-mt-20 py-20">
      <Reveal>
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="eyebrow">01 · The sleeve</p>
            <h2 className="mt-3 text-[26px] font-semibold tracking-tight text-bone sm:text-[34px]">
              One rToken, three jobs
            </h2>
          </div>
          <p className="hidden max-w-xs text-right text-[13px] leading-relaxed text-dim sm:block">
            {mandates.rtoken} + {mandates.perp} perp. No second stock.
          </p>
        </div>
      </Reveal>

      <div className="mt-10 grid gap-px border border-line bg-line md:grid-cols-3">
        {threeJobs.map((j) => (
          <Reveal key={j.no}>
            <div className="group h-full bg-panel p-7 transition-colors duration-300 hover:bg-panel-2">
              <p className="font-nums font-mono text-[12px] text-blood transition-transform duration-300 group-hover:-translate-y-0.5">
                {j.no}
              </p>
              <h3 className="mt-4 text-[17px] font-semibold text-bone">{j.job}</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-dim">{j.detail}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Rules() {
  const hair = [
    { label: 'Project', value: 'Shocks collateral −5% × β 0.4 each overnight tick' },
    { label: 'Delever', value: 'When projected LTV ≥ 85%, delever to target 80%' },
    { label: 'Arm', value: 'Exactly one ticket for the 09:30–09:45 ET window' },
    { label: 'Chain', value: 'Every autopsy SHA-256 locked — no state rewriting' },
  ]
  const naive = [
    { label: 'Watch', value: 'Waits for an overnight print cheaper than cash close' },
    { label: 'Buy', value: 'Buys once per session, then holds the perp' },
    { label: 'Held', value: 'Carries the sleeve through every overnight move' },
    { label: 'Proof', value: 'Same marks, same calendar — the control twin' },
  ]

  return (
    <section id="rules" className="scroll-mt-20 py-20">
      <div className="h-box">
        <Reveal>
          <p className="eyebrow">02 · The rules</p>
          <h2 className="mt-3 max-w-xl text-[26px] font-semibold tracking-tight text-bone sm:text-[34px]">
            Two accounts. One deterministic engine decides who survives the night.
          </h2>
        </Reveal>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Reveal>
          <div className="h-box w-full border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line-soft px-7 py-4">
              <p className="font-mono text-[15px] font-semibold text-bone">Haircut</p>
              <span className="font-nums font-mono text-[11px] uppercase tracking-[0.14em] text-ledger">
                ltv-managed
              </span>
            </div>
            <ul className="divide-y divide-line-soft">
              {hair.map((r) => (
                <li key={r.label} className="grid grid-cols-[110px_1fr] gap-5 px-7 py-4 transition-colors duration-200 hover:bg-panel-2">
                  <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-blood">{r.label}</span>
                  <span className="text-[13px] leading-relaxed text-stone">{r.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal>
          <div className="h-box w-full border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line-soft px-7 py-4">
              <p className="font-mono text-[15px] font-semibold text-bone">Naive</p>
              <span className="font-nums font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                control twin
              </span>
            </div>
            <ul className="divide-y divide-line-soft">
              {naive.map((r) => (
                <li key={r.label} className="grid grid-cols-[110px_1fr] gap-5 px-7 py-4 transition-colors duration-200 hover:bg-panel-2">
                  <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-dim">{r.label}</span>
                  <span className="text-[13px] leading-relaxed text-stone">{r.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Clock() {
  return (
    <section id="clock" className="rule-x scroll-mt-20 py-20">
      <div className="h-box">
        <Reveal>
          <p className="eyebrow">03 · The clock</p>
          <h2 className="mt-3 max-w-xl text-[26px] font-semibold tracking-tight text-bone sm:text-[34px]">
            The mandate is a schedule with teeth
          </h2>
        </Reveal>
      </div>

      <div className="mt-10 grid gap-px border border-line bg-line md:grid-cols-2 lg:grid-cols-4">
        {sessions.map((s) => (
          <Reveal key={s.name}>
            <div className="group h-full bg-panel p-6 transition-colors duration-300 hover:bg-panel-2">
              <p className="font-mono text-[13px] font-semibold text-bone">{s.name}</p>
              <p className="font-nums mt-1 font-mono text-[11px] text-blood">{s.window}</p>
              <p className="mt-4 text-[13px] leading-relaxed text-dim">{s.rule}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Scoreboard() {
  return (
    <section id="scoreboard" className="h-box scroll-mt-20 py-20">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">04 · Scoreboard</p>
            <h2 className="mt-3 text-[26px] font-semibold tracking-tight text-bone sm:text-[34px]">
              What this bake-off prints
            </h2>
          </div>
          <Link
            to="/dashboard"
            className="sheen group inline-flex items-center gap-2 border border-line px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.12em] text-bone transition-colors hover:border-blood hover:text-blood"
          >
            Live dashboard
            <ArrowUpRight size={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-10 overflow-x-auto border border-line">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-panel">
                <th className="px-6 py-4 eyebrow">Metric</th>
                <th className="px-6 py-4 eyebrow">Haircut</th>
                <th className="px-6 py-4 eyebrow">Naive</th>
                <th className="px-6 py-4 eyebrow">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft bg-ink">
{scoreboardMetrics.map((m, idx) => (
                <tr key={m.label} className="group transition-colors hover:bg-panel">
                  <td className="px-6 py-4">
                    <p className="font-mono text-[13px] font-medium text-bone">{m.label}</p>
                    <p className="mt-0.5 text-[11px] text-dim">{m.hint}</p>
                  </td>
                  <td className="px-6 py-4 font-nums font-mono text-[16px] text-bone">
                    {idx === scoreboardMetrics.length - 1 ? <Stat target={0} suffix=" USDT" /> : <Stat target={0} suffix="%" />}
                  </td>
                  <td className="px-6 py-4 font-nums font-mono text-[16px] text-bone">
                    {idx === scoreboardMetrics.length - 1 ? '0.00 USDT' : '0%'}
                  </td>
                  <td className="px-6 py-4 font-nums font-mono text-[12px] text-dim">
                    {idx === 0 ? 'call 85 A� liq 91' : '�?"'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
      <Reveal>
        <p className="mt-4 font-nums font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
          First autopsy lands 09:30–09:45 ET after the live open window · settles Mon 09:30–09:45 ET
        </p>
      </Reveal>
    </section>
  )
}

function Disclosure() {
  return (
    <section className="h-box rule-x py-14">
      <div className="grid gap-8 md:grid-cols-2">
        <Reveal>
          <div className="flex gap-4">
            <ShieldCheck size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-blood" />
            <div>
              <p className="font-mono text-[13px] font-semibold text-bone">Paper trading only</p>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-dim">
                Credits are UTA demo keys. Live keys never enter the repo. The live
                cryptoloans module is not served in demo, so the books run in
                shadow mode — LTV is deterministic arithmetic against the mandate,
                never an LLM guess.
              </p>
            </div>
          </div>
        </Reveal>
        <Reveal>
          <div className="flex gap-4">
            <div className="mt-0.5 font-mono text-[15px] text-blood">#</div>
            <div>
              <p className="font-mono text-[13px] font-semibold text-bone">Built for Bitget Hackathon</p>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-dim">
                Track: Agentic Trading → Cross-Asset Execution Agent. Follow{' '}
                <span className="text-stone">@Bitget_AI</span> and watch the
                bake-off run its week.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-ink">
      <Header />
      <main>
        <Hero />
        <Tape />
        <PullQuote />
        <Sleeve />
        <Rules />
        <Clock />
        <Scoreboard />
        <Disclosure />
      </main>
      <Footer />
    </div>
  )
}