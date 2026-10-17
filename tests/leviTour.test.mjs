import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const vite = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await vite.close() })
const { createLeviTourStore, LEVI_TOUR_VERSION_KEY, LEVI_TOUR_SLICE_KEY, chooseLeviReaction, leviRoleReactions, leviGreetings, leviHomeSteps, leviFinalMessage, scheduleLeviGreeting, scheduleLeviReaction } = await vite.ssrLoadModule('/src/services/leviTour.ts')
const { createLeviTourState, reduceLeviTour, shouldHighlightRoleCards } = await vite.ssrLoadModule('/src/state/useLeviTour.ts')
const { startLeviRoleHighlight } = await vite.ssrLoadModule('/src/services/leviTourHighlight.ts')
const { RoleSelectionPage } = await vite.ssrLoadModule('/src/pages/RoleSelectionPage.tsx')
const { RoleHomePage } = await vite.ssrLoadModule('/src/pages/RoleHomePage.tsx')
const { LeviTour } = await vite.ssrLoadModule('/src/components/levi-tour/LeviTour.tsx')
const { getLeviSpotlightHole, LeviSpotlight } = await vite.ssrLoadModule('/src/components/levi-tour/LeviSpotlight.tsx')
const { getLeviHomeGuidePosition, getLeviHomeScrollTop, getLeviMobileScrollTop, highlightLeviHomeTargets } = await vite.ssrLoadModule('/src/services/leviTourHomeHighlight.ts')
const { getRoleById } = await vite.ssrLoadModule('/src/config/roles.ts')
const { createInitialProgression, getRoleProgress } = await vite.ssrLoadModule('/src/services/progression.ts')
const { LEVI_ARENA_SLICE_KEY, createLeviArenaStore, leviArenaSteps, reconcileLeviArenaStep, nextLeviArenaStep,
  readLeviArenaSnapshot, highlightLeviArenaTargets, getLeviLockedExplanation,
  earlyOpponentComment, isEarlyOpponentSelection } = await vite.ssrLoadModule('/src/services/leviArenaTour.ts')
const { LEVI_FINISH_HINT_KEY, createLeviFinishHintStore, availableFinishButton, observeFinishButton, leviFinishLesson } = await vite.ssrLoadModule('/src/dev/mascot/leviFinishHintState.ts')
const { NegotiationView } = await vite.ssrLoadModule('/src/components/arena/NegotiationView.tsx')
const { createArenaSession, addPlayerMessage, addOpponentReply, endArenaSession } = await vite.ssrLoadModule('/src/services/arenaSession.ts')

function memory(entries = []) {
  const data = new Map(entries)
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } }
}

test('finish hint follows the actual Finish button through opening, request and successful exchange', () => {
  const render = (session, isOpening = false) => renderToStaticMarkup(createElement(NegotiationView, {
    character: { name: 'Оппонент', role: 'Manager' }, scenario: { title: 'Тест', maxTurns: 10 },
    session, isOpening, replyError: null, async onSend() { return true }, onFinish() {}, onOpenAISettings() {},
  }))
  const start = createArenaSession('scenario', 'character', 'Обсудим')
  const pending = addPlayerMessage(start, 'Вопрос', 10)
  const complete = addOpponentReply(pending, 'Ответ', 10)
  const button = {
    isConnected: true, disabled: true, matches: () => false, closest: () => null,
    getClientRects: () => [1], ownerDocument: { defaultView: { getComputedStyle: () => ({ visibility: 'visible', display: 'block' }) } },
  }
  const root = { querySelector: (selector) => {
    assert.equal(selector, '.arena-dialogue .arena-dialogue-heading > button.secondary-action-button')
    return button
  } }
  for (const html of [render(start, true), render(start), render(pending)]) {
    assert.match(html, /<button class="secondary-action-button" type="button" disabled="">Завершить переговоры/)
    assert.equal(availableFinishButton(root), null)
  }
  assert.match(render(complete), /<button class="secondary-action-button" type="button">Завершить переговоры/)
  button.disabled = false
  assert.equal(availableFinishButton(root), button)
  assert.equal(endArenaSession(complete).status, 'completed')
  button.getClientRects = () => []
  assert.equal(availableFinishButton(root), null)
  button.getClientRects = () => [1]
  button.closest = () => ({})
  assert.equal(availableFinishButton(root), null)
  button.closest = () => null
  button.isConnected = false
  assert.equal(availableFinishButton(root), null)
})

