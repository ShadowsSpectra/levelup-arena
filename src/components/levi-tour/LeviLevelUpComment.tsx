import { useEffect, useRef, useState, type RefObject } from 'react'
import { resultCommentPosition, type Position } from '../../services/leviResultPosition'
import type { LeviLevelUp } from '../../state/useAppState'
import { LeviCommentator } from './LeviCommentator'

const messages = {
  2: { text: 'Второй уровень! Уже почти не стыдно брать тебя на переговоры. Почти.', emotion: 'happy' },
  3: { text: 'Третий уровень? Ладно, признаю. Скоро ты сможешь договориться даже со мной.', emotion: 'judge' },
} as const

export function LeviLevelUpComment({ root, levelUp, onConsumed }: {
  root: RefObject<HTMLElement | null>; levelUp: LeviLevelUp | null; onConsumed: () => void
}) {
  const probe = useRef<HTMLElement>(null)
  const [shown, setShown] = useState<LeviLevelUp | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const consumed = useRef(onConsumed)
  consumed.current = onConsumed
  const current = shown ?? levelUp

  useEffect(() => {
    if (!current || !root.current || !probe.current) return
    const container = root.current
    const measure = probe.current
    let frame = 0
    let disposed = false
    const observer = new ResizeObserver(schedule)
    function schedule() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(place)
    }
    function place() {
      if (disposed || document.visibilityState === 'hidden') return
      const resultComment = container.querySelector<HTMLElement>('[data-levi-result-comment]')
      if (resultComment && resultComment.dataset.leviResultComment !== 'finished') return
      if (document.querySelector('.levi-tour')) return
      const width = Math.min(400, Math.max(0, document.documentElement.clientWidth - 32))
      measure.style.width = `${width}px`
      const box = measure.getBoundingClientRect()
      const controls = Array.from(container.querySelectorAll<HTMLElement>(
        'button, a[href], input, textarea, select, .arena-outcome, .arena-score-summary, .arena-result > h1, .result-score, #training-result-title',
      ))
        .filter((element) => !element.closest('.levi-commentator') && element.getClientRects().length > 0)
        .map((element) => element.getBoundingClientRect())
      const next = resultCommentPosition(box.width, box.height, document.documentElement.clientWidth, window.innerHeight, controls)
      if (!next) { if (shown) setShown(null); return }
      setPosition((old) => old?.left === next.left && old.top === next.top && old.width === width ? old : { ...next, width })
      if (!shown) { setShown(current); consumed.current() }
    }
    observer.observe(measure)
    observer.observe(container)
    const mutations = new MutationObserver(schedule)
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-levi-result-comment'] })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    document.addEventListener('visibilitychange', schedule)
    schedule()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      mutations.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      document.removeEventListener('visibilitychange', schedule)
    }
  }, [root, current, shown])

  if (!current) return null
  const message = messages[current.level]
  return <>
    <aside ref={probe} className="levi-commentator" aria-hidden="true" style={{ visibility: 'hidden' }}>
      <div className="levi-commentator__bubble">
        <span className="levi-commentator__face" /><p>{message.text}</p>
        <button className="text-button" type="button" tabIndex={-1}>Закрыть</button>
      </div>
    </aside>
    {shown && position && <LeviCommentator text={message.text} emotion={message.emotion} position={position}
      onDismiss={() => setShown(null)} />}
  </>
}
