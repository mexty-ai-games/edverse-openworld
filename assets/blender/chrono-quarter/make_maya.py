"""Classic Maya (250-900 CE): stepped pyramid with a temple and roof comb, carved stela with altar.

OW_TEX=build/tex OW_OUT=build/glb blender -b --factory-startup -P make_maya.py [-- pyramid stela]
The pyramid's footprint is 13 x 13 m (front stair toward -Y reaches 9.2 m out from the centre).
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


def frustum(name, mat, hx0, hy0, hx1, hy1, z0, h, uv_scale=0.5):
    """A sloped (talud) tier: bottom rectangle -> smaller top rectangle, box-projected UVs."""
    bm = bmesh.new()
    b = [bm.verts.new(v) for v in ((-hx0, -hy0, z0), (hx0, -hy0, z0), (hx0, hy0, z0), (-hx0, hy0, z0))]
    t = [bm.verts.new(v) for v in ((-hx1, -hy1, z0 + h), (hx1, -hy1, z0 + h), (hx1, hy1, z0 + h), (-hx1, hy1, z0 + h))]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((b[i], b[j], t[j], t[i]))
    bm.faces.new(t)
    ob = C.new_obj(name, bm, [mat])
    md = ob.modifiers.new("bev", "BEVEL")
    md.width = 0.05
    md.segments = 2
    cq.C.apply_all(ob)
    C.box_uv(ob, uv_scale)
    C.shade_flat_bevel(ob)
    return ob


def make_pyramid():
    C.reset()
    rng = random.Random(11)
    stone = C.material("pyr_limestone", tex="limestone.jpg", normal="limestone_n.jpg", rough=0.9, vcol=True, normal_strength=1.3)
    plaster = C.material("pyr_plaster", tex="plaster.jpg", rough=0.9, vcol=True)
    stair = C.material("pyr_stairs", tex="limestone.jpg", rough=0.9, vcol=True)
    dark = C.material("pyr_shadow", color=(0.06, 0.05, 0.04), rough=1.0)
    vines = C.material("pyr_vines", tex="vines.png", rough=0.8, alpha_tex=True, double=True)
    leaf = C.material("pyr_leaves", tex="broadleaf.png", rough=0.7, alpha_tex=True, double=True)
    fern = C.material("pyr_fern", tex="fern.png", rough=0.8, alpha_tex=True, double=True)
    objs = []
    tiers = 7
    TH = 1.05
    half0, step_in = 6.5, 0.62
    tops = []
    for i in range(tiers):
        hb = half0 - i * step_in
        ht = hb - 0.18
        z0 = i * TH
        objs.append(frustum(f"tier{i}", stone, hb, hb, ht, ht, z0, TH * 0.82, uv_scale=0.26))
        # moulding band (apron) on top of the talud
        objs.append(C.box_obj(f"apron{i}", (ht * 2 + 0.12, ht * 2 + 0.12, TH * 0.18), (0, 0, z0 + TH * 0.82 + TH * 0.09), stone, bevel=0.03, uv_scale=0.26))
        tops.append((ht, z0 + TH))
    topH = tiers * TH
    # front staircase (toward -Y) between sloped balustrades
    SW = 3.4
    nsteps = 28
    run = (half0 - (half0 - (tiers - 1) * step_in - 0.18)) + 2.7
    y_front = -half0 - 2.7
    for k in range(nsteps):
        t = (k + 1) / nsteps
        z = topH * t
        y = y_front + run * (k / nsteps)
        depth = run / nsteps + 0.02
        objs.append(C.box_obj(f"stair{k}", (SW, depth + 0.6, topH / nsteps), (0, y + depth / 2 + 0.3, z - topH / nsteps / 2), stair, bevel=0.03, segments=1, uv_scale=0.18,
                              noise_amp=0.01, seed=k))
    # fill under the stairs
    bm = bmesh.new()
    a = [bm.verts.new(v) for v in ((-SW / 2, y_front, 0), (SW / 2, y_front, 0), (SW / 2, y_front + run, topH), (-SW / 2, y_front + run, topH))]
    bb = [bm.verts.new(v) for v in ((-SW / 2, y_front + run, 0), (SW / 2, y_front + run, 0))]
    bm.faces.new((a[0], bb[0], a[3]))
    bm.faces.new((a[1], a[2], bb[1]))
    under = C.new_obj("stair_fill", bm, [stone])
    C.box_uv(under, 0.45)
    objs.append(under)
    ang = math.atan2(topH, run)
    L = math.hypot(topH, run)
    for sx in (-1, 1):
        objs.append(C.box_obj(f"balustrade{sx}", (0.55, L, 0.45), (sx * (SW / 2 + 0.27), y_front + run / 2, topH / 2 + 0.1), stone,
                              rot=(ang, 0, 0), bevel=0.04, uv_scale=0.45))
    # temple on the top platform: walls with a doorway, roof, and a lattice roof comb
    tz = topH
    tw, td, th = 4.4, 3.2, 2.3
    objs.append(C.box_obj("temple_floor", (tw + 0.8, td + 0.8, 0.25), (0, 0.2, tz + 0.12), stone, bevel=0.03, uv_scale=0.45))
    objs.append(C.box_obj("temple", (tw, td, th), (0, 0.3, tz + 0.25 + th / 2), plaster, bevel=0.04, uv_scale=0.45, noise_amp=0.02, seed=2))
    objs.append(C.box_obj("temple_door", (1.2, 0.3, 1.6), (0, 0.3 - td / 2 + 0.1, tz + 0.25 + 0.8), dark, bevel=0.0))
    for sx in (-1, 1):
        objs.append(C.box_obj(f"temple_side_door{sx}", (0.7, 0.3, 1.3), (sx * 1.45, 0.3 - td / 2 + 0.1, tz + 0.25 + 0.65), dark, bevel=0.0))
    objs.append(frustum("temple_roof", stone, tw / 2 + 0.25, td / 2 + 0.25, tw / 2 - 0.4, td / 2 - 0.6, tz + 0.25 + th, 1.0, uv_scale=0.45))
    objs[-1].location.y += 0.3
    # roof comb: a pierced wall
    cz = tz + 0.25 + th + 1.0
    for k in range(5):
        x = -1.6 + k * 0.8
        objs.append(C.box_obj(f"comb_post{k}", (0.32, 0.4, 1.6), (x, 0.5, cz + 0.8), stone, bevel=0.03, uv_scale=0.45))
    for z in (cz + 0.05, cz + 0.8, cz + 1.55):
        objs.append(C.box_obj(f"comb_bar{z}", (3.6, 0.42, 0.22), (0, 0.5, z), stone, bevel=0.03, uv_scale=0.45))
    # jungle reclaiming the pyramid: vines hanging over the tier edges, plants on the ledges
    anchors = []
    for i, (ht, z) in enumerate(tops):
        for k in range(10):
            side = rng.randrange(4)
            s = rng.uniform(-ht + 0.4, ht - 0.4)
            if side == 0 and abs(s) < SW / 2 + 0.6:
                continue
            out = [Vector((0, -1, 0)), Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((-1, 0, 0))][side]
            pos = [Vector((s, -ht - 0.08, z)), Vector((ht + 0.08, s, z)), Vector((s, ht + 0.08, z)), Vector((-ht - 0.08, s, z))][side]
            anchors.append((pos, out))
    objs.append(cq.hanging_vines("vines", vines, anchors, rng, length=(0.6, 1.4), width=0.7))
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    custom = []
    bmf = bmesh.new()
    uvf = bmf.loops.layers.uv.verify()
    customf = []
    for i, (ht, z) in enumerate(tops[:-1]):
        for k in range(7):
            side = rng.randrange(4)
            s = rng.uniform(-ht + 0.3, ht - 0.3)
            if side == 0 and abs(s) < SW / 2 + 0.7:
                continue
            ledge = ht - step_in * 0.5
            pos = [Vector((s, -ledge, z)), Vector((ledge, s, z)), Vector((s, ledge, z)), Vector((-ledge, s, z))][side]
            if rng.random() < 0.55:
                cq.leaf_tuft(bm, uvl, pos, rng, custom, n=5, length=0.75, width=0.38, lift=0.55, droop=0.25)
            else:
                cq.leaf_tuft(bmf, uvf, pos, rng, customf, n=6, length=0.6, width=0.3, lift=0.35, droop=0.25)
    # bigger plants around the base
    for k in range(16):
        a = k / 16 * math.pi * 2
        r = half0 + 0.4
        p = Vector((math.cos(a) * r * 1.05, math.sin(a) * r * 1.05, 0))
        if p.y < -half0 + 0.5 and abs(p.x) < SW / 2 + 1.0:
            continue
        cq.leaf_tuft(bm, uvl, p, rng, custom, n=7, length=1.3, width=0.6, lift=1.0, droop=0.35)
    objs.append(cq.finish_cards("ledge_plants", bm, leaf, custom))
    objs.append(cq.finish_cards("ledge_ferns", bmf, fern, customf))
    cq.paint(objs, stone, cq.stone_vcol(moss=1.0, ao_h=4.0, seed=12, base=(1.0, 0.97, 0.9), moss_col=(0.42, 0.55, 0.28)))
    cq.paint(objs, plaster, cq.stone_vcol(moss=0.7, ao_h=12.0, seed=13))

    def stair_col(p, n):
        k = 1.0 if n.z > 0.5 else 0.62
        m = max(0.0, C.fbm(p * 1.2, 2) + 0.1) * (0.6 if n.z > 0.5 else 0.2)
        c = Vector((1.0, 0.96, 0.88)).lerp(Vector((0.5, 0.6, 0.32)), min(1.0, m)) * k
        return (c.x, c.y, c.z)
    cq.paint(objs, stair, stair_col)
    r = cq.group("maya_pyramid", objs)
    C.export("cq_maya_pyramid", [r])


def make_stela():
    C.reset()
    glyph = C.material("stela_glyphs", tex="glyph_panel.jpg", normal="glyph_panel_n.jpg", rough=0.9, vcol=True, normal_strength=1.5)
    stone = C.material("stela_limestone", tex="limestone.jpg", normal="limestone_n.jpg", rough=0.9, vcol=True)
    objs = []
    W, Dp, H = 1.05, 0.42, 3.0
    # slab with front/back glyph faces and plain sides, slightly rounded top
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    cols, rows = 6, 14
    def pos(i, j, side):
        x = -W / 2 + W * i / cols
        z = H * j / rows
        top_round = 0.18 * (1 - (2 * i / cols - 1) ** 2) if j == rows else 0.0
        y = side * Dp / 2 * (1 - 0.06 * (z / H))
        return Vector((x * (1 - 0.05 * z / H), y, z + top_round))
    for side in (-1, 1):
        grid = [[bm.verts.new(pos(i, j, side)) for i in range(cols + 1)] for j in range(rows + 1)]
        for j in range(rows):
            for i in range(cols):
                q = (grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i])
                f = bm.faces.new(q if side < 0 else q[::-1])
                for loop in f.loops:
                    v = loop.vert.co
                    loop[uvl].uv = ((v.x / W + 0.5) if side < 0 else (0.5 - v.x / W), min(1.0, v.z / H))
    face = C.new_obj("stela_faces", bm, [glyph])
    objs.append(face)
    # sides and top as a thin rim (stone): bridge the two faces' outlines
    bm = bmesh.new()
    outline = [(i, 0) for i in range(cols + 1)] + [(cols, j) for j in range(1, rows + 1)] + [(i, rows) for i in range(cols - 1, -1, -1)] + [(0, j) for j in range(rows - 1, 0, -1)]
    fr = [bm.verts.new(pos(i, j, -1)) for i, j in outline]
    bk = [bm.verts.new(pos(i, j, 1)) for i, j in outline]
    n = len(outline)
    for k in range(n):
        k2 = (k + 1) % n
        if outline[k][1] == 0 and outline[k2][1] == 0:
            continue
        bm.faces.new((fr[k], fr[k2], bk[k2], bk[k]))
    rim = C.new_obj("stela_rim", bm, [stone])
    C.box_uv(rim, 0.6)
    objs.append(rim)
    for o in objs:
        for v in o.data.vertices:
            v.co += Vector((0, C.fbm(v.co * 3 + Vector((2, 5, 1))) * 0.02, 0))
    # round altar stone in front
    altar = cq.lathe_obj("altar", [(0.0, 0.0), (0.62, 0.0), (0.66, 0.08), (0.64, 0.36), (0.58, 0.42), (0.0, 0.42)], stone, segs=20, loc=(0, -1.25, 0), v_scale=0.6, u_scale=3)
    for v in altar.data.vertices:
        v.co += Vector((C.fbm(v.co * 2), C.fbm(v.co * 2 + Vector((4, 0, 0))), 0)) * 0.03
    objs.append(altar)
    objs.append(C.box_obj("stela_footing", (1.6, 1.0, 0.16), (0, 0, 0.04), stone, bevel=0.04, uv_scale=0.6, noise_amp=0.02))
    cq.paint(objs, glyph, cq.stone_vcol(moss=0.8, ao_h=1.6, seed=14))
    cq.paint(objs, stone, cq.stone_vcol(moss=1.0, ao_h=0.8, seed=15))
    r = cq.group("maya_stela", objs)
    C.export("cq_maya_stela", [r])


if __name__ == "__main__":
    which = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["pyramid", "stela"]
    for w in which:
        {"pyramid": make_pyramid, "stela": make_stela}[w]()
