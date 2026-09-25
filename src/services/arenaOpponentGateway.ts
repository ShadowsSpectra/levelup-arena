import type { OpponentService } from './opponentService'

export type AIStatus = 'real' | 'unconfigured' | 'unavailable'

export async function getAIStatus(): Promise<AIStatus> {
  try {
    const response = await fetch('/api/ai/settings', { cache: 'no-store' })
    if (!response.ok) return 'unavailable'
    const settings = await response.json() as { configured?: boolean }
    return settings.configured ? 'real' : 'unconfigured'
  } catch {
    return 'unavailable'
  }
}

export function createBrowserOpponentService(): OpponentService {
  return {
    async reply(context) {
      let response: Response
      try {
        response = await fetch('/api/ai/opponent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(context),
        })
      } catch {
        throw new Error('Локальный AI-сервер недоступен. Проверьте его запуск и повторите отправку.')
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: unknown } | null
        throw new Error(typeof body?.error === 'string' ? body.error : 'AI недоступен. Проверьте AI Settings и повторите отправку.')
      }
      const result = await response.json().catch(() => null) as { reply?: unknown; mode?: unknown } | null
      if (typeof result?.reply !== 'string' || !result.reply.trim() || result.mode !== 'real') {
        throw new Error('AI вернул некорректный ответ. Повторите отправку.')
      }
      return result.reply
    },
  }
}
