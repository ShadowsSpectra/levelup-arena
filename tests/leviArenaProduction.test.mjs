import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const vite = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await vite.close() })
const { initialArenaGuideState, reduceArenaGuide, readArenaGuideTargets, observeArenaGuide } =
  await vite.ssrLoadModule('/src/components/levi-tour/LeviArenaProduction.tsx')
const { appStorage } = await vite.ssrLoadModule('/src/services/storage.ts')
const { getArenaGuideViewportTop } = await vite.ssrLoadModule('/src/components/levi-tour/LeviArenaGuide.tsx')

const targets = { opponents: true, locked: true, chooseOpponent: true, chooseScenario: true, briefing: true }
const snapshot = { ready: true, hasLockedBoss: true, selectedOpponent: false, selectedScenario: false }
const observe = (state, value) => reduceArenaGuide(state, { type: 'observed', snapshot: value, targets })

test('Arena guide keeps the normal locked-boss flow and reconciles early choices', () => {
  let state = observe(initialArenaGuideState(false), snapshot)
  assert.equal(state.step, 'opponents')
  state = reduceArenaGuide(state, { type: 'next', snapshot })
  assert.equal(state.step, 'locked')
  state = reduceArenaGuide(state, { type: 'next', snapshot })
  assert.equal(state.step, 'chooseOpponent')
  state = reduceArenaGuide(state, { type: 'early-click' })
  assert.equal(state.earlyOpponentChoice, false)
  state = observe(state, { ...snapshot, selectedOpponent: true })
  assert.equal(state.step, 'chooseScenario')
  state = observe(state, { ...snapshot, selectedOpponent: true, selectedScenario: true })
  assert.equal(state.step, 'briefing')
  assert.equal(reduceArenaGuide(state, { type: 'next', snapshot: state.snapshot }).step, 'completed')

  for (const step of ['opponents', 'locked']) {
    let early = { ...observe(initialArenaGuideState(false), snapshot), step }
    early = reduceArenaGuide(early, { type: 'early-click' })
    early = observe(early, { ...snapshot, selectedOpponent: true })
    assert.equal(early.step, 'chooseScenario')
    assert.equal(early.earlyOpponentChoice, true)
    early = observe(early, { ...snapshot, selectedOpponent: true, selectedScenario: true })
    assert.equal(early.step, 'briefing')
  }
  const alreadySelected = observe(initialArenaGuideState(false), { ...snapshot, selectedOpponent: true })
  assert.equal(alreadySelected.step, 'chooseScenario')
  assert.equal(alreadySelected.earlyOpponentChoice, false)
  assert.equal(initialArenaGuideState(false).earlyOpponentChoice, false)
  const open = { ...snapshot, hasLockedBoss: false }
  assert.equal(reduceArenaGuide(observe(initialArenaGuideState(false), open), { type: 'next', snapshot: open }).step, 'chooseOpponent')
})

test('Arena production marker is separate from other tour and game data', () => {
  const previous = globalThis.window
  const entries = new Map([
    ['levelup-arena:levi-home-guide-version', '1'], ['levelup-arena:levi-tour-dev-arena-slice', '1'],
    ['levelup-arena:progression-v1', 'progress'], ['levelup-arena:selected-role', 'sales_manager'],
  ])
  globalThis.window = { localStorage: { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) } }
  try {
    assert.equal(appStorage.hasCompletedLeviArenaGuide(), false)
    appStorage.setLeviArenaGuideComplete()
    assert.equal(appStorage.hasCompletedLeviArenaGuide(), true)
    assert.equal(entries.get('levelup-arena:levi-arena-guide-version'), '1')
    assert.equal(entries.get('levelup-arena:levi-home-guide-version'), '1')
    assert.equal(entries.get('levelup-arena:levi-tour-dev-arena-slice'), '1')
    assert.equal(entries.get('levelup-arena:progression-v1'), 'progress')
    assert.equal(entries.get('levelup-arena:selected-role'), 'sales_manager')
    assert.equal(initialArenaGuideState(true).step, 'inactive')
    assert.equal(initialArenaGuideState(false).step, 'opponents')
  } finally { globalThis.window = previous }
})