test('finish hint uses a separate once-only dev marker and the existing lesson presentation', () => {
  const storage = memory([[LEVI_TOUR_VERSION_KEY, '1'], [LEVI_ARENA_SLICE_KEY, '1']])
  const store = createLeviFinishHintStore(storage)
  assert.equal(store.hasViewed(), false)
  const html = renderToStaticMarkup(createElement(LeviTour, { greeting: 1, reaction: null, standaloneLesson: leviFinishLesson, onNext() {}, onSkip() {} }))
  for (const text of Object.values(leviFinishLesson)) assert.ok(html.includes(text))
  assert.match(html, />Понятно<\/button>/)
  assert.doesNotMatch(html, /Пропустить экскурсию/)
  assert.equal(storage.data.has(LEVI_FINISH_HINT_KEY), false)
  store.markViewed()
  assert.equal(storage.data.get(LEVI_FINISH_HINT_KEY), '1')
  assert.equal(createLeviFinishHintStore(storage).hasViewed(), true)
  assert.equal(storage.data.get(LEVI_TOUR_VERSION_KEY), '1')
  assert.equal(storage.data.get(LEVI_ARENA_SLICE_KEY), '1')
  const blocked = createLeviFinishHintStore({ getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } })
  blocked.markViewed()
  assert.equal(blocked.hasViewed(), true)
})

test('finish availability observer follows real button changes and disconnects when leaving the dialogue', () => {
  const previousObserver = globalThis.MutationObserver
  const previousWindow = globalThis.window
  let notify, disconnected = false, listener
  globalThis.MutationObserver = class {
    constructor(callback) { notify = callback }
    observe(_root, options) { assert.ok(options.attributeFilter.includes('disabled')) }
    disconnect() { disconnected = true }
  }
  globalThis.window = { addEventListener(_name, fn) { listener = fn }, removeEventListener(_name, fn) { assert.equal(fn, listener); listener = null } }
  try {
    const button = { isConnected: true, disabled: true, matches: () => false, closest: () => null,
      getClientRects: () => [1], ownerDocument: { defaultView: { getComputedStyle: () => ({ visibility: 'visible', display: 'block' }) } } }
    let present = true
    const root = { querySelector: () => present ? button : null }
    const values = []
    const stop = observeFinishButton(root, (value) => values.push(value))
    assert.equal(values.at(-1), null)
    button.disabled = false
    notify()
    assert.equal(values.at(-1), button)
    present = false
    notify()
    assert.equal(values.at(-1), null)
    stop()
    assert.equal(disconnected, true)
    assert.equal(listener, null)
  } finally {
    globalThis.MutationObserver = previousObserver
    globalThis.window = previousWindow
  }
})

test('spotlight cuts out real target geometry including focus/glow space, without mutating it', () => {
  const button = Object.freeze({ left: 120, top: 340, width: 160, height: 46 })
  assert.deepEqual(getLeviSpotlightHole(button), { x: 108, y: 328, width: 184, height: 70 })
  assert.deepEqual(getLeviSpotlightHole({ left: 0, top: -20, width: 100, height: 16 }), { x: -12, y: -32, width: 124, height: 40 })
  assert.equal(button.height, 46)
  // No active anchor means no darkening, focus trap or decorative overlay.
  assert.equal(renderToStaticMarkup(createElement(LeviSpotlight, { root: { current: null } })), '')
})

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
  return createElement(LeviTour, { greeting: state.greeting, reaction: state.status === 'reaction' ? state.reaction : null,
    homeStep: state.status === 'home' ? state.homeStep : undefined, final: state.status === 'final', onNext() {}, onSkip() {} })
}

