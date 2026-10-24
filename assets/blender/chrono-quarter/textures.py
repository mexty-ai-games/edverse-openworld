"""Painted textures for the Chrono Quarter (EdVerse OpenWorld), generated from scratch.

Run with system Python (numpy + Pillow):  python3 textures.py <out_dir>
Reuses the Idea Grove's own noise helpers (../textures.py, OpenWorld's code) and paints every image
here: travertine, terracotta and kawara roof tiles, Edo wood and lacquer, shoji paper, granite,
Maya limestone blocks and an original glyph panel, cherry blossom / jungle leaf / palm atlases,
cobbles and forum paving for the streets, the hazy skyline backdrop, and the artifact skins
(clay, an original woodblock-style landscape print, glaze, jade, painted codex, koi).
Nothing is copied from a photo, a museum object or another game.
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else "build/tex"
sys.argv = [sys.argv[0], OUT]
sys.path.insert(0, os.path.dirname(HERE))
import textures as G  # noqa: E402  (the Idea Grove's helpers)

G.OUT = OUT
os.makedirs(OUT, exist_ok=True)
fnoise, ramp, voronoi, to_img, normal_from_height, save, leaf_shape = (
    G.fnoise, G.ramp, G.voronoi, G.to_img, G.normal_from_height, G.save, G.leaf_shape)


# ----------------------------------------------------------------------------- stone
def travertine(n=1024, seed=201):
    """Warm Roman travertine / marble: soft bands, pores, faint veins."""
    yy, xx = np.mgrid[0:n, 0:n] / n
    band = fnoise(n, 2.2, seed, aniso=(0.25, 3.0))
    pores = fnoise(n, 0.6, seed + 1)
    vein = np.abs(fnoise(n, 1.8, seed + 2) - 0.5)
    vein = np.clip(1 - vein * 18, 0, 1)
    v = band * 0.75 + fnoise(n, 1.4, seed + 3) * 0.25
    rgb = ramp(v, [(0, (196, 178, 150)), (0.45, (222, 206, 178)), (0.75, (236, 224, 200)), (1, (246, 238, 220))])
    rgb *= (1 - 0.18 * (pores > 0.72))[..., None]
    rgb *= (1 - 0.12 * vein)[..., None]
    save(to_img(rgb), "travertine.jpg")
    save(to_img(normal_from_height(v * 0.5 + (pores > 0.72) * -0.3 + 0.3, 2.5)), "travertine_n.jpg")


def granite(n=512, seed=211):
    v = fnoise(n, 1.6, seed) * 0.5 + fnoise(n, 0.3, seed + 1) * 0.5
    rgb = ramp(v, [(0, (88, 88, 84)), (0.4, (126, 124, 116)), (0.7, (152, 148, 138)), (1, (186, 182, 170))])
    sp = fnoise(n, 0.1, seed + 2)
    rgb *= (0.8 + 0.25 * (sp > 0.55))[..., None]
    moss = fnoise(n, 2.0, seed + 3)
    rgb = rgb * (1 - np.clip((moss - 0.62) * 4, 0, 0.6))[..., None] + np.array([0.33, 0.43, 0.2]) * np.clip((moss - 0.62) * 4, 0, 0.6)[..., None]
    save(to_img(rgb), "granite.jpg")
    save(to_img(normal_from_height(v, 3.0)), "granite_n.jpg")


def limestone_blocks(n=1024, seed=221):
    """Maya limestone masonry: staggered blocks, weathered, lichen."""
    rows, cols = 8, 4
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / n
    r = np.floor(yy * rows).astype(int)
    off = (r % 2) * 0.5 / cols
    c = np.floor(((xx + off) % 1.0) * cols).astype(int)
    rng = np.random.default_rng(seed)
    tone = rng.uniform(0, 1, (rows, cols + 1))[r, c]
    fy = (yy * rows) % 1.0
    fx = (((xx + off) % 1.0) * cols) % 1.0
    edge = np.minimum(np.minimum(fy, 1 - fy) * 1.0, np.minimum(fx, 1 - fx) * 0.5 * rows / cols * 0.5)
    joint = np.clip(edge * 22, 0, 1)
    nz = fnoise(n, 1.7, seed + 1)
    v = tone * 0.35 + nz * 0.65
    rgb = ramp(v, [(0, (122, 112, 92)), (0.4, (164, 152, 124)), (0.7, (190, 178, 148)), (1, (212, 202, 174))])
    lich = fnoise(n, 2.1, seed + 2)
    lm = np.clip((lich - 0.58) * 3.5, 0, 0.75)
    rgb = rgb * (1 - lm)[..., None] + np.array([0.42, 0.5, 0.28])[None, None] * lm[..., None]
    rgb *= (0.45 + 0.55 * joint)[..., None]
    save(to_img(rgb), "limestone.jpg")
    save(to_img(normal_from_height(joint * 0.8 + nz * 0.2, 4.0)), "limestone_n.jpg")


def glyph_panel(w=512, h=1024, seed=231):
    """An original carved panel in the spirit of Maya glyph blocks: a grid of rounded cartouches with
    abstract inner motifs (dots, scrolls, bars). It is decorative, not real writing."""
    rng = random.Random(seed)
    v = fnoise(512, 1.7, seed)
    base = ramp(v, [(0, (150, 138, 112)), (0.6, (190, 178, 148)), (1, (214, 204, 176))])
    img = to_img(base).resize((w, h)).convert("RGB")
    hm = Image.new("L", (w, h), 128)
    dh = ImageDraw.Draw(hm)
    d = ImageDraw.Draw(img, "RGBA")
    cols, rows = 2, 5
    cw, ch = w / cols, (h * 0.86) / rows
    top = h * 0.12
    # crown band
    d.rectangle([w * 0.06, h * 0.02, w * 0.94, h * 0.1], outline=(90, 78, 60, 255), width=6)
    dh.rectangle([w * 0.06, h * 0.02, w * 0.94, h * 0.1], outline=40, width=6)
    for k in range(9):
        x = w * (0.12 + k * 0.095)
        d.ellipse([x - 12, h * 0.06 - 12, x + 12, h * 0.06 + 12], outline=(90, 78, 60, 255), width=5)
        dh.ellipse([x - 12, h * 0.06 - 12, x + 12, h * 0.06 + 12], outline=60, width=5)
    for r in range(rows):
        for c in range(cols):
            x0, y0 = c * cw + 14, top + r * ch + 10
            x1, y1 = x0 + cw - 28, y0 + ch - 20
            d.rounded_rectangle([x0, y0, x1, y1], radius=40, outline=(84, 72, 56, 255), width=7)
            dh.rounded_rectangle([x0, y0, x1, y1], radius=40, outline=30, width=7)
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            s = (x1 - x0) * 0.3
            kind = rng.randint(0, 4)
            col = (84, 72, 56, 255)
            if kind == 0:  # dots and bar (like a number)
                for i in range(rng.randint(1, 4)):
                    xx = cx - s + i * s * 0.6
                    d.ellipse([xx - 9, cy - s * 0.5 - 9, xx + 9, cy - s * 0.5 + 9], fill=col)
                    dh.ellipse([xx - 9, cy - s * 0.5 - 9, xx + 9, cy - s * 0.5 + 9], fill=50)
                d.rounded_rectangle([cx - s, cy, cx + s, cy + 16], radius=8, fill=col)
                dh.rounded_rectangle([cx - s, cy, cx + s, cy + 16], radius=8, fill=50)
            elif kind == 1:  # scroll
                for k in range(3):
                    rr = s * (1 - k * 0.3)
                    d.arc([cx - rr, cy - rr, cx + rr, cy + rr], 30 + k * 40, 300 + k * 20, fill=col, width=7)
                    dh.arc([cx - rr, cy - rr, cx + rr, cy + rr], 30 + k * 40, 300 + k * 20, fill=40, width=7)
            elif kind == 2:  # face-like cartouche (eyes + band)
                d.ellipse([cx - s, cy - s * 0.8, cx + s, cy + s * 0.8], outline=col, width=6)
                for sx in (-1, 1):
                    d.ellipse([cx + sx * s * 0.4 - 10, cy - 14, cx + sx * s * 0.4 + 10, cy + 6], fill=col)
                d.line([cx - s * 0.5, cy + s * 0.4, cx + s * 0.5, cy + s * 0.4], fill=col, width=6)
                dh.ellipse([cx - s, cy - s * 0.8, cx + s, cy + s * 0.8], outline=40, width=6)
            elif kind == 3:  # stepped motif
                pts = [(cx - s, cy + s * 0.6), (cx - s, cy), (cx - s * 0.4, cy), (cx - s * 0.4, cy - s * 0.6), (cx + s * 0.4, cy - s * 0.6),
                       (cx + s * 0.4, cy), (cx + s, cy), (cx + s, cy + s * 0.6)]
                d.line(pts, fill=col, width=7, joint="curve")
                dh.line(pts, fill=40, width=7)
            else:  # leaf / maize motif
                leaf_shape(d, cx - s * 0.6, cy + s * 0.5, s * 1.4, s * 0.35, -1.0, col, vein=False)
                leaf_shape(d, cx + s * 0.6, cy + s * 0.5, s * 1.4, s * 0.35, -2.14, col, vein=False)
                d.ellipse([cx - 10, cy - s * 0.7, cx + 10, cy - s * 0.7 + 20], fill=col)
    img = img.filter(ImageFilter.SMOOTH)
    save(img, "glyph_panel.jpg")
    h_arr = np.asarray(hm.filter(ImageFilter.GaussianBlur(2)), dtype=np.float32) / 255.0
    save(to_img(normal_from_height(h_arr, 4.0)), "glyph_panel_n.jpg")


# ----------------------------------------------------------------------------- roofs, wood, paper
def roof_tiles(name, n, stops, seed, rows=10, cols=7):
    """Overlapping barrel / pan tiles seen from above: rows of rounded tongues with shadowed lips."""
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / n
    fy = (yy * rows) % 1.0
    fx = (xx * cols) % 1.0
    ridge = np.sin(fx * math.pi) ** 0.6  # barrel profile across a tile
    lip = np.clip(1 - fy * 1.2, 0, 1) ** 3  # dark under the next row's lip
    rng = np.random.default_rng(seed)
    tone = rng.uniform(0, 1, (rows, cols))[np.floor(yy * rows).astype(int) % rows, np.floor(xx * cols).astype(int) % cols]
    nz = fnoise(n, 1.8, seed)
    v = tone * 0.3 + nz * 0.4 + ridge * 0.3
    rgb = ramp(v, stops)
    rgb *= (0.55 + 0.45 * ridge)[..., None]
    rgb *= (1 - 0.55 * lip)[..., None]
    lich = fnoise(n, 2.0, seed + 4)
    lm = np.clip((lich - 0.62) * 2.5, 0, 0.5)
    rgb = rgb * (1 - lm)[..., None] + np.array([0.4, 0.46, 0.26]) * lm[..., None]
    save(to_img(rgb), name + ".jpg")
    save(to_img(normal_from_height(ridge * 0.6 - lip * 0.4, 3.0)), name + "_n.jpg")


def edo_wood(n=1024, seed=241):
    yy, xx = np.mgrid[0:n, 0:n] / n
    warp = fnoise(n, 2.2, seed, aniso=(4.0, 0.4)) * 0.06
    grain = np.sin((xx * 30 + warp * 80) * math.pi * 2) * 0.5 + 0.5
    knots = fnoise(n, 2.2, seed + 1, aniso=(3.0, 0.4))
    v = grain * 0.4 + knots * 0.6
    rgb = ramp(v, [(0, (72, 42, 26)), (0.45, (108, 64, 38)), (0.75, (138, 88, 54)), (1, (164, 112, 72))])
    save(to_img(rgb), "edo_wood.jpg")
    save(to_img(normal_from_height(grain * 0.5 + knots * 0.5, 2.0)), "edo_wood_n.jpg")


def lacquer(n=256, seed=251):
    v = fnoise(n, 1.8, seed)
    rgb = ramp(v, [(0, (150, 36, 22)), (0.5, (186, 54, 30)), (1, (210, 80, 44))])
    save(to_img(rgb), "lacquer.jpg")


def shoji(n=512, seed=261):
    v = fnoise(n, 1.2, seed)
    rgb = ramp(v, [(0, (226, 214, 186)), (1, (246, 238, 216))])
    img = to_img(rgb)
    d = ImageDraw.Draw(img)
    for k in range(5):
        x = k * n / 4
        d.rectangle([x - 6, 0, x + 6, n], fill=(92, 56, 32))
    for k in range(7):
        y = k * n / 6
        d.rectangle([0, y - 5, n, y + 5], fill=(92, 56, 32))
    save(img.filter(ImageFilter.SMOOTH), "shoji.jpg")
    # emissive version: warm light glowing through the paper
    e = np.asarray(img, dtype=np.float32) / 255.0
    e = e * np.array([1.0, 0.72, 0.38])
    save(to_img(e), "shoji_e.jpg")


def plaster(n=512, seed=271):
    v = fnoise(n, 1.9, seed) * 0.7 + fnoise(n, 0.8, seed + 1) * 0.3
    rgb = ramp(v, [(0, (196, 168, 132)), (0.5, (220, 196, 160)), (1, (236, 218, 186))])
    save(to_img(rgb), "plaster.jpg")


def iron(n=256, seed=281):
    v = fnoise(n, 1.6, seed)
    rgb = ramp(v, [(0, (30, 26, 24)), (0.6, (52, 44, 38)), (1, (86, 66, 48))])
    save(to_img(rgb), "iron.jpg")


def lamp_glass(n=256, seed=291):
    yy, xx = np.mgrid[0:n, 0:n] / n
    r = np.hypot(xx - 0.5, (yy - 0.55) * 1.3)
    v = np.clip(1 - r * 1.6, 0, 1)
    rgb = ramp(v, [(0, (214, 120, 40)), (0.5, (255, 196, 96)), (1, (255, 246, 214))])
    save(to_img(rgb), "lamp_glow.jpg")


def portal(n=512, seed=301):
    """The exit gate's shimmer: a warm swirl, brighter in the middle (used as an emissive map)."""
    yy, xx = np.mgrid[0:n, 0:n] / n
    a = np.arctan2(yy - 0.5, xx - 0.5)
    r = np.hypot(xx - 0.5, yy - 0.5)
    sw = np.sin(a * 5 + r * 30) * 0.5 + 0.5
    v = np.clip(1 - r * 1.4, 0, 1) * (0.65 + 0.35 * sw)
    rgb = ramp(v, [(0, (120, 60, 30)), (0.4, (240, 150, 70)), (0.75, (255, 214, 140)), (1, (255, 250, 230))])
    save(to_img(rgb), "portal.jpg")


