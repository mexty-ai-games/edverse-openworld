"""Roman forum (~100 CE): temple front, free-standing / broken columns, tiered fountain.

OW_TEX=build/tex OW_OUT=build/glb blender -b --factory-startup -P make_roman.py [-- temple columns fountain]
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


def stone_mats(prefix):
    stone = C.material(prefix + "_travertine", tex="travertine.jpg", normal="travertine_n.jpg", rough=0.75, vcol=True)
    return stone


# =============================================================================== temple
def make_temple():
    C.reset()
    rng = random.Random(1)
    stone = stone_mats("temple")
    relief = C.material("temple_relief", tex="relief.jpg", normal="relief_n.jpg", rough=0.8, vcol=True)
    roof = C.material("temple_roof", tex="roof_terracotta.jpg", normal="roof_terracotta_n.jpg", rough=0.85, vcol=True)
    bronze = C.material("temple_bronze", tex="bronze.jpg", rough=0.4, metal=0.8)
    dark = C.material("temple_shadow", color=(0.09, 0.07, 0.05), rough=0.95)
    objs = []
    W, D, PH = 9.6, 11.0, 1.3   # podium width, depth, height; front at y = -D/2
    yF = -D / 2
    # podium with a moulded base and cornice
    objs.append(C.box_obj("podium", (W, D, PH), (0, 0, PH / 2), stone, bevel=0.04, uv_scale=0.35, noise_amp=0.01, seed=1))
    objs.append(C.box_obj("podium_base", (W + 0.3, D + 0.3, 0.25), (0, 0, 0.12), stone, bevel=0.05, uv_scale=0.35))
    objs.append(C.box_obj("podium_cornice", (W + 0.25, D + 0.25, 0.16), (0, 0, PH - 0.05), stone, bevel=0.04, uv_scale=0.35))
    # front stairs between two cheek walls
    steps = 7
    for k in range(steps):
        h = PH / steps
        objs.append(C.box_obj(f"step{k}", (W - 1.6, 0.42, h * (k + 1)), (0, yF - 0.21 - (steps - 1 - k) * 0.42, h * (k + 1) / 2), stone,
                              bevel=0.02, segments=1, uv_scale=0.35, noise_amp=0.006, seed=10 + k))
    for sx in (-1, 1):
        objs.append(C.box_obj(f"cheek{sx}", (0.8, steps * 0.42, PH + 0.1), (sx * (W / 2 - 0.4), yF - steps * 0.21, (PH + 0.1) / 2), stone, bevel=0.04, uv_scale=0.35))
    # columns: six across the front, two more each side of the porch
    CH = 5.4
    cols = []
    xs = [-W / 2 + 0.75 + i * (W - 1.5) / 5 for i in range(6)]
    for i, x in enumerate(xs):
        cols += cq.column(f"col_f{i}", stone, h=CH, r=0.36, loc=(x, yF + 0.75, PH), seed=i, segs=18)
    for sx in (-1, 1):
        for j, y in enumerate((yF + 2.5, yF + 4.25)):
            cols += cq.column(f"col_s{sx}{j}", stone, h=CH, r=0.36, loc=(sx * xs[-1], y, PH), seed=20 + j, segs=18)
    objs += cols
    top = PH + CH
    # cella: walls behind the porch, with a tall bronze door in a dark doorway
    cy0 = yF + 5.1
    objs.append(C.box_obj("cella", (W - 1.3, D - 5.6, CH), (0, cy0 + (D - 5.6) / 2, PH + CH / 2), stone, bevel=0.03, uv_scale=0.35, noise_amp=0.008))
    objs.append(C.box_obj("doorway", (2.0, 0.2, 3.6), (0, cy0 - 0.02, PH + 1.8), dark, bevel=0.0))
    for sx in (-1, 1):
        objs.append(C.box_obj(f"door{sx}", (0.92, 0.08, 3.4), (sx * 0.48, cy0 - 0.1, PH + 1.72), bronze, bevel=0.015, uv_scale=1.0))
        for k in range(3):
            objs.append(C.box_obj(f"doorpanel{sx}{k}", (0.6, 0.06, 0.8), (sx * 0.48, cy0 - 0.15, PH + 0.6 + k * 1.05), bronze, bevel=0.02, uv_scale=1.0))
    objs.append(C.box_obj("door_frame", (2.5, 0.3, 0.35), (0, cy0 - 0.12, PH + 3.75), stone, bevel=0.03, uv_scale=0.35))
    # entablature: architrave, relief frieze, dentil cornice
    objs.append(C.box_obj("architrave", (W - 0.6, D - 0.6, 0.55), (0, 0.3, top + 0.27), stone, bevel=0.03, uv_scale=0.35))
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    fz0, fz1 = top + 0.55, top + 1.15
    vs = [bm.verts.new(v) for v in ((-W / 2 + 0.3, yF + 0.29, fz0), (W / 2 - 0.3, yF + 0.29, fz0), (W / 2 - 0.3, yF + 0.29, fz1), (-W / 2 + 0.3, yF + 0.29, fz1))]
    f = bm.faces.new(vs)
    for loop, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uvl].uv = uv
    objs.append(C.new_obj("frieze_relief", bm, [relief]))
    objs.append(C.box_obj("frieze", (W - 0.6, D - 0.6, 0.6), (0, 0.3, top + 0.85), stone, bevel=0.02, uv_scale=0.35))
    objs.append(C.box_obj("cornice", (W + 0.1, D + 0.1, 0.28), (0, 0.0, top + 1.29), stone, bevel=0.05, uv_scale=0.35))
    for k in range(30):
        x = -W / 2 + 0.2 + k * (W - 0.4) / 29
        objs.append(C.box_obj(f"dentil{k}", (0.14, 0.14, 0.16), (x, yF - 0.02, top + 1.12), stone, bevel=0.0, uv_scale=0.35))
    # pediment (triangle prism) with a relief tympanum, raking cornices, gable roof
    pz = top + 1.43
    ph = 1.9
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    hw = W / 2 - 0.1
    yb = D / 2 - 0.2
    yf = yF + 0.35
    f0 = [bm.verts.new(v) for v in ((-hw, yf, pz), (hw, yf, pz), (0, yf, pz + ph))]
    b0 = [bm.verts.new(v) for v in ((-hw, yb, pz), (hw, yb, pz), (0, yb, pz + ph))]
    ff = bm.faces.new(f0[::-1])
    for loop in ff.loops:
        loop[uvl].uv = (loop.vert.co.x / (2 * hw) + 0.5, (loop.vert.co.z - pz) / ph * 0.25)
    fb = bm.faces.new(b0)
    for loop in fb.loops:
        loop[uvl].uv = (loop.vert.co.x / (2 * hw) + 0.5, (loop.vert.co.z - pz) / ph * 0.25)
    tymp = C.new_obj("tympanum", bm, [relief])
    objs.append(tymp)
    # roof slopes with overhang
    for sx in (-1, 1):
        L = math.hypot(hw + 0.5, ph + 0.2)
        ang = math.atan2(ph + 0.2, hw + 0.5)
        ob = C.box_obj(f"roof{sx}", (L, D + 0.4, 0.22), (sx * (hw + 0.5) / 2, 0.0, pz + (ph + 0.2) / 2 - 0.02), roof,
                       rot=(0, sx * ang, 0), bevel=0.03, uv_scale=0.45)
        objs.append(ob)
        rc = C.box_obj(f"rake{sx}", (L + 0.1, 0.36, 0.26), (sx * (hw + 0.4) / 2, yF + 0.2, pz + (ph + 0.15) / 2), stone, rot=(0, sx * ang, 0), bevel=0.04, uv_scale=0.35)
        objs.append(rc)
    objs.append(C.box_obj("ridge", (0.3, D + 0.4, 0.24), (0, 0, pz + ph + 0.18), roof, bevel=0.06, uv_scale=0.45))
    # acroteria: little palmette ornaments on the gable corners and peak
    for x, z in ((0, pz + ph + 0.35), (-hw - 0.3, pz + 0.1), (hw + 0.3, pz + 0.1)):
        objs.append(cq.lathe_obj(f"acro{x}", [(0.0, 0.0), (0.22, 0.0), (0.12, 0.2), (0.24, 0.42), (0.1, 0.55), (0.0, 0.6)], stone, segs=10, loc=(x, yF + 0.2, z)))
    # bronze offering tripod in front of the steps (decoration)
    objs.append(cq.lathe_obj("brazier", [(0.0, 0.0), (0.25, 0.0), (0.12, 0.08), (0.08, 0.7), (0.32, 0.86), (0.4, 1.0), (0.0, 0.96)], bronze, segs=16,
                             loc=(W / 2 + 0.2, yF - 3.4, 0)))
    cq.paint(objs, stone, cq.stone_vcol(moss=0.75, ao_h=2.0, seed=1))
    cq.paint(objs, relief, cq.stone_vcol(moss=0.3, ao_h=8.0, seed=2))
    cq.paint(objs, roof, cq.stone_vcol(moss=0.6, ao_h=20.0, seed=3))
    r = cq.group("roman_temple", objs)
    C.export("cq_roman_temple", [r])


# =============================================================================== columns
def make_columns():
    C.reset()
    stone = stone_mats("column")
    obs = []
    a = cq.column("column_whole", stone, h=4.2, r=0.3, seed=1)
    a.append(C.box_obj("column_whole_plinth", (1.0, 1.0, 0.3), (0, 0, 0.15), stone, bevel=0.03, uv_scale=0.4))
    for o in a[:-1]:
        o.location.z += 0.3
    cq.paint(a, stone, cq.stone_vcol(moss=0.9, ao_h=1.5, seed=4))
    obs.append(cq.merge(a, "column_whole"))
    b = cq.column("column_broken", stone, h=4.2, r=0.3, broken=2.0, seed=7, capital=False)
    b.append(C.box_obj("column_broken_plinth", (1.0, 1.0, 0.3), (0, 0, 0.15), stone, bevel=0.03, uv_scale=0.4))
    for o in b[:-1]:
        o.location.z += 0.3
    # a fallen drum beside the stump
    drum = cq.lathe_obj("drum", [(0.0, 0.0), (0.3, 0.0), (0.3, 0.7), (0.0, 0.7)], stone, segs=20, loc=(0.75, -0.2, 0.3), rot=(math.pi / 2, 0, 0.6))
    b.append(drum)
    cq.paint(b, stone, cq.stone_vcol(moss=1.0, ao_h=1.2, seed=5))
    obs.append(cq.merge(b, "column_broken"))
    for o in obs:
        print(o.name, C.tris(o))
    C.export("cq_roman_columns", obs)


# =============================================================================== fountain
def make_fountain():
    C.reset()
    stone = stone_mats("fountain")
    water = C.material("fountain_water", color=(0.25, 0.55, 0.62), rough=0.08, double=True)
    fall = C.material("fountain_fall", color=(0.7, 0.88, 0.95), rough=0.1, double=True)
    bronze = C.material("fountain_bronze", tex="bronze.jpg", rough=0.4, metal=0.8)
    objs = []
    R = 2.3
    # basin: outer wall, rounded rim, inner wall, floor
    objs.append(cq.lathe_obj("basin", [(0.0, 0.05), (R - 0.3, 0.05), (R - 0.3, 0.6), (R - 0.22, 0.7), (R + 0.05, 0.72), (R + 0.12, 0.66), (R + 0.1, 0.55),
                                       (R, 0.5), (R + 0.02, 0.12), (R + 0.16, 0.06), (R + 0.16, 0.0), (0.0, 0.0)][::-1], stone, segs=48, v_scale=0.7, u_scale=6))
    objs.append(cq.lathe_obj("pool", [(0.0, 0.5), (R - 0.28, 0.5), (0.0, 0.5001)], water, segs=48, cap=False))
    # pedestal, middle bowl, upper bowl, finial
    objs.append(cq.lathe_obj("pedestal", [(0.0, 0.0), (0.55, 0.0), (0.5, 0.15), (0.32, 0.3), (0.26, 0.8), (0.3, 1.0), (0.0, 1.0)], stone, segs=24, loc=(0, 0, 0.45)))
    objs.append(cq.lathe_obj("bowl1", [(0.0, 0.0), (0.3, 0.0), (0.7, 0.12), (1.05, 0.3), (1.12, 0.38), (1.05, 0.4), (0.9, 0.3), (0.0, 0.26)], stone, segs=32, loc=(0, 0, 1.4)))
    objs.append(cq.lathe_obj("pool1", [(0.0, 0.34), (0.98, 0.34), (0.0, 0.3401)], water, segs=32, loc=(0, 0, 1.4), cap=False))
    objs.append(cq.lathe_obj("stem2", [(0.0, 0.0), (0.18, 0.0), (0.14, 0.2), (0.12, 0.6), (0.16, 0.7), (0.0, 0.7)], stone, segs=16, loc=(0, 0, 1.66)))
    objs.append(cq.lathe_obj("bowl2", [(0.0, 0.0), (0.18, 0.0), (0.45, 0.1), (0.55, 0.22), (0.5, 0.24), (0.42, 0.16), (0.0, 0.14)], stone, segs=24, loc=(0, 0, 2.3)))
    objs.append(cq.lathe_obj("pool2", [(0.0, 0.2), (0.47, 0.2), (0.0, 0.2001)], water, segs=24, loc=(0, 0, 2.3), cap=False))
    objs.append(cq.lathe_obj("finial", [(0.0, 0.0), (0.12, 0.0), (0.16, 0.12), (0.1, 0.25), (0.05, 0.38), (0.08, 0.42), (0.0, 0.5)], bronze, segs=14, loc=(0, 0, 2.45)))
    # water curtains falling from the bowl rims (v runs downward: animated in the game)
    objs.append(cq.lathe_obj("fall1", [(1.13, 1.78), (1.2, 1.4), (1.3, 0.9), (1.36, 0.52)], fall, segs=32, cap=False, v_scale=1.0))
    objs.append(cq.lathe_obj("fall2", [(0.56, 2.53), (0.62, 2.2), (0.7, 1.95), (0.76, 1.75)], fall, segs=24, cap=False, v_scale=1.0))
    objs.append(cq.lathe_obj("jet", [(0.03, 2.95), (0.05, 3.25), (0.02, 3.4)], fall, segs=8, cap=False))
    # lion-head-free spouts: four bronze shells on the basin rim
    for k in range(4):
        a = k / 4 * math.pi * 2 + math.pi / 4
        objs.append(cq.lathe_obj(f"shell{k}", [(0.0, 0.0), (0.16, 0.0), (0.2, 0.06), (0.0, 0.16)], bronze, segs=10,
                                 loc=(math.cos(a) * (R + 0.02), math.sin(a) * (R + 0.02), 0.72)))
    cq.paint(objs, stone, cq.stone_vcol(moss=0.9, ao_h=1.0, seed=6))
    r = cq.group("fountain", objs)
    C.export("cq_fountain", [r])


if __name__ == "__main__":
    which = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["temple", "columns", "fountain"]
    for w in which:
        {"temple": make_temple, "columns": make_columns, "fountain": make_fountain}[w]()
