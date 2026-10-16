import { useEffect, useState, type CSSProperties } from 'react'
import './mascot.css'

export type MascotState = 'idle' | 'happy' | 'judge' | 'point'
export type MascotSize = 56 | 96 | 160

type MascotProps = {
  state?: MascotState
  size?: MascotSize
  animateTail?: boolean
  animate?: boolean
  label?: string
}

export function Mascot({
  state = 'idle', size = 96, animateTail = true, animate = true, label = 'Маскот LevelUP Arena',
}: MascotProps) {
  const [blinkingState, setBlinkingState] = useState<MascotState | null>(null)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer: ReturnType<typeof setTimeout> | undefined
    let disposed = false

    function scheduleBlink() {
      setBlinkingState(null)
      if (disposed || preference.matches || !animate || (state !== 'idle' && state !== 'point')) return
      timer = setTimeout(() => {
        if (disposed) return
        setBlinkingState(state)
        timer = setTimeout(scheduleBlink, 150)
      }, 2800 + Math.random() * 2400)
    }

    function resetAnimation() {
      clearTimeout(timer)
      scheduleBlink()
    }

    resetAnimation()
    preference.addEventListener('change', resetAnimation)
    return () => {
      disposed = true
      clearTimeout(timer)
      preference.removeEventListener('change', resetAnimation)
    }
  }, [state, animate])

  const frame = animate && blinkingState === state
    ? state === 'point' ? 'point-blink' : 'blink'
    : state

  return (
    <div className={`mascot${animate ? '' : ' mascot--still'}`}
      style={{ '--mascot-size': `${size}px` } as CSSProperties} role="img" aria-label={label}>
      <div className="mascot__breathing">
        <div key={state} className={`mascot__figure${state === 'happy' ? ' mascot__figure--happy' : ''}`}>
          <img className={`mascot__tail${animateTail ? ' mascot__tail--moving' : ''}`}
            src="/mascot/cat-tail.png" alt="" draggable={false} />
          <img className="mascot__body"
            src={`/mascot/cat-${frame}.png`} alt="" draggable={false} />
        </div>
      </div>
    </div>
  )
}
