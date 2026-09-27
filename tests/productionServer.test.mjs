import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer as createViteServer } from 'vite'
import { createProductionServer } from '../server/httpServer.mjs'

async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'levelup-production-'))
  await writeFile(join(directory, 'index.html'), '<html>LevelUP fixture</html>')
  await writeFile(join(directory, 'app.js'), 'console.info("fixture")')
  const server = createProductionServer({ distDirectory: directory,
    api: async (_req, res) => { res.writeHead(200); res.end('{"real":true}') }, ...options })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }) })
  return `http://127.0.0.1:${server.address().port}`
}

test('production routes health, static assets, SPA and API separately; private paths are inaccessible', async t => {
  let calls = 0
  const url = await fixture(t, { api: async (_req, res) => { calls++; res.writeHead(200); res.end('{"api":true}') } })
  assert.deepEqual(await (await fetch(`${url}/health`)).json(), { ok: true })
  assert.equal(calls, 0)
  assert.match(await (await fetch(`${url}/app.js`)).text(), /fixture/)
  assert.match(await (await fetch(`${url}/arena`, { headers: { accept: 'text/html' } })).text(), /LevelUP fixture/)
  assert.deepEqual(await (await fetch(`${url}/api/ai/settings`)).json(), { api: true })
  for (const path of ['/api/nope', '/missing.js', '/server/content/scenarios.json', '/dist-server/ai.mjs', '/.env', '/%2eenv', '/src/main.tsx']) {
    assert.equal((await fetch(`${url}${path}`, { headers: { accept: 'text/html' } })).status, 404, path)
  }
})

test('body limit counts actual bytes, including chunked UTF-8; never invokes AI for oversized input', async t => {
  let calls = 0
  const url = await fixture(t, { limits: { bodyBytes: 16 }, api: async (_req, res) => { calls++; res.end('{}') } })
  assert.equal((await fetch(`${url}/api/ai/check`, { method: 'POST', body: 'я'.repeat(9) })).status, 413)
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('я'.repeat(9))); controller.close() } })
  assert.equal((await fetch(`${url}/api/ai/check`, { method: 'POST', body: stream, duplex: 'half' })).status, 413)
  assert.equal(calls, 0)
})

test('rate limits ignore forged forwarded addresses and leave health available', async t => {
  const url = await fixture(t, { limits: { requestsPerMinute: 1 } })
  assert.equal((await fetch(`${url}/api/ai/settings`)).status, 200)
  const blocked = await fetch(`${url}/api/ai/settings`, { headers: { 'x-forwarded-for': '1.2.3.4' } })
  assert.equal(blocked.status, 429)
  assert.equal(blocked.headers.get('retry-after'), '60')
  assert.equal((await fetch(`${url}/health`)).status, 200)
})

test('concurrency limits release slots after failure and preserve later retries', async t => {
  let complete, began
  const started = new Promise(resolve => { began = resolve })
  const url = await fixture(t, { limits: { concurrencyGlobal: 1 }, api: async (_req, res) => {
    began(); await new Promise(resolve => { complete = resolve }); res.writeHead(502); res.end('{"error":"provider failed"}')
  } })
  const first = fetch(`${url}/api/ai/check`, { method: 'POST', body: '{}' })
  await started
  assert.equal((await fetch(`${url}/api/ai/check`, { method: 'POST', body: '{}' })).status, 429)
  complete(); assert.equal((await first).status, 502)
  const retry = fetch(`${url}/api/ai/check`, { method: 'POST', body: '{}' })
  await new Promise(resolve => setTimeout(resolve, 30))
  complete(); assert.equal((await retry).status, 502)
})

test('production wrapper reuses authoritative AI API, rejects cross-origin and has no missing-config Mock', async t => {
  const vite = await createViteServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' })
  t.after(() => vite.close())
  const { createAIHttpApi } = await vite.ssrLoadModule('/server/ai/aiHttpApi.ts')
  const url = await fixture(t, { api: createAIHttpApi({ env: {}, production: true }) })
  const missing = await fetch(`${url}/api/ai/check`, { method: 'POST', body: '{}' })
  assert.equal(missing.status, 409)
  assert.doesNotMatch(await missing.text(), /"reply"|"mode":"mock"/)
  assert.equal((await fetch(`${url}/api/ai/check`, { method: 'POST', body: '{}', headers: { origin: 'https://evil.example' } })).status, 403)
  const content = await (await fetch(`${url}/api/ai/arena-content`)).text()
  assert.doesNotMatch(content, /privateInformation|hiddenData|validAgreementPaths|playerMinimumConditions/)
  assert.equal((await fetch(`${url}/api/ai/unknown`)).status, 404)
})
