// Pair adjustments (kerning and ligatures) as applied by the installed Google
// Chrome on macOS: for every family in families.json and every pair of printable
// ASCII characters, width(pair) - width(a) - width(b) at 2048px. Only non-zero
// adjustments are written.
//
//   npm i playwright-core@1 && node measure_pairs.mjs out.json
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FAMILIES = JSON.parse(fs.readFileSync(new URL('./families.json', import.meta.url))).all
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|ui-sans-serif|ui-serif|ui-monospace|ui-rounded)$/

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setContent('<!doctype html><meta charset=utf-8><body></body>')
const data = await page.evaluate(({ FAMILIES, GENERIC }) => {
    const re = new RegExp(GENERIC)
    const c = document.createElement('canvas').getContext('2d')
    const chars = []
    for (let cp = 0x20; cp <= 0x7E; cp++) chars.push(String.fromCharCode(cp))
    const out = {}
    for (const fam of FAMILIES) {
        c.font = `2048px ${re.test(fam) ? fam : `"${fam}"`}`
        const w = chars.map(ch => c.measureText(ch).width)
        const adj = {}
        for (let i = 0; i < chars.length; i++) {
            for (let j = 0; j < chars.length; j++) {
                const d = c.measureText(chars[i] + chars[j]).width - w[i] - w[j]
                if (Math.abs(d) > 0.01) adj[chars[i] + chars[j]] = Math.round(d * 100) / 100
            }
        }
        // Common ligature triples, for reference.
        for (const s of ['ffi', 'ffl', 'fff']) {
            const sum = [...s].reduce((a, ch) => a + w[ch.charCodeAt(0) - 0x20], 0)
            const d = c.measureText(s).width - sum
            if (Math.abs(d) > 0.01) adj[s] = Math.round(d * 100) / 100
        }
        out[fam] = adj
    }
    return { ua: navigator.userAgent, size: 2048, out }
}, { FAMILIES, GENERIC: GENERIC.source })
await browser.close()
fs.writeFileSync(process.argv[2] || 'macos-pairs.json', JSON.stringify(data))
console.log(`families: ${FAMILIES.length}`)
