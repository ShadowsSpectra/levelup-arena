import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const vite = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await vite.close() })
const { App } = await vite.ssrLoadModule('/src/App.tsx')
const { initialAppState } = await vite.ssrLoadModule('/src/state/useAppState.ts')
const { appStorage } = await vite.ssrLoadModule('/src/services/storage.ts')
const { RoleSelectionPage } = await vite.ssrLoadModule('/src/pages/RoleSelectionPage.tsx')

function withStorage(entries, run) {
  const data = new Map(entries)
  const previous = globalThis.window
  globalThis.window = { localStorage: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  } }
  try { return run(data) } finally { globalThis.window = previous }
}

test('new user and old onboarding marker both enter the real Levi onboarding', () => {
  for (const entries of [[], [['levelup-arena:onboarding-complete', 'true']]]) {
    withStorage(entries, () => {
      assert.equal(appStorage.hasCompletedLeviOnboarding(), false)
      assert.deepEqual(initialAppState(false, appStorage.getSelectedRole()), { screen: 'onboarding', selectedRoleId: null })
      const html = renderToStaticMarkup(createElement(App))
      assert.match(html, /Знакомство с Леви/)
      assert.match(html, /Пропустить экскурсию/)
      assert.equal((html.match(/data-tour="role-card"/g) ?? []).length, 3)
      assert.doesNotMatch(html, /Начни с переговоров|Разбирай опыт и улучшай навыки|Пробуй снова/)
      assert.doesNotMatch(html, />Продолжить<\/button>/)
    })
  }
})

test('existing role is identified and can continue without selecting it again or changing progress', () => {
  const progress = '{"test":"unchanged"}'
  withStorage([['levelup-arena:onboarding-complete', 'true'], ['levelup-arena:selected-role', 'sales_manager'],
    ['levelup-arena:progression-v1', progress]], (data) => {
    const html = renderToStaticMarkup(createElement(App))
    assert.match(html, /data-tour-role="sales_manager" aria-current="true"/)
    assert.match(html, /Текущая роль/)
    assert.match(html, />Продолжить<\/button>/)
    assert.equal(data.get('levelup-arena:selected-role'), 'sales_manager')
    assert.equal(data.get('levelup-arena:progression-v1'), progress)
    assert.equal(data.has('levelup-arena:levi-onboarding-version'), false)
  })
})

test('onboarding version is separate from legacy, dev and full-tour markers and survives reload', () => {
  withStorage([['levelup-arena:onboarding-complete', 'true'], ['levelup-arena:levi-tour-dev-role-slice', '1'],
    ['levelup-arena:levi-tour-version', '1'], ['levelup-arena:progression-v1', 'progress']], (data) => {
    assert.equal(appStorage.hasCompletedLeviOnboarding(), false)
    appStorage.setSelectedRole('product_manager')
    appStorage.setLeviOnboardingComplete()
    assert.equal(data.get('levelup-arena:levi-onboarding-version'), '1')
    assert.equal(data.get('levelup-arena:progression-v1'), 'progress')
    assert.equal(data.get('levelup-arena:levi-tour-version'), '1')
    assert.equal(data.get('levelup-arena:levi-tour-dev-role-slice'), '1')
    assert.deepEqual(initialAppState(appStorage.hasCompletedLeviOnboarding(), appStorage.getSelectedRole()),
      { screen: 'home', selectedRoleId: 'product_manager' })
    assert.deepEqual(initialAppState(true, null), { screen: 'role-selection', selectedRoleId: null })
    assert.deepEqual(initialAppState(false, 'sales_manager'), { screen: 'onboarding', selectedRoleId: 'sales_manager' })
  })
})

test('real selection controls keep their role handler and continue is a separate action', () => {
  const calls = []
  const tree = RoleSelectionPage({ selectedRoleId: 'sales_manager', onSelectRole: (id) => calls.push(id), onContinue: () => calls.push('continue') })
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return null
    if (Array.isArray(node)) { for (const child of node) { const result = find(child, predicate); if (result) return result } return null }
    if (predicate(node)) return node
    return find(node.props?.children, predicate)
  }
  find(tree, (node) => node.props?.['data-tour-role'] === 'product_manager').props.onClick()
  find(tree, (node) => node.props?.className === 'primary-button levi-onboarding__continue').props.onClick()
  assert.deepEqual(calls, ['product_manager', 'continue'])
})

test('production entry does not import dev preview or the legacy onboarding page', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const onboarding = await readFile(new URL('../src/components/levi-tour/LeviOnboarding.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(app + onboarding, /src\/dev|\.\.\/dev|OnboardingPage|LeviArenaGuide/)
  assert.match(onboarding, /setSkipped\(true\); onSkip\?\.\(\)/)
})
