"""Biome Frontier flora: giant rainforest tree, palm, giant-leaf plants (banana + elephant ear), canopy bush.

OW_TEX=build/tex OW_OUT=build/glb blender -b --factory-startup -P make_flora.py
Uses the Idea Grove helpers (../common.py). Leaves are alpha-clipped cards and curved strips carrying the
painted textures from textures.py, with normals bent outward so they shade softly (painterly), not as flat cards.
"""
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402


def strip(bm, pts, widths, side_dirs, uv_rect, custom, up_bias=0.6, fold=0.0):
    """A ribbon along pts (Vector list) with per-point width and side direction; u across, v along.
    `fold` lifts the edges (V-shaped leaf, like a real banana leaf), normals bent toward up."""
    uvl = bm.loops.layers.uv.verify()
    u0, v0, u1, v1 = uv_rect
    rows = []
    n = len(pts)
    for i, p in enumerate(pts):
        s = side_dirs[i].normalized()
        w = widths[i]
        nrm = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized().cross(s).normalized()
        if nrm.z < 0:
            nrm = -nrm
        lift = nrm * fold * w
        a = bm.verts.new(p - s * w / 2 + lift)
        m = bm.verts.new(p)
        b = bm.verts.new(p + s * w / 2 + lift)
        rows.append((a, m, b, i / (n - 1)))
        bn = (nrm + Vector((0, 0, up_bias))).normalized()
        for v in (a, m, b):
            custom.append((v, bn))
    for i in range(n - 1):
        a0, m0, b0, t0 = rows[i]
        a1, m1, b1, t1 = rows[i + 1]
        for (p0, p1, q1, q0, ua, ub) in ((a0, a1, m1, m0, 0.0, 0.5), (m0, m1, b1, b0, 0.5, 1.0)):
            f = bm.faces.new((p0, p1, q1, q0))
            uvs = ((ua, t0), (ua, t1), (ub, t1), (ub, t0))
            for loop, (uu, tt) in zip(f.loops, uvs):
                loop[uvl].uv = (u0 + (u1 - u0) * uu, v0 + (v1 - v0) * tt)


def finish_cards(name, bm, mat, custom):
    bm.verts.index_update()
    nrm = {v.index: n for v, n in custom}
    ob = C.new_obj(name, bm, [mat])
    C.shade_smooth(ob)
    C.apply_custom_normals(ob, nrm)
    return ob


def group(name, objs, loc=(0, 0, 0)):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root.location = loc
    for o in objs:
        o.parent = root
    print(name, "tris:", sum(C.tris(o) for o in objs if o.type == "MESH"))
    return root


# =============================================================================== giant leaf (one blade)
def big_leaf(bm, custom, base, yaw, length, width, rise, droop, rect, rng, segs=8, fold=0.18):
    d = Vector((math.cos(yaw), math.sin(yaw), 0))
    side = Vector((-d.y, d.x, 0))
    tilt = rng.uniform(-0.25, 0.25)
    pts, ws, sides = [], [], []
    for i in range(segs + 1):
        t = i / segs
        p = base + d * (length * t * 0.85) + Vector((0, 0, rise * math.sin(t * math.pi * 0.6) - droop * t * t))
        pts.append(p)
        ws.append(width * max(0.08, math.sin(min(1.0, t * 1.02) * math.pi) ** 0.45))
        sides.append(side + Vector((0, 0, tilt)))
    strip(bm, pts, ws, sides, rect, custom, fold=fold)
    return pts


def leaf_plant(name, mat, stem_mat, rect, rng, leaves=7, height=2.6, spread=1.0, length=2.2, width=0.9, rise=0.9, droop=0.9):
    bm = bmesh.new()
    custom = []
    bms = bmesh.new()
    for k in range(leaves):
        yaw = k / leaves * math.pi * 2 + rng.uniform(-0.3, 0.3)
        h = height * rng.uniform(0.55, 1.0) * (0.75 if k % 2 else 1.0)
        lean = Vector((math.cos(yaw), math.sin(yaw), 0)) * spread * rng.uniform(0.25, 0.5)
        top = Vector((0, 0, h)) + lean
        # petiole: curved stalk from the ground to the blade
        sp = C.bezier_pts(Vector((0, 0, -0.05)), Vector((0, 0, h * 0.45)), top * 0.8, top, 5)
        C.tube(bms, sp, [0.07 - 0.04 * i / 5 for i in range(6)], sides=5, cap_end=False)
        big_leaf(bm, custom, top, yaw, length * rng.uniform(0.8, 1.1), width * rng.uniform(0.85, 1.1), rise * rng.uniform(0.6, 1.1),
                 droop * rng.uniform(0.7, 1.3), rect, rng)
    lo = finish_cards(name + "_leaves", bm, mat, custom)
    st = C.new_obj(name + "_stalks", bms, [stem_mat])
    C.shade_smooth(st)
    return [lo, st]


