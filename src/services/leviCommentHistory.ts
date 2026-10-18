import { chooseLeviResultComment, leviResultCommentCase, leviResultComments, type CommentCase } from './leviResultComments'

export const LEVI_COMMENT_HISTORY_KEY = 'levelup-arena:levi-commentator-history-v1'

type Comment = NonNullable<ReturnType<typeof chooseLeviResultComment>>
type Decision = { sessionId: string; category: CommentCase; commentId: string | null }
type History = { version: 1; used: Record<CommentCase, string[]>; sessions: Decision[] }
type HistoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Claim = { status: 'chosen'; comment: Comment } | { status: 'seen' | 'exhausted' | 'unavailable' }
const categories = Object.keys(leviResultComments) as CommentCase[]

function emptyHistory(): History {
  return { version: 1, used: { SUCCESS_HIGH: [], SUCCESS_LOW: [], BAD_AGREEMENT: [], NO_AGREEMENT: [] }, sessions: [] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseHistory(raw: string | null): History | null {
  if (raw === null) return emptyHistory()
  let value: unknown
  try { value = JSON.parse(raw) } catch { return null }
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.used) || !Array.isArray(value.sessions)) return null
  if (Object.keys(value.used).length !== categories.length) return null

  const history = emptyHistory()
  for (const category of categories) {
    const ids = value.used[category]
    const validIds = new Set(leviResultComments[category].lines.map((line) => line.id))
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !validIds.has(id)) || new Set(ids).size !== ids.length) return null
    history.used[category] = ids
  }
  const sessions = new Set<string>()
  const recorded = new Set<string>()
  for (const entry of value.sessions) {
    if (!isRecord(entry) || typeof entry.sessionId !== 'string' || !entry.sessionId || sessions.has(entry.sessionId) ||
      typeof entry.category !== 'string' || !categories.includes(entry.category as CommentCase)) return null
    const category = entry.category as CommentCase
    if (entry.commentId === null && history.used[category].length !== leviResultComments[category].lines.length) return null
    if (entry.commentId !== null && (typeof entry.commentId !== 'string' ||
      !history.used[category].includes(entry.commentId) || recorded.has(entry.commentId))) return null
    if (entry.commentId !== null) recorded.add(entry.commentId as string)
    sessions.add(entry.sessionId)
    history.sessions.push({ sessionId: entry.sessionId, category, commentId: entry.commentId as string | null })
  }
  if (categories.some((category) => history.used[category].some((id) => !recorded.has(id)))) return null
  return history
}

export function createLeviCommentHistory(storage: HistoryStorage, random = Math.random, key = LEVI_COMMENT_HISTORY_KEY) {
  return {
    claim(sessionId: string, result: Parameters<typeof leviResultCommentCase>[0]): Claim {
      if (!sessionId) return { status: 'unavailable' }
      try {
        const history = parseHistory(storage.getItem(key))
        if (!history) return { status: 'unavailable' }
        if (history.sessions.some((entry) => entry.sessionId === sessionId)) return { status: 'seen' }
        const category = leviResultCommentCase(result)
        const comment = chooseLeviResultComment(result, history.used[category], random)
        if (comment) history.used[category].push(comment.id)
        history.sessions.push({ sessionId, category, commentId: comment?.id ?? null })
        const serialized = JSON.stringify(history)
        storage.setItem(key, serialized)
        if (storage.getItem(key) !== serialized) return { status: 'unavailable' }
        return comment ? { status: 'chosen', comment } : { status: 'exhausted' }
      } catch {
        return { status: 'unavailable' }
      }
    },
    reset() {
      try {
        storage.removeItem(key)
        return storage.getItem(key) === null
      } catch {
        return false
      }
    },
  }
}

export const browserLeviCommentHistory = createLeviCommentHistory({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
})
