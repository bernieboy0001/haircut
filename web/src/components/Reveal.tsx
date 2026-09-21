import type { ReactNode, CSSProperties } from 'react'

// Reveal — no-op, renders children immediately. No animation, no IO, no delays.
export default function Reveal({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return <div className={className} style={style}>{children}</div>
}