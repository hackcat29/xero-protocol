"""Builds the brand sheet (index.html) and the social card source (og-image.html). Run after generate.py."""
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
A = lambda n: open(f"assets/{n}").read().strip()
FONTS = '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">'

og = """<!doctype html><html><head><meta charset="utf-8">FONTS
<style>
html,body{margin:0;width:1200px;height:630px;background:#0B0D10;color:#F4F2EC;font-family:Geist,Inter,sans-serif;overflow:hidden}
.wrap{position:relative;width:1200px;height:630px;box-sizing:border-box;padding:72px 80px}
.glow{position:absolute;right:-120px;top:-140px;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle,rgba(245,178,41,.20),rgba(245,178,41,0) 65%)}
.lock svg{height:58px;width:auto}
h1{font-size:68px;line-height:1.02;letter-spacing:-.035em;font-weight:600;margin:64px 0 0;max-width:780px}
h1 em{font-style:normal;color:#F5B229}
p{font-size:26px;color:#8B95A3;margin:22px 0 0;max-width:720px;letter-spacing:-.01em}
.eq{position:absolute;left:80px;bottom:64px;font-family:'Geist Mono',monospace;font-size:20px;color:#8B95A3;display:flex;gap:14px;align-items:center}
.eq b{color:#F4F2EC;font-weight:500} .eq i{font-style:normal;color:#F5B229}
.curve{position:absolute;right:72px;bottom:56px}
</style></head><body><div class="wrap"><div class="glow"></div>
<div class="lock">LOCKUP</div>
<h1>Keep the stock.<br><em>Trade the dividends.</em></h1>
<p>Split Robinhood Stock Tokens into principal and the yield from reinvested dividends. Trade each on its own.</p>
<div class="eq"><b>1 AAPL</b> &rarr; <b>xAAPL-PT</b> + <i>xAAPL-YT</i></div>
<svg class="curve" width="300" height="150" viewBox="0 0 300 150"><g stroke="#2A313A"><line x1="0" y1="140" x2="300" y2="140"/><line x1="0" y1="95" x2="300" y2="95"/><line x1="0" y1="50" x2="300" y2="50"/></g>
<path d="M20 118 L80 98 L170 74 L280 40" fill="none" stroke="#F5B229" stroke-width="4" stroke-linejoin="round"/>
<g fill="#0B0D10" stroke="#F5B229" stroke-width="3.5"><circle cx="20" cy="118" r="6"/><circle cx="80" cy="98" r="6"/><circle cx="170" cy="74" r="6"/></g><circle cx="280" cy="40" r="7" fill="#F5B229"/>
<g font-family="Geist Mono" font-size="13" fill="#8B95A3"><text x="12" y="136">3M</text><text x="72" y="116">6M</text><text x="162" y="92">1Y</text><text x="270" y="64">2Y</text></g></svg>
</div></body></html>""".replace("FONTS", FONTS).replace("LOCKUP", A("xero-lockup-light.svg"))
open("og-image.html", "w").write(og)

def sw(name, hexv, role):
    return f'<div class="sw"><div class="chip" style="background:{hexv}"></div><b>{name}</b><code>{hexv}</code><span>{role}</span></div>'

fav = A("favicon.svg")
def sized(svg, s):
    return svg.replace('width="32" height="32"', 'width="%d" height="%d"' % (s, s))
sizes = "".join("<div>" + sized(fav, s) + "%dpx</div>" % s for s in (16, 24, 32, 48, 64, 128))
big = lambda n: A(n).replace('width="64" height="64"', 'width="140" height="140"')
palette = "".join([
    sw("Ink", "#0B0D10", "Background, principal on light"), sw("Ink 900", "#14171C", "Surfaces"),
    sw("Line", "#2A313A", "Borders, grid"), sw("Muted", "#8B95A3", "Secondary text"),
    sw("Paper", "#F4F2EC", "Text, principal on dark"), sw("Amber", "#F5B229", "Yield. Accent, primary action"),
    sw("Positive", "#2BD49A", "Gains, buy"), sw("Negative", "#FF5D6C", "Losses, sell, errors"),
])

