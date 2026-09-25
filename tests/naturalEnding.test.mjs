import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const server = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await server.close() })

const { createArenaSession, addPlayerMessage, addOpponentReply, endArenaSession } =
  await server.ssrLoadModule('/src/services/arenaSession.ts')
const { getNaturalEndingSuggestion } = await server.ssrLoadModule('/src/services/naturalEnding.ts')
const { NegotiationView } = await server.ssrLoadModule('/src/components/arena/NegotiationView.tsx')

function exchange(playerText, opponentText, maxTurns = 10) {
  const started = createArenaSession('scenario', 'character', 'Давайте обсудим задачу.')
  const pending = addPlayerMessage(started, playerText, maxTurns)
  return addOpponentReply(pending, opponentText, maxTurns)
}

function view(session) {
  return renderToStaticMarkup(createElement(NegotiationView, {
    character: { name: 'Оппонент', role: 'Manager' },
    scenario: { title: 'Тест', maxTurns: 10 },
    session, replyError: null,
    async onSend() { return true }, onFinish() {}, onOpenAISettings() {},
  }))
}

test('clear mutual agreement suggests finishing but leaves the session open', () => {
  const session = exchange(
    'Предлагаю пилот к пятнице: я отвечаю за проверку с командой, вы согласуете его с клиентом.',
    'Согласна. Фиксируем план: пилот к пятнице, я согласую его с клиентом.',
  )
  assert.equal(session.status, 'negotiating')
  assert.equal(getNaturalEndingSuggestion(session), session.messages.at(-1).id)
  const html = view(session)
  assert.match(html, /Похоже, переговоры завершены/)
  assert.match(html, /Перейти к результатам/)
  assert.match(html, /Продолжить переговоры/)
  assert.match(html, /Завершить переговоры/)
  assert.match(html, /Ваше сообщение/)
})

test('explicit acceptance and restatement of a concrete plan suggests finishing', () => {
  const session = exchange(
    'Тогда фиксируем: через две недели выпускаем core flow, аналитику переносим на второй этап. Я беру коммуникацию с клиентом, ты отвечаешь за техническую часть.',
    'Согласен. Через две недели выпускаем основной пользовательский сценарий, аналитическую часть переносим на второй этап. Я отвечаю за техническую часть, ты берешь на себя коммуникацию с клиентом.',
  )
  assert.equal(getNaturalEndingSuggestion(session), session.messages.at(-1).id)
  assert.match(view(session), /Похоже, переговоры завершены/)
})

test('accepted division of responsibilities suggests finishing without a repeated date', () => {
  const session = exchange(
    'Я попробую подключить второго разработчика к интеграции. Ты берёшь независимую часть и подготовку. Фиксируем?',
    'Да, фиксируем. Я беру на себя независимую часть и подготовку к интеграции. Вы подключаете второго разработчика для завершения интеграции после готовности внешнего API.',
  )
  assert.equal(getNaturalEndingSuggestion(session), session.messages.at(-1).id)
  assert.match(view(session), /Похоже, переговоры завершены/)
})

test('live Project plan confirmation suggests ending on both successive accepted restatements', () => {
  const started = createArenaSession('scenario', 'character', 'Обсудим задачу.')
  const first = addOpponentReply(addPlayerMessage(started,
    'Тогда делаем независимую часть к текущему сроку, интеграцию после готовности API. Ты берёшь подготовку, я решаю вопрос с дополнительным разработчиком. Фиксируем?', 10),
  'Звучит разумно. Давайте фиксируем: основной пользовательский сценарий выпускаем через 2 недели, интеграцию делаем после готовности API. Я беру на себя подготовку, а вы решаете вопрос с дополнительным разработчиком.', 10)
  assert.equal(getNaturalEndingSuggestion(first), first.messages.at(-1).id)
  assert.match(view(first), /Похоже, переговоры завершены/)

  const second = addOpponentReply(addPlayerMessage(first, 'Хорошо', 10),
    'Отлично, тогда у нас есть конкретный план. Основной пользовательский сценарий будет готов через 2 недели, интеграция — после готовности API. Я беру на себя подготовку, а вы решаете вопрос с дополнительным разработчиком.', 10)
  assert.equal(getNaturalEndingSuggestion(second), second.messages.at(-1).id)
  assert.match(view(second), /Похоже, переговоры завершены/)
})

test('a positive follow-up does not turn an unresolved or rejected plan into an ending', () => {
  const started = createArenaSession('scenario', 'character', 'Обсудим задачу.')
  const unaccepted = addOpponentReply(addPlayerMessage(started,
    'Я беру подготовку к пятнице, вы подключаете коллегу. Фиксируем?', 10),
  'Это возможно, но сначала нужно подтвердить доступность коллеги.', 10)
  const stillOpen = addOpponentReply(addPlayerMessage(unaccepted, 'Хорошо', 10),
    'Я беру подготовку к пятнице, вы подключаете коллегу после проверки доступности.', 10)
  assert.equal(getNaturalEndingSuggestion(stillOpen), null)

  const accepted = addOpponentReply(addPlayerMessage(started,
    'Я беру подготовку к пятнице, вы подключаете коллегу. Фиксируем?', 10),
  'Согласен. Я беру подготовку к пятнице, вы подключаете коллегу.', 10)
  const rejected = addOpponentReply(addPlayerMessage(accepted, 'Хорошо', 10),
    'Но теперь этот срок невозможен. Я не могу подтвердить подготовку к пятнице.', 10)
  assert.equal(getNaturalEndingSuggestion(rejected), null)
})

