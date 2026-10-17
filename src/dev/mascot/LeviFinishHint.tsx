import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { LeviTour } from '../../components/levi-tour/LeviTour'
import { getLeviHomeGuidePosition, getLeviHomeScrollTop, getLeviMobileScrollTop } from '../../services/leviTourHomeHighlight'
import { availableFinishButton, leviFinishLesson, observeFinishButton, type createLeviFinishHintStore } from './leviFinishHintState'

type Props = {
  root: RefObject<HTMLDivElement | null>
  store: ReturnType<typeof createLeviFinishHintStore>
}

export function LeviFinishHint({ root, store }: Props) {
  const [target, setTarget] = useState<HTMLButtonElement | null>(null)
  const active = useRef<HTMLButtonElement | null>(null)
  const guide = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = root.current
    if (!container) return
    function check(available: HTMLButtonElement | null) {
      if (active.current && active.current !== available) {
        active.current = null
        setTarget(null)
      }
      if (!active.current && !store.hasViewed() && available) {
        active.current = available
        setTarget(available)
      }
    }
    const stop = observeFinishButton(container, check)
    return () => { stop(); active.current = null }
  }, [root, store])

  useLayoutEffect(() => {
    const node = guide.current
    const container = root.current
    if (!target || !node || !container || availableFinishButton(container) !== target) return
    function place() {
      if (!node || !target) return
      if (window.matchMedia('(max-width: 600px)').matches) {
        node.style.top = 'auto'
        node.style.left = '16px'
      } else {
        const position = getLeviHomeGuidePosition(target.getBoundingClientRect(), node.getBoundingClientRect().width,
          document.documentElement.clientWidth, window.scrollY)
        node.style.top = `${position.top}px`
        node.style.left = `${position.left}px`
      }
      node.style.visibility = 'visible'
    }
    target.setAttribute('data-levi-highlighted', 'true')
    place()
    const targetRect = target.getBoundingClientRect()
    const guideRect = node.getBoundingClientRect()
    const mobile = window.matchMedia('(max-width: 600px)').matches
    const top = mobile
      ? getLeviMobileScrollTop([targetRect], window.scrollY, guideRect.top)
      : getLeviHomeScrollTop(guideRect, [targetRect], window.scrollY,
        window.visualViewport?.height ?? window.innerHeight, targetRect)
    if (Math.abs(top - window.scrollY) > 1) {
      window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
    store.markViewed() // The guide has actually been mounted and made visible.
    const observer = new ResizeObserver(place)
    observer.observe(node)
    observer.observe(target)
    window.addEventListener('resize', place)
    window.visualViewport?.addEventListener('resize', place)
    return () => {
      target.removeAttribute('data-levi-highlighted')
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('resize', place)
    }
  }, [root, store, target])

  if (!target) return null
  const close = () => { active.current = null; setTarget(null) }
  return createPortal(
    <div className="levi-home-guide" ref={guide} style={{ visibility: 'hidden' }}>
      <LeviTour greeting={1} reaction={null} standaloneLesson={leviFinishLesson} onNext={close} onSkip={close} />
    </div>, document.body,
  )
}
