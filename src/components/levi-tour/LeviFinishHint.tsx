import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { availableFinishButton, getFinishHintPosition, leviFinishLesson, observeFinishButton } from '../../services/leviFinishHint'
import { appStorage } from '../../services/storage'
import { LeviTour } from './LeviTour'
import { LeviSpotlight } from './LeviSpotlight'
import './levi-finish-hint.css'

type Store = { hasViewed: () => boolean; markViewed: () => boolean }
const productionStore: Store = { hasViewed: appStorage.hasViewedLeviFinishHint, markViewed: appStorage.markLeviFinishHintViewed }

export function LeviFinishHint({ root, store = productionStore }: { root: RefObject<HTMLDivElement | null>; store?: Store }) {
  const [target, setTarget] = useState<HTMLButtonElement | null>(null)
  const [shown, setShown] = useState(false)
  const active = useRef<HTMLButtonElement | null>(null)
  const guide = useRef<HTMLDivElement>(null)
  const viewed = useRef(false)

  useEffect(() => {
    const container = root.current
    if (!container) return
    const stop = observeFinishButton(container, (available) => {
      if (active.current && active.current !== available) {
        active.current = null
        setTarget(null)
      }
      if (!active.current && !viewed.current && !store.hasViewed() && available) {
        active.current = available
        setTarget(available)
      }
    })
    return () => { stop(); active.current = null }
  }, [root, store])

  useLayoutEffect(() => {
    const node = guide.current
    const container = root.current
    if (!target || !node || !container || availableFinishButton(container) !== target) return
    let frame = 0
    let disposed = false
    const composer = container.querySelector<HTMLElement>('.arena-composer')
    function place() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (disposed || !node || !target || !container) return
        node.style.width = `${Math.max(0, Math.min(580, document.documentElement.clientWidth - 24))}px`
        const rect = node.getBoundingClientRect()
        const position = availableFinishButton(container) === target
          ? getFinishHintPosition(rect.width, rect.height, document.documentElement.clientWidth,
            window.visualViewport?.height ?? window.innerHeight, target.getBoundingClientRect(), composer?.getBoundingClientRect() ?? null)
          : null
        if (!position) {
          node.style.visibility = 'hidden'
          target.removeAttribute('data-levi-highlighted')
          setShown(false)
          return
        }
        if (!viewed.current) {
          if (!store.markViewed()) return
          viewed.current = true
        }
        node.style.left = `${position.left}px`
        node.style.top = `${position.top}px`
        node.style.visibility = 'visible'
        target.setAttribute('data-levi-highlighted', 'true')
        setShown(true)
      })
    }
    const resize = new ResizeObserver(place)
    resize.observe(node)
    resize.observe(target)
    if (composer) resize.observe(composer)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    place()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      target.removeAttribute('data-levi-highlighted')
      resize.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', place)
      setShown(false)
    }
  }, [root, store, target])

  if (!target) return null
  const close = () => { active.current = null; setTarget(null) }
  return <>
    {createPortal(<div className="levi-home-guide levi-finish-hint" ref={guide} style={{ visibility: 'hidden' }}>
      <LeviTour greeting={1} reaction={null} standaloneLesson={leviFinishLesson} onNext={close} onSkip={close} />
    </div>, document.body)}
    {shown && <LeviSpotlight root={root} />}
  </>
}
