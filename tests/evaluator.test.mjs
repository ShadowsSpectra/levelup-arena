import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { once } from 'node:events'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

const vite = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await vite.close() })

const { parseArenaEvaluation } = await vite.ssrLoadModule('/server/ai/evaluatorResult.ts')
const { buildEvaluatorMessages, EVALUATOR_RULES } = await vite.ssrLoadModule('/server/ai/evaluatorPrompt.ts')
const { createAIEvaluatorService } = await vite.ssrLoadModule('/server/ai/createAIEvaluatorService.ts')
const { createAIHttpApi } = await vite.ssrLoadModule('/server/ai/aiHttpApi.ts')
const { ArenaResultView } = await vite.ssrLoadModule('/src/components/arena/ArenaResultView.tsx')

const character = {
  id: 'alexey-test', name: 'Алексей', role: 'Tech Lead', difficulty: 1,
  personality: ['calm'], communicationStyle: 'direct', cooperativeness: 'high', pressure: 'low',
  goal: 'Защитить качество', position: 'Полный объём рискован', interests: ['качество'],
  constraints: ['мало ресурсов'], privateInformation: ['секретный резерв в четверг'],
  redLines: ['не выпускать критические дефекты'], possibleConcessions: ['поэтапный запуск'],
  batna: 'Перенести релиз', behavior: ['ценит конкретику'],
}
const scenario = {
  id: 'release-test', title: 'Тестовый релиз', playerRole: 'product_manager', category: 'Сроки',
  recommendedLevel: 1, maxTurns: 10, openingMessage: 'Обсудим срок.', characterId: character.id,
  playerBrief: { situation: 'Нужен релиз.', playerGoal: 'Дать результат вовремя.', knownInformation: ['есть риск'] },
  hiddenData: { opponentGoal: 'скрытая цель качества', discoverableFacts: [
    { id: 'hidden', fact: 'скрытый модуль можно перенести' },
  ] },
  successConditions: {
    playerMinimumConditions: ['результат вовремя'], opponentMinimumConditions: ['качество'],
    agreementRequirements: ['конкретный план', 'обоюдное принятие'],
  },
  validAgreementPaths: ['MVP сейчас'], badAgreementExamples: ['релиз с дефектом'],
}
const session = {
  scenarioId: scenario.id, characterId: character.id, currentTurn: 2, status: 'completed',
  messages: [
    { id: 'o1', speaker: 'opponent', text: 'Полный объём рискован.' },
    { id: 'p1', speaker: 'player', text: 'Какие риски для команды сейчас самые важные?' },
    { id: 'o2', speaker: 'opponent', text: 'Нас беспокоит качество.' },
    { id: 'p2', speaker: 'player', text: 'Предлагаю согласовать MVP к пятнице, а остальное перенести.' },
  ],
}
const criterionIds = ['interestsDiscovery', 'objectionHandling', 'communicationAdaptability', 'argumentation', 'initiative']

function resultFor(type = 'SUCCESS') {
  const facts = {
    concreteMutualAgreement: type !== 'NO_AGREEMENT',
    playerMinimumSatisfied: type !== 'NO_AGREEMENT',
    opponentMinimumSatisfied: type === 'SUCCESS',
    criticalRedLineViolated: false,
  }
  return {
    facts,
    scores: Object.fromEntries(criterionIds.map((id, index) => [id, {
      score: 50 + index * 5,
      evidence: index % 2
        ? 'Предлагаю согласовать MVP к пятнице'
        : 'Какие риски для команды сейчас самые важные?',
      reason: `Краткая причина ${index + 1}`,
    }])),
    strengths: ['Уточнил интересы до предложения'],
    improvements: ['Явно подтвердить принятие плана обеими сторонами'],
    mainInsight: {
      evidence: 'Какие риски для команды сейчас самые важные?',
      insight: 'Вы выяснили риски команды перед предложением MVP; в следующих переговорах повторяйте эту последовательность: сначала уточните риск, затем предложите обмен.',
    },
  }
}

const context = { character, scenario, session }

