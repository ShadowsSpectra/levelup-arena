import type { AIProvider, AIRequest } from './AIProvider'

type Fetcher = typeof fetch
const PROVIDER_TIMEOUT_MS = 90_000

type ResponseDiagnostics = {
  httpStatus: number
  contentType: string | null
  bodyLengthBytes: number | null
  declaredContentLength: number | null
  emptyBody: boolean | null
  finishReason?: string
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
}

export class AIProviderError extends Error {
  constructor(message: string, public readonly kind: 'http' | 'network' | 'timeout' | 'response',
    public readonly httpStatus?: number, public readonly diagnostics?: ResponseDiagnostics) {
    super(message)
    this.name = 'AIProviderError'
  }
}

function responseDiagnostics(response: Response, bodyLengthBytes: number | null, data?: unknown): ResponseDiagnostics {
  const rawContentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  const knownContentTypes = new Set([
    'application/json', 'application/problem+json', 'application/octet-stream',
    'text/plain', 'text/html', 'text/event-stream',
  ])
  const rawContentLength = response.headers.get('content-length')
  const declaredContentLength = rawContentLength && /^\d+$/.test(rawContentLength)
    ? Number(rawContentLength) : null
  const diagnostics: ResponseDiagnostics = {
    httpStatus: response.status,
    contentType: rawContentType ? (knownContentTypes.has(rawContentType) ? rawContentType : 'other') : null,
    bodyLengthBytes,
    declaredContentLength: declaredContentLength !== null && Number.isSafeInteger(declaredContentLength)
      ? declaredContentLength : null,
    emptyBody: bodyLengthBytes === null ? null : bodyLengthBytes === 0,
  }
  if (!data || typeof data !== 'object') return diagnostics
  const envelope = data as { choices?: unknown; usage?: unknown }
  const firstChoice = Array.isArray(envelope.choices) ? envelope.choices[0] as { finish_reason?: unknown } | undefined : undefined
  if (firstChoice && typeof firstChoice.finish_reason === 'string' &&
    /^(stop|length|content_filter|tool_calls|function_call)$/.test(firstChoice.finish_reason)) {
    diagnostics.finishReason = firstChoice.finish_reason
  }
  if (envelope.usage && typeof envelope.usage === 'object') {
    const usage = envelope.usage as Record<string, unknown>
    const safeUsage: NonNullable<ResponseDiagnostics['usage']> = {}
    for (const [source, target] of [
      ['prompt_tokens', 'promptTokens'], ['completion_tokens', 'completionTokens'], ['total_tokens', 'totalTokens'],
    ] as const) {
      if (Number.isSafeInteger(usage[source]) && (usage[source] as number) >= 0) safeUsage[target] = usage[source] as number
    }
    if (Object.keys(safeUsage).length) diagnostics.usage = safeUsage
  }
  return diagnostics
}

