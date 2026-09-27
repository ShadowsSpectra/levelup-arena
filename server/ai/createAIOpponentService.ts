import type { ArenaSession, Character, Scenario } from '../../src/types/arena'
import type { AIMessage } from './AIProvider'
import { resolveAIModel, type AIConfig, type AIProviderRegistry } from './aiConfig'

type ReplyContext = { character: Character; scenario: Scenario; session: ArenaSession }
type OpponentService = { reply(context: ReplyContext): Promise<string> }

// Roleplay instructions belong to the Opponent layer, not AIProvider.
export function createAIOpponentService(options: {
  config: AIConfig
  providers: AIProviderRegistry
  createMessages: (context: ReplyContext) => AIMessage[]
}): OpponentService {
  return {
    async reply(context) {
      const { provider, model } = resolveAIModel('opponent', options.config, options.providers)
      const response = await provider.generate({
        model: model.model,
        apiEndpoint: model.apiEndpoint,
        messages: options.createMessages(context),
        responseFormat: 'text',
      })
      if (!response.content.trim()) throw new Error('AI opponent returned an empty response')
      return response.content
    },
  }
}
