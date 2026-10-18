import { createLeviCommentHistory as createHistory } from '../../services/leviCommentHistory'

export const LEVI_COMMENT_HISTORY_KEY = 'levelup-arena:levi-commentator-dev-history-v1'
export function createLeviCommentHistory(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, random = Math.random) {
  return createHistory(storage, random, LEVI_COMMENT_HISTORY_KEY)
}
export const browserLeviCommentHistory = createLeviCommentHistory({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
})
