export const LEVI_HIGHLIGHT_INTERVAL_MS = 1500

/** Visual-only controller. It never clicks a card or writes selection/ARIA state. */
export function startLeviRoleHighlight(root: HTMLElement, motion = window.matchMedia('(prefers-reduced-motion: reduce)')) {
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-tour="role-cards"] [data-tour="role-card"]'))
  let index = 0
  let engaged = false
  let disposed = false
  let timer: ReturnType<typeof setInterval> | undefined

  function highlight(next: number) {
    index = next
    cards.forEach((card, position) => {
      if (position === next) card.setAttribute('data-tour-highlighted', 'true')
      else card.removeAttribute('data-tour-highlighted')
    })
  }

  function stopTimer() { clearInterval(timer); timer = undefined }
  function schedule() {
    stopTimer()
    if (disposed || engaged || motion.matches || cards.length < 2) return
    timer = setInterval(() => { if (!disposed) highlight((index + 1) % cards.length) }, LEVI_HIGHLIGHT_INTERVAL_MS)
  }

  const handlers = cards.map((card, position) => {
    const engage = () => {
      if (disposed) return
      engaged = true
      stopTimer()
      highlight(position)
    }
    card.addEventListener('pointerenter', engage)
    card.addEventListener('focusin', engage)
    card.addEventListener('click', engage)
    return { card, engage }
  })
  const alreadyEngaged = cards.findIndex((card) => card.matches(':hover, :focus-within'))
  if (alreadyEngaged >= 0) handlers[alreadyEngaged].engage()
  else if (cards.length) highlight(0)
  motion.addEventListener('change', schedule)
  schedule()

  return () => {
    disposed = true
    stopTimer()
    motion.removeEventListener('change', schedule)
    handlers.forEach(({ card, engage }) => {
      card.removeEventListener('pointerenter', engage)
      card.removeEventListener('focusin', engage)
      card.removeEventListener('click', engage)
      card.removeAttribute('data-tour-highlighted')
    })
  }
}
