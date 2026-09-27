import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await server.close() })

const { fullCharacterSource: localCharacterSource, fullScenarioSource: localScenarioSource } = await server.ssrLoadModule('/server/content/arenaSources.ts')
const { getArenaOptions } = await server.ssrLoadModule('/src/services/arenaCatalog.ts')
const { getCharacterPublicProfile } = await server.ssrLoadModule('/src/services/characterProfile.ts')
const { createArenaSession, addPlayerMessage, addOpponentReply, endArenaSession } =
  await server.ssrLoadModule('/src/services/arenaSession.ts')
const { getNaturalEndingSuggestion } = await server.ssrLoadModule('/src/services/naturalEnding.ts')
const { applyArenaEvaluation, createInitialProgression, getRoleProgress, isBossUnlocked } =
  await server.ssrLoadModule('/src/services/progression.ts')
const { buildOpponentMessages } = await server.ssrLoadModule('/server/ai/opponentPrompt.ts')
const { buildEvaluatorMessages } = await server.ssrLoadModule('/server/ai/evaluatorPrompt.ts')
const { deriveArenaOutcome } = await server.ssrLoadModule('/server/ai/evaluatorResult.ts')

async function salesBosses() {
  return getArenaOptions('sales_manager', localCharacterSource, localScenarioSource)
}

test('Sales cards load in order through generic sources with complete evaluation conditions', async () => {
  const [olga, maksim] = await salesBosses()
  assert.equal(olga.character.name, 'Ольга')
  assert.equal(olga.character.role, 'Potential Client')
  assert.equal(olga.character.difficulty, 1)
  assert.equal(olga.character.cooperativeness, 'high')
  assert.equal(olga.character.pressure, 'low')
  assert.equal(olga.scenario.title, 'Зачем нам что-то менять?')
  assert.equal(maksim.character.name, 'Максим')
  assert.equal(maksim.character.role, 'Procurement Manager')
  assert.equal(maksim.character.difficulty, 2)
  assert.equal(maksim.character.cooperativeness, 'medium')
  assert.equal(maksim.character.pressure, 'medium')
  assert.equal(maksim.scenario.title, 'У конкурента дешевле')
  assert.deepEqual(maksim.character.unlockRequirements,
    { minLevel: 2, previousBossId: olga.character.id })
  for (const { character, scenario } of [olga, maksim]) {
    assert.equal(scenario.playerRole, 'sales_manager')
    assert.equal(scenario.characterId, character.id)
    assert.ok(scenario.openingMessage.trim())
    assert.ok(scenario.maxTurns > 0)
    for (const field of ['goal', 'position', 'batna']) assert.ok(character[field].trim(), field)
    for (const field of ['interests', 'constraints', 'privateInformation', 'redLines', 'possibleConcessions', 'behavior']) {
      assert.ok(character[field].length >= 3, field)
    }
    assert.ok(scenario.hiddenData.discoverableFacts.length >= 4)
    assert.equal(new Set(scenario.hiddenData.discoverableFacts.map(({ id }) => id)).size,
      scenario.hiddenData.discoverableFacts.length)
    for (const field of ['playerMinimumConditions', 'opponentMinimumConditions', 'agreementRequirements']) {
      assert.ok(scenario.successConditions[field].length >= 2, field)
    }
    assert.ok(scenario.validAgreementPaths.length >= 3)
    assert.ok(scenario.badAgreementExamples.length >= 4)
  }
})

test('Olga speaks as an ordinary client while Maksim keeps his commercial voice', async () => {
  const [olga, maksim] = await salesBosses()
  const voice = olga.character.behavior.join(' ')
  assert.match(voice, /обычный деловой клиент/)
  assert.match(voice, /повседневные симптомы/)
  assert.match(voice, /не формулирует за игрока потребность/)
  assert.match(voice, /не подсказывает игроку, как вести продажу/)
  assert.match(voice, /впечатляющие цифры без связи/)
  assert.match(voice, /конкретную безопасную проверку/)
  assert.match(maksim.character.behavior.join(' '), /опорой на цифры и условия/)
  assert.match(maksim.character.behavior.join(' '), /различает уступки сторон/)
  const session = createArenaSession(olga.scenario.id, olga.character.id, olga.scenario.openingMessage)
  const prompt = buildOpponentMessages({ character: olga.character, scenario: olga.scenario, session })[0].content
  for (const instruction of olga.character.behavior) assert.ok(prompt.includes(instruction))
})

