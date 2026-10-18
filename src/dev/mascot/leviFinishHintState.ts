import type { TourStorage } from '../../services/leviTour'
export { availableFinishButton, observeFinishButton, leviFinishLesson } from '../../services/leviFinishHint'

export const LEVI_FINISH_HINT_KEY = 'levelup-arena:levi-tour-dev-finish-hint'

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
