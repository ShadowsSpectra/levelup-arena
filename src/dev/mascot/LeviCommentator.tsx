import { useEffect, useRef, useState } from 'react'
import type { MascotState } from '../../components/mascot/Mascot'
import './leviCommentator.css'

export function scheduleCommentatorDismiss(onDismiss: () => void) {
  const timer = setTimeout(onDismiss, 5000)
  return () => clearTimeout(timer)
}

export function LeviCommentator({ text, emotion, onDismiss }: { text: string; emotion: MascotState; onDismiss: () => void }) {
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss
  const panel = useRef<HTMLElement>(null)
  const [coversAction, setCoversAction] = useState(false)

  useEffect(() => scheduleCommentatorDismiss(() => dismiss.current()), [])

  useEffect(() => {
    let frame: number | undefined
    function update() {
      frame = undefined
      const rect = panel.current?.getBoundingClientRect()
      if (!rect) return
      const actions = panel.current?.closest('.levi-commentator-preview')?.querySelectorAll('.result-actions button, .result-navigation button')
      const overlaps = Array.from(actions ?? []).some((action) => {
        const target = action.getBoundingClientRect()
        return target.width > 0 && target.height > 0 && rect.left < target.right && rect.right > target.left && rect.top < target.bottom && rect.bottom > target.top
      })
      setCoversAction(overlaps)
    }
    function schedule() {
      if (frame === undefined) frame = requestAnimationFrame(update)
    }
    const observer = new ResizeObserver(schedule)
    if (panel.current) observer.observe(panel.current)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    schedule()
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }, [])

  return <aside ref={panel} className="levi-commentator" data-covers-action={coversAction || undefined} aria-label="Комментарий Леви">
    <div className="levi-commentator__bubble">
      <span className="levi-commentator__face" aria-hidden="true"><img src={`/mascot/cat-${emotion}.png`} alt="" /></span>
      <p>{text}</p>
      <button className="text-button" type="button" onClick={onDismiss} aria-label="Закрыть комментарий Леви">Закрыть</button>
    </div>
  </aside>
}