test('Home lessons keep explicit explanation and character comment fields', () => {
  for (const lesson of Object.values(leviHomeSteps)) {
    assert.equal(typeof lesson.explanation, 'string')
    assert.equal(typeof lesson.leviComment, 'string')
    assert.ok(lesson.explanation.length && lesson.leviComment.length)
    assert.equal('text' in lesson, false)
  }
})

test('lesson dialog shows a titled explanation, emotion icon and separate comment', () => {
  const titles = { 'level-xp': 'Уровень и XP', 'energy-streak': 'Энергия и Streak', training: 'Training', arena: 'Arena' }
  const icons = { 'level-xp': 'cat-judge.png', 'energy-streak': 'cat-happy.png', training: 'cat-idle.png', arena: 'cat-judge.png' }
  for (const step of Object.keys(titles)) {
    const state = { ...createLeviTourState(false, true), homeStep: step }
    const html = renderToStaticMarkup(guide(state))
    assert.ok(html.includes(`class="levi-tour__step-heading"`))
    assert.ok(html.includes(`<span>${titles[step]}</span>`))
    assert.ok(html.includes(`src="/mascot/${icons[step]}"`))
    assert.ok(html.includes(`class="levi-tour__comment-row"`))
    assert.ok(html.includes(`<p>${leviHomeSteps[step].explanation}</p>`))
    assert.ok(html.includes(`<p class="levi-tour__comment">${leviHomeSteps[step].leviComment}</p>`))
  }
  assert.equal(leviHomeSteps.arena.explanation, 'А здесь начинается самое интересное. Выбираешь оппонента, ведёшь переговоры и получаешь разбор')
  assert.equal(leviHomeSteps.arena.leviComment, 'Не переживай, проигрывать тоже полезно. Мне так говорили')
  const final = renderToStaticMarkup(guide(reduceLeviTour(createLeviTourState(false, true), { type: 'arena-entered' })))
  assert.ok(!final.includes('levi-tour__step-heading'))
  assert.ok(!final.includes('levi-tour__comment-row'))
})

test('first greetings and role reaction share the lesson dialog style without empty explanation/comment blocks', () => {
  const first = renderToStaticMarkup(guide(createLeviTourState(false)))
  assert.ok(first.includes('<span>Знакомство с Леви</span>'))
  assert.ok(first.includes(`<p>${leviGreetings[0]}</p>`))
  assert.ok(!first.includes('levi-tour__comment-row'))

  const second = renderToStaticMarkup(guide(reduceLeviTour(createLeviTourState(false), { type: 'advance-greeting' })))
  const [explanation, comment] = leviGreetings[1].split('\n\n')
  assert.ok(second.includes('<span>Выбери роль</span>'))
  assert.ok(second.includes(`<p>${explanation}</p>`))
  assert.ok(second.includes(`<p class="levi-tour__comment">${comment}</p>`))
  assert.ok(second.includes('src="/mascot/cat-idle.png"'))
  assert.ok(!second.includes('>Дальше →</button>'))

  for (const roleId of ['product_manager', 'project_manager', 'sales_manager']) {
    const reaction = chooseLeviReaction(roleId, undefined, () => 0)
    const html = renderToStaticMarkup(guide(reduceLeviTour(createLeviTourState(false), { type: 'role-selected', reaction })))
    assert.ok(html.includes('<span>Твой выбор</span>'))
    assert.ok(html.includes(`<p class="levi-tour__comment">${reaction.text}</p>`))
    assert.ok(html.includes(`src="/mascot/cat-${reaction.emotion}.png"`))
    assert.ok(!html.includes('levi-tour__message"><p></p>'))
  }
})

test('floating guide geometry uses real target bounds without resizing or mutating the target', () => {
  const target = Object.freeze({ top: 300, bottom: 620, left: 736, right: 1248 })
  assert.deepEqual(getLeviHomeGuidePosition(target, 580, 1440, 200), { top: 836, left: 702 })
  assert.equal(target.bottom - target.top, 320)
  assert.deepEqual(getLeviHomeGuidePosition({ ...target, left: 1300, right: 1440 }, 580, 1440, 0), { top: 636, left: 844 })
})

