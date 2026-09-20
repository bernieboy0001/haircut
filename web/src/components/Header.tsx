import { Link } from 'react-router-dom'
import { ExternalLink, Moon, Sun } from 'lucide-react'
import { REPO_URL } from '../content'
import { useTheme } from '../lib/useTheme'

const NAV = [
  { href: '#sleeve', label: 'The sleeve' },
  { href: '#rules', label: 'The rules' },
  { href: '#clock', label: 'The clock' },
  { href: '#scoreboard', label: 'Scoreboard' },
]

export default function Header() {
  const { theme, toggle } = useTheme()

  return (
    <header className="sticky top-0 z-50 bg-ink/90 backdrop-blur-md rule-x">
      <div className="h-box flex h-14 items-center justify-between">
        <a href="#top" className="flex items-baseline gap-2">
          <span className="font-mono text-[15px] font-semibold tracking-tight text-bone">
            haircut<span className="text-blood">.</span>
          </span>
          <span className="eyebrow hidden sm:inline">ltv·mgmt</span>
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="text-[13px] text-dim transition-colors hover:text-bone"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="flex h-9 w-9 items-center justify-center border border-line text-dim transition-all duration-300 hover:border-blood hover:text-blood"
          >
            {theme === 'dark' ? (
              <Sun size={16} strokeWidth={1.5} />
            ) : (
              <Moon size={16} strokeWidth={1.5} />
            )}
          </button>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="text-dim transition-colors hover:text-bone"
          >
            <ExternalLink size={18} strokeWidth={1.5} />
          </a>
          <Link
            to="/dashboard"
            className="border border-line px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.12em] text-bone transition-colors hover:border-blood hover:text-blood"
          >
            Scoreboard
          </Link>
        </div>
      </div>
    </header>
  )
}