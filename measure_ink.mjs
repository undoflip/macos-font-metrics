// Glyph ink boxes as reported by the installed Google Chrome on macOS: for every
// family in families.json and every code point, canvas measureText of the
// character alone at 2048px — actualBoundingBoxLeft/Right/Ascent/Descent, i.e.
// the ink extents in 2048-unit em space (fallback fonts included).
//
//   npm i playwright-core@1 && node measure_ink.mjs out.json
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FAMILIES = JSON.parse(fs.readFileSync(new URL('./families.json', import.meta.url))).all
const RANGES = [[0x20, 0x7E], [0xA0, 0x17F], [0x370, 0x3FF], [0x400, 0x4FF],
    [0x2000, 0x206F], [0x20A0, 0x20CF], [0x2190, 0x21FF], [0x2580, 0x259F]]
const EXTRA = [0x1E9E, 0x097F, 0x20B9, 0x20BA, 0x20B8, 0x2581, 0xFB01, 0xFB02]
const CODEPOINTS = [...new Set([...RANGES.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i)), ...EXTRA])]
    .sort((a, b) => a - b)
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|ui-sans-serif|ui-serif|ui-monospace|ui-rounded)$/

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setContent('<!doctype html><meta charset=utf-8><body></body>')
const data = await page.evaluate(({ FAMILIES, CODEPOINTS, GENERIC }) => {
    const re = new RegExp(GENERIC)
    const c = document.createElement('canvas').getContext('2d')
    const r1 = v => Math.round(v * 10) / 10
    const out = {}
    for (const fam of FAMILIES) {
        c.font = `2048px ${re.test(fam) ? fam : `"${fam}"`}`
        const ink = {}
        for (const cp of CODEPOINTS) {
            const m = c.measureText(String.fromCodePoint(cp))
            ink[cp.toString(16).toUpperCase().padStart(4, '0')] =
                [r1(m.actualBoundingBoxLeft), r1(m.actualBoundingBoxRight), r1(m.actualBoundingBoxAscent), r1(m.actualBoundingBoxDescent)]
        }
        out[fam] = ink
    }
    return { size: 2048, out }
}, { FAMILIES, CODEPOINTS, GENERIC: GENERIC.source })
await browser.close()
fs.writeFileSync(process.argv[2] || 'macos-ink.json', JSON.stringify(data))
console.log(`families: ${FAMILIES.length}`)
