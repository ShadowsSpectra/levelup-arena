import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await server.close() })

const { localCharacterSource, localScenarioSource } = await server.ssrLoadModule('/src/content/arenaSources.ts')
const { getArenaOptions } = await server.ssrLoadModule('/src/services/arenaCatalog.ts')
const { getCharacterPublicProfile } = await server.ssrLoadModule('/src/services/characterProfile.ts')
const { createArenaSession, endArenaSession } = await server.ssrLoadModule('/src/services/arenaSession.ts')
const { applyArenaEvaluation, createInitialProgression, getRoleProgress, isBossUnlocked } =
  await server.ssrLoadModule('/src/services/progression.ts')
const { buildOpponentMessages } = await server.ssrLoadModule('/server/ai/opponentPrompt.ts')
const { buildEvaluatorMessages } = await server.ssrLoadModule('/server/ai/evaluatorPrompt.ts')

async function projectBosses() {
  return getArenaOptions('project_manager', localCharacterSource, localScenarioSource)
}

test('Project boss cards load in order through generic sources with complete scenario conditions', async () => {
  const [andrey, marina] = await projectBosses()
  assert.equal(andrey.character.name, 'Андрей')
  assert.equal(andrey.character.role, 'Developer')
  assert.equal(andrey.character.difficulty, 1)
  assert.equal(andrey.character.cooperativeness, 'high')
  assert.equal(andrey.character.pressure, 'low')
  assert.equal(andrey.scenario.title, 'Зависимость срывает срок')
  assert.equal(marina.character.name, 'Марина')
  assert.equal(marina.character.role, 'Client')
  assert.equal(marina.character.difficulty, 2)
  assert.equal(marina.character.cooperativeness, 'medium')
  assert.equal(marina.character.pressure, 'medium')
  assert.equal(marina.scenario.title, 'Это же входило в проект')
  assert.deepEqual(marina.character.unlockRequirements,
    { minLevel: 2, previousBossId: andrey.character.id })
  for (const { character, scenario } of [andrey, marina]) {
    assert.equal(scenario.playerRole, 'project_manager')
    assert.equal(scenario.characterId, character.id)
    assert.ok(scenario.openingMessage.trim())
    assert.ok(scenario.maxTurns > 0)
    for (const field of ['goal', 'position', 'batna']) assert.ok(character[field].trim(), field)
    for (const field of ['interests', 'constraints', 'privateInformation', 'redLines', 'possibleConcessions', 'behavior']) {
      assert.ok(character[field].length >= 3, field)
    }
    assert.ok(scenario.hiddenData.discoverableFacts.length >= 3)
    assert.equal(new Set(scenario.hiddenData.discoverableFacts.map(({ id }) => id)).size,
      scenario.hiddenData.discoverableFacts.length)
    for (const field of ['playerMinimumConditions', 'opponentMinimumConditions', 'agreementRequirements']) {
      assert.ok(scenario.successConditions[field].length >= 2, field)
    }
    assert.ok(scenario.validAgreementPaths.length >= 3)
    assert.ok(scenario.badAgreementExamples.length >= 3)
  }
  assert.equal((await getArenaOptions('sales_manager', localCharacterSource, localScenarioSource)).length, 0)
})

