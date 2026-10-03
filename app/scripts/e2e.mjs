// End-to-end UI test: connects through RainbowKit and runs every trade-ticket flow through real transactions
// (approve -> simulate -> send -> confirm).
//   node scripts/e2e.mjs [baseUrl]                          devnet: connects as the Alice persona
//   E2E_ACCOUNT=xero-testnet node scripts/e2e.mjs [baseUrl] testnet: injects an EIP-1193 wallet that signs in this
//                                                           process with that Foundry keystore account (or E2E_KEY),
//                                                           claims test SCHD from the faucet if short, then runs the flows
import puppeteer from 'puppeteer-core'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { createPublicClient, createWalletClient, http } from 'viem'
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

await page.goto(`${BASE}/markets/SCHD?m=1Y`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.ticket .amount')

// connect through the RainbowKit modal: Alice on the devnet, the injected test wallet on testnet
await clickText('button', 'Connect wallet')
await clickText('button', wallet ? 'Xero E2E' : 'Alice · devnet')
await page.waitForSelector('.btn-account', { timeout: 15000 })
console.log(`ok   connected as ${wallet ? wallet.address : 'Alice'}`)

// testnet wallets start empty: claim test SCHD through the console's faucet (once a day per address)
if (wallet && (await wallet.schdBalance()) < 150n * 10n ** 18n) {
  await clickText('button', 'Testnet')
  await clickText('.console-faucet button', 'Get SCHD')
  await expectToast('Claim test SCHD')
  await page.keyboard.press('Escape')
}

// 1. buy yield
await tab('Yield')
await typeInto(0, '10')
await clickText('.ticket button', 'Buy xSCHD-YT-1Y', 20000)
await expectToast('Buy xSCHD-YT-1Y')

// 2. sell some yield back
await clickText('.ticket .seg button', 'Sell yield')
await typeInto(0, '50')
await clickText('.ticket button', 'Sell xSCHD-YT-1Y', 20000)
await expectToast('Sell xSCHD-YT-1Y')

// 3. fix: strip and sell yield in one router transaction
await tab('Fix')
await typeInto(0, '100')
await clickText('.ticket button', 'Sell future dividends', 20000)
await expectToast('Fix SCHD dividends')

// 4. strip
await tab('Strip')
await typeInto(0, '25')
await clickText('.ticket button.btn-primary', 'Strip', 20000)
await expectToast('Strip SCHD')

// 5. recombine part of it
await tab('Redeem')
await typeInto(0, '5')
await clickText('.ticket button.btn-primary', 'Recombine', 20000)
await expectToast('Recombine SCHD')

// 6. add liquidity
await tab('Pool')
await typeInto(0, '5')
await clickText('.ticket button.btn-primary', 'Add liquidity', 20000)
await expectToast('Add liquidity')

// 7. portfolio shows the positions (client-side navigation), and the session survives a reload
await clickText('.app-tabs a', 'Portfolio')
await page.waitForSelector('.markets-table tbody tr', { timeout: 20000 })
await page.reload({ waitUntil: 'domcontentloaded' })
const reconnected = await page.waitForSelector('.btn-account', { timeout: 15000 }).then(() => true, () => false)
console.log(`${reconnected ? 'ok  ' : 'FAIL'} wallet session restored after reload`)
if (!reconnected) process.exitCode = 1
await page.waitForSelector('.markets-table tbody tr', { timeout: 20000 }).catch(() => {})
const rows = await page.$$eval('.markets-table tbody tr', (r) => r.map((x) => x.querySelector('b')?.textContent))
console.log(`ok   portfolio lists ${rows.length} position(s): ${rows.join(', ')}`)

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
  const rpc = process.env.E2E_RPC ?? 'https://rpc.testnet.chain.robinhood.com/rpc'
  const account = privateKeyToAccount(key)
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
  const schd = book.stocks[1] // AAPL, SCHD, XOM, SGOV
  const schdBalance = () => pub.readContract({ address: schd, abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }], functionName: 'balanceOf', args: [account.address] })
  console.log(`     wallet ${account.address} on chain ${chainId}, ${Number(await pub.getBalance({ address: account.address })) / 1e18} ETH`)
  return { address: account.address, schdBalance }
}
