"""Phase 4 - Chrono Quarter craft stations: Roman concrete, Edo washi paper, Maya cacao.

OW_TEX=<tex> OW_OUT=<glb> blender -b --factory-startup -P make_crafts.py [-- names...]
names: rome_kiln rome_trough rome_ash rome_bucket rome_mould rome_block
       edo_bark edo_pot edo_vat edo_screen edo_board edo_sheet
       maya_pods maya_metate maya_pot maya_vessel maya_cup displays
Every craft object is its own .glb (origin at the base, front -Y = glTF +Z); maya_pods is a kit with nodes
cacao_pod_closed / cacao_pod_open; displays is a kit with display_rome_block / display_edo_sheet / display_maya_cup
(the finished objects on small museum stands with icon-only brass plates).
Glowing parts (embers, fire) use *_glow materials (emissive).
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
from p345 import C, PI, UP, V, VB, leaf, lerp, mulc  # noqa: E402


def mats():
    M = {}
    M["soft"] = P.mat("cr_soft", rough=0.65)
    M["stone"] = P.mat("cr_stone", tex="travertine.jpg", normal="travertine_n.jpg", rough=0.85)
    M["rock"] = P.mat("cr_rock", tex="rock.jpg", normal="rock_n.jpg", rough=0.9)
    M["wood"] = P.mat("cr_wood", tex="p_timber.jpg", normal="p_timber_n.jpg", tint=(0.78, 0.66, 0.56), rough=0.8)
    M["timber"] = P.mat("cr_timber", tex="p_timber.jpg", normal="p_timber_n.jpg", rough=0.75)
    M["edo"] = P.mat("cr_edo_wood", tex="p_timber.jpg", normal="p_timber_n.jpg", tint=(0.9, 0.8, 0.7), rough=0.7)
    M["iron"] = P.mat("cr_iron", tex="iron.jpg", rough=0.55, metal=0.6)
    M["brass"] = P.mat("cr_brass", tex="brass.jpg", rough=0.35, metal=0.85)
    M["clay"] = P.mat("cr_terracotta", tex="terracotta.jpg", rough=0.8)
    M["lime"] = P.mat("cr_lime", tex="p_lime.jpg", rough=0.9)
    M["ash"] = P.mat("cr_ash", tex="p_ash.jpg", rough=0.95)
    M["concrete"] = P.mat("cr_concrete", tex="p_concrete.jpg", rough=0.9)
    M["washi"] = P.mat("cr_washi", tex="p_washi.jpg", rough=0.9, double=True)
    M["bamboo"] = P.mat("cr_bamboo", tex="p_bamboo.jpg", rough=0.7)
    M["bark"] = P.mat("cr_bark", tex="bark.jpg", rough=0.9)
    M["granite"] = P.mat("cr_granite", tex="rock.jpg", normal="rock_n.jpg", tint=(0.72, 0.66, 0.62), rough=0.85)
    M["vessel"] = P.mat("cr_maya_vessel", tex="maya_vessel.jpg", rough=0.7)
    M["foam"] = P.mat("cr_foam", tex="p_foam.jpg", rough=0.8)
    M["streak"] = P.mat("cr_pod", tex="p_streak.jpg", rough=0.55)
    M["water"] = C.material("cr_water", color=(0.32, 0.5, 0.55), rough=0.08)
    M["ember"] = P.glow("cr_ember_glow", (1.0, 0.45, 0.12), 3.0)
    M["fire"] = P.glow("cr_fire_glow", (1.0, 0.7, 0.25), 3.5)
    M["rope"] = P.mat("cr_rope", tex="canvas.jpg", tint=(0.8, 0.66, 0.44), rough=0.95)
    return M


def box(name, size, loc, m, rot=(0, 0, 0), bevel=0.01, uv=1.0, base=(1, 1, 1), ao=None, noise=0.0, segs=1, seed=0):
    o = C.box_obj(name, size, loc, m, rot=rot, bevel=bevel, segments=segs, uv_scale=uv, noise_amp=noise, seed=seed or len(name))
    P.paint(o, P.wood_fn(base, seed=hash(name) % 91), ao=ao)
    return o


def lathe(name, prof, m, col=(1, 1, 1), segs=20, loc=(0, 0, 0), rot=None, scale=(1, 1, 1), noise=0.0, nscale=4.0, light=0.2, cap=True,
          u_scale=1.0, v_scale=1.0):
    vb = VB()
    vb.lathe(prof, col, segs=segs, loc=loc, rot=rot, scale=scale, cap=cap, u_scale=u_scale, v_scale=v_scale)
    if noise:
        for v in vb.bm.verts:
            q = V((v.co.x, v.co.y, 0))
            if q.length > 1e-4:
                v.co += q.normalized() * noise * C.fbm(v.co * nscale, 3)
    return vb.obj(name, [m], light=light)


def finish(objs, name, export_name, empties=()):
    root = P.join(objs, name)
    for en, loc in empties:
        e = bpy.data.objects.new(en, None)
        bpy.context.collection.objects.link(e)
        e.parent = root
        e.location = loc
    P.export(export_name, [root])
    return root


def stone_col(seed=0, base=(0.95, 0.92, 0.86), soot=0.0, top=2.0):
    off = V((seed * 3.1, seed * 1.3, 0))

    def fn(p, n):
        c = mulc(base, 0.84 + 0.2 * C.fbm(p * 3 + off, 3))
        if soot:
            c = lerp(c, (0.25, 0.22, 0.2), soot * R_s(p.z, top))
        return c
    return fn


def R_s(z, top):
    t = max(0.0, min(1.0, (z - top * 0.6) / (top * 0.4)))
    return t * t


# =============================================================================== ROME
def rome_kiln():
    """A lime kiln: a squat stone tower, arched stoking mouth with glowing embers, limestone stacked beside."""
    C.reset()
    M = mats()
    objs = []
    H = 2.1
    prof = [(1.05, 0.0), (1.08, 0.3), (1.02, 0.9), (0.9, 1.5), (0.72, 1.95), (0.62, H), (0.5, H), (0.48, H - 0.25)]
    vb = VB()
    vb.lathe(prof, (1, 1, 1), segs=28, cap=False, u_scale=3.0, v_scale=0.8)
    for v in vb.bm.verts:  # rough coursed stone: noise + horizontal course ridges
        q = V((v.co.x, v.co.y, 0))
        if q.length > 0.3:
            k = 0.035 * C.fbm(v.co * 3.5, 3) + 0.02 * abs(math.sin(v.co.z * 14))
            v.co += q.normalized() * k
    kiln = vb.obj("kiln_tower", [M["stone"]], light=0.15)
    P.paint(kiln, stone_col(1, soot=0.8, top=H), ao=(0.0, 0.8))
    objs.append(kiln)
    # stoking arch on the front (-Y): stone voussoirs, dark mouth, glowing ember bed
    ay = -1.06
    for k in range(9):
        a = PI * k / 8
        objs.append(box(f"vous{k}", (0.16, 0.22, 0.12), (math.cos(a) * 0.42, ay - 0.04, 0.45 + math.sin(a) * 0.42), M["stone"],
                        rot=(0, -a + PI / 2, 0), bevel=0.02, base=(0.86, 0.82, 0.76)))
    for sx in (-1, 1):
        objs.append(box(f"jamb{sx}", (0.18, 0.24, 0.48), (sx * 0.44, ay - 0.04, 0.22), M["stone"], bevel=0.02, base=(0.86, 0.82, 0.76)))
    dark = VB()
    dark.disc(V((0, ay + 0.02, 0.36)), V((0, -1, 0)), 0.36, (0.08, 0.05, 0.04), segs=16, rings=1)
    dark.box((0.72, 0.04, 0.36), (0, ay + 0.03, 0.18), (0.08, 0.05, 0.04))
    objs.append(dark.obj("mouth", [M["soft"]], light=0))
    ember = VB()
    rng = random.Random(3)
    for k in range(14):
        ember.blob((rng.uniform(-0.25, 0.25), ay + rng.uniform(-0.05, 0.12), 0.05 + rng.uniform(0, 0.08)), (0.07, 0.06, 0.04), (1, 1, 1),
                   seg=6, ring=4, noise=0.02, nscale=20)
    objs.append(ember.obj("embers", [M["ember"]], light=0))
    glowtop = VB()
    glowtop.disc(V((0, 0, H - 0.2)), UP, 0.47, (1, 1, 1), segs=20, rings=1)
    objs.append(glowtop.obj("kiln_glow_top", [M["ember"]], light=0))
    # limestone chunks stacked by the kiln, firewood bundle, a long stoking rake
    rk = VB()
    for k in range(10):
        x, y = 1.3 + rng.uniform(-0.25, 0.25), -0.4 + rng.uniform(-0.35, 0.35)
        s = rng.uniform(0.12, 0.2)
        rk.blob((x, y, s * 0.6 + (0.15 if k > 6 else 0)), (s, s * 0.8, s * 0.6), (0.96, 0.94, 0.88), seg=8, ring=6, noise=s * 0.4, nscale=6)
    objs.append(rk.obj("limestone", [M["lime"]]))
    wd = VB()
    for k in range(7):
        y = -0.9 + k * 0.09
        wd.tube([V((-1.5, y, 0.07 + (k % 2) * 0.1)), V((-0.9, y + 0.05, 0.07 + (k % 2) * 0.1))], 0.045, (0.7, 0.55, 0.4), sides=7)
    objs.append(wd.obj("firewood", [M["bark"]]))
    C.box_uv(objs[-1], 2.0)
    rake = VB()
    rake.tube([V((-0.7, -1.4, 0.03)), V((0.2, -1.25, 0.95))], 0.022, (0.8, 0.66, 0.48), sides=6)
    rake.box((0.3, 0.04, 0.12), (-0.72, -1.41, 0.06), (0.4, 0.38, 0.36))
    objs.append(rake.obj("rake", [M["wood"]]))
    finish(objs, "lime_kiln", "p4_rome_kiln")


def rome_trough():
    C.reset()
    M = mats()
    objs = []
    L, W, H = 1.4, 0.7, 0.5
    for sy in (-1, 1):
        objs.append(box(f"side{sy}", (L, 0.05, 0.28), (0, sy * W / 2, H - 0.12), M["wood"], rot=(sy * 0.18, 0, 0), bevel=0.012, base=(0.92, 0.82, 0.7)))
    for sx in (-1, 1):
        objs.append(box(f"end{sx}", (0.05, W + 0.08, 0.3), (sx * L / 2, 0, H - 0.12), M["wood"], bevel=0.012, base=(0.92, 0.82, 0.7)))
        for sy in (-1, 1):
            objs.append(box(f"leg{sx}{sy}", (0.07, 0.07, H - 0.2), (sx * (L / 2 - 0.08), sy * (W / 2 - 0.06), (H - 0.2) / 2), M["wood"],
                            bevel=0.01, base=(0.85, 0.74, 0.62)))
    objs.append(box("bottom", (L - 0.04, W - 0.1, 0.04), (0, 0, H - 0.25), M["wood"], bevel=0.0, base=(0.8, 0.7, 0.6)))
    # the mix: lime + volcanic ash, a lumpy grey surface
    vb = VB()
    n = 16
    g = [[None] * 9 for _ in range(n + 1)]
    for i in range(n + 1):
        for j in range(9):
            x = -L / 2 + 0.04 + (L - 0.08) * i / n
            y = -W / 2 + 0.06 + (W - 0.12) * j / 8
            z = H - 0.06 + 0.03 * C.fbm(V((x * 5, y * 5, 0)), 3)
            g[i][j] = vb.v((x, y, z), lerp((0.82, 0.8, 0.76), (0.62, 0.58, 0.6), 0.5 + 0.5 * C.fbm(V((x * 3, y * 3, 2)), 2)))
    for i in range(n):
        for j in range(8):
            vb.f((g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]), [(i / 6, j / 6), ((i + 1) / 6, j / 6), ((i + 1) / 6, (j + 1) / 6), (i / 6, (j + 1) / 6)])
    objs.append(vb.obj("mix", [M["lime"]], light=0.12))
    # a wooden hoe resting across
    hoe = VB()
    hoe.tube([V((-0.9, 0.5, 0.25)), V((0.45, -0.05, H + 0.02))], 0.022, (0.82, 0.68, 0.5), sides=6)
    hoe.box((0.05, 0.26, 0.14), (0.47, -0.06, H - 0.02), (0.75, 0.62, 0.46))
    objs.append(hoe.obj("hoe", [M["wood"]]))
    finish(objs, "mixing_trough", "p4_rome_trough")


def rome_ash():
    C.reset()
    M = mats()
    rng = random.Random(5)
    vb = VB()
    R0, H = 0.75, 0.55
    prof = [(R0 * (1 - t) ** 0.85 + 0.001, H * (1 - (1 - t) ** 1.7)) for t in [i / 10 for i in range(11)]]
    prof = [(R0 + 0.05, -0.02)] + prof
    vb.lathe(prof, (1, 1, 1), segs=28, cap=False, u_scale=3, v_scale=2)
    for v in vb.bm.verts:
        q = V((v.co.x, v.co.y, 0))
        v.co += V((0, 0, 0.05 * C.fbm(v.co * 4, 3))) + (q.normalized() * 0.04 * C.fbm(v.co * 6 + V((3, 0, 0)), 2) if q.length > 0.01 else V((0, 0, 0)))
    objs = [vb.obj("ash_pile", [M["ash"]], light=0.15)]
    st = VB()
    for k in range(9):  # pumice / tuff lumps
        a = rng.uniform(0, 2 * PI)
        r = rng.uniform(0.55, 0.9)
        s = rng.uniform(0.05, 0.1)
        st.blob((math.cos(a) * r, math.sin(a) * r, s * 0.5), (s, s * 0.85, s * 0.7), (0.42, 0.36, 0.38), seg=7, ring=5, noise=s * 0.5, nscale=20)
    objs.append(st.obj("pumice", [M["rock"]]))
    sh = VB()  # wooden shovel stuck in the heap
    sh.tube([V((0.15, -0.1, 0.4)), V((0.32, -0.25, 1.15))], 0.022, (0.82, 0.68, 0.5), sides=6)
    sh.box((0.22, 0.03, 0.28), (0.1, -0.06, 0.3), (0.72, 0.6, 0.45), rot=Matrix.Rotation(0.25, 3, "X").to_quaternion())
    objs.append(sh.obj("shovel", [M["wood"]]))
    bk = VB()  # a woven basket of ash
    bk.lathe([(0.0, 0.0), (0.16, 0.0), (0.2, 0.18), (0.22, 0.2), (0.0, 0.14)], (0.9, 0.78, 0.55), segs=16, loc=(-0.85, -0.45, 0))
    objs.append(bk.obj("basket", [M["rope"]]))
    finish(objs, "ash_pile", "p4_rome_ash")


def stave_bucket(name, M, r=0.17, h=0.32, water=True, loc=(0, 0, 0)):
    objs = []
    prof = [(0.0, 0.0), (r * 0.86, 0.0), (r * 0.86, 0.02), (r, h), (r - 0.015, h), (r * 0.84, 0.03), (0.0, 0.03)]
    vb = VB()
    vb.lathe(prof, (1, 1, 1), segs=20, u_scale=4, loc=loc)
    b = vb.obj(name + "_body", [M["wood"]])
    for poly in b.data.polygons:  # stave seams: darken every other stave a touch
        pass
    P.paint(b, lambda p, n: (0.88, 0.76, 0.6) if int((math.atan2(p.y - loc[1], p.x - loc[0]) + PI) / (2 * PI) * 12) % 2 else (0.8, 0.68, 0.52))
    objs.append(b)
    for z in (0.06, h - 0.06):
        rr = r * 0.86 + (r - r * 0.86) * z / h + 0.008
        objs.append(lathe(name + f"_hoop{z}", [(rr, z - 0.018), (rr + 0.006, z - 0.012), (rr + 0.006, z + 0.012), (rr, z + 0.018)], M["iron"],
                          segs=20, loc=loc, cap=False))
    if water:
        w = VB()
        w.disc(V(loc) + V((0, 0, h - 0.05)), UP, r - 0.018, (1, 1, 1), segs=20, rings=2)
        objs.append(w.obj(name + "_water", [M["water"]], light=0))
    rope = VB()
    pts = [V(loc) + V((math.cos(a) * (r + 0.01), 0, h + math.sin(a) * 0.14)) for a in [i / 10 * PI for i in range(11)]]
    rope.tube(pts, 0.008, (0.85, 0.72, 0.5), sides=5)
    objs.append(rope.obj(name + "_rope", [M["rope"]]))
    return objs


def rome_bucket():
    C.reset()
    M = mats()
    objs = stave_bucket("bucket", M)
    ld = VB()
    ld.lathe([(0.0, -0.01), (0.035, 0.0), (0.04, 0.05), (0.012, 0.06)], (0.85, 0.72, 0.55), segs=10, loc=(0.24, 0.0, 0.0),
             rot=Matrix.Rotation(1.2, 3, "Y").to_quaternion())
    ld.tube([V((0.24, 0, 0.03)), V((0.4, 0, 0.1))], 0.01, (0.85, 0.72, 0.55), sides=5)
    objs.append(ld.obj("ladle", [M["wood"]]))
    finish(objs, "water_bucket", "p4_rome_bucket")


def rome_mould():
    C.reset()
    M = mats()
    objs = []
    L, W, H, T = 0.62, 0.42, 0.34, 0.04
    for sy in (-1, 1):
        objs.append(box(f"long{sy}", (L + 2 * T + 0.08, T, H), (0, sy * (W / 2 + T / 2), H / 2), M["wood"], bevel=0.008, base=(0.9, 0.78, 0.62)))
    for sx in (-1, 1):
        objs.append(box(f"short{sx}", (T, W, H), (sx * (L / 2 + T / 2), 0, H / 2), M["wood"], bevel=0.008, base=(0.9, 0.78, 0.62)))
        for sy in (-1, 1):  # wedge pegs locking the corners
            objs.append(box(f"peg{sx}{sy}", (0.03, 0.06, 0.1), (sx * (L / 2 + T + 0.025), sy * (W / 2 + T / 2), H * 0.6), M["timber"],
                            bevel=0.006, base=(0.95, 0.85, 0.7)))
    objs.append(box("base", (L + 0.24, W + 0.24, 0.04), (0, 0, -0.0), M["wood"], bevel=0.008, base=(0.75, 0.64, 0.52)))
    # half-filled with fresh concrete, a tamping post resting on top
    vb = VB()
    vb.box((L - 0.005, W - 0.005, 0.12), (0, 0, 0.08), (0.85, 0.82, 0.78))
    objs.append(vb.obj("fill", [M["concrete"]], light=0.1))
    C.box_uv(objs[-1], 2.0)
    tp = VB()
    tp.tube([V((-0.45, -0.35, 0.02)), V((0.05, 0.05, H + 0.05))], 0.025, (0.85, 0.7, 0.52), sides=6)
    tp.box((0.12, 0.12, 0.06), (-0.47, -0.37, 0.03), (0.8, 0.66, 0.5))
    objs.append(tp.obj("tamper", [M["wood"]]))
    finish(objs, "wooden_mould", "p4_rome_mould")


def concrete_block(name, M, loc=(0, 0, 0), size=(0.5, 0.3, 0.28)):
    o = C.box_obj(name, size, V(loc) + V((0, 0, size[2] / 2)), M["concrete"], bevel=0.025, segments=2, uv_scale=1.6, noise_amp=0.006, seed=7)
    P.paint(o, lambda p, n: mulc((0.95, 0.92, 0.86), 0.9 + 0.12 * C.fbm(p * 6, 2)), ao=(loc[2], loc[2] + 0.2))
    return o


def rome_block():
    C.reset()
    M = mats()
    objs = [concrete_block("block", M)]
    # a little stamped laurel mark on the front (the workshop's sign)
    vb = VB()
    for k in range(6):
        a = PI * (0.15 + 0.7 * k / 5)
        for s in (-1, 1):
            c = V((s * math.cos(a) * 0.05, -0.151, 0.14 + math.sin(a) * 0.05 - 0.03))
            vb.blob(c, (0.012, 0.004, 0.007), (0.62, 0.6, 0.56), seg=6, ring=4, rot=Matrix.Rotation(s * (a - PI / 2), 3, "Y"))
    objs.append(vb.obj("stamp", [M["concrete"]], light=0.1))
    finish(objs, "concrete_block", "p4_rome_block")


# =============================================================================== EDO (washi)
def bark_bundle(vb, rng, n=16, L=0.9, loc=(0, 0, 0)):
    for k in range(n):
        y = rng.uniform(-0.09, 0.09)
        z = rng.uniform(0.0, 0.12)
        twist = rng.uniform(-0.6, 0.6)
        base = V(loc) + V((-L / 2, y, z + 0.03))
        d = V((1, rng.uniform(-0.05, 0.05), rng.uniform(-0.02, 0.04))).normalized()
        outer = rng.random() < 0.25
        cb, ct = ((0.5, 0.36, 0.24), (0.6, 0.45, 0.3)) if outer else ((0.95, 0.92, 0.82), (0.9, 0.86, 0.74))
        leaf(vb, base, d, V((0, 0.2, 1)), L * rng.uniform(0.85, 1.05), 0.035, cb, ct, shape="strap", segs=6, cols=1, fold=0.3,
             droop=-0.02, twist=twist, rib=0.05)


def edo_bark():
    C.reset()
    M = mats()
    rng = random.Random(11)
    vb = VB()
    bark_bundle(vb, rng)
    objs = [vb.obj("kozo_strips", [M["washi"]], light=0.15)]
    tie = VB()
    for x in (-0.25, 0.22):
        tie.lathe([(0.12, -0.02), (0.13, 0.0), (0.12, 0.02)], (0.85, 0.72, 0.45), segs=12, loc=(x, 0, 0.09),
                  rot=Matrix.Rotation(PI / 2, 3, "Y").to_quaternion(), scale=(1, 0.8, 1), cap=False)
    objs.append(tie.obj("straw_ties", [M["rope"]]))
    finish(objs, "kozo_bark_bundle", "p4_edo_bark")


def edo_pot():
    """Iron cooking pot on a clay hearth with a small fire; kozo strips simmering inside."""
    C.reset()
    M = mats()
    objs = []
    hearth = lathe("hearth", [(0.0, 0.0), (0.52, 0.0), (0.54, 0.05), (0.5, 0.42), (0.44, 0.48), (0.36, 0.48), (0.36, 0.42), (0.0, 0.42)], M["clay"],
                   col=(0.95, 0.88, 0.8), segs=24, noise=0.012, nscale=6)
    P.paint(hearth, stone_col(2, base=(0.96, 0.88, 0.8), soot=0.6, top=0.5))
    objs.append(hearth)
    mouth = VB()
    mouth.box((0.32, 0.06, 0.24), (0, -0.5, 0.15), (0.08, 0.05, 0.04))
    objs.append(mouth.obj("fire_mouth", [M["soft"]], light=0))
    fire = VB()
    for k in range(5):
        fire.blob((-0.1 + k * 0.05, -0.47, 0.08 + (k % 2) * 0.03), (0.04, 0.03, 0.07), (1, 1, 1), seg=6, ring=4)
    objs.append(fire.obj("fire", [M["fire"]], light=0))
    pot = lathe("kama", [(0.0, 0.32), (0.18, 0.33), (0.36, 0.48), (0.43, 0.62), (0.47, 0.64), (0.47, 0.66), (0.4, 0.68), (0.38, 0.86),
                         (0.4, 0.88), (0.37, 0.89), (0.35, 0.72), (0.0, 0.7)], M["iron"], segs=28)
    objs.append(pot)
    wt = VB()
    wt.disc(V((0, 0, 0.82)), UP, 0.36, (1, 1, 1), segs=24, rings=2)
    objs.append(wt.obj("pot_water", [M["water"]], light=0))
    rng = random.Random(12)
    vb = VB()
    for k in range(7):
        a = rng.uniform(0, 2 * PI)
        base = V((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.83))
        leaf(vb, base, V((math.cos(a + 1.5), math.sin(a + 1.5), 0.05)), UP, 0.3, 0.04, (0.86, 0.8, 0.66), (0.92, 0.88, 0.76), shape="strap",
             segs=4, cols=1, droop=0.05)
    objs.append(vb.obj("simmering_bark", [M["washi"]], light=0.1))
    # wooden lid leaning against the hearth, a long stirring stick
    objs.append(lathe("lid", [(0.0, 0.0), (0.42, 0.0), (0.42, 0.03), (0.0, 0.035)], M["edo"], col=(0.95, 0.85, 0.7), segs=24,
                      loc=(0.62, 0.15, 0.4), rot=Matrix.Rotation(1.35, 3, "Y").to_quaternion()))
    st = VB()
    st.tube([V((0.1, 0.05, 0.75)), V((-0.35, 0.3, 1.25))], 0.014, (0.86, 0.72, 0.52), sides=6)
    objs.append(st.obj("stick", [M["edo"]]))
    finish(objs, "boiling_pot", "p4_edo_pot")


def edo_vat():
    C.reset()
    M = mats()
    objs = []
    L, W, H = 1.3, 0.8, 0.75
    for sy in (-1, 1):
        objs.append(box(f"side{sy}", (L, 0.05, 0.45), (0, sy * W / 2, H - 0.22), M["edo"], bevel=0.01, base=(1, 0.92, 0.82)))
    for sx in (-1, 1):
        objs.append(box(f"end{sx}", (0.05, W + 0.05, 0.45), (sx * L / 2, 0, H - 0.22), M["edo"], bevel=0.01, base=(1, 0.92, 0.82)))
        for sy in (-1, 1):
            objs.append(box(f"leg{sx}{sy}", (0.08, 0.08, H - 0.4), (sx * (L / 2 - 0.06), sy * (W / 2 - 0.06), (H - 0.4) / 2), M["edo"],
                            bevel=0.01, base=(0.85, 0.76, 0.66)))
    objs.append(box("floor", (L, W, 0.04), (0, 0, H - 0.44), M["edo"], bevel=0.0, base=(0.8, 0.72, 0.62)))
    # milky pulp water (tororo-aoi makes it slippery): pale, slightly cloudy, with floating fibre flecks
    pulp = P.mat("cr_pulp", tex="p_washi.jpg", tint=(0.92, 0.95, 0.96), rough=0.15)
    w = VB()
    n = 12
    g = [[w.v((-L / 2 + 0.03 + (L - 0.06) * i / n, -W / 2 + 0.03 + (W - 0.06) * j / 6, H - 0.07 + 0.005 * math.sin(i * 1.3 + j)),
              (1, 1, 1)) for j in range(7)] for i in range(n + 1)]
    for i in range(n):
        for j in range(6):
            w.f((g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]), [(i / n, j / 6), ((i + 1) / n, j / 6), ((i + 1) / n, (j + 1) / 6), (i / n, (j + 1) / 6)])
    objs.append(w.obj("pulp", [pulp], light=0))
    # stirring paddle (mase) resting on the rim
    pd = VB()
    pd.tube([V((-0.7, -0.45, H + 0.02)), V((0.2, 0.1, H + 0.02))], 0.016, (0.9, 0.8, 0.62), sides=6)
    for k in range(5):
        pd.tube([V((0.1 + k * 0.03, 0.04 + k * 0.02, H + 0.02)), V((0.1 + k * 0.03, 0.04 + k * 0.02, H - 0.2))], 0.008, (0.9, 0.8, 0.62), sides=4)
    objs.append(pd.obj("paddle", [M["edo"]]))
    finish(objs, "pulp_vat", "p4_edo_vat")


def edo_screen():
    """Sugeta (bamboo screen) in its hinged wooden frame (keta), lid raised."""
    C.reset()
    M = mats()
    objs = []
    L, W = 0.75, 0.55
    for sy in (-1, 1):
        objs.append(box(f"fr_l{sy}", (L + 0.06, 0.04, 0.035), (0, sy * W / 2, 0.02), M["edo"], bevel=0.008, base=(1, 0.92, 0.8)))
    for sx in (-1, 1):
        objs.append(box(f"fr_s{sx}", (0.04, W, 0.035), (sx * L / 2, 0, 0.02), M["edo"], bevel=0.008, base=(1, 0.92, 0.8)))
        objs.append(box(f"handle{sx}", (0.04, 0.16, 0.03), (sx * (L / 2 + 0.06), 0, 0.03), M["edo"], bevel=0.008, base=(0.95, 0.86, 0.72)))
    mat = VB()
    mat.box((L - 0.03, W - 0.03, 0.006), (0, 0, 0.03), (1, 1, 1))
    objs.append(mat.obj("sugeta", [M["bamboo"]], light=0.1))
    C.box_uv(objs[-1], 1.4)
    for k in range(5):  # ribs under the screen
        x = -L / 2 + 0.06 + k * (L - 0.12) / 4
        objs.append(box(f"rib{k}", (0.015, W - 0.02, 0.012), (x, 0, 0.022), M["edo"], bevel=0.0, base=(0.9, 0.8, 0.66)))
    # lid frame raised on its hinges along the back edge
    ang = 1.05
    for sy, ln, wd in ((-1, L + 0.06, 0.035), (1, L + 0.06, 0.035)):
        pass
    lid = []
    for k, (sx_, sy_, dx, dy) in enumerate(((L + 0.06, 0.035, 0, -W / 2), (L + 0.06, 0.035, 0, W / 2), (0.035, W, -L / 2, 0), (0.035, W, L / 2, 0))):
        o = box(f"lid{k}", (sx_, sy_ if sy_ < 0.1 else sy_, 0.03), (dx, dy, 0.0), M["edo"], bevel=0.006, base=(0.98, 0.9, 0.78))
        lid.append(o)
    lj = P.join(lid, "lid")
    lj.data.transform(Matrix.Translation(V((0, -W / 2, 0))))
    lj.rotation_euler = (ang, 0, 0)
    lj.location = (0, W / 2, 0.06)
    objs.append(lj)
    # a fresh wet sheet forming on the screen
    sheet = VB()
    sheet.box((L - 0.08, W - 0.08, 0.004), (0, 0, 0.036), (0.98, 0.98, 0.96))
    objs.append(sheet.obj("wet_sheet", [M["washi"]], light=0.05))
    C.box_uv(objs[-1], 1.2)
    finish(objs, "sugeta_screen", "p4_edo_screen")


def edo_board():
    C.reset()
    M = mats()
    objs = []
    BW, BH = 0.6, 1.7
    tilt = 0.32
    rot = (-tilt, 0, 0)
    c0 = V((0, 0.25, BH / 2 * math.cos(tilt) + 0.02))
    objs.append(box("board", (BW, 0.04, BH), c0, M["timber"], rot=rot, bevel=0.012, base=(1, 0.92, 0.8)))
    objs.append(box("stand_back", (BW * 0.9, 0.05, 1.3), (0, 0.6, 0.62), M["edo"], rot=(0.35, 0, 0), bevel=0.01, base=(0.9, 0.8, 0.66)))
    objs.append(box("foot", (BW + 0.1, 0.9, 0.05), (0, 0.4, 0.025), M["edo"], bevel=0.01, base=(0.85, 0.76, 0.62)))
    # two sheets brushed onto the board, a soft brush hanging on a peg
    R = Matrix.Rotation(-tilt, 3, "X")
    for k, z in enumerate((0.55, 1.2)):
        s = VB()
        c = c0 + R @ V((0, -0.024, z - BH / 2))
        s.box((BW - 0.08, 0.003, 0.52), c, (1, 1, 1), rot=Matrix.Rotation(-tilt, 3, "X").to_quaternion())
        o = s.obj(f"sheet{k}", [M["washi"]], light=0.05)
        C.box_uv(o, 1.5)
        objs.append(o)
    br = VB()
    br.box((0.18, 0.05, 0.08), (0.4, 0.05, 0.9), (0.85, 0.7, 0.5))
    br.box((0.17, 0.04, 0.05), (0.4, 0.05, 0.84), (0.95, 0.9, 0.78))
    objs.append(br.obj("brush", [M["soft"]]))
    finish(objs, "drying_board", "p4_edo_board")


def washi_sheet(name, M, loc=(0, 0, 0), n=3, rng=None):
    rng = rng or random.Random(2)
    vb = VB()
    W, H = 0.42, 0.3
    for s in range(n):
        z0 = s * 0.003
        rot = rng.uniform(-0.12, 0.12)
        nx, ny = 8, 6
        g = []
        for i in range(nx + 1):
            row = []
            for j in range(ny + 1):
                u, v = i / nx, j / ny
                x = (u - 0.5) * W
                y = (v - 0.5) * H
                # deckle edges (wavy) and a gentle curl at one corner on the top sheet
                if i in (0, nx):
                    x += rng.uniform(-0.004, 0.004)
                if j in (0, ny):
                    y += rng.uniform(-0.004, 0.004)
                z = z0 + (0.02 * max(0, u - 0.7) ** 2 * 10 * max(0, v - 0.6) if s == n - 1 else 0)
                p = Matrix.Rotation(rot, 3, "Z") @ V((x, y, z))
                row.append(vb.v(V(loc) + p + V((0, 0, 0.002)), (1, 0.99, 0.96) if s == n - 1 else (0.96, 0.94, 0.9)))
            g.append(row)
        for i in range(nx):
            for j in range(ny):
                vb.f((g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]),
                     [(i / nx, j / ny), ((i + 1) / nx, j / ny), ((i + 1) / nx, (j + 1) / ny), (i / nx, (j + 1) / ny)])
    return vb.obj(name, [M["washi"]], light=0.1)


def edo_sheet():
    C.reset()
    M = mats()
    finish([washi_sheet("washi", M)], "washi_sheet", "p4_edo_sheet")


# =============================================================================== MAYA (cacao)
def cacao_pod(vb, center, L=0.22, R=0.06, open_=False, rot=None, rng=None):
    """Ridged pod (10 ridges), yellow-orange-red; open: the front half removed, pulp-covered beans showing."""
    rng = rng or random.Random(1)
    rot = rot or Matrix()
    seg, rings = 20, 14

    def col(t, a):
        c = lerp((0.95, 0.66, 0.12), (0.82, 0.3, 0.12), 0.5 + 0.5 * math.sin(a * 2 + t * 3))
        return lerp(c, (0.45, 0.6, 0.2), max(0.0, 0.25 - t) * 2)
    rows = []
    for i in range(rings + 1):
        t = i / rings
        z = (t - 0.5) * L
        r = R * math.sin(PI * min(0.999, max(0.001, t))) ** 0.7 * (1 + 0.15 * (0.5 - t))
        if t > 0.9:
            r *= 1 - (t - 0.9) * 4  # pointed tip
        row = []
        amax = PI * 2 if not open_ else PI * 1.06
        a0 = 0.0 if not open_ else -PI * 0.53
        for k in range(seg + (1 if open_ else 0)):
            a = a0 + amax * k / seg
            rr = r * (1 + 0.1 * abs(math.cos(a * 5)) ** 0.6)
            p = V((math.cos(a) * rr, math.sin(a) * rr, z))
            row.append(vb.v(V(center) + rot @ p, col(t, a)))
        rows.append(row)
    nk = len(rows[0])
    for i in range(rings):
        for k in range(nk - (1 if open_ else 0)):
            k2 = (k + 1) % nk
            vb.f((rows[i][k], rows[i][k2], rows[i + 1][k2], rows[i + 1][k]),
                 [(k / seg, i / rings), ((k + 1) / seg, i / rings), ((k + 1) / seg, (i + 1) / rings), (k / seg, (i + 1) / rings)])
    if open_:
        # inner wall of the shell (pale flesh), joined to the outer shell along the cut edges
        inner = []
        for i in range(rings + 1):
            row = []
            for k in range(nk):
                q = rot.inverted() @ (rows[i][k].co - V(center))
                p = V((q.x * 0.82, q.y * 0.82, q.z * 0.97))
                row.append(vb.v(V(center) + rot @ p, (0.96, 0.9, 0.78)))
            inner.append(row)
        for i in range(rings):
            for k in range(nk - 1):
                vb.f((inner[i][k + 1], inner[i][k], inner[i + 1][k], inner[i + 1][k + 1]))
            for k in (0, nk - 1):  # rim strips
                a, b, c2, d2 = rows[i][k], rows[i + 1][k], inner[i + 1][k], inner[i][k]
                vb.f((a, d2, c2, b) if k == 0 else (a, b, c2, d2))
        # a column of pulp-covered beans, lying in the open half (visible from above)
        for i in range(2, rings - 1):
            t = i / rings
            z = (t - 0.5) * L
            r = R * math.sin(PI * t) ** 0.7 * 0.5
            for k in range(3):
                a = PI + (k - 1) * 0.75
                c = V((math.cos(a) * r * 0.35 + R * 0.12, math.sin(a) * r * 0.9, z))
                vb.blob(V(center) + rot @ c, (R * 0.26, R * 0.24, R * 0.3), (0.99, 0.97, 0.9), seg=8, ring=6, rot=rot)
    # stalk
    tip = V((0, 0, -L / 2 - 0.01))
    vb.tube([V(center) + rot @ tip, V(center) + rot @ (tip + V((0, 0, -0.04)))], [0.009, 0.007], (0.42, 0.34, 0.2), sides=6)


def maya_pods():
    C.reset()
    M = mats()
    objs = []
    for nm, op in (("cacao_pod_closed", False), ("cacao_pod_open", True)):
        vb = VB()
        rot = Matrix.Rotation(PI / 2, 3, "Y") @ Matrix.Rotation(0.15, 3, "X")
        cacao_pod(vb, V((0, 0, 0.065)), open_=op, rot=rot)
        if op:  # loose beans spilled beside
            rng = random.Random(4)
            for k in range(4):
                vb.blob((rng.uniform(-0.1, 0.1), -0.09 + rng.uniform(-0.02, 0.02), 0.012), (0.016, 0.012, 0.01), (0.96, 0.92, 0.84), seg=8, ring=5)
        objs.append(vb.obj(nm, [M["streak"]], light=0.2))
    P.layout(objs, 0.08)
    P.export("p4_maya_pods", objs)


def maya_metate():
    C.reset()
    M = mats()
    objs = []
    # sloping grinding slab on three stubby legs
    vb = VB()
    nx, ny = 10, 6
    L, W = 0.62, 0.38
    g = []
    for i in range(nx + 1):
        row = []
        for j in range(ny + 1):
            u, v = i / nx, j / ny
            x, y = (u - 0.5) * L, (v - 0.5) * W
            dish = -0.03 * (1 - (2 * v - 1) ** 2) * math.sin(PI * u)
            z = 0.22 - 0.06 * u + dish
            row.append(vb.v((x, y, z), (1, 1, 1)))
        g.append(row)
    for i in range(nx):
        for j in range(ny):
            vb.f((g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]), [(i / nx, j / ny), ((i + 1) / nx, j / ny), ((i + 1) / nx, (j + 1) / ny), (i / nx, (j + 1) / ny)])
    # sides down to a thick slab
    for i in range(nx):
        for j in (0, ny):
            a, b = g[i][j], g[i + 1][j]
            a2 = vb.v(a.co - V((0, 0, 0.07)), (0.8, 0.8, 0.8))
            b2 = vb.v(b.co - V((0, 0, 0.07)), (0.8, 0.8, 0.8))
            vb.f((a, b, b2, a2) if j == 0 else (b, a, a2, b2))
    for j in range(ny):
        for i in (0, nx):
            a, b = g[i][j], g[i][j + 1]
            a2 = vb.v(a.co - V((0, 0, 0.07)), (0.8, 0.8, 0.8))
            b2 = vb.v(b.co - V((0, 0, 0.07)), (0.8, 0.8, 0.8))
            vb.f((b, a, a2, b2) if i == 0 else (a, b, b2, a2))
    for x, y in ((-0.22, 0.0), (0.22, -0.12), (0.22, 0.12)):
        vb.lathe([(0.0, 0.0), (0.05, 0.0), (0.045, 0.16), (0.0, 0.17)], (0.9, 0.9, 0.9), segs=10, loc=(x, y, 0))
    slab = vb.obj("metate", [M["granite"]], light=0.15)
    C.box_uv(slab, 2.0)
    objs.append(slab)
    # mano: the hand stone, resting across the slab
    mano = VB()
    mano.blob((0.02, 0.0, 0.235), (0.042, 0.25, 0.04), (0.9, 0.88, 0.86), seg=16, ring=10,
              fn=lambda u: V((0, 0, 0)) if abs(u.y) < 0.85 else V((0, -u.y * 0.02, 0)))
    o = mano.obj("mano", [M["granite"]])
    C.box_uv(o, 2.0)
    objs.append(o)
    # a smear of ground cacao paste and a few beans
    ps = VB()
    rng = random.Random(9)
    for k in range(8):
        x, y = rng.uniform(-0.24, -0.05), rng.uniform(-0.1, 0.1)
        ps.blob((x, y, 0.235 - 0.06 * (x / 0.62 + 0.5)), (0.04, 0.03, 0.01), (0.36, 0.2, 0.12), seg=8, ring=5)
    for k in range(6):
        x, y = rng.uniform(0.08, 0.25), rng.uniform(-0.12, 0.12)
        ps.blob((x, y, 0.2 - 0.06 * (x / 0.62 + 0.5)), (0.014, 0.011, 0.008), (0.5, 0.3, 0.18), seg=7, ring=5)
    objs.append(ps.obj("paste", [M["soft"]], light=0.15))
    finish(objs, "metate_mano", "p4_maya_metate")


def maya_pot():
    C.reset()
    M = mats()
    objs = []
    pot = lathe("olla", [(0.0, 0.02), (0.08, 0.0), (0.17, 0.05), (0.21, 0.14), (0.2, 0.24), (0.13, 0.3), (0.1, 0.32), (0.12, 0.36), (0.13, 0.37),
                         (0.105, 0.37), (0.085, 0.33), (0.0, 0.3)], M["clay"], col=(1, 1, 1), segs=24, noise=0.004)
    P.paint(pot, lambda p, n: (0.62, 0.32, 0.2) if 0.17 < p.z < 0.21 else ((0.98, 0.88, 0.72) if 0.21 <= p.z < 0.235 else (0.96, 0.82, 0.68)))
    objs.append(pot)
    objs.append(lathe("ring_stand", [(0.12, 0.0), (0.16, 0.0), (0.15, 0.05), (0.11, 0.05)], M["rope"], col=(0.9, 0.78, 0.55), segs=16, cap=False))
    bn = VB()
    rng = random.Random(6)
    for k in range(10):  # roasted beans in the pot mouth
        a = rng.uniform(0, 2 * PI)
        r = rng.uniform(0, 0.07)
        bn.blob((math.cos(a) * r, math.sin(a) * r, 0.31 + rng.uniform(0, 0.02)), (0.016, 0.012, 0.009), (0.45, 0.26, 0.15), seg=7, ring=5)
    objs.append(bn.obj("beans", [M["soft"]]))
    finish(objs, "clay_pot", "p4_maya_pot")


def foam_cap(vb, center, r, h, rng, n=16):
    vb.blob(center, (r, r, h), (1, 1, 1), seg=18, ring=10, noise=h * 0.12, nscale=25, fn=lambda u: V((0, 0, 0)) if u.z > -0.2 else V((0, 0, (-0.2 - u.z) * h * 0.5)))
    for k in range(n):
        a = rng.uniform(0, 2 * PI)
        rr = r * math.sqrt(rng.random()) * 0.75
        s = rng.uniform(0.08, 0.16) * r
        vb.blob(V(center) + V((math.cos(a) * rr, math.sin(a) * rr, h * 0.6)), (s, s, s * 0.7), (1, 1, 1), seg=7, ring=5)


def maya_vessel():
    """Tall painted cylinder vessel, foam piled at the rim (cacao was poured from height to raise it)."""
    C.reset()
    M = mats()
    objs = []
    H, R = 0.3, 0.075
    v = lathe("vessel", [(0.0, 0.0), (R * 0.95, 0.0), (R, 0.01), (R * 0.98, H * 0.5), (R * 1.04, H), (R * 0.98, H + 0.004), (R * 0.92, H * 0.6),
                          (0.0, H * 0.58)], M["vessel"], col=(1, 1, 1), segs=28, u_scale=1.0, v_scale=1.0 / H * 0.95)
    # UVs: the painted band wraps once around (u), bottom->top (v); fix v to 0..1 over the outer wall
    me = v.data
    uvl = me.uv_layers.active.data
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uvl[li].uv = (uvl[li].uv[0], max(0.0, min(1.0, co.z / H)))
    objs.append(v)
    fo = VB()
    foam_cap(fo, V((0, 0, H - 0.005)), R * 0.98, 0.04, random.Random(3))
    objs.append(fo.obj("foam", [M["foam"]], light=0.1))
    C.box_uv(objs[-1], 6.0)
    # a little foam running down one side
    dr = VB()
    for k in range(3):
        dr.blob((R * 1.0, 0.0 + k * 0.012, H - 0.02 - k * 0.018), (0.012, 0.01, 0.018), (0.92, 0.8, 0.66), seg=7, ring=5)
    objs.append(dr.obj("drip", [M["foam"]], light=0.1))
    finish(objs, "pouring_vessel", "p4_maya_vessel")


def frothy_cup(name, M, loc=(0, 0, 0)):
    objs = []
    c = lathe(name + "_cup", [(0.0, 0.0), (0.035, 0.0), (0.045, 0.01), (0.06, 0.05), (0.064, 0.08), (0.06, 0.082), (0.054, 0.05), (0.0, 0.045)],
              M["clay"], col=(1, 1, 1), segs=24, loc=loc)
    P.paint(c, lambda p, n: (0.62, 0.3, 0.18) if 0.055 < p.z - loc[2] < 0.068 else (0.98, 0.84, 0.68))
    objs.append(c)
    fo = VB()
    foam_cap(fo, V(loc) + V((0, 0, 0.078)), 0.058, 0.03, random.Random(8), n=12)
    objs.append(fo.obj(name + "_foam", [M["foam"]], light=0.1))
    C.box_uv(objs[-1], 8.0)
    return objs


def maya_cup():
    C.reset()
    M = mats()
    finish(frothy_cup("cacao", M), "frothy_cup", "p4_maya_cup")


# =============================================================================== museum display variants
def display_stand(name, M, cell, w=0.5, d=0.4, h=0.9):
    objs = []
    objs.append(box(name + "_top", (w, d, 0.05), (0, 0, h - 0.025), M["timber"], bevel=0.012, base=(1, 0.9, 0.74)))
    objs.append(box(name + "_body", (w - 0.08, d - 0.08, h - 0.1), (0, 0, (h - 0.1) / 2 + 0.05), M["timber"], bevel=0.015, base=(0.92, 0.8, 0.64),
                    ao=(0, 0.6)))
    objs.append(box(name + "_base", (w + 0.04, d + 0.04, 0.06), (0, 0, 0.03), M["timber"], bevel=0.012, base=(0.8, 0.68, 0.54)))
    plate = P.mat("cr_plate", tex="p_plates.jpg", rough=0.55, metal=0.25)
    vb = VB()
    q = [vb.v(V((x, -(d - 0.08) / 2 - 0.006, z)), (1, 1, 1)) for x, z in ((-0.11, h - 0.36), (0.11, h - 0.36), (0.11, h - 0.14), (-0.11, h - 0.14))]
    u0 = cell / 3
    vb.f(q, [(u0, 0), (u0 + 1 / 3, 0), (u0 + 1 / 3, 1), (u0, 1)])
    objs.append(vb.obj(name + "_plate", [plate], light=0))
    return objs


def displays():
    C.reset()
    M = mats()
    roots = []
    h = 0.9
    # Rome: the concrete block on its stand
    o = display_stand("dr", M, 0)
    o.append(concrete_block("dr_block", M, loc=(0, 0, h), size=(0.36, 0.22, 0.2)))
    roots.append(P.join(o, "display_rome_block"))
    # Edo: a washi sheet held in a slanted frame on the stand
    o = display_stand("de", M, 1)
    fr = washi_sheet("de_sheet", M, loc=(0, 0, 0), n=1)
    fr.rotation_euler = (-1.1, 0, 0)
    fr.location = (0, 0.02, h + 0.17)
    o.append(fr)
    o.append(box("de_easel", (0.46, 0.03, 0.36), (0, 0.06, h + 0.16), M["edo"], rot=(-0.47, 0, 0), bevel=0.008, base=(0.95, 0.86, 0.72)))
    o.append(box("de_lip", (0.46, 0.05, 0.03), (0, -0.07, h + 0.03), M["edo"], bevel=0.006, base=(0.95, 0.86, 0.72)))
    roots.append(P.join(o, "display_edo_sheet"))
    # Maya: the frothy cup beside a cacao pod
    o = display_stand("dm", M, 2)
    o += frothy_cup("dm_cup", M, loc=(-0.08, 0, h))
    vb = VB()
    cacao_pod(vb, V((0.12, 0.02, h + 0.05)), L=0.2, R=0.05, rot=Matrix.Rotation(PI / 2, 3, "Y") @ Matrix.Rotation(0.4, 3, "X"))
    o.append(vb.obj("dm_pod", [M["streak"]], light=0.2))
    roots.append(P.join(o, "display_maya_cup"))
    P.layout(roots, 0.3)
    P.export("p4_craft_displays", roots)


NAMES = {"rome_kiln": rome_kiln, "rome_trough": rome_trough, "rome_ash": rome_ash, "rome_bucket": rome_bucket, "rome_mould": rome_mould,
         "rome_block": rome_block, "edo_bark": edo_bark, "edo_pot": edo_pot, "edo_vat": edo_vat, "edo_screen": edo_screen,
         "edo_board": edo_board, "edo_sheet": edo_sheet, "maya_pods": maya_pods, "maya_metate": maya_metate, "maya_pot": maya_pot,
         "maya_vessel": maya_vessel, "maya_cup": maya_cup, "displays": displays}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for n in (argv or list(NAMES)):
        NAMES[n]()