test('Project Boss #1 is immediate; Boss #2 requires both Project Level 2 and Andrey defeated', async () => {
  const [first, second] = await projectBosses()
  let progression = createInitialProgression()
  assert.equal(isBossUnlocked(first.character, getRoleProgress(progression, 'project_manager'), 1), true)
  assert.equal(isBossUnlocked(second.character, getRoleProgress(progression, 'project_manager'), 1), false)
  const levelTwoWithoutWin = structuredClone(progression)
  levelTwoWithoutWin.roles.project_manager.xp = 100
  assert.equal(isBossUnlocked(second.character, getRoleProgress(levelTwoWithoutWin, 'project_manager'), 2), false)

  const firstSession = endArenaSession(createArenaSession(first.scenario.id, first.character.id, first.scenario.openingMessage))
  progression = applyArenaEvaluation(progression, 'project_manager', firstSession,
    { outcome: { status: 'SUCCESS', bossDefeated: true }, overallScore: 74 }).progression
  assert.equal(progression.roles.project_manager.xp, 50)
  assert.equal(isBossUnlocked(second.character, getRoleProgress(progression, 'project_manager'), 1), false)

  const repeatSession = endArenaSession(createArenaSession(first.scenario.id, first.character.id, first.scenario.openingMessage))
  progression = applyArenaEvaluation(progression, 'project_manager', repeatSession,
    { outcome: { status: 'SUCCESS', bossDefeated: true }, overallScore: 82 }).progression
  assert.equal(getRoleProgress(progression, 'project_manager').level, 2)
  assert.equal(isBossUnlocked(second.character, getRoleProgress(progression, 'project_manager'), 2), true)
  assert.equal(isBossUnlocked(first.character, getRoleProgress(progression, 'project_manager'), 2), true)
  assert.equal(progression.roles.project_manager.bosses[first.character.id].defeated, true)
  for (const role of ['product_manager', 'sales_manager']) {
    assert.equal(progression.roles[role].xp, 0)
    assert.deepEqual(progression.roles[role].bosses, {})
    assert.equal(isBossUnlocked(second.character, getRoleProgress(progression, role), 1), false)
  }
})

test('public Project setup omits hidden facts while shared AI builders receive full cards', async () => {
  const [andrey, marina] = await projectBosses()
  for (const { character, scenario } of [andrey, marina]) {
    const publicSetup = JSON.stringify({
      name: character.name, role: character.role, profile: getCharacterPublicProfile(character),
      title: scenario.title, category: scenario.category, playerBrief: scenario.playerBrief,
    })
    assert.ok(scenario.playerBrief.situation.trim())
    assert.ok(scenario.playerBrief.playerGoal.trim())
    assert.ok(scenario.playerBrief.knownInformation.length >= 3)
    assert.ok(!publicSetup.includes(character.batna))
    assert.ok(!publicSetup.includes(scenario.hiddenData.discoverableFacts[0].fact))

    const session = endArenaSession(createArenaSession(scenario.id, character.id, scenario.openingMessage))
    const opponent = buildOpponentMessages({ character, scenario, session })
    const evaluator = buildEvaluatorMessages({ character, scenario, session })
    assert.ok(opponent[0].content.includes(character.privateInformation[0]))
    assert.ok(opponent[0].content.includes(scenario.hiddenData.discoverableFacts[0].fact))
    assert.ok(evaluator[1].content.includes(character.privateInformation[0]))
    assert.ok(evaluator[1].content.includes(scenario.successConditions.opponentMinimumConditions[0]))
  }
  assert.doesNotMatch(JSON.stringify(andrey.scenario.playerBrief), /внешний API|другой разработчик|поэтапная поставка/)
  assert.doesNotMatch(JSON.stringify(marina.scenario.playerBrief), /критичны|вторым этапом|дополнительный бюджет/)
})

test('generic Project loading supports another scenario for an existing character', async () => {
  const characters = await localCharacterSource.getCharacters()
  const scenarios = await localScenarioSource.getScenarios()
  const projectScenarios = scenarios.filter(({ playerRole }) => playerRole === 'project_manager')
  const extra = { ...projectScenarios[0], id: 'another_project_scenario' }
  const options = await getArenaOptions('project_manager',
    { async getCharacters() { return [...characters].reverse() } },
    { async getScenarios() { return [extra, ...scenarios] } })
  assert.deepEqual(options.map(({ scenario }) => scenario.id),
    [extra.id, projectScenarios[0].id, projectScenarios[1].id])
  assert.equal(options[0].character.id, projectScenarios[0].characterId)
})
