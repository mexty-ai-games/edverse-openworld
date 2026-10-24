"""Painted textures for the Biome Frontier district (EdVerse OpenWorld), generated from scratch.

python3 textures.py <out_dir>
Reuses the Idea Grove's noise helpers (../textures.py: tileable Fourier noise, colour ramps, periodic
Voronoi, height->normal) and paints the district's own surfaces: jungle floor, beach sand, canyon dust,
layered red sandstone, mossy waterfall rock, giant leaves, palm fronds, canopy leaves, weathered pier
planks, thatch, bone, coral, water normals and the icon signboards. Nothing is sampled from a photo or
another game.
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else "build/tex"
sys.argv = sys.argv[:1] + [OUT]
sys.path.insert(0, os.path.dirname(HERE))
import textures as HT  # noqa: E402  (hub helpers)

HT.OUT = OUT
os.makedirs(OUT, exist_ok=True)
fnoise, ramp, to_img, normal_from_height, save, wrap_draw, voronoi, leaf_shape = (
    HT.fnoise, HT.ramp, HT.to_img, HT.normal_from_height, HT.save, HT.wrap_draw, HT.voronoi, HT.leaf_shape)


# ----------------------------------------------------------------------------- grounds
def jungle_floor(n=1024, seed=201):
    v = fnoise(n, 2.1, seed) * 0.6 + fnoise(n, 1.4, seed + 1) * 0.4
    rgb = ramp(v, [(0, (40, 30, 20)), (0.35, (62, 48, 30)), (0.6, (78, 70, 38)), (0.8, (70, 96, 40)), (1, (96, 126, 50))])
    img = to_img(rgb).convert("RGBA")
    rng = random.Random(seed)
    pal = [(100, 70, 40), (120, 90, 50), (86, 60, 34), (84, 110, 44), (62, 96, 36), (110, 140, 54), (72, 120, 48)]
    # leaf litter: little fallen leaves, some dry, some green
    for _ in range(1600):
        x, y = rng.random() * n, rng.random() * n
        L = rng.uniform(10, 26)
        col = rng.choice(pal) + (rng.randint(170, 240),)
        ang = rng.random() * math.pi * 2

        def lf(d, ox, oy, x=x, y=y, L=L, col=col, ang=ang):
            leaf_shape(d, x + ox, y + oy, L, L * 0.38, ang, col, vein=True)

        wrap_draw(img, lf)
    # moss carpets
    moss = np.clip((fnoise(n, 1.8, seed + 7) - 0.5) * 3.2, 0, 1)
    mrgb = ramp(fnoise(n, 1.2, seed + 8), [(0, (58, 92, 34)), (1, (104, 140, 52))])
    base = np.asarray(img.convert("RGB")).astype(np.float32) / 255
    base = base * (1 - moss[..., None] * 0.8) + mrgb * moss[..., None] * 0.8
    save(to_img(base).filter(ImageFilter.SMOOTH), "jungle_floor.jpg")


def beach_sand(n=1024, seed=211):
    yy, xx = np.mgrid[0:n, 0:n] / n
    warp = fnoise(n, 2.4, seed) * 0.6
    ripple = np.sin((yy * 22 + warp * 3 + xx * 2) * math.pi * 2) * 0.5 + 0.5
    v = fnoise(n, 1.8, seed + 1) * 0.6 + ripple * 0.25 + fnoise(n, 0.6, seed + 2) * 0.15
    rgb = ramp(v, [(0, (196, 162, 112)), (0.45, (226, 196, 146)), (0.75, (240, 216, 170)), (1, (250, 232, 192))])
    img = to_img(rgb).convert("RGBA")
    rng = random.Random(seed)
    for _ in range(900):
        x, y = rng.random() * n, rng.random() * n
        r = rng.uniform(1.0, 3.2)
        c = rng.choice([(255, 246, 230), (214, 150, 120), (176, 150, 120), (248, 210, 190)])

        def sh(d, ox, oy, x=x, y=y, r=r, c=c):
            d.ellipse([x + ox - r, y + oy - r * 0.7, x + ox + r, y + oy + r * 0.7], fill=c + (210,))

        wrap_draw(img, sh)
    save(img.filter(ImageFilter.SMOOTH).convert("RGB"), "sand.jpg")


def canyon_floor(n=1024, seed=221):
    v = fnoise(n, 2.0, seed) * 0.65 + fnoise(n, 1.1, seed + 1) * 0.35
    rgb = ramp(v, [(0, (126, 62, 36)), (0.4, (168, 90, 52)), (0.7, (196, 118, 70)), (1, (222, 154, 100))])
    img = to_img(rgb).convert("RGBA")
    rng = random.Random(seed)
    for _ in range(900):
        x, y = rng.random() * n, rng.random() * n
        r = rng.uniform(2, 7)
        g = rng.uniform(0.75, 1.15)
        c = (int(186 * g), int(104 * g), int(64 * g))

        def peb(d, ox, oy, x=x, y=y, r=r, c=c):
            d.ellipse([x + ox - r, y + oy - r * 0.7 + 1.5, x + ox + r, y + oy + r * 0.7 + 1.5], fill=(70, 30, 16, 110))
            d.ellipse([x + ox - r, y + oy - r * 0.7, x + ox + r, y + oy + r * 0.7], fill=c + (255,))
            d.ellipse([x + ox - r * 0.5, y + oy - r * 0.55, x + ox + r * 0.1, y + oy - r * 0.1], fill=(255, 220, 180, 70))

        wrap_draw(img, peb)
    save(img.filter(ImageFilter.SMOOTH).convert("RGB"), "canyon_floor.jpg")


# ----------------------------------------------------------------------------- layered sandstone
def sandstone(n=1024, seed=231):
    """Horizontal strata (v runs up the cliff), each band its own tone, wavy edges, cracks and ledges."""
    yy, xx = np.mgrid[0:n, 0:n] / n
    warp = fnoise(n, 2.2, seed, aniso=(3.0, 0.6)) * 0.05
    bands = 9
    b = (yy + warp) * bands
    bid = np.floor(b).astype(int) % bands
    frac = b - np.floor(b)
    rng = np.random.default_rng(seed)
    tones = rng.uniform(0, 1, bands)
    tone = tones[bid]
    grain = fnoise(n, 1.4, seed + 1, aniso=(0.7, 1.6))
    blot = fnoise(n, 2.2, seed + 4)
    v = tone * 0.5 + grain * 0.2 + blot * 0.3
    rgb = ramp(v, [(0, (130, 52, 32)), (0.3, (166, 72, 42)), (0.55, (196, 100, 58)), (0.8, (214, 134, 84)), (1, (232, 170, 116))])
    lip = np.clip((frac - 0.9) * 10, 0, 1)  # light ledge at each band's top
    groove = np.clip((0.08 - frac) * 12, 0, 1)  # shadowed seam under it
    rgb = rgb * (1 - groove[..., None] * 0.45) + lip[..., None] * 0.07
    cracks = np.clip(1 - np.abs(fnoise(n, 1.7, seed + 3, aniso=(4.0, 0.5)) - 0.5) * 26, 0, 1)
    rgb *= (1 - cracks * 0.12)[..., None]
    # vertical joints that stop at band seams
    joints = np.zeros((n, n), np.float32)
    jr = random.Random(seed)
    for _ in range(26):
        x = jr.randrange(n)
        b0 = jr.randrange(bands)
        y0, y1 = int(b0 / bands * n), int((b0 + jr.randint(1, 2)) / bands * n)
        for dx in range(-2, 3):
            joints[y0:y1, (x + dx + int(jr.uniform(-3, 3))) % n] = max(0.0, 1 - abs(dx) / 2.5)
    joints = np.asarray(Image.fromarray((joints * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
    rgb *= (1 - joints * 0.5)[..., None]
    save(to_img(rgb), "sandstone.jpg")
    h = frac * 0.5 + blot * 0.3 - cracks * 0.3 - joints * 0.4
    save(to_img(normal_from_height(h, 4.0)), "sandstone_n.jpg")


def moss_rock(n=1024, seed=241):
    v = fnoise(n, 2.0, seed) * 0.6 + fnoise(n, 1.1, seed + 1) * 0.4
    rgb = ramp(v, [(0, (60, 64, 60)), (0.45, (98, 100, 92)), (0.75, (126, 126, 114)), (1, (156, 152, 136))])
    cracks = np.clip(np.abs(fnoise(n, 1.9, seed + 3) - 0.5) * 14, 0, 1)
    rgb *= (0.75 + 0.25 * cracks)[..., None]
    moss = np.clip((fnoise(n, 1.7, seed + 4) - 0.42) * 3, 0, 1)
    mrgb = ramp(fnoise(n, 1.0, seed + 5), [(0, (52, 92, 36)), (1, (110, 150, 56))])
    rgb = rgb * (1 - moss[..., None]) + mrgb * moss[..., None]
    save(to_img(rgb), "mossrock.jpg")
    save(to_img(normal_from_height(v * 0.7 + cracks * 0.3 + moss * 0.1, 4.0)), "mossrock_n.jpg")


# ----------------------------------------------------------------------------- giant leaves (alpha)
def giant_leaf(d, x0, y0, w, h, col, rng, split=True, monstera=False):
    """A huge banana / elephant-ear leaf pointing up in a w*h box: midrib, side veins, torn splits."""
    cx = x0 + w / 2
    pts_l, pts_r = [], []
    for i in range(41):
        t = i / 40
        y = y0 + h * (1 - t)
        half = math.sin(min(1.0, t * 1.02) * math.pi) ** 0.45 * w * 0.49
        pts_l.append((cx - half, y))
        pts_r.append((cx + half, y))
    poly = pts_l + list(reversed(pts_r))
    d.polygon(poly, fill=col)
    lit = tuple(min(255, int(c * 1.16)) for c in col[:3]) + (255,)
    d.polygon(pts_r + [(cx, y0), (cx, y0 + h)], fill=lit)
    dark = tuple(int(c * 0.72) for c in col[:3]) + (255,)
    # side veins
    for i in range(3, 38, 2):
        t = i / 40
        y = y0 + h * (1 - t)
        half = math.sin(t * math.pi) ** 0.45 * w * 0.49
        for s in (-1, 1):
            d.line([(cx, y), (cx + s * half * 0.98, y - h * 0.04)], fill=dark[:3] + (120,), width=2)
    # splits (transparent wedges from the edge, as on wind-torn banana leaves)
    if split:
        for _ in range(rng.randint(6, 9)):
            t = rng.uniform(0.2, 0.85)
            y = y0 + h * (1 - t)
            half = math.sin(t * math.pi) ** 0.45 * w * 0.49
            s = rng.choice((-1, 1))
            depth = rng.uniform(0.35, 0.8)
            d.polygon([(cx + s * half * 1.05, y + 6), (cx + s * half * 1.05, y - 10), (cx + s * half * (1 - depth), y - h * 0.03)], fill=(0, 0, 0, 0))
    if monstera:
        for k in range(8):
            t = 0.2 + k * 0.08
            y = y0 + h * (1 - t)
            half = math.sin(t * math.pi) ** 0.45 * w * 0.49
            for s in (-1, 1):
                hx = cx + s * half * 0.55
                d.ellipse([hx - w * 0.035, y - h * 0.018, hx + w * 0.035, y + h * 0.018], fill=(0, 0, 0, 0))
    d.line([(cx, y0 + h), (cx, y0 + h * 0.02)], fill=(196, 214, 120, 255), width=max(3, int(w * 0.022)))


def bigleaf_atlas(w=1024, h=1024, seed=251):
    """Two leaves side by side: left = banana leaf (split edges), right = glossy elephant-ear."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    giant_leaf(d, 8, 8, w / 2 - 16, h - 16, (58, 132, 52, 255), rng, split=True)
    giant_leaf(d, w / 2 + 8, 8, w / 2 - 16, h - 16, (44, 112, 48, 255), rng, split=False, monstera=True)
    # soft painted highlight noise
    hn = fnoise(w, 1.6, seed + 1)
    a = np.asarray(img).astype(np.float32)
    a[..., :3] *= (0.88 + 0.24 * hn)[..., None]
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    save(img.filter(ImageFilter.SMOOTH), "bigleaf.png")


