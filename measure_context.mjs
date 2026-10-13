// Text in context in the installed Google Chrome on macOS: canvas widths of every
// prefix and of every two- and three-character slice of a few probe strings, and
// the platform fonts (with glyph counts) DevTools reports for an element holding
// the whole string.
//
//   npm i playwright-core@1 && node measure_context.mjs out.json
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FAMILIES = ['Arial', 'Helvetica', 'Times', 'Helvetica Neue', 'Menlo', 'Avenir', 'Georgia', 'Verdana',
    'Courier New', 'Al Bayan', 'br0k3nd3f4u17', 'system-ui', 'serif', 'sans-serif', 'monospace']
const STRINGS = ['MlL₹▁₺₸ẞॿiIwmW', 'mmmMMMmmmlllmmmLLL₹▁₺₸ẞॿ', '₹▁₺₸ẞॿ']
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
    const canvas = await page.evaluate(({ css, STRINGS }) => {
        const c = document.createElement('canvas').getContext('2d')
        c.font = `2048px ${css}`
        const r = {}
        for (const s of STRINGS) {
            const chars = [...s]
            const prefix = chars.map((_, i) => c.measureText(chars.slice(0, i + 1).join('')).width)
            const slices = {}
            for (let n = 2; n <= 3; n++) {
                for (let i = 0; i + n <= chars.length; i++) {
                    const t = chars.slice(i, i + n).join('')
                    slices[t] = c.measureText(t).width
                }
            }
            r[s] = { prefix, slices }
        }
        return r
    }, { css, STRINGS })
    const fonts = {}
    for (const s of STRINGS) {
        await page.evaluate(({ css, s }) => {
            const box = document.getElementById('box')
            box.style.font = `32px ${css}`
            box.textContent = s
        }, { css, s })
        const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#box' })
        const r = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
        fonts[s] = r.fonts.map(f => ({ ps: f.postScriptName, family: f.familyName, glyphs: f.glyphCount }))
    }
    out[fam] = { canvas, fonts }
}
await browser.close()
fs.writeFileSync(process.argv[2] || 'macos-context.json', JSON.stringify({ out }))
console.log(`families: ${FAMILIES.length}`)
