export const leviFinishLesson = {
  title: 'Завершение переговоров',
  explanation: 'Теперь ты можешь завершить переговоры в любой момент. Даже если договориться так и не получилось',
  leviComment: 'Иногда вовремя уйти — тоже переговорный навык',
} as const

export function availableFinishButton(root: HTMLElement): HTMLButtonElement | null {
  const button = root.querySelector<HTMLButtonElement>('.arena-dialogue .arena-dialogue-heading > button.secondary-action-button')
  if (!button || !button.isConnected || button.disabled || button.matches(':disabled') ||
      button.closest('[hidden], [inert], [aria-hidden="true"]') || !button.getClientRects().length) return null
  const style = button.ownerDocument.defaultView?.getComputedStyle(button)
  return style && style.visibility !== 'hidden' && style.visibility !== 'collapse' && style.display !== 'none' ? button : null
}

export function observeFinishButton(root: HTMLElement, onChange: (button: HTMLButtonElement | null) => void) {
  const check = () => onChange(availableFinishButton(root))
  const observer = new MutationObserver(check)
  observer.observe(root, { subtree: true, childList: true, attributes: true,
    attributeFilter: ['disabled', 'hidden', 'inert', 'aria-hidden', 'class', 'style'] })
  window.addEventListener('resize', check)
  check()
  return () => { observer.disconnect(); window.removeEventListener('resize', check) }
}

type Rect = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>

/** Find a fully visible position that does not cover either real control. */
export function getFinishHintPosition(width: number, height: number, viewportWidth: number, viewportHeight: number,
  button: Rect, composer: Rect | null): { left: number; top: number } | null {
  const margin = 12
  if (width > viewportWidth - margin * 2 || height > viewportHeight - margin * 2 ||
      button.bottom <= 0 || button.top >= viewportHeight || button.right <= 0 || button.left >= viewportWidth) return null
  const clamp = (value: number, max: number) => Math.max(margin, Math.min(value, max - margin))
  const xs = [clamp(button.left, viewportWidth - width), margin, viewportWidth - width - margin]
  const ys = [button.bottom + margin, button.top - height - margin,
    composer ? composer.top - height - margin : viewportHeight - height - margin, margin, viewportHeight - height - margin]
  const overlaps = (left: number, top: number, rect: Rect) =>
    left < rect.right + 4 && left + width > rect.left - 4 && top < rect.bottom + 4 && top + height > rect.top - 4
  for (const top of ys) for (const left of xs) {
    if (top < margin || top + height > viewportHeight - margin || overlaps(left, top, button) ||
        (composer && overlaps(left, top, composer))) continue
    return { left, top }
  }
  return null
}
