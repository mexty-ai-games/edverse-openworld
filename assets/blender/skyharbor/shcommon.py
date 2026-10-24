"""Skyharbor helpers on top of the Idea Grove's common.py (Blender 4.2, headless).

Adds lathe/torus/tube objects, gears, a hull loft, noisy rocks and glow cards. Same conventions as the
hub: metres, Z-up in Blender (exported Y-up), origin at the base, fronts face -Y.
"""
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
os.environ.setdefault("OW_TEX", os.path.join(HERE, "build", "tex"))
os.environ.setdefault("OW_OUT", os.path.join(HERE, "build", "glb"))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import common as C  # noqa: E402,F401


def group(name, objs):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for o in objs:
        o.parent = root
    print(name, "tris:", sum(C.tris(o) for o in objs if o.type == "MESH"))
    return root


def lathe_obj(name, profile, mat, segs=24, loc=(0, 0, 0), rot=(0, 0, 0), v_scale=1.0, u_scale=1.0, cap=True, smooth=True):
    bm = bmesh.new()
    C.lathe(bm, profile, segs=segs, v_scale=v_scale, u_scale=u_scale, cap_bottom=cap)
    ob = C.new_obj(name, bm, [mat])
    if smooth:
        C.shade_smooth(ob)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def torus_obj(name, R, r, mat, loc=(0, 0, 0), rot=(0, 0, 0), seg=24, rseg=8, u_rep=4):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    verts = []
    for i in range(seg):
        a = i / seg * math.pi * 2
        ring = []
        for j in range(rseg):
            b = j / rseg * math.pi * 2
            ring.append(bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
        verts.append(ring)
    for i in range(seg):
        for j in range(rseg):
            f = bm.faces.new((verts[i][j], verts[(i + 1) % seg][j], verts[(i + 1) % seg][(j + 1) % rseg], verts[i][(j + 1) % rseg]))
            for loop, (u, v) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                loop[uvl].uv = (u / seg * u_rep, v / rseg)
    ob = C.new_obj(name, bm, [mat])
    C.shade_smooth(ob)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def tube_obj(name, pts, radii, mat, sides=8, cap_end=True, u_repeat=1.0, v_scale=1.0, noise_amp=0.0, seed=0):
    bm = bmesh.new()
    pts = [Vector(p) for p in pts]
    if not isinstance(radii, (list, tuple)):
        radii = [radii] * len(pts)
    C.tube(bm, pts, list(radii), sides=sides, cap_end=cap_end, u_repeat=u_repeat, v_scale=v_scale, noise_amp=noise_amp, seed=seed)
    ob = C.new_obj(name, bm, [mat])
    C.shade_smooth(ob)
    return ob


def rod(name, a, b, r, mat, sides=8):
    return tube_obj(name, [a, b], [r, r], mat, sides=sides, cap_end=True)


def box(name, size, loc, mat, rot=(0, 0, 0), bevel=0.02, uv=1.0, noise=0.0, seed=0):
    return C.box_obj(name, size, loc, mat, rot=rot, bevel=bevel, segments=2, uv_scale=uv, noise_amp=noise, seed=seed)


def sphere(name, r, loc, mat, segs=16, rings=10, scale=(1, 1, 1)):
    prof = []
    for i in range(rings + 1):
        a = -math.pi / 2 + math.pi * i / rings
        prof.append((max(1e-4, math.cos(a) * r), math.sin(a) * r))
    ob = lathe_obj(name, prof, mat, segs=segs, cap=False)
    ob.location = loc
    ob.scale = scale
    return ob


def gear_obj(name, R, teeth, thick, mat, hub_mat=None, spokes=5, hole=0.55):
    """A spur gear in the XZ plane (axis = Y): toothed rim, spokes and a hub. Origin at its centre."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    tooth_h = max(0.04, R * 0.12)
    rim_in = R * hole
    outer = []
    N = teeth * 4
    for k in range(N):
        a = k / N * math.pi * 2
        phase = k % 4
        r = R + (tooth_h if phase in (1, 2) else 0.0)
        outer.append((math.cos(a) * r, math.sin(a) * r))
    inner = [(math.cos(k / N * math.pi * 2) * rim_in, math.sin(k / N * math.pi * 2) * rim_in) for k in range(N)]
    for side, y in ((0, -thick / 2), (1, thick / 2)):
        ov = [bm.verts.new((x, y, z)) for x, z in outer]
        iv = [bm.verts.new((x, y, z)) for x, z in inner]
        for k in range(N):
            k2 = (k + 1) % N
            quad = (ov[k], ov[k2], iv[k2], iv[k]) if side == 0 else (ov[k], iv[k], iv[k2], ov[k2])
            f = bm.faces.new(quad)
            for loop in f.loops:
                loop[uvl].uv = (loop.vert.co.x * 0.6 + 0.5, loop.vert.co.z * 0.6 + 0.5)
        if side == 0:
            o0, i0 = ov, iv
        else:
            o1, i1 = ov, iv
    for k in range(N):
        k2 = (k + 1) % N
        for a0, a1, b0, b1, flip in ((o0[k], o0[k2], o1[k], o1[k2], False), (i0[k], i0[k2], i1[k], i1[k2], True)):
            q = (a0, b0, b1, a1) if not flip else (a0, a1, b1, b0)
            f = bm.faces.new(q)
            for j, loop in enumerate(f.loops):
                loop[uvl].uv = (k / N * 4, j % 2 * 0.1)
    ob = C.new_obj(name, bm, [mat])
    parts = [ob]
    hm = hub_mat or mat
    for s in range(spokes):
        a = s / spokes * math.pi * 2
        L = rim_in * 1.02
        sp = box(name + f"_sp{s}", (L, thick * 0.7, R * 0.12), (math.cos(a) * L / 2, 0, math.sin(a) * L / 2), mat, rot=(0, -a, 0), bevel=0.01)
        parts.append(sp)
    hub = lathe_obj(name + "_hub", [(0.0, -thick * 0.9), (R * 0.2, -thick * 0.9), (R * 0.2, thick * 0.9), (0.0, thick * 0.9)], hm, segs=14, rot=(math.pi / 2, 0, 0))
    parts.append(hub)
    g = C.join(parts, name)
    C.shade_flat_bevel(g)
    return g


def loft(name, sections, mat, closed=False, u_scale=1.0, v_scale=1.0):
    """Join rings of points (lists of Vector with the same count) into a skin. UV u = along, v = around."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    rows = [[bm.verts.new(p) for p in sec] for sec in sections]
    M = len(sections[0])
    # arc length per station for v
    arcs = []
    for sec in sections:
        acc = [0.0]
        for j in range(1, M):
            acc.append(acc[-1] + (sec[j] - sec[j - 1]).length)
        arcs.append(acc)
    along = [0.0]
    for i in range(1, len(sections)):
        along.append(along[-1] + (sections[i][M // 2] - sections[i - 1][M // 2]).length)
    for i in range(len(rows) - 1):
        for j in range(M - 1 if not closed else M):
            j2 = (j + 1) % M
            f = bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][j2], rows[i][j2]))
            for loop, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j2), (i, j2))):
                vv = arcs[ii][jj] if jj or not closed else arcs[ii][-1]
                loop[uvl].uv = (along[ii] * u_scale, vv * v_scale)
    ob = C.new_obj(name, bm, [mat])
    C.shade_smooth(ob)
    return ob


