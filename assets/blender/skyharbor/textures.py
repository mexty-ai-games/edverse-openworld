"""Painted textures for Skyharbor (EdVerse OpenWorld), generated from scratch with numpy + Pillow.

python3 textures.py <out_dir>
Reuses the Idea Grove's noise helpers (../textures.py: Fourier tileable noise, periodic Voronoi,
painted leaf shapes). Night palette: slate rock, warm flagstones, brass and copper, teal/violet glow.
Nothing is sampled from a photo or another game.
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "build", "tex")
_argv = sys.argv
sys.argv = [sys.argv[0], OUT]
import textures as G  # noqa: E402  (the hub's helpers; its OUT follows ours)
sys.argv = _argv

fnoise, ramp, voronoi, to_img, normal_from_height, wrap_draw, leaf_shape = (
    G.fnoise, G.ramp, G.voronoi, G.to_img, G.normal_from_height, G.wrap_draw, G.leaf_shape)
os.makedirs(OUT, exist_ok=True)


def save(img, name, quality=88):
    p = os.path.join(OUT, name)
    if name.endswith(".jpg"):
        img.convert("RGB").save(p, quality=quality, optimize=True)
    else:
        img.save(p, optimize=True)
    print("wrote", p, os.path.getsize(p))


# ----------------------------------------------------------------------------- ground: plateau flagstones
def paving(n=1024, seed=201):
    f1, f2, cid, k = voronoi(n, 64, seed, 0.75)
    edge = f2 - f1
    rng = np.random.default_rng(seed)
    tone = rng.uniform(0, 1, k)[cid]
    nz = fnoise(n, 1.9, seed + 1)
    fine = fnoise(n, 1.0, seed + 2)
    v = np.clip(tone * 0.4 + nz * 0.45 + fine * 0.15, 0, 1)
    rgb = ramp(v, [(0, (92, 78, 70)), (0.4, (128, 108, 92)), (0.75, (156, 132, 108)), (1, (182, 158, 126))])
    grout = np.clip(edge / 8.0, 0, 1)
    moss = ramp(fnoise(n, 1.4, seed + 3), [(0, (34, 58, 46)), (1, (64, 92, 58))])
    rgb = rgb * (0.6 + 0.4 * np.clip(edge / 20.0, 0, 1))[..., None]
    rgb = rgb * grout[..., None] + moss * (1 - grout[..., None])
    save(to_img(rgb).filter(ImageFilter.SMOOTH), "sh_paving.jpg")
    h = np.clip(edge / 12.0, 0, 1) * 0.75 + nz * 0.25
    save(to_img(normal_from_height(h, 3.0)), "sh_paving_n.jpg")


def moss(n=1024, seed=211):
    """Night meadow on the plateau: blue-green moss and short grass, a few pale star-flowers."""
    big = fnoise(n, 2.2, seed)
    mid = fnoise(n, 1.5, seed + 1)
    v = big * 0.6 + mid * 0.4
    rgb = ramp(v, [(0, (26, 52, 44)), (0.4, (40, 76, 54)), (0.7, (62, 100, 62)), (1, (92, 122, 70))])
    img = to_img(rgb).convert("RGBA")
    rng = random.Random(seed)
    pal = [(34, 70, 50), (52, 96, 60), (78, 120, 66), (24, 54, 44), (98, 136, 80)]
    for _ in range(22000):
        x, y = rng.random() * n, rng.random() * n
        L = rng.uniform(5, 12)
        a = -math.pi / 2 + rng.uniform(-0.7, 0.7)
        c = rng.choice(pal)
        al = rng.randint(90, 190)

        def blade(d, ox, oy, x=x, y=y, L=L, a=a, c=c, al=al):
            d.line([(x + ox, y + oy), (x + ox + math.cos(a) * L, y + oy + math.sin(a) * L)], fill=c + (al,), width=1)

        if x < 16 or y < 16 or x > n - 16 or y > n - 16:
            wrap_draw(img, blade)
        else:
            blade(ImageDraw.Draw(img, "RGBA"), 0, 0)
    for _ in range(180):
        x, y = rng.random() * n, rng.random() * n
        c = rng.choice([(150, 230, 220), (200, 170, 255), (240, 230, 200)])
        r = rng.uniform(1.0, 2.0)
        ImageDraw.Draw(img, "RGBA").ellipse([x - r, y - r, x + r, y + r], fill=c + (210,))
    save(img.filter(ImageFilter.SMOOTH).convert("RGB"), "sh_moss.jpg")


# ----------------------------------------------------------------------------- cliff rock (layered slate)
def cliff_rock(n=1024, seed=221):
    strata = fnoise(n, 1.8, seed, aniso=(5.0, 0.15))
    blocks = fnoise(n, 2.1, seed + 1)
    fine = fnoise(n, 1.1, seed + 2)
    cr = np.clip(np.abs(fnoise(n, 1.9, seed + 3, aniso=(2.0, 0.4)) - 0.5) * 12, 0, 1)
    v = strata * 0.45 + blocks * 0.35 + fine * 0.2
    rgb = ramp(v, [(0, (46, 50, 62)), (0.35, (70, 72, 84)), (0.6, (98, 96, 104)), (0.85, (128, 122, 122)), (1, (156, 146, 138))])
    rgb *= (0.7 + 0.3 * cr)[..., None]
    lich = fnoise(n, 1.3, seed + 4) > 0.72
    rgb = np.where(lich[..., None], rgb * np.array([0.85, 1.05, 1.0]), rgb)
    save(to_img(rgb), "sh_rock.jpg")
    save(to_img(normal_from_height(v * 0.6 + cr * 0.4, 5.0)), "sh_rock_n.jpg")


# ----------------------------------------------------------------------------- masonry (observatory tower)
def masonry(n=1024, seed=231):
    yy, xx = np.mgrid[0:n, 0:n] / n
    rows = 8
    r = np.floor(yy * rows)
    off = (r % 2) * 0.5
    cols = 4
    c = np.floor(xx * cols + off)
    rng = np.random.default_rng(seed)
    tone = rng.uniform(0, 1, (rows + 1, cols + 2))[r.astype(int), c.astype(int) % (cols + 2)]
    fy = (yy * rows) % 1.0
    fx = (xx * cols + off) % 1.0
    edge = np.minimum(np.minimum(fy, 1 - fy) * 7, np.minimum(fx, 1 - fx) * 14)
    edge = np.clip(edge, 0, 1)
    nz = fnoise(n, 1.8, seed + 1)
    v = tone * 0.35 + nz * 0.65
    rgb = ramp(v, [(0, (70, 66, 76)), (0.45, (100, 94, 98)), (0.8, (130, 120, 116)), (1, (158, 146, 134))])
    rgb *= (0.45 + 0.55 * edge ** 0.6)[..., None]
    moss = fnoise(n, 1.5, seed + 2)
    mm = np.clip((moss - 0.62) * 5 * (1 - yy) ** 0.5, 0, 1)
    rgb = rgb * (1 - mm[..., None]) + np.array([0.18, 0.3, 0.22]) * mm[..., None]
    save(to_img(rgb), "sh_masonry.jpg")
    save(to_img(normal_from_height(edge ** 0.5 * 0.7 + nz * 0.3, 4.0)), "sh_masonry_n.jpg")


# ----------------------------------------------------------------------------- weathered dark wood
def wood(n=1024, seed=241):
    yy, xx = np.mgrid[0:n, 0:n] / n
    planks = 6
    pid = np.floor(yy * planks).astype(int)
    rng = np.random.default_rng(seed)
    shift = rng.random(planks)[pid]
    warp = fnoise(n, 2.2, seed, aniso=(0.5, 4.0)) * 0.08
    grain = np.sin((yy * planks * 9 + warp * 60 + shift * 7) * math.pi * 2) * 0.5 + 0.5
    knots = fnoise(n, 2.4, seed + 3, aniso=(0.4, 3.0))
    tone = rng.uniform(0, 1, planks)[pid]
    v = grain * 0.35 + knots * 0.35 + tone * 0.3
    rgb = ramp(v, [(0, (70, 40, 24)), (0.4, (108, 64, 36)), (0.7, (138, 86, 48)), (1, (170, 112, 64))])
    seam = np.clip((1 - np.abs(((yy * planks) % 1.0) - 0.5) * 2) * 18, 0, 1)
    rgb *= (0.35 + 0.65 * seam)[..., None]
    # nail heads at the plank ends
    img = to_img(rgb)
    d = ImageDraw.Draw(img)
    for p in range(planks):
        for xn in (0.06, 0.94):
            for dy in (0.3, 0.7):
                cx, cy = xn * n, (p + dy) * n / planks
                d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(60, 50, 44))
                d.ellipse([cx - 2, cy - 3, cx + 1, cy], fill=(150, 140, 120))
    save(img, "sh_wood.jpg")
    save(to_img(normal_from_height(grain * 0.3 + seam * 0.7, 3.0)), "sh_wood_n.jpg")


# ----------------------------------------------------------------------------- metals
def brass(n=512, seed=251):
    v = fnoise(n, 1.6, seed, aniso=(4, 0.5)) * 0.7 + fnoise(n, 1.2, seed + 1) * 0.3
    rgb = ramp(v, [(0, (122, 84, 36)), (0.5, (184, 136, 62)), (1, (232, 192, 108))])
    pat = np.clip((fnoise(n, 1.4, seed + 2) - 0.66) * 4, 0, 1)
    rgb = rgb * (1 - pat[..., None] * 0.7) + np.array([0.36, 0.56, 0.48]) * pat[..., None] * 0.7
    save(to_img(rgb), "sh_brass.jpg")


def copper(n=512, seed=261):
    v = fnoise(n, 1.7, seed) * 0.6 + fnoise(n, 1.0, seed + 1) * 0.4
    rgb = ramp(v, [(0, (110, 52, 32)), (0.5, (170, 88, 52)), (1, (214, 134, 86))])
    yy = np.mgrid[0:n, 0:n][0] / n
    streak = np.clip((fnoise(n, 1.5, seed + 2, aniso=(3, 0.3)) - 0.55) * 3, 0, 1) * (0.4 + 0.6 * yy)
    rgb = rgb * (1 - streak[..., None]) + np.array([0.3, 0.62, 0.54]) * streak[..., None]
    save(to_img(rgb), "sh_copper.jpg")


def robot_paint(n=512, seed=271):
    """Cream enamel with soft wear: the robot's shell (tinted per part in the material)."""
    v = 0.86 + 0.08 * fnoise(n, 2.0, seed) + 0.04 * fnoise(n, 1.0, seed + 1)
    rgb = np.stack([v, v * 0.97, v * 0.9], -1)
    img = to_img(rgb)
    d = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    for _ in range(140):
        x, y = rng.random() * n, rng.random() * n
        L = rng.uniform(3, 14)
        a = rng.uniform(0, math.pi)
        d.line([(x, y), (x + math.cos(a) * L, y + math.sin(a) * L)], fill=(120, 100, 80, 70), width=1)
    save(img, "sh_paint.jpg")


