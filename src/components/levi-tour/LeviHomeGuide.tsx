import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { leviHomeSteps, type LeviHomeStep, type LeviRoleReaction } from '../../services/leviTour'
import { getLeviHomeGuidePosition, getLeviHomeScrollTop, getLeviMobileScrollTop, highlightLeviHomeTargets } from '../../services/leviTourHomeHighlight'
import { LeviTour } from './LeviTour'

type Props = {
  root: RefObject<HTMLDivElement | null>
  step?: LeviHomeStep
  reaction: LeviRoleReaction | null
  final: boolean
  onNext: () => void
  onSkip: () => void
}

export function LeviHomeGuide({ root, step, reaction, final, onNext, onSkip }: Props) {
  const guide = useRef<HTMLDivElement>(null)
  const [missing, setMissing] = useState(false)
  const placement = step ? leviHomeSteps[step].placement : final ? 'arena' : 'intro'

  useEffect(() => {
    if (!root.current || !guide.current) return
    const node = guide.current
    const highlighted = highlightLeviHomeTargets(root.current, step ? leviHomeSteps[step].targets : [])
    const intro = reaction ? root.current.querySelector<HTMLElement>('.home-intro') : null
    const originalAriaHidden = intro?.getAttribute('aria-hidden') ?? null
    setMissing(highlighted.missing)
    let frame = 0
    let focused = false
    function hideIntro(hidden: boolean) {
      if (!intro) return
      if (hidden) {
        intro.setAttribute('data-levi-reaction', 'true')
        intro.setAttribute('aria-hidden', 'true')
      } else {
        intro.removeAttribute('data-levi-reaction')
        if (originalAriaHidden === null) intro.removeAttribute('aria-hidden')
        else intro.setAttribute('aria-hidden', originalAriaHidden)
      }
    }
    function reveal() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const mobile = window.matchMedia('(max-width: 600px)').matches
        // Avoid covering the rest of the Arena card when its button is the target.
        const anchor = highlighted.targets[0]?.closest('.activity') ?? highlighted.targets[0]
          ?? root.current?.querySelector('.home-intro')
        if (!anchor) return
        if (mobile) {
          hideIntro(false)
          node.style.maxHeight = ''
          node.style.overflowY = ''
          node.style.top = 'auto'
          node.style.left = '16px'
        } else if (intro) {
          hideIntro(true)
          const introRect = intro.getBoundingClientRect()
          const cardsTop = root.current?.querySelector('.activity-list')?.getBoundingClientRect().top
          if (cardsTop !== undefined) {
            node.style.maxHeight = `${Math.max(0, cardsTop - introRect.top - 8)}px`
            node.style.overflowY = 'auto'
          }
          const position = getLeviHomeGuidePosition(introRect, node.getBoundingClientRect().width,
            document.documentElement.clientWidth, window.scrollY)
          node.style.top = `${window.scrollY + introRect.top}px`
          node.style.left = `${position.left}px`
        } else {
          const position = getLeviHomeGuidePosition(anchor.getBoundingClientRect(), node.getBoundingClientRect().width,
            document.documentElement.clientWidth, window.scrollY)
          node.style.top = `${position.top}px`
          node.style.left = `${position.left}px`
        }
        node.style.visibility = 'visible'
        const priority = highlighted.targets[0]?.querySelector(':scope > button') ?? highlighted.targets[0]
        const targetRects = highlighted.targets.map((target) => target.getBoundingClientRect())
        const arenaDuringReaction = mobile && reaction ? root.current?.querySelector<HTMLElement>('[data-tour="arena"]') : null
        if (arenaDuringReaction) targetRects.push(arenaDuringReaction.getBoundingClientRect())
        const guideRect = node.getBoundingClientRect()
        const heading = highlighted.targets[0]?.querySelector('h2')?.getBoundingClientRect()
        const action = highlighted.targets[0]?.querySelector(':scope > button')?.getBoundingClientRect()
        const important = heading && action ? { top: heading.top, bottom: action.bottom } : priority?.getBoundingClientRect()
        const top = mobile
          ? getLeviMobileScrollTop(targetRects, window.scrollY, guideRect.top, important)
          : getLeviHomeScrollTop(guideRect, targetRects, window.scrollY,
            window.visualViewport?.height ?? window.innerHeight, priority?.getBoundingClientRect())
        if (Math.abs(top - window.scrollY) > 1) {
          window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
        }
        if (!focused) {
          node.querySelector<HTMLButtonElement>('.levi-tour__next')?.focus({ preventScroll: true })
          focused = true
        }
      })
    }
    const observer = new ResizeObserver(reveal)
    observer.observe(node)
    highlighted.targets.forEach((target) => observer.observe(target))
    window.addEventListener('resize', reveal)
    window.visualViewport?.addEventListener('resize', reveal)
    reveal()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', reveal)
      window.visualViewport?.removeEventListener('resize', reveal)
      hideIntro(false)
      window.scrollTo({ top: window.scrollY, behavior: 'auto' })
      highlighted.cleanup()
    }
  }, [root, step, reaction, final])

  function next() {
    if (step === 'arena' && !missing) {
      const entry = root.current?.querySelector<HTMLButtonElement>('[data-tour="arena-entry"]')
      if (entry) {
        entry.focus({ preventScroll: true })
        entry.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
        return
      }
    }
    onNext()
  }

  return createPortal(
    <div className="levi-home-guide" data-placement={placement} ref={guide} style={{ visibility: 'hidden' }}>
      <LeviTour greeting={1} reaction={reaction} homeStep={step} final={final} onNext={next} onSkip={onSkip} />
      {missing && <p className="levi-home-guide__note" role="status">Элемент сейчас недоступен. Можно продолжить экскурсию.</p>}
      {step === 'arena' && !missing && <p className="levi-home-guide__note">Для перехода нажмите настоящую кнопку «Открыть арену». «Дальше» переводит к ней фокус.</p>}
      {final && <p className="levi-home-guide__note">Dev-preview финала. Arena Setup пока не подключён; переговоры не запущены.</p>}
    </div>, document.body,
  )
}
