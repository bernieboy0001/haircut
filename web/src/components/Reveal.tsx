import type { ReactNode, CSSProperties } from 'react'
import { useInView } from '../lib/useInView'

type RevealProps = {
  children: ReactNode
  /** Delay in ms, applied after the element enters view. */
  delay?: number
  /** Duration in ms. */
  duration?: number
  /** Direction the element travels from. */
  from?: 'up' | 'down' | 'left' | 'right' | 'none'
  className?: string
  style?: CSSProperties
}

const travel: Record<NonNullable<RevealProps['from']>, string> = {
  up: 'translate3d(0, 26px, 0)',
  down: 'translate3d(0, -26px, 0)',
  left: 'translate3d(26px, 0, 0)',
  right: 'translate3d(-26px, 0, 0)',
  none: 'translate3d(0, 0, 0)',
}

// Reveal — fade + slide content in once when it scrolls into view.
// The hidden transform is applied inline; CSS (.reveal / .is-visible) owns
// opacity + the transition, so `prefers-reduced-motion` can disarm it cleanly.
export default function Reveal({
  children,
  delay = 0,
  duration = 700,
  from = 'up',
  className = '',
  style,
}: RevealProps) {
  const { ref, inView } = useInView()

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={{
        transform: inView ? undefined : travel[from],
        transitionDuration: inView ? `${duration}ms` : undefined,
        transitionDelay: inView ? `${delay}ms` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}