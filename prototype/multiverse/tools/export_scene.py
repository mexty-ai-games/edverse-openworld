# Exports the v2 concept scene for the web prototype: the terrain heightfield (exact same function as the
# concept renders) and the hero props as one GLB.
#
#   blender -b --factory-startup -P tools/export_scene.py -- <concept scene.py> <out dir>
#
# heightfield.bin: little-endian header (u32 nx, u32 nz, f32 x0, f32 x1, f32 y0, f32 y1) then three f32
# planes of nx*nz samples, row-major along Blender +Y:
#   A  base relief (fjord floor, shore shelf, detail)    M  mountain term (scaled by the universe's mtn)
#   P  promontory + lighthouse islet
# height(x, y) = max(A + mtn * M, P). Blender (x, y, z) is three.js (x, z, -y).
import bpy, sys, math, struct
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]

src = open(SRC).read()
# build the props of every universe at once: lighthouse and glacier both present, no render
src = src.replace('}[UNI]', '}[UNI]\nU = dict(U, lighthouse=True, glacier=True)', 1)
stop = src.index("# ---------------------------------------------------------------- world, sun, camera")
src = src[:stop]
# skip the heavy scatter setup (trees and grass are rebuilt on the GPU in the prototype)
src = src.replace('_tm = scatter(', '_tm = None and scatter(').replace('_gm = scatter(', '_gm = None and scatter(')
sys.argv = ["blender", "--", "prime", "/tmp/unused.png", "64", "1"]
g = {"__name__": "__export__"}
exec(compile(src, SRC, "exec"), g)

ns = g["noise"]; Vector = g["Vector"]; smooth = g["smooth"]; ridged = g["ridged"]; fbm = g["fbm"]
xcenter = g["xcenter"]; CLIFF = g["CLIFF"]; ISLET = g["ISLET"]

def parts(x, y):
    d = abs(x - xcenter(y))
    w = 165 + max(y, 0) * 0.08
    dd_ = d + fbm(x / 70, y / 70) * 45
    shelf = smooth(w - 20, w + 25, dd_) * (30 + fbm(x / 35, y / 35, 4) * 10)
    t = smooth(w + 70, w + 320 + max(y, 0) * 0.15, dd_)
    far = 0.55 + min(max(y, 0) / 520.0, 1.6)
    r = ridged(x / 210.0, y / 210.0)
    A = -22 + shelf + fbm(x / 25, y / 25, 4) * 2.5 * (0.3 + t)
    M = t * ((50 + 230 * far * r) * t)
    rr = math.hypot(x - CLIFF[0], y - CLIFF[1]) + fbm(x / 14, y / 14, 3) * 5
    plateau = 38 + fbm(x / 30, y / 30, 3) * 1.2 - max(0, rr - 24) ** 1.35 * 1.6
    if x < CLIFF[0] and y < CLIFF[1] + 10:
        plateau = max(plateau, 38 + fbm(x / 30, y / 30, 3) * 1.2 - max(0, (y - CLIFF[1] - 10)) * 3)
    ri = math.hypot(x - ISLET[0], y - ISLET[1]) + fbm(x / 9, y / 9, 3) * 4
    islet = 4.5 + fbm(x / 7, y / 7, 3) * 1.2 - max(0, ri - 9) * 0.9
    return A, M, max(plateau, islet)

X0, X1, Y0, Y1 = -650.0, 650.0, -150.0, 1900.0
NX, NZ = 651, 1026  # 2 m spacing
xs = np.linspace(X0, X1, NX)
ys = np.linspace(Y0, Y1, NZ)
A = np.zeros((NZ, NX), np.float32); M = np.zeros_like(A); P = np.zeros_like(A)
for j, y in enumerate(ys):
    for i, x in enumerate(xs):
        A[j, i], M[j, i], P[j, i] = parts(float(x), float(y))
with open(OUT + "/heightfield.bin", "wb") as f:
    f.write(struct.pack("<IIffff", NX, NZ, X0, X1, Y0, Y1))
    f.write(A.tobytes()); f.write(M.tobytes()); f.write(P.tobytes())
print("heightfield", NX, NZ)

# hero props: name every exported object after its material so the web code can find it
skip = {"terrain", "water", "clouds"}
bpy.ops.object.select_all(action="DESELECT")
count = {}
for o in list(bpy.data.objects):
    if o.type != "MESH" or o.name in skip or not o.data.materials:
        continue
    if o.users_collection and o.users_collection[0].name in ("trees", "grass", "src"):
        continue
    m = o.data.materials[0].name.split(".")[0]
    if m in ("water", "clouds", "terrain", "deadwood", "needles") or m.startswith("blade_"):
        continue
    k = count.get(m, 0); count[m] = k + 1
    o.name = "%s_%02d" % (m, k)
    o.select_set(True)
print("props", count)
bpy.ops.export_scene.gltf(filepath=OUT + "/props.glb", use_selection=True, export_apply=True, export_yup=True,
                          export_format="GLB", export_materials="EXPORT")
print("WROTE", OUT)