sheet = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Xero Brand</title><link rel="icon" href="assets/favicon.svg">FONTS
<style>
:root{--ink:#0B0D10;--ink2:#14171C;--line:#2A313A;--muted:#8B95A3;--paper:#F4F2EC;--amber:#F5B229}
*{box-sizing:border-box} body{margin:0;background:var(--ink);color:var(--paper);font-family:Geist,Inter,sans-serif}
main{max-width:1080px;margin:0 auto;padding:56px 24px 80px}
h1{font-size:44px;letter-spacing:-.03em;margin:28px 0 8px;font-weight:600} h2{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:500;margin:56px 0 16px}
p{color:var(--muted);max-width:640px;line-height:1.55;margin:0}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.tile{border:1px solid var(--line);border-radius:16px;padding:40px;display:grid;place-items:center;min-height:200px}
.tile.light{background:var(--paper);border-color:var(--paper)} .tile.amber{background:var(--amber);border-color:var(--amber)}
.tile svg{max-width:100%;height:auto}
.sizes{display:flex;gap:28px;align-items:flex-end;flex-wrap:wrap} .sizes div{display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--muted);font:12px 'Geist Mono',monospace}
.pal{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.sw{border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;font-size:13px}
.sw .chip{height:72px} .sw b{padding:10px 12px 0;font-weight:600} .sw code{padding:0 12px;color:var(--muted);font-family:'Geist Mono'} .sw span{padding:2px 12px 12px;color:var(--muted);font-size:12px}
.type{display:grid;gap:14px} .type .d{font-size:56px;letter-spacing:-.035em;font-weight:600;line-height:1} .type .m{font-family:'Geist Mono';font-size:20px;color:var(--amber)}
.do{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px} .do div{border:1px solid var(--line);border-radius:12px;padding:18px} .do b{display:block;margin-bottom:6px}
ul{margin:0;padding-left:18px;color:var(--muted);line-height:1.7}
img.og{width:100%;border-radius:16px;border:1px solid var(--line)}
@media(max-width:700px){.grid,.do{grid-template-columns:1fr} h1{font-size:34px}}
</style></head><body><main>
LOCKUP_LIGHT
<h1>Xero brand</h1>
<p>Xero unbundles the returns inside Stock Tokens. The mark is a token cut by an X, with one wedge, the yield, separating in amber. Principal is always neutral: ink on light, paper on dark. Amber always means yield.</p>
<h2>Logo</h2>
<div class="grid">
<div class="tile">LOCKUP_LIGHT</div><div class="tile light">LOCKUP_DARK</div>
<div class="tile">MARK_LIGHT</div><div class="tile amber">MARK_MONO</div>
</div>
<h2>Small sizes</h2><div class="sizes">SIZES</div>
<h2>Colour</h2><div class="pal">PALETTE</div>
<h2>Type</h2>
<div class="type"><div class="d">Geist, set tight</div><p>Geist for interface and display (&minus;3.5% tracking at display sizes). Geist Mono for every number, ticker and address, with tabular figures.</p><div class="m">xAAPL-YT-1Y &middot; 0.42% &middot; 1,024.50</div></div>
<h2>Voice</h2>
<div class="do">
<div><b>Say</b><ul><li>&ldquo;Keep the stock. Trade the dividends.&rdquo;</li><li>Principal Token (PT), Yield Token (YT)</li><li>&ldquo;Reinvested dividends&rdquo;, &ldquo;implied dividend yield&rdquo;</li></ul></div>
<div><b>Don't say</b><ul><li>&ldquo;Earn cash dividends&rdquo; (YT pays in Stock Tokens)</li><li>&ldquo;Guaranteed&rdquo;, &ldquo;risk-free&rdquo;, &ldquo;APY&rdquo; for stock exposure</li><li>Robinhood branding as if it were ours</li></ul></div>
</div>
<h2>Social card</h2><img class="og" src="assets/og-image.png" alt="Xero social card">
</main></body></html>"""
for k, v in {"FONTS": FONTS, "LOCKUP_LIGHT": A("xero-lockup-light.svg"), "LOCKUP_DARK": A("xero-lockup.svg"),
             "MARK_LIGHT": big("xero-mark-light.svg"), "MARK_MONO": big("xero-mark-mono-black.svg"),
             "SIZES": sizes, "PALETTE": palette}.items():
    sheet = sheet.replace(k, v)
open("index.html", "w").write(sheet)
print("wrote index.html, og-image.html")