test('both greetings advance once, while early role selection keeps its reaction and ignores late greeting events', () => {
  const initial = createLeviTourState(false)
  const second = reduceLeviTour(initial, { type: 'advance-greeting' })
  assert.equal(second.greeting, 1)
  assert.equal(reduceLeviTour(second, { type: 'advance-greeting' }).greeting, 1)
  const [explanation, comment] = leviGreetings[1].split('\n\n')
  assert.ok(renderToStaticMarkup(guide(second)).includes(`<p>${explanation}</p>`))
  assert.ok(renderToStaticMarkup(guide(second)).includes(`<p class="levi-tour__comment">${comment}</p>`))
  assert.ok(!renderToStaticMarkup(guide(second)).includes('Дальше'))
  assert.equal(reduceLeviTour(initial, { type: 'continue' }), initial)
  const reaction = chooseLeviReaction('product_manager', undefined, () => 0)
  const selected = reduceLeviTour(initial, { type: 'role-selected', reaction })
  assert.equal(selected.status, 'reaction')
  assert.equal(reduceLeviTour(selected, { type: 'advance-greeting' }), selected)
  const html = renderToStaticMarkup(guide(selected))
  assert.equal(renderToStaticMarkup(guide(selected)), html)
  assert.ok(html.includes(reaction.text))
  assert.ok(html.includes('Дальше →'))
  assert.ok(!html.includes('Продолжить'))
  assert.ok(html.includes('Пропустить'))
})

test('greeting controls put skip before primary Next and the second greeting separates the closing paragraph', () => {
  const first = renderToStaticMarkup(guide(createLeviTourState(false)))
  assert.ok(first.indexOf('>Пропустить экскурсию</button>') < first.indexOf('>Дальше →</button>'))
  assert.match(first, /class="primary-button levi-tour__next"/)
  const second = renderToStaticMarkup(guide(reduceLeviTour(createLeviTourState(false), { type: 'advance-greeting' })))
  assert.ok(second.includes('потренироваться.</p><div class="levi-tour__comment-row"'))
  assert.ok(second.includes('Обещаю не осуждать. Пока что.</p>'))
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
  assert.equal(state.status, 'home')
  assert.equal(state.homeStep, 'level-xp')
  assert.equal(reduceLeviTour(state, { type: 'role-selected', reaction: chooseLeviReaction('project_manager') }), state)
  state = reduceLeviTour(state, { type: 'restart' })
  assert.equal(state.status, 'active')
  assert.equal(state.greeting, 0)
  assert.equal(state.reaction, null)
  state = reduceLeviTour(state, { type: 'skip' })
  assert.equal(state.status, 'skipped')
  assert.equal(reduceLeviTour(state, { type: 'advance-greeting' }), state)
})

test('Home lessons finish only on Arena Pонятно, without entering Arena or completing the full tour', () => {
  let state = reduceLeviTour(createLeviTourState(false), { type: 'role-selected', reaction: chooseLeviReaction('product_manager') })
  assert.equal(reduceLeviTour(state, { type: 'done' }), state)
  for (const step of ['level-xp', 'energy-streak', 'training', 'arena']) {
    state = reduceLeviTour(state, { type: 'continue' })
    assert.equal(state.status, 'home')
    assert.equal(state.homeStep, step)
    const html = renderToStaticMarkup(guide(state))
    assert.ok(html.includes(`<p>${leviHomeSteps[step].explanation}</p>`))
    assert.ok(html.includes(`<p class="levi-tour__comment">${leviHomeSteps[step].leviComment}</p>`))
    assert.ok(html.includes(step === 'arena' ? 'Понятно' : 'Дальше →'))
    assert.ok(html.includes('Пропустить экскурсию'))
    if (step !== 'arena') assert.equal(reduceLeviTour(state, { type: 'done' }), state)
  }
  state = reduceLeviTour(state, { type: 'done' })
  assert.equal(state.status, 'completed')
  assert.equal(reduceLeviTour(state, { type: 'done' }), state)
  assert.equal(reduceLeviTour(state, { type: 'arena-entered' }), state)
  const fullStorage = memory()
  const homeStore = createLeviTourStore(fullStorage)
  homeStore.markViewed()
  assert.equal(fullStorage.data.has(LEVI_TOUR_VERSION_KEY), false)
  assert.equal(createLeviArenaStore(fullStorage).hasViewed(), false)
  // The former final preview remains renderable, but is not part of this Home completion path.
  const final = reduceLeviTour(createLeviTourState(false, true), { type: 'arena-entered' })
  assert.ok(renderToStaticMarkup(guide(final)).includes(leviFinalMessage))
})

