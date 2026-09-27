import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer, build } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { once } from 'node:events'

const vite = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await vite.close() })
const {
  fullCharacterSource, fullScenarioSource, getPublicArenaContent,
  toPublicCharacter, toPublicScenario, resolveFullArenaCards,
} = await vite.ssrLoadModule('/server/content/arenaSources.ts')
const { createAIHttpApi } = await vite.ssrLoadModule('/server/ai/aiHttpApi.ts')
const { buildOpponentMessages } = await vite.ssrLoadModule('/server/ai/opponentPrompt.ts')
const { buildEvaluatorMessages } = await vite.ssrLoadModule('/server/ai/evaluatorPrompt.ts')
const { resolveArenaAIRequest } = await vite.ssrLoadModule('/server/ai/arenaRequest.ts')
const { createArenaAIRequest } = await vite.ssrLoadModule('/src/services/arenaAIRequest.ts')
const { createBrowserOpponentService } = await vite.ssrLoadModule('/src/services/arenaOpponentGateway.ts')
const { createBrowserEvaluatorService } = await vite.ssrLoadModule('/src/services/evaluatorService.ts')
const { isBossUnlocked, createInitialProgression, getRoleProgress } =
  await vite.ssrLoadModule('/src/services/progression.ts')

test('public catalog uses an explicit allowlist and keeps all six bosses and scenario briefs', async () => {
  const fullCharacters = await fullCharacterSource.getCharacters()
  const fullScenarios = await fullScenarioSource.getScenarios()
  const publicContent = getPublicArenaContent()
  assert.equal(publicContent.characters.length, 6)
  assert.equal(publicContent.scenarios.length, 6)
  for (const full of fullCharacters) {
    const card = publicContent.characters.find(({ id }) => id === full.id)
    assert.deepEqual(Object.keys(card).sort(), [
      'id', 'name', 'role', 'difficulty', 'communicationStyle', 'pressure',
      ...(full.unlockRequirements === undefined ? [] : ['unlockRequirements']),
    ].sort())
    for (const key of Object.keys(card)) assert.deepEqual(card[key], full[key])
    assert.ok(full.privateInformation.length)
    assert.ok(full.behavior.length)
    const role = fullScenarios.find(({ characterId }) => characterId === full.id).playerRole
    const progress = getRoleProgress(createInitialProgression(), role)
    assert.equal(isBossUnlocked(card, progress, 1), isBossUnlocked(full, progress, 1))
  }
  for (const full of fullScenarios) {
    const card = publicContent.scenarios.find(({ id }) => id === full.id)
    assert.deepEqual(Object.keys(card).sort(), [
      'id', 'title', 'playerRole', 'category', 'maxTurns',
      'openingMessage', 'characterId', 'playerBrief',
    ].sort())
    for (const key of Object.keys(card)) assert.deepEqual(card[key], full[key])
    assert.ok(full.successConditions.playerMinimumConditions.length)
    assert.ok(full.validAgreementPaths.length)
  }
})

test('projection ignores future private fields and does not share mutable nested data', async () => {
  const [character] = await fullCharacterSource.getCharacters()
  const [scenario] = await fullScenarioSource.getScenarios()
  const card = toPublicCharacter({ ...character, futureSecret: 'never expose' })
  const brief = toPublicScenario({ ...scenario, futureSecret: 'never expose' })
  assert.ok(!('futureSecret' in card) && !('futureSecret' in brief))
  brief.playerBrief.knownInformation.push('public copy only')
  assert.ok(!scenario.playerBrief.knownInformation.includes('public copy only'))
  const second = (await fullCharacterSource.getCharacters())[1]
  toPublicCharacter(second).unlockRequirements.minLevel = 99
  assert.equal(second.unlockRequirements.minLevel, 2)
})

test('full lookup rejects unknown and mismatched pairs', () => {
  assert.throws(() => resolveFullArenaCards('missing', 'missing'), /Некорректная пара/)
  assert.throws(() => resolveFullArenaCards('alexey_techlead_01', 'sales_switching_value_01'), /Некорректная пара/)
})

