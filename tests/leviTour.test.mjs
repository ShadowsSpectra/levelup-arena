import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const vite = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await vite.close() })
const { createLeviTourStore, LEVI_TOUR_VERSION_KEY, LEVI_TOUR_SLICE_KEY, chooseLeviReaction, leviRoleReactions, leviGreetings, scheduleLeviGreeting } = await vite.ssrLoadModule('/src/services/leviTour.ts')
const { createLeviTourState, reduceLeviTour, shouldHighlightRoleCards } = await vite.ssrLoadModule('/src/state/useLeviTour.ts')
const { startLeviRoleHighlight } = await vite.ssrLoadModule('/src/services/leviTourHighlight.ts')
const { RoleSelectionPage } = await vite.ssrLoadModule('/src/pages/RoleSelectionPage.tsx')
const { LeviTour } = await vite.ssrLoadModule('/src/components/levi-tour/LeviTour.tsx')

function memory(entries = []) {
  const data = new Map(entries)
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } }
}

test('dev slice ignores legacy/full completion and preserves all existing game data and full version', () => {
  for (const entries of [[], [
    ['levelup-arena:onboarding-complete', 'true'],
    [LEVI_TOUR_VERSION_KEY, '1'],
    ['levelup-arena:selected-role', 'sales_manager'],
    ['levelup-arena:progression-v1', '{"xp":120,"energy":3,"streak":5}'],
  ]]) {
    const storage = memory(entries)
    const before = [...storage.data]
    const store = createLeviTourStore(storage)
    assert.equal(store.hasViewed(), false)
    assert.deepEqual([...storage.data], before)
    store.markViewed()
    assert.equal(storage.data.get(LEVI_TOUR_SLICE_KEY), '1')
    assert.equal(storage.data.has(LEVI_TOUR_VERSION_KEY), before.some(([key]) => key === LEVI_TOUR_VERSION_KEY))
    for (const [key, value] of before) assert.equal(storage.data.get(key), value)
    assert.equal(createLeviTourStore(storage).hasViewed(), true)
  }
})

test('invalid slice markers are safe, later markers are preserved, unavailable storage works in memory', () => {
  for (const value of ['broken', '-1', '1.5']) assert.equal(createLeviTourStore(memory([[LEVI_TOUR_SLICE_KEY, value]])).hasViewed(), false)
  const storage = memory([[LEVI_TOUR_SLICE_KEY, '2'], [LEVI_TOUR_VERSION_KEY, '2']])
  const store = createLeviTourStore(storage)
  assert.equal(store.hasViewed(), true)
  store.markViewed()
  assert.equal(storage.data.get(LEVI_TOUR_VERSION_KEY), '2')
  assert.equal(storage.data.get(LEVI_TOUR_SLICE_KEY), '2')
  const blocked = createLeviTourStore({ getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } })
  assert.equal(blocked.hasViewed(), false)
  blocked.markViewed()
  assert.equal(blocked.hasViewed(), true)
})

test('real role buttons have stable tour anchors and accept the non-modal Levi guide', () => {
  const html = renderToStaticMarkup(createElement(RoleSelectionPage, { onSelectRole() {} }, guide(createLeviTourState(false))))
  assert.equal((html.match(/data-tour="role-card"/g) ?? []).length, 3)
  assert.ok(html.includes('data-tour="role-cards"'))
  for (const role of ['product_manager', 'project_manager', 'sales_manager']) assert.ok(html.includes(`data-tour-role="${role}"`))
  assert.ok(html.includes(leviGreetings[0]))
  assert.ok(html.includes('Дальше'))
  assert.ok(html.includes('Пропустить'))
  assert.ok(!html.includes('aria-modal'))
})

function guide(state) {
  return createElement(LeviTour, { greeting: state.greeting, reaction: state.reaction, onNext() {}, onSkip() {}, onContinue() {} })
}

