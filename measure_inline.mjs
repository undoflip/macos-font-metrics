// Runs inline_probe_page.mjs in the installed Google Chrome on macOS for every
// family in families.json.
//
//   npm i playwright-core@1 && node measure_inline.mjs out.json
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import { inlineProbe, STRINGS } from './inline_probe_page.mjs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FAMILIES = JSON.parse(fs.readFileSync(new URL('./families.json', import.meta.url))).all
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
const out = await inlineProbe(page, FAMILIES, STRINGS)
await browser.close()
fs.writeFileSync(process.argv[2] || 'macos-inline.json', JSON.stringify({ strings: STRINGS, out }))
console.log(`families: ${FAMILIES.length}, strings: ${STRINGS.length}`)
