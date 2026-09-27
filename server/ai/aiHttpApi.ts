import { createAIOpponentService } from './createAIOpponentService'
import { createAIEvaluatorService } from './createAIEvaluatorService'
import type { AISettings } from './aiSettings'
import { createRuntimeAISettings } from './runtimeAISettings'
import { EvaluationValidationError, parseArenaEvaluation } from './evaluatorResult'
import { buildEvaluatorMessages } from './evaluatorPrompt'
import { AIProviderError, createOpenAICompatibleProvider } from './openAICompatibleProvider'
import { buildOpponentMessages } from './opponentPrompt'
import { getPublicArenaContent, resolveFullArenaCards } from '../content/arenaSources'
import { resolveArenaAIRequest } from './arenaRequest'

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

async function readJson(req: RequestLike): Promise<unknown> {
  let body = ''
  for await (const chunk of req as AsyncIterable<Uint8Array>) {
    body += String(chunk)
    if (body.length > 128_000) throw new Error('Запрос слишком большой.')
  }
  try { return JSON.parse(body) } catch { throw new Error('Некорректные данные запроса.') }
}

export function createAIHttpApi(options: {
  fetcher?: typeof fetch
  resolveCards?: typeof resolveFullArenaCards
  env?: Readonly<Record<string, string | undefined>>
  production?: boolean
} = {}) {
  const settings = createRuntimeAISettings(options)
  const resolveCards = options.resolveCards ?? resolveFullArenaCards

  async function check(candidate: AISettings) {
    const provider = createOpenAICompatibleProvider(() => candidate.apiKey, options.fetcher)
    await provider.generate({
      model: candidate.model, apiEndpoint: candidate.baseUrl,
      messages: [{ role: 'user', content: 'Ответь одним словом: OK' }],
    })
  }

  return async function aiHttpApi(req: RequestLike, res: ResponseLike, next: Next) {
    let requestApiKey: string | undefined
    function send(res: ResponseLike, status: number, body: object) {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(settings.stringifyResponse(body, requestApiKey))
    }
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
      if (path === '/api/ai/arena-content' && req.method === 'GET') {
        send(res, 200, getPublicArenaContent())
      } else if (path === '/api/ai/settings' && req.method === 'GET') {
        send(res, 200, settings.getPublicDefault())
      } else if (path === '/api/ai/models-check' && (req.method === 'GET' || req.method === 'POST')) {
        const configured = settings.resolveCheck(req.method === 'POST' ? await readJson(req) : {})
        if (!configured) {
          send(res, 409, { endpoint: '/models', error: 'AI приложения не настроен. Укажите BYOK для этого запроса.' })
          return
        }
        requestApiKey = configured.apiKey
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
        const candidate = settings.resolveCheck(await readJson(req))
        if (!candidate) {
          send(res, 409, { error: 'AI приложения не настроен. Введите собственные настройки AI.' })
          return
        }
        requestApiKey = candidate.apiKey
        await check(candidate)
        send(res, 200, { connected: true })
      } else if (path === '/api/ai/settings' && req.method === 'POST') {
        send(res, 405, { error: 'Настройки BYOK сохраняются только в памяти вашей вкладки.' })
      } else if (path === '/api/ai/evaluate' && req.method === 'POST') {
        const input = await readJson(req)
        const context = resolveArenaAIRequest(input, 'evaluator', resolveCards)
        const configured = settings.resolveRequest(input)
        if (!configured) {
          send(res, 409, { error: 'AI не настроен. Диалог сохранён — настройте AI и повторите оценку.' })
          return
        }
        requestApiKey = configured.apiKey
        try {
          const service = createAIEvaluatorService({
            config: {
              serverEndpoint: '/api/ai/evaluate',
              models: { evaluator: {
                provider: configured.provider, model: configured.model, apiEndpoint: configured.baseUrl,
              } },
            },
            providers: {
              'openai-compatible': createOpenAICompatibleProvider(() => configured.apiKey, options.fetcher),
            },
            createMessages: buildEvaluatorMessages,
            parseResult: parseArenaEvaluation,
          })
          send(res, 200, { evaluation: await service.evaluate(context), mode: 'real' })
        } catch (error) {
          if (error instanceof EvaluationValidationError) {
            send(res, 502, {
              stage: 'evaluator-validation',
              error: `Ответ Evaluator не прошёл проверку: ${error.message}`,
            })
            return
          }
          throw error
        }
      } else if (path === '/api/ai/opponent' && req.method === 'POST') {
        const input = await readJson(req)
        const context = resolveArenaAIRequest(input, 'opponent', resolveCards)
        const configured = settings.resolveRequest(input)
        if (!configured) {
          send(res, 409, { error: 'AI не настроен. Откройте AI Settings и повторите отправку.' })
          return
        }
        requestApiKey = configured.apiKey
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
      } else {
        send(res, 404, { error: 'AI endpoint не найден.' })
      }
    } catch (error) {
      if (error instanceof AIProviderError) {
        send(res, 502, {
          stage: 'provider', kind: error.kind, httpStatus: error.httpStatus,
          error: error.message, ...(error.diagnostics ? { diagnostics: error.diagnostics } : {}),
        })
        return
      }
      send(res, 400, { error: error instanceof Error ? error.message : 'Ошибка запроса.' })
    }
  }
}