test('both greetings advance once, while early role selection keeps its reaction and ignores late greeting events', () => {
  const initial = createLeviTourState(false)
  const second = reduceLeviTour(initial, { type: 'advance-greeting' })
  assert.equal(second.greeting, 1)
  assert.equal(reduceLeviTour(second, { type: 'advance-greeting' }).greeting, 1)
  for (const paragraph of leviGreetings[1].split('\n\n')) assert.ok(renderToStaticMarkup(guide(second)).includes(`<p>${paragraph}</p>`))
  assert.ok(!renderToStaticMarkup(guide(second)).includes('Дальше'))
  assert.equal(reduceLeviTour(initial, { type: 'continue' }), initial)
  const reaction = chooseLeviReaction('product_manager', undefined, () => 0)
  const selected = reduceLeviTour(initial, { type: 'role-selected', reaction })
  assert.equal(selected.status, 'reaction')
  assert.equal(reduceLeviTour(selected, { type: 'advance-greeting' }), selected)
  const html = renderToStaticMarkup(guide(selected))
  assert.equal(renderToStaticMarkup(guide(selected)), html)
  assert.ok(html.includes(reaction.text))
  assert.ok(html.includes('Продолжить'))
  assert.ok(html.includes('Пропустить'))
})

test('greeting controls put skip before primary Next and the second greeting separates the closing paragraph', () => {
  const first = renderToStaticMarkup(guide(createLeviTourState(false)))
  assert.ok(first.indexOf('>Пропустить экскурсию</button>') < first.indexOf('>Дальше →</button>'))
  assert.match(first, /class="primary-button levi-tour__next"/)
  const second = renderToStaticMarkup(guide(reduceLeviTour(createLeviTourState(false), { type: 'advance-greeting' })))
  assert.ok(second.includes('потренироваться.</p><p>Обещаю не осуждать. Пока что</p>'))
  assert.ok(!second.includes('<br'))
  assert.ok(!second.includes('<p></p>'))
  assert.ok(second.includes('Пропустить экскурсию'))
  assert.ok(!second.includes('Дальше'))
  assert.ok(!second.includes('Продолжить'))
  assert.ok(!leviGreetings[1].includes('\u00a0'))
})

test('highlight starts only with the second greeting, regardless of timer/manual advance, and stops on exit', () => {
  const first = createLeviTourState(false)
  assert.equal(shouldHighlightRoleCards(first), false)
  const second = reduceLeviTour(first, { type: 'advance-greeting' })
  assert.equal(shouldHighlightRoleCards(second), true)
  assert.equal(shouldHighlightRoleCards(reduceLeviTour(second, { type: 'restart' })), false)
  assert.equal(shouldHighlightRoleCards(reduceLeviTour(second, { type: 'skip' })), false)
  const reaction = chooseLeviReaction('project_manager')
  for (const greeting of [first, second]) {
    assert.equal(shouldHighlightRoleCards(reduceLeviTour(greeting, { type: 'role-selected', reaction })), false)
  }
})

test('every role uses its own reaction pool; a repeat excludes the last choice without changing on render', () => {
  assert.deepEqual(Object.values(leviRoleReactions).map((items) => items.length), [4, 2, 2])
  for (const roleId of ['product_manager', 'project_manager', 'sales_manager']) {
    const pool = leviRoleReactions[roleId]
    for (let index = 0; index < pool.length; index++) {
      const choice = chooseLeviReaction(roleId, undefined, () => (index + .1) / pool.length)
      assert.equal(choice.text, pool[index].text)
      assert.ok(['judge', 'happy'].includes(choice.emotion))
      const repeated = chooseLeviReaction(roleId, choice.index, () => .5)
      assert.notEqual(repeated.index, choice.index)
      assert.ok(pool.some((item) => item.text === repeated.text))
    }
  }
})

test('skip, continue and restart guard delayed events and retain reaction until explicit continuation', () => {
  let state = createLeviTourState(false)
  state = reduceLeviTour(state, { type: 'role-selected', reaction: chooseLeviReaction('sales_manager') })
  assert.equal(state.status, 'reaction')
  state = reduceLeviTour(state, { type: 'continue' })
  assert.equal(state.status, 'completed')
  assert.equal(reduceLeviTour(state, { type: 'role-selected', reaction: chooseLeviReaction('project_manager') }), state)
  state = reduceLeviTour(state, { type: 'restart' })
  assert.equal(state.status, 'active')
  assert.equal(state.greeting, 0)
  assert.equal(state.reaction, null)
  state = reduceLeviTour(state, { type: 'skip' })
  assert.equal(state.status, 'skipped')
  assert.equal(reduceLeviTour(state, { type: 'advance-greeting' }), state)
})

