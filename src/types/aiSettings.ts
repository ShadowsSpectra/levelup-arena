export type AISettings = {
  provider: 'openai-compatible'
  baseUrl: string
  apiKey: string
  model: string
}

export type PublicAISettings = Omit<AISettings, 'apiKey'> & { configured: true }
export type AISettingsInfo = PublicAISettings | { configured: false }
