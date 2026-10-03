"""Generates Xero brand assets (SVG) from exact geometry. Run: python3 brand/generate.py

The mark: a token (circle) cut by an X into four wedges. The east wedge, the yield, is shifted outward
and coloured amber: one asset, unbundled into principal and yield.
"""
import math, os, json

OUT = os.path.join(os.path.dirname(__file__), "assets")
os.makedirs(OUT, exist_ok=True)

C = {
    "ink": "#0B0D10", "ink2": "#14171C", "ink3": "#1D2229", "line": "#2A313A", "muted": "#8B95A3",
    "paper": "#F4F2EC", "white": "#FFFFFF",
    "amber": "#F5B229", "amber_deep": "#C98A0E",
    "up": "#2BD49A", "down": "#FF5D6C",
}

def f(v): return f"{v:.3f}".rstrip("0").rstrip(".")

def wedge(cx, cy, r, gap, angle_deg, shift=0.0):
    """Wedge of a circle bounded by two X-cut bands of half-width gap/2, pointing at angle_deg."""
    a = math.sqrt(2) * gap / 2
    xi = (a + math.sqrt(2 * r * r - a * a)) / 2
    pts = [(a, 0), (xi, -(xi - a)), (xi, xi - a)]
    th = math.radians(angle_deg)
    def tr(p):
        x, y = p[0] + shift, p[1]
        return (cx + x * math.cos(th) - y * math.sin(th), cy + x * math.sin(th) + y * math.cos(th))
    (ax, ay), (ux, uy), (lx, ly) = map(tr, pts)
    return f"M{f(ax)} {f(ay)}L{f(ux)} {f(uy)}A{f(r)} {f(r)} 0 0 1 {f(lx)} {f(ly)}Z"

def mark_paths(cx=32, cy=32, r=26, gap=4.2, shift=3.4):
    principal = "".join(wedge(cx, cy, r, gap, a) for a in (90, 180, 270))
    yield_ = wedge(cx, cy, r, gap, 0, shift)
    return principal, yield_

def mark_svg(principal_color, yield_color, bg=None, size=64, pad=0, radius=0):
    p, y = mark_paths()
    vb = 64 + 2 * pad
    bg_el = f'<rect x="{-pad}" y="{-pad}" width="{vb}" height="{vb}" rx="{radius}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {vb} {vb}" width="{size}" height="{size}">'
            f'{bg_el}<path d="{p}" fill="{principal_color}"/><path d="{y}" fill="{yield_color}"/></svg>')

# ---- wordmark: geometric lowercase "xero", stroke-built for consistent rendering
SW = 6.6          # stroke width
XH = 36           # x-height
def wordmark_paths(x0=0.0):
    h = SW / 2
    d = []
    # x
    d.append(f"M{f(x0+h)} {f(h)}L{f(x0+30-h)} {f(XH-h)}M{f(x0+30-h)} {f(h)}L{f(x0+h)} {f(XH-h)}")
    x0 += 30 + 9
    # e: bowl with horizontal bar and an open lower-right terminal
    r = XH / 2 - h; cx = x0 + XH / 2; cy = XH / 2
    ang = math.radians(38)
    ex, ey = cx + r * math.cos(ang), cy + r * math.sin(ang)
    d.append(f"M{f(cx-r)} {f(cy)}H{f(cx+r)}A{f(r)} {f(r)} 0 1 0 {f(ex)} {f(ey)}")
    x0 += XH + 8
    # r: stem + shoulder
    sx = x0 + h
    d.append(f"M{f(sx)} {f(XH)}V{f(h)}M{f(sx)} {f(XH*0.46)}A{f(XH*0.36)} {f(XH*0.36)} 0 0 1 {f(sx+XH*0.36)} {f(h)}H{f(sx+XH*0.52)}")
    x0 += XH * 0.52 + h + 8
    # o
    cx = x0 + XH / 2
    d.append(f"M{f(cx-r)} {f(cy)}A{f(r)} {f(r)} 0 1 0 {f(cx+r)} {f(cy)}A{f(r)} {f(r)} 0 1 0 {f(cx-r)} {f(cy)}")
    x0 += XH
    return " ".join(d), x0

def wordmark_svg(color, height=36):
    d, w = wordmark_paths()
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {XH}" height="{height}" width="{f(w*height/XH)}">'
            f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{SW}" stroke-linecap="butt" stroke-linejoin="miter"/></svg>')

def lockup_svg(text_color, principal_color, yield_color, height=64):
    p, y = mark_paths()
    d, w = wordmark_paths()
    gap = 18
    scale = 0.62      # wordmark x-height relative to the 64-unit mark
    ty = (64 - XH * scale) / 2
    total = 64 + gap + w * scale
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(total)} 64" height="{height}" width="{f(total*height/64)}">'
            f'<path d="{p}" fill="{principal_color}"/><path d="{y}" fill="{yield_color}"/>'
            f'<g transform="translate({64+gap} {f(ty)}) scale({scale})"><path d="{d}" fill="none" stroke="{text_color}" '
            f'stroke-width="{SW}"/></g></svg>')

files = {
    "xero-mark.svg": mark_svg(C["ink"], C["amber"]),
    "xero-mark-light.svg": mark_svg(C["paper"], C["amber"]),
    "xero-mark-mono-black.svg": mark_svg(C["ink"], C["ink"]),
    "xero-mark-mono-white.svg": mark_svg(C["white"], C["white"]),
    "xero-app-icon.svg": mark_svg(C["paper"], C["amber"], bg=C["ink"], size=512, pad=14, radius=20),
    "favicon.svg": mark_svg(C["paper"], C["amber"], bg=C["ink"], size=32, pad=6, radius=16),
    "xero-wordmark.svg": wordmark_svg(C["ink"]),
    "xero-wordmark-light.svg": wordmark_svg(C["paper"]),
    "xero-lockup.svg": lockup_svg(C["ink"], C["ink"], C["amber"]),
    "xero-lockup-light.svg": lockup_svg(C["paper"], C["paper"], C["amber"]),
}
for name, svg in files.items():
    open(os.path.join(OUT, name), "w").write(svg + "\n")

tokens = {
    "color": {
        "ink": {"950": C["ink"], "900": C["ink2"], "800": C["ink3"], "700": C["line"]},
        "muted": C["muted"], "paper": C["paper"],
        "amber": {"500": C["amber"], "700": C["amber_deep"]},
        "principal": {"onDark": C["paper"], "onLight": C["ink"]},
        "yield": C["amber"],
        "positive": C["up"], "negative": C["down"],
    },
    "font": {"sans": "Geist, Inter, system-ui, sans-serif", "mono": "Geist Mono, JetBrains Mono, ui-monospace, monospace"},
    "radius": {"sm": 8, "md": 12, "lg": 16},
}
json.dump(tokens, open(os.path.join(OUT, "tokens.json"), "w"), indent=2)
print("wrote", len(files) + 1, "files to", OUT)