test('application derives all three outcomes and bossDefeated from semantic facts', () => {
  for (const status of ['SUCCESS', 'NO_AGREEMENT', 'BAD_AGREEMENT']) {
    const raw = resultFor(status)
    assert.ok(!('outcome' in raw) && !('overallScore' in raw))
    const evaluated = parseArenaEvaluation(JSON.stringify(raw), context)
    assert.equal(evaluated.outcome.status, status)
    assert.equal(evaluated.outcome.bossDefeated, status === 'SUCCESS')
  }
  const redLine = resultFor()
  redLine.facts.criticalRedLineViolated = true
  assert.equal(parseArenaEvaluation(JSON.stringify(redLine), context).outcome.status, 'BAD_AGREEMENT')
  const playerMinimum = resultFor()
  playerMinimum.facts.playerMinimumSatisfied = false
  assert.equal(parseArenaEvaluation(JSON.stringify(playerMinimum), context).outcome.status, 'BAD_AGREEMENT')
  const noAgreement = resultFor()
  noAgreement.facts.concreteMutualAgreement = false
  assert.equal(parseArenaEvaluation(JSON.stringify(noAgreement), context).outcome.status, 'NO_AGREEMENT')
})

test('validator requires five scored criteria and exact player evidence; application derives overallScore', () => {
  const valid = parseArenaEvaluation(JSON.stringify(resultFor()), context)
  assert.deepEqual(Object.keys(valid.scores), criterionIds)
  assert.equal(valid.overallScore, 60)

  const missing = resultFor()
  delete missing.scores.initiative
  assert.throws(() => parseArenaEvaluation(JSON.stringify(missing), context), /exactly five/)

  const badEvidence = resultFor()
  badEvidence.scores.initiative.evidence = 'Нас беспокоит качество.'
  assert.throws(() => parseArenaEvaluation(JSON.stringify(badEvidence), context), /exact fragment from a player message/)

  const contradictory = resultFor()
  contradictory.outcome = { status: 'NO_AGREEMENT', bossDefeated: true }
  assert.throws(() => parseArenaEvaluation(JSON.stringify(contradictory), context), /invalid structure/)
  const inventedOverall = resultFor()
  inventedOverall.overallScore = 99
  assert.throws(() => parseArenaEvaluation(JSON.stringify(inventedOverall), context), /invalid structure/)

  const malformedFacts = resultFor()
  malformedFacts.facts.concreteMutualAgreement = 'yes'
  assert.throws(() => parseArenaEvaluation(JSON.stringify(malformedFacts), context), /Invalid semantic facts/)
})

test('criterion scores use the full 0–100 scale and small-scale responses are rejected', () => {
  for (const invalid of [-1, 101, 50.5, '75']) {
    const result = resultFor()
    result.scores.initiative.score = invalid
    assert.throws(() => parseArenaEvaluation(JSON.stringify(result), context), /Invalid scores.initiative.score/)
  }
  for (const smallScores of [[4, 4, 4, 4, 4], [2, 4, 6, 8, 10]]) {
    const result = resultFor()
    criterionIds.forEach((id, index) => { result.scores[id].score = smallScores[index] })
    assert.throws(() => parseArenaEvaluation(JSON.stringify(result), context), /1–5 or 1–10 scale/)
  }
  const fullScale = resultFor()
  const scores = [0, 25, 50, 75, 100]
  criterionIds.forEach((id, index) => { fullScale.scores[id].score = scores[index] })
  assert.equal(parseArenaEvaluation(JSON.stringify(fullScale), context).overallScore, 50)
})

