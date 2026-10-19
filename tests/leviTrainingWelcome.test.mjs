import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await vite.close() })
const { appStorage } = await vite.ssrLoadModule('/src/services/storage.ts')

test('Training welcome has its own persistent marker and does not alter other data', () => {
  const previous = globalThis.window
  const entries = new Map([
    ['levelup-arena:progression-v1', 'progress'],
    ['levelup-arena:levi-finish-hint-version', '1'],
  ])
  globalThis.window = { localStorage: {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  } }
  try {
    assert.equal(appStorage.hasViewedLeviTrainingWelcome(), false)
    assert.equal(appStorage.markLeviTrainingWelcomeViewed(), true)
    assert.equal(appStorage.hasViewedLeviTrainingWelcome(), true)
    assert.equal(entries.get('levelup-arena:levi-training-welcome-version'), '1')
    assert.equal(entries.get('levelup-arena:progression-v1'), 'progress')
    assert.equal(entries.get('levelup-arena:levi-finish-hint-version'), '1')
    globalThis.window.localStorage = { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } }
    assert.equal(appStorage.hasViewedLeviTrainingWelcome(), true)
    assert.equal(appStorage.markLeviTrainingWelcomeViewed(), false)
    globalThis.window.localStorage = { getItem() { return null }, setItem() {} }
    assert.equal(appStorage.markLeviTrainingWelcomeViewed(), false)
  } finally { globalThis.window = previous }
})
