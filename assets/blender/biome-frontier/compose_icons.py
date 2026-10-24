"""Puts each transparent species render on a painted, biome-coloured card backdrop -> icon_<name>.jpg.

python3 compose_icons.py <render_dir> <out_dir>
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

BG = {"toucan": (196, 230, 186), "tree_frog": (196, 230, 186), "morpho": (196, 230, 186),
      "tortoise": (244, 214, 176), "horned_lizard": (244, 214, 176), "saguaro": (244, 214, 176),
      "sea_turtle": (190, 230, 236), "clownfish": (190, 230, 236), "sea_star": (190, 230, 236)}
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(3)
for name, col in BG.items():
    fg = Image.open(os.path.join(src, name + ".png")).convert("RGBA")
    n = fg.size[0]
    yy, xx = np.mgrid[0:n, 0:n] / n
    r = np.sqrt((xx - 0.5) ** 2 + (yy - 0.42) ** 2)
    base = np.array(col, np.float32) / 255
    v = (1.12 - r * 0.7)[..., None] * base[None, None, :]
    noise = np.asarray(Image.fromarray((rng.random((n // 8, n // 8)) * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)).astype(np.float32) / 255
    v *= (0.94 + noise * 0.1)[..., None]
    bg = Image.fromarray((np.clip(v, 0, 1) * 255).astype(np.uint8)).convert("RGBA").filter(ImageFilter.SMOOTH)
    bg.alpha_composite(fg)
    p = os.path.join(out, "icon_" + name + ".jpg")
    bg.convert("RGB").save(p, quality=86)
    print("wrote", p, os.path.getsize(p))