test('user-facing prose normalizes role labels while Main Insight remains grounded and actionable', () => {
  const labelled = resultFor()
  labelled.scores.communicationAdaptability.reason = 'PLAYER сделал шаг к соглашению.'
  labelled.scores.initiative.reason = 'player активно выясняет интересы.'
  labelled.strengths = ['OPPONENT ответил на вопрос; user предложил обмен.']
  labelled.improvements = ["player's question стоило уточнить."]
  labelled.mainInsight.insight = 'USER спросил о рисках перед предложением MVP; в следующих переговорах повторяйте этот шаг.'
  const normalized = parseArenaEvaluation(JSON.stringify(labelled), context)
  assert.equal(normalized.scores.communicationAdaptability.reason, 'Вы сделали шаг к соглашению.')
  assert.equal(normalized.scores.initiative.reason, 'Вы активно выясняете интересы.')
  assert.equal(normalized.strengths[0], 'оппонент ответил на вопрос; Вы предложили обмен.')
  assert.equal(normalized.improvements[0], 'Ваш вопрос стоило уточнить.')
  assert.match(normalized.mainInsight.insight, /^Вы спросили/)
  assert.equal(normalized.scores.communicationAdaptability.evidence, labelled.scores.communicationAdaptability.evidence)

  const literalRoleQuoteContext = structuredClone(context)
  literalRoleQuoteContext.session.messages[1].text = 'PLAYER сделал предложение.'
  const literalRoleQuote = resultFor()
  for (const id of [criterionIds[0], criterionIds[2], criterionIds[4]]) {
    literalRoleQuote.scores[id].evidence = 'PLAYER сделал предложение.'
  }
  literalRoleQuote.mainInsight.evidence = 'PLAYER сделал предложение.'
  const exact = parseArenaEvaluation(JSON.stringify(literalRoleQuote), literalRoleQuoteContext)
  assert.equal(exact.scores.communicationAdaptability.evidence, 'PLAYER сделал предложение.')
  assert.equal(exact.mainInsight.evidence, 'PLAYER сделал предложение.')

  const generic = resultFor()
  generic.mainInsight.insight = 'Активное выяснение интересов и ограничений оппонента помогает найти взаимовыгодное решение.'
  assert.equal(parseArenaEvaluation(JSON.stringify(generic), context).mainInsight.insight, generic.mainInsight.insight)
  const extraFeedback = resultFor()
  extraFeedback.strengths = ['Первое', 'Второе', 'Третье', 'Четвёртое']
  assert.deepEqual(parseArenaEvaluation(JSON.stringify(extraFeedback), context).strengths,
    ['Первое', 'Второе', 'Третье'])

  const opponentEvidence = resultFor()
  opponentEvidence.mainInsight.evidence = 'Нас беспокоит качество.'
  assert.throws(() => parseArenaEvaluation(JSON.stringify(opponentEvidence), context), /mainInsight.evidence must be an exact fragment/)

  const malformed = resultFor()
  malformed.mainInsight = 'Старый текстовый формат'
  assert.throws(() => parseArenaEvaluation(JSON.stringify(malformed), context), /Invalid mainInsight structure/)

  const validated = normalized
  assert.equal(validated.mainInsight.evidence, session.messages[1].text)
  assert.ok(!validated.mainInsight.insight.includes(session.messages[1].text))
  const html = renderToStaticMarkup(React.createElement(ArenaResultView, {
    character, scenario, session, evaluation: { status: 'success', result: validated },
    onRetryEvaluation() {}, onTryAgain() {}, onBackToSelection() {}, onHome() {},
  }))
  assert.doesNotMatch(html, /\b(?:PLAYER|OPPONENT|assistant|user|system)\b/i)
  assert.ok(html.includes('Главный вывод'))
  assert.ok(html.includes(validated.mainInsight.insight))
  assert.ok(html.includes(`«${validated.mainInsight.evidence}»`))
  assert.ok(!html.includes('mainInsight.evidence'))
})

test('malformed output and leaked hidden information are rejected', () => {
  assert.throws(() => parseArenaEvaluation('not-json', context), /malformed JSON/)
  const leaked = resultFor()
  leaked.mainInsight.insight += ` Не раскрывайте: ${character.privateInformation[0]}`
  assert.throws(() => parseArenaEvaluation(JSON.stringify(leaked), context), /exposes hidden Arena data/)
})

test('Evaluator prompt receives full cards and transcript while keeping evaluator rules separate', () => {
  const messages = buildEvaluatorMessages(context)
  assert.equal(messages[0].role, 'system')
  for (const rule of ['concreteMutualAgreement', 'validAgreementPaths', 'communicationAdaptability',
    'точный фрагмент', 'Не раскрывай privateInformation',
    '0–100', '0–20', '21–40', '41–60', '61–80', '81–100',
    'mainInsight', 'Верни только JSON', 'Не добавляй HTML']) {
    assert.ok(EVALUATOR_RULES.includes(rule))
  }
  assert.doesNotMatch(EVALUATOR_RULES, /\b(?:overallScore|bossDefeated|status)\b/)
  assert.ok(EVALUATOR_RULES.length < 3500)
  for (const value of [character.privateInformation[0], scenario.hiddenData.opponentGoal,
    scenario.validAgreementPaths[0], session.messages[1].text, session.messages[3].text]) {
    assert.ok(messages[1].content.includes(value))
  }
})

