// Size dependence of advance widths in the installed Google Chrome on macOS
// (optical size axes, tracking tables). For every family in families.json and
// each size below, every code point's width is scaled to 2048 units and compared
// with the 2048px measurement; only differences above 0.5 unit are written, plus
// a few whole strings at each size.
//
//   npm i playwright-core@1 && node measure_sizes.mjs out.json
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FAMILIES = JSON.parse(fs.readFileSync(new URL('./families.json', import.meta.url))).all
const RANGES = [[0x20, 0x7E], [0xA0, 0x17F], [0x370, 0x3FF], [0x400, 0x4FF],
    [0x2000, 0x206F], [0x20A0, 0x20CF], [0x2190, 0x21FF], [0x2580, 0x259F]]
const EXTRA = [0x1E9E, 0x097F, 0x20B9, 0x20BA, 0x20B8, 0x2581, 0xFB01, 0xFB02]
const CODEPOINTS = [...new Set([...RANGES.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i)), ...EXTRA])]
    .sort((a, b) => a - b)
const SIZES = [9, 12, 14, 16, 20, 24, 32, 48, 72, 96, 128, 256]
const STRINGS = ['MlL₹▁₺₸ẞॿiIwmW', 'mmmMMMmmmlllmmmLLL₹▁₺₸ẞॿ', 'mmMwWLliI0fiflO&1', 'mmmmmmmmmmlli0O',
    'The quick brown fox jumps over the lazy dog 0123456789']
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|ui-sans-serif|ui-serif|ui-monospace|ui-rounded)$/

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setContent('<!doctype html><meta charset=utf-8><body></body>')
const data = await page.evaluate(({ FAMILIES, CODEPOINTS, SIZES, STRINGS, GENERIC }) => {
    const re = new RegExp(GENERIC)
    const c = document.createElement('canvas').getContext('2d')
    const chars = CODEPOINTS.map(cp => String.fromCodePoint(cp))
    const out = {}
    for (const fam of FAMILIES) {
        const css = re.test(fam) ? fam : `"${fam}"`
        c.font = `2048px ${css}`
        const ref = chars.map(ch => c.measureText(ch).width)
        const sizes = {}
        for (const size of SIZES) {
            c.font = `${size}px ${css}`
            const dev = {}
            chars.forEach((ch, i) => {
                const w = c.measureText(ch).width * 2048 / size
                if (Math.abs(w - ref[i]) > 0.5) dev[CODEPOINTS[i].toString(16).toUpperCase().padStart(4, '0')] = Math.round(w * 100) / 100
            })
            const strings = {}
            for (const s of STRINGS) strings[s] = c.measureText(s).width
            sizes[size] = { dev, strings }
        }
        out[fam] = sizes
    }
    return { ua: navigator.userAgent, sizes: SIZES, out }
}, { FAMILIES, CODEPOINTS, SIZES, STRINGS, GENERIC: GENERIC.source })
await browser.close()
fs.writeFileSync(process.argv[2] || 'macos-sizes.json', JSON.stringify(data))
console.log(`families: ${FAMILIES.length}, sizes: ${SIZES.length}`)
