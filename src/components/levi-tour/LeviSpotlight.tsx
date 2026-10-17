import { useEffect, useId, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

type Hole = { x: number; y: number; width: number; height: number }

/** Leave the real element (and its focus ring/glow) untouched and fully visible. */
export function getLeviSpotlightHole(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): Hole {
  const padding = 12
  return { x: rect.left - padding, y: rect.top - padding, width: rect.width + padding * 2, height: rect.height + padding * 2 }
}

export function LeviSpotlight({ root }: { root: RefObject<HTMLDivElement | null> }) {
  const id = useId()
  const [holes, setHoles] = useState<Hole[]>([])

  useEffect(() => {
    const container = root.current
    if (!container) return
    let targets: Element[] = []
    let frame = 0
    function measure() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setHoles(targets.filter((target) => target.isConnected && target.getClientRects().length)
          .map((target) => getLeviSpotlightHole(target.getBoundingClientRect())))
      })
    }
    const resize = new ResizeObserver(measure)
    function refresh() {
      targets = Array.from(container!.querySelectorAll('[data-levi-highlighted="true"], [data-tour-highlighted="true"]'))
      resize.disconnect()
      resize.observe(container!)
      targets.forEach((target) => resize.observe(target))
      measure()
    }
    const mutations = new MutationObserver(refresh)
    mutations.observe(container, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['data-levi-highlighted', 'data-tour-highlighted'] })
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    refresh()
    return () => {
      cancelAnimationFrame(frame)
      mutations.disconnect()
      resize.disconnect()
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [root])

  if (!holes.length) return null
  return createPortal(
    <svg className="levi-spotlight" aria-hidden="true" focusable="false">
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%" style={{ maskType: 'luminance' }}>
          <rect width="100%" height="100%" fill="white" />
          {holes.map((hole, index) => <rect key={index} {...hole} rx="12" fill="black" />)}
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="#172036" fillOpacity=".3" mask={`url(#${id})`} />
    </svg>, document.body,
  )
}