test('Maksim owns buyer concessions and does not rescue an unconditional seller giveaway', async () => {
  const [, { character, scenario }] = await salesBosses()
  const behavior = character.behavior.join(' ')
  assert.match(behavior, /скидку, бесплатное внедрение, поддержку и SLA предоставляет продавец-игрок/)
  assert.match(behavior, /годовой договор, предоплату и согласие на сокращённый пакет может предоставить Максим как покупатель/)
  assert.match(behavior, /не предлагает по собственной инициативе обязательства покупателя ради спасения экономики продавца/)
  assert.match(behavior, /если игрок явно отказывается от встречных обязательств/)
  assert.match(behavior, /условия обмена должен запросить и согласовать сам игрок/)
  assert.match(behavior, /принимает конкретное выгодное ему предложение/)
  assert.match(behavior, /может запросить дополнительные условия, пока существенные интересы или ограничения покупателя остаются нерешёнными/)
  assert.match(behavior, /окончательные условия и просит принять или отклонить их/)
  assert.match(behavior, /либо принимает, либо называет конкретное существенное нерешённое препятствие/)
  assert.match(behavior, /не придумывает новые расчёты, сравнения, гарантии, согласования или требования только для продолжения торга/)
  assert.match(behavior, /сохранение коммерческой выгоды продавца не является условием принятия для покупателя/)

  const buyerConcessions = character.possibleConcessions.join(' ')
  for (const path of [/годовой договор/, /предоплату/, /сокращённый пакет/]) {
    assert.match(buyerConcessions, path)
  }
  const validPaths = scenario.validAgreementPaths.join(' ')
  for (const path of [/скидка.*годовой договор/, /скидка.*предоплату/,
    /сокращённый пакет.*меньшей цене/, /сохранение цены.*поддержки/]) {
    assert.match(validPaths, path)
  }
  const session = addPlayerMessage(createArenaSession(scenario.id, character.id, scenario.openingMessage),
    'Предлагаю большую скидку и бесплатную поддержку. Встречных обязательств не требуется.', scenario.maxTurns)
  const messages = buildOpponentMessages({ character, scenario, session })
  for (const rule of character.behavior) assert.ok(messages[0].content.includes(rule))
  assert.equal(messages.at(-1).content, session.messages.at(-1).text)
})

test('Maksim seller minimum requires reciprocal commercial value, not buyer acceptance alone', async () => {
  const [, { scenario, character }] = await salesBosses()
  const minimum = scenario.successConditions.playerMinimumConditions.join(' ')
  assert.match(minimum, /существенная скидка/)
  assert.match(minimum, /внедрению, поддержке или SLA/)
  assert.match(minimum, /встречной коммерческой ценности/)
  assert.match(minimum, /согласие покупателя подписать договор.*не считается встречной ценностью/)
  assert.match(minimum, /сокращении пакета\/объёма/)
  assert.match(minimum, /сохранении экономически оправданной полной цены/)

  const paths = scenario.validAgreementPaths.join(' ')
  for (const path of [/скидка.*годовой договор/, /скидка.*предоплату/,
    /сокращённый пакет.*меньшей цене/, /сохранение цены.*поддержки/]) {
    assert.match(paths, path)
  }
  const conceded = addPlayerMessage(createArenaSession(scenario.id, character.id, scenario.openingMessage),
    'Предлагаю существенную скидку, бесплатные внедрение, поддержку и SLA. Встречных обязательств от вас не требуется.',
    scenario.maxTurns)
  const session = endArenaSession(addOpponentReply(conceded,
    'Согласен, подписываем договор на этих условиях.', scenario.maxTurns))
  const evaluatorContext = buildEvaluatorMessages({ character, scenario, session })[1].content
  for (const condition of scenario.successConditions.playerMinimumConditions) {
    assert.ok(evaluatorContext.includes(condition))
  }
  assert.match(evaluatorContext, /Встречных обязательств от вас не требуется/)
  assert.match(evaluatorContext, /Согласен, подписываем договор/)

  // Semantic fact for the live class of deal: substantial unconditional seller concessions,
  // no buyer commitment or compensating value beyond accepting the free terms.
  const outcome = deriveArenaOutcome({ concreteMutualAgreement: true,
    playerMinimumSatisfied: false, opponentMinimumSatisfied: true, criticalRedLineViolated: false })
  assert.deepEqual(outcome, { status: 'BAD_AGREEMENT', bossDefeated: false })
  const award = applyArenaEvaluation(createInitialProgression(), 'sales_manager', session,
    { outcome, overallScore: 85 }).award
  assert.equal(award.xpEarned, 0)
})

