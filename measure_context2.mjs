// Per-character advances inside probe strings in the installed Google Chrome on
// macOS: each string is laid out in a span at 100px and every character's box
// is read with a DOM Range; DevTools reports the platform fonts of the span.
//
//   npm i playwright-core@1 && node measure_context2.mjs out.json
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FAMILIES = ['Arial', 'Helvetica', 'Times', 'Menlo', 'Avenir', 'Verdana', 'br0k3nd3f4u17', 'system-ui']
const STRINGS = ['MlL₹▁₺₸ẞॿiIwmW', '₹▁₺₸ẞॿ', '₹ẞ', '▁ẞ', '₹▁ẞ', '▁₺ẞ', '₺₸ẞ', '₹▁₺ẞ', 'ẞ', 'aẞ', '₹▁₺₸ẞ', 'ẞॿ', '₸ẞॿ']
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setContent('<!doctype html><meta charset=utf-8><body><div id=box></div></body>')
const cdp = await page.context().newCDPSession(page)
await cdp.send('DOM.enable')
await cdp.send('CSS.enable')
const out = {}
for (const fam of FAMILIES) {
    const css = GENERIC.test(fam) ? fam : `"${fam}"`
    out[fam] = {}
    for (const s of STRINGS) {
        const adv = await page.evaluate(({ css, s }) => {
            const box = document.getElementById('box')
            box.replaceChildren()
            const span = document.createElement('span')
            span.style.cssText = `font: 100px ${css}; white-space: pre`
            span.textContent = s
            box.appendChild(span)
            const node = span.firstChild
            const res = []
            let i = 0
            for (const ch of s) {
                const r = document.createRange()
                r.setStart(node, i)
                r.setEnd(node, i + ch.length)
                res.push(r.getBoundingClientRect().width)
                i += ch.length
            }
            return res
        }, { css, s })
        const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
        const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '#box > span' })
        const fonts = nodeIds.length
            ? (await cdp.send('CSS.getPlatformFontsForNode', { nodeId: nodeIds[0] })).fonts.map(f => `${f.postScriptName}×${f.glyphCount}`)
            : []
        out[fam][s] = { adv, fonts }
    }
}
await browser.close()
fs.writeFileSync(process.argv[2] || 'macos-context2.json', JSON.stringify({ out }))
console.log(`families: ${FAMILIES.length}`)
