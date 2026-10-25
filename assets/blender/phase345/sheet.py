"""Render many icons/previews in parallel Blender processes, then compose a labelled contact sheet.

python3 sheet.py <out.jpg> <tile_px> <job> [<job> ...]
job = "glb|node|out.png|clip|t|yaw|elev|shadow|zoom"  (node/clip may be '-'; trailing fields optional)
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw

B = "/opt/blender/blender-4.2.3-linux-x64/blender"
HERE = os.path.dirname(os.path.abspath(__file__))


def render(jobs, size, procs=4):
    chunks = [jobs[i::procs] for i in range(procs)]
    ps = []
    for ch in chunks:
        if not ch:
            continue
        f = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False)
        for j in ch:
            parts = j.split("|")
            glb, node, out = parts[0], parts[1], parts[2]
            rest = parts[3:] + ["-", "0", "-30", "18", "1", "1"][len(parts[3:]):]
            f.write(" ".join([glb, out, str(size), node] + rest) + "\n")
        f.close()
        ps.append(subprocess.Popen([B, "-b", "-P", os.path.join(HERE, "render.py"), "--", "@" + f.name], stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, text=True))
    for p in ps:
        out = p.communicate()[0]
        for line in out.splitlines():
            if "FAILED" in line or "NO NODE" in line or "NO CLIP" in line:
                print(line)


def compose(out, files, tile, cols=6):
    rows = (len(files) + cols - 1) // cols
    im = Image.new("RGB", (tile * cols, (tile + 18) * rows), (150, 162, 150))
    d = ImageDraw.Draw(im)
    for i, f in enumerate(files):
        x, y = (i % cols) * tile, (i // cols) * (tile + 18)
        try:
            a = Image.open(f).convert("RGBA").resize((tile, tile))
            bg = Image.new("RGBA", a.size, (176, 188, 176, 255))
            bg.alpha_composite(a)
            im.paste(bg.convert("RGB"), (x, y + 18))
        except Exception as e:  # noqa
            d.text((x + 4, y + 30), str(e)[:40], fill=(255, 0, 0))
        d.text((x + 4, y + 3), os.path.basename(f)[:44], fill=(255, 255, 255))
    im.save(out, quality=88)
    print(out)


if __name__ == "__main__":
    out, size, jobs = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
    render(jobs, size)
    compose(out, [j.split("|")[2] for j in jobs], min(size, 320))
