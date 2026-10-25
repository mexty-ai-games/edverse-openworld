"""Icons + silhouettes from the transparent 512 px renders.

python3 compose_icons.py <raw_dir> <out_dir>
<name>_icon.png  256 px, transparent, auto-framed (soft contact shadow kept)
<name>_sil.png   256 px silhouette (creatures only): one flat dark slate shape, for the Field Guide's "not found yet"
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
CREATURES = {"flea", "dung_beetle", "locust", "tiger_beetle", "firefly", "leafcutter_ant", "stick_insect", "stick_insect_camo", "snail",
             "honeybee", "monarch_caterpillar"}
ROTATE = {"tool_ruler": -40}
SIL = (44, 52, 64)


def clean_shadow(img):
    """The shadow catcher leaves a wide, faint black card; keep only a soft contact shadow hugging the object."""
    arr = np.asarray(img).astype(np.float32)
    a = arr[..., 3] / 255
    obj = (a > 0.9) | (arr[..., :3].max(-1) > 14)
    m = Image.fromarray((obj * 255).astype(np.uint8))
    near = np.asarray(m.filter(ImageFilter.GaussianBlur(img.size[0] / 40))).astype(np.float32) / 255
    sh = np.where(obj, a, a * 0.55 * np.clip(near * 2.2, 0, 1))
    arr[..., 3] = sh * 255
    return Image.fromarray(arr.astype(np.uint8)), obj


def frame(img, pad=0.06, thresh=60, obj=None):
    a = np.asarray(img)[..., 3]
    ys, xs = np.where(obj if obj is not None else a > thresh)
    if len(xs) == 0:
        return img
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    w, h = x1 - x0, y1 - y0
    side = int(max(w, h) * (1 + 2 * pad))
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img.crop((x0, y0, x1 + 1, y1 + 1)), (side // 2 - (cx - x0), side // 2 - (cy - y0)))
    return canvas


for f in sorted(os.listdir(src)):
    if not f.endswith(".png"):
        continue
    name = f[:-4]
    img = Image.open(os.path.join(src, f)).convert("RGBA")
    if name in ROTATE:
        img = img.rotate(ROTATE[name], resample=Image.BICUBIC, expand=True)
    img, obj = clean_shadow(img)
    fr = frame(img, obj=obj)
    icon = fr.resize((256, 256), Image.LANCZOS)
    icon.save(os.path.join(out, name + "_icon.png"), optimize=True)
    if name in CREATURES:
        a = np.asarray(fr).astype(np.float32)[..., 3] / 255
        # drop the soft shadow: keep only the solid creature
        m = np.clip((a - 0.55) / 0.25, 0, 1)
        sil = np.zeros(a.shape + (4,), np.uint8)
        sil[..., 0], sil[..., 1], sil[..., 2] = SIL
        sil[..., 3] = (m * 255).astype(np.uint8)
        Image.fromarray(sil).resize((256, 256), Image.LANCZOS).save(os.path.join(out, name + "_sil.png"), optimize=True)
    print("icon", name)
