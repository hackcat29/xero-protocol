// End-to-end UI test: connects through RainbowKit and runs every trade-ticket flow through real transactions
// (approve -> simulate -> send -> confirm).
//   node scripts/e2e.mjs [baseUrl]                          devnet: connects as the Alice persona
//   E2E_ACCOUNT=xero-testnet node scripts/e2e.mjs [baseUrl] Base Sepolia (set E2E_CHAIN and
//                                                           E2E_RPC=https://sepolia-rollup.arbitrum.io/rpc for Arbitrum): injects an EIP-1193 wallet that signs in this
//                                                           process with that Foundry keystore account (or E2E_KEY),
//                                                           claims test SCHD from the faucet if short, then runs the flows
import puppeteer from 'puppeteer-core'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { createPublicClient, createWalletClient, http, nonceManager } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const wallet = await injectedWallet(page)
await page.setViewport({ width: 1440, height: 1000 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && m.text().includes('[xero tx]') && console.log('     console:', m.text().slice(0, 900)))

const clickText = async (selector, text, timeout = 15000) => {
  const el = await page.waitForFunction(
    (sel, t) => [...document.querySelectorAll(sel)].find((e) => e.textContent?.trim().includes(t) && !e.disabled),
    { timeout },
    selector,
    text,
  )
  await el.asElement().click()
}
const typeInto = async (index, value) => {
  const inputs = await page.$$('.ticket input[inputmode="decimal"]:not([readonly])')
  await inputs[index].click({ clickCount: 3 })
  await inputs[index].type(value)
}
async function expectToast(title) {
  const t = Date.now()
  const res = await page.waitForFunction(
    (title) => {
      const toasts = [...document.querySelectorAll('[data-sonner-toast]')]
      const mine = toasts.filter((x) => x.textContent?.includes(title))
      const done = mine.find((x) => x.getAttribute('data-type') === 'success' || x.getAttribute('data-type') === 'error')
      return done ? { type: done.getAttribute('data-type'), text: done.textContent } : false
    },
    { timeout: 30000 },
    title,
  ).catch(async (e) => {
    const toasts = await page.$$eval('[data-sonner-toast]', (t) => t.map((x) => `${x.getAttribute('data-type')}: ${x.textContent}`))
    await page.screenshot({ path: '/tmp/xero-e2e-stall.png' })
    throw new Error(`no result for "${title}"; toasts: ${JSON.stringify(toasts)}`)
  })
  const v = await res.jsonValue()
  const ok = v.type === 'success'
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${title.padEnd(32)} ${Date.now() - t}ms ${ok ? '' : v.text}`)
  if (!ok) process.exitCode = 1
}
const tab = (name) => clickText('.ticket-tabs [role="tab"]', name)

// E2E_CHAIN picks the app's network (a ?chain= id or slug, remembered by the app) and E2E_RPC must match it
const chainParam = process.env.E2E_CHAIN ? `&chain=${process.env.E2E_CHAIN}` : ''
await page.goto(`${BASE}/markets/SCHDc?m=1Y${chainParam}`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.ticket .amount')

// connect through the RainbowKit modal: Alice on the devnet, the injected test wallet on testnet
await clickText('.ticket button', 'Connect wallet')
await clickText('button', wallet ? 'Xero E2E' : 'Alice · devnet')
await page.waitForSelector('.btn-account', { timeout: 15000 })
console.log(`ok   connected as ${wallet ? wallet.address : 'Alice'}`)

// testnet wallets start empty: claim test SCHD from the Test tokens dialog
if (wallet && (await wallet.schdBalance()) < 150n * 10n ** 18n) {
  await clickText('button', 'Get test tokens')
  await page.waitForFunction(() => [...document.querySelectorAll('.console-stocks button')].some((b) => b.textContent.includes('SCHD') && /Claim|Next claim/.test(b.textContent) && !b.textContent.includes('Checking')))
  const cooling = await page.$$eval('.console-stocks button', (bs) => bs.find((b) => b.textContent.includes('SCHD'))?.textContent.includes('Next claim'))
  if (cooling) console.log('skip test SCHD claim (claimed in the last day)')
  else {
    await clickText('.console-stocks button', 'SCHD')
    await expectToast('Claim test SCHD')
  }
  await page.keyboard.press('Escape')
}
const primary = (text) => clickText('.ticket button.btn-primary, .ticket button.btn-gold', text, 20000)

// review sheet: confirm, wait for the receipt, close it
const SHOTS = process.env.E2E_SHOTS // directory for optional screenshots of the review sheet and receipt
let shot = 0
async function confirmReview(button, toastTitle) {
  await page.waitForSelector('.review')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/review-${++shot}.png` })
  await clickText('.review button', button, 20000)
  await expectToast(toastTitle)
  await page.waitForSelector('.review-done', { timeout: 30000 })
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/receipt-${shot}.png` })
  await clickText('.review-done button', 'Done')
  await page.waitForFunction(() => !document.querySelector('.review'), { timeout: 5000 })
}

// 1. buy at a discount (router.buyPrincipal), through the review sheet
await tab('Discount')
await typeInto(0, '2')
await primary('Review order')
await confirmReview('Confirm purchase', 'Buy SCHD at a discount')

// 2. take dividends upfront (router.stripAndSellYield)
await tab('Upfront')
await typeInto(0, '3')
await primary('Review order')
await confirmReview('Confirm and get paid', 'Get SCHD dividends upfront')

// 3. buy dividend tokens, then sell some back
await tab('Dividends')
await typeInto(0, '2')
await primary('Buy dividends')
await expectToast('Buy SCHD dividend token')
await clickText('.ticket .seg button', 'Sell dividends')
await typeInto(0, '5')
await primary('Sell dividends')
await expectToast('Sell SCHD dividend token')

// 4. split shares, then rejoin part of them
await tab('More')
await clickText('.ticket .seg button', 'Split shares')
await typeInto(0, '3')
await primary('Split')
await expectToast('Split SCHD')
await tab('Redeem')
await typeInto(0, '1')
await primary('Rejoin into shares')
await expectToast('Rejoin SCHD')

// 5. add liquidity
await tab('More')
await clickText('.ticket .seg button', 'Add liquidity')
await typeInto(0, '2')
await primary('Add liquidity')
await expectToast('Add liquidity')

// 6. the dedicated discount page, on another maturity
await clickText('.side-nav a', 'Buy at a discount')
await clickText('.terms button', '6 mo')
await page.waitForFunction(() => new URL(location.href).searchParams.get('m') === '6M')
await new Promise((r) => setTimeout(r, 800)) // the ticket remounts for the new maturity
await typeInto(0, '1')
await primary('Review order')
await confirmReview('Confirm purchase', 'Buy SCHD at a discount')

// 7. the transactions show up in Activity
await clickText('.side-nav a', 'Activity')
await page.waitForSelector('.activity-list li', { timeout: 10000 })
console.log(`ok   activity lists ${(await page.$$('.activity-list li')).length} transaction(s)`)

// 8. portfolio shows the positions (client-side navigation), and the session survives a reload
await clickText('.side-nav a', 'Portfolio')
await page.waitForSelector('.table tbody tr', { timeout: 20000 })
await page.reload({ waitUntil: 'domcontentloaded' })
const reconnected = await page.waitForSelector('.btn-account', { timeout: 15000 }).then(() => true, () => false)
console.log(`${reconnected ? 'ok  ' : 'FAIL'} wallet session restored after reload`)
if (!reconnected) process.exitCode = 1
await page.waitForSelector('.table tbody tr', { timeout: 20000 }).catch(() => {})
const rows = await page.$$eval('.table tbody tr', (r) => r.map((x) => x.querySelector('b')?.textContent))
console.log(`ok   portfolio lists ${rows.length} position(s): ${rows.join(', ')}`)

if (SHOTS) {
  await clickText('.side-nav a', 'Home')
  await page.waitForSelector('.summary-value')
  await new Promise((r) => setTimeout(r, 2500))
  await page.screenshot({ path: `${SHOTS}/home-connected.png` })
  await page.click('.btn-account')
  await page.waitForSelector('.account-menu')
  await page.screenshot({ path: `${SHOTS}/account-menu.png` })
}

if (errors.length) {
  console.log('page errors:', errors.slice(0, 3))
  process.exitCode = 1
}
await browser.close()

/** Testnet only: a window.ethereum (announced via EIP-6963) whose requests are served here, signing locally. */
async function injectedWallet(page) {
  let key = process.env.E2E_KEY
  const name = process.env.E2E_ACCOUNT
  if (!key && name) {
    const pw = `${homedir()}/.foundry/${name}.password`
    key = execFileSync('cast', ['wallet', 'private-key', '--account', name, ...(existsSync(pw) ? ['--password-file', pw] : [])], { encoding: 'utf8' }).trim()
  }
  if (!key) return undefined
  const rpc = process.env.E2E_RPC ?? 'https://base-sepolia-rpc.publicnode.com'
  const account = privateKeyToAccount(key, { nonceManager }) // track nonces locally: load-balanced RPCs can lag
  const pub = createPublicClient({ transport: http(rpc) })
  const chainId = await pub.getChainId()
  const chain = { id: chainId, name: `chain-${chainId}`, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc] } } }
  const signer = createWalletClient({ account, chain, transport: http(rpc) })
  const big = (v) => (v == null ? undefined : BigInt(v))
  let authorized = false // like a real wallet: no accounts until the site asks for them

  await page.exposeFunction('__xeroE2eRpc', async (method, params) => {
    try {
      switch (method) {
        case 'eth_requestAccounts':
          authorized = true
          return { result: [account.address] }
        case 'eth_accounts':
          return { result: authorized ? [account.address] : [] }
        case 'eth_chainId':
          return { result: `0x${chainId.toString(16)}` }
        case 'wallet_switchEthereumChain':
          if (Number(params[0].chainId) !== chainId) return { error: { code: 4902, message: 'unsupported chain' } }
          return { result: null }
        case 'wallet_requestPermissions':
        case 'wallet_getPermissions':
          return { result: [{ parentCapability: 'eth_accounts' }] }
        case 'eth_sendTransaction': {
          const [tx] = params
          const hash = await signer.sendTransaction({ to: tx.to, data: tx.data, value: big(tx.value), gas: big(tx.gas) })
          return { result: hash }
        }
        case 'personal_sign':
          return { result: await account.signMessage({ message: { raw: params[0] } }) }
        case 'eth_signTypedData_v4':
          return { result: await account.signTypedData(JSON.parse(params[1])) }
        default:
          return { result: await pub.request({ method, params }) }
      }
    } catch (e) {
      return { error: { code: e.code ?? -32603, message: e.shortMessage ?? e.message } }
    }
  })
  await page.evaluateOnNewDocument(() => {
    const listeners = {}
    const provider = {
      async request({ method, params }) {
        const r = await window.__xeroE2eRpc(method, params ?? [])
        if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code })
        return r.result
      },
      on: (ev, fn) => void (listeners[ev] ??= []).push(fn),
      removeListener: (ev, fn) => void (listeners[ev] = (listeners[ev] ?? []).filter((f) => f !== fn)),
    }
    const icon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" rx="8" fill="%23F5B229"/%3E%3C/svg%3E'
    const info = { uuid: '6f1d1c3e-8a4b-4f0e-9a51-0e2e0e2e0e2e', name: 'Xero E2E', icon, rdns: 'xyz.xero.e2e' }
    const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }))
    window.ethereum = provider
    window.addEventListener('eip6963:requestProvider', announce)
    announce()
  })

  const { default: book } = await import(`../src/deployments/${chainId}.json`, { with: { type: 'json' } })
  const symbolAbi = [{ type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }]
  const symbols = await Promise.all(book.stocks.map((t) => pub.readContract({ address: t, abi: symbolAbi, functionName: 'symbol' })))
  const schd = book.stocks[symbols.findIndex((x) => x === 'SCHDc' || x === 'SCHD')]
  const schdBalance = () => pub.readContract({ address: schd, abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }], functionName: 'balanceOf', args: [account.address] })
  console.log(`     wallet ${account.address} on chain ${chainId}, ${Number(await pub.getBalance({ address: account.address })) / 1e18} ETH`)
  return { address: account.address, schdBalance }
}