# ----------------------------------------------------------------------------- canvas sail
def canvas(n=1024, seed=281):
    yy, xx = np.mgrid[0:n, 0:n] / n
    weave = (np.sin(xx * math.pi * 260) * np.sin(yy * math.pi * 260)) * 0.5 + 0.5
    v = fnoise(n, 1.8, seed) * 0.6 + weave * 0.15 + fnoise(n, 1.0, seed + 1) * 0.25
    rgb = ramp(v, [(0, (178, 164, 136)), (0.6, (212, 200, 170)), (1, (232, 222, 196))])
    seams = (np.abs(((xx * 5) % 1.0) - 0.5) > 0.485)
    rgb = np.where(seams[..., None], rgb * 0.78, rgb)
    img = to_img(rgb)
    d = ImageDraw.Draw(img, "RGBA")
    # emblem: a star inside a gear ring (no letters)
    cx, cy, R = n * 0.5, n * 0.48, n * 0.18
    teeth = 14
    pts = []
    for k in range(teeth * 2):
        a = k * math.pi / teeth
        r = R * (1.12 if (k // 1) % 2 == 0 else 0.98)
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    d.polygon(pts, fill=(70, 120, 140, 200))
    d.ellipse([cx - R * 0.82, cy - R * 0.82, cx + R * 0.82, cy + R * 0.82], fill=(214, 202, 172, 255))
    star = []
    for k in range(10):
        r = R * (0.7 if k % 2 == 0 else 0.3)
        a = -math.pi / 2 + k * math.pi / 5
        star.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    d.polygon(star, fill=(204, 140, 52, 230))
    # a couple of patches
    for (px, py, w, h) in ((0.18, 0.75, 0.12, 0.09), (0.74, 0.2, 0.1, 0.12)):
        d.rectangle([px * n, py * n, (px + w) * n, (py + h) * n], fill=(190, 170, 130, 160), outline=(120, 100, 80, 200), width=3)
    save(img.filter(ImageFilter.SMOOTH), "sh_canvas.jpg")


# ----------------------------------------------------------------------------- glowing things
def window_glow(n=256, seed=291):
    yy, xx = np.mgrid[0:n, 0:n] / n
    g = 1 - np.hypot(xx - 0.5, (yy - 0.6) * 0.8) * 1.4
    rgb = ramp(np.clip(g, 0, 1), [(0, (200, 100, 40)), (0.5, (255, 170, 80)), (1, (255, 236, 180))])
    mull = (np.abs(xx - 0.5) < 0.035) | (np.abs(yy - 0.45) < 0.03)
    rgb = np.where(mull[..., None], rgb * 0.18, rgb)
    save(to_img(rgb), "sh_window.jpg")


def robot_face(n=256):
    """The robot's screen face: two big friendly eyes and a smile on dark glass (emissive)."""
    img = Image.new("RGB", (n, n), (10, 26, 32))
    d = ImageDraw.Draw(img)
    for x in (0.32, 0.68):
        cx, cy, r = x * n, 0.44 * n, 0.12 * n
        d.ellipse([cx - r * 1.3, cy - r * 1.3, cx + r * 1.3, cy + r * 1.3], fill=(18, 70, 80))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(110, 250, 236))
        d.ellipse([cx - r * 0.35 + r * 0.25, cy - r * 0.55, cx + r * 0.1 + r * 0.25, cy - r * 0.1], fill=(240, 255, 255))
    d.arc([0.36 * n, 0.5 * n, 0.64 * n, 0.74 * n], 20, 160, fill=(110, 250, 236), width=int(n * 0.035))
    for x in (0.2, 0.8):
        d.ellipse([x * n - 12, 0.64 * n - 7, x * n + 12, 0.64 * n + 7], fill=(255, 140, 170))
    save(img.filter(ImageFilter.SMOOTH), "sh_face.jpg")


def glow_atlas(n=1024, seed=301):
    """Alpha atlas of bioluminescent foliage, 4 quadrants: teal fronds, violet bells, green blades, cyan caps.
    sh_glow.png is the colour, sh_glow_e.jpg the light it gives (veins and tips)."""
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    em = Image.new("RGB", (n, n), (0, 0, 0))
    d = ImageDraw.Draw(img)
    de = ImageDraw.Draw(em)
    rng = random.Random(seed)
    q = n // 2
    # q0: teal glow fern fronds
    ox, oy = 0, 0
    for i in range(7):
        bx = ox + q * (0.2 + i * 0.1)
        by = oy + q * 0.98
        ang = -math.pi / 2 + (i - 3) * 0.16
        L = q * rng.uniform(0.7, 0.9)
        for s in range(26):
            t = s / 26
            x = bx + math.cos(ang) * L * t + math.sin(t * 3) * 6
            y = by + math.sin(ang) * L * t
            size = (1 - t) * 34 + 8
            for side in (-1, 1):
                a = ang + side * 1.1
                col = (30, int(120 + 80 * t), int(120 + 70 * t), 255)
                leaf_shape(d, x, y, size, size * 0.32, a, col, vein=False)
                de.line([(x, y), (x + math.cos(a) * size * 0.9, y + math.sin(a) * size * 0.9)], fill=(40, int(150 + 90 * t), 170), width=2)
        d.line([(bx, by), (bx + math.cos(ang) * L, by + math.sin(ang) * L)], fill=(30, 90, 80, 255), width=4)
    # q1: violet bell flowers on curved stems
    ox, oy = q, 0
    for i in range(9):
        bx = ox + q * rng.uniform(0.15, 0.85)
        by = oy + q * 0.98
        hx, hy = bx + rng.uniform(-60, 60), oy + q * rng.uniform(0.12, 0.5)
        d.line([(bx, by), ((bx + hx) / 2 + 20, (by + hy) / 2), (hx, hy)], fill=(50, 90, 70, 255), width=4, joint="curve")
        for _ in range(2):
            t = rng.uniform(0.4, 0.8)
            leaf_shape(d, bx + (hx - bx) * t, by + (hy - by) * t, rng.uniform(40, 60), 12, -math.pi / 2 + rng.choice((-1, 1)) * 0.9, (44, 96, 76, 255))
        r = rng.uniform(26, 40)
        d.pieslice([hx - r, hy - r * 0.4, hx + r, hy + r * 1.6], 180, 360, fill=(150, 80, 220, 255))
        d.polygon([(hx - r, hy + r * 0.6), (hx + r, hy + r * 0.6), (hx + r * 0.8, hy + r * 0.95), (hx, hy + r * 0.75), (hx - r * 0.8, hy + r * 0.95)], fill=(176, 104, 240, 255))
        d.ellipse([hx - r * 0.5, hy - r * 0.1, hx + r * 0.1, hy + r * 0.3], fill=(220, 180, 255, 255))
        de.ellipse([hx - r * 0.9, hy - r * 0.2, hx + r * 0.9, hy + r * 0.95], fill=(170, 90, 255))
        de.ellipse([hx - 6, hy + r * 0.8, hx + 6, hy + r * 1.1], fill=(255, 220, 140))
    # q2: tall green-teal blades with glowing tips
    ox, oy = 0, q
    for i in range(40):
        bx = ox + q * rng.uniform(0.08, 0.92)
        top = oy + q * rng.uniform(0.05, 0.5)
        lean = rng.uniform(-50, 50)
        col = (rng.randint(30, 60), rng.randint(110, 170), rng.randint(90, 130), 255)
        w = rng.uniform(8, 16)
        d.polygon([(bx - w, oy + q), (bx + w, oy + q), (bx + lean + 2, top), (bx + lean - 2, top)], fill=col)
        de.line([(bx + lean * 0.8, top + (oy + q - top) * 0.2), (bx + lean, top)], fill=(120, 255, 200), width=5)
    # q3: cyan glowing mushroom caps
    ox, oy = q, q
    for i in range(6):
        cx = ox + q * (0.15 + i * 0.14) + rng.uniform(-10, 10)
        top = oy + q * rng.uniform(0.25, 0.6)
        r = rng.uniform(40, 70)
        d.rectangle([cx - r * 0.16, top, cx + r * 0.16, oy + q], fill=(200, 210, 200, 255))
        d.pieslice([cx - r, top - r * 0.7, cx + r, top + r * 0.7], 180, 360, fill=(40, 170, 200, 255))
        for _ in range(5):
            sx, sy = cx + rng.uniform(-r * 0.6, r * 0.6), top - rng.uniform(r * 0.1, r * 0.5)
            d.ellipse([sx - 5, sy - 4, sx + 5, sy + 4], fill=(190, 250, 255, 255))
        de.pieslice([cx - r, top - r * 0.7, cx + r, top + r * 0.7], 180, 360, fill=(30, 200, 230))
        de.rectangle([cx - r * 0.1, top, cx + r * 0.1, top + 30], fill=(80, 140, 150))
    save(img.filter(ImageFilter.SMOOTH), "sh_glow.png")
    save(em.filter(ImageFilter.GaussianBlur(2)), "sh_glow_e.jpg")


def leaves_night(n=1024, seed=311):
    """Leaf-card atlas for the cliff-edge trees and vines (deep green, moonlit tips)."""
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(seed)
    q = n // 2
    pals = [[(30, 64, 46), (42, 84, 54), (60, 104, 62), (86, 128, 76)],
            [(26, 58, 50), (38, 78, 62), (54, 100, 74), (80, 126, 90)],
            [(34, 70, 44), (48, 92, 52), (70, 114, 60), (100, 140, 74)],
            [(28, 60, 54), (40, 82, 66), (58, 104, 78), (90, 134, 96)]]
    for qi in range(4):
        ox, oy = (qi % 2) * q, (qi // 2) * q
        cx, cy = ox + q / 2, oy + q / 2
        pts = []
        for _ in range(220):
            r = q * 0.45 * math.sqrt(rng.random())
            a = rng.random() * math.pi * 2
            pts.append((cy + math.sin(a) * r * 0.85, cx + math.cos(a) * r))
        pts.sort()
        for i, (y, x) in enumerate(pts):
            base = pals[qi][min(3, int(i / len(pts) * 4))]
            col = tuple(min(255, int(c * rng.uniform(0.85, 1.1))) for c in base) + (255,)
            L = rng.uniform(32, 56)
            leaf_shape(d, x, y, L, L * rng.uniform(0.3, 0.4), rng.uniform(0, 6.28), col)
    save(img.filter(ImageFilter.SMOOTH), "sh_leaves.png")


def portal(n=512, seed=321):
    """The exit gate's swirl (emissive): warm gold at the rim, teal toward the middle."""
    yy, xx = np.mgrid[0:n, 0:n] / n - 0.5
    r = np.hypot(xx, yy) * 2
    a = np.arctan2(yy, xx)
    sw = np.sin(a * 3 + r * 9 + fnoise(n, 2.0, seed) * 4) * 0.5 + 0.5
    v = np.clip(sw * 0.5 + (1 - r) * 0.6, 0, 1)
    rgb = ramp(v, [(0, (40, 30, 70)), (0.4, (60, 150, 170)), (0.75, (180, 230, 210)), (1, (255, 236, 170))])
    rgb *= np.clip(1.2 - r * 0.2, 0, 1)[..., None]
    save(to_img(rgb), "sh_portal.jpg")


def grove_sign(n=512, seed=331):
    """Round sign over the exit gate: the Idea Grove's tree and lantern, no words."""
    img = Image.new("RGB", (n, n), (52, 40, 30))
    d = ImageDraw.Draw(img)
    c = n / 2
    d.ellipse([n * 0.04, n * 0.04, n * 0.96, n * 0.96], fill=(196, 150, 72))
    d.ellipse([n * 0.1, n * 0.1, n * 0.9, n * 0.9], fill=(38, 52, 84))
    d.rectangle([c - n * 0.04, n * 0.5, c + n * 0.04, n * 0.8], fill=(120, 76, 44))
    for (dx, dy, r) in ((0, -0.08, 0.22), (-0.16, 0.02, 0.15), (0.16, 0.02, 0.15), (0, 0.1, 0.14)):
        d.ellipse([c + (dx - r) * n, c + (dy - r) * n, c + (dx + r) * n, c + (dy + r) * n], fill=(70, 140, 70))
    for (dx, dy) in ((-0.14, 0.12), (0.15, 0.1), (0.02, -0.12)):
        d.ellipse([c + dx * n - 14, c + dy * n - 14, c + dx * n + 14, c + dy * n + 14], fill=(255, 200, 90))
    d.rectangle([n * 0.25, n * 0.79, n * 0.75, n * 0.83], fill=(120, 76, 44))
    save(img.filter(ImageFilter.SMOOTH), "sh_sign.jpg")


if __name__ == "__main__":
    grove_sign()
    paving()
    moss()
    cliff_rock()
    masonry()
    wood()
    brass()
    copper()
    robot_paint()
    canvas()
    window_glow()
    robot_face()
    glow_atlas()
    leaves_night()
    portal()