def palm_frond(w=512, h=1024, seed=261):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    cx = w / 2
    N = 34
    for i in range(N):
        t = 0.04 + i / N * 0.94
        y = h * 0.99 - t * h * 0.97
        L = (math.sin(t * math.pi) ** 0.6) * w * 0.48 + 8
        for s in (-1, 1):
            g = rng.uniform(0.88, 1.12) * (0.85 + 0.3 * t)
            col = (int(70 * g), int(140 * g), int(52 * g), 255)
            ang = math.pi / 2 + s * (1.15 + rng.uniform(-0.1, 0.1))  # pointing out and down-ish
            ca, sa = math.cos(ang - math.pi), math.sin(ang - math.pi)
            ang2 = math.atan2(0.3, s * 1.0)
            leaf_shape(d, cx, y, L * 1.04, L * 0.13, ang2, col, vein=True)
    d.line([(cx, h), (cx, h * 0.02)], fill=(150, 160, 80, 255), width=7)
    save(img.filter(ImageFilter.SMOOTH), "palm_frond.png")


def canopy_leaves(n=1024, seed=271):
    """Canopy clusters of big glossy rainforest leaves (4 quadrants), brighter and more saturated than the grove."""
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    q = n // 2
    pals = [
        [(30, 96, 44), (44, 124, 52), (62, 150, 60), (96, 178, 70)],
        [(26, 86, 40), (40, 112, 48), (58, 138, 56), (110, 180, 72)],
        [(36, 104, 46), (52, 132, 54), (76, 160, 62), (128, 190, 80)],
        [(24, 80, 38), (36, 104, 46), (54, 130, 52), (88, 164, 66)],
    ]
    for qi in range(4):
        ox, oy = (qi % 2) * q, (qi // 2) * q
        cx, cy = ox + q / 2, oy + q / 2
        leaves = []
        for _ in range(70):
            r = q * 0.42 * math.sqrt(rng.random())
            a = rng.random() * math.pi * 2
            leaves.append((cy + math.sin(a) * r * 0.85, cx + math.cos(a) * r))
        leaves.sort()
        for i, (y, x) in enumerate(leaves):
            base = pals[qi][min(3, int(i / len(leaves) * 4))]
            col = tuple(min(255, int(c * rng.uniform(0.9, 1.1))) for c in base) + (255,)
            L = rng.uniform(70, 120)
            leaf_shape(d, x, y, L, L * rng.uniform(0.32, 0.42), rng.uniform(0, math.pi * 2), col)
    save(img.filter(ImageFilter.SMOOTH), "canopy.png")


# ----------------------------------------------------------------------------- wood, thatch, bone, coral
def planks(n=1024, seed=281):
    yy, xx = np.mgrid[0:n, 0:n] / n
    k = 5
    pid = np.floor(yy * k).astype(int)
    rng = np.random.default_rng(seed)
    shift = rng.random(k)[pid]
    warp = fnoise(n, 2.2, seed, aniso=(0.5, 4.0)) * 0.08
    grain = np.sin((yy * k * 11 + warp * 60 + shift * 7) * math.pi * 2) * 0.5 + 0.5
    knots = fnoise(n, 2.4, seed + 3, aniso=(0.4, 3.0))
    tone = rng.uniform(0, 1, k)[pid]
    v = grain * 0.3 + knots * 0.35 + tone * 0.35
    rgb = ramp(v, [(0, (92, 66, 44)), (0.4, (128, 96, 64)), (0.7, (158, 124, 86)), (1, (184, 156, 118))])
    seam = np.clip((1 - np.abs(((yy * k) % 1.0) - 0.5) * 2) * 16, 0, 1)
    rgb *= (0.3 + 0.7 * seam)[..., None]
    # sun-bleached grey streaks
    bleach = np.clip((fnoise(n, 1.6, seed + 5, aniso=(0.3, 3.0)) - 0.5) * 2.5, 0, 1)
    rgb = rgb * (1 - bleach[..., None] * 0.35) + np.array([0.62, 0.6, 0.56]) * bleach[..., None] * 0.35
    save(to_img(rgb), "planks.jpg")
    save(to_img(normal_from_height(grain * 0.3 + seam * 0.7, 3.0)), "planks_n.jpg")


def thatch(n=1024, seed=291):
    img = Image.new("RGB", (n, n), (120, 92, 50))
    rng = random.Random(seed)
    rows = 8
    for r in range(rows + 1):
        y0 = r * n / rows
        for _ in range(900):
            x = rng.random() * n
            L = rng.uniform(n / rows * 1.0, n / rows * 1.5)
            g = rng.uniform(0.7, 1.25)
            c = (int(176 * g), int(140 * g), int(80 * g), 255)

            def st(d, ox, oy, x=x, y0=y0, L=L, c=c):
                d.line([(x + ox, y0 + oy - L * 0.2), (x + ox + rng.uniform(-6, 6), y0 + oy + L)], fill=c, width=2)

            wrap_draw(img, st)
        ImageDraw.Draw(img).line([(0, y0 + n / rows * 0.95), (n, y0 + n / rows * 0.95)], fill=(70, 50, 26), width=4)
    save(img.filter(ImageFilter.SMOOTH), "thatch.jpg")


def bone(n=512, seed=301):
    v = fnoise(n, 1.8, seed) * 0.7 + fnoise(n, 0.8, seed + 1) * 0.3
    rgb = ramp(v, [(0, (196, 172, 128)), (0.5, (226, 206, 164)), (1, (246, 234, 200))])
    pores = (fnoise(n, 0.4, seed + 2) > 0.72)
    rgb *= (1 - pores * 0.12)[..., None]
    save(to_img(rgb), "bone.jpg")


def coral(n=512, seed=311):
    """Greyscale porous coral surface (tinted per cluster by vertex colour)."""
    f1, f2, cid, k = voronoi(n, 400, seed, 0.9)
    pores = np.clip(f1 / 7.0, 0, 1)
    v = 0.55 + 0.35 * pores + 0.1 * fnoise(n, 1.8, seed + 1)
    save(to_img(np.stack([v, v, v], -1)), "coral.jpg")
    save(to_img(normal_from_height(pores, 3.0)), "coral_n.jpg")


def water_normal(n=512, seed=321):
    h = fnoise(n, 2.6, seed) * 0.6 + fnoise(n, 2.0, seed + 1, aniso=(1.0, 1.6)) * 0.4
    save(to_img(normal_from_height(h, 9.0)), "water_n.jpg", 90)


# ----------------------------------------------------------------------------- creature skins (small)
def frog_skin(n=256, seed=331):
    v = fnoise(n, 2.0, seed)
    rgb = ramp(v, [(0, (40, 150, 70)), (1, (90, 200, 90))])
    img = to_img(rgb)
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    for _ in range(26):
        x, y, r = rng.random() * n, rng.random() * n, rng.uniform(4, 10)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(250, 210, 70))
    save(img.filter(ImageFilter.SMOOTH), "frog.jpg")


