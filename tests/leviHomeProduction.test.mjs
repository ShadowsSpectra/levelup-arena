import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const vite = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await vite.close() })
const { initialLeviHomeGuideState, reduceLeviHomeGuide } = await vite.ssrLoadModule('/src/state/useLeviHomeGuide.ts')
const { chooseLeviReaction, leviRoleReactions, leviHomeStepOrder } = await vite.ssrLoadModule('/src/services/leviTour.ts')
const { appStorage } = await vite.ssrLoadModule('/src/services/storage.ts')

test('all real role selections create a stable reaction followed by the four approved steps', () => {
  for (const role of ['product_manager', 'project_manager', 'sales_manager']) {
    const reaction = chooseLeviReaction(role, undefined, () => 0)
    let state = reduceLeviHomeGuide(initialLeviHomeGuideState(false), { type: 'role-selected', reaction })
    assert.equal(state.status, 'reaction')
    assert.equal(state.reaction, reaction)
    assert.ok(leviRoleReactions[role].some((item) => item.text === reaction.text && item.emotion === reaction.emotion))
    assert.equal(reduceLeviHomeGuide(state, { type: 'next' }), state)
    state = reduceLeviHomeGuide(state, { type: 'finish-reaction' })
    assert.equal(state.status, 'home')
    assert.equal(state.step, 'level-xp')
    assert.equal(reduceLeviHomeGuide(state, { type: 'finish-reaction' }), state)
    for (const step of leviHomeStepOrder.slice(1)) {
      state = reduceLeviHomeGuide(state, { type: 'next' })
      assert.equal(state.step, step)
    }
    assert.equal(reduceLeviHomeGuide(state, { type: 'next' }), state)
    assert.equal(reduceLeviHomeGuide(state, { type: 'finish' }).status, 'completed')
  }
})

test('existing user and reload start at Level/XP without role selection or reaction', () => {
  assert.deepEqual(initialLeviHomeGuideState(false), { status: 'home', step: 'level-xp', reaction: null })
  assert.equal(initialLeviHomeGuideState(true).status, 'completed')
  const reaction = chooseLeviReaction('sales_manager', undefined, () => 0)
  const running = reduceLeviHomeGuide(initialLeviHomeGuideState(false), { type: 'role-selected', reaction })
  const left = reduceLeviHomeGuide(running, { type: 'leave-home' })
  assert.equal(left.status, 'home')
  assert.equal(left.reaction, null)
  assert.equal(left.step, 'level-xp')
  assert.equal(reduceLeviHomeGuide(left, { type: 'finish-reaction' }), left)
  const training = { ...left, step: 'training' }
  assert.equal(reduceLeviHomeGuide(training, { type: 'leave-home' }), training)
})

test('Home completion and skip use an independent marker and retain game and tour data', () => {
  const previous = globalThis.window
  const entries = new Map([['levelup-arena:progression-v1', 'progress'], ['levelup-arena:selected-role', 'sales_manager'],
    ['levelup-arena:levi-onboarding-version', '1'], ['levelup-arena:levi-tour-version', '1'],
    ['levelup-arena:levi-tour-dev-role-slice', '1']])
  globalThis.window = { localStorage: { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) } }
  try {
    assert.equal(appStorage.hasCompletedLeviHomeGuide(), false)
    appStorage.setLeviHomeGuideComplete()
    assert.equal(appStorage.hasCompletedLeviHomeGuide(), true)
    assert.equal(initialLeviHomeGuideState(appStorage.hasCompletedLeviHomeGuide()).status, 'completed')
    assert.equal(entries.get('levelup-arena:levi-home-guide-version'), '1')
    assert.equal(entries.get('levelup-arena:progression-v1'), 'progress')
    assert.equal(entries.get('levelup-arena:selected-role'), 'sales_manager')
    assert.equal(entries.get('levelup-arena:levi-onboarding-version'), '1')
    assert.equal(entries.get('levelup-arena:levi-tour-version'), '1')
    assert.equal(entries.get('levelup-arena:levi-tour-dev-role-slice'), '1')
    const finished = reduceLeviHomeGuide(initialLeviHomeGuideState(false), { type: 'finish' })
    assert.equal(reduceLeviHomeGuide(finished, { type: 'role-selected', reaction: chooseLeviReaction('product_manager') }), finished)
  } finally { globalThis.window = previous }
})

test('production integration uses real Home and does not import dev tours', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const hook = await readFile(new URL('../src/state/useLeviHomeGuide.ts', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/components/levi-tour/levi-home-guide.css', import.meta.url), 'utf8')
  assert.match(app, /homeGuide\.selectOnboardingRole\(roleId\)\s+selectRole\(roleId\)/)
  assert.match(app, /onContinue=\{continueOnboarding\} onSkip=\{homeGuide\.finish\}/)
  assert.match(app, /<LeviHomeGuide root=\{homeRoot\}/)
  assert.match(app, /<LeviSpotlight root=\{homeRoot\}/)
  assert.match(hook, /if \(!isHome\) return/)
  assert.match(hook, /scheduleLeviReaction\(state.status/)
  assert.match(css, /prefers-reduced-motion/)
  assert.doesNotMatch(app + hook + css, /src\/dev|\.\.\/dev|LeviArenaGuide|LeviCommentator/)
})

test('lesson portal releases reaction constraints and the mobile bubble has no internal scroll limit', async () => {
  const guide = await readFile(new URL('../src/components/levi-tour/LeviHomeGuide.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/components/levi-tour/levi-home-guide.css', import.meta.url), 'utf8')
  // A reaction and the four lessons reuse the same portal node.
  assert.match(guide, /node\.style\.maxHeight = `\$\{Math\.max\(0, cardsTop - introRect\.top - 8\)\}px`/)
  assert.match(guide, /else \{[^{}]*node\.style\.maxHeight = ''\s*node\.style\.overflowY = ''\s*const position = getLeviHomeGuidePosition/)
  const mobileRule = css.match(/@media \(max-width: 600px\)\s*\{\s*\.levi-home-guide\s*\{([^}]*)\}/)?.[1]
  assert.ok(mobileRule)
  assert.doesNotMatch(mobileRule, /max-height|overflow/)
})
