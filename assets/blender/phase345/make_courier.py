"""Phase 4 - Skyharbor courier jobs: parcel crates, delivery board, a second friendly robot.

OW_TEX=<tex> OW_OUT=<glb> blender -b --factory-startup -P make_courier.py [-- crates board robot]
crates: kit with crate_small (0.4 m), crate_medium (0.6 m), crate_large (0.9 m): plank crates with brass corners,
  rope handles, icon-only labels (this-way-up, fragile, parts, seeds) and a small teal beacon (emissive) on the lid.
board: delivery board on posts; mesh board_face (0-1 UV) shows the painted route map (swap for live jobs);
  empties hook_0..hook_3 for job tags.
robot: "Pip", a round hover courier (coral paint, teal glow ring) with a cargo basket; bones root/body/rotor/arm.L/
  arm.R/basket; clips idle / move / special (a happy delivery spin). Empty cargo_slot under the basket bone.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import p345 as P  # noqa: E402
import xrig as R  # noqa: E402
from p345 import C, PI, UP, V, VB, lerp, mulc  # noqa: E402
from xrig import Cs, S, X, Y, Z  # noqa: E402


def mats():
    M = {}
    M["wood"] = P.mat("cu_wood", tex="p_timber.jpg", normal="p_timber_n.jpg", tint=(0.86, 0.72, 0.58), rough=0.8)
    M["brass"] = P.mat("cu_brass", tex="brass.jpg", rough=0.35, metal=0.85)
    M["copper"] = P.mat("cu_copper", tex="sh_copper.jpg", rough=0.4, metal=0.7)
    M["rope"] = P.mat("cu_rope", tex="canvas.jpg", tint=(0.82, 0.68, 0.46), rough=0.95)
    M["label"] = P.mat("cu_label", tex="p_labels.jpg", rough=0.8)
    M["teal"] = P.glow("cu_teal_glow", (0.3, 0.95, 0.88), 3.0)
    M["warm"] = P.glow("cu_lamp_glow", (1.0, 0.75, 0.4), 3.0)
    M["paint"] = P.mat("cu_paint", tex="sh_paint.jpg", rough=0.42, metal=0.15)
    M["iron"] = P.mat("cu_iron", tex="brass.jpg", tint=(0.3, 0.3, 0.32), rough=0.5, metal=0.6)
    M["face"] = C.material("cu_face_glow", tex="sh_face.jpg", emissive_tex="sh_face.jpg", emissive_strength=1.6, rough=0.2)
    M["board"] = C.material("board_face", tex="p_delivery_board.jpg", rough=0.7)
    return M


def wbox(name, size, loc, m, rot=(0, 0, 0), bevel=0.01, base=(1, 1, 1), ao=None, uv=1.5):
    o = C.box_obj(name, size, loc, m, rot=rot, bevel=bevel, segments=1, uv_scale=uv)
    P.paint(o, P.wood_fn(base, seed=hash(name) % 71), ao=ao)
    return o


def label(name, M, cell, center, normal, size):
    """A paper label quad from the 2x2 label atlas."""
    vb = VB()
    n = V(normal).normalized()
    t = n.cross(UP)
    if t.length < 1e-3:
        t = V((1, 0, 0))
    t.normalize()
    b = n.cross(t).normalized()
    if b.z < 0:
        t, b = -t, -b
    u0, v0 = (cell % 2) * 0.5, 1 - (cell // 2 + 1) * 0.5
    h = size / 2
    q = [vb.v(V(center) + t * x + b * y, (1, 1, 1)) for x, y in ((-h, -h), (h, -h), (h, h), (-h, h))]
    vb.f(q, [(u0, v0), (u0 + 0.5, v0), (u0 + 0.5, v0 + 0.5), (u0, v0 + 0.5)])
    return vb.obj(name, [M["label"]], light=0.05)


def crate(prefix, M, s, cells, rng):
    objs = []
    T = 0.03 * s / 0.6 + 0.01
    # slatted sides: three horizontal planks per face over a darker inner box
    inner = wbox(prefix + "_inner", (s - 0.02, s - 0.02, s - 0.02), (0, 0, s / 2), M["wood"], base=(0.55, 0.45, 0.36), bevel=0.0)
    objs.append(inner)
    n = 3
    gap = 0.015 * s / 0.6
    ph = (s - gap * (n - 1)) / n
    for k in range(n):
        z = ph / 2 + k * (ph + gap)
        for sy in (-1, 1):
            objs.append(wbox(f"{prefix}_py{k}{sy}", (s, T, ph), (0, sy * (s / 2 - T / 2 + 0.005), z), M["wood"], bevel=0.006,
                             base=(0.95 + rng.uniform(-0.06, 0.04),) * 3))
        for sx in (-1, 1):
            objs.append(wbox(f"{prefix}_px{k}{sx}", (T, s - 2 * T, ph), (sx * (s / 2 - T / 2 + 0.005), 0, z), M["wood"], bevel=0.006,
                             base=(0.95 + rng.uniform(-0.06, 0.04),) * 3))
    for k in range(n):  # lid planks
        y = -s / 2 + s / n * (k + 0.5)
        objs.append(wbox(f"{prefix}_lid{k}", (s + 0.01, s / n - gap, T), (0, y, s + T / 2), M["wood"], bevel=0.006, base=(1, 0.95, 0.88)))
    # brass corner brackets
    for sx in (-1, 1):
        for sy in (-1, 1):
            for z in (0.04 * s / 0.6 + 0.02, s - 0.02):
                objs.append(wbox(f"{prefix}_br{sx}{sy}{z:.2f}", (0.07 * s / 0.6 + 0.03, 0.07 * s / 0.6 + 0.03, 0.05 * s / 0.6 + 0.02),
                                 (sx * (s / 2 - 0.005), sy * (s / 2 - 0.005), z), M["brass"], bevel=0.008, base=(1, 1, 1)))
    # rope handles on the two sides
    for sx in (-1, 1):
        vb = VB()
        pts = [V((sx * (s / 2 + 0.02 + 0.03 * math.sin(a)), 0.12 * s / 0.6 * math.cos(a) * 1.2, s * 0.62 - 0.02 * math.sin(a)))
               for a in [i / 8 * PI for i in range(9)]]
        vb.tube(pts, 0.012 * s / 0.6 + 0.004, (0.88, 0.75, 0.52), sides=6)
        objs.append(vb.obj(f"{prefix}_rope{sx}", [M["rope"]]))
    # icon labels: front and right side
    objs.append(label(prefix + "_lab_f", M, cells[0], (0, -s / 2 - 0.008, s * 0.52), (0, -1, 0), s * 0.42))
    objs.append(label(prefix + "_lab_s", M, cells[1], (s / 2 + 0.008, 0, s * 0.52), (1, 0, 0), s * 0.38))
    # beacon: a little brass cup with a teal glow, so night couriers can spot their parcel
    bc = VB()
    bc.lathe([(0.0, 0.0), (0.04, 0.0), (0.045, 0.02), (0.035, 0.03), (0.0, 0.03)], (1, 1, 1), segs=12, loc=(s * 0.3, s * 0.3, s + T))
    objs.append(bc.obj(prefix + "_beacon_cup", [M["brass"]]))
    gl = VB()
    gl.blob((s * 0.3, s * 0.3, s + T + 0.045), (0.03, 0.03, 0.03), (1, 1, 1), seg=10, ring=6)
    objs.append(gl.obj(prefix + "_beacon", [M["teal"]], light=0))
    return objs


def make_crates():
    C.reset()
    M = mats()
    rng = random.Random(4)
    roots = []
    for nm, s, cells in (("crate_small", 0.4, (3, 0)), ("crate_medium", 0.6, (1, 0)), ("crate_large", 0.9, (2, 0))):
        roots.append(P.join(crate(nm, M, s, cells, rng), nm))
    P.layout(roots, 0.3)
    P.export("p4_courier_crates", roots)


def make_board():
    C.reset()
    M = mats()
    objs = []
    W, H, Z0 = 1.6, 0.8, 1.0
    for sx in (-1, 1):
        objs.append(wbox(f"post{sx}", (0.1, 0.1, Z0 + H + 0.3), (sx * (W / 2 + 0.06), 0, (Z0 + H + 0.3) / 2), M["wood"], bevel=0.02, base=(0.9, 0.78, 0.62),
                         ao=(0, 0.7)))
        objs.append(wbox(f"foot{sx}", (0.18, 0.5, 0.08), (sx * (W / 2 + 0.06), 0, 0.04), M["wood"], bevel=0.02, base=(0.8, 0.68, 0.55)))
        cap = VB()
        cap.lathe([(0.0, 0.0), (0.07, 0.0), (0.08, 0.04), (0.05, 0.08), (0.0, 0.11)], (1, 1, 1), segs=12, loc=(sx * (W / 2 + 0.06), 0, Z0 + H + 0.3))
        objs.append(cap.obj(f"cap{sx}", [M["brass"]]))
    objs.append(wbox("backing", (W, 0.05, H), (0, 0.02, Z0 + H / 2), M["wood"], bevel=0.01, base=(0.75, 0.62, 0.5)))
    for k, (sx, sz, dx, dz) in enumerate(((W + 0.1, 0.08, 0, H / 2), (W + 0.1, 0.08, 0, -H / 2), (0.08, H, W / 2, 0), (0.08, H, -W / 2, 0))):
        objs.append(wbox(f"fr{k}", (sx, 0.08, sz), (dx, -0.01, Z0 + H / 2 + dz), M["brass"], bevel=0.015, base=(1, 1, 1)))
    # little roof with a warm lantern hanging under it
    objs.append(wbox("roof", (W + 0.5, 0.42, 0.05), (0, -0.08, Z0 + H + 0.28), M["wood"], rot=(0.25, 0, 0), bevel=0.015, base=(0.7, 0.5, 0.42)))
    lt = VB()
    lt.lathe([(0.0, -0.01), (0.06, -0.01), (0.07, 0.02), (0.0, 0.03)], (1, 1, 1), segs=10, loc=(0, -0.2, Z0 + H + 0.05))
    lt.lathe([(0.0, 0.17), (0.08, 0.17), (0.04, 0.22), (0.0, 0.23)], (1, 1, 1), segs=10, loc=(0, -0.2, Z0 + H + 0.05))
    lt.tube([V((0, -0.2, Z0 + H + 0.28)), V((0, -0.2, Z0 + H + 0.22))], 0.006, (1, 1, 1), sides=4)
    objs.append(lt.obj("lantern", [M["brass"]]))
    gw = VB()
    gw.lathe([(0.0, 0.02), (0.05, 0.03), (0.055, 0.12), (0.04, 0.17), (0.0, 0.17)], (1, 1, 1), segs=10, loc=(0, -0.2, Z0 + H + 0.05))
    objs.append(gw.obj("lantern_glow", [M["warm"]], light=0))
    # hooks with blank job tags hanging below the board
    hooks = []
    for k in range(4):
        x = -W / 2 + 0.25 + k * (W - 0.5) / 3
        hk = VB()
        hk.tube([V((x, -0.04, Z0 - 0.02)), V((x, -0.1, Z0 - 0.02)), V((x, -0.1, Z0 - 0.07))], 0.008, (1, 1, 1), sides=5)
        objs.append(hk.obj(f"hook{k}", [M["brass"]]))
        hooks.append((f"hook_{k}", V((x, -0.1, Z0 - 0.08))))
    body = P.join(objs, "delivery_board_body")
    face = VB()
    q = [face.v(V((x, -0.006, z)), (1, 1, 1)) for x, z in ((-W / 2 + 0.04, Z0 + 0.04), (W / 2 - 0.04, Z0 + 0.04), (W / 2 - 0.04, Z0 + H - 0.04),
                                                            (-W / 2 + 0.04, Z0 + H - 0.04))]
    face.f(q, [(0, 0), (1, 0), (1, 1), (0, 1)])
    fo = face.obj("board_face", [M["board"]], light=0)
    root = bpy.data.objects.new("delivery_board", None)
    bpy.context.collection.objects.link(root)
    body.parent = root
    fo.parent = root
    for nm, loc in hooks:
        e = bpy.data.objects.new(nm, None)
        bpy.context.collection.objects.link(e)
        e.parent = root
        e.location = loc
    P.export("p4_delivery_board", [root])


# =============================================================================== robot "Pip"
def make_robot():
    C.reset()
    M = mats()
    coral = P.mat("cu_sunny", tex="sh_paint.jpg", tint=(0.98, 0.72, 0.26), rough=0.38, metal=0.15)
    cream = P.mat("cu_cream", tex="sh_paint.jpg", tint=(0.98, 0.92, 0.8), rough=0.45)
    rig = R.Rig("courier_robot")
    BZ = 0.85  # body centre height (it hovers; origin on the ground under it)
    rig.bone("root", (0, 0, 0), (0, 0, 0.2))

    def part(fn, name, mats_, light=0.15):
        vb = VB()
        fn(vb)
        return vb.obj(name, mats_, light=light)

    def body(vb):
        # egg body: coral shell, cream belly band, brass seam ring
        vb.blob((0, 0, BZ), (0.3, 0.28, 0.33), lambda u: (1, 1, 1), seg=28, ring=18, fn=lambda u: V((0, 0, 0.04 * u.z * u.z)))
        vb.mi = 1
        vb.lathe([(0.27, BZ - 0.27), (0.285, BZ - 0.25), (0.29, BZ - 0.2), (0.285, BZ - 0.18)], (1, 1, 1), segs=28, cap=False)
        vb.mi = 2
        vb.lathe([(0.22, BZ - 0.32), (0.25, BZ - 0.3), (0.26, BZ - 0.28), (0.24, BZ - 0.27)], (1, 1, 1), segs=28, cap=False)
        # side fins (brass)
        for s in (-1, 1):
            vb.blob((s * 0.29, 0.1, BZ + 0.02), (0.03, 0.16, 0.06), (1, 1, 1), seg=12, ring=8, rot=Matrix.Rotation(s * 0.2, 3, "Y"))
        vb.mi = 0
    rig.bone("body", (0, 0, BZ - 0.3), (0, 0, BZ + 0.3), "root")
    rig.add(part(body, "robot_body", [coral, cream, M["brass"]]), "body")

    def face(vb):
        # screen face: a curved panel on the front (-Y)
        nx, nz = 8, 6
        rows = []
        for i in range(nx + 1):
            row = []
            for j in range(nz + 1):
                a = (i / nx - 0.5) * 1.6
                z = BZ + 0.02 + (j / nz - 0.5) * 0.3
                r = 0.302
                row.append(vb.v((math.sin(a) * r, -math.cos(a) * r - 0.002, z), (1, 1, 1)))
            rows.append(row)
        for i in range(nx):
            for j in range(nz):
                vb.f((rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]),
                     [(0.05 + 0.9 * i / nx, 0.12 + 0.76 * j / nz), (0.05 + 0.9 * (i + 1) / nx, 0.12 + 0.76 * j / nz),
                      (0.05 + 0.9 * (i + 1) / nx, 0.12 + 0.76 * (j + 1) / nz), (0.05 + 0.9 * i / nx, 0.12 + 0.76 * (j + 1) / nz)])
        vb.mi = 1  # brass bezel around the screen
        for i in range(nx + 1):
            for zz in (BZ + 0.02 - 0.17, BZ + 0.02 + 0.17):
                a = (i / nx - 0.5) * 1.65
                vb.blob((math.sin(a) * 0.305, -math.cos(a) * 0.305, zz), (0.022, 0.012, 0.016), (1, 1, 1), seg=6, ring=4)
        vb.mi = 0
    rig.add(part(face, "robot_face", [M["face"], M["brass"]], light=0), "body")

    def ring(vb):  # the glowing hover ring under the body
        vb.lathe([(0.2, BZ - 0.33), (0.24, BZ - 0.31), (0.24, BZ - 0.28), (0.2, BZ - 0.27)], (1, 1, 1), segs=24, cap=False)
    rig.add(part(ring, "robot_glow_ring", [M["teal"]], light=0), "body")

    def rotor(vb):  # top mast + three-blade rotor + warm tip light
        vb.tube([V((0, 0, BZ + 0.33)), V((0, 0, BZ + 0.45))], [0.025, 0.02], (1, 1, 1), sides=8)
        for k in range(3):
            a = k / 3 * 2 * PI
            d = V((math.cos(a), math.sin(a), 0))
            P.leaf(vb, V((0, 0, BZ + 0.45)), d, UP, 0.24, 0.07, (0.95, 0.9, 0.8), (0.9, 0.85, 0.75), shape="strap", segs=3, cols=1, fold=0.0,
                   droop=-0.05, twist=0.25, rib=0.0)
        vb.mi = 1
        vb.blob((0, 0, BZ + 0.47), (0.03, 0.03, 0.03), (1, 1, 1), seg=8, ring=6)
        vb.mi = 0
    rig.bone("rotor", (0, 0, BZ + 0.33), (0, 0, BZ + 0.5), "body")
    rig.add(part(rotor, "robot_rotor", [M["brass"], M["warm"]]), "rotor")
    for s, sd in ((1, "L"), (-1, "R")):
        sh = V((s * 0.27, -0.02, BZ - 0.08))
        hand = V((s * 0.22, -0.12, BZ - 0.42))

        def arm(vb, sh=sh, hand=hand, s=s):
            vb.blob(sh, (0.05, 0.05, 0.05), (1, 1, 1), seg=10, ring=6)
            vb.tube(R.smooth_pts([sh, sh + V((s * 0.06, -0.05, -0.15)), hand], 3), 0.025, (1, 1, 1), sides=8)
            vb.blob(hand, (0.04, 0.04, 0.035), (1, 1, 1), seg=10, ring=6)
        rig.bone(f"arm.{sd}", sh, hand, "body")
        rig.add(part(arm, f"robot_arm{sd}", [M["brass"]]), f"arm.{sd}")

    def basket(vb):  # woven cargo basket held below
        vb.lathe([(0.0, BZ - 0.62), (0.18, BZ - 0.62), (0.22, BZ - 0.46), (0.23, BZ - 0.44), (0.2, BZ - 0.45), (0.17, BZ - 0.59), (0.0, BZ - 0.59)],
                 (0.92, 0.78, 0.52), segs=20, scale=(1.2, 0.9, 1))
        for s in (-1, 1):
            vb.tube([V((s * 0.26, -0.0, BZ - 0.45)), V((s * 0.22, -0.12, BZ - 0.42))], 0.012, (0.6, 0.55, 0.45), sides=5)
    rig.bone("basket", (0, 0, BZ - 0.45), (0, 0, BZ - 0.62), "body")
    rig.add(part(basket, "robot_basket", [M["rope"]]), "basket")
    rig.build()

    def hover(t, amp=1.0):
        return {"root": {"loc": (0, 0, 0.04 * S(t, 2) * amp)}, "body": {"rot": [(Y, 0.03 * S(t, 1)), (X, 0.02 * S(t, 1, 0.3))]},
                "rotor": {"rot": [(Z, 2 * PI * t * 4)]}, "basket": {"rot": [(X, 0.05 * S(t, 2, 0.2))]},
                "arm.L": {"rot": [(X, 0.05 * S(t, 2))]}, "arm.R": {"rot": [(X, 0.05 * S(t, 2, 0.5))]}}
    rig.clip("idle", 96, hover, step=1)

    def move(t):
        p = hover(t, 0.6)
        p["body"] = {"rot": [(X, 0.22), (Y, 0.05 * S(t, 2))]}
        p["rotor"] = {"rot": [(Z, 2 * PI * t * 8)]}
        p["basket"] = {"rot": [(X, -0.15 + 0.04 * S(t, 4))]}
        return p
    rig.clip("move", 48, move, step=1)

    def special(t):  # a delivery done: little hop, full spin, arms up and wiggle
        e = R.ease_in_out(t)
        p = hover(t, 0.3)
        p["root"] = {"loc": (0, 0, 0.18 * math.sin(PI * t)), "rot": [(Z, 2 * PI * R.smoothstep(0.1, 0.9, t))]}
        p["arm.L"] = {"rot": [(Y, -1.6 * e), (X, 0.3 * S(t, 6) * e)]}
        p["arm.R"] = {"rot": [(Y, 1.6 * e), (X, 0.3 * S(t, 6, 0.5) * e)]}
        p["rotor"] = {"rot": [(Z, 2 * PI * t * 10)]}
        return p
    rig.clip("special", 72, special, step=1)
    e = bpy.data.objects.new("cargo_slot", None)
    bpy.context.collection.objects.link(e)
    e.parent = rig.rig
    e.parent_type = "BONE"
    e.parent_bone = "basket"
    e.location = (0, 0, 0)
    rig.export(os.path.abspath(os.path.join(C.OUT, "p4_courier_robot.glb")), extra=[e])


NAMES = {"crates": make_crates, "board": make_board, "robot": make_robot}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for n in (argv or list(NAMES)):
        NAMES[n]()
