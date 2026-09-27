import { defineConfig } from 'vite'

// Private runtime artifact: never place server code/content in the static dist directory.
export default defineConfig({
  build: {
    ssr: 'server/ai/aiHttpApi.ts',
    outDir: 'dist-server',
    rollupOptions: { output: { entryFileNames: 'ai.mjs' } },
  },
})
