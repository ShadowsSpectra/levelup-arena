import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const vite = await createServer({ configLoader: 'runner', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true } })
after(async () => { await vite.close() })
const { leviResultComments, leviResultCommentCase, chooseLeviResultComment } = await vite.ssrLoadModule('/src/dev/mascot/leviResultComments.ts')
const { createLeviCommentHistory, LEVI_COMMENT_HISTORY_KEY } = await vite.ssrLoadModule('/src/dev/mascot/leviCommentHistory.ts')
const { LeviCommentator, scheduleCommentatorDismiss } = await vite.ssrLoadModule('/src/dev/mascot/LeviCommentator.tsx')

const result = (status, overallScore) => ({ outcome: { status, bossDefeated: status === 'SUCCESS' }, overallScore })
const cases = [
  ['SUCCESS_HIGH', result('SUCCESS', 70), 'happy'],
  ['SUCCESS_LOW', result('SUCCESS', 50), 'judge'],
  ['BAD_AGREEMENT', result('BAD_AGREEMENT', 70), 'judge'],
  ['NO_AGREEMENT', result('NO_AGREEMENT', 70), 'idle'],
]

test('each result case has five predefined lines and its intended emotion', () => {
  for (const [caseName, evaluation, emotion] of cases) {
    assert.equal(leviResultCommentCase(evaluation), caseName)
    assert.equal(leviResultComments[caseName].emotion, emotion)
    assert.equal(leviResultComments[caseName].lines.length, 5)
    assert.equal(new Set(leviResultComments[caseName].lines.map((line) => line.id)).size, 5)
    assert.equal(new Set(leviResultComments[caseName].lines.map((line) => line.text)).size, 5)
    for (const random of [0, 0.2, 0.4, 0.6, 0.8]) {
      const comment = chooseLeviResultComment(evaluation, [], () => random)
      assert.equal(comment.emotion, emotion)
      assert.deepEqual({ id: comment.id, text: comment.text }, leviResultComments[caseName].lines[Math.floor(random * 5)])
    }
  }
})

test('only SUCCESS changes its response at the 50-point boundary', () => {
  for (const score of [0, 20, 50, 51, 100]) {
    for (const [status, expectedCase, expectedEmotion] of [
      ['SUCCESS', score > 50 ? 'SUCCESS_HIGH' : 'SUCCESS_LOW', score > 50 ? 'happy' : 'judge'],
      ['BAD_AGREEMENT', 'BAD_AGREEMENT', 'judge'],
      ['NO_AGREEMENT', 'NO_AGREEMENT', 'idle'],
    ]) {
      const evaluation = result(status, score)
      assert.equal(leviResultCommentCase(evaluation), expectedCase)
      const comment = chooseLeviResultComment(evaluation, [], () => 0)
      assert.equal(comment.emotion, expectedEmotion)
      assert.equal(comment.text, leviResultComments[expectedCase].lines[0].text)
    }
  }
})

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

test('five unique comments per category, exhaustion and category independence survive reload', () => {
  const storage = memoryStorage()
  let history = createLeviCommentHistory(storage, () => 0.5)
  const used = new Set()
  for (let i = 0; i < 5; i++) {
    const claim = history.claim(`high-${i}`, result('SUCCESS', 70))
    assert.equal(claim.status, 'chosen')
    assert.ok(!used.has(claim.comment.id))
    used.add(claim.comment.id)
    // Recreating the store simulates a reload without resetting localStorage.
    history = createLeviCommentHistory(storage, () => 0.5)
  }
  assert.equal(history.claim('high-6', result('SUCCESS', 70)).status, 'exhausted')
  for (const [, evaluation] of cases.slice(1)) {
    assert.equal(history.claim(`other-${leviResultCommentCase(evaluation)}`, evaluation).status, 'chosen')
  }
  assert.equal(used.size, 5)
})

test('all four categories allow at most twenty unique comments in total', () => {
  const history = createLeviCommentHistory(memoryStorage(), () => 0.75)
  const all = new Set()
  for (const [category, evaluation] of cases) {
    for (let i = 0; i < 5; i++) {
      const claim = history.claim(`${category}-${i}`, evaluation)
      assert.equal(claim.status, 'chosen')
      all.add(claim.comment.id)
    }
    assert.equal(history.claim(`${category}-exhausted`, evaluation).status, 'exhausted')
  }
  assert.equal(all.size, 20)
})

test('same session never shows or consumes a second line, including after reload and changed result', () => {
  const storage = memoryStorage()
  const first = createLeviCommentHistory(storage, () => 0).claim('session-a', result('SUCCESS', 70))
  assert.equal(first.status, 'chosen')
  const before = storage.getItem(LEVI_COMMENT_HISTORY_KEY)
  const reloaded = createLeviCommentHistory(storage, () => 0)
  assert.equal(reloaded.claim('session-a', result('SUCCESS', 70)).status, 'seen')
  assert.equal(reloaded.claim('session-a', result('NO_AGREEMENT', 0)).status, 'seen')
  assert.equal(storage.getItem(LEVI_COMMENT_HISTORY_KEY), before)
  assert.notEqual(reloaded.claim('session-b', result('SUCCESS', 70)).comment.id, first.comment.id)
})

