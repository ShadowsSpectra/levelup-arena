import { useEffect, useRef, useState } from 'react'
import './sleeping-levi.css'

const firstComment = 'Я вообще-то наблюдаю за твоим профессиональным ростом. Не\u00a0отвлекай'
const repeatedComment = 'У тебя переговоры или кототерапия?'
const interactionWindow = 2000
const sleepDelay = 3500

function otherLeviIsVisible(ownComment: HTMLElement | null) {
  return Array.from(document.querySelectorAll<HTMLElement>('.levi-tour, .levi-commentator')).some((element) => {
    if (ownComment?.contains(element) || element.closest('[hidden], [aria-hidden="true"]')) return false
    const style = window.getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0
  })
}

export function SleepingLevi({ guideActive }: { guideActive: boolean }) {
  const [awake, setAwake] = useState(false)
  const [comment, setComment] = useState<{ text: string; id: number } | null>(null)
  const [closing, setClosing] = useState(false)
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recentClicks = useRef<number[]>([])
  const commentRoot = useRef<HTMLDivElement>(null)
  const commentId = useRef(0)

  useEffect(() => () => {
    if (sleepTimer.current !== null) clearTimeout(sleepTimer.current)
  }, [])

  useEffect(() => {
    if (!comment) return
    if (guideActive || otherLeviIsVisible(commentRoot.current)) {
      setComment(null)
      return
    }
    const observer = new MutationObserver(() => {
      if (otherLeviIsVisible(commentRoot.current)) setComment(null)
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] })
    return () => observer.disconnect()
  }, [comment, guideActive])

  useEffect(() => {
    if (!comment) return
    const timer = setTimeout(() => setClosing(true), 5000)
    return () => clearTimeout(timer)
  }, [comment])

  useEffect(() => {
    if (!closing) return
    const timer = setTimeout(() => { setComment(null); setClosing(false) }, 180)
    return () => clearTimeout(timer)
  }, [closing])

  function wake() {
    setAwake(true)
    if (sleepTimer.current !== null) clearTimeout(sleepTimer.current)
    sleepTimer.current = setTimeout(() => {
      setAwake(false)
      recentClicks.current = []
      sleepTimer.current = null
    }, sleepDelay)

    const now = Date.now()
    recentClicks.current = [...recentClicks.current.filter((time) => now - time < interactionWindow), now]
    if (guideActive || otherLeviIsVisible(commentRoot.current)) return
    const count = recentClicks.current.length
    if (count === 1 || count === 3 || (!comment && count < 3)) {
      setClosing(false)
      setComment({ text: count >= 3 ? repeatedComment : firstComment, id: ++commentId.current })
    }
  }

  return <div className="sleeping-levi">
    <button className="sleeping-levi__button" type="button" onClick={wake} aria-label="Разбудить Леви">
      <img className="sleeping-levi__image" src={awake ? '/mascot/cat-sleep-open-eye.png' : '/mascot/cat-sleep.png'} alt="" />
    </button>
    <div ref={commentRoot}>
      {comment && <aside key={comment.id} className={`sleeping-levi__bubble${closing ? ' sleeping-levi__bubble--closing' : ''}`} aria-label="Комментарий Леви" aria-live="polite">
        <p>{comment.text}</p>
        <button className="sleeping-levi__close" type="button" onClick={() => setClosing(true)} aria-label="Закрыть комментарий Леви">×</button>
      </aside>}
    </div>
  </div>
}
