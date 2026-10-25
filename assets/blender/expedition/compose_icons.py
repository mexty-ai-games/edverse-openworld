"""Turns transparent renders into 256 px icons + silhouettes for the Field Guide, and a contact sheet.

python3 compose_icons.py icons <render_dir> <out_dir> name [name ...]
    -> <out_dir>/<name>.png (tight-cropped, centred, 256 px, transparent) and <name>_silhouette.png
       (the same shape as one soft dark ink colour: unknown Field Guide pages).
python3 compose_icons.py sheet <out.png> <title>=<png> [...]
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIL = (46, 58, 70)


def fit(img, size=256, pad=0.08):
    a = np.asarray(img)[..., 3]
    ys, xs = np.nonzero(a > 8)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    side = int(max(x1 - x0, y1 - y0) * (1 + pad * 2))
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img.crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)), (0, 0))
    return canvas.resize((size, size), Image.LANCZOS)


def icons(src, out, names):
    os.makedirs(out, exist_ok=True)
    for n in names:
        im = fit(Image.open(os.path.join(src, n + ".png")).convert("RGBA"))
        im.save(os.path.join(out, n + ".png"), optimize=True)
        a = im.split()[3].filter(ImageFilter.GaussianBlur(0.6))
        sil = Image.new("RGBA", im.size, SIL + (0,))
        sil.putalpha(a.point(lambda v: 255 if v > 110 else int(v * 2.3)))
        sil.save(os.path.join(out, n + "_silhouette.png"), optimize=True)
        print("icon", n)


def sheet(out, items):
    cols = 6
    W = 256
    rows = (len(items) + cols - 1) // cols
    img = Image.new("RGB", (cols * W, rows * (W + 22)), (232, 224, 204))
    d = ImageDraw.Draw(img)
    for i, it in enumerate(items):
        title, path = it.split("=", 1)
        x, y = (i % cols) * W, (i // cols) * (W + 22)
        p = Image.open(path).convert("RGBA")
        p.thumbnail((W, W))
        bg = Image.new("RGBA", (W, W), (240, 233, 214, 255) if "silhouette" not in path else (214, 226, 232, 255))
        bg.alpha_composite(p, ((W - p.width) // 2, (W - p.height) // 2))
        img.paste(bg.convert("RGB"), (x, y + 22))
        d.text((x + 6, y + 5), title, fill=(60, 45, 30))
    img.save(out, quality=88)
    print("sheet", out)


if __name__ == "__main__":
    if sys.argv[1] == "icons":
        icons(sys.argv[2], sys.argv[3], sys.argv[4:])
    else:
        sheet(sys.argv[2], sys.argv[3:])