test('failed or unavailable storage and corrupted history do not show or silently reset comments', () => {
  const unavailable = createLeviCommentHistory({ getItem() { throw Error('blocked') }, setItem() {}, removeItem() {} })
  assert.equal(unavailable.claim('session', result('SUCCESS', 70)).status, 'unavailable')
  const failingWrite = createLeviCommentHistory({ getItem() { return null }, setItem() { throw Error('quota') }, removeItem() {} })
  assert.equal(failingWrite.claim('session', result('SUCCESS', 70)).status, 'unavailable')
  const ignoredWrite = createLeviCommentHistory({ getItem() { return null }, setItem() {}, removeItem() {} })
  assert.equal(ignoredWrite.claim('session', result('SUCCESS', 70)).status, 'unavailable')
  const storage = memoryStorage()
  for (const broken of ['{invalid', '{}', '{"version":1,"used":{},"sessions":[]}']) {
    storage.setItem(LEVI_COMMENT_HISTORY_KEY, broken)
    assert.equal(createLeviCommentHistory(storage).claim('session', result('SUCCESS', 70)).status, 'unavailable')
    assert.equal(storage.getItem(LEVI_COMMENT_HISTORY_KEY), broken)
  }
})

test('explicit reset clears only the dev commentator key', () => {
  const storage = memoryStorage()
  const history = createLeviCommentHistory(storage, () => 0)
  storage.setItem('levelup-arena:progression-v1', 'progress')
  storage.setItem('levelup-arena:levi-tour-dev-arena-slice', 'tour')
  assert.equal(history.claim('session', result('SUCCESS', 70)).status, 'chosen')
  assert.equal(history.reset(), true)
  assert.equal(storage.getItem(LEVI_COMMENT_HISTORY_KEY), null)
  assert.equal(storage.getItem('levelup-arena:progression-v1'), 'progress')
  assert.equal(storage.getItem('levelup-arena:levi-tour-dev-arena-slice'), 'tour')
})

test('the chosen line stays unchanged on render and includes an accessible dismiss action', () => {
  const selected = chooseLeviResultComment(result('BAD_AGREEMENT', 70), [], () => 0.4)
  const props = { text: selected.text, emotion: selected.emotion, onDismiss() {} }
  const first = renderToStaticMarkup(createElement(LeviCommentator, props))
  const second = renderToStaticMarkup(createElement(LeviCommentator, props))
  assert.equal(first, second)
  assert.ok(first.includes(selected.text))
  assert.match(first, /Закрыть комментарий Леви/)
  assert.match(first, /cat-judge\.png/)
  assert.match(first, /levi-commentator__face/)
  assert.doesNotMatch(first, /class="mascot(?:\s|")/)
})

test('comment dismissal occurs at five seconds and cleanup cancels the pending timer', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let dismissed = 0
  const cancelFirst = scheduleCommentatorDismiss(() => { dismissed++ })
  context.mock.timers.tick(4999)
  assert.equal(dismissed, 0)
  cancelFirst()
  context.mock.timers.tick(1)
  assert.equal(dismissed, 0)
  scheduleCommentatorDismiss(() => { dismissed++ })
  context.mock.timers.tick(4999)
  assert.equal(dismissed, 0)
  context.mock.timers.tick(1)
  assert.equal(dismissed, 1)
})

test('preview uses distinct React keys and dismissal does not claim the same session again', async (context) => {
  const preview = await readFile(new URL('../src/dev/mascot/leviResultPreview.tsx', import.meta.url), 'utf8')
  assert.match(preview, /<LeviCommentator key=\{`comment-\$\{current\.id\}`\}/)
  assert.match(preview, /<ArenaResultView key=\{session\.id\}/)

  context.mock.timers.enable({ apis: ['setTimeout'] })
  const storage = memoryStorage()
  const history = createLeviCommentHistory(storage, () => 0)
  const evaluation = result('SUCCESS', 70)
  const claim = history.claim('session-a', evaluation)
  assert.equal(claim.status, 'chosen')
  let visible = true
  const before = storage.getItem(LEVI_COMMENT_HISTORY_KEY)
  const cancel = scheduleCommentatorDismiss(() => { visible = false })
  context.mock.timers.tick(4999)
  assert.equal(visible, true)
  context.mock.timers.tick(1)
  assert.equal(visible, false)
  cancel()
  assert.equal(history.claim('session-a', evaluation).status, 'seen')
  assert.equal(storage.getItem(LEVI_COMMENT_HISTORY_KEY), before)
})
