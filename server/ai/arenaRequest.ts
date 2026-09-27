import type { ArenaMessage, ArenaSession } from '../../src/types/arena'
import { isRoleId } from '../../src/config/roles'
import { resolveFullArenaCards } from '../content/arenaSources'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function onlyKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((key) => keys.includes(key))
}

// No client card, prompt, provider role or hidden field becomes server context.
export function resolveArenaAIRequest(
  input: unknown,
  task: 'opponent' | 'evaluator',
  resolveCards: typeof resolveFullArenaCards = resolveFullArenaCards,
) {
  const invalid = () => new Error('Некорректный запрос Arena или transcript.')
  if (!record(input) || !onlyKeys(input, ['characterId', 'scenarioId', 'playerRole', 'session']) ||
      !text(input.characterId) || !text(input.scenarioId) ||
      typeof input.playerRole !== 'string' || !isRoleId(input.playerRole)) throw invalid()

  const { character, scenario } = resolveCards(input.characterId, input.scenarioId)
  if (character.id !== input.characterId || scenario.id !== input.scenarioId ||
      scenario.characterId !== character.id || scenario.playerRole !== input.playerRole) throw invalid()

  const raw = input.session
  const status = task === 'opponent' ? 'responding' : 'completed'
  if (!record(raw) || !onlyKeys(raw, ['id', 'currentTurn', 'status', 'messages']) ||
      !text(raw.id) || raw.status !== status || !Number.isInteger(raw.currentTurn) ||
      typeof raw.currentTurn !== 'number' || raw.currentTurn < 1 || raw.currentTurn > scenario.maxTurns ||
      !Array.isArray(raw.messages)) throw invalid()

  // Each session starts with the opening, then alternates player/opponent turns.
  const expectedLength = raw.currentTurn * 2 + (task === 'evaluator' ? 1 : 0)
  if (raw.messages.length !== expectedLength) throw invalid()
  const ids = new Set<string>()
  const messages: ArenaMessage[] = raw.messages.map((message, index) => {
    const speaker = index % 2 === 0 ? 'opponent' : 'player'
    if (!record(message) || !onlyKeys(message, ['id', 'speaker', 'text']) ||
        !text(message.id) || !text(message.text) || message.speaker !== speaker ||
        ids.has(message.id)) throw invalid()
    ids.add(message.id)
    // Preserve original text exactly, including evidence and whitespace.
    return { id: message.id, speaker, text: message.text }
  })

  const session: ArenaSession = {
    id: raw.id, characterId: character.id, scenarioId: scenario.id,
    currentTurn: raw.currentTurn, status, messages,
  }
  return { character, scenario, session }
}
