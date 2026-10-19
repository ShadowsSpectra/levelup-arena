import { useEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { ArenaEvaluation } from '../../types/arenaEvaluation'
import { browserLeviCommentHistory } from '../../services/leviCommentHistory'
import { leviResultCommentCase, leviResultComments, type chooseLeviResultComment } from '../../services/leviResultComments'
import { resultCommentPosition, type Position } from '../../services/leviResultPosition'
import { LeviCommentator } from './LeviCommentator'

type Comment = NonNullable<ReturnType<typeof chooseLeviResultComment>>

export function LeviResultCommentator({ root, sessionId, result }: {
  root: RefObject<HTMLElement | null>; sessionId: string; result: ArenaEvaluation
}) {
  const probes = useRef<HTMLDivElement>(null)
  const claimed = useRef(false)
  const dismissed = useRef(false)
  const [comment, setComment] = useState<Comment | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const category = leviResultCommentCase(result)

  useEffect(() => {
    const container = root.current
    const measure = probes.current
    if (!container || !measure) return
    let frame = 0
    let disposed = false
    const controls = Array.from(container.querySelectorAll<HTMLElement>('.result-actions button, .result-navigation button'))
    function place() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (disposed || dismissed.current || document.visibilityState === 'hidden') return
        const panelWidth = Math.min(400, Math.max(0, document.documentElement.clientWidth - 32))
        const boxes = Array.from(measure!.querySelectorAll<HTMLElement>('.levi-commentator')).map((node) => {
          node.style.width = `${panelWidth}px`
          return node.getBoundingClientRect()
        })
        if (!boxes.length) return
        const width = Math.max(...boxes.map((box) => box.width))
        const height = Math.max(...boxes.map((box) => box.height))
        const actionRects = controls.filter((element) => element.isConnected && element.getClientRects().length).map((element) => element.getBoundingClientRect())
        const next = resultCommentPosition(width, height, document.documentElement.clientWidth, window.innerHeight, actionRects)
        if (!next) return
        const nextPosition = { ...next, width: panelWidth }
        if (!claimed.current) {
          const claim = browserLeviCommentHistory.claim(sessionId, result)
          claimed.current = true
          if (claim.status !== 'chosen') { measure!.dataset.leviResultComment = 'finished'; return }
          measure!.dataset.leviResultComment = 'active'
          // Commit the actual toast in the same frame as the history write.
          flushSync(() => { setComment(claim.comment); setPosition(nextPosition) })
          return
        }
        setPosition((previous) => previous?.left === next.left && previous.top === next.top && previous.width === panelWidth ? previous : nextPosition)
      })
    }
    const resize = new ResizeObserver(place)
    resize.observe(measure)
    measure.querySelectorAll('.levi-commentator').forEach((node) => resize.observe(node))
    controls.forEach((node) => resize.observe(node))
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('visibilitychange', place)
    place()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      resize.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('visibilitychange', place)
    }
  }, [root, sessionId, category, result.overallScore])

  return <>
    <div ref={probes} data-levi-result-comment="waiting" aria-hidden="true" style={{ visibility: 'hidden', pointerEvents: 'none' }}>
      {leviResultComments[category].lines.map((line) => <aside key={line.id} className="levi-commentator">
        <div className="levi-commentator__bubble">
          <span className="levi-commentator__face" /><p>{line.text}</p>
          <button className="text-button" type="button" tabIndex={-1}>Закрыть</button>
        </div>
      </aside>)}
    </div>
    {comment && position && <LeviCommentator text={comment.text} emotion={comment.emotion} position={position}
      onDismiss={() => { dismissed.current = true; if (probes.current) probes.current.dataset.leviResultComment = 'finished'; setComment(null) }} />}
  </>
}
