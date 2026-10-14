// UI smoke test: loads each page in Chrome, waits for real content, fails on console errors, saves screenshots.
//   node scripts/smoke.mjs [baseUrl] [outDir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const OUT = process.argv[3] ?? 'smoke'
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
mkdirSync(OUT, { recursive: true })

const pages = [
  { path: '/', wait: '.kpi b', name: 'landing', height: 3800 },
  { path: '/markets', wait: '.markets-table tbody tr', name: 'markets', height: 1400 },
  { path: '/markets/SCHDc?m=1Y', wait: '.ticket .amount', name: 'asset', height: 1900 },
  { path: '/portfolio', wait: '.empty-state, .kpis', name: 'portfolio', height: 900 },
]

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
let failed = false
for (const p of pages) {
  for (const [label, width] of [['desktop', 1440], ['mobile', 390]]) {
    const page = await browser.newPage()
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.setViewport({ width, height: label === 'mobile' ? 844 : 900, deviceScaleFactor: 1 })
    const t = Date.now()
    await page.goto(BASE + p.path, { waitUntil: 'domcontentloaded' })
    try {
      await page.waitForSelector(p.wait, { timeout: 20000 })
      await new Promise((r) => setTimeout(r, 1500)) // let charts and sparklines settle
    } catch {
      errors.push(`timeout waiting for ${p.wait}`)
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    if (overflow > 1) errors.push(`horizontal overflow ${overflow}px`)
    await page.screenshot({ path: `${OUT}/${p.name}-${label}.png`, fullPage: label === 'desktop' ? false : true, clip: label === 'desktop' ? { x: 0, y: 0, width, height: p.height } : undefined, captureBeyondViewport: true })
    const relevant = errors.filter((e) => !/WalletConnect|Reown|walletconnect|favicon|Download the React DevTools/i.test(e))
    console.log(`${relevant.length ? 'FAIL' : 'ok  '} ${p.path.padEnd(22)} ${label.padEnd(7)} ${Date.now() - t}ms ${relevant.slice(0, 3).join(' | ')}`)
    if (relevant.length) failed = true
    await page.close()
  }
}
await browser.close()
process.exit(failed ? 1 : 0)