test('Evaluator selects its own model and requests structured JSON independently of Opponent', async () => {
  const requests = []
  const service = createAIEvaluatorService({
    config: { serverEndpoint: '/api/ai/evaluate', models: {
      opponent: { provider: 'fake', model: 'roleplay-model' },
      evaluator: { provider: 'fake', model: 'judge-model', apiEndpoint: 'https://provider.test/v1' },
    } },
    providers: { fake: { async generate(request) {
      requests.push(request)
      return { content: JSON.stringify(resultFor()) }
    } } },
    createMessages: buildEvaluatorMessages,
    parseResult: parseArenaEvaluation,
  })
  assert.equal((await service.evaluate(context)).overallScore, 60)
  assert.equal(requests[0].model, 'judge-model')
  assert.equal(requests[0].responseFormat, 'json')
})

test('Result never renders hidden card data and exposes an explicit recoverable error state', () => {
  const baseProps = { character, scenario, session, onRetryEvaluation() {}, onTryAgain() {},
    onBackToSelection() {}, onHome() {} }
  const success = renderToStaticMarkup(React.createElement(ArenaResultView, {
    ...baseProps, evaluation: { status: 'success', result: parseArenaEvaluation(JSON.stringify(resultFor()), context) },
  }))
  assert.ok(success.includes('Разбор навыков'))
  assert.ok(!success.includes(character.privateInformation[0]))
  assert.ok(!success.includes(scenario.hiddenData.opponentGoal))

  const failure = renderToStaticMarkup(React.createElement(ArenaResultView, {
    ...baseProps, evaluation: { status: 'error', message: 'Ответ Evaluator не прошёл проверку.' },
  }))
  assert.ok(failure.includes('Повторить оценку'))
  assert.ok(failure.includes('диалог не потерян'))
  assert.ok(!failure.includes('Mock'))
})

test('failed real evaluation returns no fake result and can be retried with the same completed transcript', async () => {
  let evaluationCalls = 0
  const providerRequests = []
  const api = createAIHttpApi({ fetcher: async (_url, options) => {
    evaluationCalls += 1
    providerRequests.push(JSON.parse(options.body))
    const evaluation = resultFor()
    if (evaluationCalls === 1) evaluation.mainInsight.evidence = 'Нас беспокоит качество.'
    const content = JSON.stringify(evaluation)
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
  } })
  const httpServer = createHttpServer((req, res) => { void api(req, res, () => { res.statusCode = 404; res.end() }) })
  httpServer.listen(0, '127.0.0.1')
  await once(httpServer, 'listening')
  const address = httpServer.address()
  const base = `http://127.0.0.1:${address.port}`
  const post = (path, body) => fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const snapshot = structuredClone(context)
  try {
    assert.equal((await post('/api/ai/settings', {
      provider: 'openai-compatible', baseUrl: 'https://provider.test/v1', apiKey: 'not-a-real-key', model: 'test',
    })).status, 200)
    const failed = await post('/api/ai/evaluate', context)
    assert.equal(failed.status, 502)
    const failedBody = await failed.json()
    assert.equal(failedBody.stage, 'evaluator-validation')
    assert.ok(!('evaluation' in failedBody))
    assert.deepEqual(context, snapshot)

    const retried = await post('/api/ai/evaluate', context)
    assert.equal(retried.status, 200)
    assert.equal((await retried.json()).evaluation.overallScore, 60)
    assert.equal(evaluationCalls, 2)
    assert.deepEqual(providerRequests[1].messages, providerRequests[0].messages)
    assert.ok(providerRequests[1].messages[1].content.includes(session.messages[3].text))
    assert.ok(providerRequests[1].messages[1].content.includes(character.privateInformation[0]))
    assert.equal(context.session.status, 'completed')
    assert.deepEqual(context, snapshot)
  } finally {
    httpServer.close()
    await once(httpServer, 'close')
  }
})