test('Olga is immediately available; Maksim requires Sales Level 2 and Olga defeated', async () => {
  const [first, second] = await salesBosses()
  let progression = createInitialProgression()
  assert.equal(isBossUnlocked(first.character, getRoleProgress(progression, 'sales_manager'), 1), true)
  assert.equal(isBossUnlocked(second.character, getRoleProgress(progression, 'sales_manager'), 1), false)
  const levelTwoWithoutWin = structuredClone(progression)
  levelTwoWithoutWin.roles.sales_manager.xp = 100
  assert.equal(isBossUnlocked(second.character, getRoleProgress(levelTwoWithoutWin, 'sales_manager'), 2), false)

  const firstSession = endArenaSession(createArenaSession(first.scenario.id, first.character.id, first.scenario.openingMessage))
  progression = applyArenaEvaluation(progression, 'sales_manager', firstSession,
    { outcome: { status: 'SUCCESS', bossDefeated: true }, overallScore: 71 }).progression
  assert.equal(progression.roles.sales_manager.xp, 50)
  assert.equal(isBossUnlocked(second.character, getRoleProgress(progression, 'sales_manager'), 1), false)

  const repeatSession = endArenaSession(createArenaSession(first.scenario.id, first.character.id, first.scenario.openingMessage))
  progression = applyArenaEvaluation(progression, 'sales_manager', repeatSession,
    { outcome: { status: 'SUCCESS', bossDefeated: true }, overallScore: 83 }).progression
  assert.equal(getRoleProgress(progression, 'sales_manager').level, 2)
  assert.equal(isBossUnlocked(second.character, getRoleProgress(progression, 'sales_manager'), 2), true)
  assert.equal(isBossUnlocked(first.character, getRoleProgress(progression, 'sales_manager'), 2), true)
  assert.equal(progression.roles.sales_manager.bosses[first.character.id].defeated, true)
  for (const role of ['product_manager', 'project_manager']) {
    assert.equal(progression.roles[role].xp, 0)
    assert.deepEqual(progression.roles[role].bosses, {})
    assert.equal(isBossUnlocked(second.character, getRoleProgress(progression, role), 1), false)
  }
})

test('Sales setup exposes no hidden facts, while shared AI builders receive full cards', async () => {
  const [olga, maksim] = await salesBosses()
  for (const { character, scenario } of [olga, maksim]) {
    const publicSetup = JSON.stringify({
      name: character.name, role: character.role, profile: getCharacterPublicProfile(character),
      title: scenario.title, category: scenario.category, playerBrief: scenario.playerBrief,
    })
    assert.ok(scenario.playerBrief.situation.trim())
    assert.ok(scenario.playerBrief.playerGoal.trim())
    assert.ok(scenario.playerBrief.knownInformation.length >= 3)
    assert.ok(!publicSetup.includes(character.batna))
    assert.ok(!publicSetup.includes(character.privateInformation[0]))
    assert.ok(!publicSetup.includes(scenario.hiddenData.discoverableFacts[0].fact))

    const session = endArenaSession(createArenaSession(scenario.id, character.id, scenario.openingMessage))
    const opponent = buildOpponentMessages({ character, scenario, session })
    const evaluator = buildEvaluatorMessages({ character, scenario, session })
    assert.ok(opponent[0].content.includes(character.privateInformation[0]))
    assert.ok(opponent[0].content.includes(scenario.hiddenData.discoverableFacts[0].fact))
    assert.ok(evaluator[1].content.includes(character.privateInformation[0]))
    assert.ok(evaluator[1].content.includes(scenario.successConditions.playerMinimumConditions[0]))
    assert.ok(evaluator[1].content.includes(scenario.successConditions.opponentMinimumConditions[0]))
  }
  assert.doesNotMatch(JSON.stringify(olga.scenario.playerBrief), /ручную работу|нескольких источников|небольшой командой|пилот/)
  assert.doesNotMatch(JSON.stringify(maksim.scenario.playerBrief), /годовой договор|предоплат|ненужн|поддержк/)
})

test('generic sources and Natural Ending work with Sales cards without role-specific rules', async () => {
  const [olga] = await salesBosses()
  const characters = await localCharacterSource.getCharacters()
  const scenarios = await localScenarioSource.getScenarios()
  const extra = { ...olga.scenario, id: 'another_sales_scenario' }
  const options = await getArenaOptions('sales_manager',
    { async getCharacters() { return [...characters].reverse() } },
    { async getScenarios() { return [extra, ...scenarios] } })
  assert.deepEqual(options.map(({ scenario }) => scenario.id),
    [extra.id, olga.scenario.id, 'sales_competitor_price_02'])
  assert.equal(options[0].character.id, olga.character.id)

  const started = createArenaSession(olga.scenario.id, olga.character.id, olga.scenario.openingMessage)
  const agreed = addOpponentReply(addPlayerMessage(started,
    'Предлагаю пилот к пятнице: я беру демонстрацию, вы берёте проверку на небольшой команде.', olga.scenario.maxTurns),
  'Согласна. Я беру проверку на команде, вы берёте демонстрацию к пятнице.', olga.scenario.maxTurns)
  assert.equal(getNaturalEndingSuggestion(agreed), agreed.messages.at(-1).id)
})
