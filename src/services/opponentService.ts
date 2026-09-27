import type { ArenaSession, PublicCharacter, PublicScenario } from '../types/arena'

export interface OpponentService {
  reply(context: {
    character: PublicCharacter
    scenario: PublicScenario
    session: ArenaSession
  }): Promise<string>
}

// Test dialogue only: these replies do not interpret proposals or reveal hidden content.
const mockReplies = [
  'Я понимаю, почему срок важен. Давайте уточним, какой результат вы ожидаете к этой дате.',
  'Мне нужно оценить реалистичность плана для команды. Что для вас здесь самое важное?',
  'Я бы не хотел обещать то, в чём мы пока не уверены. Давайте разберём приоритеты.',
  'Если мы уточним обязательный объём, будет проще обсудить возможный подход.',
]

export const mockOpponentService: OpponentService = {
  async reply({ session }) {
    return mockReplies[(session.currentTurn - 1) % mockReplies.length]
  },
}