test('a concrete plan in earlier turns supports a later two-sided confirmation', () => {
  const started = createArenaSession('scenario', 'character', 'Обсудим задачу.')
  const first = addOpponentReply(addPlayerMessage(started,
    'Предлагаю пилот к пятнице, я проверю объём с командой.', 10),
  'Это стоит рассмотреть, если вы подтвердите объём.', 10)
  const second = addOpponentReply(addPlayerMessage(first, 'Подтверждаю этот план.', 10),
    'Согласна. Договорились.', 10)
  assert.equal(getNaturalEndingSuggestion(first), null)
  assert.equal(getNaturalEndingSuggestion(second), second.messages.at(-1).id)
})

test('clear final refusal or mutual deadlock suggests finishing without deciding an outcome', () => {
  const finalRefusal = exchange(
    'Можем ли мы найти другой путь?',
    'Не вижу пути к соглашению. На этом переговоры закончим.',
  )
  const mutualDeadlock = exchange(
    'Я не могу принять эти условия. На этом остановимся.',
    'Я тоже не могу согласиться. Другого решения у нас нет.',
  )
  assert.ok(getNaturalEndingSuggestion(finalRefusal))
  assert.ok(getNaturalEndingSuggestion(mutualDeadlock))
  assert.equal(finalRefusal.status, 'negotiating')
  assert.equal(mutualDeadlock.status, 'negotiating')
  assert.equal('outcome' in finalRefusal, false)
})

test('ordinary discovery, conditional agreement and ordinary objections do not trigger', () => {
  const ordinary = exchange(
    'Предлагаю обсудить план и сроки. Что для вас важно?',
    'Согласна, давайте обсудим детали и проверим ограничения.',
  )
  const conditional = exchange(
    'Предлагаю пилот к пятнице.',
    'Согласна, если Engineering подтвердит сроки.',
  )
  const objection = exchange(
    'Предлагаю пилот к пятнице.',
    'Не могу подтвердить такой срок без оценки команды. Что входит в пилот?',
  )
  const agreementToDiscuss = exchange(
    'Предлагаю уточнить сроки и обсудить план.',
    'Согласна.',
  )
  const temporaryDeadlock = exchange(
    'Какие условия для вас важны?',
    'Пока не вижу пути к соглашению. Может быть, уточним объём?',
  )
  const agreementToProblem = exchange(
    'Тогда фиксируем: через две недели выпускаем основной сценарий, аналитику переносим на второй этап.',
    'Согласен, это проблема, но срок всё равно невозможен.',
  )
  const bareAcceptance = exchange(
    'Тогда фиксируем: через две недели выпускаем основной сценарий, аналитику переносим на второй этап.',
    'Согласен.',
  )
  const bareYes = exchange(
    'Я подключаю коллегу, вы готовите интеграцию. Фиксируем?',
    'Да.',
  )
  const planningWithoutAcceptance = exchange(
    'Я подключаю коллегу, вы готовите интеграцию. Фиксируем?',
    'Я подготовлю интеграцию, вы подключите коллегу после оценки сроков.',
  )
  for (const session of [ordinary, conditional, objection, agreementToDiscuss,
    temporaryDeadlock, agreementToProblem, bareAcceptance, bareYes, planningWithoutAcceptance]) {
    assert.equal(getNaturalEndingSuggestion(session), null)
    assert.doesNotMatch(view(session), /Похоже, переговоры завершены/)
  }
})

test('player may dismiss the hint or send another message without completing', () => {
  const session = exchange('Предлагаю пилот к пятнице.', 'Согласна. Фиксируем пилот к пятнице.')
  const suggestionId = getNaturalEndingSuggestion(session)
  assert.ok(suggestionId)
  assert.equal(getNaturalEndingSuggestion(session, suggestionId), null)
  assert.match(view(session), /Ваше сообщение/)
  const pending = addPlayerMessage(session, 'Уточним, кто сообщит об этом клиенту.', 10)
  assert.equal(pending.status, 'responding')
  assert.equal(getNaturalEndingSuggestion(pending), null)
  const continued = addOpponentReply(pending, 'Я уточню это у клиента и вернусь с ответом.', 10)
  assert.equal(continued.status, 'negotiating')
  assert.equal(getNaturalEndingSuggestion(continued), null)
  assert.equal(continued.currentTurn, 2)
})

test('manual Finish remains available and max-turn limit takes precedence', () => {
  const openSession = exchange('Что вам нужно?', 'Давайте уточним условия.')
  assert.match(view(openSession), /Завершить переговоры/)
  assert.equal(endArenaSession(openSession).status, 'completed')

  const atLimit = exchange(
    'Предлагаю пилот к пятнице.',
    'Согласна. Фиксируем пилот к пятнице.',
    1,
  )
  assert.equal(atLimit.status, 'turn-limit')
  assert.equal(getNaturalEndingSuggestion(atLimit), null)
  assert.equal(addPlayerMessage(atLimit, 'Ещё реплика', 1), atLimit)
  const html = view(atLimit)
  assert.match(html, /Перейти к результату/)
  assert.doesNotMatch(html, /Похоже, переговоры завершены/)
  assert.doesNotMatch(html, /Ваше сообщение/)
  assert.equal(endArenaSession(atLimit).status, 'completed')
})
