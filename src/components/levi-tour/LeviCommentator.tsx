import { useEffect, useRef, useState } from 'react'
import type { MascotState } from '../mascot/Mascot'
import { resultCommentPosition, type Position } from '../../services/leviResultPosition'
import './leviCommentator.css'

export function scheduleCommentatorDismiss(onDismiss: () => void) {
  const timer = setTimeout(onDismiss, 5000)
  return () => clearTimeout(timer)
}

export function LeviCommentator({ text, emotion, onDismiss, position }: { text: string; emotion: MascotState; onDismiss: () => void; position?: Position }) {
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss
  const panel = useRef<HTMLElement>(null)
  const [previewPosition, setPreviewPosition] = useState<Position | null>(null)

  useEffect(() => scheduleCommentatorDismiss(() => dismiss.current()), [])

  useEffect(() => {
    if (position) return
    let frame: number | undefined
    function update() {
      frame = undefined
      const rect = panel.current?.getBoundingClientRect()
      if (!rect) return
      const actions = panel.current?.closest('.levi-commentator-preview')?.querySelectorAll('.result-actions button, .result-navigation button')
      const actionRects = Array.from(actions ?? []).map((action) => action.getBoundingClientRect()).filter((target) => target.width > 0 && target.height > 0)
      const next = resultCommentPosition(rect.width, rect.height, document.documentElement.clientWidth, window.innerHeight, actionRects)
      if (next) setPreviewPosition((old) => old?.left === next.left && old.top === next.top ? old : next)
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
  }, [Boolean(position)])

  const location = position ?? previewPosition
  return <aside ref={panel} className="levi-commentator" aria-label="Комментарий Леви"
    style={location ? { left: location.left, top: location.top, width: location.width, right: 'auto', bottom: 'auto' } : undefined}>
    <div className="levi-commentator__bubble">
      <span className="levi-commentator__face" aria-hidden="true"><img src={`/mascot/cat-${emotion}.png`} alt="" /></span>
      <p>{text}</p>
      <button className="text-button" type="button" onClick={onDismiss} aria-label="Закрыть комментарий Леви">Закрыть</button>
    </div>
  </aside>
}
