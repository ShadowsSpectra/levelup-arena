import type { TourStorage } from '../../services/leviTour'

export const LEVI_FINISH_HINT_KEY = 'levelup-arena:levi-tour-dev-finish-hint'

export const leviFinishLesson = {
  title: 'Завершение переговоров',
  explanation: 'Теперь ты можешь завершить переговоры в любой момент. Даже если договориться так и не получилось',
  leviComment: 'Иногда вовремя уйти — тоже переговорный навык',
} as const

export function createLeviFinishHintStore(storage: TourStorage) {
  let viewed = false
  return {
    hasViewed() {
      try { viewed ||= storage.getItem(LEVI_FINISH_HINT_KEY) === '1' } catch { /* memory fallback */ }
      return viewed
    },
    markViewed() {
      viewed = true
      try { storage.setItem(LEVI_FINISH_HINT_KEY, '1') } catch { /* memory fallback */ }
    },
  }
}

// Observe the actual control rather than inferring availability from the transcript.
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
