"""Painted textures for EdVerse OpenWorld (Idea Grove), generated from scratch.

Run with system Python (numpy + Pillow):  python3 textures.py <out_dir>
Every texture here is original: tileable noise is made in Fourier space (so it wraps
seamlessly), flagstones come from a periodic Voronoi, and grass / leaves / ferns /
flowers are painted stroke by stroke. Nothing is sampled from another game or photo.
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "build/tex"
os.makedirs(OUT, exist_ok=True)


# ----------------------------------------------------------------------------- noise
def fnoise(n, beta=2.0, seed=0, aniso=(1.0, 1.0), lo=1.0):
    """Tileable fractal noise in [0,1]: white noise shaped by 1/f^beta in Fourier space."""
    rng = np.random.default_rng(seed)
    w = rng.standard_normal((n, n))
    fx = np.fft.fftfreq(n)[None, :] * n * aniso[0]
    fy = np.fft.fftfreq(n)[:, None] * n * aniso[1]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    amp = 1.0 / np.maximum(f, lo) ** beta
    amp[0, 0] = 0
    out = np.real(np.fft.ifft2(np.fft.fft2(w) * amp))
    out -= out.min()
    out /= out.max() + 1e-9
    return out


def ramp(v, stops):
    """Map v in [0,1] through colour stops [(pos, (r,g,b)), ...] -> float rgb array."""
    v = np.clip(v, 0, 1)
    pos = np.array([s[0] for s in stops])
    cols = np.array([s[1] for s in stops], dtype=np.float64) / 255.0
    out = np.zeros(v.shape + (3,))
    for c in range(3):
        out[..., c] = np.interp(v, pos, cols[:, c])
    return out


def voronoi(n, count, seed=0, jitter=1.0):
    """Periodic Voronoi: returns (F1, F2, cell id) in pixels for a tile of size n."""
    rng = np.random.default_rng(seed)
    g = int(math.sqrt(count))
    pts = []
    for i in range(g):
        for j in range(g):
            pts.append(((i + 0.5 + (rng.random() - 0.5) * jitter) * n / g, (j + 0.5 + (rng.random() - 0.5) * jitter) * n / g))
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    f1 = np.full((n, n), 1e9, np.float32)
    f2 = np.full((n, n), 1e9, np.float32)
    cid = np.zeros((n, n), np.int32)
    for k, (px, py) in enumerate(pts):
        dx = np.abs(xx - px)
        dx = np.minimum(dx, n - dx)
        dy = np.abs(yy - py)
        dy = np.minimum(dy, n - dy)
        d = np.sqrt(dx * dx + dy * dy)
        closer = d < f1
        f2 = np.where(closer, f1, np.minimum(f2, d))
        cid = np.where(closer, k, cid)
        f1 = np.where(closer, d, f1)
    return f1, f2, cid, len(pts)


def to_img(rgb):
    return Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))


def normal_from_height(h, strength=4.0):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    nz = np.ones_like(h)
    l = np.sqrt(gx * gx + gy * gy + nz * nz)
    nrm = np.stack([-gx / l, gy / l, nz / l], -1)
    return nrm * 0.5 + 0.5


def wrap_draw(img, fn):
    """Draw something with wrap-around on a tile so the result stays seamless."""
    d = ImageDraw.Draw(img, "RGBA")
    n = img.size[0]
    for ox in (-n, 0, n):
        for oy in (-n, 0, n):
            fn(d, ox, oy)


def save(img, name, quality=88):
    p = os.path.join(OUT, name)
    if name.endswith(".jpg"):
        img.convert("RGB").save(p, quality=quality, optimize=True)
    else:
        img.save(p, optimize=True)
    print("wrote", p, os.path.getsize(p))


# ----------------------------------------------------------------------------- ground: grass
def grass_tile(n=1024, seed=11):
    big = fnoise(n, 2.2, seed)
    mid = fnoise(n, 1.6, seed + 1)
    v = big * 0.65 + mid * 0.35
    rgb = ramp(v, [(0, (46, 82, 30)), (0.35, (70, 110, 40)), (0.6, (104, 140, 52)), (0.8, (138, 160, 64)), (1, (168, 170, 80))])
    img = to_img(rgb).convert("RGBA")
    rng = random.Random(seed)
    pal = [(58, 98, 34), (86, 128, 44), (120, 156, 58), (150, 176, 70), (44, 76, 30), (176, 186, 92)]
    for _ in range(26000):
        x, y = rng.random() * n, rng.random() * n
        L = rng.uniform(6, 16)
        a = -math.pi / 2 + rng.uniform(-0.6, 0.6)
        c = rng.choice(pal)
        alpha = rng.randint(90, 200)
        w = rng.choice((1, 1, 2))

        def blade(d, ox, oy, x=x, y=y, L=L, a=a, c=c, alpha=alpha, w=w):
            d.line([(x + ox, y + oy), (x + ox + math.cos(a) * L, y + oy + math.sin(a) * L)], fill=c + (alpha,), width=w)

        if x < 20 or y < 20 or x > n - 20 or y > n - 20:
            wrap_draw(img, blade)
        else:
            blade(ImageDraw.Draw(img, "RGBA"), 0, 0)
    # a few tiny clover / daisy specks
    for _ in range(260):
        x, y = rng.random() * n, rng.random() * n
        c = rng.choice([(236, 232, 210), (250, 214, 90), (170, 196, 255)])
        r = rng.uniform(1.2, 2.4)
        ImageDraw.Draw(img, "RGBA").ellipse([x - r, y - r, x + r, y + r], fill=c + (200,))
    img = img.filter(ImageFilter.SMOOTH)
    save(img.convert("RGB"), "ground_grass.jpg")


# ----------------------------------------------------------------------------- ground: dirt path
def dirt_tile(n=1024, seed=21):
    v = fnoise(n, 2.0, seed) * 0.7 + fnoise(n, 1.2, seed + 3) * 0.3
    rgb = ramp(v, [(0, (82, 58, 38)), (0.4, (118, 86, 56)), (0.7, (146, 112, 74)), (1, (176, 140, 98))])
    img = to_img(rgb).convert("RGBA")
    rng = random.Random(seed)
    for _ in range(700):
        x, y = rng.random() * n, rng.random() * n
        r = rng.uniform(2, 6)
        g = rng.randint(84, 150)
        c = (g, int(g * 0.9), int(g * 0.78))

        def peb(d, ox, oy, x=x, y=y, r=r, c=c):
            d.ellipse([x + ox - r, y + oy - r * 0.75 + 1.5, x + ox + r, y + oy + r * 0.75 + 1.5], fill=(40, 28, 18, 120))
            d.ellipse([x + ox - r, y + oy - r * 0.75, x + ox + r, y + oy + r * 0.75], fill=c + (255,))
            d.ellipse([x + ox - r * 0.5, y + oy - r * 0.6, x + ox + r * 0.2, y + oy - r * 0.1], fill=(255, 245, 225, 70))

        wrap_draw(img, peb)
    save(img.filter(ImageFilter.SMOOTH).convert("RGB"), "ground_dirt.jpg")


# ----------------------------------------------------------------------------- ground: flagstones
def stone_tile(n=1024, seed=31):
    f1, f2, cid, k = voronoi(n, 49, seed, 0.8)
    edge = f2 - f1
    rng = np.random.default_rng(seed)
    tone = rng.uniform(0.0, 1.0, k)[cid]
    nz = fnoise(n, 1.8, seed + 5)
    v = np.clip(tone * 0.45 + nz * 0.55, 0, 1)
    rgb = ramp(v, [(0, (104, 100, 92)), (0.5, (146, 140, 126)), (0.8, (172, 164, 146)), (1, (196, 186, 162))])
    grout = np.clip(edge / 9.0, 0, 1)
    moss = ramp(fnoise(n, 1.5, seed + 9), [(0, (52, 70, 34)), (1, (92, 112, 48))])
    rgb = rgb * (0.55 + 0.45 * np.clip(edge / 22.0, 0, 1))[..., None]
    rgb = rgb * grout[..., None] + moss * (1 - grout[..., None])
    save(to_img(rgb).filter(ImageFilter.SMOOTH), "ground_stone.jpg")
    h = np.clip(edge / 14.0, 0, 1) * 0.8 + nz * 0.2
    save(to_img(normal_from_height(h, 3.0)), "ground_stone_n.jpg")


# ----------------------------------------------------------------------------- bark
def bark_tile(n=1024, seed=41):
    long = fnoise(n, 1.7, seed, aniso=(0.3, 6.0))
    fine = fnoise(n, 1.3, seed + 1, aniso=(0.8, 3.0))
    fiss = np.abs(fnoise(n, 1.5, seed + 2, aniso=(0.25, 8.0)) - 0.5) * 2
    fiss = np.clip(fiss * 3.0, 0, 1)
    v = long * 0.5 + fine * 0.3 + fiss * 0.2
    rgb = ramp(v, [(0, (52, 32, 20)), (0.35, (92, 58, 36)), (0.6, (128, 84, 52)), (0.85, (156, 108, 70)), (1, (178, 132, 92))])
    rgb *= (0.5 + 0.5 * fiss)[..., None]
    save(to_img(rgb), "bark.jpg")
    save(to_img(normal_from_height(v * 0.6 + fiss * 0.4, 5.0)), "bark_n.jpg")


# ----------------------------------------------------------------------------- wood planks (stalls)
def wood_tile(n=1024, seed=51):
    yy, xx = np.mgrid[0:n, 0:n] / n
    planks = 6
    pid = np.floor(yy * planks).astype(int)
    rng = np.random.default_rng(seed)
    shift = rng.random(planks)[pid]
    warp = fnoise(n, 2.2, seed, aniso=(0.5, 4.0)) * 0.08
    grain = np.sin((yy * planks * 9 + warp * 60 + shift * 7) * math.pi * 2) * 0.5 + 0.5
    knots = fnoise(n, 2.4, seed + 3, aniso=(0.4, 3.0))
    tone = rng.uniform(0.0, 1.0, planks)[pid]
    v = grain * 0.35 + knots * 0.35 + tone * 0.3
    rgb = ramp(v, [(0, (96, 50, 26)), (0.4, (140, 76, 38)), (0.7, (170, 98, 52)), (1, (198, 128, 72))])
    seam = np.abs(((yy * planks) % 1.0) - 0.5) * 2
    seam = np.clip((1 - seam) * 18, 0, 1)
    rgb *= (0.35 + 0.65 * seam)[..., None]
    # worn lighter edges near the seams
    edge = np.clip((1 - np.abs(((yy * planks) % 1.0) - 0.5) * 2 - 0.86) * 8, 0, 1)
    rgb += edge[..., None] * 0.08
    save(to_img(rgb), "wood.jpg")
    save(to_img(normal_from_height(grain * 0.3 + seam * 0.7, 3.0)), "wood_n.jpg")


# ----------------------------------------------------------------------------- rock
def rock_tile(n=1024, seed=61):
    v = fnoise(n, 2.0, seed) * 0.6 + fnoise(n, 1.0, seed + 1) * 0.4
    rgb = ramp(v, [(0, (96, 96, 92)), (0.45, (138, 134, 124)), (0.75, (170, 164, 150)), (1, (198, 192, 176))])
    sp = fnoise(n, 0.2, seed + 2)
    rgb *= (0.88 + 0.12 * (sp > 0.6))[..., None]
    cracks = np.clip(np.abs(fnoise(n, 1.9, seed + 3) - 0.5) * 14, 0, 1)
    rgb *= (0.82 + 0.18 * cracks)[..., None]
    save(to_img(rgb), "rock.jpg")
    save(to_img(normal_from_height(v * 0.7 + cracks * 0.3, 4.0)), "rock_n.jpg")


# ----------------------------------------------------------------------------- leaves atlas (alpha)
def leaf_shape(d, cx, cy, L, W, ang, col, vein=True):
    pts = []
    for i in range(17):
        t = i / 16
        w = math.sin(t * math.pi) ** 0.9 * W * (1 - 0.25 * t)
        pts.append((t * L, w))
    for i in range(16, -1, -1):
        t = i / 16
        w = math.sin(t * math.pi) ** 0.9 * W * (1 - 0.25 * t)
        pts.append((t * L, -w))
    ca, sa = math.cos(ang), math.sin(ang)
    poly = [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts]
    d.polygon(poly, fill=col)
    # lit half
    half = [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts[:17]] + [(cx + L * ca, cy + L * sa)]
    lc = tuple(min(255, int(c * 1.18)) for c in col[:3]) + (255,)
    d.polygon(half, fill=lc)
    if vein:
        d.line([(cx, cy), (cx + L * 0.92 * ca, cy + L * 0.92 * sa)], fill=tuple(int(c * 0.7) for c in col[:3]) + (200,), width=2)


def leaf_atlas(n=1024, seed=71):
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    q = n // 2
    palettes = [
        [(52, 98, 36), (68, 120, 42), (88, 140, 50), (110, 158, 56)],
        [(46, 88, 34), (62, 110, 40), (82, 132, 46), (126, 164, 62)],
        [(60, 104, 38), (82, 126, 44), (104, 146, 52), (140, 170, 70)],
        [(40, 80, 32), (56, 102, 38), (74, 124, 44), (98, 146, 52)],
    ]
    for qi in range(4):
        ox, oy = (qi % 2) * q, (qi // 2) * q
        cx, cy = ox + q / 2, oy + q / 2
        leaves = []
        for _ in range(230):
            r = q * 0.45 * math.sqrt(rng.random())
            a = rng.random() * math.pi * 2
            x, y = cx + math.cos(a) * r, cy + math.sin(a) * r * 0.85
            leaves.append((y, x))
        leaves.sort()
        for i, (y, x) in enumerate(leaves):
            depth = i / len(leaves)
            pal = palettes[qi]
            base = pal[min(3, int(depth * 4))]
            jit = rng.uniform(0.85, 1.1)
            col = tuple(min(255, int(c * jit)) for c in base) + (255,)
            L = rng.uniform(34, 58)
            leaf_shape(d, x, y, L, L * rng.uniform(0.3, 0.42), rng.uniform(0, math.pi * 2), col)
    img = img.filter(ImageFilter.SMOOTH)
    save(img, "leaves.png")


# ----------------------------------------------------------------------------- fern frond (alpha)
def fern_frond(w=512, h=1024, seed=81):
    """One arching frond: a rachis with paired, separated pinnae that shrink to the tip."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    cx = w / 2
    N = 30
    def spine(t):
        return cx + math.sin(t * 2.0) * 18, h * 0.985 - t * h * 0.95
    for i in range(N):
        t = 0.06 + i / N * 0.92
        x, y = spine(t)
        size = (1 - t) ** 0.7 * w * 0.40 + 10
        light = 0.8 + 0.5 * t
        for side in (-1, 1):
            ang = (-0.55 if side > 0 else math.pi + 0.55) + rng.uniform(-0.06, 0.06)
            ca, sa = math.cos(ang), math.sin(ang)
            col = tuple(min(255, int(c * light * rng.uniform(0.92, 1.06))) for c in (50, 104, 36)) + (255,)
            lobes = 6
            for k in range(lobes):
                s_ = (k + 0.5) / lobes
                lx, ly = x + ca * size * s_, y + sa * size * s_
                lr = size * 0.13 * (1 - s_ * 0.6) + 2.5
                for sub in (-1, 1):
                    leaf_shape(d, lx, ly, lr * 1.9, lr * 0.75, ang + sub * 1.15 - (0.35 if side > 0 else -0.35), col, vein=False)
            d.line([(x, y), (x + ca * size, y + sa * size)], fill=(46, 88, 30, 255), width=2)
    for i in range(80):
        t0, t1 = i / 80, (i + 1) / 80
        d.line([spine(t0), spine(t1)], fill=(70, 92, 36, 255), width=max(2, int(7 * (1 - t0))))
    save(img.filter(ImageFilter.SMOOTH), "fern.png")


