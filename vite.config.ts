import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createAIHttpApi } from './server/ai/aiHttpApi'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-ai-api',
      configureServer(server) {
        const api = createAIHttpApi()
        server.middlewares.use((req, res, next) => {
          void api(req as Parameters<typeof api>[0], res as Parameters<typeof api>[1], next)
        })
      },
      configurePreviewServer(server) {
        const api = createAIHttpApi()
        server.middlewares.use((req, res, next) => {
          void api(req as Parameters<typeof api>[0], res as Parameters<typeof api>[1], next)
        })
      },
    },
  ],
})
