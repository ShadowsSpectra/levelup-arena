import type { ArenaSession } from '../../src/types/arena'

export function getEvaluatorTranscript(session: ArenaSession) {
  let playerNumber = 0
  return session.messages.map(({ speaker, text }) => speaker === 'player'
    ? { speaker: 'PLAYER' as const, evidenceMessageId: `P${++playerNumber}`, text }
    : { speaker: 'OPPONENT' as const, text })
}

export function getPlayerEvidenceMessages(session: ArenaSession): Map<string, string> {
  return new Map(getEvaluatorTranscript(session).flatMap((message) =>
    message.speaker === 'PLAYER' ? [[message.evidenceMessageId, message.text] as const] : [],
  ))
}