# ----------------------------------------------------------------------------- wildflowers (alpha atlas)
def flower_atlas(n=1024, seed=91):
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    q = n // 2
    kinds = [
        ((120, 160, 245), (250, 236, 120), 5, 7),   # forget-me-not blue
        ((250, 206, 60), (200, 120, 30), 8, 9),     # buttercup / yellow
        ((214, 120, 196), (250, 230, 140), 6, 10),  # pink-purple
        ((246, 244, 236), (246, 196, 60), 12, 11),  # daisy
    ]
    for qi, (petal, heart, npet, size) in enumerate(kinds):
        ox, oy = (qi % 2) * q, (qi // 2) * q
        # stems and leaves
        heads = []
        for _ in range(16):
            bx = ox + q / 2 + rng.uniform(-q * 0.22, q * 0.22)
            by = oy + q * 0.98
            hx = bx + rng.uniform(-q * 0.18, q * 0.18)
            hy = oy + q * rng.uniform(0.12, 0.55)
            d.line([(bx, by), ((bx + hx) / 2 + rng.uniform(-8, 8), (by + hy) / 2), (hx, hy)], fill=(62, 110, 40, 255), width=3, joint="curve")
            for _ in range(2):
                t = rng.uniform(0.3, 0.8)
                lx, ly = bx + (hx - bx) * t, by + (hy - by) * t
                leaf_shape(d, lx, ly, rng.uniform(22, 38), 6, -math.pi / 2 + rng.choice((-1, 1)) * rng.uniform(0.5, 1.1), (70, 124, 44, 255), vein=False)
            heads.append((hx, hy))
        for hx, hy in heads:
            s = size * rng.uniform(0.8, 1.25) * 2.2
            rot = rng.random() * math.pi
            for p in range(npet):
                a = rot + p * math.pi * 2 / npet
                px, py = hx + math.cos(a) * s * 0.55, hy + math.sin(a) * s * 0.55
                shade = rng.uniform(0.88, 1.05)
                col = tuple(min(255, int(c * shade)) for c in petal) + (255,)
                d.ellipse([px - s * 0.42, py - s * 0.42, px + s * 0.42, py + s * 0.42], fill=col)
            d.ellipse([hx - s * 0.28, hy - s * 0.28, hx + s * 0.28, hy + s * 0.28], fill=heart + (255,))
    save(img.filter(ImageFilter.SMOOTH), "flowers.png")


# ----------------------------------------------------------------------------- grass blades card (alpha)
def grass_card(w=512, h=512, seed=101):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    for _ in range(90):
        bx = rng.uniform(w * 0.08, w * 0.92)
        top = rng.uniform(h * 0.05, h * 0.55)
        lean = rng.uniform(-60, 60)
        wid = rng.uniform(5, 11)
        g = rng.uniform(0.75, 1.2)
        col = (int(78 * g), int(128 * g), int(44 * g), 255)
        tip = (bx + lean, top)
        mid = (bx + lean * 0.35, (h + top) / 2)
        d.polygon([(bx - wid / 2, h), mid, tip, (mid[0] + wid * 0.3, mid[1]), (bx + wid / 2, h)], fill=col)
        d.line([(bx, h), mid, tip], fill=(min(255, int(120 * g)), min(255, int(170 * g)), int(70 * g), 160), width=1)
    save(img.filter(ImageFilter.SMOOTH), "grass_card.png")


# ----------------------------------------------------------------------------- plaza top (carved ring)
def glyph(d, cx, cy, s, rng, col, width):
    """An abstract carved rune: a little star-map of dots joined by lines, or a circle mark."""
    kind = rng.randint(0, 3)
    if kind == 0:
        pts = [(cx + rng.uniform(-s, s), cy + rng.uniform(-s, s)) for _ in range(rng.randint(3, 5))]
        d.line(pts, fill=col, width=width, joint="curve")
        for p in pts:
            d.ellipse([p[0] - width, p[1] - width, p[0] + width, p[1] + width], fill=col)
    elif kind == 1:
        d.ellipse([cx - s * 0.7, cy - s * 0.7, cx + s * 0.7, cy + s * 0.7], outline=col, width=width)
        d.line([(cx, cy - s), (cx, cy + s)], fill=col, width=width)
    elif kind == 2:
        d.arc([cx - s * 0.8, cy - s * 0.8, cx + s * 0.8, cy + s * 0.8], 40, 320, fill=col, width=width)
        d.ellipse([cx - width * 1.4, cy - width * 1.4, cx + width * 1.4, cy + width * 1.4], fill=col)
    else:
        d.line([(cx - s, cy + s * 0.6), (cx, cy - s), (cx + s, cy + s * 0.6)], fill=col, width=width, joint="curve")
        d.line([(cx - s * 0.5, cy), (cx + s * 0.5, cy)], fill=col, width=width)


def plaza_top(n=2048, seed=111):
    rng = random.Random(seed)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    c = n / 2
    dx, dy = (xx - c) / c, (yy - c) / c
    r = np.sqrt(dx * dx + dy * dy)
    th = (np.arctan2(dy, dx) + math.pi) / (2 * math.pi)
    rings = [0.0, 0.16, 0.30, 0.44, 0.58, 0.74, 0.88, 1.0]
    segs = [1, 10, 22, 30, 38, 46, 56]
    ring_id = np.zeros_like(r, dtype=np.int32)
    for i in range(1, len(rings) - 1):
        ring_id += (r > rings[i]).astype(np.int32)
    ring_id = np.clip(ring_id, 0, len(segs) - 1)
    nseg = np.array(segs)[ring_id]
    offs = np.array([rng.random() for _ in segs])[ring_id]
    u = (th * nseg + offs) % 1.0
    seg_id = np.floor(th * nseg + offs).astype(np.int32) % nseg
    # mortar between rings and segments
    rin = np.array(rings[:-1])[ring_id]
    rout = np.array(rings[1:])[ring_id]
    rad_edge = np.minimum(r - rin, rout - r) * c  # px from ring boundary
    seg_edge = np.minimum(u, 1 - u) * (2 * math.pi * r * c / np.maximum(nseg, 1))
    seg_edge = np.where(ring_id == 0, 1e3, seg_edge)
    edge = np.minimum(rad_edge, seg_edge)
    tones = np.random.default_rng(seed).random((len(segs), 64))
    tone = tones[ring_id, seg_id % 64]
    nz = fnoise(n, 1.9, seed + 1)
    v = np.clip(tone * 0.4 + nz * 0.6, 0, 1)
    rgb = ramp(v, [(0, (112, 106, 96)), (0.5, (150, 142, 126)), (0.8, (176, 166, 146)), (1, (200, 190, 166))])
    bevel = np.clip(edge / 10.0, 0, 1)
    rgb *= (0.45 + 0.55 * bevel)[..., None]
    rgb += (np.clip(1 - np.abs(edge - 8) / 4, 0, 1) * 0.05)[..., None]  # worn lighter lip
    mossy = np.clip((fnoise(n, 1.6, seed + 2) - 0.55) * 4, 0, 1) * (1 - bevel) + np.clip((r - 0.86) * 6, 0, 1) * 0.5 * (fnoise(n, 1.6, seed + 3) > 0.5)
    moss = ramp(fnoise(n, 1.4, seed + 4), [(0, (58, 82, 36)), (1, (98, 122, 50))])
    rgb = rgb * (1 - mossy[..., None]) + moss * mossy[..., None]
    base = to_img(rgb).convert("RGBA")
    # carvings: drawn as grooves (dark + light lip) and also into an emissive mask
    carve = Image.new("L", (n, n), 0)
    dc = ImageDraw.Draw(carve)
    # concentric carved circles
    for rr in (0.155, 0.30, 0.44):
        R = rr * c
        dc.ellipse([c - R, c - R, c + R, c + R], outline=255, width=7)
    # sun-star medallion in the centre
    for k in range(12):
        a = k * math.pi / 6
        L = 0.13 * c if k % 2 == 0 else 0.08 * c
        dc.line([(c, c), (c + math.cos(a) * L, c + math.sin(a) * L)], fill=255, width=8)
    dc.ellipse([c - 0.04 * c, c - 0.04 * c, c + 0.04 * c, c + 0.04 * c], outline=255, width=8)
    # rune ring between 0.30 and 0.44
    count = 22
    for k in range(count):
        a = (k + 0.5) * math.pi * 2 / count
        R = 0.37 * c
        glyph(dc, c + math.cos(a) * R, c + math.sin(a) * R, 0.035 * c, rng, 255, 7)
    # outer constellation dots in the 0.58-0.74 ring
    for k in range(40):
        a = rng.random() * math.pi * 2
        R = rng.uniform(0.6, 0.72) * c
        s = rng.uniform(4, 9)
        dc.ellipse([c + math.cos(a) * R - s, c + math.sin(a) * R - s, c + math.cos(a) * R + s, c + math.sin(a) * R + s], fill=255)
    cm = np.asarray(carve.filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
    lip = np.asarray(carve.filter(ImageFilter.GaussianBlur(3)).transform(carve.size, Image.AFFINE, (1, 0, 2, 0, 1, 2))).astype(np.float32) / 255
    rgbf = np.asarray(base.convert("RGB")).astype(np.float32) / 255
    rgbf = rgbf * (1 - cm[..., None] * 0.55) + np.clip(lip - cm, 0, 1)[..., None] * 0.12
    rgbf = rgbf * (1 - cm[..., None] * 0.35) + cm[..., None] * np.array([0.92, 0.82, 0.55]) * 0.35
    save(to_img(rgbf), "plaza.jpg", 86)
    emi = np.zeros((n, n, 3), np.float32)
    emi[...] = cm[..., None] * np.array([1.0, 0.82, 0.45])
    save(to_img(emi).resize((1024, 1024), Image.LANCZOS), "plaza_e.jpg", 85)
    h = np.clip(edge / 12, 0, 1) * 0.7 + nz * 0.3 - cm * 0.6
    save(to_img(normal_from_height(h, 3.0)).resize((1024, 1024), Image.LANCZOS), "plaza_n.jpg", 85)


# ----------------------------------------------------------------------------- lantern glass
def lantern_glass(n=256, seed=121):
    yy, xx = np.mgrid[0:n, 0:n] / n
    g = 1 - np.abs(xx - 0.5) * 1.2
    v = np.clip(0.55 + 0.45 * g - np.abs(yy - 0.55) * 0.6, 0, 1)
    rgb = ramp(v, [(0, (230, 140, 50)), (0.6, (255, 196, 92)), (1, (255, 240, 190))])
    img = to_img(rgb)
    d = ImageDraw.Draw(img)
    # a little leaf motif painted on the glass
    leaf_shape(d, n * 0.5, n * 0.78, n * 0.42, n * 0.12, -math.pi / 2, (200, 112, 40, 255), vein=True)
    save(img, "lantern_glass.jpg")


# ----------------------------------------------------------------------------- clay / metal / fabric helpers
def clay_tile(n=512, seed=131):
    v = fnoise(n, 2.0, seed) * 0.6 + fnoise(n, 1.0, seed + 1) * 0.4
    rgb = ramp(v, [(0, (150, 76, 44)), (0.5, (186, 102, 60)), (1, (214, 136, 86))])
    yy = np.mgrid[0:n, 0:n][0] / n
    rgb *= (0.92 + 0.08 * np.sin(yy * math.pi * 40))[..., None]
    save(to_img(rgb), "clay.jpg")


def brass_tile(n=256, seed=141):
    v = fnoise(n, 1.6, seed, aniso=(4, 0.5))
    rgb = ramp(v, [(0, (120, 82, 34)), (0.5, (176, 128, 56)), (1, (222, 180, 96))])
    save(to_img(rgb), "brass.jpg")


def cloth_tile(n=512, seed=151):
    yy, xx = np.mgrid[0:n, 0:n] / n
    weave = (np.sin(xx * math.pi * 160) * np.sin(yy * math.pi * 160)) * 0.5 + 0.5
    v = fnoise(n, 1.8, seed) * 0.7 + weave * 0.3
    rgb = ramp(v, [(0, (196, 182, 150)), (1, (236, 226, 196))])
    stripes = ((xx * 6) % 1.0) < 0.5
    rgb = np.where(stripes[..., None], rgb, rgb * np.array([1.0, 0.62, 0.42]))
    save(to_img(rgb), "cloth.jpg")


# ----------------------------------------------------------------------------- stall signs (icons, no words)
def sign(name, draw_icon, n=512, seed=161):
    yy, xx = np.mgrid[0:n // 2, 0:n] / n
    v = fnoise(n, 2.0, seed)[: n // 2] * 0.5 + (np.sin((yy * 9 + fnoise(n, 2.2, seed + 1)[: n // 2] * 0.6) * math.pi * 2) * 0.5 + 0.5) * 0.5
    rgb = ramp(v, [(0, (120, 70, 36)), (1, (176, 112, 62))])
    border = np.minimum(np.minimum(xx, 1 - xx) * 2, np.minimum(yy, 0.5 - yy) * 4)
    rgb *= (0.55 + 0.45 * np.clip(border * 14, 0, 1))[..., None]
    img = to_img(rgb).convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    draw_icon(d, n / 2, n / 4, n * 0.16)
    save(img.convert("RGB"), name)


def icon_leaf(d, cx, cy, s):
    d.ellipse([cx - s * 1.25, cy - s * 1.25, cx + s * 1.25, cy + s * 1.25], fill=(232, 222, 190, 255))
    leaf_shape(d, cx - s * 0.7, cy + s * 0.6, s * 1.6, s * 0.55, -0.75, (70, 140, 60, 255))
    d.ellipse([cx + s * 0.2, cy - s * 0.9, cx + s * 0.8, cy - s * 0.3], fill=(90, 160, 220, 255))


def icon_amphora(d, cx, cy, s):
    d.ellipse([cx - s * 1.25, cy - s * 1.25, cx + s * 1.25, cy + s * 1.25], fill=(232, 222, 190, 255))
    d.polygon([(cx - s * 0.25, cy - s), (cx + s * 0.25, cy - s), (cx + s * 0.2, cy - s * 0.6), (cx + s * 0.7, cy - s * 0.1),
               (cx + s * 0.5, cy + s * 0.7), (cx, cy + s * 1.0), (cx - s * 0.5, cy + s * 0.7), (cx - s * 0.7, cy - s * 0.1),
               (cx - s * 0.2, cy - s * 0.6)], fill=(196, 104, 56, 255))
    d.line([(cx - s * 0.62, cy - s * 0.05), (cx + s * 0.62, cy - s * 0.05)], fill=(90, 50, 30, 255), width=5)
    d.arc([cx - s * 0.75, cy - s * 0.95, cx - s * 0.15, cy - s * 0.2], 120, 300, fill=(150, 80, 44, 255), width=6)
    d.arc([cx + s * 0.15, cy - s * 0.95, cx + s * 0.75, cy - s * 0.2], 240, 60, fill=(150, 80, 44, 255), width=6)


def icon_star(d, cx, cy, s):
    d.ellipse([cx - s * 1.25, cy - s * 1.25, cx + s * 1.25, cy + s * 1.25], fill=(40, 52, 96, 255))
    pts = []
    for k in range(10):
        r = s * (0.95 if k % 2 == 0 else 0.4)
        a = -math.pi / 2 + k * math.pi / 5
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    d.polygon(pts, fill=(255, 214, 90, 255))
    for (x, y) in ((-0.8, 0.5), (0.75, 0.6), (0.6, -0.75)):
        d.ellipse([cx + x * s - 5, cy + y * s - 5, cx + x * s + 5, cy + y * s + 5], fill=(230, 236, 255, 255))


def fabric_tile(n=512, seed=171):
    """Neutral light fabric: the avatar's clothes are tinted per preset, so this only adds weave and folds."""
    yy, xx = np.mgrid[0:n, 0:n] / n
    weave = (np.sin(xx * math.pi * 128) * 0.5 + 0.5) * (np.sin(yy * math.pi * 128) * 0.5 + 0.5)
    v = 0.78 + 0.12 * fnoise(n, 2.0, seed) + 0.06 * weave + 0.04 * fnoise(n, 1.0, seed + 1)
    save(to_img(np.stack([v, v, v], -1)), "fabric.jpg")


def skin_tile(n=256, seed=181):
    v = 0.9 + 0.08 * fnoise(n, 2.2, seed)
    save(to_img(np.stack([v, v * 0.98, v * 0.96], -1)), "skin.jpg")


if __name__ == "__main__":
    fabric_tile()
    skin_tile()
    sign("sign_biome.jpg", icon_leaf)
    sign("sign_chrono.jpg", icon_amphora)
    sign("sign_sky.jpg", icon_star)
    grass_tile()
    dirt_tile()
    stone_tile()
    bark_tile()
    wood_tile()
    rock_tile()
    leaf_atlas()
    fern_frond()
    flower_atlas()
    grass_card()
    plaza_top()
    lantern_glass()
    clay_tile()
    brass_tile()
    cloth_tile()
