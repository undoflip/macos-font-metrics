// Replays iphey's font checks (iphey-ops.json, recorded from the site's own
// calls) in a plain page and records every value they produce, in order:
//   1. a span at 128px in a fixed hidden div#fonts-metrics-testbox -> offsetWidth/Height
//   2. canvas measureText at 32px -> full TextMetrics
//   3. new FontFace(family, 'local("family")').load() -> loaded / error
//   4. the same @font-face rules in a <style>, then document.fonts.check(font)
// The page part only (no imports): used by replay_iphey.mjs on macOS and by the
// engine's own stand (engine/research/fpbench/diag-iphey-replay.js).
export async function replay(page, ops) {
    await page.setContent('<!doctype html><html lang="en"><meta charset=utf-8><body></body></html>')
    return page.evaluate(async ops => {
        const KEYS = ['width', 'actualBoundingBoxLeft', 'actualBoundingBoxRight', 'actualBoundingBoxAscent',
            'actualBoundingBoxDescent', 'fontBoundingBoxAscent', 'fontBoundingBoxDescent']
        const out = { dom: [], canvas: [], local: [], checks: [] }
        const box = document.createElement('div')
        box.id = 'fonts-metrics-testbox'
        box.style.cssText = 'position: fixed; top: 0px; left: 0px; visibility: hidden; overflow: hidden;'
        document.body.appendChild(box)
        for (const d of ops.dom) {
            const span = document.createElement('span')
            span.style.cssText = d.css
            span.textContent = d.text
            box.appendChild(span)
            out.dom.push([d.css.replace(/^.*font-family:\s*/, '').replace(/;\s*$/, ''), span.offsetWidth, span.offsetHeight])
            span.remove()
        }
        box.remove()
        const c = document.createElement('canvas').getContext('2d')
        for (const m of ops.canvas) {
            c.font = m.font
            const r = c.measureText(m.text)
            out.canvas.push([m.font, ...KEYS.map(k => r[k])])
        }
        // local() of these blocks the renderer for good in headless Chrome on
        // macOS 15 (measure_local.mjs: on-demand fonts); recorded, not loaded.
        const HANG = new Set(['Osaka', 'Osaka-Mono', 'STFangsong', 'STHeiti', 'STKaiti', 'STXihei'])
        for (const l of ops.local) {
            if (HANG.has(l.family)) { out.local.push([l.family, 'hang']); continue }
            const face = new FontFace(l.family, l.source)
            const res = await Promise.race([
                face.load().then(() => 'loaded', () => 'error'),
                new Promise(r => setTimeout(() => r('timeout'), 5000)),
            ])
            out.local.push([l.family, res])
        }
        const st = document.createElement('style')
        st.textContent = ops.style
        document.head.appendChild(st)
        for (const ch of ops.checks) out.checks.push([ch.font, document.fonts.check(ch.font)])
        return out
    }, ops)
}
