import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await server.close() })

const { scrollToMobileArenaSection } = await server.ssrLoadModule('/src/pages/ArenaPage.tsx')

test('Arena setup scrolls to the selected section only on mobile and respects reduced motion', () => {
  const calls = []
  const target = { scrollIntoView: (options) => calls.push(options) }
  scrollToMobileArenaSection(target, false, false)
  scrollToMobileArenaSection(null, true, false)
  assert.deepEqual(calls, [])
  scrollToMobileArenaSection(target, true, false)
  scrollToMobileArenaSection(target, true, true)
  assert.deepEqual(calls, [
    { behavior: 'smooth', block: 'start' },
    { behavior: 'auto', block: 'start' },
  ])
})