# =============================================================================== giant rainforest tree
def jungle_tree(name, seed, s=1.0):
    rng = random.Random(seed)
    bark = C.material(name + "_bark", tex="bark.jpg", normal="bark_n.jpg", rough=0.9, vcol=True, normal_strength=1.4)
    canopy = C.material(name + "_leaves", tex="canopy.png", rough=0.7, alpha_tex=True, double=True)
    big = C.material(name + "_bigleaves", tex="bigleaf.png", rough=0.6, alpha_tex=True, double=True)
    core = C.material(name + "_core", color=(0.06, 0.2, 0.08), rough=0.95)
    vine_m = C.material(name + "_vines", color=(0.22, 0.36, 0.14), rough=0.9)
    bm = bmesh.new()
    H = 11.0 * s
    tpts, trad = [], []
    for i in range(18):
        t = i / 17
        tpts.append(Vector((math.sin(t * 2.2 + seed) * 0.35 * s, math.cos(t * 1.7 + seed) * 0.3 * s, t * H - 0.3 * s)))
        trad.append((1.0 - 0.55 * t ** 0.6) * s)

    def flare(i, a):
        k = max(0.0, 1 - i / 4.5)
        return (k ** 2.2) * s * (1.6 * max(0.0, math.sin(a * 3 + seed)) ** 3 + 0.25)

    C.tube(bm, tpts, trad, sides=18, twist=0.04, noise_amp=0.1, noise_scale=0.8 / s, seed=seed, v_scale=1 / (2.4 * s),
           u_repeat=3.0, flare=flare)
    top = tpts[-1]
    clumps = []
    vine_from = []
    for li in range(5):
        a = li / 5 * math.pi * 2 + rng.uniform(-.3, .3)
        d = Vector((math.cos(a), math.sin(a), 0))
        p0 = tpts[13 + li % 3]
        reach = rng.uniform(3.5, 5.0) * s
        p3 = p0 + d * reach + Vector((0, 0, rng.uniform(1.5, 2.8) * s))
        pts = C.bezier_pts(p0, p0 + d * reach * 0.3 + Vector((0, 0, 0.9 * s)), p0 + d * reach * 0.7 + Vector((0, 0, 1.2 * s)), p3, 9)
        C.tube(bm, pts, [(0.42 - 0.32 * i / 9) * s for i in range(10)], sides=8, noise_amp=0.1, noise_scale=1 / s, seed=seed + li,
               v_scale=1 / (2 * s))
        clumps.append((p3 + Vector((0, 0, 0.6 * s)), rng.uniform(2.6, 3.3) * s))
        clumps.append((pts[5] + Vector((0, 0, 0.6 * s)), rng.uniform(1.8, 2.3) * s))
        vine_from += [pts[4], pts[7]]
    clumps.append((top + Vector((0, 0, 1.4 * s)), 3.0 * s))
    wood = C.new_obj(name + "_wood", bm, [bark])
    C.shade_smooth(wood)

    def bark_col(p, n):
        ao = min(1.0, 0.5 + 0.5 * min(1.0, max(0.0, (p.z + 0.3) / (3.0 * s))))
        mossn = max(0.0, n.z - 0.2) * 1.8 * (0.5 + 0.5 * C.fbm(p * 0.6, 3)) + (0.5 if p.z < 1.5 * s else 0.0) * max(0.0, C.fbm(p * 1.1, 2) + 0.3)
        base = Vector((0.92, 0.88, 0.8)) * ao
        c = base.lerp(Vector((0.36, 0.58, 0.24)) * ao, min(1.0, mossn))
        return (c.x, c.y, c.z)

    C.paint_vcol(wood, bark_col)
    # canopy cores + leaf cards
    bmc = bmesh.new()
    for (cp, cr) in clumps:
        res = bmesh.ops.create_icosphere(bmc, subdivisions=2, radius=cr * 0.7)
        for v in res["verts"]:
            v.co = Vector((v.co.x, v.co.y, v.co.z * 0.6)) + cp
    core_ob = C.new_obj(name + "_core", bmc, [core])
    C.shade_smooth(core_ob)
    bml = bmesh.new()
    custom = []
    for (cp, cr) in clumps:
        C.leaf_clump(bml, cp, cr, 50, rng, custom, flat=0.75)
    leaves = finish_cards(name + "_leaves", bml, canopy, custom)
    # giant drooping leaves hanging out of the crown edge (the concept's banana-like leaves)
    bmb = bmesh.new()
    cb = []
    for (cp, cr) in clumps[:10]:
        for k in range(3):
            yaw = rng.uniform(0, math.pi * 2)
            base = cp + Vector((math.cos(yaw), math.sin(yaw), 0)) * cr * 0.85 + Vector((0, 0, -cr * 0.35))
            big_leaf(bmb, cb, base, yaw, 2.4 * s, 1.0 * s, 0.35 * s, 1.4 * s, (0.0, 0.0, 0.5, 1.0), rng, segs=6)
    bigl = finish_cards(name + "_bigleaves", bmb, big, cb)
    # hanging vines (lianas)
    bmv = bmesh.new()
    for vp in vine_from:
        L = rng.uniform(3.0, 6.5) * s
        pts = [vp + Vector((math.sin(i * 0.9 + vp.x) * 0.15, math.cos(i * 0.7) * 0.15, -L * i / 8)) for i in range(9)]
        C.tube(bmv, pts, [0.05 * s] * 9, sides=4, cap_end=False)
    vines = C.new_obj(name + "_vines", bmv, [vine_m])
    return group(name, [wood, core_ob, leaves, bigl, vines])


