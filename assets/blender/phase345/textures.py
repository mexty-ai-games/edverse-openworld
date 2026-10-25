"""Painted textures + 2D art for OpenWorld phases 3-5 (Together, Make things, Seasons). numpy + Pillow.

python3 textures.py <out_dir> [<sticker_dir>]
Everything is painted here from noise and simple strokes (nothing copied): soil, washi fibre paper,
bamboo, lime/pozzolana/concrete, cacao foam, cork, painted signboards (BioBlitz banner, delivery
board, photo-challenge board, class flag, museum crest - all icon-only, no text), seed-packet
fronts, crate label icons, monarch / clear insect wings, autumn leaf atlas, sunflower disc, and
the six preset museum stickers (128 px PNG: wow, heart-leaf, star, sparkle, laugh, clap).
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else "build/tex"
STK = sys.argv[2] if len(sys.argv) > 2 else os.path.join(OUT, "stickers")
sys.argv = [sys.argv[0], OUT]
sys.path.insert(0, os.path.dirname(HERE))
import textures as G  # noqa: E402  (the Idea Grove's noise helpers)

G.OUT = OUT
os.makedirs(OUT, exist_ok=True)
os.makedirs(STK, exist_ok=True)
fnoise, ramp, to_img, normal_from_height, save, leaf_shape = (G.fnoise, G.ramp, G.to_img, G.normal_from_height, G.save,
                                                              G.leaf_shape)


def smooth_img(img, r=1.2):
    return img.filter(ImageFilter.GaussianBlur(r))


# ============================================================================= tileables
def soil(n=1024, seed=501):
    a = fnoise(n, 2.0, seed)
    b = fnoise(n, 1.1, seed + 1)
    clod = np.clip((fnoise(n, 1.6, seed + 2) - 0.55) * 4, 0, 1)
    v = a * 0.5 + b * 0.3 + clod * 0.35
    rgb = ramp(v, [(0, (38, 24, 16)), (0.35, (62, 40, 26)), (0.6, (88, 60, 38)), (0.85, (116, 84, 54)), (1, (140, 106, 70))])
    rng = np.random.default_rng(seed)
    img = to_img(rgb)
    d = ImageDraw.Draw(img)
    for _ in range(900):  # crumbs and little pebbles
        x, y = rng.uniform(0, n, 2)
        r = rng.uniform(1.5, 5)
        c = int(rng.uniform(110, 170))
        d.ellipse([x - r, y - r * 0.8, x + r, y + r * 0.8], fill=(c, int(c * 0.78), int(c * 0.58)))
        d.ellipse([x - r * 0.6, y - r * 0.9, x + r * 0.2, y - r * 0.3], fill=(min(255, c + 30), int((c + 30) * 0.8), int((c + 30) * 0.62)))
    save(smooth_img(img, 0.8), "p_soil.jpg")
    save(to_img(normal_from_height(a * 0.6 + clod * 0.6, 5)), "p_soil_n.jpg")


def washi(n=512, seed=511):
    """Kozo paper: long soft fibres in a warm white sheet."""
    base = fnoise(n, 1.4, seed) * 0.4 + 0.6
    rgb = np.stack([base * 0.99, base * 0.96, base * 0.89], -1)
    img = to_img(rgb)
    d = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    for _ in range(700):
        x, y = rng.uniform(0, n), rng.uniform(0, n)
        a = rng.uniform(0, math.pi * 2)
        L = rng.uniform(20, 90)
        pts = []
        for k in range(8):
            a += rng.uniform(-0.35, 0.35)
            x += math.cos(a) * L / 8
            y += math.sin(a) * L / 8
            pts.append((x, y))
        c = rng.choice([(255, 252, 240, 90), (214, 200, 170, 70), (236, 226, 204, 110)])
        d.line(pts, fill=c, width=1)
    save(smooth_img(img, 0.5), "p_washi.jpg")


def bamboo(w=512, h=512, seed=521):
    v = fnoise(w, 1.2, seed, aniso=(1.0, 0.08), lo=2)
    rgb = ramp(v, [(0, (150, 126, 70)), (0.5, (196, 172, 104)), (1, (226, 206, 140))])
    img = to_img(rgb)
    d = ImageDraw.Draw(img)
    for x in range(0, w, 16):  # split-bamboo slats
        d.line([(x, 0), (x, h)], fill=(120, 96, 52), width=2)
    save(smooth_img(img, 0.6), "p_bamboo.jpg")


def timber(n=1024, seed=525):
    """Honey-coloured timber with long grain and a few soft knots (glulam beams, furniture)."""
    g = fnoise(n, 1.3, seed, aniso=(0.06, 1.0), lo=2)
    f = fnoise(n, 2.0, seed + 1)
    v = 0.75 * g + 0.25 * f
    rgb = ramp(v, [(0, (150, 100, 58)), (0.35, (186, 134, 82)), (0.7, (214, 168, 108)), (1, (232, 196, 140))])
    img = to_img(rgb)
    d = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    for _ in range(7):
        x, y = rng.uniform(0, n), rng.uniform(0, n)
        for r in range(18, 2, -4):
            d.ellipse([x - r * 0.6, y - r * 1.6, x + r * 0.6, y + r * 1.6], outline=(120, 76, 40, 90), width=2)
    save(smooth_img(img, 0.6), "p_timber.jpg")
    save(to_img(normal_from_height(g, 3)), "p_timber_n.jpg")


def lime(n=512, seed=531):
    v = fnoise(n, 1.8, seed)
    save(to_img(ramp(v, [(0, (210, 204, 190)), (0.6, (236, 232, 222)), (1, (250, 248, 242))])), "p_lime.jpg")


def ash(n=512, seed=541):
    """Pozzolana: grey-violet volcanic grit with dark specks."""
    v = fnoise(n, 1.0, seed) * 0.6 + fnoise(n, 2.2, seed + 1) * 0.4
    img = to_img(ramp(v, [(0, (70, 60, 66)), (0.4, (104, 90, 92)), (0.7, (132, 114, 108)), (1, (164, 140, 124))]))
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(seed)
    for _ in range(2500):
        x, y = rng.uniform(0, n, 2)
        r = rng.uniform(0.6, 2.2)
        c = int(rng.uniform(30, 190))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(c, int(c * 0.9), int(c * 0.88)))
    save(img, "p_ash.jpg")


def concrete(n=512, seed=551):
    """Roman concrete: warm grey with tufa / brick aggregate showing."""
    v = fnoise(n, 1.9, seed)
    img = to_img(ramp(v, [(0, (150, 140, 124)), (0.5, (184, 174, 156)), (1, (210, 202, 186))]))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    for _ in range(260):
        x, y = rng.uniform(0, n), rng.uniform(0, n)
        r = rng.uniform(3, 12)
        col = rng.choice([(160, 100, 72), (118, 108, 104), (196, 170, 120), (92, 84, 84), (222, 214, 196)])
        pts = [(x + math.cos(a) * r * rng.uniform(0.6, 1.1), y + math.sin(a) * r * rng.uniform(0.6, 1.1)) for a in
               [k / 7 * 6.283 for k in range(7)]]
        d.polygon(pts, fill=col)
    save(smooth_img(img, 0.7), "p_concrete.jpg")


def foam(n=256, seed=561):
    """Cacao froth: creamy bubbles."""
    img = Image.new("RGB", (n, n), (196, 150, 110))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    for _ in range(900):
        x, y = rng.uniform(0, n), rng.uniform(0, n)
        r = rng.uniform(2, 9)
        c = rng.uniform(0.85, 1.12)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(int(min(255, 214 * c)), int(min(255, 172 * c)), int(min(255, 130 * c))))
        d.ellipse([x - r * 0.5, y - r * 0.7, x, y - r * 0.2], fill=(240, 216, 184))
    save(smooth_img(img, 0.7), "p_foam.jpg")


def cork(n=512, seed=571):
    v = fnoise(n, 0.9, seed) * 0.5 + fnoise(n, 2.0, seed + 1) * 0.5
    img = to_img(ramp(v, [(0, (126, 82, 46)), (0.5, (170, 118, 70)), (1, (206, 156, 100))]))
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(seed)
    for _ in range(3000):
        x, y = rng.uniform(0, n, 2)
        c = int(rng.uniform(80, 210))
        d.point((x, y), fill=(c, int(c * 0.7), int(c * 0.42)))
    save(img, "p_cork.jpg")


def cacao_skin(n=512, seed=581):
    """Ridged pod skin: maroon -> golden streaks along v (ridges come from geometry)."""
    v = fnoise(n, 1.3, seed, aniso=(1, 0.2))
    save(to_img(ramp(v, [(0, (0.6 * 255, 0.6 * 255, 0.55 * 255)), (1, (255, 252, 244))])), "p_streak.jpg")


def sunflower_disc(n=512, seed=591):
    """Fibonacci florets: dark centre, golden rim."""
    img = Image.new("RGB", (n, n), (70, 40, 20))
    d = ImageDraw.Draw(img)
    c = n / 2
    golden = math.pi * (3 - math.sqrt(5))
    N = 900
    for i in range(N):
        r = math.sqrt(i / N) * n * 0.49
        a = i * golden
        x, y = c + math.cos(a) * r, c + math.sin(a) * r
        t = r / (n * 0.49)
        col = (int(60 + 140 * t ** 2), int(34 + 90 * t ** 2.2), int(18 + 10 * t))
        s = 3 + 5 * t
        d.ellipse([x - s, y - s, x + s, y + s], fill=col)
        d.ellipse([x - s * 0.5, y - s * 0.6, x + s * 0.1, y], fill=tuple(min(255, k + 40) for k in col))
    save(smooth_img(img, 0.6), "p_sunflower_disc.jpg")


# ============================================================================= wings
def monarch_wing(n=512, seed=601):
    """Upper wing pair painted in the RGBA atlas: left half forewing, right half hindwing.
    Orange cells, black veins and borders, two rows of white dots. Alpha = wing outline."""
    S = n * 2
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # forewing (left half): base at bottom-left, tip at top-right of its half
    def fore(w, sc=1.0):
        return [(w * x, S - S * y) for x, y in ((0.02, 0.04), (0.1, 0.5), (0.3, 0.86), (0.47, 0.97), (0.49, 0.8), (0.42, 0.45),
                                                (0.3, 0.2), (0.15, 0.03))]
    hind = [(S * 0.5 + S * x, S - S * y) for x, y in ((0.02, 0.6), (0.1, 0.8), (0.3, 0.86), (0.44, 0.72), (0.48, 0.45),
                                                     (0.38, 0.2), (0.2, 0.08), (0.06, 0.2))]
    for poly in (fore(S), hind):
        d.polygon(poly, fill=(28, 20, 18, 255))
    # orange cells: inset polygons, separated by veins
    rng = random.Random(seed)

    def cells(poly, root, k=6):
        cx = sum(p[0] for p in poly) / len(poly)
        cy = sum(p[1] for p in poly) / len(poly)
        inset = [(cx + (x - cx) * 0.78, cy + (y - cy) * 0.78) for x, y in poly]
        for i in range(k):
            a0 = i / k
            a1 = (i + 1) / k
            m = len(inset)
            p0 = inset[int(a0 * m) % m]
            p1 = inset[int(a1 * m) % m]
            pm = inset[int((a0 + a1) / 2 * m) % m]
            tri = [root, (root[0] * 0.15 + p0[0] * 0.85 + 6, root[1] * 0.15 + p0[1] * 0.85), pm,
                   (root[0] * 0.15 + p1[0] * 0.85 - 6, root[1] * 0.15 + p1[1] * 0.85)]
            col = (232 + rng.randint(-10, 10), 120 + rng.randint(-16, 16), 24, 255)
            d.polygon(tri, fill=col)
        return inset

    fi = cells(fore(S), (S * 0.05, S * 0.93))
    hi = cells(hind, (S * 0.53, S * 0.62))
    # redraw thin black veins radiating from the roots
    for root, poly in (((S * 0.05, S * 0.93), fi), ((S * 0.53, S * 0.62), hi)):
        for p in poly[::1]:
            d.line([root, p], fill=(28, 20, 18, 255), width=10)
    # white dots along the black borders
    for poly in (fore(S), hind):
        cx = sum(p[0] for p in poly) / len(poly)
        cy = sum(p[1] for p in poly) / len(poly)
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            for t in (0.25, 0.5, 0.75):
                x = a[0] + (b[0] - a[0]) * t
                y = a[1] + (b[1] - a[1]) * t
                x, y = cx + (x - cx) * 0.92, cy + (y - cy) * 0.92
                r = 9
                d.ellipse([x - r, y - r, x + r, y + r], fill=(250, 246, 236, 255))
    img = img.filter(ImageFilter.GaussianBlur(1.6)).resize((n, n), Image.LANCZOS)
    a = np.array(img).astype(float)
    a[..., 3] = np.where(a[..., 3] > 100, 255, 0)
    save(Image.fromarray(a.astype(np.uint8)), "p_monarch_wing.png")


def clear_wing(n=256, seed=611):
    """A clear insect wing (bee / hoverfly / cicada): pale membrane, brown veins, soft alpha."""
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    poly = [(n * 0.03, n * 0.5)]
    for i in range(1, 20):
        t = i / 20
        poly.append((n * (0.03 + 0.94 * t), n * (0.5 - 0.36 * math.sin(t * math.pi) ** 0.7 * (1 - 0.2 * t))))
    poly.append((n * 0.97, n * 0.52))
    for i in range(19, 0, -1):
        t = i / 20
        poly.append((n * (0.03 + 0.94 * t), n * (0.5 + 0.22 * math.sin(t * math.pi) ** 0.8)))
    d.polygon(poly, fill=(226, 236, 240, 120))
    for k, (y0, y1) in enumerate(((0.48, 0.2), (0.5, 0.36), (0.5, 0.55), (0.5, 0.66))):
        d.line([(n * 0.04, n * y0), (n * 0.5, n * (y0 + y1) / 2), (n * 0.92, n * y1)], fill=(110, 82, 50, 220), width=3)
    d.line([(n * 0.35, n * 0.3), (n * 0.4, n * 0.66)], fill=(110, 82, 50, 200), width=2)
    d.line([(n * 0.62, n * 0.24), (n * 0.66, n * 0.62)], fill=(110, 82, 50, 200), width=2)
    d.line(poly + [poly[0]], fill=(120, 94, 64, 230), width=3)
    save(img.filter(ImageFilter.GaussianBlur(0.6)), "p_clear_wing.png")


# ============================================================================= leaves, packets, labels
def autumn_leaves(n=1024, seed=621):
    """Four quadrants of fallen leaf clusters in autumn colours (for leaf piles)."""
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    q = n // 2
    pals = [(204, 84, 32), (226, 140, 36), (178, 52, 34), (236, 186, 64), (150, 92, 40), (196, 112, 48)]
    for qi in range(4):
        ox, oy = (qi % 2) * q, (qi // 2) * q
        for _ in range(26):
            r = q * 0.36 * math.sqrt(rng.random())
            a = rng.uniform(0, 6.283)
            cx, cy = ox + q / 2 + math.cos(a) * r, oy + q / 2 + math.sin(a) * r
            col = rng.choice(pals)
            col = tuple(int(c * rng.uniform(0.85, 1.08)) for c in col)
            ang = rng.uniform(0, 6.283)
            if rng.random() < 0.5:  # maple-ish: 5 lobes
                for lobe in range(5):
                    la = ang + (lobe - 2) * 0.62
                    leaf_shape(d, cx, cy, rng.uniform(36, 52) * (1 - abs(lobe - 2) * 0.15), 14, la, col + (255,))
            else:
                leaf_shape(d, cx, cy, rng.uniform(54, 74), rng.uniform(16, 22), ang, col + (255,))
            d.line([(cx, cy), (cx - math.cos(ang) * 16, cy - math.sin(ang) * 16)], fill=(96, 58, 30, 255), width=3)
    save(img.filter(ImageFilter.SMOOTH), "p_autumn_leaves.png")


PLANT_COL = {
    "sunflower": ((248, 196, 40), (110, 70, 30)),
    "lavender": ((150, 116, 210), (92, 70, 150)),
    "foxglove": ((226, 120, 190), (180, 80, 150)),
    "clover": ((240, 236, 240), (120, 170, 80)),
    "tomato": ((222, 64, 46), (250, 210, 60)),
    "milkweed": ((236, 140, 168), (196, 92, 120)),
}


def draw_plant_art(d, cx, cy, s, kind):
    """Small painted portrait of each plant (seed packets, garden signs)."""
    pet, acc = PLANT_COL[kind]
    green = (76, 140, 60)
    d.line([(cx, cy + s), (cx, cy - s * 0.2)], fill=green, width=max(3, int(s * 0.08)))
    leaf_shape(d, cx, cy + s * 0.5, s * 0.55, s * 0.18, -0.5, green + (255,))
    leaf_shape(d, cx, cy + s * 0.65, s * 0.55, s * 0.18, math.pi + 0.5, (66, 128, 54, 255))
    if kind == "sunflower":
        for k in range(14):
            a = k / 14 * 6.283
            leaf_shape(d, cx, cy - s * 0.35, s * 0.55, s * 0.13, a, pet + (255,), vein=False)
        d.ellipse([cx - s * 0.26, cy - s * 0.61, cx + s * 0.26, cy - s * 0.09], fill=acc)
    elif kind == "lavender":
        for j, dx in enumerate((-0.3, 0, 0.3)):
            x = cx + dx * s
            d.line([(cx, cy + s * 0.3), (x, cy - s * 0.3)], fill=green, width=3)
            for k in range(7):
                y = cy - s * 0.3 - k * s * 0.09
                d.ellipse([x - s * 0.07, y - s * 0.05, x + s * 0.07, y + s * 0.05], fill=(pet if k % 2 else acc))
    elif kind == "foxglove":
        for k in range(6):
            y = cy - s * 0.1 - k * s * 0.15
            side = 1 if k % 2 else -1
            r = s * (0.16 - k * 0.015)
            d.ellipse([cx + side * r * 0.4 - r, y - r * 0.7, cx + side * r * 0.4 + r, y + r * 0.7], fill=pet)
            d.ellipse([cx + side * r * 0.4 - r * 0.45, y - r * 0.2, cx + side * r * 0.4 + r * 0.45, y + r * 0.5], fill=(250, 226, 236))
            d.ellipse([cx + side * r * 0.4 - 3, y + 2, cx + side * r * 0.4 + 3, y + 8], fill=acc)
    elif kind == "clover":
        for k in range(3):
            a = -1.57 + k * 2.09
            leaf_shape(d, cx, cy + s * 0.3, s * 0.32, s * 0.16, a, (90, 156, 70, 255), vein=False)
        for k in range(20):
            a = k / 20 * 6.283
            x, y = cx + math.cos(a) * s * 0.18, cy - s * 0.35 + math.sin(a) * s * 0.18
            leaf_shape(d, cx, cy - s * 0.35, s * 0.22, s * 0.05, a, (240, 236, 240, 255), vein=False)
        d.ellipse([cx - s * 0.08, cy - s * 0.43, cx + s * 0.08, cy - s * 0.27], fill=(236, 210, 220))
    elif kind == "tomato":
        for x, y, r in ((-0.22, -0.1, 0.22), (0.2, -0.25, 0.2), (0.0, 0.2, 0.18)):
            X, Y, R = cx + x * s, cy + y * s, r * s
            d.ellipse([X - R, Y - R, X + R, Y + R], fill=pet)
            d.ellipse([X - R * 0.5, Y - R * 0.7, X - R * 0.05, Y - R * 0.3], fill=(250, 140, 120))
            for k in range(5):
                a = k / 5 * 6.283
                d.line([(X, Y - R), (X + math.cos(a) * R * 0.4, Y - R + math.sin(a) * R * 0.25)], fill=green, width=3)
    elif kind == "milkweed":
        for j, dx in enumerate((-0.25, 0.22)):
            X, Y = cx + dx * s, cy - s * 0.4 + j * s * 0.1
            for k in range(18):
                a = k / 18 * 6.283
                r = s * 0.17 * math.sqrt((k * 7 % 18) / 18)
                x, y = X + math.cos(a) * r, Y + math.sin(a) * r * 0.8
                d.ellipse([x - s * 0.05, y - s * 0.05, x + s * 0.05, y + s * 0.05], fill=pet)
                d.ellipse([x - s * 0.02, y - s * 0.03, x + s * 0.02, y], fill=(250, 210, 220))


def seed_packets(n=1024, seed=631):
    """3x2 atlas of seed-packet fronts: kraft paper, a coloured band, a painted plant (no text)."""
    W, H = n // 3, n // 2
    img = Image.new("RGB", (n, n), (200, 170, 120))
    kraft = to_img(ramp(fnoise(n, 1.6, seed), [(0, (186, 150, 104)), (1, (222, 194, 150))]))
    img.paste(kraft)
    d = ImageDraw.Draw(img, "RGBA")
    for i, kind in enumerate(PLANT_COL):
        ox, oy = (i % 3) * W, (i // 3) * H
        pet, acc = PLANT_COL[kind]
        d.rectangle([ox + 14, oy + 14, ox + W - 14, oy + H - 14], fill=(250, 244, 228, 255))
        d.rectangle([ox + 14, oy + 14, ox + W - 14, oy + 70], fill=pet + (255,))
        for k in range(5):  # little seed dots on the band instead of a name
            x = ox + 50 + k * (W - 100) / 4
            d.ellipse([x - 8, oy + 34, x + 8, oy + 50], fill=(90, 66, 40, 255))
        d.ellipse([ox + 40, oy + 100, ox + W - 40, oy + H - 40], fill=tuple(int(c * 0.35 + 255 * 0.65) for c in pet) + (255,))
        draw_plant_art(d, ox + W / 2, oy + H * 0.58, W * 0.32, kind)
        d.rectangle([ox + 14, oy + H - 34, ox + W - 14, oy + H - 14], fill=acc + (255,))
    save(smooth_img(img, 0.6), "p_packets.jpg")


def icon_draw(d, kind, cx, cy, s, col=(60, 46, 34)):
    """Simple pictograms (no text) for crate labels and boards."""
    w = max(3, int(s * 0.12))
    if kind == "up":       # this-way-up arrows
        for dx in (-0.35, 0.35):
            x = cx + dx * s
            d.polygon([(x, cy - s), (x - s * 0.3, cy - s * 0.45), (x + s * 0.3, cy - s * 0.45)], fill=col)
            d.rectangle([x - s * 0.1, cy - s * 0.5, x + s * 0.1, cy + s * 0.6], fill=col)
        d.rectangle([cx - s * 0.8, cy + s * 0.7, cx + s * 0.8, cy + s * 0.85], fill=col)
    elif kind == "fragile":  # a stemmed glass
        d.polygon([(cx - s * 0.5, cy - s * 0.9), (cx + s * 0.5, cy - s * 0.9), (cx + s * 0.1, cy), (cx - s * 0.1, cy)], fill=col)
        d.rectangle([cx - s * 0.07, cy, cx + s * 0.07, cy + s * 0.7], fill=col)
        d.rectangle([cx - s * 0.4, cy + s * 0.7, cx + s * 0.4, cy + s * 0.85], fill=col)
        d.line([(cx - s * 0.2, cy - s * 0.8), (cx, cy - s * 0.55), (cx - s * 0.1, cy - s * 0.4)], fill=(240, 230, 210), width=w // 2 + 1)
    elif kind == "gear":
        for k in range(8):
            a = k / 8 * 6.283
            x, y = cx + math.cos(a) * s * 0.75, cy + math.sin(a) * s * 0.75
            d.ellipse([x - s * 0.18, y - s * 0.18, x + s * 0.18, y + s * 0.18], fill=col)
        d.ellipse([cx - s * 0.7, cy - s * 0.7, cx + s * 0.7, cy + s * 0.7], fill=col)
        d.ellipse([cx - s * 0.28, cy - s * 0.28, cx + s * 0.28, cy + s * 0.28], fill=(236, 220, 190))
    elif kind == "star":
        pts = []
        for k in range(10):
            a = -math.pi / 2 + k * math.pi / 5
            r = s * (0.95 if k % 2 == 0 else 0.42)
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        d.polygon(pts, fill=col)
    elif kind == "leaf":
        leaf_shape(d, cx - s * 0.7, cy + s * 0.5, s * 1.6, s * 0.5, -0.65, col + (255,) if len(col) == 3 else col, vein=False)
    elif kind == "planet":
        d.ellipse([cx - s * 0.55, cy - s * 0.55, cx + s * 0.55, cy + s * 0.55], fill=col)
        d.arc([cx - s, cy - s * 0.3, cx + s, cy + s * 0.3], 160, 380, fill=col, width=w)
    elif kind == "camera":
        d.rounded_rectangle([cx - s, cy - s * 0.55, cx + s, cy + s * 0.7], radius=s * 0.2, fill=col)
        d.rectangle([cx - s * 0.4, cy - s * 0.8, cx + s * 0.2, cy - s * 0.5], fill=col)
        d.ellipse([cx - s * 0.45, cy - s * 0.35, cx + s * 0.45, cy + s * 0.55], fill=(240, 228, 200))
        d.ellipse([cx - s * 0.28, cy - s * 0.18, cx + s * 0.28, cy + s * 0.38], fill=col)
    elif kind == "lens":
        d.ellipse([cx - s * 0.7, cy - s * 0.8, cx + s * 0.3, cy + s * 0.2], outline=col, width=w * 2)
        d.line([(cx + s * 0.2, cy + s * 0.1), (cx + s * 0.85, cy + s * 0.8)], fill=col, width=w * 2)
    elif kind == "compass":
        d.ellipse([cx - s, cy - s, cx + s, cy + s], outline=col, width=w)
        d.polygon([(cx, cy - s * 0.85), (cx + s * 0.22, cy), (cx, cy + s * 0.85), (cx - s * 0.22, cy)], fill=col)
        d.polygon([(cx - s * 0.85, cy), (cx, cy - s * 0.18), (cx + s * 0.85, cy), (cx, cy + s * 0.18)], fill=col)
    elif kind == "bug":
        d.ellipse([cx - s * 0.35, cy - s * 0.5, cx + s * 0.35, cy + s * 0.6], fill=col)
        d.ellipse([cx - s * 0.22, cy - s * 0.8, cx + s * 0.22, cy - s * 0.42], fill=col)
        for k in (-1, 0, 1):
            for sx in (-1, 1):
                d.line([(cx, cy + k * s * 0.25), (cx + sx * s * 0.7, cy + k * s * 0.35 + s * 0.1)], fill=col, width=w)
    elif kind == "parcel":
        d.rectangle([cx - s * 0.8, cy - s * 0.6, cx + s * 0.8, cy + s * 0.7], fill=col)
        d.rectangle([cx - s * 0.1, cy - s * 0.6, cx + s * 0.1, cy + s * 0.7], fill=(240, 228, 200))
        d.line([(cx - s * 0.4, cy - s * 0.95), (cx, cy - s * 0.6), (cx + s * 0.4, cy - s * 0.95)], fill=col, width=w)
    elif kind == "flower":
        for k in range(6):
            a = k / 6 * 6.283
            x, y = cx + math.cos(a) * s * 0.45, cy + math.sin(a) * s * 0.45
            d.ellipse([x - s * 0.33, y - s * 0.33, x + s * 0.33, y + s * 0.33], fill=col)
        d.ellipse([cx - s * 0.3, cy - s * 0.3, cx + s * 0.3, cy + s * 0.3], fill=(250, 210, 80))


def crate_labels(n=512, seed=641):
    """2x2 label atlas on cream paper: up-arrows, fragile glass, gear (parts), leaf (seeds/plants)."""
    img = Image.new("RGB", (n, n), (236, 222, 190))
    paper = to_img(ramp(fnoise(n, 1.5, seed), [(0, (222, 204, 166)), (1, (246, 236, 210))]))
    img.paste(paper)
    d = ImageDraw.Draw(img)
    q = n // 2
    cols = [(52, 44, 38), (190, 64, 46), (46, 96, 140), (60, 128, 62)]
    for i, kind in enumerate(("up", "fragile", "gear", "leaf")):
        ox, oy = (i % 2) * q, (i // 2) * q
        d.rounded_rectangle([ox + 10, oy + 10, ox + q - 10, oy + q - 10], radius=24, outline=cols[i], width=8)
        icon_draw(d, kind, ox + q / 2, oy + q / 2, q * 0.3, cols[i])
    save(smooth_img(img, 0.7), "p_labels.jpg")


def painted_board(name, w, h, bg, items, seed, frame=None, wood_bg=False):
    """A painted signboard: textured background + list of (kind, x, y, size, colour)."""
    v = fnoise(max(w, h), 1.6, seed)[:h, :w]
    lo = tuple(int(c * 0.82) for c in bg)
    img = to_img(ramp(v, [(0, lo), (1, bg)]))
    d = ImageDraw.Draw(img, "RGBA")
    if wood_bg:
        for y in range(0, h, h // 6):
            d.line([(0, y), (w, y)], fill=(60, 40, 24, 160), width=4)
    for it in items:
        it(d)
    if frame:
        d.rectangle([4, 4, w - 5, h - 5], outline=frame, width=10)
    save(smooth_img(img, 0.8), name)


def boards():
    # BioBlitz banner: green canvas, big lens over a leaf, bugs + flowers around, a dotted trail
    W, H = 1024, 512

    def bb(d):
        d.ellipse([W / 2 - 230, H / 2 - 210, W / 2 + 230, H / 2 + 210], fill=(250, 238, 200, 255))
        icon_draw(d, "leaf", W / 2 - 40, H / 2 + 20, 120, (70, 140, 60))
        icon_draw(d, "lens", W / 2 + 10, H / 2 - 10, 150, (60, 46, 34))
        for x, y, k, c in ((150, 140, "bug", (60, 46, 34)), (870, 150, "flower", (220, 90, 120)), (160, 380, "flower", (240, 170, 40)),
                           (860, 380, "bug", (60, 46, 34)), (300, 250, "star", (250, 210, 80)), (720, 260, "star", (250, 210, 80))):
            icon_draw(d, k, x, y, 60, c)
        for k in range(14):
            x = 90 + k * (W - 180) / 13
            d.ellipse([x - 8, H - 46, x + 8, H - 30], fill=(250, 238, 200, 230))
    painted_board("p_banner.jpg", W, H, (70, 150, 110), [bb], 651, frame=(250, 220, 140))

    # delivery board: a little map with three pins and parcel/planet/gear icons, cork bottom
    def db(d):
        d.rectangle([40, 40, W - 40, H - 40], fill=(232, 220, 186, 255))
        d.line([(120, 380), (300, 200), (520, 330), (760, 150), (900, 300)], fill=(150, 110, 70, 255), width=10)
        for (x, y), k, c in (((120, 380), "parcel", (176, 112, 60)), ((520, 330), "gear", (60, 110, 160)),
                             ((760, 150), "planet", (140, 90, 170)), ((900, 300), "star", (230, 170, 40))):
            d.ellipse([x - 54, y - 54, x + 54, y + 54], fill=(250, 244, 226, 255), outline=c, width=8)
            icon_draw(d, k, x, y, 34, c)
    painted_board("p_delivery_board.jpg", W, H, (120, 86, 54), [db], 661, frame=(70, 46, 28))

    # photo challenge board: camera at the centre, empty photo corners around, sun/leaf/bug hints
    def pb(d):
        d.ellipse([W / 2 - 120, 60, W / 2 + 120, 300], fill=(250, 236, 196, 255))
        icon_draw(d, "camera", W / 2, 180, 80, (60, 46, 34))
        for k, (x, kind, c) in enumerate(((150, "flower", (220, 100, 130)), (330, "bug", (60, 46, 34)),
                                          (W - 330, "leaf", (70, 140, 60)), (W - 150, "star", (240, 180, 50)))):
            y = 390
            d.rectangle([x - 74, y - 70, x + 74, y + 70], fill=(252, 248, 236, 255), outline=(150, 120, 90, 255), width=4)
            icon_draw(d, kind, x, y, 38, c)
            for sx in (-1, 1):
                for sy in (-1, 1):
                    d.polygon([(x + sx * 74, y + sy * 70), (x + sx * 50, y + sy * 70), (x + sx * 74, y + sy * 46)], fill=(70, 50, 34, 255))
    painted_board("p_photo_board.jpg", W, H, (44, 96, 120), [pb], 671, frame=(220, 180, 110))

    # class expedition flag: a compass rose with a leaf, on warm yellow canvas; tail stripes
    FW, FH = 512, 384

    def fl(d):
        d.ellipse([FW / 2 - 130, FH / 2 - 130, FW / 2 + 130, FH / 2 + 130], fill=(250, 244, 226, 255))
        icon_draw(d, "compass", FW / 2, FH / 2, 112, (54, 70, 120))
        icon_draw(d, "leaf", FW / 2 - 10, FH / 2 + 8, 46, (70, 140, 60))
        for k in range(4):
            c = [(226, 90, 60), (70, 140, 200), (90, 170, 90), (240, 180, 50)][k]
            d.rectangle([0, k * FH / 4 + 4, 34, (k + 1) * FH / 4 - 4], fill=c + (255,))
    painted_board("p_flag.jpg", FW, FH, (244, 196, 70), [fl], 681)

    # museum crest over the door: a frame with a mountain + sun + leaf (no words)
    CW, CH = 512, 256

    def mc(d):
        d.rounded_rectangle([150, 30, 362, 226], radius=16, fill=(250, 240, 210, 255), outline=(150, 100, 50, 255), width=10)
        d.polygon([(170, 206), (230, 110), (270, 160), (300, 120), (342, 206)], fill=(80, 130, 110, 255))
        d.ellipse([280, 54, 330, 104], fill=(244, 180, 60, 255))
        icon_draw(d, "star", 80, 128, 46, (244, 200, 90))
        icon_draw(d, "star", 432, 128, 46, (244, 200, 90))
    painted_board("p_crest.jpg", CW, CH, (60, 90, 70), [mc], 691)


TEAMS = [("leaf", (0, 158, 115)), ("drop", (86, 180, 233)), ("sun", (230, 159, 0)), ("flower", (204, 121, 167))]


def badges(n=512, seed=701):
    """2x2 team-badge faces (Okabe-Ito colours, each with its own icon so colour is never the only cue)."""
    img = Image.new("RGB", (n, n), (240, 230, 200))
    d = ImageDraw.Draw(img, "RGBA")
    q = n // 2
    for i, (icon, col) in enumerate(TEAMS):
        ox, oy = (i % 2) * q, (i // 2) * q
        cx, cy = ox + q / 2, oy + q / 2
        v = fnoise(q, 1.6, seed + i)
        lo = tuple(int(c * 0.8) for c in col)
        hi = tuple(min(255, int(c * 1.12 + 20)) for c in col)
        img.paste(to_img(ramp(v, [(0, lo), (1, hi)])), (ox, oy))
        d.ellipse([cx - q * 0.36, cy - q * 0.36, cx + q * 0.36, cy + q * 0.36], fill=(255, 250, 236, 255))
        ink = tuple(int(c * 0.75) for c in col)
        s = q * 0.24
        if icon == "leaf":
            leaf_shape(d, cx - s * 0.8, cy + s * 0.55, s * 1.8, s * 0.6, -0.7, ink + (255,), vein=False)
            d.line([(cx - s * 0.8, cy + s * 0.6), (cx + s * 0.5, cy - s * 0.5)], fill=(255, 250, 236, 255), width=6)
        elif icon == "drop":
            d.ellipse([cx - s * 0.62, cy - s * 0.2, cx + s * 0.62, cy + s * 1.0], fill=ink)
            d.polygon([(cx, cy - s * 1.0), (cx - s * 0.58, cy + s * 0.2), (cx + s * 0.58, cy + s * 0.2)], fill=ink)
            d.ellipse([cx - s * 0.35, cy + s * 0.1, cx - s * 0.1, cy + s * 0.5], fill=(255, 250, 236, 200))
        elif icon == "sun":
            for k in range(10):
                a = k / 10 * 6.283
                d.line([(cx + math.cos(a) * s * 0.5, cy + math.sin(a) * s * 0.5), (cx + math.cos(a) * s * 1.0, cy + math.sin(a) * s * 1.0)],
                       fill=ink, width=12)
            d.ellipse([cx - s * 0.52, cy - s * 0.52, cx + s * 0.52, cy + s * 0.52], fill=ink)
        else:
            for k in range(5):
                a = k / 5 * 6.283 - 1.57
                x, y = cx + math.cos(a) * s * 0.52, cy + math.sin(a) * s * 0.52
                d.ellipse([x - s * 0.42, y - s * 0.42, x + s * 0.42, y + s * 0.42], fill=ink)
            d.ellipse([cx - s * 0.3, cy - s * 0.3, cx + s * 0.3, cy + s * 0.3], fill=(255, 226, 120, 255))
    save(smooth_img(img, 0.7), "p_badges.jpg")


def display_plates(w=768, h=256, seed=711):
    """Three brass plates (Rome / Edo / Maya), icon only: an arch, a folded paper fan, a cacao pod."""
    img = to_img(ramp(fnoise(w, 1.4, seed)[:h, :w], [(0, (170, 128, 60)), (1, (226, 186, 104))]))
    d = ImageDraw.Draw(img)
    ink = (92, 60, 26)
    for i in range(3):
        ox = i * 256
        d.rounded_rectangle([ox + 12, 12, ox + 244, 244], radius=26, outline=ink, width=8)
        cx, cy = ox + 128, 132
        if i == 0:  # a Roman arch on two piers
            d.rectangle([cx - 70, cy - 10, cx - 40, cy + 70], fill=ink)
            d.rectangle([cx + 40, cy - 10, cx + 70, cy + 70], fill=ink)
            d.pieslice([cx - 70, cy - 80, cx + 70, cy + 60], 180, 360, fill=ink)
            d.pieslice([cx - 40, cy - 50, cx + 40, cy + 30], 180, 360, fill=(214, 172, 96))
            d.rectangle([cx - 40, cy - 10, cx + 40, cy + 70], fill=(214, 172, 96))
            d.rectangle([cx - 80, cy + 70, cx + 80, cy + 82], fill=ink)
        elif i == 1:  # folded paper fan
            for k in range(9):
                a0 = math.radians(200 + k * 15.5)
                a1 = math.radians(200 + (k + 1) * 15.5)
                pts = [(cx, cy + 60), (cx + math.cos(a0) * 100, cy + 60 + math.sin(a0) * 100), (cx + math.cos(a1) * 100, cy + 60 + math.sin(a1) * 100)]
                d.polygon(pts, fill=ink if k % 2 == 0 else (120, 82, 40))
            d.ellipse([cx - 10, cy + 50, cx + 10, cy + 70], fill=(214, 172, 96))
        else:  # cacao pod with ridges
            d.ellipse([cx - 44, cy - 80, cx + 44, cy + 80], fill=ink)
            for k in (-24, 0, 24):
                d.line([(cx + k * 0.6, cy - 74), (cx + k, cy), (cx + k * 0.6, cy + 74)], fill=(150, 104, 52), width=6)
            d.line([(cx, cy - 80), (cx + 8, cy - 100)], fill=ink, width=10)
    save(smooth_img(img, 0.7), "p_plates.jpg")


# ============================================================================= stickers
def sticker_base(kind, S=512):
    """Die-cut sticker: soft shadow, thick white border, painted face."""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shape = Image.new("L", (S, S), 0)
    sd = ImageDraw.Draw(shape)
    c = S / 2
    if kind in ("star",):
        pts = []
        for k in range(10):
            a = -math.pi / 2 + k * math.pi / 5
            r = S * (0.47 if k % 2 == 0 else 0.25)
            pts.append((c + math.cos(a) * r, c + 12 + math.sin(a) * r))
        sd.polygon(pts, fill=255)
        shape = shape.filter(ImageFilter.MaxFilter(25)).filter(ImageFilter.GaussianBlur(4))
        shape = shape.point(lambda v: 255 if v > 128 else 0)
    elif kind == "heart-leaf":
        sd.ellipse([S * 0.08, S * 0.12, S * 0.56, S * 0.6], fill=255)
        sd.ellipse([S * 0.44, S * 0.12, S * 0.92, S * 0.6], fill=255)
        sd.polygon([(S * 0.1, S * 0.45), (S * 0.9, S * 0.45), (S * 0.5, S * 0.94)], fill=255)
    elif kind == "sparkle":
        for cx0, cy0, R in ((0.44, 0.56, 0.4), (0.78, 0.22, 0.17)):
            pts = []
            for k in range(8):
                a = -math.pi / 2 + k * math.pi / 4
                r = S * (R if k % 2 == 0 else R * 0.3)
                pts.append((S * cx0 + math.cos(a) * r, S * cy0 + math.sin(a) * r))
            sd.polygon(pts, fill=255)
        shape = shape.filter(ImageFilter.MaxFilter(27)).filter(ImageFilter.GaussianBlur(5)).point(lambda v: 255 if v > 128 else 0)
    else:
        sd.ellipse([S * 0.04, S * 0.04, S * 0.96, S * 0.96], fill=255)
    shadow = shape.filter(ImageFilter.GaussianBlur(10))
    sh = Image.new("RGBA", (S, S), (40, 30, 20, 0))
    sh.putalpha(shadow.point(lambda v: int(v * 0.35)))
    img.alpha_composite(sh, (6, 10))
    white = Image.new("RGBA", (S, S), (255, 252, 244, 255))
    white.putalpha(shape)
    img.alpha_composite(white)
    inner = shape.filter(ImageFilter.MinFilter(29))
    return img, inner


def radial_fill(S, inner, c0, c1, center=(0.4, 0.35)):
    yy, xx = np.mgrid[0:S, 0:S] / S
    r = np.sqrt((xx - center[0]) ** 2 + (yy - center[1]) ** 2) / 0.75
    r = np.clip(r, 0, 1)[..., None]
    rgb = np.array(c0)[None, None] * (1 - r) + np.array(c1)[None, None] * r
    noise = fnoise(S, 1.8, 7)[..., None] * 18 - 9
    a = np.clip(rgb + noise, 0, 255).astype(np.uint8)
    im = Image.fromarray(a).convert("RGBA")
    im.putalpha(inner)
    return im


def face(d, S, mouth="o", eyes="happy"):
    ink = (70, 40, 28, 255)
    for sx in (-1, 1):
        x, y = S / 2 + sx * S * 0.15, S * 0.4
        if eyes == "happy":  # closed smiling arcs
            d.arc([x - S * 0.07, y - S * 0.05, x + S * 0.07, y + S * 0.07], 200, 340, fill=ink, width=int(S * 0.03))
        else:
            d.ellipse([x - S * 0.055, y - S * 0.075, x + S * 0.055, y + S * 0.075], fill=ink)
            d.ellipse([x - S * 0.02, y - S * 0.05, x + S * 0.015, y - S * 0.015], fill=(255, 255, 255, 255))
    for sx in (-1, 1):  # cheeks
        x, y = S / 2 + sx * S * 0.27, S * 0.55
        d.ellipse([x - S * 0.07, y - S * 0.04, x + S * 0.07, y + S * 0.04], fill=(240, 120, 110, 140))
    if mouth == "o":
        d.ellipse([S * 0.43, S * 0.56, S * 0.57, S * 0.74], fill=ink)
        d.ellipse([S * 0.46, S * 0.65, S * 0.54, S * 0.72], fill=(230, 110, 100, 255))
    elif mouth == "laugh":
        d.chord([S * 0.3, S * 0.46, S * 0.7, S * 0.8], 0, 180, fill=ink)
        d.chord([S * 0.38, S * 0.62, S * 0.62, S * 0.8], 0, 180, fill=(230, 110, 100, 255))
        d.rectangle([S * 0.34, S * 0.63, S * 0.66, S * 0.66], fill=(255, 255, 255, 255))


def stickers():
    S = 512
    out = {}
    # wow: golden face, round eyes, "o" mouth, little burst lines
    img, inner = sticker_base("round")
    img.alpha_composite(radial_fill(S, inner, (255, 226, 110), (242, 160, 40)))
    d = ImageDraw.Draw(img)
    face(d, S, "o", "open")
    for k in range(5):
        a = -2.4 + k * 0.3
        d.line([(S / 2 + math.cos(a) * S * 0.3, S * 0.3 + math.sin(a) * S * 0.15),
                (S / 2 + math.cos(a) * S * 0.38, S * 0.3 + math.sin(a) * S * 0.2)], fill=(255, 250, 220, 255), width=10)
    out["wow"] = img
    # heart-leaf: a green heart-shaped leaf with veins
    img, inner = sticker_base("heart-leaf")
    img.alpha_composite(radial_fill(S, inner, (150, 210, 100), (56, 130, 60)))
    d = ImageDraw.Draw(img)
    d.line([(S * 0.5, S * 0.3), (S * 0.5, S * 0.85)], fill=(230, 250, 200, 255), width=10)
    for k in range(4):
        y = S * (0.38 + k * 0.11)
        for sx in (-1, 1):
            d.line([(S * 0.5, y + S * 0.05), (S * 0.5 + sx * S * (0.25 - k * 0.04), y - S * 0.04)], fill=(220, 245, 190, 220), width=7)
    d.ellipse([S * 0.2, S * 0.2, S * 0.34, S * 0.3], fill=(255, 255, 240, 120))
    out["heart-leaf"] = img
    # star
    img, inner = sticker_base("star")
    img.alpha_composite(radial_fill(S, inner, (255, 236, 130), (246, 170, 30)))
    d = ImageDraw.Draw(img)
    d.ellipse([S * 0.36, S * 0.3, S * 0.46, S * 0.36], fill=(255, 255, 240, 160))
    face(d, S, "smile", "happy")
    d.arc([S * 0.42, S * 0.5, S * 0.58, S * 0.62], 20, 160, fill=(70, 40, 28, 255), width=12)
    out["star"] = img
    # sparkle: magenta-violet four-point twinkle with a small companion
    img, inner = sticker_base("sparkle")
    img.alpha_composite(radial_fill(S, inner, (190, 236, 255), (120, 110, 236), center=(0.44, 0.56)))
    d = ImageDraw.Draw(img)
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for cx0, cy0, r in ((0.44, 0.56, 0.12), (0.78, 0.22, 0.05)):
        gd.ellipse([S * (cx0 - r), S * (cy0 - r), S * (cx0 + r), S * (cy0 + r)], fill=(255, 255, 255, 230))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(14)))
    out["sparkle"] = img
    # laugh: orange face, happy eyes, big open laugh
    img, inner = sticker_base("round")
    img.alpha_composite(radial_fill(S, inner, (255, 196, 120), (238, 120, 60)))
    d = ImageDraw.Draw(img)
    face(d, S, "laugh", "happy")
    out["laugh"] = img
    # clap: two warm hands meeting, motion marks
    img, inner = sticker_base("round")
    img.alpha_composite(radial_fill(S, inner, (140, 220, 230), (60, 150, 190)))
    d = ImageDraw.Draw(img)
    hand = (255, 206, 160, 255)
    edge = (190, 120, 80, 255)
    for sx in (-1, 1):
        cx = S / 2 + sx * S * 0.08
        poly = [(cx, S * 0.78), (cx + sx * S * 0.16, S * 0.72), (cx + sx * S * 0.2, S * 0.42), (cx + sx * S * 0.13, S * 0.24),
                (cx + sx * S * 0.02, S * 0.22), (cx - sx * S * 0.02, S * 0.5)]
        d.polygon(poly, fill=hand, outline=edge)
        d.line(poly + [poly[0]], fill=edge, width=8)
        for k in range(3):
            y = S * (0.3 + k * 0.08)
            d.line([(cx + sx * S * 0.04, y), (cx + sx * S * 0.15, y + S * 0.02)], fill=edge, width=5)
    for sx in (-1, 1):
        for k in range(3):
            a = -1.57 + sx * (0.5 + k * 0.35)
            d.line([(S / 2 + math.cos(a) * S * 0.3, S * 0.48 + math.sin(a) * S * 0.3),
                    (S / 2 + math.cos(a) * S * 0.4, S * 0.48 + math.sin(a) * S * 0.4)], fill=(255, 250, 220, 255), width=10)
    out["clap"] = img
    atlas = Image.new("RGBA", (768, 512), (0, 0, 0, 0))
    for i, (k, im) in enumerate(out.items()):
        small = im.resize((128, 128), Image.LANCZOS)
        small.save(os.path.join(STK, f"sticker_{k}.png"), optimize=True)
        atlas.alpha_composite(im.resize((256, 256), Image.LANCZOS), ((i % 3) * 256, (i // 3) * 256))
        print("sticker", k)
    atlas.save(os.path.join(OUT, "p_stickers.png"), optimize=True)


if __name__ == "__main__":
    soil(); washi(); timber(); bamboo(); lime(); ash(); concrete(); foam(); cork(); cacao_skin(); sunflower_disc()
    monarch_wing(); clear_wing(); autumn_leaves(); seed_packets(); crate_labels(); boards(); badges(); display_plates(); stickers()
