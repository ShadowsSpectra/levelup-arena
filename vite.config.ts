import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createAIHttpApi } from './server/ai/aiHttpApi'

export default defineConfig(({ mode }) => {
  // Secrets stay in server middleware closures, never in define/import.meta.env.
  const env = loadEnv(mode, '.', 'AI_')
  return {
  server: {
    fs: {
      // Preserve Vite's default sensitive-file denylist and exclude server sources.
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/server/**'],
    },
  },
  plugins: [
    react(),
    {
      name: 'local-ai-api',
      configureServer(server) {
        const api = createAIHttpApi({ env, production: mode !== 'development' })
        server.middlewares.use((req, res, next) => {
          void api(req as Parameters<typeof api>[0], res as Parameters<typeof api>[1], next)
        })
      },
      configurePreviewServer(server) {
        const api = createAIHttpApi({ env, production: true })
        server.middlewares.use((req, res, next) => {
          void api(req as Parameters<typeof api>[0], res as Parameters<typeof api>[1], next)
        })
      },
    },
  ],
  }
})
