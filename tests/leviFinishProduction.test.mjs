import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const vite = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await vite.close() })
const { getFinishHintPosition, availableFinishButton, leviFinishLesson } = await vite.ssrLoadModule('/src/services/leviFinishHint.ts')
const { appStorage } = await vite.ssrLoadModule('/src/services/storage.ts')

test('production finish marker is separate and fails closed when storage is unavailable', () => {
  const previous = globalThis.window
  const data = new Map([['levelup-arena:levi-tour-dev-finish-hint', '1'], ['levelup-arena:levi-arena-guide-version', '1']])
  globalThis.window = { localStorage: { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } }
  try {
    assert.equal(appStorage.hasViewedLeviFinishHint(), false)
    assert.equal(appStorage.markLeviFinishHintViewed(), true)
    assert.equal(appStorage.hasViewedLeviFinishHint(), true)
    assert.equal(data.get('levelup-arena:levi-finish-hint-version'), '1')
    assert.equal(data.get('levelup-arena:levi-arena-guide-version'), '1')
    globalThis.window.localStorage = { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } }
    assert.equal(appStorage.hasViewedLeviFinishHint(), true)
    assert.equal(appStorage.markLeviFinishHintViewed(), false)
  } finally { globalThis.window = previous }
})

test('finish hint uses the real, visible, enabled button', () => {
  const button = { isConnected: true, disabled: false, matches: () => false, closest: () => null,
    getClientRects: () => [1], ownerDocument: { defaultView: { getComputedStyle: () => ({ visibility: 'visible', display: 'block' }) } } }
  const root = { querySelector: () => button }
  assert.equal(availableFinishButton(root), button)
  button.disabled = true
  assert.equal(availableFinishButton(root), null)
  button.disabled = false
  button.getClientRects = () => []
  assert.equal(availableFinishButton(root), null)
  assert.equal(leviFinishLesson.title, 'Завершение переговоров')
})

test('placement fits mobile and desktop without covering Finish or composer; waits if space is insufficient', () => {
  for (const [width, height, panelWidth, panelHeight, button, composer] of [
    [375, 812, 351, 260, { left: 20, right: 190, top: 170, bottom: 210 }, { left: 16, right: 359, top: 710, bottom: 790 }],
    [1440, 900, 580, 230, { left: 1030, right: 1200, top: 160, bottom: 200 }, { left: 180, right: 1260, top: 800, bottom: 880 }],
  ]) {
    const pos = getFinishHintPosition(panelWidth, panelHeight, width, height, button, composer)
    assert.ok(pos)
    assert.ok(pos.left >= 0 && pos.left + panelWidth <= width && pos.top >= 0 && pos.top + panelHeight <= height)
    for (const rect of [button, composer]) assert.ok(pos.left + panelWidth <= rect.left || pos.left >= rect.right || pos.top + panelHeight <= rect.top || pos.top >= rect.bottom)
  }
  assert.equal(getFinishHintPosition(351, 300, 375, 420,
    { left: 10, right: 200, top: 90, bottom: 130 }, { left: 0, right: 375, top: 320, bottom: 420 }), null)
})

test('production integration is restricted to live negotiation without reply errors and cleans up', async () => {
  const page = await readFile(new URL('../src/pages/ArenaPage.tsx', import.meta.url), 'utf8')
  const hint = await readFile(new URL('../src/components/levi-tour/LeviFinishHint.tsx', import.meta.url), 'utf8')
  assert.match(page, /arena\.step === 'negotiation'[\s\S]*?!arena\.replyError && <LeviFinishHint/)
  assert.match(hint, /if \(!store\.markViewed\(\)\) return/)
  assert.match(hint, /cancelAnimationFrame\(frame\)/)
  assert.match(hint, /resize\.disconnect\(\)/)
  assert.match(hint, /removeAttribute\('data-levi-highlighted'\)/)
  assert.doesNotMatch(hint, /onFinish|scrollTo|useArenaFlow/)
})
