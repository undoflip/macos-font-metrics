// Text width reference measured in the installed Google Chrome on macOS:
// canvas measureText and DOM box sizes for a set of families, strings, sizes.
//
//   npm i playwright-core@1 && node measure_chrome.mjs out.json
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// Common macOS families plus a nonexistent one (shows the fallback chain).
const FAMILIES = [
    'br0k3nd3f4u17', 'Helvetica', 'Helvetica Neue', 'SF Pro', 'SF Pro Text', '-apple-system',
    'system-ui', 'Arial', 'Times', 'Times New Roman', 'Courier', 'Courier New', 'Menlo', 'Monaco',
    'Geneva', 'Lucida Grande', 'Avenir', 'Avenir Next', 'Futura', 'Gill Sans', 'Optima', 'Palatino',
    'Georgia', 'Verdana', 'Trebuchet MS', 'Apple Color Emoji', 'Apple Symbols', 'PingFang SC',
    'Hiragino Sans', 'Kohinoor Devanagari', 'serif', 'sans-serif', 'monospace',
]
// Test strings.
const STRINGS = {
    a: 'MlL₹▁₺₸ẞॿiIwmW',
    a_common: 'MlLiIwmW',
    a_rare: '₹▁₺₸ẞॿ',
    b: 'mmMwWLliI0fiflO&1',
    pangram: 'The quick brown fox jumps over the lazy dog 0123456789',
    cyrillic: 'Съешь же ещё этих мягких французских булок',
}
const SIZES = [12, 16, 72]

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setContent('<!doctype html><meta charset=utf-8><body></body>')
const data = await page.evaluate(({ FAMILIES, STRINGS, SIZES }) => {
    const c = document.createElement('canvas').getContext('2d')
    const span = document.createElement('span')
    span.style.cssText = 'position:absolute;white-space:pre;left:-9999px;top:0'
    document.body.appendChild(span)
    const out = {}
    for (const fam of FAMILIES) {
        const css = /^(serif|sans-serif|monospace|system-ui|-apple-system)$/.test(fam) ? fam : `"${fam}"`
        out[fam] = {}
        for (const size of SIZES) {
            c.font = `${size}px ${css}`
            span.style.font = `${size}px ${css}`
            for (const [k, s] of Object.entries(STRINGS)) {
                const m = c.measureText(s)
                span.textContent = s
                const r = span.getBoundingClientRect()
                out[fam][`${k}@${size}`] = {
                    canvas: m.width, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent,
                    domW: r.width, domH: r.height,
                }
            }
        }
    }
    return { ua: navigator.userAgent, dpr: devicePixelRatio, out }
}, { FAMILIES, STRINGS, SIZES })
await browser.close()
fs.writeFileSync(process.argv[2] || 'macos-chrome-widths.json', JSON.stringify(data, null, 1))
console.log(`families: ${FAMILIES.length}, strings: ${Object.keys(STRINGS).length}, sizes: ${SIZES.length}`)
