"""Painted textures for phase 2 "Catch, measure, dig" (tools, Bug Games creatures, arena, dig site v2).

python3 textures.py <out_dir>     (numpy + Pillow, all original)
paint.jpg   soft brush strokes, near white: vertex colours carry the colour (creatures, tools)
chitin.jpg  glossy shell with faint dimples (beetles, ants), near white
wood.jpg    warm painted planks; wood_n.jpg its normal map
sand.jpg    raked long-jump sand
soil0..3    the dig strata: humus with rootlets, red clay with pebbles, banded sandstone, grey shale
rock.jpg    fossil matrix stone, near white (tinted per fossil)
netmesh.png butterfly-net mesh (alpha)
leafcard.png 2x2 atlas of painted leaves (alpha) for the camouflage board
fabric.jpg  woven pennant cloth, near white
slate.jpg   scoreboard slate (dark green, chalk dust): default of the in-game text slot
night.jpg   deep blue night-box lining with painted stars
bark.jpg    twig bark, near white grey-brown (stick insect camouflage)
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "build/tex"
os.makedirs(OUT, exist_ok=True)


def fnoise(n, beta=2.0, seed=0, aniso=(1.0, 1.0), lo=1.0, h=None):
    h = h or n
    rng = np.random.default_rng(seed)
    w = rng.standard_normal((h, n))
    fx = np.fft.fftfreq(n)[None, :] * n * aniso[0]
    fy = np.fft.fftfreq(h)[:, None] * h * aniso[1]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    amp = 1.0 / np.maximum(f, lo) ** beta
    amp[0, 0] = 0
    out = np.real(np.fft.ifft2(np.fft.fft2(w) * amp))
    out -= out.min()
    out /= out.max() + 1e-9
    return out


def tint(v, lo, hi):
    lo, hi = np.array(lo, float), np.array(hi, float)
    return lo[None, None] + (hi - lo)[None, None] * v[..., None]


def save(a, name, q=86):
    if isinstance(a, np.ndarray):
        a = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    p = os.path.join(OUT, name)
    if name.endswith(".png"):
        a.save(p, optimize=True)
    else:
        a.convert("RGB").save(p, quality=q)
    print("wrote", name, os.path.getsize(p))


def normal_from_height(h, s=3.0):
    gy, gx = np.gradient(h)
    nx, ny, nz = -gx * s * h.shape[0] / 64, -gy * s * h.shape[0] / 64, np.ones_like(h)
    L = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / L * 0.5 + 0.5, ny / L * 0.5 + 0.5, nz / L * 0.5 + 0.5], -1)


def paint(n=512):
    v = 0.55 * fnoise(n, 1.6, 1) + 0.45 * fnoise(n, 2.4, 2, aniso=(1.0, 3.0))
    save(tint(v, (0.82, 0.8, 0.77), (1.0, 0.99, 0.97)), "paint.jpg")


def chitin(n=512):
    rng = np.random.default_rng(3)
    yy, xx = np.mgrid[0:n, 0:n]
    d = np.zeros((n, n))
    for _ in range(260):
        cx, cy, r = rng.integers(0, n), rng.integers(0, n), rng.uniform(3, 7)
        dx = (xx - cx + n / 2) % n - n / 2
        dy = (yy - cy + n / 2) % n - n / 2
        d += np.exp(-(dx * dx + dy * dy) / (r * r))
    v = 0.86 + 0.1 * fnoise(n, 2.2, 4) - 0.05 * np.clip(d, 0, 1)
    save(tint(v, (0.0, 0.0, 0.0), (1.0, 0.99, 0.97)), "chitin.jpg")


def wood(n=512):
    """Planks running along U, 4 per tile, painted grain, soft dark gaps, worn lighter edges."""
    yy, xx = np.mgrid[0:n, 0:n] / n
    grain = fnoise(n, 1.3, 5, aniso=(0.08, 1.0), lo=2)
    knots = fnoise(n, 2.6, 6)
    plank = (yy * 4) % 1.0
    idx = np.floor(yy * 4)
    shade_p = 0.9 + 0.1 * np.sin(idx * 2.3)
    edge = np.minimum(plank, 1 - plank)
    gap = np.clip(edge / 0.025, 0, 1) ** 0.6
    wear = np.clip(1 - edge / 0.08, 0, 1) * 0.12
    v = (0.6 * grain + 0.4 * knots) * shade_p
    col = tint(v, (0.50, 0.30, 0.16), (0.86, 0.62, 0.38))
    col = col * gap[..., None] + wear[..., None]
    save(col, "wood.jpg")
    h = gap * 0.6 + grain * 0.4
    save(normal_from_height(h, 2.0), "wood_n.jpg")


def sand(n=512):
    yy, xx = np.mgrid[0:n, 0:n] / n
    rake = 0.5 + 0.5 * np.sin(yy * math.pi * 2 * 10 + fnoise(n, 2.5, 7) * 3)
    grit = np.random.default_rng(8).random((n, n))
    v = 0.55 + 0.18 * rake + 0.15 * fnoise(n, 2.0, 9) + 0.08 * (grit - 0.5)
    save(tint(np.clip(v, 0, 1), (0.62, 0.48, 0.3), (1.0, 0.9, 0.68)), "sand.jpg")


def pebbles(img, rng, count, cmin, cmax, rmin, rmax):
    d = ImageDraw.Draw(img)
    n = img.size[0]
    for _ in range(count):
        x, y, r = rng.uniform(0, n), rng.uniform(0, n), rng.uniform(rmin, rmax)
        k = rng.uniform(0, 1)
        c = tuple(int(a + (b - a) * k + rng.uniform(-6, 6)) for a, b in zip(cmin, cmax))
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                d.ellipse((x + ox - r, y + oy - r * 0.75, x + ox + r, y + oy + r * 0.75), fill=c)
                d.ellipse((x + ox - r * 0.5, y + oy - r * 0.6, x + ox + r * 0.1, y + oy - r * 0.1),
                          fill=tuple(min(255, k + 30) for k in c))


def soils(n=512):
    rng = np.random.default_rng(10)
    # 0 humus: dark, crumbly, rootlets
    v = 0.6 * fnoise(n, 1.8, 11) + 0.4 * fnoise(n, 1.0, 12, lo=6)
    img = Image.fromarray((np.clip(tint(v, (0.17, 0.11, 0.07), (0.42, 0.3, 0.19)), 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    for _ in range(40):
        x, y = rng.uniform(0, n), rng.uniform(0, n)
        pts = [(x, y)]
        a = rng.uniform(1.2, 1.9)
        for k in range(10):
            a += rng.uniform(-0.4, 0.4)
            x, y = x + math.cos(a) * 9, y + math.sin(a) * 9
            pts.append((x, y))
        d.line(pts, fill=(150, 112, 74), width=2)
    pebbles(img, rng, 30, (90, 80, 70), (140, 125, 110), 3, 7)
    save(img.filter(ImageFilter.SMOOTH), "soil0.jpg")
    # 1 red clay, smooth with pebbles
    v = 0.7 * fnoise(n, 2.2, 13) + 0.3 * fnoise(n, 1.4, 14, aniso=(0.3, 1.0))
    img = Image.fromarray((np.clip(tint(v, (0.55, 0.27, 0.15), (0.82, 0.48, 0.3)), 0, 1) * 255).astype(np.uint8))
    pebbles(img, rng, 70, (150, 130, 110), (215, 200, 180), 3, 10)
    save(img.filter(ImageFilter.SMOOTH), "soil1.jpg")
    # 2 banded sandstone (bands run along U so they read as strata)
    yy = np.mgrid[0:n, 0:n][0] / n
    band = 0.5 + 0.5 * np.sin(yy * math.pi * 2 * 6 + fnoise(n, 2.0, 15) * 4)
    v = 0.5 * band + 0.5 * fnoise(n, 1.6, 16)
    save(tint(v, (0.72, 0.56, 0.36), (0.96, 0.84, 0.6)), "soil2.jpg")
    # 3 grey-blue shale, fine laminations + flakes
    lam = 0.5 + 0.5 * np.sin(yy * math.pi * 2 * 22 + fnoise(n, 2.2, 17) * 6)
    v = 0.35 * lam + 0.65 * fnoise(n, 1.7, 18)
    img = Image.fromarray((np.clip(tint(v, (0.3, 0.33, 0.38), (0.6, 0.63, 0.66)), 0, 1) * 255).astype(np.uint8))
    save(img.filter(ImageFilter.SMOOTH), "soil3.jpg")


def rock(n=512):
    v = 0.5 * fnoise(n, 1.8, 19) + 0.3 * fnoise(n, 1.0, 20, lo=10) + 0.2 * fnoise(n, 2.6, 21)
    save(tint(v, (0.68, 0.66, 0.62), (1.0, 0.98, 0.94)), "rock.jpg")


def bark(n=512):
    v = 0.6 * fnoise(n, 1.2, 22, aniso=(1.0, 0.1), lo=2) + 0.4 * fnoise(n, 2.2, 23)
    save(tint(v, (0.55, 0.5, 0.42), (1.0, 0.97, 0.9)), "bark.jpg")


def netmesh(n=256):
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = 16
    for i in range(k + 1):
        x = i * n / k
        d.line((x, 0, x, n), fill=(250, 248, 240, 255), width=3)
        d.line((0, x, n, x), fill=(250, 248, 240, 255), width=3)
    save(img, "netmesh.png")


def leaf(d, cx, cy, L, W, ang, col, vein):
    pts = []
    for k in range(25):
        t = k / 24
        w = W * math.sin(math.pi * t) ** 0.8
        pts.append((t * L - L / 2, w))
    pts += [(x, -y) for x, y in reversed(pts)]
    ca, sa = math.cos(ang), math.sin(ang)
    P = [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts]
    d.polygon(P, fill=col)
    d.line([(cx - L / 2 * ca, cy - L / 2 * sa), (cx + L / 2 * ca, cy + L / 2 * sa)], fill=vein, width=4)
    for k in range(1, 6):
        t = k / 6 - 0.5
        bx, by = cx + t * L * ca, cy + t * L * sa
        for s in (-1, 1):
            ex = bx + (L * 0.12) * ca - s * (W * 0.7) * sa
            ey = by + (L * 0.12) * sa + s * (W * 0.7) * ca
            d.line([(bx, by), (ex, ey)], fill=vein, width=2)


def leafcard(n=1024):
    """2x2 atlas: green, yellow-green, olive, autumn-brown leaf (+ stem), alpha."""
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cols = [((78, 140, 58, 255), (150, 200, 110, 255)), ((128, 170, 60, 255), (190, 220, 120, 255)),
            ((98, 112, 52, 255), (160, 170, 100, 255)), ((150, 104, 52, 255), (210, 170, 110, 255))]
    h = n // 2
    for q, (c, v) in enumerate(cols):
        x0, y0 = (q % 2) * h, (q // 2) * h
        leaf(d, x0 + h / 2, y0 + h / 2, h * 0.88, h * 0.3, -math.pi / 2 + 0.0, c, v)
    arr = np.asarray(img).astype(np.float32) / 255
    sh = fnoise(n, 2.0, 24)
    arr[..., :3] *= (0.85 + 0.25 * sh)[..., None]
    save(Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)), "leafcard.png")


def fabric(n=512):
    yy, xx = np.mgrid[0:n, 0:n] / n
    weave = 0.5 + 0.25 * np.sin(xx * math.pi * 2 * 80) * np.sin(yy * math.pi * 2 * 80)
    v = 0.5 * weave + 0.5 * fnoise(n, 1.8, 25)
    save(tint(v, (0.82, 0.8, 0.78), (1.0, 1.0, 0.98)), "fabric.jpg")


def slate(w=1024, h=512):
    v = 0.6 * fnoise(w, 1.8, 26, h=h) + 0.4 * fnoise(w, 1.0, 27, lo=12, h=h)
    a = tint(v, (0.12, 0.22, 0.18), (0.22, 0.34, 0.28))
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(28)
    for _ in range(14):  # faint wiped-chalk clouds
        x, y, r = rng.uniform(0, w), rng.uniform(0, h), rng.uniform(30, 90)
        d.ellipse((x - r * 1.6, y - r * 0.5, x + r * 1.6, y + r * 0.5), fill=(52, 72, 64))
    d.rounded_rectangle((18, 18, w - 18, h - 18), 24, outline=(205, 215, 200), width=5)
    img = img.filter(ImageFilter.GaussianBlur(10))
    ImageDraw.Draw(img).rounded_rectangle((18, 18, w - 18, h - 18), 24, outline=(205, 215, 200), width=5)
    save(img.filter(ImageFilter.GaussianBlur(1.0)), "slate.jpg")


def night(n=512):
    v = fnoise(n, 1.8, 29)
    a = tint(v, (0.03, 0.05, 0.14), (0.1, 0.13, 0.3))
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(30)
    for _ in range(140):
        x, y, r = rng.uniform(0, n), rng.uniform(0, n), rng.choice([1, 1, 1.5, 2.5])
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 245, 200))
    save(img, "night.jpg")


def font(size):
    from PIL import ImageFont
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",):
        try:
            return ImageFont.truetype(f, size)
        except Exception:
            pass
    return ImageFont.load_default()


def ruler(w=1024, h=128):
    """A 30 cm scale along U (U 0..1 = 0..30 cm): ticks every mm, numbers every cm. Yellow tape tint."""
    v = fnoise(w, 2.0, 31, h=h)
    a = tint(v, (0.94, 0.8, 0.3), (1.0, 0.88, 0.42))
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    f = font(30)
    ink = (40, 32, 24)
    for mm in range(301):
        x = 6 + mm * (w - 12) / 300
        L = 44 if mm % 10 == 0 else (28 if mm % 5 == 0 else 16)
        d.line((x, 0, x, L), fill=ink, width=3 if mm % 10 == 0 else 2)
        if mm % 10 == 0 and 0 < mm < 300:
            t = str(mm // 10)
            tw = d.textlength(t, font=f)
            d.text((x - tw / 2, 52), t, fill=(200, 40, 40) if mm % 50 == 0 else ink, font=f)
    save(img, "ruler.png")


def screen(w=256, h=128):
    a = np.zeros((h, w, 3))
    a[...] = (0.06, 0.12, 0.14)
    img = Image.fromarray((a * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    pts = []
    for x in range(10, w - 10):
        k = (x - 10) / (w - 20)
        amp = 34 * math.sin(k * math.pi) * (0.5 + 0.5 * math.sin(k * 23)) * math.sin(k * 71)
        pts.append((x, h / 2 + amp))
    d.line(pts, fill=(120, 240, 170), width=3)
    d.ellipse((w - 34, 10, w - 16, 28), fill=(240, 80, 70))
    save(img, "screen.png")


def digits(n=512):
    """4x2 atlas: 1..8 in dark brown on cream discs with a leaf ring (distance markers, podium steps, lanes)."""
    img = Image.new("RGBA", (n, n // 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = n // 4
    f = font(int(c * 0.62))
    for k in range(8):
        x0, y0 = (k % 4) * c, (k // 4) * c
        d.ellipse((x0 + 6, y0 + 6, x0 + c - 6, y0 + c - 6), fill=(246, 236, 206, 255), outline=(92, 140, 60, 255), width=10)
        t = str(k + 1)
        tw = d.textlength(t, font=f)
        d.text((x0 + c / 2 - tw / 2, y0 + c * 0.14), t, fill=(70, 46, 26, 255), font=f)
    save(img, "digits.png")


if __name__ == "__main__":
    digits()
    ruler()
    screen()
    paint()
    chitin()
    wood()
    sand()
    soils()
    rock()
    bark()
    netmesh()
    leafcard()
    fabric()
    slate()
    night()