test('existing users replay at Home without a role reaction; skip and ordinary role changes never restart onboarding', () => {
  assert.equal(createLeviTourState(false, true).status, 'home')
  let state = reduceLeviTour(createLeviTourState(true, true), { type: 'restart', hasSelectedRole: true })
  assert.equal(state.status, 'home')
  assert.equal(state.reaction, null)
  assert.equal(state.homeStep, 'level-xp')
  const reaction = chooseLeviReaction('sales_manager')
  const skipped = reduceLeviTour(createLeviTourState(false), { type: 'skip' })
  assert.equal(reduceLeviTour(skipped, { type: 'role-selected', reaction }), skipped)
  for (const start of [state, reduceLeviTour(createLeviTourState(false), { type: 'role-selected', reaction }),
    reduceLeviTour(state, { type: 'arena-entered' })]) {
    assert.equal(reduceLeviTour(start, { type: 'skip' }).status, 'skipped')
  }
  state = reduceLeviTour(state, { type: 'suspend' })
  assert.equal(reduceLeviTour(state, { type: 'role-selected', reaction }), state)
})

test('Home uses real role progression and exposes targets without changing its actions or mutating data', () => {
  const progression = createInitialProgression()
  progression.roles.sales_manager.xp = 120
  progression.energy = 3
  progression.streak = 5
  const before = structuredClone(progression)
  const props = { role: getRoleById('sales_manager'), roleProgress: getRoleProgress(progression, 'sales_manager'), energy: 3, streak: 5,
    onChangeRole() {}, onOpenArena() {}, onOpenTraining() {}, onOpenAISettings() {} }
  const html = renderToStaticMarkup(createElement(RoleHomePage, props))
  for (const target of ['level-xp', 'energy', 'streak', 'training', 'arena', 'arena-entry']) assert.ok(html.includes(`data-tour="${target}"`))
  assert.deepEqual(leviHomeSteps.arena.targets, ['arena'])
  const arena = html.match(/<article[^>]*data-tour="arena"[^>]*>(.*?)<\/article>/s)?.[1]
  assert.ok(arena?.includes('01') && arena.includes('<h2>Arena</h2>') && arena.includes('Применяйте переговорные навыки'))
  assert.ok(arena.includes('data-tour="arena-entry"'))
  assert.ok(!arena.includes('Training'))
  assert.ok(html.includes('Level 2'))
  assert.ok(html.includes('120/250 XP'))
  assert.ok(html.includes('Открыть арену'))
  assert.ok(html.includes('Начать тренировку'))
  assert.ok(!html.includes('levi-home-guide'))
  for (const position of ['intro', 'stats', 'training', 'arena']) {
    const preview = renderToStaticMarkup(createElement(RoleHomePage, { ...props, tourSlot: { position, content: createElement('aside', null, 'Tour marker') } }))
    assert.equal(preview.split('Tour marker').length - 1, 1)
  }
  assert.deepEqual(progression, before)
})

test('Home scroll planning keeps guide and target visible on mobile; scarce space prioritizes the real control', () => {
  for (const width of [320, 375, 390]) {
    const target = { top: 900, bottom: 1130, left: 20, right: width - 20 }
    const position = getLeviHomeGuidePosition(target, width - 32, width, 0)
    assert.equal(position.top, target.bottom + 16)
    assert.ok(position.left >= 16 && position.left + width - 32 <= width - 16)
    const bubble = { top: position.top, bottom: position.top + 260 }
    const scroll = getLeviHomeScrollTop(bubble, [target], 0, 740)
    assert.ok(900 - scroll >= 16, `${width}: target top is visible`)
    assert.ok(target.bottom - scroll <= 724, `${width}: target bottom is visible`)
    assert.ok(bubble.top - scroll >= 16 && bubble.bottom - scroll <= 724, `${width}: guide remains visible without overlapping the target`)
  }
  const scroll = getLeviHomeScrollTop({ top: 100, bottom: 400 }, [{ top: 50, bottom: 900 }], 0, 500, { top: 820, bottom: 864 })
  assert.ok(820 - scroll >= 16 && 864 - scroll <= 484)
  assert.equal(getLeviHomeScrollTop({ top: 100, bottom: 260 }, [{ top: 30, bottom: 80 }], 0, 740), 0)
  assert.ok(Number.isFinite(getLeviHomeScrollTop({ top: 800, bottom: 1000 }, [], 0, 740)))
})

