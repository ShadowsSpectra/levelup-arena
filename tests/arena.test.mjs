import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await server.close() })

const { localCharacterSource, localScenarioSource } = await server.ssrLoadModule('/src/content/arenaSources.ts')
const { getArenaOptions } = await server.ssrLoadModule('/src/services/arenaCatalog.ts')
const { createArenaSession, addPlayerMessage, addOpponentReply, endArenaSession } =
  await server.ssrLoadModule('/src/services/arenaSession.ts')
const { mockOpponentService } = await server.ssrLoadModule('/src/services/opponentService.ts')

test('local content provides one Product scenario and empty states for other roles', async () => {
  const product = await getArenaOptions('product_manager', localCharacterSource, localScenarioSource)
  assert.equal(product.length, 1)
  assert.equal(product[0].character.name, 'Алексей')
  assert.equal(product[0].scenario.title, 'Релиз через две недели')
  assert.equal(product[0].scenario.maxTurns, 10)
  assert.ok(product[0].scenario.openingMessage)
  assert.equal((await getArenaOptions('project_manager', localCharacterSource, localScenarioSource)).length, 0)
  assert.equal((await getArenaOptions('sales_manager', localCharacterSource, localScenarioSource)).length, 0)
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
