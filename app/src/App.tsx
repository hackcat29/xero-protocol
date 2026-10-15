import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import * as Tooltip from '@radix-ui/react-tooltip'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import { WagmiProvider } from 'wagmi'
import { useEffect } from 'react'
import { AppNav, DOCS_URL } from './components/Nav'
import { SiteNav } from './components/SiteNav'
import { AppFooter, Footer } from './components/Footer'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Landing } from './pages/Landing'
import { Markets } from './pages/Markets'
import { AssetPage } from './pages/AssetPage'
import { DiscountPage, UpfrontPage } from './pages/Offers'
import { Portfolio } from './pages/Portfolio'
import { PricingPage } from './pages/Pricing'
import { SecurityPage } from './pages/Security'
import { book, chain } from './lib/network'
import { wagmiConfig } from './lib/wagmi'

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } } })

const walletTheme = (base: typeof lightTheme, accent: string, ink: string, bg: string, border: string) => {
  const t = base({ accentColor: accent, accentColorForeground: ink, borderRadius: 'large', fontStack: 'system', overlayBlur: 'small' })
  t.colors.modalBackground = bg
  t.colors.modalBorder = border
  t.fonts.body = 'Geist, Inter, system-ui, sans-serif'
  return t
}
const rkTheme = {
  lightMode: walletTheme(lightTheme, '#0e4a37', '#f7f4ec', '#fffdf7', '#ddd5c3'),
  darkMode: walletTheme(darkTheme, '#56b98c', '#07120d', '#121b18', '#27362f'),
}

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme} modalSize="compact" appInfo={{ appName: 'Xero', disclaimer: Disclaimer }}>
          <Tooltip.Provider>
            <BrowserRouter>
              <Routes>
                <Route element={<Shell />}>
                  <Route index element={<Landing />} />
                  <Route path="pricing" element={<PricingPage />} />
                  <Route path="security" element={<SecurityPage />} />
                  <Route path="markets" element={<Gate><Markets /></Gate>} />
                  <Route path="markets/:symbol" element={<Gate><AssetPage /></Gate>} />
                  <Route path="discount" element={<Gate><DiscountPage /></Gate>} />
                  <Route path="upfront" element={<Gate><UpfrontPage /></Gate>} />
                  <Route path="portfolio" element={<Gate><Portfolio /></Gate>} />
                  {/* earlier addresses */}
                  <Route path="strip" element={<Navigate to="/upfront" replace />} />
                  <Route path="speculate" element={<Navigate to="/markets" replace />} />
                  <Route path="architecture" element={<External to={DOCS_URL} />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
            <Toaster theme="system" position="bottom-left" mobileOffset={{ bottom: 84 }} richColors closeButton toastOptions={{ className: 'toast' }} />
          </Tooltip.Provider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

/** Marketing pages get the site header and footer; everything else is the app. */
const SITE_PAGES = new Set(['/', '/pricing', '/security'])

function Shell() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])
  const site = SITE_PAGES.has(pathname)
  return (
    <div className={`shell ${site ? 'shell-site' : 'shell-app'}`}>
      {site ? <SiteNav /> : <AppNav />}
      <main id="main">
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      {site ? <Footer /> : <AppFooter />}
    </div>
  )
}

/** Without a deployment on the selected network, app pages say so instead of failing. */
function Gate({ children }: { children: React.ReactNode }) {
  if (book) return <>{children}</>
  return (
    <div className="page">
      <div className="card empty-state">
        <h3>Xero isn't available on {chain.name} yet</h3>
        <p className="sub">Switch to a supported network to continue.</p>
        <Link to="/" className="btn">Back home</Link>
      </div>
    </div>
  )
}

function External({ to }: { to: string }) {
  useEffect(() => window.location.replace(to), [to])
  return null
}

function NotFound() {
  return (
    <div className="page">
      <div className="card empty-state">
        <h3>We couldn't find that page</h3>
        <Link to="/markets" className="btn btn-primary">Go to markets</Link>
      </div>
    </div>
  )
}

const Disclaimer = ({ Text }: { Text: React.ComponentType<{ children: React.ReactNode }>; Link: unknown }) => (
  <Text>Xero is non-custodial: your wallet holds your tokens. Future dividends are never guaranteed, and the current version runs on a test network.</Text>
)
