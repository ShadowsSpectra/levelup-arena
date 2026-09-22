import type { AIProvider } from './AIProvider'

export type AITask = 'opponent' | 'evaluator'

export type AIModelConfig = {
  provider: string
  model: string
  // Optional upstream provider URL. It is used only by a server-side provider.
  apiEndpoint?: string
}

export type AIConfig = {
  // Future application-owned server/serverless route; safe to expose, unlike secrets.
  serverEndpoint: string
  models: Partial<Record<AITask, AIModelConfig>>
}

export type AIProviderRegistry = Readonly<Record<string, AIProvider>>

export function resolveAIModel(
  task: AITask,
  config: AIConfig,
  providers: AIProviderRegistry,
): { provider: AIProvider; model: AIModelConfig } {
  const model = config.models[task]
  if (!model) throw new Error(`No AI model configured for ${task}`)

  const provider = providers[model.provider]
  if (!provider) throw new Error(`AI provider "${model.provider}" is not registered`)

  return { provider, model }
}
