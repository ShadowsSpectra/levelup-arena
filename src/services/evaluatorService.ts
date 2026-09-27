import type { ArenaSession, PublicCharacter, PublicScenario } from '../types/arena'
import type { ArenaEvaluation } from '../types/arenaEvaluation'
import { createArenaAIRequest } from './arenaAIRequest'

export type EvaluatorContext = {
  character: PublicCharacter
  scenario: PublicScenario
  session: ArenaSession
}

export interface EvaluatorService {
  evaluate(context: EvaluatorContext): Promise<ArenaEvaluation>
}

type ErrorResponse = { error?: unknown }

export function createBrowserEvaluatorService(): EvaluatorService {
  return {
    async evaluate(context) {
      let response: Response
      try {
        response = await fetch('/api/ai/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createArenaAIRequest(context)),
        })
      } catch {
        throw new Error('Локальный AI-сервер недоступен. Диалог сохранён — попробуйте оценить его позже.')
      }

      let body: unknown
      try { body = await response.json() } catch { body = null }
      if (!response.ok) {
        const message = typeof (body as ErrorResponse | null)?.error === 'string'
          ? String((body as ErrorResponse).error)
          : 'Не удалось получить оценку. Диалог сохранён — попробуйте ещё раз.'
        throw new Error(message)
      }
      const evaluation = (body as { evaluation?: unknown } | null)?.evaluation
      if (!evaluation || typeof evaluation !== 'object') {
        throw new Error('Сервер вернул некорректную оценку. Диалог сохранён — попробуйте ещё раз.')
      }
      return evaluation as ArenaEvaluation
    },
  }
}
