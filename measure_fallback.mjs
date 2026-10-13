// Which platform font the installed Google Chrome on macOS actually uses for each
// character, per requested family (DevTools CSS.getPlatformFontsForNode). Each
// character is placed alone in its own element, so the answer is the system
// fallback choice for that character with that family first in the list.
//
// Written per family: the most used font (the family's own face) and, for every
// character drawn by a different font, that font's PostScript name.
//
//   npm i playwright-core@1 && node measure_fallback.mjs out.json
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FAMILIES = JSON.parse(fs.readFileSync(new URL('./families.json', import.meta.url))).all
const RANGES = [[0x20, 0x7E], [0xA0, 0x17F], [0x370, 0x3FF], [0x400, 0x4FF],
    [0x2000, 0x206F], [0x20A0, 0x20CF], [0x2190, 0x21FF], [0x2580, 0x259F]]
const EXTRA = [0x1E9E, 0x097F, 0x20B9, 0x20BA, 0x20B8, 0x2581, 0xFB01, 0xFB02]
const CODEPOINTS = [...new Set([...RANGES.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i)), ...EXTRA])]
    .sort((a, b) => a - b)
    .filter(cp => cp !== 0x20 && cp !== 0xA0)
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|ui-sans-serif|ui-serif|ui-monospace|ui-rounded)$/

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setContent('<!doctype html><meta charset=utf-8><body><div id=box></div></body>')
const cdp = await page.context().newCDPSession(page)
await cdp.send('DOM.enable')
await cdp.send('CSS.enable')

const out = {}
for (const fam of FAMILIES) {
    const css = GENERIC.test(fam) ? fam : `"${fam}"`
    await page.evaluate(({ css, cps }) => {
        const box = document.getElementById('box')
        box.style.fontFamily = css
        box.style.fontSize = '32px'
        box.replaceChildren(...cps.map(cp => {
            const s = document.createElement('span')
            s.textContent = String.fromCodePoint(cp)
            return s
        }))
    }, { css, cps: CODEPOINTS })
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 })
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '#box > span' })
    const used = await Promise.all(nodeIds.map(nodeId => cdp.send('CSS.getPlatformFontsForNode', { nodeId })
        .then(r => r.fonts.map(f => f.postScriptName || f.familyName).join('+'), () => '?')))
    const count = {}
    for (const u of used) count[u] = (count[u] || 0) + 1
    const primary = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0]
    const fb = {}
    used.forEach((u, i) => { if (u !== primary) fb[CODEPOINTS[i].toString(16).toUpperCase().padStart(4, '0')] = u })
    out[fam] = { primary, fb }
}
await browser.close()
fs.writeFileSync(process.argv[2] || 'macos-fallback.json', JSON.stringify({ out }))
console.log(`families: ${FAMILIES.length}, code points: ${CODEPOINTS.length}`)
