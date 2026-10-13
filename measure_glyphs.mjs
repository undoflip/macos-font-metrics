// Per-character advance widths as rendered by the installed Google Chrome on macOS.
//
// For every family in families.json and every code point in the set below, the
// canvas width at 2048px (that is, the advance in 2048-unit em space, fallback
// fonts included: a character the family lacks is measured with whatever the
// system draws it with). Also whole strings, to see kerning and ligatures, the
// font box (ascent/descent), DOM box sizes, and whether the family resolves at all.
//
//   npm i playwright-core@1 && node measure_glyphs.mjs out.json
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FAMILIES = JSON.parse(fs.readFileSync(new URL('./families.json', import.meta.url))).all

// Same set as harvest_fonts.py.
const RANGES = [[0x20, 0x7E], [0xA0, 0x17F], [0x370, 0x3FF], [0x400, 0x4FF],
    [0x2000, 0x206F], [0x20A0, 0x20CF], [0x2190, 0x21FF], [0x2580, 0x259F]]
const EXTRA = [0x1E9E, 0x097F, 0x20B9, 0x20BA, 0x20B8, 0x2581, 0xFB01, 0xFB02]
const CODEPOINTS = [...new Set([...RANGES.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i)), ...EXTRA])]
    .sort((a, b) => a - b)

// Strings used by common font probes, plus a few to expose kerning/ligatures.
const STRINGS = [
    'MlL₹▁₺₸ẞॿiIwmW', 'mmmMMMmmmlllmmmLLL₹▁₺₸ẞॿ', 'mmMwWLliI0fiflO&1', 'mmmmmmmmmmlli',
    'mmmmmmmmmmlli0O', 'The quick brown fox jumps over the lazy dog 0123456789',
    'AV', 'To', 'Wa', 'fi', 'fl', 'ff', 'ffi', 'LT', 'Yo', 'rn', '1.', 'w,',
    'Съешь же ещё этих мягких французских булок',
]
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|ui-sans-serif|ui-serif|ui-monospace|ui-rounded)$/

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setContent('<!doctype html><meta charset=utf-8><body></body>')
const data = await page.evaluate(({ FAMILIES, CODEPOINTS, STRINGS, GENERIC }) => {
    const re = new RegExp(GENERIC)
    const c = document.createElement('canvas').getContext('2d')
    const span = document.createElement('span')
    span.style.cssText = 'position:absolute;white-space:pre;left:-9999px;top:0;line-height:normal'
    document.body.appendChild(span)
    const chars = CODEPOINTS.map(cp => String.fromCodePoint(cp))
    const out = {}
    for (const fam of FAMILIES) {
        const css = re.test(fam) ? fam : `"${fam}"`
        // Presence: does the family change the width against two different fallbacks?
        const probe = 'mmmmmmmmmmlli0O'
        const pres = {}
        for (const fb of ['monospace', 'serif', 'sans-serif']) {
            c.font = `72px ${re.test(fam) ? fam : `${css}, ${fb}`}`
            pres[fb] = c.measureText(probe).width
        }
        c.font = `2048px ${css}`
        const adv = {}
        chars.forEach((ch, i) => { adv[CODEPOINTS[i].toString(16).toUpperCase().padStart(4, '0')] = c.measureText(ch).width })
        const m = c.measureText('Hxg')
        const strings = {}
        for (const s of STRINGS) strings[s] = c.measureText(s).width
        const dom = {}
        for (const size of [16, 100, 128]) {
            span.style.font = `${size}px ${css}`
            span.textContent = 'mmmMMMmmmlllmmmLLL'
            const r = span.getBoundingClientRect()
            dom[size] = { w: r.width, h: r.height }
        }
        out[fam] = {
            check: document.fonts.check(`16px ${css}`),
            presence: pres,
            box: { fontAscent: m.fontBoundingBoxAscent, fontDescent: m.fontBoundingBoxDescent },
            adv, strings, dom,
        }
    }
    return { ua: navigator.userAgent, dpr: devicePixelRatio, size: 2048, out }
}, { FAMILIES, CODEPOINTS, STRINGS, GENERIC: GENERIC.source })
await browser.close()
fs.writeFileSync(process.argv[2] || 'macos-glyph-widths.json', JSON.stringify(data))
console.log(`families: ${FAMILIES.length}, code points: ${CODEPOINTS.length}`)
