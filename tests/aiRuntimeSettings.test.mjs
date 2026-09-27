import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer, build } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { once } from 'node:events'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

const vite = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await vite.close() })
const { createRuntimeAISettings } = await vite.ssrLoadModule('/server/ai/runtimeAISettings.ts')
const { createAIHttpApi } = await vite.ssrLoadModule('/server/ai/aiHttpApi.ts')
const { createAISettingsSession, aiSettingsSession, checkAIConnection } =
  await vite.ssrLoadModule('/src/services/aiSettingsSession.ts')
const { createArenaAIRequest } = await vite.ssrLoadModule('/src/services/arenaAIRequest.ts')
const { createBrowserOpponentService, getAIStatus } = await vite.ssrLoadModule('/src/services/arenaOpponentGateway.ts')
const { createBrowserEvaluatorService } = await vite.ssrLoadModule('/src/services/evaluatorService.ts')
const { AISettingsDialog } = await vite.ssrLoadModule('/src/components/AISettingsDialog.tsx')
const { resolveFullArenaCards } = await vite.ssrLoadModule('/server/content/arenaSources.ts')
const { buildOpponentMessages } = await vite.ssrLoadModule('/server/ai/opponentPrompt.ts')
const { buildEvaluatorMessages } = await vite.ssrLoadModule('/server/ai/evaluatorPrompt.ts')