test('greeting timer advances after 4.5s and cleanup prevents late or duplicate advances', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let advances = 0
  let cancel = scheduleLeviGreeting(() => advances++)
  context.mock.timers.tick(4499)
  assert.equal(advances, 0)
  context.mock.timers.tick(1)
  assert.equal(advances, 1)
  cancel()
  cancel = scheduleLeviGreeting(() => advances++)
  context.mock.timers.tick(1000)
  cancel() // Manual Next, selection, skip, restart and unmount all use effect cleanup.
  context.mock.timers.tick(10000)
  assert.equal(advances, 1)
})

class Card extends EventTarget {
  attributes = new Map([['aria-pressed', 'false']])
  interacting = false
  matches() { return this.interacting }
  setAttribute(key, value) { this.attributes.set(key, value) }
  removeAttribute(key) { this.attributes.delete(key) }
}
class Motion extends EventTarget { matches = false }
function highlighted(cards) { return cards.findIndex((card) => card.attributes.has('data-tour-highlighted')) }
function highlightFixture() {
  const cards = [new Card(), new Card(), new Card()]
  return { cards, root: { querySelectorAll: () => cards }, motion: new Motion() }
}

test('highlight cycles in DOM order without selecting roles; hover/focus give control to the user', (context) => {
  context.mock.timers.enable({ apis: ['setInterval'] })
  for (const event of ['pointerenter', 'focusin']) {
    const { cards, root, motion } = highlightFixture()
    let selections = 0
    cards.forEach((card) => card.addEventListener('click', () => selections++))
    const cleanup = startLeviRoleHighlight(root, motion)
    assert.equal(highlighted(cards), 0)
    context.mock.timers.tick(1500)
    assert.equal(highlighted(cards), 1)
    context.mock.timers.tick(1500)
    assert.equal(highlighted(cards), 2)
    context.mock.timers.tick(1500)
    assert.equal(highlighted(cards), 0)
    assert.equal(selections, 0)
    cards[1].dispatchEvent(new Event(event))
    context.mock.timers.tick(6000)
    assert.equal(highlighted(cards), 1)
    cards[2].dispatchEvent(new Event('click'))
    assert.equal(selections, 1)
    assert.ok(cards.every((card) => card.attributes.get('aria-pressed') === 'false'))
    cleanup()
  }
})

test('highlight cleanup removes timers/listeners on selection, skip or unmount; reduced motion is static', (context) => {
  context.mock.timers.enable({ apis: ['setInterval'] })
  const { cards, root, motion } = highlightFixture()
  motion.matches = true
  const cleanup = startLeviRoleHighlight(root, motion)
  context.mock.timers.tick(6000)
  assert.equal(highlighted(cards), 0)
  motion.matches = false
  motion.dispatchEvent(new Event('change'))
  context.mock.timers.tick(1500)
  assert.equal(highlighted(cards), 1)
  motion.matches = true
  motion.dispatchEvent(new Event('change'))
  context.mock.timers.tick(6000)
  assert.equal(highlighted(cards), 1)
  cleanup()
  context.mock.timers.tick(6000)
  cards[2].dispatchEvent(new Event('focusin'))
  motion.dispatchEvent(new Event('change'))
  context.mock.timers.tick(6000)
  assert.equal(highlighted(cards), -1)
})

test('a card already hovered or focused when the second greeting begins prevents automatic cycling', (context) => {
  context.mock.timers.enable({ apis: ['setInterval'] })
  const { cards, root, motion } = highlightFixture()
  cards[2].interacting = true
  const cleanup = startLeviRoleHighlight(root, motion)
  assert.equal(highlighted(cards), 2)
  context.mock.timers.tick(6000)
  assert.equal(highlighted(cards), 2)
  cleanup()
})
