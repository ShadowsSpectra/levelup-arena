import type { ArenaSession } from '../types/arena'

// A conservative UX hint, not an agreement validator or an Arena outcome.
function normalized(text: string) {
  return text.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
}

const acceptance = /(?:^|[^\p{L}])(?:да|хорошо|окей|согласен|согласна|согласны|подтверждаю|подтверждаем|принимаю|принимаем|договорились|фиксируем|закрепляем|утверждаем|меня устраивает|нас устраивает|это подходит|так и сделаем)(?=$|[^\p{L}])/u
const negatedAcceptance = /(?:^|[^\p{L}])(?:не|пока не)\s+(?:согласен|согласна|согласны|подтверждаю|подтверждаем|принимаю|принимаем|договорились|фиксируем|закрепляем|утверждаем|подходит|устраивает)(?=$|[^\p{L}])/u
const conditionalOrOpen = /(?:^|[^\p{L}])(?:если|при условии|пока|возможно|может быть|но|однако|давайте обсудим|обсудим|для обсуждения|уточним|нужно уточнить|надо проверить)(?=$|[^\p{L}])/u
const proposal = /(?:^|[^\p{L}])(?:предлагаю|предлагаем|беру на себя|берем на себя|готов(?:а|ы)? сделать|давайте зафиксируем|давайте согласуем)(?=$|[^\p{L}])/u
const planCommitment = /(?:^|[^\p{L}])(?:фиксируем|закрепляем|утверждаем|согласуем)(?=$|[^\p{L}])/u
// Responsibilities are concrete even when the parties do not repeat a date or a generic word like "plan".
const assignedAction = /(?:^|[^\p{L}])(?:я|мы|ты|вы)\s+(?:(?:попробую|попробуем|готов(?:а|ы)?)\s+)?(?:бер\p{L}*|отвеча\p{L}*|подключ\p{L}*|подготов\p{L}*|выпуска\p{L}*|перенос\p{L}*|запуска\p{L}*|переда\p{L}*|согласу\p{L}*|достав\p{L}*|сдела\p{L}*|выполн\p{L}*|заверш\p{L}*)(?=$|[^\p{L}])/gu
const explicitClosure = /(?:^|[^\p{L}])(?:договорились|так и сделаем|фиксируем договоренность)(?=$|[^\p{L}])/u
const exploratoryProposal = /(?:^|[^\p{L}])(?:обсудить|уточнить|выяснить|исследовать|рассмотреть|подумать)(?=$|[^\p{L}])/u
const planDetail = /(?:^|[^\p{L}])(?:срок\p{L}*|дат\p{L}*|объем\p{L}*|этап\p{L}*|пилот\p{L}*|релиз\p{L}*|ответственн\p{L}*|завтра|сегодня|недел\p{L}*|месяц\p{L}*|до\s+\d+|к\s+\d+|к\s+(?:понедельнику|вторнику|среде|четвергу|пятнице))(?=$|[^\p{L}])/u
const finalDeadlock = /(?:переговоры зашли в тупик|не вижу возможности договориться|не вижу пути к соглашению|не сможем прийти к соглашению|соглашения не будет|дальше обсуждать нечего|на этом (?:разговор|переговоры) (?:завершим|закончим)|решение не найдено)/u
const refusal = /(?:^|[^\p{L}])(?:не могу согласиться|не можем согласиться|не могу принять|не можем принять|не согласен|не согласна|отказываюсь)(?=$|[^\p{L}])/u
const renewedNegotiation = /(?:^|[^\p{L}])(?:предлагаю|предлагаем|альтернатив\p{L}*|вместо|можем|если|при условии|пока|давайте|обсудим|уточним|проверим)(?=$|[^\p{L}])/u

function assignedActionCount(text: string) {
  return [...text.matchAll(assignedAction)].length
}

function opponentRestatesPlan(reply: string) {
  return assignedActionCount(reply) >= 2 ||
    (planDetail.test(reply) && (assignedActionCount(reply) > 0 || planCommitment.test(reply)))
}

function acceptedPlan(move: string, reply: string, recentConversation: string) {
  const playerOffersPlan = acceptance.test(move) || planCommitment.test(move) ||
    (proposal.test(move) && !exploratoryProposal.test(move)) || assignedActionCount(move) > 0
  const earlierPlanConfirmed = acceptance.test(move) && explicitClosure.test(reply) &&
    (planDetail.test(recentConversation) || assignedActionCount(recentConversation) >= 2)
  return acceptance.test(reply) && !negatedAcceptance.test(reply) &&
    !conditionalOrOpen.test(reply) && !reply.includes('?') &&
    playerOffersPlan && !negatedAcceptance.test(move) && !conditionalOrOpen.test(move) &&
    (planDetail.test(recentConversation) || assignedActionCount(move) > 0) &&
    (opponentRestatesPlan(reply) || earlierPlanConfirmed)
}

export function getNaturalEndingSuggestion(
  session: ArenaSession,
  dismissedMessageId: string | null = null,
): string | null {
  if (session.status !== 'negotiating' || session.currentTurn === 0) return null
  const opponent = session.messages.at(-1)
  const player = session.messages.at(-2)
  if (!opponent || opponent.speaker !== 'opponent' || opponent.id === dismissedMessageId ||
      !player || player.speaker !== 'player') return null

  const reply = normalized(opponent.text)
  const move = normalized(player.text)
  const recentConversation = normalized(session.messages.slice(-6)
    .filter((message) => message.id !== 'opponent-opening')
    .map((message) => message.text).join(' '))
  const earlierPlayer = session.messages.at(-4)
  const earlierOpponent = session.messages.at(-3)
  const priorAgreement = earlierPlayer?.speaker === 'player' && earlierOpponent?.speaker === 'opponent' &&
    acceptedPlan(normalized(earlierPlayer.text), normalized(earlierOpponent.text),
      normalized(session.messages.slice(-8, -2)
        .filter((message) => message.id !== 'opponent-opening')
        .map((message) => message.text).join(' ')))
  const continuedConfirmation = priorAgreement && acceptance.test(move) &&
    opponentRestatesPlan(reply) && !negatedAcceptance.test(move) && !conditionalOrOpen.test(move) &&
    !conditionalOrOpen.test(reply) && !reply.includes('?') &&
    !negatedAcceptance.test(reply) && !refusal.test(reply)
  const clearAgreement = acceptedPlan(move, reply, recentConversation) || continuedConfirmation
  const clearDeadlock = !reply.includes('?') && !renewedNegotiation.test(reply) && (
    finalDeadlock.test(reply) ||
    (refusal.test(reply) && refusal.test(move) && !renewedNegotiation.test(move))
  )

  return clearAgreement || clearDeadlock ? opponent.id : null
}
