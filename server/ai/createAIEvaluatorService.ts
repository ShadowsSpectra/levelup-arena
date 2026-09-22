import type { ArenaSession, Character, Scenario } from '../../src/types/arena'
import type { ArenaEvaluation } from '../../src/types/arenaEvaluation'
import type { AIMessage } from './AIProvider'
import { resolveAIModel, type AIConfig, type AIProviderRegistry } from './aiConfig'

export type EvaluatorContext = {
  character: Character
  scenario: Scenario
  session: ArenaSession
}

export interface EvaluatorService {
  evaluate(context: EvaluatorContext): Promise<ArenaEvaluation>
}

export function createAIEvaluatorService(options: {
  config: AIConfig
  providers: AIProviderRegistry
  createMessages: (context: EvaluatorContext) => AIMessage[]
  parseResult: (raw: string, context: EvaluatorContext) => ArenaEvaluation
}): EvaluatorService {
  return {
    async evaluate(context) {
      const { provider, model } = resolveAIModel('evaluator', options.config, options.providers)
      const response = await provider.generate({
        model: model.model,
        apiEndpoint: model.apiEndpoint,
        messages: options.createMessages(context),
        responseFormat: 'json',
      })
      return options.parseResult(response.content, context)
    },
  }
}
