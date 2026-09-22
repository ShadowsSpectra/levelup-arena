import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await server.close() })

const { resolveAIModel } = await server.ssrLoadModule('/server/ai/aiConfig.ts')
const { createAIOpponentService } = await server.ssrLoadModule('/server/ai/createAIOpponentService.ts')

test('opponent and evaluator can select independent provider/model configurations', () => {
  const opponentProvider = { async generate() { return { content: 'opponent' } } }
  const evaluatorProvider = { async generate() { return { content: '{}' } } }
  const config = {
    serverEndpoint: '/api/ai',
    models: {
      opponent: { provider: 'first', model: 'roleplay-model' },
      evaluator: { provider: 'second', model: 'evaluation-model' },
    },
  }
  const providers = { first: opponentProvider, second: evaluatorProvider }
  assert.deepEqual(resolveAIModel('opponent', config, providers), {
    provider: opponentProvider,
    model: config.models.opponent,
  })
  assert.deepEqual(resolveAIModel('evaluator', config, providers), {
    provider: evaluatorProvider,
    model: config.models.evaluator,
  })
})

test('AI-backed opponent uses the model abstraction without a built-in prompt or external call', async () => {
  const requests = []
  const provider = { async generate(request) {
    requests.push(request)
    return { content: 'Тестовый ответ' }
  } }
  const service = createAIOpponentService({
    config: {
      serverEndpoint: '/api/ai',
      models: { opponent: { provider: 'fake', model: 'test-model', apiEndpoint: 'https://example.test/v1' } },
    },
    providers: { fake: provider },
    createMessages: () => [{ role: 'user', content: 'Тестовая реплика' }],
  })
  assert.equal(await service.reply({}), 'Тестовый ответ')
  assert.deepEqual(requests, [{
    model: 'test-model',
    apiEndpoint: 'https://example.test/v1',
    messages: [{ role: 'user', content: 'Тестовая реплика' }],
    responseFormat: 'text',
  }])
})

test('missing task configuration and unregistered providers fail explicitly', () => {
  assert.throws(
    () => resolveAIModel('evaluator', { serverEndpoint: '/api/ai', models: {} }, {}),
    /No AI model configured for evaluator/,
  )
  assert.throws(
    () => resolveAIModel('opponent', {
      serverEndpoint: '/api/ai',
      models: { opponent: { provider: 'missing', model: 'test-model' } },
    }, {}),
    /not registered/,
  )
})
