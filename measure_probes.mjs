// Two common font probes in the installed Google Chrome on macOS, for every family
// in families.json: canvas measureText of a string at 32px (full TextMetrics), and
// offsetWidth/offsetHeight of an element at 128px.
//
//   npm i playwright-core@1 && node measure_probes.mjs out.json
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FAMILIES = JSON.parse(fs.readFileSync(new URL('./families.json', import.meta.url))).all
const CANVAS = 'MlL₹▁₺₸ẞॿiIwmW'
const DOM = 'mmmMMMmmmlllmmmLLL₹▁₺₸ẞॿ'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setContent('<!doctype html><meta charset=utf-8><body></body>')
const data = await page.evaluate(({ FAMILIES, CANVAS, DOM }) => {
    const quote = f => (/^[a-z-]+$/i.test(f) ? f : `"${f}"`)
    const c = document.createElement('canvas').getContext('2d')
    const out = {}
    for (const fam of FAMILIES) {
        c.font = `32px ${quote(fam)}`
        const m = c.measureText(CANVAS)
        const canvas = {}
        for (const k of ['width', 'actualBoundingBoxLeft', 'actualBoundingBoxRight', 'actualBoundingBoxAscent',
            'actualBoundingBoxDescent', 'fontBoundingBoxAscent', 'fontBoundingBoxDescent']) canvas[k] = m[k]
        const el = document.createElement('span')
        el.style.position = 'absolute'
        el.style.left = '-9999px'
        el.style.whiteSpace = 'nowrap'
        el.style.fontFamily = quote(fam)
        el.style.fontSize = '128px'
        el.textContent = DOM
        document.body.appendChild(el)
        const dom = { w: el.offsetWidth, h: el.offsetHeight }
        el.remove()
        out[fam] = { canvas, dom }
    }
    return out
}, { FAMILIES, CANVAS, DOM })
await browser.close()
fs.writeFileSync(process.argv[2] || 'macos-probes.json', JSON.stringify({ out: data }))
console.log(`families: ${FAMILIES.length}`)
