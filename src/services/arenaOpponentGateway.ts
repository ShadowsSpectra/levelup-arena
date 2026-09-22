import { mockOpponentService, type OpponentService } from './opponentService'

export type AIMode = 'real' | 'mock'

export async function getAIMode(): Promise<AIMode> {
  try {
    const response = await fetch('/api/ai/settings', { cache: 'no-store' })
    if (!response.ok) return 'mock'
    const settings = await response.json() as { configured?: boolean }
    return settings.configured ? 'real' : 'mock'
  } catch {
    return 'mock'
  }
}

export function createBrowserOpponentService(
  onModeChange: (mode: AIMode) => void,
  onFallbackNotice: (notice: string | null) => void = () => {},
): OpponentService {
  return {
    async reply(context) {
      try {
        const response = await fetch('/api/ai/opponent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(context),
        })
        if (!response.ok) throw new Error('AI endpoint unavailable')
        const result = await response.json() as { reply?: unknown; mode?: unknown; warning?: unknown }
        if (typeof result.reply !== 'string' || !result.reply.trim() ||
          (result.mode !== 'real' && result.mode !== 'mock')) {
          throw new Error('Invalid AI endpoint response')
        }
        onModeChange(result.mode)
        onFallbackNotice(result.mode === 'mock' && typeof result.warning === 'string' ? result.warning : null)
        return result.reply
      } catch {
        onModeChange('mock')
        onFallbackNotice('Локальный AI-сервер недоступен. Показан Mock-ответ.')
        return mockOpponentService.reply(context)
      }
    },
  }
}
