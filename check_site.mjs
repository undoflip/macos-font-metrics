// Opens a public fingerprint report page in the installed Google Chrome
// and writes the visible score and the detail section's text.
//
//   npm i playwright-core@1 && node check_site.mjs out.json
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ executablePath: CHROME, headless: true, timeout: 60000 })
const probe = await browser.newPage()
const ua = (await probe.evaluate(() => navigator.userAgent)).replace('HeadlessChrome', 'Chrome')
await probe.close()
const context = await browser.newContext({ userAgent: ua, viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const res = {}
try {
    await page.goto('https://iphey.com/', { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForTimeout(30000)
    res.text = (await page.evaluate(() => document.body.innerText)).slice(0, 3000)
    res.detail = await page.evaluate(() => {
        const sec = document.querySelector('#detail-info')
        return sec ? sec.outerHTML : null
    })
    res.ua = await page.evaluate(() => navigator.userAgent)
} catch (e) {
    res.error = String(e.message).slice(0, 300)
}
await browser.close()
fs.writeFileSync(process.argv[2] || 'site.json', JSON.stringify(res))
console.log(res.error || (res.text.match(/(\d+)\s*MX SCORE/) || [])[0] || 'no score')
