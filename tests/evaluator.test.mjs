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
const { getEvaluatorTranscript } = await vite.ssrLoadModule('/server/ai/evaluatorTranscript.ts')
const { createAIHttpApi: createTestAIHttpApi } = await vite.ssrLoadModule('/server/ai/aiHttpApi.ts')
const { createArenaAIRequest } = await vite.ssrLoadModule('/src/services/arenaAIRequest.ts')
const { ArenaResultView, ArenaTranscriptView, buildArenaShareText } = await vite.ssrLoadModule('/src/components/arena/ArenaResultView.tsx')
const { fullCharacterSource: localCharacterSource, fullScenarioSource: localScenarioSource } = await vite.ssrLoadModule('/server/content/arenaSources.ts')
const { getArenaOptions } = await vite.ssrLoadModule('/src/services/arenaCatalog.ts')

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
      evidenceMessageId: index % 2 ? 'P2' : 'P1',
      reason: `Краткая причина ${index + 1}`,
    }])),
    strengths: ['Уточнил интересы до предложения'],
    improvements: ['Явно подтвердить принятие плана обеими сторонами'],
    mainInsight: {
      evidenceMessageId: 'P1',
      insight: 'Вы выяснили риски команды перед предложением MVP; в следующих переговорах повторяйте эту последовательность: сначала уточните риск, затем предложите обмен.',
    },
  }
}

const context = { character, scenario, session }

function createAIHttpApi(options = {}) {
  return createTestAIHttpApi({ env: {
    AI_PROVIDER: 'openai-compatible', AI_BASE_URL: 'https://provider.test/v1',
    AI_API_KEY: 'not-a-real-key', AI_MODEL: 'test', AI_BYOK_ALLOWED_BASE_URLS: 'https://provider.test/v1',
  }, production: true, ...options, resolveCards(characterId, scenarioId) {
    assert.equal(characterId, character.id)
    assert.equal(scenarioId, scenario.id)
    return { character, scenario }
  } })
}

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

