import type { ArenaSession } from '../types/arena'

export function createArenaSession(scenarioId: string, characterId: string, openingMessage: string): ArenaSession {
  return {
    id: crypto.randomUUID(),
    scenarioId,
    characterId,
    messages: [{ id: 'opponent-opening', speaker: 'opponent', text: openingMessage }],
    currentTurn: 0,
    status: 'negotiating',
  }
}

export function addPlayerMessage(session: ArenaSession, text: string, maxTurns: number): ArenaSession {
  const trimmed = text.trim()
  if (session.status !== 'negotiating' || session.currentTurn >= maxTurns || !trimmed) return session
  const turn = session.currentTurn + 1
  return {
    ...session,
    currentTurn: turn,
    status: 'responding',
    messages: [...session.messages, { id: `player-${turn}`, speaker: 'player', text: trimmed }],
  }
}

export function addOpponentReply(session: ArenaSession, text: string, maxTurns: number): ArenaSession {
  if (session.status !== 'responding') return session
  return {
    ...session,
    status: session.currentTurn >= maxTurns ? 'turn-limit' : 'negotiating',
    messages: [
      ...session.messages,
      { id: `opponent-${session.currentTurn}`, speaker: 'opponent', text },
    ],
  }
}

export function endArenaSession(session: ArenaSession): ArenaSession {
  return session.status === 'responding' ? session : { ...session, status: 'completed' }
}
