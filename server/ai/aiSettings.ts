import type { AISettings } from '../../src/types/aiSettings'
export type { AISettings, PublicAISettings } from '../../src/types/aiSettings'

// Exact API roots, never wildcard hosts.
export const DEFAULT_ALLOWED_BASE_URLS = [
  'https://api.mistral.ai/v1',
  'https://api.openai.com/v1',
  'https://api.groq.com/openai/v1',
  'https://openrouter.ai/api/v1',
] as const

export type AIURLPolicy = { allowLocalhost: boolean; allowedBaseUrls: readonly string[] }

export function normalizeAIBaseUrl(input: unknown, allowLocalhost = false): string {
  if (typeof input !== 'string' || !input.trim() || input.length > 1000) throw new Error('Введите корректный Base URL.')
  let url: URL
  try { url = new URL(input.trim()) } catch { throw new Error('Base URL должен быть корректным адресом.') }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(allowLocalhost && local && url.protocol === 'http:')) {
    throw new Error('Для Base URL нужен HTTPS (HTTP localhost разрешён только в разработке).')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Base URL не должен содержать логин, пароль, параметры или фрагмент.')
  }
  if (!allowLocalhost && (local || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':'))) {
    throw new Error('Localhost и IP-адреса запрещены в production Base URL.')
  }
  return url.href.replace(/\/+$/, '')
}

export function validateAISettings(input: unknown, policy: AIURLPolicy = {
  allowLocalhost: false, allowedBaseUrls: DEFAULT_ALLOWED_BASE_URLS,
}): AISettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Заполните настройки AI.')
  const value = input as Record<string, unknown>
  if (Object.keys(value).some((key) => !['provider', 'baseUrl', 'apiKey', 'model'].includes(key))) {
    throw new Error('Некорректные поля настроек AI.')
  }
  if (value.provider !== 'openai-compatible') throw new Error('Выберите поддерживаемого AI-провайдера.')
  // This request must supply its own key; never reuse the server default key.
  const apiKey = value.apiKey
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 4096) {
    throw new Error('Введите API Key.')
  }
  if (typeof value.model !== 'string' || !value.model.trim() || value.model.length > 200) {
    throw new Error('Введите название модели.')
  }
  const baseUrl = normalizeAIBaseUrl(value.baseUrl, policy.allowLocalhost)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname)
  if (!(policy.allowLocalhost && local) && !policy.allowedBaseUrls.includes(baseUrl)) {
    throw new Error('Base URL не входит в список разрешённых AI endpoints приложения.')
  }
  return {
    provider: 'openai-compatible', baseUrl,
    apiKey: apiKey.trim(), model: value.model.trim(),
  }
}
