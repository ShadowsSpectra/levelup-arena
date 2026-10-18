import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const vite = await createServer({ configLoader: 'runner', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true } })
after(async () => { await vite.close() })
const { createLeviCommentHistory, LEVI_COMMENT_HISTORY_KEY } = await vite.ssrLoadModule('/src/services/leviCommentHistory.ts')
const { leviResultCommentCase, leviResultComments } = await vite.ssrLoadModule('/src/services/leviResultComments.ts')
const { resultCommentPosition } = await vite.ssrLoadModule('/src/services/leviResultPosition.ts')
const { ArenaResultView } = await vite.ssrLoadModule('/src/components/arena/ArenaResultView.tsx')

function memory() {
  const data = new Map()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) }
}
const result = (status, overallScore) => ({ outcome: { status, bossDefeated: status === 'SUCCESS' }, overallScore })

test('production history is separate and all four five-line categories respect 50/51', () => {
  const storage = memory()
  const history = createLeviCommentHistory(storage, () => 0)
  const cases = [[result('SUCCESS', 50), 'SUCCESS_LOW'], [result('SUCCESS', 51), 'SUCCESS_HIGH'],
    [result('BAD_AGREEMENT', 100), 'BAD_AGREEMENT'], [result('NO_AGREEMENT', 0), 'NO_AGREEMENT']]
  const ids = new Set()
  for (const [value, category] of cases) {
    assert.equal(leviResultCommentCase(value), category)
    assert.equal(leviResultComments[category].lines.length, 5)
    for (let i = 0; i < 5; i++) {
      const claim = history.claim(`${category}-${i}`, value)
      assert.equal(claim.status, 'chosen')
      ids.add(claim.comment.id)
    }
    assert.equal(history.claim(`${category}-exhausted`, value).status, 'exhausted')
  }
  assert.equal(ids.size, 20)
  assert.ok(storage.getItem(LEVI_COMMENT_HISTORY_KEY))
  assert.equal(storage.getItem('levelup-arena:levi-commentator-dev-history-v1'), null)
  assert.equal(createLeviCommentHistory(storage).claim('SUCCESS_LOW-0', cases[0][0]).status, 'seen')
})

test('result toast has room on desktop and mobile and never covers actions', () => {
  for (const [w, h, width, height, actions] of [
    [1440, 900, 400, 140, [{ left: 1040, right: 1380, top: 700, bottom: 880 }]],
    [375, 812, 343, 170, [{ left: 16, right: 359, top: 700, bottom: 790 }]],
  ]) {
    const p = resultCommentPosition(width, height, w, h, actions)
    assert.ok(p)
    assert.ok(p.left >= 0 && p.top >= 0 && p.left + width <= w && p.top + height <= h)
    for (const a of actions) assert.ok(p.left + width <= a.left || p.left >= a.right || p.top + height <= a.top || p.top >= a.bottom)
  }
  assert.equal(resultCommentPosition(343, 300, 375, 400, [{ left: 0, right: 375, top: 40, bottom: 380 }]), null)
})

test('no commentator mounts during loading or error; preview can opt out', () => {
  const props = { character: { name: 'A', role: 'R' }, scenario: { title: 'S', playerRole: 'product_manager' },
    session: { id: 'session', currentTurn: 1, messages: [] }, onRetryEvaluation() {}, onOpenAISettings() {},
    onTryAgain() {}, onBackToSelection() {}, onHome() {} }
  for (const evaluation of [{ status: 'loading' }, { status: 'error', message: 'error' }]) {
    assert.doesNotMatch(renderToStaticMarkup(createElement(ArenaResultView, { ...props, evaluation })), /levi-commentator/)
  }
})

test('production reserves no line before position is known and cleans up observers', async () => {
  const source = await readFile(new URL('../src/components/levi-tour/LeviResultCommentator.tsx', import.meta.url), 'utf8')
  assert.match(source, /if \(!next\) return[\s\S]*browserLeviCommentHistory\.claim/)
  assert.match(source, /document\.visibilityState === 'hidden'/)
  assert.match(source, /flushSync\(/)
  assert.match(source, /resize\.disconnect\(\)/)
  assert.match(source, /cancelAnimationFrame\(frame\)/)
})
