import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await server.close() })

const { scrollToArenaSection } = await server.ssrLoadModule('/src/pages/ArenaPage.tsx')

test('Arena setup scrolls to the selected section at any width and respects reduced motion', () => {
  const calls = []
  const target = { scrollIntoView: (options) => calls.push(options) }
  scrollToArenaSection(null, false)
  assert.deepEqual(calls, [])
  scrollToArenaSection(target, false)
  scrollToArenaSection(target, true)
  assert.deepEqual(calls, [
    { behavior: 'smooth', block: 'start' },
    { behavior: 'auto', block: 'start' },
  ])
})
