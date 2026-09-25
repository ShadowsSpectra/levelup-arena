import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await server.close() })
const { sanitizeOpponentReply } = await server.ssrLoadModule('/src/services/opponentReply.ts')
const { createArenaSession, addPlayerMessage, addOpponentReply } =
  await server.ssrLoadModule('/src/services/arenaSession.ts')

test('opponent reply strips only the current character prefix and one outer quote pair', () => {
  assert.equal(sanitizeOpponentReply('Ирина: "Обсудим условия."', 'Ирина'), 'Обсудим условия.')
  assert.equal(sanitizeOpponentReply('Марина: Давайте уточним объём.', 'Марина'), 'Давайте уточним объём.')
  assert.equal(sanitizeOpponentReply('Алексей: «Согласен с этапами.»', 'Алексей'), 'Согласен с этапами.')
  assert.equal(sanitizeOpponentReply('«Обсудим «важный» этап.»', 'Алексей'), 'Обсудим «важный» этап.')
  assert.equal(sanitizeOpponentReply('Ирина: ""Тест""', 'Ирина'), '"Тест"')
  assert.equal(sanitizeOpponentReply('Марина: Давайте уточним объём.', 'Ирина'), 'Марина: Давайте уточним объём.')
  assert.equal(sanitizeOpponentReply('Мы с Ириной обсудим условия: "пилот".', 'Ирина'),
    'Мы с Ириной обсудим условия: "пилот".')
  assert.equal(sanitizeOpponentReply('Ирина:', 'Ирина'), 'Ирина:')
})

test('sanitized opponent reply is the message stored for the next Arena turn', () => {
  const started = createArenaSession('scenario', 'character', 'Начнём переговоры.')
  const pending = addPlayerMessage(started, 'Предлагаю пилот.', 5)
  const reply = sanitizeOpponentReply('Ирина: «Пилот возможен при ясных условиях.»', 'Ирина')
  const answered = addOpponentReply(pending, reply, 5)
  assert.equal(answered.messages.at(-1).text, 'Пилот возможен при ясных условиях.')
  assert.equal(answered.messages[1].text, 'Предлагаю пилот.')
})
