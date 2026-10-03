# Xero brand

Open [`index.html`](index.html) for the visual guidelines.

**Idea.** A Stock Token holds two returns. Xero separates them. The mark is a token cut by an X; one wedge, the yield, moves out in amber. Principal is always neutral (ink on light, paper on dark). **Amber always means yield**, in the logo, the app and charts.

## Assets (`assets/`)

| File | Use |
|---|---|
| `xero-lockup.svg` / `xero-lockup-light.svg` | Primary logo, for light / dark backgrounds |
| `xero-mark.svg` / `xero-mark-light.svg` | Mark alone, for light / dark backgrounds |
| `xero-mark-mono-black.svg` / `xero-mark-mono-white.svg` | Single colour (e.g. on amber, embossing) |
| `xero-wordmark*.svg` | Wordmark alone |
| `xero-app-icon.svg`, `xero-icon-512.png`, `xero-icon-192.png`, `apple-touch-icon.png` | App and PWA icons |
| `favicon.svg` | Browser tab |
| `og-image.png` | Social card (1200×630) |
| `tokens.json` | Colours, fonts, radii for code |

## Rules

- Keep clear space around the mark of at least one wedge gap × 4. Minimum size: 16px (favicon), 24px elsewhere.
- Don't recolour the wedges, rotate the mark, or move the yield wedge anywhere except east.
- Colours: Ink `#0B0D10`, Paper `#F4F2EC`, Amber `#F5B229` (yield), Positive `#2BD49A`, Negative `#FF5D6C`.
- Type: Geist (UI, display, −3.5% tracking at large sizes); Geist Mono for all numbers, tickers and addresses.
- Robinhood names and logos belong to Robinhood. Use "Robinhood Stock Tokens" descriptively only, never as our branding.

## Regenerating

```sh
python3 brand/generate.py      # SVGs + tokens.json from exact geometry
python3 brand/build_pages.py   # index.html + og-image.html
```

PNGs are rendered from these with headless Chrome.
