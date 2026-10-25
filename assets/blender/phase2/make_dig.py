"""Dig site v2: a diggable layered soil block (4 removable layers) and five fossils.

OW_TEX=<tex> OW_OUT=<glb> blender -b --factory-startup -P make_dig.py [-- block fossils]

dig_block.glb (metres, Z up in Blender / +Y glTF, origin on the ground at the block centre, 1.2 x 1.2 m):
  dig_layer0  (each layer node pivots at its own base) humus topsoil with grass fringe   top z=0.92  (remove first)
  dig_layer1  red clay with pebbles             top z=0.74
  dig_layer2  banded sandstone                  top z=0.56
  dig_layer3  grey shale                        top z=0.38
  dig_bedrock dark base rock with a small pit   top z=0.20  (never removed)
  dig_frame   wooden frame, string grid pegs, sign posts (static)
Each layer is its own mesh node: hide/fade it (or scale it down in Z) to dig it away.
Deeper = older: the fossil revealed under each layer (fossil_*.glb, origin at the fossil centre; DIG_SPOTS below gives the
spot in block coordinates, also in the manifest):
  under layer0 -> shark tooth (~15 million years) · under layer1 -> dinosaur bone (~70 My) · under layer2 -> ammonite
  (~150 My) · under layer3 -> fern (~300 My) and, in the bedrock pit, trilobite (~500 My).
"""
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import p2 as R  # noqa: E402
from p2 import C, blob, box, flat, lathe_obj, shade, smooth_pts, soft, tube  # noqa: E402

V = Vector
TOPS = [0.92, 0.74, 0.56, 0.38, 0.20]
SIZE = 1.2
# where each fossil rests (Blender coords, block origin), and which layer covers it
DIG_SPOTS = {"shark_tooth": ((-0.22, 0.12, TOPS[1] + 0.012), 0), "dino_bone": ((0.1, -0.1, TOPS[2] + 0.03), 1),
             "ammonite": ((-0.15, 0.2, TOPS[3] + 0.02), 2), "fern": ((0.2, 0.18, TOPS[4] + 0.012), 3),
             "trilobite": ((-0.2, -0.18, TOPS[4] - 0.03), 3)}


def lin(c):
    return tuple(max(0.0, x) ** 2.2 for x in c)


def painter(base, fn=None, amt=0.2):
    def f(p, n):
        c = fn(p, n) if fn else None
        return lin(shade(c if c is not None else base, n, amt))
    return f


def slab(name, z0, z1, tex, seed, inset=0.0, lip=0.0, pit=None):
    """A soil slab with a bumpy, gently domed top and crumbly sides (grid top + side skirts), box UVs."""
    rng = random.Random(seed)
    off = V((rng.random() * 40, rng.random() * 40, 0))
    h = SIZE / 2 - inset
    n = 16
    bm = bmesh.new()
    top = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            x = -h + 2 * h * i / n
            y = -h + 2 * h * j / n
            edge = min(1.0, (h - abs(x)) / 0.1, (h - abs(y)) / 0.1)
            z = z1 + 0.015 * C.fbm(V((x * 4, y * 4, 0)) + off, 3) + 0.01 * edge - 0.012 * (1 - edge)
            if pit and (V((x, y, 0)) - V(pit[0])).length < pit[1]:
                z -= pit[2] * (1 - (V((x, y, 0)) - V(pit[0])).length / pit[1]) ** 0.5
            row.append(bm.verts.new((x, y, z)))
        top.append(row)
    for j in range(n):
        for i in range(n):
            bm.faces.new((top[j][i], top[j][i + 1], top[j + 1][i + 1], top[j + 1][i]))
    # side skirts down to z0 with crumbly wobble
    ring = [top[0][i] for i in range(n + 1)] + [top[j][n] for j in range(1, n + 1)] + [top[n][i] for i in range(n - 1, -1, -1)] + \
        [top[j][0] for j in range(n - 1, 0, -1)]
    bottom = []
    for v in ring:
        p = v.co
        d = V((p.x, p.y, 0))
        w = 0.008 * C.fbm(V((p.x * 9, p.y * 9, z0 * 7)) + off, 2)
        bottom.append(bm.verts.new((p.x * (1 + w) , p.y * (1 + w), z0)))
    mids = []
    for v, b in zip(ring, bottom):
        p = (v.co + b.co) / 2
        k = 1 + 0.012 * C.fbm(V((p.x * 7, p.y * 7, p.z * 9)) + off, 3) + lip
        mids.append(bm.verts.new((p.x * k, p.y * k, p.z)))
    m = len(ring)
    for i in range(m):
        i2 = (i + 1) % m
        bm.faces.new((ring[i2], ring[i], mids[i], mids[i2]))
        bm.faces.new((mids[i2], mids[i], bottom[i], bottom[i2]))
    bm.faces.new(bottom[::-1] if False else bottom)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mat = C.material(name + "_m", tex=tex, rough=0.95, vcol=True)
    ob = C.new_obj(name, bm, [mat])
    C.box_uv(ob, 1.6)
    C.shade_flat_bevel(ob)
    C.paint_vcol(ob, lambda p, nn: lin(shade((1, 1, 1), nn, 0.25)))
    return ob