def shell_tile(n=512, seed=341):
    """Tortoise / turtle shell: hexagonal scutes with growth rings."""
    f1, f2, cid, k = voronoi(n, 36, seed, 0.5)
    edge = f2 - f1
    rings = np.sin(f1 / 5.0) * 0.5 + 0.5
    tone = np.random.default_rng(seed).uniform(0, 1, k)[cid]
    v = tone * 0.4 + rings * 0.35 + fnoise(n, 1.8, seed + 1) * 0.25
    rgb = ramp(v, [(0, (88, 64, 34)), (0.5, (140, 106, 56)), (1, (196, 158, 92))])
    rgb *= (0.35 + 0.65 * np.clip(edge / 6.0, 0, 1))[..., None]
    save(to_img(rgb), "shell.jpg")


def scales(n=256, seed=351):
    yy, xx = np.mgrid[0:n, 0:n] / n
    s = (np.sin(xx * math.pi * 32) * np.sin(yy * math.pi * 32 + xx * 3)) * 0.5 + 0.5
    v = s * 0.4 + fnoise(n, 1.6, seed) * 0.6
    save(to_img(np.stack([v, v, v], -1) * 0.35 + 0.65), "scales.jpg")


# ----------------------------------------------------------------------------- signs (icons, no words)
def sign_atlas(n=1024, seed=361):
    """4 painted wooden boards in a 2x2 atlas: rainforest (leaf + drop), canyon (ammonite), coast (fish + wave),
    home grove (lantern). Icons only, so 4-6 year-olds can read them."""
    img = Image.new("RGB", (n, n))
    q = n // 2
    rng = random.Random(seed)
    for qi in range(4):
        ox, oy = (qi % 2) * q, (qi // 2) * q
        yy, xx = np.mgrid[0:q, 0:q] / q
        v = fnoise(q, 2.0, seed + qi) * 0.5 + (np.sin((yy * 7 + fnoise(q, 2.2, seed + 9 + qi) * 0.5) * math.pi * 2) * 0.5 + 0.5) * 0.5
        rgb = ramp(v, [(0, (110, 70, 40)), (1, (170, 118, 70))])
        border = np.minimum(np.minimum(xx, 1 - xx), np.minimum(yy, 1 - yy)) * 2
        rgb *= (0.5 + 0.5 * np.clip(border * 16, 0, 1))[..., None]
        img.paste(to_img(rgb), (ox, oy))
    d = ImageDraw.Draw(img, "RGBA")
    s = q * 0.3

    def disc(cx, cy, col):
        d.ellipse([cx - s * 1.3, cy - s * 1.3, cx + s * 1.3, cy + s * 1.3], fill=col)

    # 0 rainforest
    cx, cy = q * 0.5, q * 0.5
    disc(cx, cy, (226, 238, 206, 255))
    leaf_shape(d, cx - s * 0.75, cy + s * 0.75, s * 1.9, s * 0.62, -0.8, (46, 140, 60, 255))
    d.polygon([(cx + s * 0.55, cy - s * 0.95), (cx + s * 0.85, cy - s * 0.35), (cx + s * 0.25, cy - s * 0.35)], fill=(70, 150, 230, 255))
    d.ellipse([cx + s * 0.25, cy - s * 0.65, cx + s * 0.85, cy - s * 0.05], fill=(70, 150, 230, 255))
    # 1 canyon: ammonite spiral on sandstone disc
    cx, cy = q * 1.5, q * 0.5
    disc(cx, cy, (232, 170, 120, 255))
    pts = []
    for i in range(160):
        t = i / 160 * math.pi * 6
        r = s * 0.08 * math.exp(t * 0.12)
        pts.append((cx + math.cos(t) * r, cy + math.sin(t) * r))
    d.line(pts, fill=(110, 60, 36, 255), width=12, joint="curve")
    for i in range(0, 160, 8):
        t = i / 160 * math.pi * 6
        r = s * 0.08 * math.exp(t * 0.12)
        d.line([(cx + math.cos(t) * r * 0.8, cy + math.sin(t) * r * 0.8), (cx + math.cos(t) * r * 1.2, cy + math.sin(t) * r * 1.2)], fill=(250, 230, 200, 200), width=3)
    # 2 coast: fish over waves
    cx, cy = q * 0.5, q * 1.5
    disc(cx, cy, (190, 232, 236, 255))
    d.ellipse([cx - s * 0.75, cy - s * 0.42, cx + s * 0.45, cy + s * 0.36], fill=(250, 140, 50, 255))
    d.polygon([(cx + s * 0.35, cy), (cx + s * 0.95, cy - s * 0.42), (cx + s * 0.95, cy + s * 0.42)], fill=(250, 140, 50, 255))
    d.rectangle([cx - s * 0.25, cy - s * 0.42, cx - s * 0.08, cy + s * 0.36], fill=(255, 255, 255, 255))
    d.ellipse([cx - s * 0.6, cy - s * 0.15, cx - s * 0.44, cy + s * 0.01], fill=(30, 30, 40, 255))
    for k in range(2):
        yb = cy + s * (0.7 + k * 0.28)
        d.arc([cx - s * 1.0, yb - s * 0.2, cx, yb + s * 0.2], 200, 340, fill=(40, 130, 200, 255), width=8)
        d.arc([cx, yb - s * 0.2, cx + s * 1.0, yb + s * 0.2], 200, 340, fill=(40, 130, 200, 255), width=8)
    # 3 home: lantern of the Idea Grove
    cx, cy = q * 1.5, q * 1.5
    disc(cx, cy, (60, 50, 90, 255))
    d.polygon([(cx - s * 0.4, cy - s * 0.5), (cx + s * 0.4, cy - s * 0.5), (cx + s * 0.5, cy + s * 0.6), (cx - s * 0.5, cy + s * 0.6)], fill=(255, 196, 90, 255))
    d.rectangle([cx - s * 0.55, cy - s * 0.7, cx + s * 0.55, cy - s * 0.5], fill=(150, 100, 50, 255))
    d.rectangle([cx - s * 0.6, cy + s * 0.6, cx + s * 0.6, cy + s * 0.78], fill=(150, 100, 50, 255))
    d.line([(cx, cy - s * 0.7), (cx, cy - s * 1.05)], fill=(150, 100, 50, 255), width=8)
    save(img.filter(ImageFilter.SMOOTH), "signs.jpg")


def survey_board(n=512, seed=371):
    """The field station's board: a painted map with the three biomes and pins (no words)."""
    v = fnoise(n, 1.8, seed)
    rgb = ramp(v, [(0, (222, 206, 166)), (1, (246, 236, 206))])
    img = to_img(rgb)
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse([40, 60, 250, 300], fill=(70, 150, 70, 200))
    d.polygon([(260, 40), (470, 60), (440, 250), (300, 230)], fill=(210, 110, 70, 210))
    d.polygon([(300, 300), (500, 270), (500, 500), (260, 500)], fill=(60, 170, 200, 210))
    d.line([(150, 200), (300, 260), (380, 160)], fill=(120, 80, 40, 255), width=5)
    d.line([(300, 260), (380, 380)], fill=(120, 80, 40, 255), width=5)
    for (x, y, c) in ((150, 180, (240, 80, 70)), (360, 140, (250, 200, 60)), (400, 390, (90, 120, 240))):
        d.ellipse([x - 14, y - 14, x + 14, y + 14], fill=c + (255,))
    d.rectangle([4, 4, n - 4, n - 4], outline=(110, 70, 40, 255), width=10)
    save(img, "survey_board.jpg")


if __name__ == "__main__":
    jungle_floor()
    beach_sand()
    canyon_floor()
    sandstone()
    moss_rock()
    bigleaf_atlas()
    palm_frond()
    canopy_leaves()
    planks()
    thatch()
    bone()
    coral()
    water_normal()
    frog_skin()
    shell_tile()
    scales()
    sign_atlas()
    survey_board()
    # the hub's bark texture is reused inside models (same generator, OpenWorld's own)
    HT.bark_tile()
    HT.rock_tile()
