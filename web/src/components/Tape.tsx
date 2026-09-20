const TAPE = [
  { label: 'NVDAUSDT', value: '221.15' },
  { label: 'BTCUSDT', value: '78 113' },
  { label: 'shock model', value: '-5% × beta 0.4' },
  { label: 'open window', value: '09:30–09:45 ET' },
  { label: 'cash close', value: '19:20 ET' },
  { label: 'bands', value: '78 / 85 / 91' },
  { label: 'target', value: '80' },
  { label: 'hub', value: 'paper · shadow' },
  { label: 'loan module', value: 'not served in demo' },
]

// Tape — an endlessly looping ticker strip of live mandate/market facts.
// The track holds two identical halves; sliding -50% loops seamlessly.
// Spacing lives INSIDE each half (px-6 per item) so both halves stay
// exactly equal width — a parent gap would break the -50% seam.
function TapeHalf({ hidden }: { hidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {TAPE.map((t) => (
        <span key={t.label} className="tape-item px-6">
          {t.label}
          <span className="mx-3 text-ghost">·</span>
          <span className="text-bone">{t.value}</span>
          <span className="ml-6 text-ghost">/</span>
        </span>
      ))}
    </div>
  )
}

export default function Tape() {
  return (
    <div
      className="rule-x relative overflow-hidden border-b border-line bg-panel"
      role="marquee"
      aria-label="Live bake-off tape"
    >
      <div className="tape-track py-3">
        <TapeHalf />
        <TapeHalf hidden />
      </div>
      <div className="tape-fade tape-fade-l" aria-hidden="true" />
      <div className="tape-fade tape-fade-r" aria-hidden="true" />
    </div>
  )
}