def rock_obj(name, mat, radius=1.0, scale=(1, 1, 1), seed=0, amp=0.35, subdiv=3, flat_top=None, ledges=0.0, moss=True):
    """An icosphere pushed out by fractal noise (with optional horizontal ledges and a flat top),
    moss painted per vertex on faces that look up."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    rng = random.Random(seed)
    off = Vector((rng.random() * 99, rng.random() * 99, rng.random() * 99))
    for v in bm.verts:
        d = v.co.normalized()
        n = C.fbm(v.co * 1.3 + off, 4, 1.0)
        r = radius * (1 + amp * n)
        p = d * r
        p = Vector((p.x * scale[0], p.y * scale[1], p.z * scale[2]))
        if ledges:
            p.x *= 1 + ledges * math.sin(p.z * 2.1 + n * 2)
            p.y *= 1 + ledges * math.sin(p.z * 2.1 + n * 2)
        if flat_top is not None and p.z > flat_top:
            p.z = flat_top + (p.z - flat_top) * 0.08
        v.co = p
    ob = C.new_obj(name, bm, [mat])
    me = ob.data
    me.uv_layers.new(name="UVMap")
    uv = me.uv_layers.active.data
    for poly in me.polygons:
        nrm = poly.normal
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if abs(nrm.z) > 0.7:
                uv[li].uv = (co.x * 0.25, co.y * 0.25)
            elif abs(nrm.x) > abs(nrm.y):
                uv[li].uv = (co.y * 0.25, co.z * 0.25)
            else:
                uv[li].uv = (co.x * 0.25, co.z * 0.25)
    C.shade_smooth(ob)
    if moss:
        C.paint_vcol(ob, lambda p, n: (
            (0.42, 0.62, 0.42) if n.z > 0.55 + 0.15 * C.fbm(p * 0.7, 2) else
            tuple(0.82 + 0.18 * C.fbm(p * 0.5 + Vector((3, 1, 2)), 2) for _ in range(3))))
    return ob


def cross_cards(bm, center, w, h, uv_rect, count=3, rot=0.0, tilt=0.0, custom=None):
    """Upright cards crossing at a point (a plant clump), uv_rect=(u0,v0,u1,v1), bottom at center."""
    uvl = bm.loops.layers.uv.verify()
    u0, v0, u1, v1 = uv_rect
    for k in range(count):
        a = rot + k * math.pi / count
        dx, dy = math.cos(a) * w / 2, math.sin(a) * w / 2
        tx, ty = -math.sin(a) * tilt, math.cos(a) * tilt
        c = Vector(center)
        vs = [bm.verts.new(c + Vector((-dx, -dy, 0))), bm.verts.new(c + Vector((dx, dy, 0))),
              bm.verts.new(c + Vector((dx + tx, dy + ty, h))), bm.verts.new(c + Vector((-dx + tx, -dy + ty, h)))]
        f = bm.faces.new(vs)
        for loop, uv in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
            loop[uvl].uv = uv
        if custom is not None:
            for v in vs:
                custom.append(v)


def _norm_uv(objs):
    for o in objs:
        if o.type != "MESH":
            continue
        me = o.data
        if not me.uv_layers:
            C.box_uv(o, 1.0)
        while len(me.uv_layers) > 1:
            me.uv_layers.remove(me.uv_layers[-1])
        me.uv_layers[0].name = "UVMap"


_join = C.join


def join(objs, name):
    """common.join, after giving every part one UV layer with the same name (else they split on join)."""
    _norm_uv(objs)
    return _join(objs, name)


C.join = join


def set_origin(ob, point):
    """Move the object's origin to a world point without moving its mesh (a pivot for animation)."""
    from mathutils import Matrix
    p = Vector(point)
    d = p - ob.location
    ob.data.transform(Matrix.Translation(-d))
    ob.location = p