// Deliberately fake credentials. Never use local environment secrets in tests.
const env = {
  AI_PROVIDER: 'openai-compatible', AI_BASE_URL: 'https://api.mistral.ai/v1',
  AI_API_KEY: 'test-default-key-not-real', AI_MODEL: 'default-test-model',
}
const a = { provider: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', apiKey: 'test-A-key-not-real', model: 'A-model' }
const b = { provider: 'openai-compatible', baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'test-B-key-not-real', model: 'B-model' }
const defaults = { provider: env.AI_PROVIDER, baseUrl: env.AI_BASE_URL, apiKey: env.AI_API_KEY, model: env.AI_MODEL }

function context(completed = false) {
  const { character, scenario } = resolveFullArenaCards('olga_potential_client_01', 'sales_switching_value_01')
  return { character, scenario, session: {
    id: 'isolated-session', characterId: character.id, scenarioId: scenario.id,
    currentTurn: 1, status: completed ? 'completed' : 'responding',
    messages: [
      { id: 'opening', speaker: 'opponent', text: scenario.openingMessage },
      { id: 'player-1', speaker: 'player', text: 'Что в текущем решении отнимает больше всего времени?' },
      ...(completed ? [{ id: 'opponent-1', speaker: 'opponent', text: 'Подготовка отчётов.' }] : []),
    ],
  } }
}

const evaluation = {
  facts: { concreteMutualAgreement: false, playerMinimumSatisfied: false, opponentMinimumSatisfied: false, criticalRedLineViolated: false },
  scores: Object.fromEntries(['interestsDiscovery', 'objectionHandling', 'communicationAdaptability', 'argumentation', 'initiative']
    .map((id) => [id, { score: 30, evidenceMessageId: 'P1', reason: 'Вы задали вопрос, но не согласовали условия.' }])),
  strengths: ['Вы задали конкретный вопрос.'], improvements: ['Уточните масштаб проблемы.'],
  mainInsight: { evidenceMessageId: 'P1', insight: 'После вопроса о времени уточняйте масштаб проблемы перед предложением решения.' },
}
const providerReply = (body = 'Ответ') => new Response(JSON.stringify({ choices: [{ message: { content: body } }] }), { status: 200 })

async function withApi(options, run) {
  const api = createAIHttpApi({ env, production: true, ...options })
  const http = createHttpServer((req, res) => { void api(req, res, () => { res.statusCode = 404; res.end() }) })
  http.listen(0, '127.0.0.1')
  await once(http, 'listening')
  const base = `http://127.0.0.1:${http.address().port}`
  const post = (path, body) => fetch(`${base}/api/ai/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  try { await run({ base, post }) } finally { http.close(); await once(http, 'close') }
}

test('defaults are immutable environment snapshots; public metadata never returns the key', () => {
  const environment = { ...env }
  const settings = createRuntimeAISettings({ env: environment, production: true })
  const expected = { configured: true, provider: env.AI_PROVIDER, baseUrl: env.AI_BASE_URL, model: env.AI_MODEL }
  assert.deepEqual(settings.getPublicDefault(), expected)
  assert.ok(!JSON.stringify(settings.getPublicDefault()).includes(env.AI_API_KEY))
  environment.AI_API_KEY = 'changed-after-startup'
  assert.equal(settings.resolveRequest({}).apiKey, env.AI_API_KEY)
  assert.throws(() => { settings.resolveRequest({}).apiKey = 'mutated' }, TypeError)
  assert.deepEqual(createRuntimeAISettings({ env: {} }).getPublicDefault(), { configured: false })
  for (const partial of [{ AI_API_KEY: env.AI_API_KEY }, { ...env, AI_MODEL: '' }]) {
    assert.throws(() => createRuntimeAISettings({ env: partial }), Error)
  }
})

test('production URL allowlist is exact HTTPS; loopback is development-only and overrides cannot inherit defaults', () => {
  const production = createRuntimeAISettings({ env, production: true })
  assert.deepEqual(production.resolveRequest({ ai: a }), a)
  for (const baseUrl of [
    'http://api.openai.com/v1', 'http://localhost:9000/v1', 'https://localhost/v1',
    'https://127.0.0.1/v1', 'https://[::1]/v1', 'https://169.254.169.254/v1',
    'https://10.0.0.1/v1', 'https://api.openai.com.evil.example/v1',
    'https://api.openai.com/v1/extra', 'https://api.openai.com:444/v1',
    'https://key@api.openai.com/v1', 'https://api.openai.com/v1?apiKey=secret',
    'https://api.openai.com/v1#secret', 'https://unknown.example/v1',
  ]) assert.throws(() => production.resolveRequest({ ai: { ...a, baseUrl } }), Error)
  assert.equal(production.resolveRequest({ ai: { ...a, baseUrl: `${a.baseUrl}/` } }).baseUrl, a.baseUrl)
  for (const ai of [null, {}, { ...a, apiKey: undefined }, { ...a, apiKey: '' }, { ...a, model: undefined }, { ...a, hiddenData: {} }]) {
    assert.throws(() => production.resolveRequest({ ai }), Error)
  }
  assert.throws(() => production.resolveRequest({ ai: undefined }), Error)
  const development = createRuntimeAISettings({ env, production: false })
  for (const baseUrl of ['http://localhost:9000/v1', 'http://127.0.0.1:9000/v1', 'http://[::1]:9000/v1']) {
    assert.equal(development.resolveRequest({ ai: { ...a, baseUrl } }).baseUrl, baseUrl)
  }
  assert.throws(() => development.resolveRequest({ ai: { ...a, baseUrl: 'http://10.0.0.1/v1' } }), Error)
  const limited = createRuntimeAISettings({ env: { ...env, AI_BYOK_ALLOWED_BASE_URLS: env.AI_BASE_URL } })
  assert.throws(() => limited.resolveRequest({ ai: a }), /список/)
  assert.throws(() => createRuntimeAISettings({ env: { AI_BYOK_ALLOWED_BASE_URLS: 'http://localhost/v1' }, production: true }), Error)
})

test('tab memory never uses browser storage, reuses only its own key, and reset restores default requests', async () => {
  const originalFetch = globalThis.fetch
  const storageNames = ['localStorage', 'sessionStorage']
  const descriptors = storageNames.map((name) => Object.getOwnPropertyDescriptor(globalThis, name))
  for (const name of storageNames) Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error('Credential storage accessed') } })
  try {
    const tabA = createAISettingsSession()
    const tabB = createAISettingsSession()
    tabA.save(a)
    tabB.save(b)
    assert.equal(createAISettingsSession().get(), null, 'refresh/new JS realm starts empty')
    tabA.get().apiKey = 'cannot mutate saved key'
    assert.equal(tabA.get().apiKey, a.apiKey)
    assert.equal(tabB.get().apiKey, b.apiKey)
    assert.equal(tabA.prepare({ ...a, model: 'edited', apiKey: '' }).apiKey, a.apiKey)
    assert.throws(() => createAISettingsSession().prepare({ ...a, apiKey: '' }), /собственный/)
    tabA.clear()
    assert.equal(tabA.get(), null)
    assert.equal(tabB.get().apiKey, b.apiKey)

    const requests = []
    globalThis.fetch = async (url, options) => {
      if (url === '/api/ai/settings') return new Response(JSON.stringify({ configured: false }))
      requests.push({ url, body: JSON.parse(options.body) })
      return new Response(JSON.stringify(url.endsWith('opponent') ? { mode: 'real', reply: 'Ответ' } : { evaluation: { overallScore: 30 } }))
    }
    aiSettingsSession.save(a)
    assert.equal(await getAIStatus(), 'real')
    await createBrowserOpponentService().reply(context())
    await createBrowserEvaluatorService().evaluate(context(true))
    assert.deepEqual(requests.map(({ body }) => body.ai), [a, a])
    const markup = renderToStaticMarkup(React.createElement(AISettingsDialog, { onClose() {}, onSaved() {} }))
    assert.match(markup, /Использовать AI приложения/)
    assert.match(markup, /API Key сохранён до обновления страницы/)
    assert.ok(!markup.includes(a.apiKey))
    aiSettingsSession.clear()
    assert.ok(!('ai' in createArenaAIRequest(context())))
    assert.equal(await getAIStatus(), 'unconfigured')
  } finally {
    aiSettingsSession.clear()
    globalThis.fetch = originalFetch
    storageNames.forEach((name, index) => descriptors[index]
      ? Object.defineProperty(globalThis, name, descriptors[index]) : delete globalThis[name])
  }
})

test('simultaneous BYOK A, BYOK B and default requests isolate keys/models/endpoints for both tasks', async () => {
  for (const task of ['opponent', 'evaluate']) {
    const captured = []
    let release, allEntered
    const gate = new Promise((resolve) => { release = resolve })
    const entered = new Promise((resolve) => { allEntered = resolve })
    await withApi({ fetcher: async (url, options) => {
      captured.push({ url, auth: options.headers.Authorization, body: JSON.parse(options.body) })
      if (captured.length === 3) allEntered()
      await gate
      return providerReply(task === 'evaluate' ? JSON.stringify(evaluation) : 'Ответ')
    } }, async ({ base, post }) => {
      const request = createArenaAIRequest(context(task === 'evaluate'))
      const snapshot = structuredClone(request)
      const calls = [a, b, null].map((ai) => post(task, ai ? { ...request, ai } : request))
      let timer
      try {
        await Promise.race([entered, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Requests did not reach provider')), 3000) })])
        for (const settings of [a, b, defaults]) {
          const call = captured.find(({ body }) => body.model === settings.model)
          assert.equal(call.auth, `Bearer ${settings.apiKey}`)
          assert.equal(call.url, `${settings.baseUrl}/chat/completions`)
          assert.deepEqual(call.body.messages, task === 'evaluate' ? buildEvaluatorMessages(context(true)) : buildOpponentMessages(context()))
          assert.equal(call.body.response_format?.type, task === 'evaluate' ? 'json_object' : undefined)
        }
      } finally { clearTimeout(timer); release() }
      for (const response of await Promise.all(calls)) {
        assert.equal(response.status, 200)
        const body = await response.json()
        assert.equal(body.mode, 'real')
        if (task === 'evaluate') assert.equal(body.evaluation.outcome.status, 'NO_AGREEMENT')
        for (const key of [a.apiKey, b.apiKey, env.AI_API_KEY]) assert.ok(!JSON.stringify(body).includes(key))
      }
      assert.deepEqual(request, snapshot)
      assert.deepEqual(await (await fetch(`${base}/api/ai/settings`)).json(), {
        configured: true, provider: env.AI_PROVIDER, baseUrl: env.AI_BASE_URL, model: env.AI_MODEL,
      })
      assert.equal((await post('settings', a)).status, 405)
      assert.equal((await post(task, request)).status, 200)
      assert.equal(captured.at(-1).auth, `Bearer ${env.AI_API_KEY}`)
    })
  }
})

test('check is stateless for defaults and BYOK; incomplete overrides cannot send the default key elsewhere', async () => {
  const calls = []
  await withApi({ fetcher: async (url, options) => {
    calls.push({ url, auth: options.headers.Authorization, body: options.body ? JSON.parse(options.body) : null })
    return providerReply('OK')
  } }, async ({ base, post }) => {
    const initial = await (await fetch(`${base}/api/ai/settings`)).json()
    assert.equal((await post('check', {})).status, 200)
    assert.equal((await post('check', { ai: a })).status, 200)
    assert.equal(calls[0].auth, `Bearer ${env.AI_API_KEY}`)
    assert.equal(calls[0].url, `${env.AI_BASE_URL}/chat/completions`)
    assert.equal(calls[1].auth, `Bearer ${a.apiKey}`)
    assert.deepEqual(calls[1].body.messages, [{ role: 'user', content: 'Ответь одним словом: OK' }])
    const { apiKey: _key, ...withoutKey } = a
    for (const invalid of [withoutKey, { ...a, apiKey: '' }, null, { ...a, baseUrl: 'https://evil.example/v1' }]) {
      for (const path of ['check', 'models-check', 'opponent', 'evaluate']) {
        const body = path === 'opponent' || path === 'evaluate'
          ? { ...createArenaAIRequest(context(path === 'evaluate')), ai: invalid } : { ai: invalid }
        const rejected = await post(path, body)
        assert.equal(rejected.status, 400)
        assert.ok(!JSON.stringify(await rejected.json()).includes(env.AI_API_KEY))
      }
    }
    assert.equal((await post('check', { baseUrl: a.baseUrl, model: a.model })).status, 400)
    assert.equal(calls.length, 2, 'no upstream call for partial/forged credentials')
    assert.deepEqual(await (await fetch(`${base}/api/ai/settings`)).json(), initial)
    assert.equal((await post('models-check', { ai: b })).status, 200)
    assert.equal(calls.at(-1).auth, `Bearer ${b.apiKey}`)
    assert.equal(calls.at(-1).url, `${b.baseUrl}/models`)
    assert.equal((await fetch(`${base}/api/ai/models-check`)).status, 200)
    assert.equal(calls.at(-1).auth, `Bearer ${env.AI_API_KEY}`)
    assert.equal(calls.at(-1).url, `${env.AI_BASE_URL}/models`)
  })
})

test('provider failure/timeout/invalid output never retries through another config or Mock', async () => {
  for (const failure of ['http', 'timeout', 'invalid']) {
    const calls = []
    await withApi({ fetcher: async (_url, options) => {
      calls.push(options.headers.Authorization)
      if (failure === 'timeout') throw new DOMException('timed out', 'TimeoutError')
      if (failure === 'invalid') return new Response('not JSON', { status: 200 })
      return new Response(JSON.stringify({ error: { message: `Bearer ${a.apiKey}` } }), { status: 403 })
    } }, async ({ post }) => {
      for (const task of ['opponent', 'evaluate']) {
        const request = { ...createArenaAIRequest(context(task === 'evaluate')), ai: a }
        const snapshot = structuredClone(request)
        for (let attempt = 0; attempt < 2; attempt++) {
          const response = await post(task, request)
          assert.equal(response.status, 502)
          const error = await response.json()
          assert.ok(!error.reply && !error.evaluation && !error.mode)
          assert.ok(!JSON.stringify(error).includes(a.apiKey))
          assert.deepEqual(request, snapshot)
        }
      }
      assert.deepEqual(calls, Array(4).fill(`Bearer ${a.apiKey}`))
    })
  }
  const defaultFailureCalls = []
  await withApi({ fetcher: async (_url, options) => {
    const auth = options.headers.Authorization
    defaultFailureCalls.push(auth)
    if (auth === `Bearer ${env.AI_API_KEY}`) throw new Error('Default provider unavailable')
    return providerReply('Ответ BYOK')
  } }, async ({ post }) => {
    assert.equal((await post('opponent', { ...createArenaAIRequest(context()), ai: a })).status, 200)
    for (let attempt = 0; attempt < 2; attempt++) {
      const failed = await post('opponent', createArenaAIRequest(context()))
      assert.equal(failed.status, 502)
      const body = await failed.json()
      assert.ok(!body.reply && !body.mode)
    }
    assert.deepEqual(defaultFailureCalls, [`Bearer ${a.apiKey}`, `Bearer ${env.AI_API_KEY}`, `Bearer ${env.AI_API_KEY}`])
  })
  await withApi({ env: {}, fetcher: async () => { throw new Error('must not call') } }, async ({ post }) => {
    assert.equal((await post('check', {})).status, 409)
    assert.equal((await post('opponent', createArenaAIRequest(context()))).status, 409)
    assert.equal((await post('evaluate', createArenaAIRequest(context(true)))).status, 409)
  })
})

test('browser connection checks do not save a key or call a server-side save route', async () => {
  const originalFetch = globalThis.fetch
  const requests = []
  try {
    aiSettingsSession.clear()
    globalThis.fetch = async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) })
      return new Response(JSON.stringify({ connected: true }))
    }
    await checkAIConnection(a)
    assert.equal(aiSettingsSession.get(), null)
    await checkAIConnection()
    assert.deepEqual(requests, [{ url: '/api/ai/check', body: { ai: a } }, { url: '/api/ai/check', body: {} }])
  } finally { globalThis.fetch = originalFetch; aiSettingsSession.clear() }
})

test('successful/error response serialization redacts active secrets without exposing other visitors keys', async () => {
  const logs = []
  const originalLog = console.log
  const originalError = console.error
  console.log = (...args) => logs.push(args)
  console.error = (...args) => logs.push(args)
  try {
    await withApi({ fetcher: async () => providerReply(`Ответ ${env.AI_API_KEY} ${a.apiKey}`) }, async ({ post }) => {
      const response = await post('opponent', { ...createArenaAIRequest(context()), ai: a })
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.reply, 'Ответ [скрыто] [скрыто]')
      assert.equal(body.mode, 'real')
    })
    assert.deepEqual(logs, [])
  } finally { console.log = originalLog; console.error = originalError }
})

test('server environment secret never appears in production frontend chunks', async () => {
  const canary = 'server-key-canary-DO-NOT-EXPOSE-123456'
  const values = { ...env, AI_API_KEY: canary }
  const original = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  try {
    Object.assign(process.env, values)
    const result = await build({ configLoader: 'runner', mode: 'production', logLevel: 'silent', build: { write: false } })
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(({ output }) => output)
    for (const item of outputs) {
      const contents = item.type === 'chunk' ? item.code : String(item.source)
      assert.ok(!contents.includes(canary))
      if (item.type === 'chunk') {
        assert.ok(!Object.keys(item.modules).some((id) => id.replaceAll('\\', '/').includes('/server/')))
      }
    }
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
