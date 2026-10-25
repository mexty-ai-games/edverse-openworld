"""Painted textures for the Expedition assets (Grove Keeper, species, field kit). numpy + Pillow.

python3 textures.py <out_dir>
paint.jpg (soft brush strokes, near white: vertex colours carry the colour), fur.jpg (combed strands),
scalesoft.jpg (rounded pebble scales), leather.jpg, paper.jpg (field-guide pages with ruled lines and
sketches), canvas.jpg (woven fabric, near white, tinted per material).
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "build/tex"
os.makedirs(OUT, exist_ok=True)


def fnoise(n, beta=2.0, seed=0, aniso=(1.0, 1.0), lo=1.0):
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


def save(a, name, q=88):
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    img.save(os.path.join(OUT, name), quality=q)
    print("wrote", name)


def tint(v, lo, hi):
    lo, hi = np.array(lo, float), np.array(hi, float)
    return lo[None, None] + (hi - lo)[None, None] * v[..., None]


def paint(n=512):
    a = fnoise(n, 1.6, 1)
    b = fnoise(n, 2.4, 2, aniso=(1.0, 3.0))
    v = 0.55 * a + 0.45 * b
    save(tint(v, (0.80, 0.78, 0.74), (1.0, 0.99, 0.96)), "paint.jpg")


def fur(n=512):
    a = fnoise(n, 1.2, 3, aniso=(0.12, 1.0), lo=2)  # long strands along v
    b = fnoise(n, 2.2, 4)
    v = 0.7 * a + 0.3 * b
    v = (v - v.min()) / (v.max() - v.min())
    save(tint(v, (0.66, 0.62, 0.57), (1.0, 0.98, 0.94)), "fur.jpg")


def scalesoft(n=512, cells=14):
    rng = np.random.default_rng(5)
    pts = [((i + 0.5 + (rng.random() - .5) * .7) * n / cells, (j + 0.5 + (rng.random() - .5) * .7) * n / cells) for i in range(cells) for j in range(cells)]
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    f1 = np.full((n, n), 1e9, np.float32)
    f2 = np.full((n, n), 1e9, np.float32)
    for px, py in pts:
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                d = np.hypot(xx - px - ox, yy - py - oy)
                f2 = np.where(d < f1, f1, np.minimum(f2, d))
                f1 = np.minimum(f1, d)
    edge = np.clip((f2 - f1) / (n / cells * 0.25), 0, 1)
    dome = 1 - np.clip(f1 / (n / cells * 0.7), 0, 1)
    v = 0.55 + 0.25 * dome + 0.2 * edge + 0.08 * (fnoise(n, 2, 6) - 0.5)
    save(tint(np.clip(v, 0, 1), (0.55, 0.52, 0.48), (1.0, 0.98, 0.95)), "scalesoft.jpg")


def leather(n=512):
    g = fnoise(n, 1.0, 7, lo=8)  # fine grain
    big = fnoise(n, 2.2, 8)
    v = 0.6 * big + 0.4 * g
    save(tint(v, (0.30, 0.17, 0.09), (0.62, 0.38, 0.2)), "leather.jpg")


def canvas(n=512):
    yy, xx = np.mgrid[0:n, 0:n] / n
    weave = 0.5 + 0.25 * np.sin(xx * math.pi * 2 * 96) * np.sin(yy * math.pi * 2 * 96)
    v = 0.55 * weave + 0.45 * fnoise(n, 1.8, 9)
    save(tint(v, (0.8, 0.79, 0.76), (1.0, 1.0, 0.98)), "canvas.jpg")


def paper(w=1024, h=512):
    """Open-book spread: two cream pages, ruled lines, a leaf sketch, a paw print, a tiny map."""
    base = fnoise(w, 2.0, 10)[:h, :w]
    a = tint(base, (0.88, 0.82, 0.68), (0.98, 0.95, 0.85))
    img = Image.fromarray((a * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    ink = (92, 70, 48)
    for page in (0, 1):
        x0 = page * w // 2 + 50
        for k in range(12):
            y = 70 + k * 34
            d.line((x0, y, x0 + w // 2 - 100, y), fill=(180, 160, 130), width=2)
        for k in range(5):
            y = 70 + k * 34 - 8
            L = 140 + (k * 53) % 150
            d.line((x0 + 10, y, x0 + 10 + L, y), fill=ink, width=3)
    # left page: leaf sketch
    cx, cy = 260, 330
    d.ellipse((cx - 60, cy - 110, cx + 60, cy + 110), outline=ink, width=4)
    d.line((cx, cy - 110, cx, cy + 150), fill=ink, width=4)
    for k in range(-3, 4):
        d.line((cx, cy + k * 25, cx + 50, cy + k * 25 - 30), fill=ink, width=3)
        d.line((cx, cy + k * 25, cx - 50, cy + k * 25 - 30), fill=ink, width=3)
    # right page: paw print + little map dashes
    px, py = 760, 330
    d.ellipse((px - 45, py - 20, px + 45, py + 60), fill=ink)
    for k, (ox, oy) in enumerate(((-55, -45), (-20, -75), (20, -75), (55, -45))):
        d.ellipse((px + ox - 16, py + oy - 20, px + ox + 16, py + oy + 20), fill=ink)
    for k in range(9):
        x = 600 + k * 38
        d.line((x, 450 - (k % 3) * 8, x + 22, 450 - ((k + 1) % 3) * 8), fill=(170, 60, 50), width=4)
    d.text((880, 440), "X", fill=(170, 60, 50))
    # gutter shadow
    arr = np.asarray(img).astype(np.float32) / 255
    xx = np.arange(w) / w
    sh = 1 - 0.28 * np.exp(-((xx - 0.5) / 0.035) ** 2)
    arr *= sh[None, :, None]
    Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.SMOOTH).save(os.path.join(OUT, "paper.jpg"), quality=88)
    print("wrote paper.jpg")


if __name__ == "__main__":
    paint()
    fur()
    scalesoft()
    leather()
    canvas()
    paper()
