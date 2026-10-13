// Line box heights in the installed Google Chrome on macOS: offsetHeight of a
// 128px element holding 'm' plus one character drawn by a fallback font, for a
// few families; also the platform fonts DevTools reports for each element.
//
//   npm i playwright-core@1 && node measure_heights.mjs out.json
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FAMILIES = ['Times', 'Arial', 'Helvetica', 'br0k3nd3f4u17', 'Menlo', 'Avenir', 'Kohinoor Devanagari',
    'ITF Devanagari', 'Tamil Sangam MN', 'Hiragino Sans', 'Songti SC', 'Raanana', 'system-ui']
const TEXTS = ['m', 'm₹', 'm▁', 'm₺', 'm₸', 'mẞ', 'mॿ', 'mmmMMMmmmlllmmmLLL₹▁₺₸ẞॿ']
const GENERIC = /^(serif|sans-serif|monospace|system-ui)$/

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setContent('<!doctype html><meta charset=utf-8><body><div id=box></div></body>')
const cdp = await page.context().newCDPSession(page)
await cdp.send('DOM.enable')
await cdp.send('CSS.enable')
const out = {}
for (const fam of FAMILIES) {
    out[fam] = {}
    for (const t of TEXTS) {
        const h = await page.evaluate(({ fam, t, generic }) => {
            const box = document.getElementById('box')
            box.replaceChildren()
            const el = document.createElement('span')
            el.style.position = 'absolute'
            el.style.whiteSpace = 'nowrap'
            el.style.fontFamily = generic ? fam : `"${fam}"`
            el.style.fontSize = '128px'
            el.textContent = t
            box.appendChild(el)
            return { w: el.offsetWidth, h: el.offsetHeight }
        }, { fam, t, generic: GENERIC.test(fam) })
        const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
        const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '#box > span' })
        const fonts = nodeIds.length
            ? (await cdp.send('CSS.getPlatformFontsForNode', { nodeId: nodeIds[0] })).fonts.map(f => `${f.postScriptName}×${f.glyphCount}`)
            : []
        out[fam][t] = { ...h, fonts }
    }
}
await browser.close()
fs.writeFileSync(process.argv[2] || 'macos-heights.json', JSON.stringify({ out }))
console.log(`families: ${FAMILIES.length}`)