# ----------------------------------------------------------------------------- foliage atlases (alpha)
def blossom_atlas(n=1024, seed=311):
    """Cherry blossom clumps: four quadrants of tiny 5-petal flowers in pinks, dense in the middle."""
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    q = n // 2
    pals = [
        [(222, 118, 156), (238, 150, 182), (248, 184, 206), (255, 214, 228)],
        [(206, 104, 146), (230, 140, 176), (244, 174, 200), (252, 206, 222)],
        [(232, 132, 166), (244, 164, 192), (252, 196, 214), (255, 226, 236)],
        [(214, 112, 152), (236, 146, 180), (248, 182, 204), (255, 220, 232)],
    ]
    for qi in range(4):
        ox, oy = (qi % 2) * q, (qi // 2) * q
        cx, cy = ox + q / 2, oy + q / 2
        # a few twigs and leaves first
        for _ in range(6):
            a = rng.uniform(0, math.pi * 2)
            d.line([(cx, cy), (cx + math.cos(a) * q * 0.38, cy + math.sin(a) * q * 0.38)], fill=(86, 52, 40, 255), width=4)
        for _ in range(16):
            r = q * 0.4 * math.sqrt(rng.random())
            a = rng.random() * math.pi * 2
            leaf_shape(d, cx + math.cos(a) * r, cy + math.sin(a) * r, rng.uniform(18, 28), 7, rng.uniform(0, 6.28), (96, 132, 64, 255), vein=False)
        pts = []
        for _ in range(420):
            r = q * 0.44 * math.sqrt(rng.random())
            a = rng.random() * math.pi * 2
            pts.append((cy + math.sin(a) * r * 0.9, cx + math.cos(a) * r))
        pts.sort()
        for i, (y, x) in enumerate(pts):
            depth = i / len(pts)
            pal = pals[qi]
            col = pal[min(3, int(depth * 4))]
            jit = rng.uniform(0.92, 1.05)
            col = tuple(min(255, int(c * jit)) for c in col)
            s = rng.uniform(6, 10)
            rot = rng.uniform(0, 6.28)
            for p in range(5):
                aa = rot + p * math.pi * 2 / 5
                px, py = x + math.cos(aa) * s * 0.6, y + math.sin(aa) * s * 0.6
                d.ellipse([px - s * 0.5, py - s * 0.5, px + s * 0.5, py + s * 0.5], fill=col + (255,))
            d.ellipse([x - 1.6, y - 1.6, x + 1.6, y + 1.6], fill=(170, 60, 90, 255))
    save(img.filter(ImageFilter.SMOOTH), "blossom.png")


def broadleaf(w=512, h=1024, seed=321):
    """One big tropical leaf (split, glossy) for jungle clumps; the stem at the bottom."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    cx = w / 2
    L = h * 0.92
    pts_l, pts_r = [], []
    for i in range(41):
        t = i / 40
        y = h * 0.97 - t * L
        wid = math.sin(min(1.0, t * 1.05) * math.pi) ** 0.7 * w * 0.46 * (1 - 0.15 * t)
        bend = math.sin(t * 2.4) * 16
        pts_l.append((cx + bend - wid, y))
        pts_r.append((cx + bend + wid, y))
    poly = pts_l + pts_r[::-1]
    d.polygon(poly, fill=(46, 104, 40, 255))
    # lighter half
    mid = [(cx + math.sin((i / 40) * 2.4) * 16, h * 0.97 - (i / 40) * L) for i in range(41)]
    d.polygon(pts_r + mid[::-1], fill=(62, 128, 48, 255))
    # splits (cut slits) and veins
    for k in range(9):
        t = 0.18 + k * 0.08
        i = int(t * 40)
        y = mid[i][1]
        for side in (-1, 1):
            x0 = mid[i][0]
            x1 = (pts_r if side > 0 else pts_l)[i][0]
            d.line([(x0 + side * 6, y), (x1, y - 40)], fill=(32, 76, 30, 255), width=3)
            if rng.random() < 0.55:
                d.polygon([(x1 - side * 2, y - 46), (x1 - side * (abs(x1 - x0) * 0.45), y - 30), (x1 - side * 2, y - 32)], fill=(0, 0, 0, 0))
    d.line(mid, fill=(120, 150, 70, 255), width=6)
    save(img.filter(ImageFilter.SMOOTH), "broadleaf.png")


def palm_frond(w=512, h=1024, seed=331):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    cx = w / 2

    def spine(t):
        return cx + math.sin(t * 1.6) * 12, h * 0.98 - t * h * 0.95

    for i in range(44):
        t = 0.04 + i / 44 * 0.94
        x, y = spine(t)
        ln = (math.sin(min(1, t * 1.15) * math.pi) ** 0.6) * w * 0.47 + 8
        for side in (-1, 1):
            a = (-0.35 if side > 0 else math.pi + 0.35) + rng.uniform(-0.08, 0.08)
            g = rng.uniform(0.85, 1.12) * (0.85 + 0.3 * t)
            col = (int(52 * g), int(112 * g), int(44 * g), 255)
            leaf_shape(d, x, y, ln, rng.uniform(7, 10), a, col, vein=False)
    for i in range(80):
        t0, t1 = i / 80, (i + 1) / 80
        d.line([spine(t0), spine(t1)], fill=(96, 112, 52, 255), width=max(2, int(8 * (1 - t0))))
    save(img.filter(ImageFilter.SMOOTH), "palm.png")


def vine_atlas(n=512, seed=341):
    """Hanging ivy strands for the pyramid and walls (alpha)."""
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    for k in range(7):
        x = n * (0.08 + k * 0.14) + rng.uniform(-10, 10)
        y = 0
        while y < n * rng.uniform(0.7, 1.0):
            nx_, ny = x + rng.uniform(-8, 8), y + rng.uniform(14, 24)
            d.line([(x, y), (nx_, ny)], fill=(70, 80, 40, 255), width=3)
            for side in (-1, 1):
                g = rng.uniform(0.8, 1.15)
                leaf_shape(d, nx_, ny, rng.uniform(16, 26), rng.uniform(7, 10), (0.3 if side > 0 else math.pi - 0.3) + rng.uniform(-0.4, 0.6),
                           (int(58 * g), int(116 * g), int(44 * g), 255), vein=False)
            x, y = nx_, ny
    save(img.filter(ImageFilter.SMOOTH), "vines.png")


def lily_atlas(n=512, seed=351):
    """Left half: a lily pad (top view). Right half: a pink lotus flower (side)."""
    img = Image.new("RGBA", (n, n // 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    q = n // 2
    c = q / 2
    d.pieslice([8, 8, q - 8, q - 8], 10, 350, fill=(58, 112, 46, 255))
    d.pieslice([24, 24, q - 24, q - 24], 10, 350, fill=(76, 136, 56, 255))
    for k in range(12):
        a = math.radians(15 + k * 28)
        d.line([(c, c), (c + math.cos(a) * (c - 12), c + math.sin(a) * (c - 12))], fill=(48, 96, 38, 255), width=2)
    ox = q
    for k in range(9):
        a = -math.pi / 2 + (k - 4) * 0.32
        L = q * 0.42
        leaf_shape(d, ox + c, q * 0.86, L, L * 0.32, a, (238, 150 + k * 4, 180, 255), vein=False)
    d.ellipse([ox + c - 14, q * 0.86 - 30, ox + c + 14, q * 0.86 - 2], fill=(250, 210, 90, 255))
    save(img.filter(ImageFilter.SMOOTH), "lily.png")


# ----------------------------------------------------------------------------- ground
def cobbles(n=1024, seed=361):
    """Rounded cobblestones in a loose running pattern, warm grey-brown, dark joints."""
    f1, f2, cid, k = voronoi(n, 144, seed, 0.55)
    edge = f2 - f1
    rng = np.random.default_rng(seed)
    tone = rng.uniform(0, 1, k)[cid]
    hue = rng.uniform(0, 1, k)[cid]
    nz = fnoise(n, 1.6, seed + 1)
    v = np.clip(tone * 0.5 + nz * 0.5, 0, 1)
    warm = ramp(v, [(0, (118, 100, 82)), (0.5, (160, 140, 114)), (1, (196, 178, 150))])
    cool = ramp(v, [(0, (104, 100, 96)), (0.5, (146, 140, 132)), (1, (184, 178, 166))])
    rgb = warm * (hue[..., None] > 0.35) + cool * (hue[..., None] <= 0.35)
    dome = np.clip(edge / 26.0, 0, 1) ** 0.5
    rgb *= (0.5 + 0.5 * dome)[..., None]
    grout = np.clip((edge - 2.5) / 5.0, 0, 1)
    joint = ramp(fnoise(n, 1.5, seed + 2), [(0, (52, 44, 36)), (1, (84, 76, 52))])
    rgb = rgb * grout[..., None] + joint * (1 - grout[..., None])
    save(to_img(rgb).filter(ImageFilter.SMOOTH), "cobbles.jpg")


def forum_paving(n=1024, seed=371):
    """Large rectangular travertine slabs of a Roman forum, worn and warm."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / n
    rows = 4
    r = np.floor(yy * rows).astype(int)
    rgb = np.zeros((n, n, 3))
    cuts = []
    for i in range(rows):
        xs = np.sort(rng.uniform(0, 1, 2))
        cuts.append(np.concatenate([[0.0], xs, [1.0]]))
    cid = np.zeros((n, n), int)
    fx = np.zeros((n, n))
    for i in range(rows):
        m = r == i
        c = np.searchsorted(cuts[i], xx[m], side="right") - 1
        cid[m] = i * 10 + c
        lo = cuts[i][c]
        hi = cuts[i][c + 1]
        fx[m] = np.minimum(xx[m] - lo, hi - xx[m])
    fy = np.minimum((yy * rows) % 1.0, 1 - (yy * rows) % 1.0) / rows
    edge = np.minimum(fx, fy) * n
    tone = rng.uniform(0, 1, rows * 10)[cid]
    nz = fnoise(n, 1.8, seed + 1)
    band = fnoise(n, 2.2, seed + 2, aniso=(0.3, 2.5))
    v = np.clip(tone * 0.35 + nz * 0.35 + band * 0.3, 0, 1)
    rgb = ramp(v, [(0, (170, 150, 120)), (0.5, (204, 186, 154)), (1, (230, 216, 188))])
    rgb *= (0.6 + 0.4 * np.clip(edge / 10.0, 0, 1))[..., None]
    grout = np.clip((edge - 1.5) / 2.5, 0, 1)
    rgb = rgb * grout[..., None] + np.array([0.3, 0.26, 0.2]) * (1 - grout[..., None])
    save(to_img(rgb).filter(ImageFilter.SMOOTH), "forum_paving.jpg")


def skyline(w=2048, h=512, seed=381):
    """Hazy far-off city of the three eras at dusk (alpha): colonnades, curved roofs, step pyramids,
    palms and blossoms, as layered silhouettes that fade into the warm haze. Tiles horizontally."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rng = random.Random(seed)
    layers = [((214, 160, 128), 150, 0.62), ((186, 128, 104), 200, 0.72), ((156, 104, 92), 235, 0.82)]
    for li, (col, alpha, base) in enumerate(layers):
        lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        gy = h * base
        x = -40.0 + li * 70
        while x < w + 40:
            kind = rng.choice(["temple", "roof", "pyramid", "tree", "tree", "house", "tower", "palm"])
            s = rng.uniform(0.7, 1.2) * (0.8 + 0.25 * li)
            if kind == "temple":
                W, H = 160 * s, 70 * s
                d.rectangle([x, gy - H, x + W, gy], fill=col + (alpha,))
                d.polygon([(x - 8, gy - H), (x + W / 2, gy - H - 34 * s), (x + W + 8, gy - H)], fill=col + (alpha,))
                for k in range(7):
                    cx_ = x + 10 + k * (W - 20) / 6
                    d.rectangle([cx_ - 4, gy - H, cx_ + 4, gy], fill=tuple(int(c * 0.9) for c in col) + (alpha,))
                x += W + rng.uniform(10, 40)
            elif kind == "roof":
                W, H = 120 * s, 46 * s
                d.rectangle([x + 14, gy - H, x + W - 14, gy], fill=col + (alpha,))
                pts = [(x - 16, gy - H + 6)] + [(x + W / 2 + (W / 2 + 16) * math.cos(t), gy - H - 30 * s * math.sin(t) ** 0.6) for t in np.linspace(math.pi, 0, 12)] + [(x + W + 16, gy - H + 6)]
                d.polygon(pts, fill=col + (alpha,))
                x += W + rng.uniform(10, 40)
            elif kind == "pyramid":
                W, H = 200 * s, 120 * s
                for k in range(6):
                    t = k / 6
                    d.rectangle([x + W * t * 0.32, gy - H * (t + 1 / 6), x + W - W * t * 0.32, gy - H * t], fill=col + (alpha,))
                d.rectangle([x + W * 0.4, gy - H * 1.22, x + W * 0.6, gy - H], fill=col + (alpha,))
                x += W + rng.uniform(10, 40)
            elif kind == "tower":
                W, H = 40 * s, 150 * s
                d.rectangle([x, gy - H, x + W, gy], fill=col + (alpha,))
                d.polygon([(x - 8, gy - H), (x + W / 2, gy - H - 26 * s), (x + W + 8, gy - H)], fill=col + (alpha,))
                x += W + rng.uniform(10, 50)
            elif kind == "house":
                W, H = 80 * s, 40 * s
                d.rectangle([x, gy - H, x + W, gy], fill=col + (alpha,))
                d.polygon([(x - 6, gy - H), (x + W / 2, gy - H - 22 * s), (x + W + 6, gy - H)], fill=col + (alpha,))
                x += W + rng.uniform(4, 20)
            elif kind == "palm":
                tx = x + 20
                d.line([(tx, gy), (tx + 10, gy - 110 * s)], fill=col + (alpha,), width=6)
                for k in range(7):
                    a = math.pi + k * math.pi / 6
                    d.line([(tx + 10, gy - 110 * s), (tx + 10 + math.cos(a) * 50 * s, gy - 110 * s - math.sin(a) * 30 * s + 18 * s)], fill=col + (alpha,), width=7)
                x += 60 * s
            else:
                r = rng.uniform(28, 46) * s
                for k in range(5):
                    ox_, oy_ = rng.uniform(-r, r), rng.uniform(-r * 0.6, r * 0.3)
                    d.ellipse([x + r + ox_ - r * 0.7, gy - r * 1.6 + oy_ - r * 0.7, x + r + ox_ + r * 0.7, gy - r * 1.6 + oy_ + r * 0.7], fill=col + (alpha,))
                d.rectangle([x + r - 4, gy - r, x + r + 4, gy], fill=col + (alpha,))
                x += r * 2 + rng.uniform(0, 20)
        d.rectangle([0, gy, w, h], fill=col + (alpha,))
        lay = lay.filter(ImageFilter.GaussianBlur(3 - li))
        img = Image.alpha_composite(img, lay)
    # haze: fade the upper silhouettes, keep the bottom solid
    a = np.asarray(img).astype(np.float32)
    yy = np.linspace(0, 1, h)[:, None]
    a[..., 3] *= np.clip(0.35 + yy * 1.1, 0, 1)
    # make it wrap: blend the right edge into the left
    k = 64
    for i in range(k):
        t = i / k
        a[:, w - k + i] = a[:, w - k + i] * (1 - t) + a[:, i] * t
    save(Image.fromarray(a.clip(0, 255).astype(np.uint8)), "skyline.png")


# ----------------------------------------------------------------------------- artifacts
def terracotta(n=512, seed=391):
    v = fnoise(n, 1.8, seed) * 0.7 + fnoise(n, 0.7, seed + 1) * 0.3
    rgb = ramp(v, [(0, (146, 70, 40)), (0.5, (178, 94, 54)), (1, (206, 124, 76))])
    save(to_img(rgb), "terracotta.jpg")


def landscape_print(w=512, h=768, seed=401):
    """An ORIGINAL picture in the woodblock-print manner: a snowy volcano over a calm bay, a little
    boat, flat colours and outlines, a cartouche with a seal. Not a copy of any real print."""
    img = Image.new("RGB", (w, h), (238, 224, 190))
    d = ImageDraw.Draw(img)
    for y in range(int(h * 0.55)):
        t = y / (h * 0.55)
        c = (int(240 - 30 * t), int(206 - 20 * t), int(160 + 40 * t))
        d.line([(0, y), (w, y)], fill=c)
    # sun
    d.ellipse([w * 0.66, h * 0.1, w * 0.86, h * 0.1 + w * 0.2], fill=(214, 70, 52))
    # mountain
    d.polygon([(-20, h * 0.58), (w * 0.42, h * 0.2), (w * 1.05, h * 0.6)], fill=(70, 82, 120))
    d.polygon([(w * 0.33, h * 0.27), (w * 0.42, h * 0.2), (w * 0.52, h * 0.28), (w * 0.47, h * 0.3), (w * 0.43, h * 0.27), (w * 0.39, h * 0.31)], fill=(250, 248, 240))
    # bay with stylised ripples
    d.rectangle([0, h * 0.55, w, h], fill=(48, 86, 132))
    rng = random.Random(seed)
    for k in range(30):
        y = h * 0.58 + k * h * 0.014
        x = rng.uniform(-40, w)
        d.arc([x, y, x + rng.uniform(40, 90), y + 20], 200, 340, fill=(220, 232, 240), width=3)
    # boat
    d.polygon([(w * 0.2, h * 0.75), (w * 0.5, h * 0.75), (w * 0.45, h * 0.8), (w * 0.24, h * 0.8)], fill=(120, 70, 40))
    d.line([(w * 0.35, h * 0.75), (w * 0.35, h * 0.62)], fill=(80, 50, 30), width=4)
    d.polygon([(w * 0.35, h * 0.63), (w * 0.47, h * 0.72), (w * 0.35, h * 0.72)], fill=(236, 226, 200))
    # pine on the shore
    d.rectangle([w * 0.85, h * 0.6, w * 0.87, h * 0.9], fill=(70, 46, 30))
    for k in range(4):
        y = h * (0.58 + k * 0.06)
        d.ellipse([w * 0.74, y, w * 0.98, y + h * 0.05], fill=(36, 82, 50))
    # cartouche + seal + border
    d.rectangle([w * 0.06, h * 0.05, w * 0.16, h * 0.32], fill=(236, 214, 120), outline=(60, 40, 30), width=3)
    for k in range(5):
        d.line([(w * 0.09, h * (0.08 + k * 0.045)), (w * 0.13, h * (0.08 + k * 0.045))], fill=(60, 40, 30), width=4)
    d.rectangle([w * 0.07, h * 0.9, w * 0.13, h * 0.94], fill=(196, 50, 40))
    d.rectangle([0, 0, w - 1, h - 1], outline=(40, 30, 24), width=8)
    save(img.filter(ImageFilter.SMOOTH), "print.jpg")


def glaze(n=512, seed=411):
    """Tea-bowl glaze: dark brown body with a pooled, speckled ash glaze running down."""
    yy, xx = np.mgrid[0:n, 0:n] / n
    run = fnoise(n, 2.0, seed, aniso=(3.0, 0.3))
    v = np.clip(yy * 1.2 + (run - 0.5) * 0.6, 0, 1)
    rgb = ramp(v, [(0, (226, 214, 190)), (0.4, (190, 170, 140)), (0.6, (104, 70, 46)), (1, (66, 40, 26))])
    sp = fnoise(n, 0.15, seed + 1)
    rgb *= (0.88 + 0.12 * (sp < 0.6))[..., None]
    save(to_img(rgb), "glaze.jpg")


def jade(n=256, seed=421):
    v = fnoise(n, 1.6, seed) * 0.6 + fnoise(n, 2.4, seed + 1, aniso=(0.4, 2.0)) * 0.4
    rgb = ramp(v, [(0, (30, 92, 62)), (0.45, (56, 134, 90)), (0.75, (96, 170, 120)), (1, (170, 214, 176))])
    save(to_img(rgb), "jade.jpg")


def maya_vessel(w=1024, h=256, seed=431):
    """Painted cacao cup wrap: cream band, red-orange rims, a row of abstract glyph blocks, and
    simple seated figure silhouettes with cacao pods (decorative, original)."""
    img = Image.new("RGB", (w, h), (222, 180, 124))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, h * 0.16], fill=(156, 56, 34))
    d.rectangle([0, h * 0.84, w, h], fill=(156, 56, 34))
    d.rectangle([0, h * 0.18, w, h * 0.32], fill=(236, 210, 160))
    rng = random.Random(seed)
    for k in range(14):
        x = 12 + k * (w - 24) / 14
        d.rounded_rectangle([x, h * 0.19, x + (w - 24) / 14 - 8, h * 0.31], radius=8, outline=(60, 34, 24), width=3)
        d.ellipse([x + 12, h * 0.22, x + 22, h * 0.27], fill=(60, 34, 24))
        d.line([(x + 28, h * 0.29), (x + (w - 24) / 14 - 14, h * 0.21)], fill=(60, 34, 24), width=3)
    for k in range(4):
        x = w * (0.1 + k * 0.25)
        # cacao pod
        d.ellipse([x - 22, h * 0.45, x + 22, h * 0.78], fill=(176, 104, 40), outline=(60, 34, 24), width=3)
        for j in range(3):
            d.line([(x - 12 + j * 12, h * 0.48), (x - 12 + j * 12, h * 0.75)], fill=(120, 64, 28), width=2)
        # leaf and scroll
        leaf_shape(d, x + 40, h * 0.74, 60, 14, -0.7, (60, 104, 52, 255), vein=False)
        d.arc([x + 60, h * 0.4, x + 110, h * 0.7], 180, 20, fill=(60, 34, 24), width=4)
    save(img.filter(ImageFilter.SMOOTH), "maya_vessel.jpg")


def codex_pages(w=1024, h=256, seed=441):
    """Screenfold book pages: white lime-plaster coating, red guide lines, coloured glyph blocks,
    bar-and-dot numbers (a real Maya way of writing numbers: a dot is 1, a bar is 5)."""
    img = Image.new("RGB", (w, h), (238, 230, 208))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    pages = 6
    pw = w / pages
    for p in range(pages):
        x0 = p * pw
        d.line([(x0, 0), (x0, h)], fill=(180, 160, 130), width=3)
        d.line([(x0 + 6, h * 0.5), (x0 + pw - 6, h * 0.5)], fill=(186, 60, 40), width=2)
        for r in range(2):
            for c in range(2):
                bx, by = x0 + 10 + c * (pw - 20) / 2, 10 + r * h / 2
                bw, bh = (pw - 20) / 2 - 6, h / 2 - 20
                col = rng.choice([(60, 120, 150), (186, 60, 40), (210, 160, 60), (60, 110, 70)])
                d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=12, fill=col, outline=(30, 24, 20), width=3)
                d.ellipse([bx + bw * 0.3, by + bh * 0.25, bx + bw * 0.5, by + bh * 0.45], fill=(30, 24, 20))
        # a bar-and-dot number under each page
        n_ = rng.randint(1, 13)
        bars, dots = n_ // 5, n_ % 5
        yb = h * 0.9
        for b in range(bars):
            d.rectangle([x0 + pw * 0.25, yb - b * 10 - 6, x0 + pw * 0.75, yb - b * 10], fill=(30, 24, 20))
        for k in range(dots):
            cx_ = x0 + pw * 0.5 + (k - (dots - 1) / 2) * 12
            d.ellipse([cx_ - 4, yb - bars * 10 - 14, cx_ + 4, yb - bars * 10 - 6], fill=(30, 24, 20))
    save(img.filter(ImageFilter.SMOOTH), "codex.jpg")


def fan_paper(w=512, h=256, seed=451):
    """Folding-fan leaf: gold-leaf ground with blue waves and a branch of blossom (original)."""
    v = fnoise(512, 1.5, seed)[:h, :w]
    rgb = ramp(v, [(0, (204, 164, 82)), (1, (238, 206, 120))])
    img = to_img(rgb)
    d = ImageDraw.Draw(img)
    for k in range(6):
        y = h * (0.55 + k * 0.08)
        for x in range(-40, w, 50):
            d.arc([x, y, x + 50, y + 30], 180, 360, fill=(40, 70, 130), width=4)
    d.line([(w * 0.1, h * 0.1), (w * 0.4, h * 0.3), (w * 0.6, h * 0.25)], fill=(80, 50, 36), width=6)
    for k in range(8):
        cx_, cy_ = w * (0.15 + k * 0.06), h * (0.15 + (k % 3) * 0.06)
        d.ellipse([cx_ - 8, cy_ - 8, cx_ + 8, cy_ + 8], fill=(240, 160, 186))
    save(img, "fan.jpg")


def koi_skin(w=512, h=256, seed=461):
    """Koi body wrap (u along the body): white with orange-red patches (kohaku), a few black dots."""
    v = fnoise(512, 2.2, seed)[:h, :w]
    m = (v > 0.48).astype(np.float32)
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)), dtype=np.float32) / 255
    white = np.array([0.96, 0.93, 0.88])
    orange = np.array([0.93, 0.36, 0.12])
    rgb = white * (1 - m[..., None]) + orange * m[..., None]
    sp = fnoise(512, 1.0, seed + 1)[:h, :w]
    rgb *= (1 - 0.8 * (sp > 0.86))[..., None]
    # scale shimmer rows
    yy, xx = np.mgrid[0:h, 0:w]
    rgb *= (0.92 + 0.08 * np.sin(xx * 0.6) * np.sin(yy * 0.6))[..., None]
    save(to_img(rgb), "koi.jpg")


def relief(w=1024, h=256, seed=471):
    """Pediment relief: a laurel wreath in the middle, flowing acanthus scrolls to both sides."""
    v = fnoise(512, 1.6, seed)
    base = ramp(v, [(0, (204, 188, 160)), (1, (232, 220, 196))])
    img = to_img(base).resize((w, h))
    hm = Image.new("L", (w, h), 80)
    for tgt, col, wd in ((img, (150, 130, 100), 6), (hm, 230, 10)):
        d = ImageDraw.Draw(tgt)
        cx, cy = w / 2, h * 0.55
        d.ellipse([cx - 70, cy - 70, cx + 70, cy + 70], outline=col, width=wd)
        for k in range(16):
            a = k / 16 * math.pi * 2
            px, py = cx + math.cos(a) * 70, cy + math.sin(a) * 70
            d.ellipse([px - 12, py - 6, px + 12, py + 6], fill=col)
        for side in (-1, 1):
            for k in range(5):
                sx = cx + side * (130 + k * 70)
                r = 34 - k * 3
                d.arc([sx - r, cy - r, sx + r, cy + r], 0 if side > 0 else 180, 270 if side > 0 else 90, fill=col, width=wd)
                d.ellipse([sx - 8, cy - 8, sx + 8, cy + 8], fill=col)
                d.line([(sx - side * r, cy), (sx - side * (r + 36), cy + 22)], fill=col, width=wd)
    img = img.filter(ImageFilter.SMOOTH)
    hmf = hm.filter(ImageFilter.GaussianBlur(3))
    shade = np.asarray(hmf, dtype=np.float32) / 255.0
    rgb = np.asarray(img, dtype=np.float32) / 255.0
    gy = np.roll(shade, 2, 0) - shade
    rgb = np.clip(rgb * (1 - gy[..., None] * 1.5), 0, 1)
    save(to_img(rgb), "relief.jpg")
    save(to_img(normal_from_height(shade, 5.0)), "relief_n.jpg")


def bronze(n=256, seed=481):
    v = fnoise(n, 1.6, seed)
    rgb = ramp(v, [(0, (110, 72, 36)), (0.5, (160, 112, 56)), (0.8, (190, 146, 80)), (1, (120, 150, 120))])
    save(to_img(rgb), "bronze.jpg")


def wax(n=256, seed=491):
    """Dark beeswax with a few scratched letters-like strokes (no real words)."""
    v = fnoise(n, 1.8, seed)
    rgb = ramp(v, [(0, (46, 36, 24)), (1, (78, 62, 40))])
    img = to_img(rgb)
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    for row in range(6):
        y = 30 + row * 36
        x = 20
        while x < n - 30:
            pts = [(x + rng.uniform(0, 10), y + rng.uniform(-8, 8)) for _ in range(3)]
            d.line(pts, fill=(176, 150, 100), width=2)
            x += rng.uniform(14, 24)
    save(img, "wax.jpg")


if __name__ == "__main__":
    # the Grove's own leaf / fern / bark textures, re-made here so the district's models are self-contained
    G.leaf_atlas()
    G.bark_tile()
    G.fern_frond()
    G.rock_tile()
    travertine()
    granite()
    limestone_blocks()
    glyph_panel()
    roof_tiles("roof_terracotta", 1024, [(0, (128, 54, 32)), (0.5, (170, 82, 48)), (1, (204, 112, 70))], 501)
    roof_tiles("roof_kawara", 1024, [(0, (60, 64, 70)), (0.5, (88, 92, 100)), (1, (122, 126, 132))], 511, rows=12, cols=9)
    edo_wood()
    lacquer()
    shoji()
    plaster()
    iron()
    lamp_glass()
    portal()
    blossom_atlas()
    broadleaf()
    palm_frond()
    vine_atlas()
    lily_atlas()
    cobbles()
    forum_paving()
    skyline()
    terracotta()
    landscape_print()
    glaze()
    jade()
    maya_vessel()
    codex_pages()
    fan_paper()
    koi_skin()
    relief()
    bronze()
    wax()