test('real targets are required; observer and click listener are cleaned up', () => {
  const oldObserver = globalThis.MutationObserver
  const oldElement = globalThis.Element
  let disconnected = false, notify, listener, removed = false
  class ElementStub {
    constructor(card) { this.card = card }
    closest(selector) { return selector === '.arena-opponent-card' ? this.card : null }
  }
  globalThis.Element = ElementStub
  globalThis.MutationObserver = class {
    constructor(callback) { notify = callback }
    observe(_root, options) { assert.deepEqual(options.attributeFilter, ['aria-pressed', 'disabled']) }
    disconnect() { disconnected = true }
  }
  try {
    let available = false, selected = false
    const root = {
      querySelector(selector) {
        if (selector === '.arena-boss-list') return available ? {} : null
        if (selector === '.arena-opponent-card:not([disabled])') return available ? {} : null
        return null
      },
      querySelectorAll(selector) {
        if (selector !== '.arena-opponent-card' || !available) return []
        return [{ disabled: false, getAttribute: () => String(selected) }]
      },
      contains: () => true,
      addEventListener(_event, fn, capture) { assert.equal(capture, true); listener = fn },
      removeEventListener(_event, fn, capture) { assert.equal(fn, listener); assert.equal(capture, true); removed = true },
    }
    const observations = []
    let clicks = 0
    const stop = observeArenaGuide(root, (snapshot, targets) => observations.push({ snapshot, targets }), () => clicks++)
    assert.equal(observations.at(-1).snapshot.ready, false)
    assert.equal(readArenaGuideTargets(root).opponents, false)
    available = true
    notify()
    assert.equal(observations.at(-1).targets.opponents, true)
    listener({ target: new ElementStub({ disabled: true }) })
    assert.equal(clicks, 0)
    listener({ target: new ElementStub({ disabled: false }) })
    assert.equal(clicks, 1)
    selected = true
    notify()
    assert.equal(observations.at(-1).snapshot.selectedOpponent, true)
    stop()
    assert.equal(disconnected, true)
    assert.equal(removed, true)
  } finally {
    globalThis.MutationObserver = oldObserver
    globalThis.Element = oldElement
  }
})

test('desktop placement keeps the complete guide in the viewport without initiating scrolling', () => {
  assert.equal(getArenaGuideViewportTop({ top: 100, bottom: 200 }, 180, 700, 40), 256)
  assert.equal(getArenaGuideViewportTop({ top: 500, bottom: 650 }, 180, 700, 40), 344)
  const top = getArenaGuideViewportTop({ top: 50, bottom: 440 }, 220, 500, 0)
  assert.ok(top >= 16 && top + 220 <= 484)
  const offscreen = getArenaGuideViewportTop({ top: 900, bottom: 1100 }, 220, 500, 0)
  assert.ok(offscreen >= 16 && offscreen + 220 <= 484)
  const aboveViewport = getArenaGuideViewportTop({ top: -500, bottom: -200 }, 220, 500, 0)
  assert.ok(aboveViewport >= 16 && aboveViewport + 220 <= 484)
})

test('guide mounts only in selection and leaves existing Arena scrolling and actions in charge', async () => {
  const page = await readFile(new URL('../src/pages/ArenaPage.tsx', import.meta.url), 'utf8')
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const production = await readFile(new URL('../src/components/levi-tour/LeviArenaProduction.tsx', import.meta.url), 'utf8')
  const guide = await readFile(new URL('../src/components/levi-tour/LeviArenaGuide.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/components/levi-tour/levi-arena-guide.css', import.meta.url), 'utf8')
  assert.match(page, /arena\.step === 'selection'[\s\S]*?\{selectionOverlay\}[\s\S]*?arena\.step === 'negotiation'/)
  assert.match(page, /scrollToArenaSection\(\s*scenarioSectionRef\.current/)
  assert.match(page, /scrollToArenaSection\(\s*scenarioBriefRef\.current/)
  assert.match(app, /selectionOverlay=\{screen === 'arena' \? <LeviArenaProduction root=\{arenaRoot\} \/> : undefined\}/)
  assert.match(app, /className="levi-arena-root" ref=\{arenaRoot\} hidden=\{screen !== 'arena'\}/)
  assert.match(production, /observer\.disconnect\(\)/)
  assert.match(guide, /cancelAnimationFrame\(frame\)/)
  assert.match(guide, /removeEventListener\('scroll', place\)/)
  assert.match(guide, /!arenaRoot\.querySelector\('\.arena-opponent-card\[aria-pressed="true"\]'\)/)
  assert.doesNotMatch(production, /scrollTo|scrollIntoView|arena\.chooseCharacter|arena\.chooseScenario|\.start\(/)
  assert.match(css, /prefers-reduced-motion/)
})
