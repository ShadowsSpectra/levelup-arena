import { DEFAULT_ALLOWED_BASE_URLS, normalizeAIBaseUrl, validateAISettings } from './aiSettings'
import type { AISettingsInfo } from '../../src/types/aiSettings'

type Environment = Readonly<Record<string, string | undefined>>

export function createRuntimeAISettings(options: { env?: Environment; production?: boolean } = {}) {
  const env: Environment = options.env ?? (globalThis as unknown as { process: { env: Environment } }).process.env
  // Secure by default. Only an explicitly development runtime permits loopback.
  const production = options.production ?? env.NODE_ENV !== 'development'
  const allowedBaseUrls = env.AI_BYOK_ALLOWED_BASE_URLS === undefined
    ? [...DEFAULT_ALLOWED_BASE_URLS]
    : env.AI_BYOK_ALLOWED_BASE_URLS.split(',').filter((url) => url.trim()).map((url) => normalizeAIBaseUrl(url, !production))
  const policy = { allowLocalhost: !production, allowedBaseUrls }
  const hasDefault = ['AI_PROVIDER', 'AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL'].some((key) => env[key] !== undefined)
  const defaultSettings = hasDefault ? Object.freeze(validateAISettings({
    provider: env.AI_PROVIDER, baseUrl: env.AI_BASE_URL, apiKey: env.AI_API_KEY, model: env.AI_MODEL,
  }, policy)) : null

  return {
    stringifyResponse(body: object, requestApiKey?: string): string {
      const secrets = [defaultSettings?.apiKey, requestApiKey].filter((key): key is string => Boolean(key))
      return JSON.stringify(body, (_key, value: unknown) => typeof value === 'string'
        ? secrets.reduce((safe, secret) => safe.replaceAll(secret, '[скрыто]'), value)
        : value)
    },
    getPublicDefault(): AISettingsInfo {
      return defaultSettings ? {
        configured: true, provider: defaultSettings.provider,
        baseUrl: defaultSettings.baseUrl, model: defaultSettings.model,
      } : { configured: false }
    },
    resolveRequest(input: unknown) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Некорректный запрос AI.')
      const value = input as Record<string, unknown>
      // Presence (including null/undefined) must never become silent default fallback.
      return Object.prototype.hasOwnProperty.call(value, 'ai')
        ? validateAISettings(value.ai, policy)
        : defaultSettings
    },
    resolveCheck(input: unknown) {
      if (!input || typeof input !== 'object' || Array.isArray(input) ||
          Object.keys(input).some((key) => key !== 'ai')) throw new Error('Некорректный запрос проверки AI.')
      return this.resolveRequest(input)
    },
  }
}