test('validator requires five scored criteria and real player evidence IDs; application derives overallScore', () => {
  const valid = parseArenaEvaluation(JSON.stringify(resultFor()), context)
  assert.deepEqual(Object.keys(valid.scores), criterionIds)
  assert.equal(valid.overallScore, 60)

  const missing = resultFor()
  delete missing.scores.initiative
  assert.throws(() => parseArenaEvaluation(JSON.stringify(missing), context), /exactly five/)

  const badEvidence = resultFor()
  badEvidence.scores.initiative.evidenceMessageId = 'O1'
  assert.throws(() => parseArenaEvaluation(JSON.stringify(badEvidence), context), /real player message ID/)

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

test('criterion scores are integers in 0–100, including legitimate low scores', () => {
  for (const invalid of [-1, 101, 50.5, '75']) {
    const result = resultFor()
    result.scores.initiative.score = invalid
    assert.throws(() => parseArenaEvaluation(JSON.stringify(result), context), /Invalid scores.initiative.score/)
  }
  const low = resultFor()
  const lowScores = [0, 5, 10, 5, 10]
  criterionIds.forEach((id, index) => { low.scores[id].score = lowScores[index] })
  const lowEvaluation = parseArenaEvaluation(JSON.stringify(low), context)
  assert.deepEqual(criterionIds.map((id) => lowEvaluation.scores[id].score), lowScores)
  assert.equal(lowEvaluation.overallScore, 6)
  const fullScale = resultFor()
  const scores = [0, 25, 50, 75, 100]
  criterionIds.forEach((id, index) => { fullScale.scores[id].score = scores[index] })
  assert.equal(parseArenaEvaluation(JSON.stringify(fullScale), context).overallScore, 50)
  const absent = resultFor()
  criterionIds.forEach((id) => { absent.scores[id].score = 0 })
  absent.strengths = []
  const absentEvaluation = parseArenaEvaluation(JSON.stringify(absent), context)
  assert.equal(absentEvaluation.overallScore, 0)
  assert.deepEqual(absentEvaluation.strengths, [])
  const strong = resultFor()
  criterionIds.forEach((id) => { strong.scores[id].score = 95 })
  strong.facts.playerMinimumSatisfied = false
  const strongBadAgreement = parseArenaEvaluation(JSON.stringify(strong), context)
  assert.equal(strongBadAgreement.overallScore, 95)
  assert.equal(strongBadAgreement.outcome.status, 'BAD_AGREEMENT')
  const weak = resultFor()
  criterionIds.forEach((id) => { weak.scores[id].score = 0 })
  assert.equal(parseArenaEvaluation(JSON.stringify(weak), context).outcome.status, 'SUCCESS')
})

test('player evidence IDs are stable by transcript order and resolve to untouched original messages', () => {
  const transcript = getEvaluatorTranscript(session)
  assert.deepEqual(transcript.map(({ speaker, evidenceMessageId }) => [speaker, evidenceMessageId]), [
    ['OPPONENT', undefined], ['PLAYER', 'P1'], ['OPPONENT', undefined], ['PLAYER', 'P2'],
  ])
  assert.deepEqual(getEvaluatorTranscript(structuredClone(session)), transcript)
  const result = parseArenaEvaluation(JSON.stringify(resultFor()), context)
  assert.equal(result.scores.interestsDiscovery.evidence, session.messages[1].text)
  assert.equal(result.scores.objectionHandling.evidence, session.messages[3].text)
  assert.equal(result.mainInsight.evidence, session.messages[1].text)
  for (const invalidId of ['P0', 'P3', 'O1', 'player-1', 'p1']) {
    const invalid = resultFor()
    invalid.scores.initiative.evidenceMessageId = invalidId
    assert.throws(() => parseArenaEvaluation(JSON.stringify(invalid), context), /real player message ID/)
  }
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
  assert.equal(normalized.scores.communicationAdaptability.evidence, session.messages[1].text)

  const literalRoleQuoteContext = structuredClone(context)
  literalRoleQuoteContext.session.messages[1].text = 'ПLAYER сделал предложение.'
  const literalRoleQuote = resultFor()
  literalRoleQuote.scores.communicationAdaptability.reason = 'Игрок сделал шаг к соглашению.'
  literalRoleQuote.scores.initiative.reason = 'ПLAYER проигнорировал ограничение.'
  const exact = parseArenaEvaluation(JSON.stringify(literalRoleQuote), literalRoleQuoteContext)
  assert.equal(exact.scores.communicationAdaptability.evidence, 'ПLAYER сделал предложение.')
  assert.equal(exact.mainInsight.evidence, 'ПLAYER сделал предложение.')
  assert.equal(exact.scores.communicationAdaptability.reason, 'Вы сделали шаг к соглашению.')
  assert.equal(exact.scores.initiative.reason, 'Вы проигнорировали ограничение.')

  const generic = resultFor()
  generic.mainInsight.insight = 'Активное выяснение интересов и ограничений оппонента помогает найти взаимовыгодное решение.'
  assert.equal(parseArenaEvaluation(JSON.stringify(generic), context).mainInsight.insight, generic.mainInsight.insight)
  const extraFeedback = resultFor()
  extraFeedback.strengths = ['Первое', 'Второе', 'Третье', 'Четвёртое']
  assert.deepEqual(parseArenaEvaluation(JSON.stringify(extraFeedback), context).strengths,
    ['Первое', 'Второе', 'Третье'])

  const opponentEvidence = resultFor()
  opponentEvidence.mainInsight.evidenceMessageId = 'O1'
  assert.throws(() => parseArenaEvaluation(JSON.stringify(opponentEvidence), context), /mainInsight.evidenceMessageId must reference a real player message ID/)

  const malformed = resultFor()
  malformed.mainInsight = 'Старый текстовый формат'
  assert.throws(() => parseArenaEvaluation(JSON.stringify(malformed), context), /Invalid mainInsight structure/)

  const validated = normalized
  assert.equal(validated.mainInsight.evidence, session.messages[1].text)
  assert.ok(!validated.mainInsight.insight.includes(session.messages[1].text))
  const html = renderToStaticMarkup(React.createElement(ArenaResultView, {
    character, scenario, session, evaluation: { status: 'success', result: validated,
      award: { xpEarned: 50, bossDefeated: true } },
    onRetryEvaluation() {}, onOpenAISettings() {}, onTryAgain() {}, onBackToSelection() {}, onHome() {},
  }))
  assert.doesNotMatch(html, /\b(?:PLAYER|OPPONENT|assistant|user|system)\b/i)
  assert.ok(html.includes('Главный вывод'))
  assert.ok(html.includes(validated.mainInsight.insight))
  assert.ok(html.includes(`«${validated.mainInsight.evidence}»`))
  assert.ok(html.includes('Посмотреть переговоры'))
  assert.ok(!html.includes('evidenceMessageId'))
})

test('feedback fixes common second-person agreement without changing transcript evidence', () => {
  const malformedGrammar = resultFor()
  const samples = [
    ['Вы не выявил потребность.', 'Вы не выявили потребность.'],
    ['Вы спрашивает о цене.', 'Вы спрашиваете о цене.'],
    ['Вы предлагает скидку.', 'Вы предлагаете скидку.'],
    ['Вы адаптирует подход.', 'Вы адаптируете подход.'],
    ['Вы обосновывает цену.', 'Вы обосновываете цену.'],
  ]
  criterionIds.forEach((id, index) => { malformedGrammar.scores[id].reason = samples[index][0] })
  malformedGrammar.strengths = ['Вы активно исследовал интересы.']
  malformedGrammar.improvements = ['Вы проявил нетерпение.']
  const checked = parseArenaEvaluation(JSON.stringify(malformedGrammar), context)
  criterionIds.forEach((id, index) => assert.equal(checked.scores[id].reason, samples[index][1]))
  assert.deepEqual(checked.strengths, ['Вы активно исследовали интересы.'])
  assert.deepEqual(checked.improvements, ['Вы проявили нетерпение.'])
  assert.equal(checked.scores.interestsDiscovery.evidence, session.messages[1].text)

  const moreGrammar = resultFor()
  const pastForms = [
    ['Вы не обработал возражение.', 'Вы не обработали возражение.'],
    ['Вы не адаптировал подход.', 'Вы не адаптировали подход.'],
    ['Вы не предоставил основания.', 'Вы не предоставили основания.'],
    ['Вы не продвинулся к решению.', 'Вы не продвинулись к решению.'],
    ['Вы не углубил вопрос.', 'Вы не углубили вопрос.'],
  ]
  criterionIds.forEach((id, index) => { moreGrammar.scores[id].reason = pastForms[index][0] })
  moreGrammar.improvements = ['Вы не связал проблему с проверкой пользы.']
  const grammatical = parseArenaEvaluation(JSON.stringify(moreGrammar), context)
  criterionIds.forEach((id, index) => assert.equal(grammatical.scores[id].reason, pastForms[index][1]))
  assert.deepEqual(grammatical.improvements, ['Вы не связали проблему с проверкой пользы.'])
  assert.equal(grammatical.scores.argumentation.evidence, session.messages[3].text)

  const recurring = resultFor()
  const recurringForms = [
    ['Вы должен уточнить интересы.', 'Вы должны уточнить интересы.'],
    ['Вы не предложил обмен.', 'Вы не предложили обмен.'],
    ['Вы не обработал возражение.', 'Вы не обработали возражение.'],
    ['Вы не адаптировал подход.', 'Вы не адаптировали подход.'],
    ['Вы не продвинулся к плану.', 'Вы не продвинулись к плану.'],
  ]
  criterionIds.forEach((id, index) => { recurring.scores[id].reason = recurringForms[index][0] })
  recurring.improvements = ['Вы не пытается выяснить причину.', 'Вы пытался уточнить сроки.']
  const polished = parseArenaEvaluation(JSON.stringify(recurring), context)
  criterionIds.forEach((id, index) => assert.equal(polished.scores[id].reason, recurringForms[index][1]))
  assert.deepEqual(polished.improvements, ['Вы не пытаетесь выяснить причину.', 'Вы пытались уточнить сроки.'])
  assert.equal(polished.scores.communicationAdaptability.evidence, session.messages[1].text)
})

test('feedback corrects live выяснял/обосновал forms without rewriting evidence', () => {
  const output = resultFor()
  output.scores.interestsDiscovery.reason = 'Вы активно выяснял причины.'
  output.scores.argumentation.reason = 'Вы обосновал своё предложение.'
  output.strengths = ['Вы активно выяснял причины.']
  output.mainInsight.insight = 'Вы обосновал своё предложение; повторите этот подход.'
  const result = parseArenaEvaluation(JSON.stringify(output), context)
  assert.equal(result.scores.interestsDiscovery.reason, 'Вы активно выясняли причины.')
  assert.equal(result.scores.argumentation.reason, 'Вы обосновали своё предложение.')
  assert.deepEqual(result.strengths, ['Вы активно выясняли причины.'])
  assert.equal(result.mainInsight.insight, 'Вы обосновали своё предложение; повторите этот подход.')
  assert.equal(result.scores.interestsDiscovery.evidence, session.messages[1].text)
  assert.equal(result.scores.argumentation.evidence, session.messages[3].text)
})

test('Olga trajectories keep later meaningful skill evidence available without inflating bad play', async () => {
  const [olga] = await getArenaOptions('sales_manager', localCharacterSource, localScenarioSource)
  const positive = { id: 'olga-positive', scenarioId: olga.scenario.id,
    characterId: olga.character.id, currentTurn: 5, status: 'completed', messages: [
      { id: 'o0', speaker: 'opponent', text: olga.scenario.openingMessage },
      { id: 'p1', speaker: 'player', text: 'Что в текущем решении отнимает у команды больше всего времени?' },
      { id: 'o1', speaker: 'opponent', text: 'Много времени уходит на ручные операции.' },
      { id: 'p2', speaker: 'player', text: 'Что сложнее: ручные операции или сбор данных для отчётов?' },
      { id: 'o2', speaker: 'opponent', text: 'Сбор данных для отчётов отнимает больше всего времени.' },
      { id: 'p3', speaker: 'player', text: 'Вместо полной миграции предлагаю небольшой пилот.' },
      { id: 'o3', speaker: 'opponent', text: 'Как он поможет с нашей отчётностью?' },
      { id: 'p4', speaker: 'player', text: 'Мы автоматизируем сбор данных.' },
      { id: 'o4', speaker: 'opponent', text: 'Покажите это на нашем рабочем процессе.' },
      { id: 'p5', speaker: 'player', text: 'Возьмём один реальный отчёт, сравним время сбора до и после пилота; если будет экономия, обсудим дальнейшее внедрение.' },
      { id: 'o5', speaker: 'opponent', text: 'Согласна, давайте назначим демонстрацию.' },
    ] }
  const positiveMessages = buildEvaluatorMessages({ ...olga, session: positive })
  const positivePayload = JSON.parse(positiveMessages[1].content.slice(positiveMessages[1].content.indexOf('{')))
  assert.deepEqual(positivePayload.transcript.filter(({ speaker }) => speaker === 'PLAYER')
    .map(({ evidenceMessageId }) => evidenceMessageId), ['P1', 'P2', 'P3', 'P4', 'P5'])
  assert.equal(positivePayload.transcript[9].text, positive.messages[9].text)
  for (const guidance of ['ВСЕ реплики PLAYER', 'Учитывай позднее улучшение',
    'одна сильная финальная фраза не стирает устойчивые ошибки', 'не повторяй P1 механически',
    'уточнений, ведущих к конкретной потребности', 'выяснение причины, снижение риска',
    'изменение предложения/шага', 'проблема → проверка/причина → измеримая ценность → решение',
    'проверка на реальной задаче с критерием']) {
    assert.ok(positiveMessages[0].content.includes(guidance), guidance)
  }
  assert.doesNotMatch(positiveMessages[0].content, /"score":45|"evidenceMessageId":"P1"/)
  const laterEvidence = resultFor()
  laterEvidence.scores.interestsDiscovery.evidenceMessageId = 'P2'
  laterEvidence.scores.objectionHandling.evidenceMessageId = 'P3'
  laterEvidence.scores.communicationAdaptability.evidenceMessageId = 'P5'
  laterEvidence.scores.argumentation.evidenceMessageId = 'P5'
  laterEvidence.scores.initiative.evidenceMessageId = 'P5'
  const accepted = parseArenaEvaluation(JSON.stringify(laterEvidence), { ...olga, session: positive })
  assert.equal(accepted.scores.argumentation.evidence, positive.messages[9].text)
  assert.equal(accepted.scores.interestsDiscovery.evidence, positive.messages[3].text)

  const negative = structuredClone(positive)
  negative.messages = [
    positive.messages[0],
    { id: 'bad1', speaker: 'player', text: 'Наш продукт лучше. Переходите.' },
    { id: 'bad2', speaker: 'player', text: 'Потому что он современнее и удобнее. Тут нечего обсуждать.' },
    { id: 'bad3', speaker: 'player', text: 'Бла бла бла.' },
    { id: 'bad4', speaker: 'player', text: 'Будете переходить или нет?' },
  ]
  negative.currentTurn = 4
  const negativeMessages = buildEvaluatorMessages({ ...olga, session: negative })
  for (const rule of ['Бессмыслица', 'Оскорбления', 'Оцени качество действия',
    '0 и 90+ допустимы']) assert.ok(negativeMessages[0].content.includes(rule))
  const inflated = resultFor()
  inflated.scores.argumentation.score = 70
  inflated.scores.argumentation.evidenceMessageId = 'P3'
  assert.throws(() => parseArenaEvaluation(JSON.stringify(inflated), { ...olga, session: negative }),
    /does not support a good argumentation score/)
  const calibrated = resultFor()
  criterionIds.forEach((id) => { calibrated.scores[id].score = 0 })
  calibrated.strengths = []
  assert.equal(parseArenaEvaluation(JSON.stringify(calibrated), { ...olga, session: negative }).overallScore, 0)
})

test('Evaluator context preserves proposal ownership and seller reciprocity facts', async () => {
  const [, maksim] = await getArenaOptions('sales_manager', localCharacterSource, localScenarioSource)
  const negotiation = { id: 'attribution-case', scenarioId: maksim.scenario.id,
    characterId: maksim.character.id, currentTurn: 2, status: 'completed', messages: [
      { id: 'o1', speaker: 'opponent', text: maksim.scenario.openingMessage },
      { id: 'p1', speaker: 'player', text: 'Снижаем цену и включаем внедрение с поддержкой без встречных обязательств.' },
      { id: 'o2', speaker: 'opponent', text: 'Можете ли вы согласовать годовой договор с возможностью продления?' },
      { id: 'p2', speaker: 'player', text: 'Да.' },
    ] }
  const messages = buildEvaluatorMessages({ ...maksim, session: negotiation })
  const payload = JSON.parse(messages[1].content.slice(messages[1].content.indexOf('{')))
  assert.deepEqual(payload.transcript.map(({ speaker, evidenceMessageId }) => [speaker, evidenceMessageId]), [
    ['OPPONENT', undefined], ['PLAYER', 'P1'], ['OPPONENT', undefined], ['PLAYER', 'P2'],
  ])
  assert.equal(payload.transcript[2].text, negotiation.messages[2].text)
  assert.equal(payload.transcript[3].text, 'Да.')
  assert.ok(messages[1].content.includes(maksim.scenario.successConditions.playerMinimumConditions[0]))
  for (const instruction of ['автора каждого условия', 'Принятие не означает авторство',
    'не совпадение слов с validAgreementPaths', 'Покупка на подаренных продавцом условиях',
    'Явный отказ от встречных обязательств', '«Да» на предложение оппонента не доказывает']) {
    assert.ok(messages[0].content.includes(instruction), instruction)
  }
  const acceptedOnly = resultFor()
  acceptedOnly.facts.playerMinimumSatisfied = false
  acceptedOnly.scores.initiative.score = 0
  acceptedOnly.scores.initiative.evidenceMessageId = 'P2'
  acceptedOnly.scores.initiative.reason = 'Вы лишь приняли предложение оппонента, не предложив встречного условия.'
  const evaluated = parseArenaEvaluation(JSON.stringify(acceptedOnly), { ...maksim, session: negotiation })
  assert.equal(evaluated.scores.initiative.evidence, 'Да.')
  assert.equal(evaluated.outcome.status, 'BAD_AGREEMENT')
  assert.equal(evaluated.outcome.bossDefeated, false)

  const falselyCredited = structuredClone(acceptedOnly)
  falselyCredited.scores.initiative.score = 55
  falselyCredited.scores.initiative.reason = 'Вы предложили годовой договор с продлением.'
  assert.throws(() => parseArenaEvaluation(JSON.stringify(falselyCredited), { ...maksim, session: negotiation }),
    /does not support claimed player initiative/)
})

test('repeated filler cannot substantiate good argumentation, but low score remains valid', () => {
  const fillerContext = structuredClone(context)
  fillerContext.session.messages[1].text = 'бла бла бла'
  const inflated = resultFor()
  inflated.scores.argumentation.evidenceMessageId = 'P1'
  inflated.scores.argumentation.score = 70
  inflated.scores.argumentation.reason = 'Вы обосновали ценность решения.'
  assert.throws(() => parseArenaEvaluation(JSON.stringify(inflated), fillerContext),
    /does not support a good argumentation score/)
  inflated.scores.argumentation.score = 0
  inflated.scores.argumentation.reason = 'Вы не привели содержательного довода.'
  assert.equal(parseArenaEvaluation(JSON.stringify(inflated), fillerContext).scores.argumentation.score, 0)
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
    'evidenceMessageId', 'Не раскрывай privateInformation',
    '0–100', '0 —', '1–20', '21–40', '41–60', '61–80', '81–100',
    'не оценивай как средний', 'Evidence должен подтверждать',
    'Бессмыслица', 'Оскорбления', 'strengths — 0–3',
    'mainInsight', 'Верни только JSON', 'без HTML']) {
    assert.ok(EVALUATOR_RULES.includes(rule))
  }
  assert.doesNotMatch(EVALUATOR_RULES, /\b(?:overallScore|bossDefeated|status)\b/)
  assert.ok(EVALUATOR_RULES.length < 4500)
  for (const value of [character.privateInformation[0], scenario.hiddenData.opponentGoal,
    scenario.validAgreementPaths[0], session.messages[1].text, session.messages[3].text]) {
    assert.ok(messages[1].content.includes(value))
  }
  const payload = JSON.parse(messages[1].content.slice(messages[1].content.indexOf('{')))
  assert.equal(payload.transcript[1].evidenceMessageId, 'P1')
  assert.equal(payload.transcript[3].evidenceMessageId, 'P2')
  assert.ok(!('evidenceMessageId' in payload.transcript[0]))
  assert.ok(!('evidence' in resultFor().scores.interestsDiscovery))
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
  const baseProps = { character, scenario, session, onRetryEvaluation() {}, onOpenAISettings() {}, onTryAgain() {},
    onBackToSelection() {}, onHome() {} }
  const success = renderToStaticMarkup(React.createElement(ArenaResultView, {
    ...baseProps, evaluation: { status: 'success', result: parseArenaEvaluation(JSON.stringify(resultFor()), context),
      award: { xpEarned: 50, bossDefeated: true } },
  }))
  assert.ok(success.includes('Разбор навыков'))
  assert.ok(success.includes('Получено XP:'))
  assert.ok(success.includes('<strong>50</strong>'))
  assert.ok(success.includes('Оппонент побеждён'))
  assert.ok(!success.includes(character.privateInformation[0]))
  assert.ok(!success.includes(scenario.hiddenData.opponentGoal))

  const noAgreement = renderToStaticMarkup(React.createElement(ArenaResultView, {
    ...baseProps, evaluation: { status: 'success', result: parseArenaEvaluation(JSON.stringify(resultFor()), context),
      award: { xpEarned: 0, bossDefeated: false } },
  }))
  assert.ok(noAgreement.includes('Получено XP:'))
  assert.ok(noAgreement.includes('<strong>0</strong>'))
  assert.ok(noAgreement.includes('Оппонент пока не побеждён'))

  const failure = renderToStaticMarkup(React.createElement(ArenaResultView, {
    ...baseProps, evaluation: { status: 'error', message: 'Ответ Evaluator не прошёл проверку.' },
  }))
  assert.ok(failure.includes('Повторить оценку'))
  assert.ok(failure.includes('AI Settings'))
  assert.ok(failure.includes('диалог не потерян'))
  assert.ok(!failure.includes('Mock'))

  const loading = renderToStaticMarkup(React.createElement(ArenaResultView, {
    ...baseProps, evaluation: { status: 'loading' },
  }))
  assert.ok(loading.includes('arena-evaluation-loader'))
  assert.ok(loading.includes('Формируем разбор переговоров'))
})