def grass_fringe(name, z, seed=5):
    """Short tufts of painted grass blades along the top of the humus."""
    rng = random.Random(seed)
    mat = soft(name + "_m", tex="paint.jpg", rough=0.8)
    blades = []
    h = SIZE / 2
    for k in range(70):
        side = rng.random()
        if side < 0.6:  # around the rim, thicker
            t = rng.uniform(-h + 0.03, h - 0.03)
            e = rng.choice([-1, 1]) * (h - rng.uniform(0.02, 0.08))
            x, y = (t, e) if rng.random() < 0.5 else (e, t)
        else:
            x, y = rng.uniform(-h + 0.05, h - 0.05), rng.uniform(-h + 0.05, h - 0.05)
        base = V((x, y, z + 0.005))
        for b in range(3):
            a = rng.uniform(0, 6.28)
            L = rng.uniform(0.05, 0.11)
            tip = base + V((math.cos(a) * 0.03, math.sin(a) * 0.03, L))
            blades.append(tube(f"{name}{k}_{b}", [base, (base + tip) / 2 + V((0, 0, 0.01)), tip], [0.006, 0.004, 0.0008], mat, sides=4, cap=False))
    ob = C.join(blades, name)
    C.paint_vcol(ob, lambda p, n: lin(shade((0.36, 0.62, 0.26) if (p.z - z) > 0.03 else (0.28, 0.48, 0.2), n, 0.15)))
    return ob


