"""Biome Frontier landforms: waterfall cliff, sandstone canyon pieces with fossil insets, the fossil dig face,
coral clusters.

OW_TEX=build/tex OW_OUT=build/glb blender -b --factory-startup -P make_terrain.py
Rock masses are subdivided boxes sculpted with fractal noise, terraced into ledges (sandstone strata),
UV-projected so the painted bands run level, and painted per vertex (moss on tops, dark in crevices).
Front faces look toward -Y in Blender (+Z in the game).
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
from make_flora import finish_cards, group, leaf_plant  # noqa: E402


def rock_mass(name, size, mat, seed, cuts=12, terrace=1.4, terrace_k=0.55, noise=0.5, shape=None, uv_scale=0.25, round_k=0.35):
    """Sculpted rock block (origin at the base centre). shape(v)->Vector offset adds features (notch, overhang)."""
    rng = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    sx, sy, sz = size
    off = Vector((rng.random() * 40, rng.random() * 40, rng.random() * 40))
    for v in bm.verts:
        p = Vector((v.co.x * sx, v.co.y * sy, (v.co.z + 0.5) * sz))
        # rounded corners: pull toward an ellipsoid a little
        e = Vector((v.co.x * 2, v.co.y * 2, v.co.z * 2))
        ln = e.length
        if ln > 0:
            k = round_k * (1 - 1 / max(1.0, ln / 1.0)) if ln > 1 else 0
            p.x *= 1 - k * 0.4
            p.y *= 1 - k * 0.4
        if p.z > 0.05:
            q = round(p.z / terrace) * terrace
            p.z = p.z + (q - p.z) * terrace_k
        h = Vector((C.fbm(p * 0.35 + off, 4), C.fbm(p * 0.35 + off + Vector((7, 0, 0)), 4), C.fbm(p * 0.35 + off + Vector((0, 9, 0)), 3)))
        big = C.fbm(p * 0.12 + off * 0.5, 2)
        band = math.floor(p.z / terrace)
        recess = (math.sin(band * 12.9898 + seed * 78.233) * 43758.5453) % 1.0
        horiz = Vector((p.x, p.y, 0))
        if horiz.length > 1e-3:
            amt = h.x * noise + big * noise * 1.6 - recess * noise * 0.7
            p += horiz.normalized() * amt * (1.0 if p.z > 0.1 else 0.4)
        p.z += h.z * noise * 0.4 if p.z > 0.1 else 0
        if shape:
            p += shape(p)
        v.co = p
    ob = C.new_obj(name, bm, [mat])
    # world-scale box UVs with v = height so strata stay level
    me = ob.data
    uvl = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        n = poly.normal
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if abs(n.z) > 0.75:
                uvl.data[li].uv = (co.x * uv_scale, co.y * uv_scale)
            elif abs(n.x) > abs(n.y):
                uvl.data[li].uv = (co.y * uv_scale, co.z * uv_scale)
            else:
                uvl.data[li].uv = (co.x * uv_scale, co.z * uv_scale)
    C.shade_smooth(ob)
    return ob


def bone_tube(bm, a, b, r):
    """A stylised fossil bone: shaft with knobbed ends."""
    pts = [a.lerp(b, t / 6) for t in range(7)]
    rad = [r * (1.9 if i in (0, 6) else 1.4 if i in (1, 5) else 1.0) for i in range(7)]
    C.tube(bm, pts, rad, sides=7, cap_start=True)


def spiral(bm, center, normal_axis, r0, turns, thick):
    """Ammonite: a log spiral tube lying in the plane facing -Y."""
    pts, rad = [], []
    N = int(28 * turns)
    T = turns * math.pi * 2
    for i in range(N + 1):
        t = i / N * T
        r = r0 * 0.5 * math.exp((t - T) * 0.2)
        pts.append(center + Vector((math.cos(t) * r, 0, math.sin(t) * r)))
        rad.append(thick * (0.3 + 0.7 * i / N))
    C.tube(bm, pts, rad, sides=7)


# =============================================================================== waterfall cliff
def waterfall_cliff():
    C.reset()
    rock = C.material("cliff_rock", tex="mossrock.jpg", normal="mossrock_n.jpg", rough=0.88, vcol=True, normal_strength=1.4)

    def notch(p):
        o = Vector((0, 0, 0))
        if abs(p.x) < 2.2 and p.z > 4.5:
            o.z -= (2.2 - abs(p.x)) * 0.55 * min(1.0, (p.z - 4.5) / 3)
        if abs(p.x) < 1.6 and p.y < -1.5:
            o.y += (1.6 - abs(p.x)) * 0.7  # worn channel in the face
        return o

    cliff = rock_mass("cliff", (16, 7, 9), rock, seed=3, cuts=16, terrace=1.8, terrace_k=0.45, noise=1.1, shape=notch, uv_scale=0.18)

    def col(p, n):
        mossy = max(0.0, n.z - 0.3) * 1.6
        ao = 0.55 + 0.45 * min(1.0, p.z / 6)
        wet = 0.75 if abs(p.x) < 2.6 and p.y < 0 else 1.0
        c = Vector((0.9, 0.9, 0.88)).lerp(Vector((0.45, 0.72, 0.3)), min(1.0, mossy)) * ao * wet
        return (c.x, c.y, c.z)

    C.paint_vcol(cliff, col)
    rng = random.Random(5)
    leaf = C.material("cliff_leaves", tex="bigleaf.png", rough=0.6, alpha_tex=True, double=True)
    stem = C.material("cliff_stems", color=(0.3, 0.48, 0.18), rough=0.8)
    objs = [cliff]
    # plants on the top and ledges
    spots = [(-6.5, 1.0, 8.6), (-4.0, -0.5, 8.4), (4.2, 0.4, 8.6), (6.6, -1.0, 8.2), (-6.8, -3.2, 5.0), (6.4, -3.1, 5.4), (-3.4, -3.4, 3.4), (3.6, -3.6, 1.8)]
    for i, (x, y, z) in enumerate(spots):
        ps = leaf_plant(f"cliff_plant{i}", leaf, stem, (0.0 if i % 2 else 0.5, 0.0, 0.5 if i % 2 else 1.0, 1.0), rng, leaves=5,
                        height=rng.uniform(0.6, 1.3), length=rng.uniform(1.0, 1.6), width=0.6, rise=0.3, droop=0.5)
        for o in ps:
            o.location = (x, y, z)
        objs += ps
    # hanging vines over the face
    vine_m = C.material("cliff_vines", color=(0.1, 0.22, 0.06), rough=0.9)
    bmv = bmesh.new()
    for k in range(14):
        x = rng.uniform(-7.5, 7.5)
        if abs(x) < 2.5:
            continue
        L = rng.uniform(2.5, 5.5)
        pts = [Vector((x + math.sin(i) * 0.1, -3.3 - 0.1 * i, 8.8 - L * i / 7)) for i in range(8)]
        C.tube(bmv, pts, [0.05] * 8, sides=4, cap_end=False)
    objs.append(C.new_obj("cliff_vines", bmv, [vine_m]))
    lip = bpy.data.objects.new("water_lip", None)
    lip.location = (0, -3.0, 7.3)
    bpy.context.collection.objects.link(lip)
    r = group("waterfall_cliff", objs)
    lip.parent = r
    C.export("waterfall_cliff", [r])


# =============================================================================== canyon pieces
def canyon_rocks():
    C.reset()
    ss = C.material("sandstone", tex="sandstone.jpg", normal="sandstone_n.jpg", rough=0.9, vcol=True, normal_strength=1.3)
    bone_m = C.material("fossil_bone", tex="bone.jpg", rough=0.75, vcol=False)

    def col(p, n):
        ao = 0.6 + 0.4 * min(1.0, p.z / 4)
        top = max(0.0, n.z - 0.5) * 0.25
        c = Vector((1.0, 0.96, 0.92)) * ao + Vector((top, top * 0.9, top * 0.7))
        return (min(1, c.x), min(1, c.y), min(1, c.z))

    out = []
    wall = rock_mass("wall_a", (12, 3.2, 7), ss, seed=11, cuts=16, terrace=1.1, terrace_k=0.75, noise=0.8, uv_scale=0.075)
    C.paint_vcol(wall, col)
    # fossil insets on the front (-Y) face: a long-necked skeleton and two ammonites, half sunk into the rock
    bm = bmesh.new()
    y = -1.75
    spine = [Vector((-3.6 + i * 0.55, y, 3.6 + math.sin(i * 0.45) * 0.35)) for i in range(10)]
    for i in range(len(spine) - 1):
        bone_tube(bm, spine[i] + Vector((0.04, 0, 0)), spine[i + 1] - Vector((0.04, 0, 0)), 0.07)
    for i in range(1, 8):  # ribs
        p = spine[i]
        bone_tube(bm, p, p + Vector((0.12, 0, -0.75 + abs(i - 4) * 0.08)), 0.045)
    bone_tube(bm, spine[0], spine[0] + Vector((-0.7, 0, 0.8)), 0.06)  # neck
    res = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.22)
    for v in res["verts"]:
        v.co = Vector((v.co.x * 1.4, v.co.y * 0.6, v.co.z)) + spine[0] + Vector((-0.95, 0, 1.0))
    bone_tube(bm, spine[3] + Vector((0, 0, -0.6)), spine[3] + Vector((-0.25, 0, -1.5)), 0.08)  # legs
    bone_tube(bm, spine[7] + Vector((0, 0, -0.6)), spine[7] + Vector((0.2, 0, -1.5)), 0.08)
    bone_tube(bm, spine[-1], spine[-1] + Vector((1.4, 0, -0.5)), 0.05)  # tail
    spiral(bm, Vector((3.0, y + 0.05, 2.0)), None, 1.6, 2.4, 0.11)
    spiral(bm, Vector((4.3, y + 0.05, 5.2)), None, 1.1, 2.2, 0.08)
    fos = C.new_obj("wall_a_fossils", bm, [bone_m])
    C.shade_smooth(fos)
    out.append(group("wall_a", [wall, fos]))
    wall_b = rock_mass("wall_b", (9, 3.0, 9), ss, seed=12, cuts=16, terrace=1.2, terrace_k=0.75, noise=0.9, uv_scale=0.075)
    C.paint_vcol(wall_b, col)
    out.append(group("wall_b", [wall_b]))

    def pillar(p):
        k = max(0.0, (p.z - 6) / 6)
        return Vector((-p.x * k * 0.35, -p.y * k * 0.35, 0))

    mesa = rock_mass("mesa", (5.5, 5.5, 12), ss, seed=13, cuts=14, terrace=1.3, terrace_k=0.75, noise=0.9, shape=pillar, uv_scale=0.075)
    C.paint_vcol(mesa, col)
    bm = bmesh.new()
    bone_tube(bm, Vector((-1.2, -2.85, 7.4)), Vector((0.9, -2.85, 7.9)), 0.12)
    bone_tube(bm, Vector((-0.6, -2.9, 6.6)), Vector((1.1, -2.9, 6.3)), 0.1)
    spiral(bm, Vector((-0.6, -2.8, 4.6)), None, 1.2, 2.2, 0.09)
    mf = C.new_obj("mesa_fossils", bm, [bone_m])
    C.shade_smooth(mf)
    out.append(group("mesa", [mesa, mf]))
    for i, (sz, sd) in enumerate((((2.2, 1.8, 1.4), 21), ((1.4, 1.2, 0.9), 22), ((3.0, 2.2, 2.2), 23))):
        b = rock_mass(f"rock_{'abc'[i]}", sz, ss, seed=sd, cuts=6, terrace=0.5, terrace_k=0.4, noise=0.45, uv_scale=0.15, round_k=0.8)
        C.paint_vcol(b, col)
        out.append(group(f"rock_{'abc'[i]}", [b]))
    C.export("canyon_rocks", out)


# =============================================================================== fossil dig face
def dig_site():
    """A trench cut into the canyon floor showing 4 rock layers (oldest at the bottom), a fossil in each:
    trilobite (bottom), fern leaf, ammonite, shark tooth (top). Wooden frame, string grid, tools."""
    C.reset()
    layer_cols = [(0.3, 0.24, 0.32), (0.5, 0.38, 0.22), (0.7, 0.3, 0.18), (0.9, 0.68, 0.36)]
    objs = []
    W, D = 4.4, 1.2
    z = 0.0
    hs = [0.7, 0.62, 0.6, 0.55]
    for i, (c, h) in enumerate(zip(layer_cols, hs)):
        # neutral painted stone tinted per layer by vertex colour (exports as glTF COLOR_0)
        m = C.material(f"layer_{i}", tex="bone.jpg", normal="sandstone_n.jpg", rough=0.92, vcol=True)
        b = C.box_obj(f"layer_{i}", (W + 0.1 * (i % 2), D + 0.08 * ((i + 1) % 2), h), (0, 0.6, z + h / 2), m, bevel=0.06, segments=2,
                      uv_scale=0.6, noise_amp=0.05, seed=i)
        C.paint_vcol(b, lambda p, n, c=c: tuple(x * (0.85 + 0.3 * max(0.0, min(1.0, 0.5 + C.fbm(p * 2.0, 2)))) for x in c))
        objs.append(b)
        z += h
    top_z = z
    bone_m = C.material("dig_fossil", tex="bone.jpg", rough=0.7)
    dark_m = C.material("dig_fossil_dark", color=(0.24, 0.2, 0.18), rough=0.7)
    fy = 0.6 - D / 2 - 0.02
    # trilobite (bottom layer): oval body with ridges
    bm = bmesh.new()
    res = bmesh.ops.create_icosphere(bm, subdivisions=3, radius=0.22)
    for v in res["verts"]:
        v.co = Vector((v.co.x * 0.8, v.co.y * 0.35, v.co.z * 1.1)) + Vector((-0.9, fy, 0.35))
    for k in range(6):
        zz = 0.18 + k * 0.07
        C.tube(bm, [Vector((-1.08, fy - 0.07, zz)), Vector((-0.9, fy - 0.1, zz + 0.01)), Vector((-0.72, fy - 0.07, zz))], [0.025] * 3, sides=5)
    tri = C.new_obj("fossil_trilobite", bm, [dark_m])
    C.shade_smooth(tri)
    objs.append(tri)
    # fern leaf imprint (layer 2): a rachis with pinnae
    bm = bmesh.new()
    base = Vector((0.6, fy, 0.78))
    C.tube(bm, [base + Vector((0.05 * i, 0, 0.09 * i)) for i in range(7)], [0.02] * 7, sides=4)
    for i in range(1, 7):
        p = base + Vector((0.05 * i, 0, 0.09 * i))
        for s in (-1, 1):
            C.tube(bm, [p, p + Vector((s * 0.16 * (1 - i / 8), 0, 0.04))], [0.018, 0.01], sides=4)
    fern = C.new_obj("fossil_fern", bm, [dark_m])
    objs.append(fern)
    # ammonite (layer 3)
    bm = bmesh.new()
    spiral(bm, Vector((-0.4, fy, 1.62)), None, 0.9, 2.3, 0.05)
    am = C.new_obj("fossil_ammonite", bm, [bone_m])
    C.shade_smooth(am)
    objs.append(am)
    # shark tooth (top layer)
    bm = bmesh.new()
    t0 = Vector((1.1, fy, 2.15))
    vs = [bm.verts.new(t0 + Vector(o)) for o in ((-0.12, 0, 0), (0.12, 0, 0), (0.0, 0, 0.26), (0, -0.05, 0.08))]
    for f in ((0, 1, 3), (1, 2, 3), (2, 0, 3)):
        bm.faces.new([vs[i] for i in f])
    tooth = C.new_obj("fossil_tooth", bm, [C.material("tooth", color=(0.3, 0.3, 0.32), rough=0.4)])
    objs.append(tooth)
    # frame + string grid + tools
    wood = C.material("dig_wood", tex="planks.jpg", normal="planks_n.jpg", rough=0.85)
    for x in (-W / 2 - 0.15, W / 2 + 0.15):
        objs.append(C.box_obj("post", (0.12, 0.12, top_z + 0.6), (x, fy - 0.15, (top_z + 0.6) / 2), wood, bevel=0.02))
    objs.append(C.box_obj("beam", (W + 0.6, 0.12, 0.12), (0, fy - 0.15, top_z + 0.55), wood, bevel=0.02))
    string = C.material("string", color=(0.95, 0.9, 0.75), rough=0.8)
    for zz in (0.62, 1.25, 1.82):
        objs.append(C.box_obj("string", (W + 0.3, 0.015, 0.015), (0, fy - 0.17, zz), string, bevel=0))
    objs.append(C.box_obj("crate", (0.8, 0.6, 0.5), (-2.9, -0.4, 0.25), wood, rot=(0, 0, 0.3), bevel=0.03))
    bucket = C.material("bucket", color=(0.2, 0.5, 0.7), rough=0.5)
    bm = bmesh.new()
    C.lathe(bm, [(0.0, 0.0), (0.18, 0.0), (0.22, 0.35), (0.2, 0.35)], segs=14)
    bk = C.new_obj("bucket", bm, [bucket])
    bk.location = (2.8, -0.5, 0)
    C.shade_smooth(bk)
    objs.append(bk)
    brush = C.material("brush", color=(0.85, 0.6, 0.25), rough=0.7)
    objs.append(C.box_obj("brush", (0.35, 0.06, 0.05), (-2.8, -0.45, 0.53), brush, rot=(0, 0, 0.6), bevel=0.01))
    r = group("dig_site", objs)
    C.export("dig_site", [r])


# =============================================================================== corals
def corals():
    C.reset()
    rng = random.Random(9)
    mat = C.material("coral", tex="coral.jpg", normal="coral_n.jpg", rough=0.75, vcol=True)
    out = []

    def tint(ob, c1, c2, sc=1.5):
        C.paint_vcol(ob, lambda p, n: tuple(Vector(c1).lerp(Vector(c2), max(0.0, min(1.0, 0.5 + C.fbm(p * sc, 2))))))

    # brain coral: a lumpy dome with meandering grooves
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=20, radius=0.8)
    for v in bm.verts:
        if v.co.z < 0:
            v.co.z *= 0.15
        g = abs(math.sin(C.fbm(v.co * 2.2, 3) * 18))
        v.co *= 1 + 0.06 * g
        v.co.z *= 0.75
    br = C.new_obj("coral_brain", bm, [mat])
    C.box_uv(br, 1.5)
    C.shade_smooth(br)
    tint(br, (0.95, 0.55, 0.45), (1.0, 0.75, 0.5))
    out.append(group("coral_brain", [br]))
    # branching coral: recursive forks
    bm = bmesh.new()

    def branch(p, d, L, r, depth):
        q = p + d * L
        C.tube(bm, [p, p.lerp(q, 0.5) + Vector((rng.uniform(-.05, .05), rng.uniform(-.05, .05), 0)), q], [r, r * 0.85, r * 0.7], sides=6)
        if depth == 0:
            res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r * 1.05)
            for v in res["verts"]:
                v.co += q
            return
        for k in range(2 if depth < 2 else 3):
            nd = (d + Vector((rng.uniform(-0.7, 0.7), rng.uniform(-0.7, 0.7), 0.4))).normalized()
            branch(q, nd, L * 0.75, r * 0.72, depth - 1)

    for k in range(3):
        a = k * 2.1
        branch(Vector((math.cos(a) * 0.15, math.sin(a) * 0.15, 0)), Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, 1)).normalized(), 0.45, 0.07, 3)
    bc = C.new_obj("coral_branch", bm, [mat])
    C.box_uv(bc, 2)
    C.shade_smooth(bc)
    tint(bc, (0.62, 0.36, 0.86), (0.85, 0.5, 0.95))
    out.append(group("coral_branch", [bc]))
    # sea fan: a lattice of thin tubes in one plane
    bm = bmesh.new()
    for k in range(9):
        a = math.radians(-70 + k * 17.5)
        pts = [Vector((math.sin(a) * t * 1.1, 0, math.cos(a) * t * 1.1 + 0.05)) + Vector((0, math.sin(t * 5 + k) * 0.04, 0)) for t in [i / 6 for i in range(7)]]
        C.tube(bm, pts, [0.035 * (1 - i / 9) + 0.01 for i in range(7)], sides=4)
    for ring in (0.45, 0.7, 0.95):
        pts = [Vector((math.sin(math.radians(a)) * ring * 1.1, 0, math.cos(math.radians(a)) * ring * 1.1 + 0.05)) for a in range(-70, 71, 14)]
        C.tube(bm, pts, [0.015] * len(pts), sides=4)
    fan = C.new_obj("coral_fan", bm, [mat])
    C.box_uv(fan, 2)
    C.shade_smooth(fan)
    tint(fan, (0.95, 0.35, 0.45), (1.0, 0.55, 0.4))
    out.append(group("coral_fan", [fan]))
    # tube sponges
    bm = bmesh.new()
    for k in range(6):
        a = rng.uniform(0, 6.28)
        r0 = rng.uniform(0.0, 0.25)
        h = rng.uniform(0.35, 0.8)
        rr = rng.uniform(0.07, 0.11)
        rings = C.lathe(bm, [(rr * 0.9, 0), (rr, h * 0.5), (rr * 1.15, h), (rr * 0.8, h * 0.98), (rr * 0.7, h * 0.6)], segs=10, cap_bottom=False)
        for ring, _ in rings:
            for v in ring:
                v.co += Vector((math.cos(a) * r0, math.sin(a) * r0, 0))
    tb = C.new_obj("coral_tubes", bm, [mat])
    C.box_uv(tb, 2)
    C.shade_smooth(tb)
    tint(tb, (1.0, 0.82, 0.25), (1.0, 0.62, 0.2))
    out.append(group("coral_tubes", [tb]))
    C.export("corals", out)


if __name__ == "__main__":
    which = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["cliff", "canyon", "dig", "corals"]
    if "cliff" in which:
        waterfall_cliff()
    if "canyon" in which:
        canyon_rocks()
    if "dig" in which:
        dig_site()
    if "corals" in which:
        corals()
