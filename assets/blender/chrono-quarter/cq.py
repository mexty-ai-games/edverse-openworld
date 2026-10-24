"""Shared helpers for the Chrono Quarter Blender scripts (Blender 4.2, headless).

Builds on the Idea Grove's helpers (../common.py, ../make_props.py: lathe, tubes, bevelled boxes,
leaf cards, PBR materials). Run every script with OW_TEX (textures from textures.py) and OW_OUT set.
Conventions: metres, Z-up in Blender (exported Y-up); a model's front faces -Y (= +Z in three.js);
origin at the base centre.
"""
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import common as C  # noqa: E402
import make_props as P  # noqa: E402  (lathe_obj, torus_obj, group)

lathe_obj = P.lathe_obj
torus_obj = P.torus_obj
group = P.group


def quad_obj(name, mat, w, h, loc=(0, 0, 0), rot=(0, 0, 0), uv=(0, 0, 1, 1)):
    """A single upright quad in the XZ plane facing -Y, w x h, origin at its centre."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    vs = [bm.verts.new(v) for v in ((-w / 2, 0, -h / 2), (w / 2, 0, -h / 2), (w / 2, 0, h / 2), (-w / 2, 0, h / 2))]
    f = bm.faces.new(vs)
    u0, v0, u1, v1 = uv
    for loop, t in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
        loop[uvl].uv = t
    ob = C.new_obj(name, bm, [mat])
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def fluted_lathe(bm, profile, segs=24, flutes=0, depth=0.0, flute_z=(0.0, 0.0), u_scale=1.0, v_scale=1.0):
    """Like C.lathe, with optional vertical flutes between flute_z heights (a classical column shaft)."""
    uv = bm.loops.layers.uv.verify()
    rings = []
    L = 0.0
    prev = None
    for r, z in profile:
        if prev:
            L += math.hypot(r - prev[0], z - prev[1])
        prev = (r, z)
        ring = []
        for k in range(segs):
            a = k / segs * math.pi * 2
            rr = r
            if flutes and flute_z[0] <= z <= flute_z[1]:
                rr = r * (1 - depth * abs(math.sin(a * flutes / 2)) ** 0.6)
            ring.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, z)))
        rings.append((ring, L))
    for i in range(len(rings) - 1):
        a, la = rings[i]
        b, lb = rings[i + 1]
        for k in range(segs):
            k2 = (k + 1) % segs
            f = bm.faces.new((a[k], a[k2], b[k2], b[k]))
            u1 = (k + 1) / segs
            for loop, (uu, vv) in zip(f.loops, ((k / segs, la), (u1, la), (u1, lb), (k / segs, lb))):
                loop[uv].uv = (uu * u_scale, vv * v_scale)
    return rings


def column(name, mat, h=5.0, r=0.36, loc=(0, 0, 0), broken=0.0, seed=0, capital=True, segs=24):
    """A classical column: moulded base, fluted shaft with entasis, Ionic-style capital with volutes.
    broken>0: the shaft stops at that height with a jagged top (a ruin)."""
    objs = []
    bm = bmesh.new()
    base = [(r * 1.42, 0.0), (r * 1.42, 0.14), (r * 1.3, 0.18), (r * 1.22, 0.24), (r * 1.25, 0.3), (r * 1.08, 0.36), (r * 1.06, 0.42)]
    top = h - (0.55 if capital else 0.1)
    shaft = []
    n = 12
    stop = broken if broken > 0 else top
    for i in range(n + 1):
        t = i / n
        z = 0.42 + (stop - 0.42) * t
        tt = (z - 0.42) / (top - 0.42)
        rr = r * (1.0 - 0.14 * tt ** 1.4 + 0.03 * math.sin(tt * math.pi))
        shaft.append((rr, z))
    prof = base + shaft
    if not broken:
        prof += [(r * 0.92, top + 0.04), (r * 1.0, top + 0.08), (r * 0.94, top + 0.12)]
    rings = fluted_lathe(bm, prof, segs=segs, flutes=20, depth=0.06, flute_z=(0.43, top - 0.01), u_scale=1.5, v_scale=0.5)
    if broken:
        # jagged broken top: lift and drop the last ring's vertices, then cap
        rng = random.Random(seed)
        last = rings[-1][0]
        for v in last:
            v.co.z += rng.uniform(-0.18, 0.12)
        mid = bm.verts.new((0, 0, stop - 0.05))
        for k in range(len(last)):
            bm.faces.new((last[k], last[(k + 1) % len(last)], mid))
    else:
        top_ring = rings[-1][0]
        c = bm.verts.new((0, 0, prof[-1][1]))
        for k in range(len(top_ring)):
            bm.faces.new((top_ring[k], top_ring[(k + 1) % len(top_ring)], c))
    ob = C.new_obj(name, bm, [mat])
    C.shade_smooth(ob)
    objs.append(ob)
    if capital and not broken:
        z0 = top + 0.12
        objs.append(lathe_obj(name + "_echinus", [(0.0, 0.0), (r * 0.98, 0.0), (r * 1.22, 0.1), (r * 1.25, 0.18), (r * 1.1, 0.24), (0.0, 0.24)], mat, segs=segs, loc=(0, 0, z0)))
        objs.append(C.box_obj(name + "_abacus", (r * 3.1, r * 2.6, 0.13), (0, 0, z0 + 0.3), mat, bevel=0.025, uv_scale=0.6))
        # volutes: spiral scrolls on both sides, front and back
        for sx in (-1, 1):
            bmv = bmesh.new()
            pts = []
            for i in range(26):
                t = i / 25
                a = t * math.pi * 3.2
                rr = r * 0.48 * (1 - t * 0.8)
                pts.append(Vector((sx * (r * 1.12 + math.cos(a) * rr * 0.3), math.sin(a) * rr * 0.15, -math.sin(a + 0.4) * rr + r * 0.1)))
            # a fat scroll cylinder along Y with the spiral as its face pattern: use a short tube per side
            C.tube(bmv, [Vector((sx * r * 1.15, -r * 1.25, 0)), Vector((sx * r * 1.15, r * 1.25, 0))], [r * 0.34, r * 0.34], sides=10, u_repeat=1.0)
            vo = C.new_obj(name + f"_volute{sx}", bmv, [mat])
            C.shade_smooth(vo)
            vo.location = (0, 0, z0 + 0.1)
            objs.append(vo)
            for sy in (-1, 1):
                sp = torus_obj(name + f"_eye{sx}{sy}", r * 0.2, r * 0.05, mat, loc=(sx * r * 1.15, sy * r * 1.27, z0 + 0.1), rot=(math.pi / 2, 0, 0), seg=10, rseg=4)
                objs.append(sp)
    for o in objs:
        o.location = Vector(o.location) + Vector(loc)
    return objs


def stone_vcol(moss=0.8, ao_h=1.2, seed=0, base=(1.0, 0.97, 0.92), moss_col=(0.45, 0.6, 0.3)):
    """Vertex colour: darker near the ground, moss on up-facing and low surfaces."""
    off = Vector((seed * 3.1, seed * 1.7, 0))

    def fn(p, n):
        ao = 0.62 + 0.38 * min(1.0, max(0.0, (p.z + 0.05) / ao_h))
        m = max(0.0, n.z - 0.4) * 1.4 * max(0.0, C.fbm(p * 0.9 + off, 3) + 0.15)
        m += (0.7 if p.z < 0.35 else 0.0) * max(0.0, C.fbm(p * 1.6 + off, 2) + 0.05)
        c = Vector(base).lerp(Vector(moss_col), min(1.0, m * moss)) * ao
        return (c.x, c.y, c.z)

    return fn


def paint(objs, mat, fn):
    for o in objs:
        if o.type == "MESH" and o.data.materials and o.data.materials[0] == mat:
            C.paint_vcol(o, fn)


def card_cluster(name, mat, cards, custom_up=True):
    """cards: list of (center, normal, size, uv_rect, rot). Leaf cards with normals bent upward."""
    bm = bmesh.new()
    custom = []
    for c, n, s, uvr, rot in cards:
        C.card(bm, c, n, s, uvr, rot=rot, custom=custom)
    bm.verts.index_update()
    nrm = {v.index: (nn * 0.4 + Vector((0, 0, 1))).normalized() for v, nn in custom}
    ob = C.new_obj(name, bm, [mat])
    C.shade_smooth(ob)
    if custom_up:
        C.apply_custom_normals(ob, nrm)
    return ob


def strip(bm, uvl, pts, widths, side_fn, v0=0.0, v1=1.0, u0=0.0, u1=1.0):
    """A ribbon through pts (list of Vector) with per-point width, sideways given by side_fn(i)."""
    rows = []
    for i, p in enumerate(pts):
        s = side_fn(i) * widths[i] / 2
        rows.append((bm.verts.new(p - s), bm.verts.new(p + s), v0 + (v1 - v0) * i / (len(pts) - 1)))
    for i in range(len(rows) - 1):
        a0, b0, t0 = rows[i]
        a1, b1, t1 = rows[i + 1]
        f = bm.faces.new((a0, b0, b1, a1))
        for loop, uv in zip(f.loops, ((u0, t0), (u1, t0), (u1, t1), (u0, t1))):
            loop[uvl].uv = uv
    return rows


def hanging_vines(name, mat, anchors, rng, length=(0.8, 1.6), width=0.5):
    """Vine curtains (vines.png) hanging from anchor points along a direction facing outward."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    custom = []
    for p, out in anchors:
        L = rng.uniform(*length)
        side = Vector((-out.y, out.x, 0)).normalized()
        u0 = rng.choice((0.0, 0.33, 0.66))
        pts = [p + out * (0.06 + 0.05 * t) + Vector((0, 0, -L * t)) for t in (0, 0.5, 1)]
        rows = strip(bm, uvl, pts, [width] * 3, lambda i: side, v0=1.0, v1=1.0 - min(1.0, L / 1.6), u0=u0, u1=u0 + 0.34)
        for a, b, _ in rows:
            custom.append((a, out))
            custom.append((b, out))
    bm.verts.index_update()
    nrm = {v.index: (n * 0.7 + Vector((0, 0, 0.5))).normalized() for v, n in custom}
    ob = C.new_obj(name, bm, [mat])
    C.shade_smooth(ob)
    C.apply_custom_normals(ob, nrm)
    return ob