def block():
    l0 = slab("dig_layer0", TOPS[1], TOPS[0], "soil0.jpg", 1)
    gr = grass_fringe("dig_grass", TOPS[0])
    l0 = C.join([l0, gr], "dig_layer0")
    l1 = slab("dig_layer1", TOPS[2], TOPS[1], "soil1.jpg", 2)
    l2 = slab("dig_layer2", TOPS[3], TOPS[2], "soil2.jpg", 3)
    l3 = slab("dig_layer3", TOPS[4], TOPS[3], "soil3.jpg", 4)
    bed = slab("dig_bedrock", 0.0, TOPS[4], "rock.jpg", 5, pit=((-0.2, -0.18, 0), 0.13, 0.05))
    C.paint_vcol(bed, lambda p, n: lin(shade((0.5, 0.47, 0.44), n, 0.25)))
    # wooden frame around the block (lets the strata show), corner pegs with a string grid, a little tool rack sign
    wood = C.material("dig_wood", tex="wood.jpg", normal="wood_n.jpg", rough=0.7, normal_strength=0.6, vcol=True)
    rope = soft("dig_string", tex="fabric.jpg", rough=0.9)
    fr = []
    h = SIZE / 2 + 0.06
    for k, (sx, sy, rot) in enumerate(((0, -1, 0), (0, 1, 0), (-1, 0, 1), (1, 0, 1))):
        size = (SIZE + 0.24, 0.07, 0.16) if rot == 0 else (0.07, SIZE + 0.1, 0.16)
        fr.append(box(f"dig_board{k}", size, (sx * h, sy * h, 0.08), wood, bevel=0.015, uv=1.0, noise=0.004, seed=k,
                      col=painter((0.86, 0.68, 0.48))))
    pegs = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            pegs.append(tube(f"dig_peg{sx}{sy}", [V((sx * h, sy * h, 0.0)), V((sx * h, sy * h, 1.05))], [0.03, 0.026], wood, sides=8,
                             col=painter((0.8, 0.6, 0.4))))
            pegs.append(blob(f"dig_pegcap{sx}{sy}", (sx * h, sy * h, 1.06), (0.035, 0.035, 0.025), wood, seg=10, ring=6,
                             col=painter((0.9, 0.35, 0.25))))
    strings = []
    for k in range(3):
        t = -h + (k + 1) * 2 * h / 4 * 1.0
        strings.append(tube(f"dig_strx{k}", [V((t * 0.999, -h, 1.0)), V((t * 0.999, h, 1.0))], [0.004, 0.004], rope, sides=4, cap=False,
                            col=painter((0.96, 0.92, 0.82))))
        strings.append(tube(f"dig_stry{k}", [V((-h, t, 1.0)), V((h, t, 1.0))], [0.004, 0.004], rope, sides=4, cap=False,
                            col=painter((0.96, 0.92, 0.82))))
    for s in (-1, 1):
        strings.append(tube(f"dig_strbx{s}", [V((-h, s * h, 1.0)), V((h, s * h, 1.0))], [0.004, 0.004], rope, sides=4, cap=False,
                            col=painter((0.96, 0.92, 0.82))))
        strings.append(tube(f"dig_strby{s}", [V((s * h, -h, 1.0)), V((s * h, h, 1.0))], [0.004, 0.004], rope, sides=4, cap=False,
                            col=painter((0.96, 0.92, 0.82))))
    # a depth gauge post on the front corner: coloured bands at each layer height (no text: works for every age)
    gauge = [box("dig_gauge", (0.06, 0.03, 0.98), (h + 0.12, -h, 0.49), wood, bevel=0.008, col=painter((0.95, 0.9, 0.78)))]
    gcols = [(0.42, 0.3, 0.2), (0.8, 0.45, 0.28), (0.9, 0.75, 0.5), (0.5, 0.55, 0.6)]
    for k in range(4):
        z = (TOPS[k] + TOPS[k + 1]) / 2
        gauge.append(box(f"dig_gband{k}", (0.065, 0.034, TOPS[k] - TOPS[k + 1] - 0.02), (h + 0.12, -h, z), wood, bevel=0.004,
                         col=painter(gcols[k])))
    frame = C.join(fr + pegs + strings + gauge, "dig_frame")
    for k, l in enumerate((l0, l1, l2, l3)):
        R.set_origin(l, (0, 0, TOPS[k + 1]))   # pivot at the layer's base: scale Z to 0 to dig it away
    R.export_static(os.path.join(C.OUT, "dig_block.glb"), [l0, l1, l2, l3, bed, frame])


# ----------------------------------------------------------------------------- fossils
def stone_mat(name, rough=0.7):
    return C.material(name, tex="rock.jpg", rough=rough, vcol=True)


def trilobite():
    m = stone_mat("fossil_trilobite_m")
    col = (0.55, 0.5, 0.45)
    parts = []
    # cephalon (head shield): a half-moon dome with genal spines and two crescent eyes
    parts.append(blob("tri_head", (0, -0.045, 0.012), (0.05, 0.03, 0.016), m, seg=22, ring=10,
                      fn=lambda u: V((0, 0.012 * u.x * u.x, 0)) if u.y > 0 else V((0, 0, 0))))
    for s in (-1, 1):
        parts.append(tube(f"tri_spine{s}", smooth_pts([(s * 0.045, -0.04, 0.008), (s * 0.052, -0.02, 0.006), (s * 0.05, 0.0, 0.004)], 3),
                          [0.006, 0.005, 0.004, 0.003, 0.002, 0.0015, 0.001], m, sides=6))
        parts.append(blob(f"tri_eye{s}", (s * 0.026, -0.042, 0.02), (0.0055, 0.008, 0.005), m, seg=10, ring=6))
    parts.append(blob("tri_glabella", (0, -0.048, 0.02), (0.012, 0.024, 0.01), m, seg=14, ring=8))
    # thorax: 9 segments, three lobes (raised axial lobe + side pleurae)
    for k in range(9):
        y = -0.018 + k * 0.009
        w = 0.046 - k * 0.0018
        parts.append(blob(f"tri_pleura{k}", (0, y, 0.01), (w, 0.0055, 0.008), m, seg=18, ring=6,
                          fn=lambda u: V((0, 0.002 * u.x * u.x, -0.004 * abs(u.x)))))
        parts.append(blob(f"tri_axis{k}", (0, y, 0.017), (0.012, 0.005, 0.007), m, seg=10, ring=6))
    parts.append(blob("tri_pygidium", (0, 0.07, 0.009), (0.028, 0.016, 0.008), m, seg=16, ring=8))
    ob = C.join(parts, "fossil_trilobite")
    C.paint_vcol(ob, painter(col, lambda p, n: (0.68, 0.62, 0.55) if n.z > 0.7 else None, 0.35))
    return ob