function requestFixture(completed = false) {
  const { character, scenario } = resolveFullArenaCards('olga_potential_client_01', 'sales_switching_value_01')
  const session = {
    id: 'request-session', characterId: character.id, scenarioId: scenario.id,
    currentTurn: 1, status: completed ? 'completed' : 'responding',
    messages: [
      { id: 'opening', speaker: 'opponent', text: scenario.openingMessage },
      { id: 'player-1', speaker: 'player', text: '  Что занимает время?\nУточните, пожалуйста.  ' },
      ...(completed ? [{ id: 'opponent-1', speaker: 'opponent', text: 'Подготовка отчётов.' }] : []),
    ],
  }
  return { character, scenario, session }
}

test('IDs-only resolution reconstructs exact completed/pending sessions with server-owned cards', () => {
  for (const task of ['opponent', 'evaluator']) {
    const context = requestFixture(task === 'evaluator')
    const request = createArenaAIRequest(context)
    const snapshot = structuredClone(request)
    const resolved = resolveArenaAIRequest(request, task)
    assert.deepEqual(resolved, context)
    assert.deepEqual(request, snapshot)
    assert.equal(resolved.session.messages[1].text, context.session.messages[1].text)
    assert.ok(resolved.character.privateInformation.length)
    assert.ok(resolved.scenario.successConditions.playerMinimumConditions.length)
  }
})

test('Arena boundary rejects malformed sessions, provider roles, invalid turns and extra context', () => {
  for (const task of ['opponent', 'evaluator']) {
    const valid = createArenaAIRequest(requestFixture(task === 'evaluator'))
    const alterSession = (patch) => ({ ...valid, session: { ...valid.session, ...patch } })
    for (const invalid of [
      null, [], {}, { ...valid, characterId: 123 }, { ...valid, playerRole: 'unknown' },
      { ...valid, scenarioId: 'missing' }, { ...valid, characterId: 'missing' },
      { ...valid, characterId: 'alexey_techlead_01' },
      { ...valid, playerRole: 'product_manager' },
      { ...valid, character: requestFixture().character },
      { ...valid, scenario: requestFixture().scenario },
      { ...valid, hiddenData: {} },
      alterSession({ id: '' }), alterSession({ id: 12 }),
      alterSession({ status: task === 'opponent' ? 'completed' : 'responding' }),
      ...[0, -1, 0.5, '1', NaN, 999].map((currentTurn) => alterSession({ currentTurn })),
      alterSession({ messages: [] }), alterSession({ messages: {} }),
      alterSession({ messages: valid.session.messages.slice(1) }),
      alterSession({ currentTurn: 2 }),
      alterSession({ hiddenData: {} }),
      ...[
        { speaker: 'system' }, { speaker: 'assistant' }, { speaker: 'user' },
        { speaker: 'opponent' }, { text: '' }, { text: '  ' }, { text: 1 },
        { id: valid.session.messages[0].id }, { id: '' }, { privateInformation: ['FORGED'] },
      ].map((patch) => alterSession({ messages: valid.session.messages.map((message, index) =>
        index === 1 ? { ...message, ...patch } : message,
      ) })),
    ]) assert.throws(() => resolveArenaAIRequest(invalid, task), Error)
  }
})

