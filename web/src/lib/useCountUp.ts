import { useEffect, useRef, useState } from 'react'
import { useInView } from '../lib/useInView'

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

// useCountUp — smooth numeric count-up once the element is in view.
export function useCountUp(target: number, opts: { duration?: number; decimals?: number } = {}) {
  const { ref, inView } = useInView()
  const { duration = 1400, decimals = 0 } = opts
  const [value, setValue] = useState(0)
  const raf = useRef<number>(0)

  useEffect(() => {
    if (!inView) return
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      setValue(Number((target * easeOutExpo(p)).toFixed(decimals)))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [inView, target, duration, decimals])

  return { ref, value }
}