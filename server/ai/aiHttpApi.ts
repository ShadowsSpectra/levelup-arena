import type { ArenaSession, Character, Scenario } from '../../src/types/arena'
import { mockOpponentService } from '../../src/services/opponentService'
import { createAIOpponentService } from './createAIOpponentService'
import { createAISettingsStore, validateAISettings, type AISettings } from './aiSettings'
import { AIProviderError, createOpenAICompatibleProvider } from './openAICompatibleProvider'
import { buildOpponentMessages } from './opponentPrompt'

type ReplyContext = { character: Character; scenario: Scenario; session: ArenaSession }
type Next = (error?: unknown) => void
type RequestLike = {
  url?: string
  method?: string
  headers?: { origin?: string; host?: string }
}
type ResponseLike = {
  writeHead(status: number, headers: Record<string, string>): void
  end(body: string): void
}

function send(res: ResponseLike, status: number, body: object) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readJson(req: RequestLike): Promise<unknown> {
  let body = ''
  for await (const chunk of req as AsyncIterable<Uint8Array>) {
    body += String(chunk)
    if (body.length > 128_000) throw new Error('Запрос слишком большой.')
  }
  try { return JSON.parse(body) } catch { throw new Error('Некорректные данные запроса.') }
}

export function createAIHttpApi(options: { fetcher?: typeof fetch } = {}) {
  const settings = createAISettingsStore()

  async function check(candidate: AISettings) {
    const provider = createOpenAICompatibleProvider(() => candidate.apiKey, options.fetcher)
    await provider.generate({
      model: candidate.model, apiEndpoint: candidate.baseUrl,
      messages: [{ role: 'user', content: 'Ответь одним словом: OK' }],
    })
  }

  return async function aiHttpApi(req: RequestLike, res: ResponseLike, next: Next) {
    const path = req.url?.split('?')[0]
    if (!path?.startsWith('/api/ai/')) return next()
    const origin = req.headers?.origin
    let sameOrigin = true
    if (origin) {
      try { sameOrigin = new URL(origin).host === req.headers?.host } catch { sameOrigin = false }
    }
    if (!sameOrigin) {
      send(res, 403, { error: 'Запрос из другого источника запрещён.' })
      return
    }

    try {
      if (path === '/api/ai/settings' && req.method === 'GET') {
        send(res, 200, settings.getPublic())
      } else if (path === '/api/ai/models-check' && req.method === 'GET') {
        const configured = settings.get()
        if (!configured) {
          send(res, 409, { endpoint: '/models', error: 'AI settings are not saved in this server session.' })
          return
        }
        try {
          const response = await (options.fetcher ?? fetch)(`${configured.baseUrl.replace(/\/+$/, '')}/models`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${configured.apiKey}` },
            redirect: 'error',
            signal: AbortSignal.timeout(20_000),
          })
          await response.body?.cancel().catch(() => {})
          send(res, 200, { endpoint: '/models', providerStatus: response.status, ok: response.ok })
        } catch {
          send(res, 502, { endpoint: '/models', error: 'No HTTP response from the provider.' })
        }
      } else if (path === '/api/ai/check' && req.method === 'POST') {
        const candidate = validateAISettings(await readJson(req), settings.get())
        await check(candidate)
        send(res, 200, { connected: true })
      } else if (path === '/api/ai/settings' && req.method === 'POST') {
        settings.save(await readJson(req))
        send(res, 200, settings.getPublic())
      } else if (path === '/api/ai/opponent' && req.method === 'POST') {
        const context = await readJson(req) as ReplyContext
        if (!context?.character?.name || !context?.scenario?.title ||
          !Array.isArray(context?.session?.messages) || !Number.isInteger(context.session.currentTurn)) {
          throw new Error('Некорректный контекст переговоров.')
        }
        const configured = settings.get()
        if (configured) {
          try {
            const service = createAIOpponentService({
              config: {
                serverEndpoint: '/api/ai/opponent',
                models: { opponent: {
                  provider: configured.provider, model: configured.model, apiEndpoint: configured.baseUrl,
                } },
              },
              providers: {
                'openai-compatible': createOpenAICompatibleProvider(() => configured.apiKey, options.fetcher),
              },
              createMessages: buildOpponentMessages,
            })
            send(res, 200, { reply: await service.reply(context), mode: 'real' })
            return
          } catch (error) {
            // In demo mode a genuine provider failure must not interrupt an Arena session.
            const warning = error instanceof AIProviderError && error.kind === 'timeout'
              ? 'Ожидание AI истекло. Показан Mock-ответ.'
              : 'AI недоступен. Показан Mock-ответ.'
            send(res, 200, { reply: await mockOpponentService.reply(context), mode: 'mock', warning })
            return
          }
        }
        send(res, 200, { reply: await mockOpponentService.reply(context), mode: 'mock' })
      } else {
        send(res, 404, { error: 'AI endpoint не найден.' })
      }
    } catch (error) {
      if (error instanceof AIProviderError) {
        send(res, 502, {
          stage: 'provider', kind: error.kind, httpStatus: error.httpStatus,
          error: error.message,
        })
        return
      }
      send(res, 400, { error: error instanceof Error ? error.message : 'Ошибка запроса.' })
    }
  }
}
