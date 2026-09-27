import type { AISettings, AISettingsInfo, PublicAISettings } from '../types/aiSettings'

// One isolated JS realm per tab. No browser storage, cookies or server session.
export function createAISettingsSession() {
  let current: AISettings | null = null
  return {
    get(): AISettings | null { return current ? { ...current } : null },
    getPublic(): PublicAISettings | null {
      return current ? { configured: true, provider: current.provider, baseUrl: current.baseUrl, model: current.model } : null
    },
    prepare(input: AISettings): AISettings {
      const apiKey = (typeof input.apiKey === 'string' ? input.apiKey.trim() : '') || current?.apiKey
      if (!apiKey) throw new Error('Введите собственный API Key.')
      return { provider: input.provider, baseUrl: input.baseUrl.trim(), apiKey, model: input.model.trim() }
    },
    save(input: AISettings) {
      if (typeof input.apiKey !== 'string' || !input.apiKey.trim()) throw new Error('Введите собственный API Key.')
      current = { provider: input.provider, baseUrl: input.baseUrl, apiKey: input.apiKey, model: input.model }
    },
    clear() { current = null },
  }
}

export const aiSettingsSession = createAISettingsSession()

export async function getDefaultAISettings(): Promise<AISettingsInfo> {
  const response = await fetch('/api/ai/settings', { cache: 'no-store' })
  if (!response.ok) throw new Error('AI-сервер недоступен.')
  const info = await response.json() as { configured?: boolean; provider?: string; baseUrl?: string; model?: string }
  if (info.configured === false) return { configured: false }
  if (info.configured !== true || info.provider !== 'openai-compatible' ||
      typeof info.baseUrl !== 'string' || typeof info.model !== 'string') {
    throw new Error('Некорректные настройки AI приложения.')
  }
  return { configured: true, provider: info.provider, baseUrl: info.baseUrl, model: info.model }
}

export async function checkAIConnection(ai?: AISettings): Promise<void> {
  let response: Response
  try {
    response = await fetch('/api/ai/check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ai ? { ai } : {}),
    })
  } catch { throw new Error('AI-сервер недоступен: запрос проверки не достиг сервера приложения.') }
  const result = await response.json().catch(() => null) as { connected?: unknown; error?: unknown } | null
  if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'Ошибка подключения AI.')
  if (result?.connected !== true) throw new Error('Сервер не подтвердил подключение AI.')
}