def leaf_tuft(bm, uvl, center, rng, custom, n=6, length=0.9, width=0.4, lift=0.6, droop=0.3, uv=(0, 0, 1, 1)):
    """A clump of arching leaf strips (a broadleaf plant / palm crown) radiating from center."""
    u0, v0, u1, v1 = uv
    for k in range(n):
        yaw = k / n * math.pi * 2 + rng.uniform(-.3, .3)
        d = Vector((math.cos(yaw), math.sin(yaw), 0))
        side = Vector((-d.y, d.x, 0))
        L = length * rng.uniform(0.8, 1.15)
        lf = lift * rng.uniform(0.7, 1.2)
        pts = []
        for i in range(5):
            t = i / 4
            pts.append(center + d * L * t * 0.9 + Vector((0, 0, lf * math.sin(t * math.pi * 0.7) - droop * t * t)))
        ws = [width * (0.25 + 0.75 * math.sin(min(1, t * 1.2) * math.pi * 0.85)) for t in (0, .25, .5, .75, 1)]
        rows = strip(bm, uvl, pts, ws, lambda i: side, v0=v0, v1=v1, u0=u0, u1=u1)
        nn = (Vector((0, 0, 1)) * 0.8 + d * 0.3).normalized()
        for a, b, _ in rows:
            custom.append((a, nn))
            custom.append((b, nn))


def finish_cards(name, bm, mat, custom):
    bm.verts.index_update()
    nrm = {v.index: n for v, n in custom}
    ob = C.new_obj(name, bm, [mat])
    C.shade_smooth(ob)
    C.apply_custom_normals(ob, nrm)
    return ob


def merge(objs, name):
    """Join meshes into one object (multi-material), transforms applied."""
    objs = [o for o in objs if o.type == "MESH"]
    ob = C.join(objs, name)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob
