// What `@font-face { src: local("Name") }` gives in the installed Google Chrome on
// macOS, for every family in families.json (all + iphey) and every face's full name
// and PostScript name from the harvest. For each name: did the face load, and if
// so the same two probes as measure_probes.mjs taken through that face (canvas
// 32px, full TextMetrics; element 128px, offsetWidth/offsetHeight).
//
//   npm i playwright-core@1 && node measure_local.mjs out.json [fonts-<os>.json]
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const fam = JSON.parse(fs.readFileSync(new URL('./families.json', import.meta.url)))
const names = new Set([...fam.all, ...(fam.iphey || [])])
if (process.argv[3] && fs.existsSync(process.argv[3])) {
    for (const f of JSON.parse(fs.readFileSync(process.argv[3])).faces) {
        if (f.fullName) names.add(f.fullName)
        if (f.postscript) names.add(f.postscript)
    }
}
const NAMES = [...names].filter(n => !n.startsWith('-'))
const CANVAS = 'MlL₹▁₺₸ẞॿiIwmW'
const DOM = 'mmmMMMmmmlllmmmLLL₹▁₺₸ẞॿ'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setContent('<!doctype html><meta charset=utf-8><body></body>')
const data = await page.evaluate(async ({ NAMES, CANVAS, DOM }) => {
    const c = document.createElement('canvas').getContext('2d')
    const out = {}
    for (let i = 0; i < NAMES.length; i++) {
        const name = NAMES[i]
        const alias = `elocal${i}`
        const face = new FontFace(alias, `local("${name.replace(/"/g, '\\"')}")`)
        try { await face.load() } catch { out[name] = { loaded: false }; continue }
        document.fonts.add(face)
        c.font = `32px ${alias}`
        const m = c.measureText(CANVAS)
        const canvas = {}
        for (const k of ['width', 'actualBoundingBoxLeft', 'actualBoundingBoxRight', 'actualBoundingBoxAscent',
            'actualBoundingBoxDescent', 'fontBoundingBoxAscent', 'fontBoundingBoxDescent']) canvas[k] = m[k]
        const el = document.createElement('span')
        el.style.position = 'absolute'
        el.style.left = '-9999px'
        el.style.whiteSpace = 'nowrap'
        el.style.fontFamily = alias
        el.style.fontSize = '128px'
        el.textContent = DOM
        document.body.appendChild(el)
        const dom = { w: el.offsetWidth, h: el.offsetHeight }
        el.remove()
        document.fonts.delete(face)
        out[name] = { loaded: true, canvas, dom }
    }
    return out
}, { NAMES, CANVAS, DOM })
await browser.close()
fs.writeFileSync(process.argv[2] || 'macos-local.json', JSON.stringify({ out: data }))
console.log(`names: ${NAMES.length}, loaded: ${Object.values(data).filter(x => x.loaded).length}`)
