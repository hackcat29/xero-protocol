// Renders Xero's raster and logo assets from the brand palette.
//   node brand/render.mjs        (uses puppeteer-core from app/node_modules and the system Chrome)
// Writes app/public icons + og-image and docs/logo lockups.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from '../app/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUB = join(ROOT, 'app/public')
const DOCS = join(ROOT, 'docs')
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const C = { green: '#0e4a37', mint: '#56b98c', paper: '#f4f1e8', ink: '#13201a', night: '#0b1210', gold: '#c08a2a', goldDark: '#dcae55', muted: '#64716a' }
const SHARE = 'M32 34.97L48.84 51.81A26 26 0 0 1 15.16 51.81ZM29.03 32L12.19 48.84A26 26 0 0 1 12.19 15.16ZM32 29.03L15.16 12.19A26 26 0 0 1 48.84 12.19Z'
const SLICE = 'M38.37 32L55.21 15.16A26 26 0 0 1 55.21 48.84Z'
const mark = (share, slice) => `<path d="${SHARE}" fill="${share}"/><path d="${SLICE}" fill="${slice}"/>`
const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Newsreader:opsz,wght@6..72,500;6..72,600&display=swap" rel="stylesheet">'

// Vector files
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 76 76" width="32" height="32"><rect x="-6" y="-6" width="76" height="76" rx="16" fill="${C.green}"/>${mark(C.paper, C.gold)}</svg>\n`
writeFileSync(join(PUB, 'favicon.svg'), favicon)
mkdirSync(join(DOCS, 'logo'), { recursive: true })
writeFileSync(join(DOCS, 'favicon.svg'), favicon)
writeFileSync(join(PUB, 'xero-mark-light.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${mark(C.ink, C.gold)}</svg>\n`)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
async function shot(html, w, h, out, transparent = false) {
  const p = await browser.newPage()
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 })
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}</style></head><body>${html}</body></html>`, { waitUntil: 'networkidle0' })
  await p.evaluate(() => document.fonts.ready)
  mkdirSync(dirname(out), { recursive: true })
  await p.screenshot({ path: out, omitBackground: transparent })
  await p.close()
}

// App icons: mark on certificate green
const icon = (s) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -14 92 92" width="${s}" height="${s}"><rect x="-14" y="-14" width="92" height="92" fill="${C.green}"/>${mark(C.paper, C.gold)}</svg>`
await shot(icon(512), 512, 512, join(PUB, 'xero-icon-512.png'))
await shot(icon(192), 192, 192, join(PUB, 'xero-icon-192.png'))
await shot(icon(180), 180, 180, join(PUB, 'apple-touch-icon.png'))

// Lockups (mark + serif wordmark), for the docs header on light and dark backgrounds
const lockup = (text, slice) =>
  `<div style="display:flex;align-items:center;gap:14px;height:64px;padding:0 4px"><svg viewBox="0 0 64 64" width="52" height="52">${mark(text, slice)}</svg><span style="font:600 50px/1 Newsreader,serif;letter-spacing:-0.02em;color:${text};padding-bottom:6px">xero</span></div>`
await shot(lockup(C.ink, C.gold), 196, 64, join(DOCS, 'logo/light.png'), true)
await shot(lockup(C.paper, C.goldDark), 196, 64, join(DOCS, 'logo/dark.png'), true)

// Social card
const guilloche = (() => {
  const rings = [0.98, 0.84, 0.7, 0.56]
  return rings.map((k, ri) => {
    const R = 200 * k, r = R * 0.18, d = R * 0.22, pts = []
    for (let i = 0; i <= 1440; i++) {
      const t = (i / 1440) * Math.PI * 10
      pts.push(`${((R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t + ri) + 250).toFixed(1)},${((R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t + ri) + 250).toFixed(1)}`)
    }
    return `<path d="M${pts.join('L')}" fill="none" stroke="${C.gold}" stroke-width="0.6"/>`
  }).join('')
})()
await shot(
  `<div style="position:relative;width:1200px;height:630px;background:${C.paper};color:${C.ink};font-family:Geist,sans-serif;overflow:hidden;box-sizing:border-box;padding:72px 80px">
    <svg viewBox="0 0 500 500" width="820" height="820" style="position:absolute;right:-260px;top:-150px;opacity:.28">${guilloche}</svg>
    <div style="position:relative">${lockup(C.ink, C.gold)}</div>
    <div style="position:relative;margin-top:70px;font:500 82px/1.02 Newsreader,serif;letter-spacing:-0.02em">Stocks at a discount.<br>Dividends in advance.</div>
    <div style="position:relative;margin-top:28px;font-size:27px;color:${C.muted};max-width:760px;line-height:1.4">The first platform to split tokenized stocks into the share and its dividends.</div>
    <div style="position:absolute;left:80px;bottom:64px;display:flex;height:14px;width:520px;border-radius:7px;overflow:hidden"><div style="flex:93;background:${C.green}"></div><div style="flex:7;background:${C.gold}"></div></div>
  </div>`,
  1200, 630, join(PUB, 'og-image.png'),
)
await browser.close()
console.log('brand assets written')
