import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer, resolveConfig } from 'vite'

const vite = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
after(async () => { await vite.close() })
const { Mascot } = await vite.ssrLoadModule('/src/components/mascot/Mascot.tsx')

test('all seven supplied mascot PNGs have a matching canvas for layered animation', async () => {
  for (const frame of ['idle', 'blink', 'happy', 'judge', 'point', 'point-blink', 'tail']) {
    const png = await readFile(new URL(`../public/mascot/cat-${frame}.png`, import.meta.url))
    assert.equal(png.subarray(1, 4).toString(), 'PNG')
    assert.equal(png.readUInt32BE(16), 1254)
    assert.equal(png.readUInt32BE(20), 1254)
  }
})

test('Mascot renders each emotion over its separate tail at all supported sizes', () => {
  for (const state of ['idle', 'happy', 'judge', 'point']) {
    for (const size of [56, 96, 160]) {
      const html = renderToStaticMarkup(createElement(Mascot, { state, size }))
      assert.ok(html.indexOf('class="mascot__tail') < html.indexOf('class="mascot__body'))
      assert.ok(html.includes(`src="/mascot/cat-${state}.png"`))
      assert.ok(html.includes(`--mascot-size:${size}px`))
      assert.ok(html.includes('role="img"'))
    }
  }
})

test('Playground refuses production builds and preview', async () => {
  await assert.rejects(resolveConfig({ configFile: 'vite.mascot.config.ts', configLoader: 'runner' }, 'build'), /development-only/)
  await assert.rejects(resolveConfig({ configFile: 'vite.mascot.config.ts', configLoader: 'runner' }, 'serve', 'production', 'production', true), /development-only/)
})