test('completed Arena transcript is available as a read-only view of the preserved session messages', () => {
  const html = renderToStaticMarkup(React.createElement(ArenaTranscriptView, {
    character, scenario, session, onBack() {},
  }))
  assert.ok(html.includes('arena-transcript-header'))
  assert.ok(html.includes('← Вернуться к результату'))
  assert.ok(html.includes('arena-message-opponent'))
  assert.ok(html.includes('arena-message-player'))
  assert.ok(html.includes(session.messages[0].text))
  assert.ok(html.includes(session.messages[1].text))
  assert.ok(!html.includes('<textarea'))
  assert.ok(!html.includes('Отправить'))
})

test('Result gives each deterministic outcome its own clear visual state', () => {
  const baseProps = { character, scenario, session, onRetryEvaluation() {}, onOpenAISettings() {}, onTryAgain() {},
    onBackToSelection() {}, onHome() {} }
  const cases = [
    ['SUCCESS', 'arena-outcome-success', 'Успешное соглашение', 50, true],
    ['BAD_AGREEMENT', 'arena-outcome-bad_agreement', 'Соглашение достигнуто, но требует пересмотра', 0, false],
    ['NO_AGREEMENT', 'arena-outcome-no_agreement', 'Соглашение не достигнуто', 0, false],
  ]
  for (const [status, className, label, xpEarned, bossDefeated] of cases) {
    const result = parseArenaEvaluation(JSON.stringify(resultFor(status)), context)
    const html = renderToStaticMarkup(React.createElement(ArenaResultView, {
      ...baseProps, evaluation: { status: 'success', result, award: { xpEarned, bossDefeated } },
    }))
    assert.ok(html.includes(className))
    assert.ok(html.includes(label))
    assert.ok(html.includes(`Получено XP: <strong>${xpEarned}</strong>`))
    assert.equal((html.match(/secondary-action-button/g) ?? []).length, 1)
    assert.ok(html.includes('result-navigation'))
    assert.ok(html.includes('Поделиться результатом'))
  }
})

