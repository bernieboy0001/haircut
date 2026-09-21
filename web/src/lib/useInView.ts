import { useEffect, useRef, useState } from 'react'

// useInView — fires once when the element scrolls into view (via IntersectionObserver),
// with a `rootMargin` that triggers slightly before the element is fully visible.
// Falls back to a timeout (default 3s) so content never stays hidden if IO fails.
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: IntersectionObserverInit & { fallbackMs?: number } = {
    threshold: 0.18,
    rootMargin: '0px 0px -8% 0px',
    fallbackMs: 3000,
  }
) {
  const { fallbackMs = 3000, ...ioOptions } = options
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let settled = false
    const settle = () => {
      if (!settled) {
        settled = true
        setInView(true)
      }
    }

    const timer = setTimeout(settle, fallbackMs)

    if (typeof IntersectionObserver === 'undefined') {
      settle()
      return () => clearTimeout(timer)
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          settle()
          io.disconnect()
        }
      },
      ioOptions
    )
    io.observe(el)
    return () => {
      io.disconnect()
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { ref, inView }
}