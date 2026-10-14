import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import * as Tooltip from '@radix-ui/react-tooltip'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Link, Outlet, Route, Routes, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import { WagmiProvider } from 'wagmi'
import { useEffect } from 'react'
import { AppNav, SiteNav } from './components/Nav'
import { AppFooter, Footer } from './components/Footer'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Landing } from './pages/Landing'
import { Markets } from './pages/Markets'
import { AssetPage } from './pages/AssetPage'
import { StripVault } from './pages/StripVault'
import { DiscountedStock } from './pages/DiscountedStock'
import { DividendSpeculation } from './pages/DividendSpeculation'
import { Architecture } from './pages/Architecture'
import { Portfolio } from './pages/Portfolio'
import { book, chain } from './lib/network'
import { wagmiConfig } from './lib/wagmi'

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } } })

// Base Blue Dark Theme
const rkTheme = darkTheme({
  accentColor: '#0052FF',
  accentColorForeground: '#FFFFFF',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
})
rkTheme.colors.modalBackground = '#0A0B0D'
rkTheme.colors.modalBorder = '#1C222D'
rkTheme.fonts.body = 'Geist, Inter, system-ui, sans-serif'

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme} modalSize="compact" appInfo={{ appName: 'Xero on Base', disclaimer: Disclaimer }}>
          <Tooltip.Provider>
            <BrowserRouter>
              <Routes>
                <Route element={<Shell />}>
                  <Route index element={<Landing />} />
                  <Route path="markets" element={<Gate><Markets /></Gate>} />
                  <Route path="markets/:symbol" element={<Gate><AssetPage /></Gate>} />
                  <Route path="strip" element={<Gate><StripVault /></Gate>} />
                  <Route path="discount" element={<Gate><DiscountedStock /></Gate>} />
                  <Route path="speculate" element={<Gate><DividendSpeculation /></Gate>} />
                  <Route path="architecture" element={<Architecture />} />
                  <Route path="portfolio" element={<Gate><Portfolio /></Gate>} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
            <Toaster theme="dark" position="bottom-right" richColors closeButton toastOptions={{ className: 'toast' }} />
          </Tooltip.Provider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

function Shell() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0)
  }, [pathname])
  const site = pathname === '/'
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

/** Without a deployment for the target chain, app pages show a launch state instead of failing. */
function Gate({ children }: { children: React.ReactNode }) {
  if (book) return <>{children}</>
  return (
    <div className="page">
      <div className="card empty-state">
        <span className="base-tag">BASE</span>
        <h3>Xero is deploying on {chain.name}</h3>
        <p className="sub">Coinbase B20 tokenized stock markets open as deployment contracts finalize.</p>
        <Link to="/" className="btn">Back home</Link>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="page">
      <div className="card empty-state">
        <h3>Page not found</h3>
        <p className="sub">The requested B20 terminal does not exist.</p>
        <Link to="/markets" className="btn btn-primary">Go to Markets</Link>
      </div>
    </div>
  )
}

const Disclaimer = ({ Text }: { Text: React.ComponentType<{ children: React.ReactNode }>; Link: unknown }) => (
  <Text>
    Xero Protocol is non-custodial and built on Base. Yield Tokens deconstruct the Coinbase B20 Multiplier; future corporate dividend declarations depend on equity issuer action.
  </Text>
)
