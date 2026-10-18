import type { MascotState } from '../../components/mascot/Mascot'
import type { ArenaEvaluation } from '../../types/arenaEvaluation'

export type CommentCase = 'SUCCESS_HIGH' | 'SUCCESS_LOW' | 'BAD_AGREEMENT' | 'NO_AGREEMENT'
type ResultSignals = Pick<ArenaEvaluation, 'outcome' | 'overallScore'>

export const leviResultComments: Record<CommentCase, { emotion: MascotState; lines: readonly { id: string; text: string }[] }> = {
  SUCCESS_HIGH: { emotion: 'happy', lines: [
    { id: 'success-high-1', text: 'Ладно, признаю. Это было красиво.' },
    { id: 'success-high-2', text: 'Ого. Договорились. И даже на хороших условиях.' },
    { id: 'success-high-3', text: 'Хорошая работа. Я даже приготовил сарказм зря.' },
    { id: 'success-high-4', text: 'Условия соблюдены, соглашение есть. Мне почти не к чему придраться.' },
    { id: 'success-high-5', text: 'Вот это уже похоже на переговоры. Запомни этот момент.' },
  ] },
  SUCCESS_LOW: { emotion: 'judge', lines: [
    { id: 'success-low-1', text: 'Договорились. Но способ, которым ты это сделал, вызывает вопросы.' },
    { id: 'success-low-2', text: 'Соглашение есть. Навыки переговоров пока догоняют.' },
    { id: 'success-low-3', text: 'Результат получен. Над процессом ещё поработаем.' },
    { id: 'success-low-4', text: 'Ну, договориться удалось. Теперь попробуй сделать это красиво.' },
    { id: 'success-low-5', text: 'Сделка состоялась. Я бы только не советовал повторять всё слово в слово.' },
  ] },
  BAD_AGREEMENT: { emotion: 'judge', lines: [
    { id: 'bad-agreement-1', text: 'Договорились. Теперь осталось понять, зачем тебе такие условия.' },
    { id: 'bad-agreement-2', text: 'Соглашение есть. Выгода, кажется, вышла из переговоров раньше.' },
    { id: 'bad-agreement-3', text: 'Договорились. Но я бы пока не называл это победой.' },
    { id: 'bad-agreement-4', text: 'Формально договорились. Практически — есть вопросы.' },
    { id: 'bad-agreement-5', text: 'Ну, хоть о чем-то договорились. Уже что-то.' },
  ] },
  NO_AGREEMENT: { emotion: 'idle', lines: [
    { id: 'no-agreement-1', text: 'Ну... зато теперь мы знаем, как делать не надо.' },
    { id: 'no-agreement-2', text: 'Не договорились. Бывает. Даже я не всегда получаю второй ужин.' },
    { id: 'no-agreement-3', text: 'Соглашения нет. Но опыт, к счастью, возврату не подлежит.' },
    { id: 'no-agreement-4', text: 'Сегодня без сделки. В следующий раз попробуем с аргументами.' },
    { id: 'no-agreement-5', text: 'Ну, соглашения нет. Зато теперь есть материал для размышлений.' },
  ] },
}

export function leviResultCommentCase(result: ResultSignals): CommentCase {
  return result.outcome.status === 'SUCCESS'
    ? result.overallScore > 50 ? 'SUCCESS_HIGH' : 'SUCCESS_LOW'
    : result.outcome.status
}

export function chooseLeviResultComment(result: ResultSignals, usedIds: readonly string[] = [], random = Math.random) {
  const { emotion, lines } = leviResultComments[leviResultCommentCase(result)]
  const candidates = lines.filter((line) => !usedIds.includes(line.id))
  if (!candidates.length) return null
  const chosen = candidates[Math.floor(random() * candidates.length)]
  return { ...chosen, emotion }
}
