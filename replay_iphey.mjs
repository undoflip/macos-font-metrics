// Replays iphey's font checks (iphey-ops.json, recorded from the site's own
// calls) in a plain page and records every value they produce, in order:
//   1. a span at 128px in a fixed hidden div#fonts-metrics-testbox -> offsetWidth/Height
//   2. canvas measureText at 32px -> full TextMetrics
//   3. new FontFace(family, 'local("family")').load() -> loaded / error
//   4. the same @font-face rules in a <style>, then document.fonts.check(font)
// Run on macOS (installed Google Chrome) and in another browser; diff the outputs.
//
//   npm i playwright-core@1 && node replay_iphey.mjs out.json
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import { replay } from './replay_iphey_page.mjs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OPS = JSON.parse(fs.readFileSync(new URL('./iphey-ops.json', import.meta.url)))

{
    const browser = await chromium.launch({ executablePath: CHROME, headless: true })
    const page = await browser.newPage()
    const out = await Promise.race([replay(page, OPS), new Promise((_, j) => setTimeout(() => j(new Error('replay timeout')), 600000))])
    await browser.close().catch(() => {})
    fs.writeFileSync(process.argv[2] || 'iphey-replay.json', JSON.stringify(out))
    console.log(`dom ${out.dom.length}, canvas ${out.canvas.length}, local loaded ${out.local.filter(x => x[1] === 'loaded').length}, check true ${out.checks.filter(x => x[1]).length}`)
}