def fern():
    slab_m = stone_mat("fossil_fern_slab_m", 0.85)
    imp = stone_mat("fossil_fern_print_m", 0.6)
    base = blob("fern_slab", (0, 0, 0), (0.1, 0.13, 0.015), slab_m, seg=24, ring=10, noise=0.006, nscale=20,
                fn=lambda u: V((0, 0, -0.006 * u.z * u.z)) if u.z > 0 else V((0, 0, 0)))
    C.paint_vcol(base, painter((0.66, 0.6, 0.52), lambda p, n: (0.58, 0.52, 0.45) if n.z < 0.5 else None, 0.3))
    fr = [tube("fern_rachis", smooth_pts([(0.01, -0.11, 0.014), (0.0, 0.0, 0.016), (-0.015, 0.1, 0.014)], 4), [0.003] * 13, imp, sides=5)]
    for k in range(14):
        t = k / 13
        p = V((0.01 - 0.025 * t, -0.1 + 0.2 * t, 0.015))
        L = 0.06 * math.sin(math.pi * (0.15 + 0.8 * t)) + 0.012
        for s in (-1, 1):
            d = V((s * 1.0, 0.45, 0)).normalized()
            fr.append(blob(f"fern_pinna{k}{s}", p + d * L * 0.5, (L * 0.5, 0.008, 0.003), imp, seg=10, ring=4,
                           fn=lambda u: V((0, 0, 0))))
            fr[-1].rotation_euler = (0, 0, math.atan2(d.y, d.x))
            fr[-1].location = p + d * L * 0.5
            fr[-1].data.transform(__import__("mathutils").Matrix.Translation(-(p + d * L * 0.5)))
    ob = C.join([base] + fr, "fossil_fern")
    C.paint_vcol(ob, painter((0.66, 0.6, 0.52), lambda p, n: (0.32, 0.27, 0.22) if p.z > 0.0125 and n.z > 0.3 else
                             ((0.58, 0.52, 0.45) if n.z < 0.5 else None), 0.3))
    return ob


def ammonite():
    m = stone_mat("fossil_ammonite_m", 0.45)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    rows, sides = 90, 14
    turns, b, R0 = 3.6, 0.11, 0.06
    TH = turns * math.pi * 2
    grid = []
    cols = []
    for i in range(rows + 1):
        th = TH * i / rows
        g = math.exp(b * (th - TH))
        rib = 1.0 + 0.14 * max(0.0, math.sin(th * 2.6)) ** 3
        Rw, rt = R0 * g, R0 * g * 0.42 * rib
        rad = V((math.cos(th), math.sin(th), 0))
        c = rad * Rw
        row = []
        for j in range(sides):
            ph = j / sides * math.pi * 2
            p = c + (rad * math.cos(ph) * 1.0 + V((0, 0, 1)) * math.sin(ph) * 0.75) * rt
            row.append(bm.verts.new(p))
            cols.append(mixc((0.8, 0.62, 0.4), (0.58, 0.4, 0.24), max(0.0, math.sin(th * 2.6)) ** 3))
        grid.append(row)
    for i in range(rows):
        for j in range(sides):
            j2 = (j + 1) % sides
            f = bm.faces.new((grid[i][j], grid[i][j2], grid[i + 1][j2], grid[i + 1][j]))
            for lp, (u, v) in zip(f.loops, ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))):
                lp[uvl].uv = (u / sides, v / rows * 8)
    bm.faces.new(grid[-1])
    bm.faces.new(list(reversed(grid[0])))
    ob = C.new_obj("fossil_ammonite", bm, [m])
    C.shade_smooth(ob)
    me = ob.data
    ca = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    me.color_attributes.active_color = ca
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            c = cols[vi] if vi < len(cols) else (0.7, 0.55, 0.35)
            cc = lin(shade(c, me.vertices[vi].normal, 0.3))
            ca.data[li].color = (*cc, 1.0)
    # lies flat; small shift so its centre is the origin
    return ob