# =============================================================================== palm
def palm(name, seed, s=1.0):
    rng = random.Random(seed)
    bark = C.material(name + "_trunk", tex="bark.jpg", normal="bark_n.jpg", rough=0.9, vcol=True)
    frond_m = C.material(name + "_fronds", tex="palm_frond.png", rough=0.7, alpha_tex=True, double=True)
    nut = C.material(name + "_coconut", color=(0.36, 0.24, 0.12), rough=0.7)
    bm = bmesh.new()
    H = 7.5 * s
    lean = rng.uniform(1.2, 2.2) * s
    pts, rad = [], []
    for i in range(22):
        t = i / 21
        pts.append(Vector((lean * t * t, 0, t * H)))
        ring = 0.04 * s * (1 if i % 2 else -1)
        rad.append((0.24 - 0.09 * t) * s + ring + (0.14 * s if i == 0 else 0))
    C.tube(bm, pts, rad, sides=12, v_scale=1 / (1.2 * s), u_repeat=2.0)
    trunk = C.new_obj(name + "_trunk", bm, [bark])
    C.shade_smooth(trunk)
    C.paint_vcol(trunk, lambda p, n: (0.9, 0.84, 0.7) if int(p.z / (0.35 * s)) % 2 else (0.78, 0.7, 0.56))
    top = pts[-1]
    bmf = bmesh.new()
    custom = []
    n = 13
    for k in range(n):
        yaw = k / n * math.pi * 2 + rng.uniform(-0.15, 0.15)
        d = Vector((math.cos(yaw), math.sin(yaw), 0))
        side = Vector((-d.y, d.x, 0))
        L = rng.uniform(3.6, 4.4) * s
        up = rng.uniform(0.6, 1.3) * s
        fp, ws, sd = [], [], []
        for i in range(9):
            t = i / 8
            fp.append(top + d * L * t + Vector((0, 0, up * math.sin(t * math.pi * 0.55) - 1.8 * s * t * t)))
            ws.append(1.6 * s * max(0.1, math.sin(min(1, t * 1.1) * math.pi) ** 0.5))
            sd.append(side)
        strip(bmf, fp, ws, sd, (0, 0, 1, 1), custom, fold=-0.12)
    fr = finish_cards(name + "_fronds", bmf, frond_m, custom)
    bmn = bmesh.new()
    for k in range(5):
        a = k / 5 * 6.28
        res = bmesh.ops.create_icosphere(bmn, subdivisions=2, radius=0.17 * s)
        for v in res["verts"]:
            v.co += top + Vector((math.cos(a) * 0.28 * s, math.sin(a) * 0.28 * s, -0.3 * s))
    nuts = C.new_obj(name + "_coconuts", bmn, [nut])
    C.shade_smooth(nuts)
    return group(name, [trunk, fr, nuts])


if __name__ == "__main__":
    C.reset()
    r = jungle_tree("jungle_tree", seed=11, s=1.0)
    C.export("jungle_tree", [r])
    C.reset()
    r = palm("palm", seed=5, s=1.0)
    C.export("palm", [r])
    C.reset()
    rng = random.Random(21)
    leaf = C.material("bigleaf", tex="bigleaf.png", rough=0.6, alpha_tex=True, double=True)
    stem = C.material("bigleaf_stem", color=(0.32, 0.5, 0.18), rough=0.8)
    a = group("bigleaf_banana", leaf_plant("bigleaf_banana", leaf, stem, (0.0, 0.0, 0.5, 1.0), rng, leaves=7, height=2.4, length=2.4,
                                           width=0.95, rise=0.7, droop=0.9))
    b = group("bigleaf_ear", leaf_plant("bigleaf_ear", leaf, stem, (0.5, 0.0, 1.0, 1.0), rng, leaves=6, height=1.3, length=1.5,
                                        width=1.0, rise=0.4, droop=0.6))
    c = group("bigleaf_sprout", leaf_plant("bigleaf_sprout", leaf, stem, (0.0, 0.0, 0.5, 1.0), rng, leaves=4, height=0.7, length=0.9,
                                           width=0.45, rise=0.3, droop=0.25))
    C.export("giant_leaf_plants", [a, b, c])
