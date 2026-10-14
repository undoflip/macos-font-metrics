// Width and height of an inline span at 128px inside a fixed hidden div — the
// layout of iphey's DOM font check — for every family x string. Page part only
// (no imports): used by measure_inline.mjs on macOS and by the engine's stand.
export async function inlineProbe(page, families, strings) {
    await page.setContent('<!doctype html><html lang="en"><meta charset=utf-8><body></body></html>')
    return page.evaluate(({ families, strings }) => {
        const quote = f => (/^[a-z0-9-]+$/i.test(f) ? f : `"${f}"`)
        const box = document.createElement('div')
        box.style.cssText = 'position: fixed; top: 0px; left: 0px; visibility: hidden; overflow: hidden;'
        document.body.appendChild(box)
        const out = {}
        for (const fam of families) {
            const row = {}
            for (const s of strings) {
                const span = document.createElement('span')
                span.style.cssText = `font-size: 128px; font-family: ${quote(fam)};`
                span.textContent = s
                box.appendChild(span)
                row[s] = [span.offsetWidth, span.offsetHeight]
                span.remove()
            }
            out[fam] = row
        }
        return out
    }, { families, strings })
}

export const STRINGS = (() => {
    const full = 'mmmMMMmmmlllmmmLLL₹▁₺₸ẞॿ\uF003mmmiiimmmIIImmmwwwmmmWWW'
    const list = [full, full.replace('\uF003', ''), 'mmm', 'mmm\uF003']
    for (const ch of '₹▁₺₸ẞॿ') list.push('mmm' + ch)
    return list
})()