test('fixed mobile Home guide uses its measured top edge and never scrolls when the target is already clear', () => {
  const card = { top: 500, bottom: 760 }
  const scroll = getLeviMobileScrollTop([card], 0, 470)
  assert.equal(scroll, 306)
  assert.equal(card.bottom - scroll, 454)
  assert.equal(getLeviMobileScrollTop([{ top: 40, bottom: 300 }], 60, 470), 60)
  assert.equal(getLeviMobileScrollTop([], 60, 470), 60)
  const tall = { top: 200, bottom: 900 }
  const headingAndAction = { top: 350, bottom: 690 }
  const limited = getLeviMobileScrollTop([tall], 0, 470, headingAndAction)
  assert.ok(headingAndAction.top - limited >= 16)
  assert.ok(headingAndAction.bottom - limited <= 454)
})

test('Home highlights clean up before the next group and missing anchors remain recoverable', () => {
  const nodes = new Map(['level-xp', 'energy', 'streak', 'training', 'arena-entry'].map((id) => [id, new Card()]))
  const root = { querySelector(selector) { return nodes.get(selector.match(/"([^"]+)"/)[1]) ?? null } }
  const first = highlightLeviHomeTargets(root, ['level-xp'])
  assert.equal(first.missing, false)
  first.cleanup()
  const second = highlightLeviHomeTargets(root, ['energy', 'streak'])
  assert.equal(nodes.get('level-xp').attributes.has('data-levi-highlighted'), false)
  assert.equal(second.targets.length, 2)
  second.cleanup()
  assert.equal(highlightLeviHomeTargets(root, ['missing']).missing, true)
  assert.ok([...nodes.values()].every((node) => !node.attributes.has('data-levi-highlighted')))
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
function highlighted(cards) { return cards.filter((card) => card.attributes.has('data-tour-highlighted')).length }
function highlightFixture() {
  const cards = [new Card(), new Card(), new Card()]
  return { cards, root: { querySelectorAll: () => cards } }
}

test('all three roles stay highlighted together without cycling or changing selection; cleanup removes every highlight', (context) => {
  context.mock.timers.enable({ apis: ['setInterval'] })
  const { cards, root } = highlightFixture()
  let selections = 0
  cards.forEach((card) => card.addEventListener('click', () => selections++))
  const cleanup = startLeviRoleHighlight(root)
  assert.equal(highlighted(cards), 3)
  for (const event of ['pointerenter', 'focusin']) cards[1].dispatchEvent(new Event(event))
  context.mock.timers.tick(15000)
  assert.equal(highlighted(cards), 3)
  assert.equal(selections, 0)
  cards[2].dispatchEvent(new Event('click'))
  assert.equal(selections, 1)
  assert.ok(cards.every((card) => card.attributes.get('aria-pressed') === 'false'))
  cleanup()
  context.mock.timers.tick(15000)
  assert.equal(highlighted(cards), 0)
})

test('reaction has its own 4.5s timer and never auto-advances other lessons', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let state = reduceLeviTour(createLeviTourState(false), { type: 'role-selected', reaction: chooseLeviReaction('sales_manager') })
  const reaction = state.reaction
  const cancel = scheduleLeviReaction(state.status, () => { state = reduceLeviTour(state, { type: 'finish-reaction', run: 0 }) })
  context.mock.timers.tick(4499)
  assert.equal(state.status, 'reaction')
  assert.equal(state.reaction, reaction)
  context.mock.timers.tick(1)
  assert.equal(state.status, 'home')
  assert.equal(state.homeStep, 'level-xp')
  cancel()
  for (const homeStep of ['level-xp', 'energy-streak', 'training', 'arena']) {
    state = { ...state, homeStep }
    assert.equal(scheduleLeviReaction(state.status, () => assert.fail('Home must remain manual')), undefined)
    context.mock.timers.tick(10000)
    assert.equal(state.homeStep, homeStep)
  }
  for (const status of ['active', 'final', 'skipped', 'inactive', 'completed']) {
    assert.equal(scheduleLeviReaction(status, () => assert.fail('Only reactions may auto-advance')), undefined)
  }
})

test('reaction timer cancels on manual advance/skip/unmount and simultaneous timer/button cannot skip Level/XP', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const initial = reduceLeviTour(createLeviTourState(false), { type: 'role-selected', reaction: chooseLeviReaction('product_manager') })
  const finish = { type: 'finish-reaction', run: initial.run }
  for (const event of [finish, { type: 'skip' }, { type: 'suspend' }]) {
    let calls = 0
    const cancel = scheduleLeviReaction('reaction', () => calls++)
    context.mock.timers.tick(1000)
    const state = reduceLeviTour(initial, event)
    cancel()
    context.mock.timers.tick(10000)
    assert.equal(calls, 0)
    assert.equal(reduceLeviTour(state, finish), state)
  }
  // Timer and the reaction's button dispatch the same guarded event in either order.
  const once = reduceLeviTour(initial, finish)
  assert.equal(reduceLeviTour(once, finish), once)
  assert.equal(once.homeStep, 'level-xp')
  const restarted = reduceLeviTour(initial, { type: 'restart' })
  const newReaction = reduceLeviTour(restarted, { type: 'role-selected', reaction: initial.reaction })
  assert.equal(reduceLeviTour(newReaction, finish), newReaction)
})

test('Arena dev slice is independent of Home skip and never writes full-tour or game state', () => {
  const storage = memory([[LEVI_TOUR_SLICE_KEY, '1'], [LEVI_TOUR_VERSION_KEY, '1'], ['levelup-arena:progression-v1', '{"xp":120}']])
  const arena = createLeviArenaStore(storage)
  assert.equal(arena.hasViewed(), false)
  arena.markViewed()
  assert.equal(storage.data.get(LEVI_ARENA_SLICE_KEY), '1')
  assert.equal(storage.data.get(LEVI_TOUR_VERSION_KEY), '1')
  assert.equal(storage.data.get('levelup-arena:progression-v1'), '{"xp":120}')
  assert.equal(createLeviArenaStore(storage).hasViewed(), true)
})

test('Arena lessons preserve the approved explanations and separate Levi comments', () => {
  assert.deepEqual(Object.keys(leviArenaSteps), ['opponents', 'locked', 'chooseOpponent', 'chooseScenario', 'briefing'])
  for (const step of Object.keys(leviArenaSteps)) {
    const html = renderToStaticMarkup(createElement(LeviTour, { greeting: 1, reaction: null, arenaStep: step, onNext() {}, onSkip() {} }))
    assert.ok(html.includes(`<p>${leviArenaSteps[step].explanation.replaceAll('"', '&quot;')}</p>`) || html.includes(leviArenaSteps[step].explanation))
    assert.ok(html.includes(leviArenaSteps[step].leviComment.replaceAll('"', '&quot;')))
    assert.ok(html.includes('levi-tour__comment-row'))
    assert.equal(html.includes('Далее'), ['opponents', 'locked'].includes(step))
    assert.equal(html.includes('Понятно'), step === 'briefing')
  }
})

test('Arena tour follows real selection, skips unlocked boss and tolerates early clicks', () => {
  const base = { ready: true, hasLockedBoss: true, selectedOpponent: false, selectedScenario: false }
  assert.equal(nextLeviArenaStep('opponents', base), 'locked')
  assert.equal(nextLeviArenaStep('locked', base), 'chooseOpponent')
  assert.equal(nextLeviArenaStep('opponents', { ...base, hasLockedBoss: false }), 'chooseOpponent')
  assert.equal(reconcileLeviArenaStep('opponents', { ...base, selectedOpponent: true }), 'chooseScenario')
  assert.equal(reconcileLeviArenaStep('locked', { ...base, selectedOpponent: true, selectedScenario: true }), 'briefing')
  assert.equal(reconcileLeviArenaStep('briefing', { ...base, selectedOpponent: true, selectedScenario: false }), 'chooseScenario')
  assert.equal(nextLeviArenaStep('briefing', { ...base, selectedOpponent: true, selectedScenario: true }), 'completed')
  assert.equal(reconcileLeviArenaStep('skipped', base), 'skipped')
  assert.equal(nextLeviArenaStep('chooseOpponent', { ...base, ready: false }), 'chooseOpponent')
})

test('Arena scenario comment reacts only to a new early opponent selection, not normal choice or replay', () => {
  for (const step of ['opponents', 'locked']) {
    assert.equal(isEarlyOpponentSelection(step), true)
  }
  assert.equal(isEarlyOpponentSelection('chooseOpponent'), false)
  assert.equal(isEarlyOpponentSelection('chooseScenario'), false)

  const scenario = { greeting: 1, reaction: null, arenaStep: 'chooseScenario', onNext() {}, onSkip() {} }
  const early = renderToStaticMarkup(createElement(LeviTour, { ...scenario, arenaComment: earlyOpponentComment }))
  const ordinary = renderToStaticMarkup(createElement(LeviTour, scenario))
  assert.ok(early.includes(earlyOpponentComment))
  assert.ok(!early.includes(leviArenaSteps.chooseScenario.leviComment))
  assert.ok(ordinary.includes(leviArenaSteps.chooseScenario.leviComment.replaceAll('"', '&quot;')))
  assert.ok(!ordinary.includes(earlyOpponentComment))
})

test('Arena spotlight targets real whole cards, reads actual selection and cleans on exit', () => {
  const card = (disabled = false, pressed = false) => ({ disabled, attributes: new Map([['aria-pressed', String(pressed)]]),
    getAttribute(key) { return this.attributes.get(key) ?? null }, setAttribute(key, value) { this.attributes.set(key, value) }, removeAttribute(key) { this.attributes.delete(key) },
    querySelector(selector) { return disabled ? { textContent: selector === '.arena-lock-status' ? 'Откроется на уровне 2' : 'Сначала победите босса «Первый босс»' } : null } })
  const open = card(false)
  const locked = card(true)
  const scenario = card(false)
  const briefing = card(false)
  const root = { querySelectorAll(selector) {
    if (selector === '.arena-opponent-card') return [open, locked]
    if (selector === '.arena-scenario-card') return [scenario]
    if (selector === '.arena-selected-brief') return [briefing]
    return []
  }, querySelector(selector) {
    if (selector === '.arena-boss-list') return {}
    if (selector === '.arena-scenario-card[aria-pressed="true"]') return scenario.getAttribute('aria-pressed') === 'true' ? scenario : null
    if (selector === '.arena-opponent-card[disabled]') return locked
    return null
  } }
  assert.deepEqual(readLeviArenaSnapshot(root), { ready: true, hasLockedBoss: true, selectedOpponent: false, selectedScenario: false })
  for (const [step, expected] of [['opponents', open], ['locked', locked], ['chooseOpponent', open], ['chooseScenario', scenario], ['briefing', briefing]]) {
    const highlighted = highlightLeviArenaTargets(root, step)
    assert.deepEqual(highlighted.targets, [expected])
    assert.equal(expected.attributes.get('data-levi-highlighted'), 'true')
    highlighted.cleanup()
    assert.equal(expected.attributes.has('data-levi-highlighted'), false)
  }
  open.setAttribute('aria-pressed', 'true')
  scenario.setAttribute('aria-pressed', 'true')
  assert.equal(readLeviArenaSnapshot(root).selectedOpponent, true)
  assert.equal(readLeviArenaSnapshot(root).selectedScenario, true)
  assert.equal(getLeviLockedExplanation(root), leviArenaSteps.locked.explanation)
})
