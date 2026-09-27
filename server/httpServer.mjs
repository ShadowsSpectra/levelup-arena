import { createServer } from 'node:http'
import { readFile, realpath, stat } from 'node:fs/promises'
import { resolve, relative, extname, sep } from 'node:path'
import { isIP } from 'node:net'

export const DEMO_LIMITS = Object.freeze({
  bodyBytes: 128_000,
  requestsPerMinute: 60,
  globalRequestsPerMinute: 300,
  concurrencyPerClient: 2,
  concurrencyGlobal: 6,
  maxClients: 5000,
})
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' }

export function createProductionServer({ api, distDirectory, limits = DEMO_LIMITS, trustProxyHops = 0 }) {
  const policy = { ...DEMO_LIMITS, ...limits }
  const clients = new Map()
  let windowStart = Date.now(), globalRequests = 0, active = 0
  const root = resolve(distDirectory)
  function send(res, status, body, headers = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store', ...headers })
    res.end(JSON.stringify(body))
  }
  function acquire(req, providerRequest) {
    const now = Date.now()
    if (now - windowStart >= 60_000) {
      windowStart = now; globalRequests = 0
      for (const [key, client] of clients) if (!client.active && now - client.start >= 60_000) clients.delete(key)
    }
    let address = req.socket.remoteAddress || 'unknown'
    // Only enable behind a known proxy chain. Untrusted forwarded headers are ignored by default.
    if (trustProxyHops > 0) {
      const chain = String(req.headers['x-forwarded-for'] || '').split(',').map(value => value.trim())
      const candidate = chain[chain.length - trustProxyHops]
      if (candidate && isIP(candidate)) address = candidate
    }
    let client = clients.get(address)
    if (!client) {
      if (clients.size >= policy.maxClients) return null
      client = { start: now, requests: 0, active: 0 }; clients.set(address, client)
    }
    if (now - client.start >= 60_000) { client.start = now; client.requests = 0 }
    if (client.requests >= policy.requestsPerMinute || globalRequests >= policy.globalRequestsPerMinute) return null
    client.requests++; globalRequests++
    if (providerRequest && (active >= policy.concurrencyGlobal || client.active >= policy.concurrencyPerClient)) return null
    if (providerRequest) { active++; client.active++ }
    return () => { if (providerRequest) { active--; client.active-- } }
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    let pathname
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) }
    catch { return send(res, 400, { error: 'Некорректный адрес.' }) }
    if (pathname === '/health') {
      if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'Method not allowed' })
      return send(res, 200, { ok: true })
    }
    if (pathname.startsWith('/api/')) {
      if (!pathname.startsWith('/api/ai/')) return send(res, 404, { error: 'Not found' })
      const providerRequest = !['/api/ai/settings', '/api/ai/arena-content'].includes(pathname)
      const release = acquire(req, providerRequest)
      if (!release) return send(res, 429, { error: 'Слишком много запросов. Попробуйте позже.' }, { 'Retry-After': '60' })
      try {
        if (Number(req.headers['content-length']) > policy.bodyBytes) {
          return send(res, 413, { error: 'Запрос слишком большой.' }, { Connection: 'close' })
        }
        const chunks = []; let bytes = 0
        for await (const chunk of req) {
          bytes += chunk.length
          if (bytes > policy.bodyBytes) return send(res, 413, { error: 'Запрос слишком большой.' }, { Connection: 'close' })
          chunks.push(chunk)
        }
        const body = Buffer.concat(chunks)
        // Preserve the middleware contract, with a single UTF-8-safe bounded body chunk.
        const input = { url: req.url, method: req.method, headers: req.headers,
          async *[Symbol.asyncIterator]() { yield body } }
        await api(input, res, () => send(res, 404, { error: 'Not found' }))
      } catch {
        if (!res.headersSent && !res.destroyed) send(res, 500, { error: 'Сервер не смог обработать запрос.' })
      } finally { release() }
      return
    }
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'Method not allowed' })
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.')) ||
      /^\/(?:server|dist-server|src|node_modules)(?:\/|$)/.test(pathname)) return send(res, 404, { error: 'Not found' })
    try {
      let filename = resolve(root, `.${pathname}`)
      let info = await stat(filename).catch(() => null)
      if (!info?.isFile()) {
        if (extname(pathname) || !(req.headers.accept || '').includes('text/html')) return send(res, 404, { error: 'Not found' })
        filename = resolve(root, 'index.html')
      }
      const canonical = await realpath(filename)
      const inside = relative(await realpath(root), canonical)
      if (inside === '..' || inside.startsWith(`..${sep}`) || resolve(root, inside) !== canonical) return send(res, 404, { error: 'Not found' })
      const body = await readFile(canonical)
      res.writeHead(200, { 'Content-Type': `${MIME[extname(canonical)] || 'application/octet-stream'}; charset=utf-8`,
        'Cache-Control': 'no-cache', 'Content-Length': String(body.length) })
      res.end(req.method === 'HEAD' ? undefined : body)
    } catch { send(res, 404, { error: 'Not found' }) }
  })
  server.headersTimeout = 10_000
  server.requestTimeout = 30_000
  return server
}
