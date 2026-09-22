// Server-side model access only. Provider implementations must keep credentials here,
// never in React code or Vite's VITE_* environment variables.
export type AIMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AIRequest = {
  model: string
  messages: AIMessage[]
  responseFormat?: 'text' | 'json'
  apiEndpoint?: string
}

export type AIResponse = {
  content: string
}

export interface AIProvider {
  generate(request: AIRequest): Promise<AIResponse>
}
