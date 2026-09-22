export type AISettings = {
  provider: 'openai-compatible'
  baseUrl: string
  apiKey: string
  model: string
}

export type PublicAISettings = Omit<AISettings, 'apiKey'> & { configured: boolean }

export function validateAISettings(input: unknown, current: AISettings | null = null): AISettings {
  if (!input || typeof input !== 'object') throw new Error('Заполните настройки AI.')
  const value = input as Record<string, unknown>
  if (value.provider !== 'openai-compatible') throw new Error('Выберите поддерживаемого AI-провайдера.')
  const apiKey = value.apiKey === undefined ? current?.apiKey : value.apiKey
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 4096) {
    throw new Error('Введите API Key.')
  }
  if (typeof value.model !== 'string' || !value.model.trim() || value.model.length > 200) {
    throw new Error('Введите название модели.')
  }
  if (typeof value.baseUrl !== 'string' || !value.baseUrl.trim()) throw new Error('Введите Base URL.')

  let url: URL
  try { url = new URL(value.baseUrl.trim()) } catch { throw new Error('Base URL должен быть корректным адресом.') }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Для Base URL нужен HTTPS (HTTP разрешён только для localhost).')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Base URL не должен содержать логин, пароль, параметры или фрагмент.')
  }
  const baseUrl = url.href.replace(/\/$/, '')
  if (baseUrl.length > 1000) throw new Error('Base URL слишком длинный.')
  return {
    provider: 'openai-compatible', baseUrl,
    apiKey: apiKey.trim(), model: value.model.trim(),
  }
}

export function createAISettingsStore() {
  let current: AISettings | null = null
  return {
    get: () => current,
    getPublic: (): PublicAISettings | { configured: false } => current
      ? { configured: true, provider: current.provider, baseUrl: current.baseUrl, model: current.model }
      : { configured: false },
    save(input: unknown) { current = validateAISettings(input, current) },
  }
}
