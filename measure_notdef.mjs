// The missing-glyph box (.notdef) of every family in families.json, as installed
// Google Chrome on macOS draws it: iphey's probe strings carry U+F003 (private
// use, in no font), which Blink draws with the primary font's .notdef. Canvas
// TextMetrics of the single character at 2048px (one unit per em-2048), and of
// U+E000 and U+10FFFD to see that it is the same box.
//
//   npm i playwright-core@1 && node measure_notdef.mjs out.json
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FAMILIES = JSON.parse(fs.readFileSync(new URL('./families.json', import.meta.url))).all

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setContent('<!doctype html><html lang="en"><meta charset=utf-8><body></body></html>')
const data = await page.evaluate(FAMILIES => {
    const quote = f => (/^[a-z-]+$/i.test(f) ? f : `"${f}"`)
    const c = document.createElement('canvas').getContext('2d')
    const KEYS = ['width', 'actualBoundingBoxLeft', 'actualBoundingBoxRight', 'actualBoundingBoxAscent', 'actualBoundingBoxDescent']
    const out = {}
    for (const fam of FAMILIES) {
        c.font = `2048px ${quote(fam)}`
        const row = {}
        for (const [k, ch] of [['F003', ''], ['E000', ''], ['10FFFD', '\u{10FFFD}']]) {
            const m = c.measureText(ch)
            row[k] = KEYS.map(x => m[x])
        }
        out[fam] = row
    }
    return out
}, FAMILIES)
await browser.close()
fs.writeFileSync(process.argv[2] || 'macos-notdef.json', JSON.stringify({ keys: ['width', 'left', 'right', 'ascent', 'descent'], out: data }))
console.log(`families: ${FAMILIES.length}`)
