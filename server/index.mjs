import { fileURLToPath } from 'node:url'
import { access } from 'node:fs/promises'
import { createAIHttpApi } from '../dist-server/ai.mjs'
import { createProductionServer } from './httpServer.mjs'

const port = Number(process.env.PORT || 3000)
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0)
if (!Number.isInteger(port) || port < 1 || port > 65535 ||
  !Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) {
  throw new Error('Invalid PORT or TRUST_PROXY_HOPS configuration.')
}
const distDirectory = fileURLToPath(new URL('../dist/', import.meta.url))
await access(new URL('../dist/index.html', import.meta.url))
// Environment secrets are read only by the private server bundle, never Vite's client build.
let api
try { api = createAIHttpApi({ env: process.env, production: true }) }
catch { throw new Error('Invalid server AI environment configuration. Check the documented AI variables.') }
const server = createProductionServer({ api, distDirectory, trustProxyHops })
server.listen(port, '0.0.0.0', () => console.info(`LevelUP Arena listening on port ${port}`))
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
  server.close(() => process.exit(0))
  server.closeIdleConnections()
  setTimeout(() => { server.closeAllConnections(); process.exit(0) }, 100_000).unref()
})
