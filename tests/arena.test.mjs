import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await server.close() })

const { fullCharacterSource: localCharacterSource, fullScenarioSource: localScenarioSource } = await server.ssrLoadModule('/server/content/arenaSources.ts')
const { getArenaOptions } = await server.ssrLoadModule('/src/services/arenaCatalog.ts')
const { createArenaSession, addPlayerMessage, addOpponentReply, endArenaSession } =
  await server.ssrLoadModule('/src/services/arenaSession.ts')
const { mockOpponentService } = await server.ssrLoadModule('/src/services/opponentService.ts')
const { applyArenaEvaluation, createInitialProgression, getRoleProgress, isBossUnlocked } =
  await server.ssrLoadModule('/src/services/progression.ts')
const { buildOpponentMessages } = await server.ssrLoadModule('/server/ai/opponentPrompt.ts')
const { buildEvaluatorMessages } = await server.ssrLoadModule('/server/ai/evaluatorPrompt.ts')

test('local content provides separate two-boss branches for all three roles', async () => {
  const product = await getArenaOptions('product_manager', localCharacterSource, localScenarioSource)
  assert.equal(product.length, 2)
  assert.deepEqual(product.map(({ character }) => character.id), ['alexey_techlead_01', 'irina_sales_head_01'])
  assert.equal(product[0].character.name, 'Алексей')
  assert.equal(product[0].scenario.title, 'Релиз через две недели')
  assert.equal(product[0].scenario.maxTurns, 10)
  assert.ok(product[0].scenario.openingMessage)
  assert.equal(product[1].character.name, 'Ирина')
  assert.equal(product[1].scenario.characterId, product[1].character.id)
  const project = await getArenaOptions('project_manager', localCharacterSource, localScenarioSource)
  assert.deepEqual(project.map(({ character }) => character.id), ['andrey_developer_01', 'marina_client_02'])
  const sales = await getArenaOptions('sales_manager', localCharacterSource, localScenarioSource)
  assert.deepEqual(sales.map(({ character }) => character.id), ['olga_potential_client_01', 'maksim_procurement_02'])
})

test('Irina Character and Scenario cards contain a full, distinct Product–Sales negotiation', async () => {
  const options = await getArenaOptions('product_manager', localCharacterSource, localScenarioSource)
  const alexey = options[0].character
  const { character: irina, scenario } = options[1]
  assert.equal(irina.role, 'Head of Sales')
  assert.equal(irina.difficulty, 2)
  assert.deepEqual(irina.unlockRequirements, { minLevel: 2, previousBossId: alexey.id })
  assert.equal(irina.cooperativeness, 'medium')
  assert.equal(irina.pressure, 'high')
  assert.equal(alexey.cooperativeness, 'high')
  assert.equal(alexey.pressure, 'low')
  assert.ok(irina.personality.includes('assertive'))
  assert.ok(irina.personality.includes('impatient'))
  for (const field of ['goal', 'position', 'batna']) assert.ok(irina[field].trim())
  for (const field of ['interests', 'constraints', 'privateInformation', 'redLines', 'possibleConcessions', 'behavior']) {
    assert.ok(irina[field].length >= 3, `Irina ${field}`)
  }
  const behavior = irina.behavior.join(' ')
  for (const pattern of [
    /коммерческой позиции/, /риску для сделки/, /расплывчато/, /по кругу/,
    /по одному/, /точных вопросов/, /оспаривает/, /объём, срок, ответственного/,
    /конкретный проверяемый план/, /явно принимает/, /без грубости/,
  ]) assert.match(behavior, pattern)

  assert.equal(scenario.playerRole, 'product_manager')
  assert.equal(scenario.recommendedLevel, 2)
  assert.ok(scenario.maxTurns > 0)
  assert.ok(scenario.openingMessage.trim())
  assert.ok(scenario.playerBrief.situation.trim())
  assert.ok(scenario.playerBrief.playerGoal.trim())
  assert.ok(scenario.playerBrief.knownInformation.length >= 3)
  assert.ok(scenario.hiddenData.opponentGoal.trim())
  assert.ok(scenario.hiddenData.discoverableFacts.length >= 4)
  assert.equal(new Set(scenario.hiddenData.discoverableFacts.map(({ id }) => id)).size,
    scenario.hiddenData.discoverableFacts.length)
  for (const field of ['playerMinimumConditions', 'opponentMinimumConditions', 'agreementRequirements']) {
    assert.ok(scenario.successConditions[field].length >= 2, field)
  }
  assert.ok(scenario.validAgreementPaths.length >= 3)
  assert.ok(scenario.badAgreementExamples.length >= 3)
  assert.match(scenario.hiddenData.discoverableFacts.map(({ fact }) => fact).join(' '), /показател/)
  assert.doesNotMatch(JSON.stringify(scenario.playerBrief), /показател|экспорт данных|пилот/)
})

