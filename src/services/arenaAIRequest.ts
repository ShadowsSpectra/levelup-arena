import type { ArenaSession, PublicCharacter, PublicScenario } from '../types/arena'
import type { RoleId } from '../config/roles'

export type ArenaAIRequest = {
  characterId: string
  scenarioId: string
  playerRole: RoleId
  session: Pick<ArenaSession, 'id' | 'currentTurn' | 'status' | 'messages'>
}

// Explicit projection: even extra runtime properties never reach the AI boundary.
export function createArenaAIRequest(context: {
  character: PublicCharacter
  scenario: PublicScenario
  session: ArenaSession
}): ArenaAIRequest {
  return {
    characterId: context.character.id,
    scenarioId: context.scenario.id,
    playerRole: context.scenario.playerRole,
    session: {
      id: context.session.id,
      currentTurn: context.session.currentTurn,
      status: context.session.status,
      messages: context.session.messages.map(({ id, speaker, text }) => ({ id, speaker, text })),
    },
  }
}
