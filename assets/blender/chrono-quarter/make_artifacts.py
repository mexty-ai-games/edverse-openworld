"""The twelve Time Detective artifacts, one named mesh each in cq_artifacts.glb, origin at the base,
about real size (the game scales them up so children can spot them):

Rome ~100 CE : amphora, oil_lamp, wax_tablet, strigil
Edo 1603-1868: ukiyoe_print, tea_bowl, geta, folding_fan
Maya 250-900 : cacao_vessel, jade_pendant, codex, clay_whistle

OW_TEX=build/tex OW_OUT=build/glb blender -b --factory-startup -P make_artifacts.py
All shapes are modelled from general knowledge of each object type; none copies a museum piece.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402

import cq  # noqa: E402
from cq import C  # noqa: E402


def handle(name, mat, pts, r=0.012, sides=8):
    bm = bmesh.new()
    C.tube(bm, pts, [r] * len(pts), sides=sides, u_repeat=1.0)
    ob = C.new_obj(name, bm, [mat])
    C.shade_smooth(ob)
    return ob


def main():
    C.reset()
    clay = C.material("art_terracotta", tex="terracotta.jpg", rough=0.8)
    bronze = C.material("art_bronze", tex="bronze.jpg", rough=0.35, metal=0.85)
    wood = C.material("art_wood", tex="edo_wood.jpg", rough=0.7)
    wax = C.material("art_wax", tex="wax.jpg", rough=0.55)
    flame = C.material("art_flame", color=(1.0, 0.7, 0.3), emissive=(1.0, 0.62, 0.22), emissive_strength=4.0)
    printm = C.material("art_print", tex="print.jpg", rough=0.85)
    lacq = C.material("art_lacquer", tex="lacquer.jpg", rough=0.35)
    glaze = C.material("art_glaze", tex="glaze.jpg", rough=0.25)
    matcha = C.material("art_matcha", color=(0.35, 0.55, 0.18), rough=0.6)
    fan = C.material("art_fan", tex="fan.jpg", rough=0.6, double=True)
    vessel = C.material("art_maya_vessel", tex="maya_vessel.jpg", rough=0.7)
    jade = C.material("art_jade", tex="jade.jpg", rough=0.2)
    codex = C.material("art_codex", tex="codex.jpg", rough=0.85, double=True)
    blue = C.material("art_maya_blue", color=(0.33, 0.6, 0.7), rough=0.7)
    cord = C.material("art_cord", color=(0.55, 0.36, 0.2), rough=0.9)
    out = []

    # ---------------------------------------------------------------- Rome
    o = [cq.lathe_obj("amph", [(0.0, 0.0), (0.02, 0.0), (0.035, 0.05), (0.09, 0.16), (0.15, 0.32), (0.16, 0.42), (0.13, 0.5), (0.07, 0.56), (0.045, 0.6),
                               (0.045, 0.7), (0.06, 0.72), (0.05, 0.74), (0.0, 0.74)], clay, segs=20, v_scale=1.5)]
    for sx in (-1, 1):
        o.append(handle(f"amph_h{sx}", clay, [Vector((sx * 0.045, 0, 0.69)), Vector((sx * 0.11, 0, 0.7)), Vector((sx * 0.13, 0, 0.62)), Vector((sx * 0.1, 0, 0.53))], r=0.016))
    out.append(cq.merge(o, "amphora"))

    o = [cq.lathe_obj("lamp_body", [(0.0, 0.0), (0.05, 0.0), (0.08, 0.02), (0.085, 0.04), (0.06, 0.06), (0.03, 0.065), (0.0, 0.06)], clay, segs=18)]
    o.append(handle("lamp_nozzle", clay, [Vector((0, -0.06, 0.035)), Vector((0, -0.12, 0.04)), Vector((0, -0.14, 0.045))], r=0.022))
    o.append(handle("lamp_handle", clay, [Vector((0, 0.07, 0.03)), Vector((0, 0.11, 0.06)), Vector((0, 0.095, 0.09)), Vector((0, 0.07, 0.065))], r=0.01))
    o.append(cq.lathe_obj("lamp_flame", [(0.0, 0.0), (0.014, 0.02), (0.01, 0.045), (0.0, 0.06)], flame, segs=8, loc=(0, -0.14, 0.055)))
    out.append(cq.merge(o, "oil_lamp"))

    o = []
    for k, sx in enumerate((-1, 1)):
        o.append(C.box_obj(f"tab_frame{k}", (0.17, 0.22, 0.016), (sx * 0.09, 0, 0.008), wood, rot=(0, sx * 0.08, 0), bevel=0.004, segments=1, uv_scale=2))
        o.append(C.box_obj(f"tab_wax{k}", (0.14, 0.19, 0.004), (sx * 0.09, 0, 0.017 + abs(sx) * 0.006), wax, rot=(0, sx * 0.08, 0), bevel=0.0, uv_scale=6))
    o.append(handle("stylus", bronze, [Vector((-0.14, -0.13, 0.03)), Vector((0.12, -0.08, 0.03))], r=0.005, sides=6))
    out.append(cq.merge(o, "wax_tablet"))

    pts = []
    for i in range(11):
        t = i / 10
        a = t * math.pi * 0.85
        pts.append(Vector((math.cos(a) * 0.09 - 0.02, 0, 0.02 + math.sin(a) * 0.09)))
    o = [handle("strigil_blade", bronze, pts, r=0.012, sides=6)]
    for v in o[0].data.vertices:
        v.co.y *= 1.9
    o.append(handle("strigil_handle", bronze, [Vector((0.07, 0, 0.02)), Vector((0.16, 0, 0.01)), Vector((0.2, 0, 0.012))], r=0.014, sides=6))
    o.append(C.box_obj("strigil_grip", (0.06, 0.03, 0.03), (0.17, 0, 0.012), wood, bevel=0.006, uv_scale=3))
    out.append(cq.merge(o, "strigil"))

    # ---------------------------------------------------------------- Edo
    o = [C.box_obj("print_frame", (0.27, 0.02, 0.38), (0, 0.02, 0.21), lacq, rot=(-0.18, 0, 0), bevel=0.006, uv_scale=3)]
    o.append(cq.quad_obj("print_sheet", printm, 0.23, 0.34, loc=(0, -0.006, 0.21), rot=(-0.18, 0, 0)))
    o.append(C.box_obj("print_stand", (0.03, 0.18, 0.02), (0, 0.06, 0.01), wood, bevel=0.004, uv_scale=3))
    out.append(cq.merge(o, "ukiyoe_print"))

    o = [cq.lathe_obj("bowl", [(0.0, 0.0), (0.04, 0.0), (0.045, 0.012), (0.06, 0.015), (0.075, 0.05), (0.078, 0.085), (0.072, 0.085), (0.068, 0.05), (0.05, 0.025), (0.0, 0.025)],
                      glaze, segs=24, v_scale=4)]
    o.append(cq.lathe_obj("tea", [(0.0, 0.06), (0.066, 0.06), (0.0, 0.0601)], matcha, segs=20, cap=False))
    out.append(cq.merge(o, "tea_bowl"))

    o = []
    for k, sx in enumerate((-1, 1)):
        x = sx * 0.07
        o.append(C.box_obj(f"geta_board{k}", (0.1, 0.23, 0.022), (x, 0, 0.058), wood, bevel=0.008, segments=2, uv_scale=3))
        for y in (-0.06, 0.06):
            o.append(C.box_obj(f"geta_tooth{k}{y}", (0.095, 0.022, 0.05), (x, y, 0.025), wood, bevel=0.004, uv_scale=3))
        o.append(handle(f"geta_strap{k}", lacq, [Vector((x - 0.045, 0.03, 0.07)), Vector((x - 0.02, -0.04, 0.1)), Vector((x, -0.075, 0.072)),
                                                 Vector((x + 0.02, -0.04, 0.1)), Vector((x + 0.045, 0.03, 0.07))], r=0.007, sides=6))
    out.append(cq.merge(o, "geta"))

    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    n = 14
    R0, R1 = 0.05, 0.25
    rows = []
    for i in range(n + 1):
        a = math.pi * (0.1 + 0.8 * i / n)
        z = 0.004 if i % 2 else 0.0
        rows.append((bm.verts.new((math.cos(a) * R0, math.sin(a) * R0 * 0.3, 0.12 + math.sin(a) * R0)), bm.verts.new((math.cos(a) * R1, z + 0.02, 0.12 + math.sin(a) * R1 * 0.95)), i / n))
    for i in range(n):
        a0, b0, t0 = rows[i]
        a1, b1, t1 = rows[i + 1]
        f = bm.faces.new((a0, a1, b1, b0))
        for loop, uv in zip(f.loops, ((1 - t0, 0), (1 - t1, 0), (1 - t1, 1), (1 - t0, 1))):
            loop[uvl].uv = uv
    leaf = C.new_obj("fan_leaf", bm, [fan])
    o = [leaf, C.box_obj("fan_rivet_base", (0.03, 0.02, 0.12), (0, 0, 0.06), wood, bevel=0.004, uv_scale=3)]
    out.append(cq.merge(o, "folding_fan"))

    # ---------------------------------------------------------------- Maya
    o = [cq.lathe_obj("cup", [(0.0, 0.0), (0.06, 0.0), (0.075, 0.01), (0.078, 0.2), (0.074, 0.2), (0.07, 0.03), (0.0, 0.03)], vessel, segs=24, v_scale=4.6, u_scale=1)]
    o.append(cq.lathe_obj("cup_lid", [(0.0, 0.21), (0.085, 0.205), (0.08, 0.225), (0.03, 0.235), (0.035, 0.26), (0.0, 0.265)], clay, segs=20))
    out.append(cq.merge(o, "cacao_vessel"))

    bm = bmesh.new()
    res = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=0.07)
    for v in res["verts"]:
        v.co = Vector((v.co.x * 0.85, v.co.y * 0.3, v.co.z * 1.1 + 0.11))
    pend = C.new_obj("jade_plaque", bm, [jade])
    C.box_uv(pend, 8)
    C.shade_smooth(pend)
    o = [pend]
    beads = []
    for k in range(9):
        a = math.pi * (0.15 + 0.7 * k / 8)
        p = Vector((math.cos(a) * 0.11, 0, 0.19 + math.sin(a) * 0.09))
        beads.append(cq.lathe_obj(f"bead{k}", [(0.0, -0.014), (0.014, 0.0), (0.0, 0.014)], jade, segs=8, loc=tuple(p)))
    o += beads
    o.append(handle("jade_cord", cord, [Vector((math.cos(math.pi * (0.15 + 0.7 * k / 16)) * 0.11, 0, 0.19 + math.sin(math.pi * (0.15 + 0.7 * k / 16)) * 0.09)) for k in range(17)], r=0.004, sides=5))
    # carved face lines on the plaque
    o.append(C.box_obj("jade_brow", (0.08, 0.01, 0.008), (0, -0.021, 0.14), jade, bevel=0.0))
    o.append(C.box_obj("jade_mouth", (0.04, 0.01, 0.008), (0, -0.021, 0.08), jade, bevel=0.0))
    out.append(cq.merge(o, "jade_pendant"))

    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    pages = 6
    pw, ph = 0.07, 0.2
    xs = []
    for i in range(pages + 1):
        xs.append(Vector((-pages * pw * 0.42 + i * pw * 0.84, -0.03 if i % 2 else 0.03, 0.0)))
    for i in range(pages):
        a, b = xs[i], xs[i + 1]
        vs = [bm.verts.new(a), bm.verts.new(b), bm.verts.new(b + Vector((0, 0, ph))), bm.verts.new(a + Vector((0, 0, ph)))]
        f = bm.faces.new(vs)
        for loop, uv in zip(f.loops, ((i / pages, 0), ((i + 1) / pages, 0), ((i + 1) / pages, 1), (i / pages, 1))):
            loop[uvl].uv = uv
    pg = C.new_obj("codex_pages", bm, [codex])
    o = [pg]
    for sx in (-1, 1):
        o.append(C.box_obj(f"codex_cover{sx}", (0.012, 0.075, ph + 0.01), (sx * pages * pw * 0.42, 0.03 if sx > 0 and pages % 2 == 0 else -0.03 * sx, ph / 2), wood,
                           bevel=0.003, uv_scale=3))
    out.append(cq.merge(o, "codex"))

    o = [cq.lathe_obj("bird_body", [(0.0, 0.0), (0.03, 0.005), (0.045, 0.03), (0.042, 0.06), (0.03, 0.08), (0.0, 0.085)], clay, segs=14)]
    o[0].scale = (1.0, 1.5, 1.0)
    o.append(cq.lathe_obj("bird_head", [(0.0, 0.0), (0.024, 0.008), (0.028, 0.03), (0.018, 0.05), (0.0, 0.054)], clay, segs=12, loc=(0, -0.045, 0.07)))
    o.append(cq.lathe_obj("bird_beak", [(0.0, 0.0), (0.01, 0.0), (0.0, 0.03)], blue, segs=8, loc=(0, -0.07, 0.095), rot=(math.pi / 2, 0, 0)))
    o.append(cq.lathe_obj("bird_tail", [(0.0, 0.0), (0.02, 0.0), (0.0, 0.05)], blue, segs=8, loc=(0, 0.06, 0.05), rot=(-math.pi / 2.6, 0, 0)))
    o.append(cq.lathe_obj("bird_mouthpiece", [(0.0, 0.0), (0.012, 0.0), (0.012, 0.03), (0.0, 0.03)], clay, segs=8, loc=(0, 0.07, 0.03), rot=(-math.pi / 2.2, 0, 0)))
    for sx in (-1, 1):
        o.append(cq.lathe_obj(f"bird_wing{sx}", [(0.0, 0.0), (0.02, 0.01), (0.0, 0.05)], blue, segs=6, loc=(sx * 0.04, 0.0, 0.04), rot=(0, sx * 1.2, 0)))
    out.append(cq.merge(o, "clay_whistle"))

    # lay them out in a row for the preview (the game reads each mesh by name at its own origin)
    for ob in out:
        print(ob.name, C.tris(ob))
    C.export("cq_artifacts", out)


if __name__ == "__main__":
    main()
