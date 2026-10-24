"""Ground foliage for dense, layered planting: fern clump, four wildflower clumps, grass tuft.

blender --background --factory-startup --python make_foliage.py
Cards use the painted alpha textures; normals are bent upward so they shade softly like a
painted canopy instead of flat cards. Each mesh has its origin at the base for instancing.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402


def frond(bm, uvl, yaw, length, width, droop, lift, custom, segs=5):
    """A curved strip carrying the fern texture: rises, arches and droops."""
    d = Vector((math.cos(yaw), math.sin(yaw), 0))
    side = Vector((-d.y, d.x, 0))
    rows = []
    for i in range(segs + 1):
        t = i / segs
        p = d * (length * t * 0.9) + Vector((0, 0, lift * math.sin(t * math.pi * 0.75) - droop * t * t))
        w = width * (0.5 + 0.5 * math.sin(min(1.0, t * 1.4) * math.pi * 0.9))
        a = bm.verts.new(p - side * w / 2)
        b = bm.verts.new(p + side * w / 2)
        rows.append((a, b, t))
    for i in range(segs):
        a0, b0, t0 = rows[i]
        a1, b1, t1 = rows[i + 1]
        f = bm.faces.new((a0, a1, b1, b0))
        for loop, uv in zip(f.loops, ((0, t0), (0, t1), (1, t1), (1, t0))):
            loop[uvl].uv = uv
    for a, b, t in rows:
        n = (Vector((0, 0, 1)) * 0.8 + d * 0.3).normalized()
        custom.append((a, n))
        custom.append((b, n))


def make_fern(rng):
    mat = C.material("fern", tex="fern.png", rough=0.8, alpha_tex=True, double=True)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    custom = []
    n = 11
    for k in range(n):
        yaw = k / n * math.pi * 2 + rng.uniform(-.2, .2)
        frond(bm, uvl, yaw, rng.uniform(0.85, 1.2), rng.uniform(0.42, 0.55), rng.uniform(0.25, 0.45), rng.uniform(0.45, 0.7), custom)
    # a few young upright fronds in the middle
    for k in range(3):
        frond(bm, uvl, rng.uniform(0, 6.28), 0.5, 0.3, 0.0, 0.75, custom, segs=3)
    bm.verts.index_update()
    nrm = {v.index: nn for v, nn in custom}
    ob = C.new_obj("fern", bm, [mat])
    C.shade_smooth(ob)
    C.apply_custom_normals(ob, nrm)
    return ob


def clump(name, mat, quad, rng, n=4, h=0.55, w=0.6):
    bm = bmesh.new()
    custom = []
    u0, v0 = quad
    for k in range(n):
        a = k / n * math.pi + rng.uniform(-.25, .25)
        d = Vector((math.cos(a), math.sin(a), 0))
        off = Vector((rng.uniform(-.08, .08), rng.uniform(-.08, .08), 0))
        f = C.card(bm, off + Vector((0, 0, 0.5)), d, 1.0, (u0, v0, u0 + 0.5, v0 + 0.5), custom=custom)
        for v in f.verts:
            v.co = Vector((off.x + (v.co.x - off.x) * w, off.y + (v.co.y - off.y) * w, v.co.z * h))
    bm.verts.index_update()
    nrm = {v.index: Vector((0, 0, 1)) for v, _ in custom}
    ob = C.new_obj(name, bm, [mat])
    C.apply_custom_normals(ob, nrm)
    return ob


if __name__ == "__main__":
    rng = random.Random(9)
    C.reset()
    f = make_fern(rng)
    C.export("fern", [f])
    C.reset()
    mat = C.material("wildflowers", tex="flowers.png", rough=0.8, alpha_tex=True, double=True)
    # flowers.png quadrants: blue (top-left in the image), yellow, pink, white; Blender v is flipped
    obs = [clump("flowers_blue", mat, (0, 0.5), rng), clump("flowers_yellow", mat, (0.5, 0.5), rng),
           clump("flowers_pink", mat, (0, 0), rng), clump("flowers_white", mat, (0.5, 0), rng)]
    C.export("flowers", obs)
    C.reset()
    gm = C.material("grass_tuft", tex="grass_card.png", rough=0.85, alpha_tex=True, double=True)
    bm = bmesh.new()
    custom = []
    for k in range(3):
        a = k / 3 * math.pi
        d = Vector((math.cos(a), math.sin(a), 0))
        fc = C.card(bm, Vector((0, 0, 0.5)), d, 1.0, (0, 0, 1, 1), custom=custom)
        for v in fc.verts:
            v.co = Vector((v.co.x * 0.9, v.co.y * 0.9, v.co.z * 0.42))
    bm.verts.index_update()
    idx = [v.index for v, _ in custom]
    g = C.new_obj("grass_tuft", bm, [gm])
    C.apply_custom_normals(g, {i: Vector((0, 0, 1)) for i in idx})
    C.export("grass_tuft", [g])