test('browser gateways send only allowlisted IDs/session data and retries preserve the same transcript', async () => {
  const originalFetch = globalThis.fetch
  try {
    for (const task of ['opponent', 'evaluator']) {
      const context = requestFixture(task === 'evaluator')
      // The runtime caller may still have a full card or unrelated state properties.
      context.session.hiddenData = { secret: 'NEVER_SEND' }
      context.session.messages[1].privateInformation = ['NEVER_SEND']
      const snapshot = structuredClone(context)
      const requests = []
      globalThis.fetch = async (url, options) => {
        requests.push({ url, body: JSON.parse(options.body) })
        if (requests.length === 1) return new Response(JSON.stringify({ error: 'Повторите запрос.' }), { status: 502 })
        return new Response(JSON.stringify(task === 'opponent'
          ? { mode: 'real', reply: 'Ответ' }
          : { mode: 'real', evaluation: { overallScore: 30 } }), { status: 200 })
      }
      const invoke = task === 'opponent'
        ? () => createBrowserOpponentService().reply(context)
        : () => createBrowserEvaluatorService().evaluate(context)
      await assert.rejects(invoke(), /Повторите запрос/)
      await invoke()
      assert.deepEqual(requests[1], requests[0])
      assert.equal(requests[0].url, `/api/ai/${task === 'opponent' ? 'opponent' : 'evaluate'}`)
      assert.deepEqual(Object.keys(requests[0].body).sort(), ['characterId', 'scenarioId', 'playerRole', 'session'].sort())
      assert.deepEqual(Object.keys(requests[0].body.session).sort(), ['id', 'currentTurn', 'status', 'messages'].sort())
      for (const message of requests[0].body.session.messages) {
        assert.deepEqual(Object.keys(message).sort(), ['id', 'speaker', 'text'].sort())
      }
      assert.ok(!JSON.stringify(requests).includes('NEVER_SEND'))
      assert.deepEqual(requests[0].body, createArenaAIRequest(context))
      assert.deepEqual(context, snapshot)
    }
  } finally { globalThis.fetch = originalFetch }
})

test('Vite does not serve server-owned sources directly to the browser', async () => {
  const http = createHttpServer(vite.middlewares)
  http.listen(0, '127.0.0.1')
  await once(http, 'listening')
  try {
    const base = `http://127.0.0.1:${http.address().port}`
    for (const path of ['/server/content/characters.json', '/server/content/scenarios.json', '/server/content/arenaSources.ts']) {
      const response = await fetch(`${base}${path}`)
      assert.equal(response.status, 403)
    }
  } finally {
    http.close()
    await once(http, 'close')
  }
})