test('share text uses public result fields and never includes hidden card data', () => {
  const result = parseArenaEvaluation(JSON.stringify(resultFor('SUCCESS')), context)
  const text = buildArenaShareText('Product Manager', character.name, result)
  assert.match(text, /LevelUP Arena · Product Manager/)
  assert.match(text, /Оппонент: Алексей/)
  assert.match(text, /Успешное соглашение · 60 из 100/)
  assert.ok(!text.includes(character.privateInformation[0]))
  assert.ok(!text.includes(scenario.hiddenData.opponentGoal))
})

test('failed real evaluation returns no fake result and can be retried with the same completed transcript', async () => {
  let evaluationCalls = 0
  const providerRequests = []
  const api = createAIHttpApi({ fetcher: async (_url, options) => {
    evaluationCalls += 1
    providerRequests.push(JSON.parse(options.body))
    const evaluation = resultFor()
    if (evaluationCalls === 1) evaluation.mainInsight.evidenceMessageId = 'O1'
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
  const request = createArenaAIRequest({ ...context, session: {
    ...session, id: 'evaluation-retry', messages: [...session.messages,
      { id: 'o3', speaker: 'opponent', text: 'Согласен на предложенный план.' },
    ],
  } })
  const requestSnapshot = structuredClone(request)
  try {
    assert.equal((await post('/api/ai/settings', {
      provider: 'openai-compatible', baseUrl: 'https://provider.test/v1', apiKey: 'not-a-real-key', model: 'test',
    })).status, 405)
    const failed = await post('/api/ai/evaluate', request)
    assert.equal(failed.status, 502)
    const failedBody = await failed.json()
    assert.equal(failedBody.stage, 'evaluator-validation')
    assert.ok(!('evaluation' in failedBody))
    assert.deepEqual(context, snapshot)

    const retried = await post('/api/ai/evaluate', request)
    assert.equal(retried.status, 200)
    assert.equal((await retried.json()).evaluation.overallScore, 60)
    assert.equal(evaluationCalls, 2)
    assert.deepEqual(providerRequests[1].messages, providerRequests[0].messages)
    assert.ok(providerRequests[1].messages[1].content.includes(session.messages[3].text))
    assert.ok(providerRequests[1].messages[1].content.includes('"evidenceMessageId":"P2"'))
    assert.ok(providerRequests[1].messages[1].content.includes(character.privateInformation[0]))
    assert.equal(context.session.status, 'completed')
    assert.deepEqual(context, snapshot)
    assert.deepEqual(request, requestSnapshot)
  } finally {
    httpServer.close()
    await once(httpServer, 'close')
  }
})
