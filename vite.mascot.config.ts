import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

// Separate development entry: never imported by the application or its build.
export default defineConfig(({ command, isPreview }) => {
  if (command !== 'serve' || isPreview) {
    throw new Error('Mascot Playground is development-only. Use npm run dev:mascot.')
  }
  return {
    root: 'dev/__tests__/mascot',
    publicDir: '../../../public',
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5180,
      strictPort: true,
      fs: {
        allow: [searchForWorkspaceRoot('.')],
        deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/server/**'],
      },
    },
  }
})
