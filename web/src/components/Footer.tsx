import { Link } from 'react-router-dom'
import { REPO_URL } from '../content'

export default function Footer() {
  return (
    <footer className="rule-x">
      <div className="h-box py-10">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <p className="font-mono text-[15px] font-semibold text-bone">
              haircut<span className="text-blood">.</span>
            </p>
            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-dim">
              A deterministic, schedule-aware LTV risk-management demo. Paper
              trading only — no live keys, no live loans.
            </p>
          </div>

          <nav className="flex flex-col gap-2 text-[13px]">
            <p className="eyebrow">Project</p>
            <a href="#sleeve" className="text-dim transition-colors hover:text-bone">The sleeve</a>
            <a href="#rules" className="text-dim transition-colors hover:text-bone">The rules</a>
            <a href="#scoreboard" className="text-dim transition-colors hover:text-bone">Scoreboard</a>
            <Link to="/dashboard" className="text-dim transition-colors hover:text-bone">Dashboard</Link>
          </nav>

          <div className="flex flex-col gap-2 text-[13px]">
            <p className="eyebrow">Links</p>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-dim transition-colors hover:text-bone">
              GitHub
            </a>
            <a href={`${REPO_URL}/blob/master/README.md`} target="_blank" rel="noreferrer" className="text-dim transition-colors hover:text-bone">
              README
            </a>
            <a href={`${REPO_URL}/blob/master/DISCLOSURE.md`} target="_blank" rel="noreferrer" className="text-dim transition-colors hover:text-bone">
              Disclosure
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-6">
          <p className="eyebrow">Paper only · shadow book · #BitgetHackathon</p>
          <p className="font-nums font-mono text-[11px] text-dim">
            LTV bands 78 / 85 / 91 · target 80
          </p>
        </div>
      </div>
    </footer>
  )
}