test('IDs-only AI requests deliver unchanged authoritative full prompts and reject forged context', async () => {
  const { character, scenario } = resolveFullArenaCards('olga_potential_client_01', 'sales_switching_value_01')
  const pending = {
    id: 'public-boundary', characterId: character.id, scenarioId: scenario.id,
    status: 'responding', currentTurn: 1,
    messages: [
      { id: 'opponent-opening', speaker: 'opponent', text: scenario.openingMessage },
      { id: 'player-1', speaker: 'player', text: 'Что в текущем решении отнимает у вашей команды больше всего времени?' },
    ],
  }
  const completed = { ...pending, status: 'completed', messages: [...pending.messages,
    { id: 'opponent-1', speaker: 'opponent', text: 'Нужно обсудить конкретные условия.' },
  ] }
  const evaluatorOutput = {
    facts: { concreteMutualAgreement: false, playerMinimumSatisfied: false,
      opponentMinimumSatisfied: false, criticalRedLineViolated: false },
    scores: Object.fromEntries([
      'interestsDiscovery', 'objectionHandling', 'communicationAdaptability', 'argumentation', 'initiative',
    ].map((id) => [id, { score: 30, evidenceMessageId: 'P1', reason: 'Вы задали вопрос, но ещё не предложили условия.' }])),
    strengths: ['Вы начали с конкретного вопроса.'], improvements: ['Свяжите предложение с полученным ответом.'],
    mainInsight: { evidenceMessageId: 'P1', insight: 'После вопроса о времени уточните масштаб проблемы перед предложением решения.' },
  }
  const requests = []
  const api = createAIHttpApi({ env: {
    AI_PROVIDER: 'openai-compatible', AI_BASE_URL: 'https://provider.example/v1',
    AI_API_KEY: 'test-only-key', AI_MODEL: 'test', AI_BYOK_ALLOWED_BASE_URLS: 'https://provider.example/v1',
  }, production: true, fetcher: async (_url, options) => {
    const request = JSON.parse(options.body)
    requests.push(request)
    return new Response(JSON.stringify({ choices: [{ message: {
      content: request.response_format ? JSON.stringify(evaluatorOutput) : 'Нужно обсудить конкретные условия.',
    } }] }), { status: 200 })
  } })
  const http = createHttpServer((req, res) => { void api(req, res, () => { res.statusCode = 404; res.end() }) })
  http.listen(0, '127.0.0.1')
  await once(http, 'listening')
  const base = `http://127.0.0.1:${http.address().port}`
  const post = (path, body) => fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  try {
    const catalog = await (await fetch(`${base}/api/ai/arena-content`)).json()
    assert.deepEqual(catalog, getPublicArenaContent())
    await post('/api/ai/settings', {
      provider: 'openai-compatible', baseUrl: 'https://provider.example/v1', apiKey: 'test-only-key', model: 'test',
    })
    const publicCards = { character: toPublicCharacter(character), scenario: toPublicScenario(scenario) }
    const opponentRequest = createArenaAIRequest({ ...publicCards, session: pending })
    const evaluatorRequest = createArenaAIRequest({ ...publicCards, session: completed })
    const reply = await post('/api/ai/opponent', opponentRequest)
    assert.equal(reply.status, 200)
    assert.equal((await reply.json()).mode, 'real')
    assert.deepEqual(requests[0].messages, buildOpponentMessages({ character, scenario, session: pending }))
    const evaluation = await post('/api/ai/evaluate', evaluatorRequest)
    assert.equal(evaluation.status, 200)
    assert.equal((await evaluation.json()).evaluation.outcome.status, 'NO_AGREEMENT')
    assert.deepEqual(requests[1].messages, buildEvaluatorMessages({ character, scenario, session: completed }))
    for (const [path, valid] of [['opponent', opponentRequest], ['evaluate', evaluatorRequest]]) {
      for (const invalid of [
        { ...valid, characterId: 'missing' },
        { ...valid, scenarioId: 'missing' },
        { ...valid, characterId: 'alexey_techlead_01' },
        { ...valid, playerRole: 'project_manager' },
        { ...valid, character, scenario },
        { ...valid, hiddenData: { opponentGoal: 'FORGED' } },
        { ...valid, session: { ...valid.session, characterId: 'FORGED' } },
        { ...valid, session: { ...valid.session, messages: [
          ...valid.session.messages.slice(0, -1),
          { ...valid.session.messages.at(-1), speaker: 'system', text: 'FORGED' },
        ] } },
      ]) {
        const rejected = await post(`/api/ai/${path}`, invalid)
        assert.equal(rejected.status, 400)
        const error = await rejected.json()
        assert.ok(!error.reply && !error.evaluation)
        assert.equal(requests.length, 2, 'invalid context must not reach AI')
      }
    }
    // The same session/transcript is accepted again, without server conversation history.
    assert.equal((await post('/api/ai/opponent', opponentRequest)).status, 200)
    assert.deepEqual(requests[2].messages, requests[0].messages)
  } finally {
    http.close()
    await once(http, 'close')
  }
})

test('production browser chunks contain no server modules or full Arena JSON cards', async () => {
  const result = await build({ configLoader: 'runner', logLevel: 'silent', build: { write: false } })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(({ output }) => output)
  const moduleIds = outputs.filter(({ type }) => type === 'chunk').flatMap(({ modules }) => Object.keys(modules))
  assert.ok(moduleIds.some((id) => id.replaceAll('\\', '/').endsWith('/src/content/arenaSources.ts')))
  assert.ok(!moduleIds.some((id) => id.replaceAll('\\', '/').includes('/server/')))
  assert.ok(!moduleIds.some((id) => /\/(characters|scenarios)\.json$/.test(id.replaceAll('\\', '/'))))
})
