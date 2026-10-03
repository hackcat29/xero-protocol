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
import { Portfolio } from './pages/Portfolio'
import { book, chain } from './lib/network'
import { wagmiConfig } from './lib/wagmi'

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } } })

const rkTheme = darkTheme({ accentColor: '#F5B229', accentColorForeground: '#0B0D10', borderRadius: 'medium', fontStack: 'system', overlayBlur: 'small' })
rkTheme.colors.modalBackground = '#14171C'
rkTheme.colors.modalBorder = '#2A313A'
rkTheme.fonts.body = 'Geist, Inter, system-ui, sans-serif'

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
                  <Route path="markets" element={<Gate><Markets /></Gate>} />
                  <Route path="markets/:symbol" element={<Gate><AssetPage /></Gate>} />
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
        <h3>Xero is launching on {chain.name}</h3>
        <p className="sub">Markets open once the protocol is deployed and governance is handed to the timelock.</p>
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
        <Link to="/markets" className="btn btn-primary">Go to markets</Link>
      </div>
    </div>
  )
}

const Disclaimer = ({ Text }: { Text: React.ComponentType<{ children: React.ReactNode }>; Link: unknown }) => (
  <Text>Xero is non-custodial and independent of Robinhood. Yield Tokens depend on future dividends, which are not guaranteed.</Text>
)