def mixc(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def shark_tooth():
    enamel = C.material("fossil_tooth_enamel", color=lin((0.28, 0.3, 0.33)), rough=0.25, vcol=True)
    bm = bmesh.new()
    # a flat, broad triangular crown with a gently serrated edge and a lighter root
    outline = []
    N = 40
    for i in range(N):
        t = i / N
        if t < 0.5:   # left edge, root to tip
            k = t / 0.5
            x, y = -0.05 * (1 - k) ** 0.9, -0.03 + 0.075 * k
        else:         # right edge, tip to root
            k = (t - 0.5) / 0.5
            x, y = 0.05 * k ** 1.1, 0.045 - 0.075 * k
        ser = 0.0016 * math.sin(i * 2.8)
        outline.append((x + ser * (1 if x > 0 else -1), y))
    # root base (bottom arch)
    for i in range(1, 12):
        a = math.pi * i / 12
        outline.append((0.05 * math.cos(a), -0.03 - 0.016 * math.sin(a)))
    cx = V((0, 0.0, 0))
    top = [bm.verts.new((x, y, 0.01 * (1 - abs(x) / 0.05) * (1 - max(0, y) / 0.08) + 0.002)) for x, y in outline]
    bot = [bm.verts.new((x, y, -0.006 * (1 - abs(x) / 0.05) * (1 - max(0, y) / 0.08) - 0.002)) for x, y in outline]
    ct = bm.verts.new((0, 0.0, 0.012))
    cb = bm.verts.new((0, 0.0, -0.008))
    n = len(outline)
    for i in range(n):
        i2 = (i + 1) % n
        bm.faces.new((top[i], top[i2], ct))
        bm.faces.new((bot[i2], bot[i], cb))
        bm.faces.new((top[i2], top[i], bot[i], bot[i2]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = C.new_obj("fossil_shark_tooth", bm, [enamel])
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = 1
    C.apply_all(ob)
    C.shade_smooth(ob)
    C.paint_vcol(ob, lambda p, nn: lin(shade((0.6, 0.48, 0.34) if p.y < -0.022 else ((0.22, 0.24, 0.27) if p.y > 0.0 else (0.32, 0.3, 0.3)), nn, 0.3)))
    ob.rotation_euler = (math.radians(70), 0, 0)
    return ob


def dino_bone():
    m = stone_mat("fossil_bone_m", 0.6)
    shaft = tube("bone_shaft", smooth_pts([(-0.09, 0, 0), (-0.02, 0.004, 0.002), (0.06, -0.002, 0)], 4), [0.024, 0.021, 0.019, 0.018, 0.018, 0.019, 0.02,
                                                                                                      0.022, 0.024], m, sides=14, noise=0.08, nscale=30)
    # knobbly joint end (two condyles) and a broken, jagged end
    k1 = blob("bone_condyle1", (-0.1, 0.014, 0.0), (0.03, 0.026, 0.028), m, seg=16, ring=10, noise=0.003, nscale=40)
    k2 = blob("bone_condyle2", (-0.1, -0.016, 0.0), (0.028, 0.024, 0.026), m, seg=16, ring=10, noise=0.003, nscale=40)
    brk = blob("bone_break", (0.07, 0, 0), (0.016, 0.026, 0.026), m, seg=14, ring=8,
               fn=lambda u: V((0.012 * (0.5 + 0.5 * math.sin(u.y * 9 + u.z * 7)) * max(0, u.x), 0, 0)))
    ob = C.join([shaft, k1, k2, brk], "fossil_dino_bone")

    def bc(p, n):
        if p.x > 0.072:
            return (0.88, 0.8, 0.66)   # fresh broken end, lighter
        return (0.74, 0.6, 0.44) if C.fbm(p * 60, 2) > 0.1 else (0.66, 0.52, 0.37)
    C.paint_vcol(ob, painter((0.7, 0.56, 0.4), bc, 0.3))
    return ob


FOSSILS = {"trilobite": trilobite, "fern": fern, "ammonite": ammonite, "shark_tooth": shark_tooth, "dino_bone": dino_bone}


def fossils():
    for n, fn in FOSSILS.items():
        C.reset()
        ob = fn()
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        # origin at the fossil's centre, resting so its lowest point is just under z=0
        lo = min(v.co.z for v in ob.data.vertices)
        c = sum((v.co for v in ob.data.vertices), V()) / len(ob.data.vertices)
        ob.data.transform(__import__("mathutils").Matrix.Translation((-c.x, -c.y, -lo)))
        ob.name = "fossil_" + n
        R.export_static(os.path.join(C.OUT, "fossil_" + n + ".glb"), [ob])


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    what = argv or ["block", "fossils"]
    if "block" in what:
        C.reset()
        block()
    if "fossils" in what:
        fossils()