function safeProviderText(value: string, apiKey: string): string {
  return value
    .replaceAll(apiKey, '[скрыто]')
    .replace(/\bBearer\s+[^\s"',;}]+/gi, 'Bearer [скрыто]')
    .replace(/\b(api[_-]?key|access[_-]?key|token|authorization)\s*[:=]\s*["']?[^\s"',;}]+/gi, '$1=[скрыто]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[скрыто]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 350)
}

function safeProviderDetails(body: string, apiKey: string): string | null {
  let data: unknown
  try { data = JSON.parse(body) } catch { return null }
  if (!data || typeof data !== 'object') return null
  const error = (data as { error?: unknown }).error
  if (typeof error === 'string') return safeProviderText(error, apiKey) || null
  if (!error || typeof error !== 'object') return null
  const details = error as { message?: unknown; code?: unknown; type?: unknown }
  const parts: string[] = []
  if (typeof details.code === 'string' && /^[\w.-]{1,80}$/.test(details.code)) {
    parts.push(`код ${safeProviderText(details.code, apiKey)}`)
  }
  if (typeof details.type === 'string' && /^[\w.-]{1,80}$/.test(details.type) && details.type !== details.code) {
    parts.push(`тип ${safeProviderText(details.type, apiKey)}`)
  }
  if (typeof details.message === 'string') {
    const message = safeProviderText(details.message, apiKey)
    if (message) parts.push(message)
  }
  return parts.length ? parts.join(' · ') : null
}

function networkFailure(error: unknown, timedOut: boolean): AIProviderError {
  if (timedOut || (error instanceof Error && error.name === 'TimeoutError')) {
    return new AIProviderError('Таймаут: провайдер не ответил за 90 секунд.', 'timeout')
  }
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined
  const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : ''
  const labels: Record<string, string> = {
    ENOTFOUND: 'DNS: имя сервера провайдера не найдено.',
    EAI_AGAIN: 'DNS: временная ошибка разрешения имени сервера.',
    ECONNREFUSED: 'Сервер провайдера отклонил TCP-соединение.',
    ECONNRESET: 'Соединение с провайдером было сброшено.',
    ETIMEDOUT: 'Сетевое соединение с провайдером истекло по времени.',
    EHOSTUNREACH: 'Сервер провайдера недоступен по сети.',
    ENETUNREACH: 'Сеть провайдера недоступна.',
    CERT_HAS_EXPIRED: 'TLS: сертификат сервера просрочен.',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'TLS: сертификат сервера не удалось проверить.',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'TLS: самоподписанный сертификат сервера.',
    ERR_TLS_CERT_ALTNAME_INVALID: 'TLS: имя сервера не совпадает с сертификатом.',
  }
  const safeCode = /^[A-Z][A-Z0-9_]{1,40}$/.test(code) ? ` Код: ${code}.` : ''
  return new AIProviderError(labels[code] ?? `Сетевой запрос не получил HTTP-ответа.${safeCode}`, 'network')
}

export function createOpenAICompatibleProvider(getApiKey: () => string, fetcher: Fetcher = fetch): AIProvider {
  return {
    async generate(request: AIRequest) {
      if (!request.apiEndpoint) throw new AIProviderError('Не указан Base URL модели.', 'network')
      const apiKey = getApiKey()
      if (!apiKey) throw new AIProviderError('Не указан API Key.', 'network')

      // Base URL includes the API prefix (for example /v1), not the endpoint path.
      const endpoint = `${request.apiEndpoint.replace(/\/+$/, '')}/chat/completions`
      const signal = AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
      let response: Response
      try {
        response = await fetcher(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: request.model,
            messages: request.messages,
            ...(request.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
          }),
          redirect: 'error',
          signal,
        })
      } catch (error) {
        throw networkFailure(error, signal.aborted)
      }

      if (!response.ok) {
        let details: string | null = null
        try {
          if (response.headers.get('content-type')?.includes('json')) {
            details = safeProviderDetails(await response.text(), apiKey)
          }
        } catch {
          // The status remains useful if the body cannot be read.
        }
        const hint = response.status === 401 || response.status === 403
          ? 'Проверьте ключ и права доступа.'
          : response.status === 404
            ? 'Проверьте Base URL, путь /chat/completions и Model.'
            : response.status === 429
              ? 'Достигнут лимит запросов или квота провайдера.'
              : response.status >= 500
                ? 'Ошибка на стороне провайдера.'
                : 'Провайдер отклонил запрос.'
        throw new AIProviderError(
          `Внешний AI: HTTP ${response.status}. ${details ? `Ответ провайдера: ${details}. ` : ''}${hint}`,
          'http', response.status,
        )
      }

      let body: ArrayBuffer
      try { body = await response.arrayBuffer() } catch {
        throw new AIProviderError(`Внешний AI: HTTP ${response.status}, ответ не является JSON.`, 'response',
          response.status, responseDiagnostics(response, null))
      }
      let data: unknown
      try { data = JSON.parse(new TextDecoder().decode(body)) } catch {
        throw new AIProviderError(`Внешний AI: HTTP ${response.status}, ответ не является JSON.`, 'response',
          response.status, responseDiagnostics(response, body.byteLength))
      }
      const content = (data as { choices?: { message?: { content?: unknown } }[] } | null)
        ?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || !content.trim()) {
        throw new AIProviderError(
          `Внешний AI: HTTP ${response.status}, некорректный ответ: нет текста choices[0].message.content.`,
          'response', response.status, responseDiagnostics(response, body.byteLength, data),
        )
      }
      return { content: content.trim() }
    },
  }
}