test('Irina unlocks only for a level-two PM who defeated Alexey, then remains replayable', async () => {
  const [first, second] = await getArenaOptions('product_manager', localCharacterSource, localScenarioSource)
  let progression = createInitialProgression()
  assert.equal(isBossUnlocked(first.character, getRoleProgress(progression, 'product_manager'), 1), true)
  assert.equal(isBossUnlocked(second.character, getRoleProgress(progression, 'product_manager'), 1), false)
  const pmLevelTwoWithoutWin = structuredClone(progression)
  pmLevelTwoWithoutWin.roles.product_manager.xp = 100
  assert.equal(isBossUnlocked(second.character, getRoleProgress(pmLevelTwoWithoutWin, 'product_manager'), 2), false)

  const alexeySession = endArenaSession(createArenaSession(first.scenario.id, first.character.id, first.scenario.openingMessage))
  progression = applyArenaEvaluation(progression, 'product_manager', alexeySession,
    { outcome: { status: 'SUCCESS', bossDefeated: true }, overallScore: 70 }).progression
  assert.equal(isBossUnlocked(second.character, getRoleProgress(progression, 'product_manager'), 1), false)
  const secondAlexeySession = endArenaSession(createArenaSession(first.scenario.id, first.character.id, first.scenario.openingMessage))
  progression = applyArenaEvaluation(progression, 'product_manager', secondAlexeySession,
    { outcome: { status: 'SUCCESS', bossDefeated: true }, overallScore: 75 }).progression
  assert.equal(getRoleProgress(progression, 'product_manager').level, 2)
  assert.equal(isBossUnlocked(second.character, getRoleProgress(progression, 'product_manager'), 2), true)
  assert.equal(isBossUnlocked(second.character, getRoleProgress(progression, 'project_manager'), 2), false)

  const irinaSession = endArenaSession(createArenaSession(second.scenario.id, second.character.id, second.scenario.openingMessage))
  progression = applyArenaEvaluation(progression, 'product_manager', irinaSession,
    { outcome: { status: 'SUCCESS', bossDefeated: true }, overallScore: 82 }).progression
  assert.equal(progression.roles.product_manager.bosses[second.character.id].defeated, true)
  assert.equal(progression.roles.product_manager.bosses[second.character.id].attempts, 1)
  assert.equal(isBossUnlocked(second.character, getRoleProgress(progression, 'product_manager'), 2), true)
  assert.deepEqual(progression.roles.project_manager.bosses, {})
})

test('generic sources load additional scenarios without boss-specific engine rules', async () => {
  const characters = await localCharacterSource.getCharacters()
  const scenarios = await localScenarioSource.getScenarios()
  const extraScenario = { ...scenarios[1], id: 'another_sales_scenario' }
  const options = await getArenaOptions('product_manager',
    { async getCharacters() { return [...characters].reverse() } },
    { async getScenarios() { return [extraScenario, ...scenarios] } })
  assert.deepEqual(options.map(({ scenario }) => scenario.id),
    ['another_sales_scenario', scenarios[0].id, scenarios[1].id])
  assert.equal(options[0].character.id, characters[1].id)
  assert.equal(options[2].character.id, characters[1].id)
})

test('existing Opponent and Evaluator builders receive Irina cards without special rules', async () => {
  const { character, scenario } = (await getArenaOptions(
    'product_manager', localCharacterSource, localScenarioSource))[1]
  const session = endArenaSession(createArenaSession(scenario.id, character.id, scenario.openingMessage))
  const opponent = buildOpponentMessages({ character, scenario, session })
  const evaluator = buildEvaluatorMessages({ character, scenario, session })
  assert.match(opponent[0].content, /name: Ирина/)
  assert.ok(opponent[0].content.includes(character.redLines[0]))
  assert.ok(opponent[0].content.includes(scenario.hiddenData.discoverableFacts[0].fact))
  for (const rule of character.behavior) assert.ok(opponent[0].content.includes(rule))
  assert.equal(opponent[1].content, scenario.openingMessage)
  assert.ok(evaluator[1].content.includes(character.privateInformation[0]))
  assert.ok(evaluator[1].content.includes(scenario.successConditions.playerMinimumConditions[0]))
})

test('scenario with missing character is ignored without crashing', async () => {
  const scenarios = await localScenarioSource.getScenarios()
  const source = { async getScenarios() { return [{ ...scenarios[0], characterId: 'missing' }] } }
  assert.deepEqual(await getArenaOptions('product_manager', localCharacterSource, source), [])
})

test('mock replies and maxTurns use Scenario configuration', async () => {
  const [{ scenario, character }] = await getArenaOptions('product_manager', localCharacterSource, localScenarioSource)
  let session = createArenaSession(scenario.id, character.id, scenario.openingMessage)
  assert.equal(session.currentTurn, 0)
  assert.deepEqual(session.messages.map(({ speaker }) => speaker), ['opponent'])
  assert.equal(session.messages[0].text, scenario.openingMessage)
  for (let turn = 1; turn <= scenario.maxTurns; turn++) {
    const pending = addPlayerMessage(session, `Реплика ${turn}`, scenario.maxTurns)
    assert.equal(pending.currentTurn, turn)
    assert.equal(pending.status, 'responding')
    const reply = await mockOpponentService.reply({ character, scenario, session: pending })
    assert.ok(reply.length > 0)
    session = addOpponentReply(pending, reply, scenario.maxTurns)
    assert.equal(session.messages.length, 1 + turn * 2)
  }
  assert.equal(session.status, 'turn-limit')
  assert.equal(addPlayerMessage(session, 'Лишняя реплика', scenario.maxTurns), session)
  assert.equal(endArenaSession(session).status, 'completed')
})

test('manual end is available before maxTurns and blank messages are ignored', () => {
  const session = createArenaSession('scenario', 'character', 'Начало')
  assert.equal(addPlayerMessage(session, '  ', 10), session)
  assert.equal(endArenaSession(session).status, 'completed')
  const pending = addPlayerMessage(session, 'Вопрос', 10)
  assert.equal(endArenaSession(pending), pending)
  const afterReply = addOpponentReply(pending, 'Ответ', 10)
  assert.equal(endArenaSession(afterReply).status, 'completed')
  assert.equal(endArenaSession(afterReply).currentTurn, 1)
})
