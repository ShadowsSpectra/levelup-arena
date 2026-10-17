import { useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { getLeviHomeGuidePosition, getLeviMobileScrollTop } from '../../services/leviTourHomeHighlight'
import { getLeviLockedExplanation, highlightLeviArenaTargets, type LeviArenaStep } from '../../services/leviArenaTour'
import { LeviTour } from './LeviTour'

type Props = {
  root: RefObject<HTMLDivElement | null>
  step: LeviArenaStep
  comment?: string
  onNext: () => void
  onSkip: () => void
}

export function LeviArenaGuide({ root, step, comment, onNext, onSkip }: Props) {
  const guide = useRef<HTMLDivElement>(null)
  const explanation = step === 'locked' && root.current ? getLeviLockedExplanation(root.current) : undefined

  useEffect(() => {
    const container = root.current
    const node = guide.current
    if (!container || !node) return
    const arenaRoot = container
    const { targets, cleanup } = highlightLeviArenaTargets(container, step)
    let frame = 0
    let disposed = false
    let initialScrollPending = true
    function place() {
      if (disposed) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (disposed || !targets.length) return
        const mobile = window.matchMedia('(max-width: 600px)').matches
        if (mobile) {
          node!.style.top = 'auto'
          node!.style.left = '16px'
        } else {
          const last = targets[targets.length - 1].getBoundingClientRect()
          const position = getLeviHomeGuidePosition(last, node!.getBoundingClientRect().width,
            document.documentElement.clientWidth, window.scrollY)
          node!.style.top = `${position.top}px`
          node!.style.left = `${position.left}px`
        }
        node!.style.visibility = 'visible'
        // Only the initial guide placement may scroll to an opponent. ArenaPage
        // owns scrolling once the player has made a real selection.
        if (initialScrollPending && mobile &&
          (step === 'opponents' || step === 'locked' || step === 'chooseOpponent') &&
          !arenaRoot.querySelector('.arena-opponent-card[aria-pressed="true"]')) {
          const first = targets[0].getBoundingClientRect()
          const top = getLeviMobileScrollTop([first], window.scrollY, node!.getBoundingClientRect().top)
          if (Math.abs(top - window.scrollY) > 8) window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
        }
        initialScrollPending = false
      })
    }
    const resize = new ResizeObserver(place)
    resize.observe(node)
    targets.forEach((target) => resize.observe(target))
    window.addEventListener('resize', place)
    window.visualViewport?.addEventListener('resize', place)
    place()
    return () => {
      disposed = true
      initialScrollPending = false
      cancelAnimationFrame(frame)
      resize.disconnect()
      window.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('resize', place)
      cleanup()
    }
  }, [root, step])

  return createPortal(
    <div className="levi-home-guide levi-arena-guide" ref={guide} style={{ visibility: 'hidden' }}>
      <LeviTour greeting={1} reaction={null} arenaStep={step} arenaExplanation={explanation} arenaComment={comment} onNext={onNext} onSkip={onSkip} />
    </div>, document.body,
  )
}
