"""Idea Grove props: lantern, carved stone plaza, three workshop stalls, telescope, boulders, barrel.

blender --background --factory-startup --python make_props.py
Conventions: metres, Z-up in Blender (exported Y-up), origin at the base (lantern: at its hanging ring),
stalls face -Y (towards the camera / plaza centre once placed).
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402


def group(name, objs):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for o in objs:
        o.parent = root
    print(name, "tris:", sum(C.tris(o) for o in objs if o.type == "MESH"))
    return root


def lathe_obj(name, profile, mat, segs=24, loc=(0, 0, 0), rot=(0, 0, 0), v_scale=1.0, u_scale=1.0, cap=True, scale=1.0):
    bm = bmesh.new()
    C.lathe(bm, [(r * scale, z * scale) for r, z in profile], segs=segs, v_scale=v_scale, u_scale=u_scale, cap_bottom=cap)
    ob = C.new_obj(name, bm, [mat])
    C.shade_smooth(ob)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def torus_obj(name, R, r, mat, loc=(0, 0, 0), rot=(0, 0, 0), seg=24, rseg=8):
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
                loop[uvl].uv = (u / seg * 4, v / rseg)
    ob = C.new_obj(name, bm, [mat])
    C.shade_smooth(ob)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


# =============================================================================== lantern
def make_lantern():
    C.reset()
    metal = C.material("lantern_metal", tex="brass.jpg", rough=0.45, metal=0.75)
    dark = C.material("lantern_iron", color=(0.09, 0.07, 0.06), rough=0.5, metal=0.6)
    glow = C.material("lantern_glow", tex="lantern_glass.jpg", emissive_tex="lantern_glass.jpg", emissive_strength=2.5, rough=0.3)
    objs = []
    # chain: alternating links
    for i in range(5):
        objs.append(torus_obj(f"link{i}", 0.035, 0.009, dark, loc=(0, 0, -0.04 - i * 0.06), rot=(math.pi / 2, 0, (i % 2) * math.pi / 2), seg=10, rseg=5))
    top_ring = torus_obj("ring", 0.05, 0.012, metal, loc=(0, 0, -0.34), rot=(math.pi / 2, 0, 0), seg=14, rseg=6)
    objs.append(top_ring)
    # roof dome + finial
    objs.append(lathe_obj("roof", [(0.0, 0.0), (0.04, 0.0), (0.05, -0.04), (0.12, -0.1), (0.22, -0.16), (0.25, -0.19), (0.23, -0.21), (0.17, -0.21)], metal, segs=6, loc=(0, 0, -0.36), v_scale=2))
    # body: hexagonal glass prism + frame bars
    bm = bmesh.new()
    C.lathe(bm, [(0.17, -0.62), (0.185, -0.48), (0.17, -0.27)], segs=6, cap_bottom=False)
    glass = C.new_obj("glass", bm, [glow])
    glass.location = (0, 0, -0.33)
    glass.rotation_euler = (0, 0, math.pi / 6)
    objs.append(glass)
    for k in range(6):
        a = k / 6 * math.pi * 2
        b = C.box_obj(f"bar{k}", (0.035, 0.035, 0.38), (math.cos(a) * 0.19, math.sin(a) * 0.19, -0.79), metal, rot=(0, 0, a), bevel=0.008, segments=1, uv_scale=2)
        objs.append(b)
    objs.append(lathe_obj("base", [(0.0, -0.06), (0.12, -0.06), (0.2, -0.03), (0.22, 0.0), (0.21, 0.02), (0.0, 0.02)], metal, segs=6, loc=(0, 0, -1.0), v_scale=2))
    objs.append(lathe_obj("drip", [(0.0, -0.08), (0.03, -0.07), (0.05, -0.03), (0.06, 0.0), (0.0, 0.0)], metal, segs=8, loc=(0, 0, -1.06)))
    # inner flame
    objs.append(lathe_obj("flame", [(0.0, 0.0), (0.05, 0.04), (0.055, 0.09), (0.03, 0.15), (0.0, 0.2)], glow, segs=8, loc=(0, 0, -0.86), cap=False))
    r = group("lantern", objs)
    C.export("lantern", [r])


# =============================================================================== plaza
def make_plaza():
    C.reset()
    top = C.material("plaza_top", tex="plaza.jpg", normal="plaza_n.jpg", emissive_tex="plaza_e.jpg", emissive_strength=0.35, rough=0.85)
    side = C.material("plaza_side", tex="ground_stone.jpg", normal="ground_stone_n.jpg", rough=0.9, vcol=True)
    curb_m = C.material("plaza_curb", tex="rock.jpg", normal="rock_n.jpg", rough=0.9, vcol=True)
    R, H = 7.0, 0.22
    seg = 72
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    centre = bm.verts.new((0, 0, H))
    rings = []
    for rr in (0.25, 0.5, 0.75, 1.0):
        rings.append([bm.verts.new((math.cos(i / seg * 6.2832) * R * rr, math.sin(i / seg * 6.2832) * R * rr, H)) for i in range(seg)])

    def uvof(v):
        return (v.co.x / (2 * R) + 0.5, v.co.y / (2 * R) + 0.5)

    for i in range(seg):
        j = (i + 1) % seg
        f = bm.faces.new((centre, rings[0][i], rings[0][j]))
        for loop in f.loops:
            loop[uvl].uv = uvof(loop.vert)
        for k in range(3):
            f = bm.faces.new((rings[k][i], rings[k + 1][i], rings[k + 1][j], rings[k][j]))
            for loop in f.loops:
                loop[uvl].uv = uvof(loop.vert)
    disc = C.new_obj("plaza_disc", bm, [top])
    # gentle wear: slight dips
    for v in disc.data.vertices:
        v.co.z += C.fbm(v.co * 0.4, 2) * 0.015
    bm = bmesh.new()
    C.lathe(bm, [(R + 0.02, -0.3), (R + 0.02, H)], segs=seg, v_scale=0.5, u_scale=14, cap_bottom=False)
    wall = C.new_obj("plaza_wall", bm, [side])
    objs = [disc, wall]
    # curb stones around the rim, with a gap for the steps at the front (-Y)
    rng = random.Random(5)
    n = 44
    for i in range(n):
        a = (i + 0.5) / n * math.pi * 2
        if abs(((a - 1.5 * math.pi + math.pi) % (2 * math.pi)) - math.pi) < 0.26:
            continue
        L = 2 * math.pi * (R + 0.25) / n * 0.92
        h = rng.uniform(0.32, 0.42)
        b = C.box_obj(f"curb{i}", (L, 0.48, h), (math.cos(a) * (R + 0.22), math.sin(a) * (R + 0.22), h / 2 - 0.08), curb_m,
                      rot=(0, 0, a + math.pi / 2 + rng.uniform(-.04, .04)), bevel=0.06, segments=2, uv_scale=0.8, noise_amp=0.03, seed=i)
        objs.append(b)
    # front steps
    for k, (w, d, z) in enumerate(((3.2, 0.55, 0.12), (3.6, 0.5, 0.04))):
        objs.append(C.box_obj(f"step{k}", (w, d, 0.16), (0, -(R + 0.3 + k * 0.5), z), curb_m, bevel=0.05, segments=2, uv_scale=0.8, noise_amp=0.015, seed=40 + k))

    def stone_col(p, nrm):
        m = max(0.0, C.fbm(p * 0.9, 3) + 0.15) * (0.5 + 0.5 * max(0.0, nrm.z))
        ao = 0.65 + 0.35 * min(1.0, max(0.0, (p.z + 0.1) / 0.4))
        c = Vector((1, 0.98, 0.94)).lerp(Vector((0.45, 0.62, 0.3)), min(1.0, m * 1.6)) * ao
        return (c.x, c.y, c.z)

    for o in objs[1:]:
        C.paint_vcol(o, stone_col)
    r = group("plaza", objs)
    C.export("plaza", [r])


# =============================================================================== stalls
def stall_frame(prefix, sign_tex, rng):
    wood = C.material(prefix + "_wood", tex="wood.jpg", normal="wood_n.jpg", rough=0.85, vcol=True)
    sign = C.material(prefix + "_sign", tex=sign_tex, rough=0.8)
    leaf = C.material(prefix + "_vines", tex="leaves.png", rough=0.8, alpha_tex=True, double=True)
    objs = []
    W, D = 2.8, 1.5
    for sx in (-1, 1):
        for sy, h in ((-1, 2.55), (1, 2.25)):
            objs.append(C.box_obj(f"post{sx}{sy}", (0.16, 0.16, h), (sx * W / 2, sy * D / 2, h / 2), wood, bevel=0.025, uv_scale=0.6,
                                  noise_amp=0.01, seed=int(sx * 3 + sy)))
    # counter: top board + front panel of planks
    objs.append(C.box_obj("counter_top", (W + 0.3, 0.75, 0.09), (0, -D / 2 + 0.2, 1.02), wood, bevel=0.02, uv_scale=0.6, noise_amp=0.006))
    for k in range(5):
        objs.append(C.box_obj(f"panel{k}", (W + 0.15, 0.06, 0.19), (0, -D / 2 - 0.12, 0.12 + k * 0.2), wood,
                              rot=(0, rng.uniform(-.01, .01), 0), bevel=0.012, uv_scale=0.6, noise_amp=0.004, seed=k))
    objs.append(C.box_obj("shelf", (W, 0.5, 0.06), (0, D / 2 - 0.3, 1.45), wood, bevel=0.015, uv_scale=0.6))
    # roof: tilted planks, slightly uneven
    tilt = math.atan2(0.3, D + 0.6)
    for k in range(10):
        x = -W / 2 - 0.3 + (k + 0.5) * (W + 0.6) / 10
        objs.append(C.box_obj(f"roof{k}", ((W + 0.6) / 10 * 0.96, D + 0.9, 0.07), (x, 0, 2.48 + rng.uniform(-.02, .02)), wood,
                              rot=(tilt + rng.uniform(-.02, .02), rng.uniform(-.02, .02), 0), bevel=0.015, uv_scale=0.6,
                              noise_amp=0.01, seed=20 + k))
    objs.append(C.box_obj("ridge", (W + 0.7, 0.14, 0.14), (0, -D / 2 - 0.45, 2.42), wood, bevel=0.02, uv_scale=0.6))
    # sign board hanging at the front of the roof
    objs.append(C.box_obj("sign_frame", (1.3, 0.08, 0.68), (0, -D / 2 - 0.55, 2.05), wood, bevel=0.02, uv_scale=0.6))
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    vs = [bm.verts.new(v) for v in ((-0.58, -0.05, -0.29), (0.58, -0.05, -0.29), (0.58, -0.05, 0.29), (-0.58, -0.05, 0.29))]
    f = bm.faces.new(vs)
    for loop, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uvl].uv = uv
    sg = C.new_obj("sign", bm, [sign])
    sg.location = (0, -D / 2 - 0.55, 2.05)
    objs.append(sg)
    # vines / moss draped over the roof edges
    bmv = bmesh.new()
    custom = []
    for k in range(26):
        x = rng.uniform(-W / 2 - 0.2, W / 2 + 0.2)
        y = rng.choice((-D / 2 - 0.4, D / 2 + 0.35))
        c = Vector((x, y, 2.5 + rng.uniform(-0.15, 0.1)))
        C.leaf_clump(bmv, c, rng.uniform(0.35, 0.55), 4, rng, custom)
    for k in range(6):
        x = rng.choice((-W / 2, W / 2))
        y = rng.uniform(-D / 2, D / 2)
        for j in range(4):
            C.leaf_clump(bmv, Vector((x, y, 2.3 - j * 0.45)), 0.3, 2, rng, custom)
    bmv.verts.index_update()
    nrm = {v.index: n for v, n in custom}
    vines = C.new_obj("vines", bmv, [leaf])
    C.shade_smooth(vines)
    C.apply_custom_normals(vines, nrm)
    objs.append(vines)

    def wood_col(p, n):
        ao = 0.7 + 0.3 * min(1.0, p.z / 1.5)
        m = max(0.0, n.z - 0.6) * max(0.0, C.fbm(p * 1.4, 2) + 0.1) * (1.0 if p.z > 2.2 else 0.3)
        c = Vector((1, 0.97, 0.93)).lerp(Vector((0.45, 0.62, 0.3)), min(1.0, m * 3)) * ao
        return (c.x, c.y, c.z)

    for o in objs:
        if o.data.materials[0] == wood:
            C.paint_vcol(o, wood_col)
    return objs, wood


def barrel(name, wood, iron, loc, s=1.0):
    objs = [lathe_obj(name, [(0.0, 0.0), (0.26, 0.0), (0.3, 0.2), (0.31, 0.35), (0.3, 0.5), (0.26, 0.7), (0.0, 0.7)], wood, segs=16, loc=loc, v_scale=0.6, u_scale=3, scale=s)]
    for z in (0.12, 0.58):
        objs.append(torus_obj(name + f"_hoop{z}", (0.285 if z < 0.3 else 0.28) * s, 0.012 * s, iron, loc=(loc[0], loc[1], loc[2] + z * s), seg=18, rseg=4))
    return objs


def pot(name, mat, loc, kind, s=1.0):
    prof = {
        "amphora": [(0.0, 0.0), (0.06, 0.0), (0.1, 0.06), (0.17, 0.22), (0.18, 0.32), (0.12, 0.46), (0.06, 0.52), (0.065, 0.6), (0.08, 0.62), (0.0, 0.62)],
        "bowl": [(0.0, 0.0), (0.08, 0.0), (0.16, 0.05), (0.2, 0.12), (0.19, 0.13), (0.15, 0.07), (0.0, 0.06)],
        "jar": [(0.0, 0.0), (0.1, 0.0), (0.14, 0.08), (0.15, 0.2), (0.11, 0.28), (0.09, 0.3), (0.1, 0.33), (0.0, 0.33)],
        "vase": [(0.0, 0.0), (0.07, 0.0), (0.12, 0.12), (0.08, 0.3), (0.06, 0.38), (0.09, 0.44), (0.0, 0.44)],
    }[kind]
    return lathe_obj(name, prof, mat, segs=18, loc=loc, v_scale=2, scale=s)


def plant_cards(name, mat, loc, rng, n=6, h=0.45, quad=None):
    bm = bmesh.new()
    custom = []
    for k in range(n):
        a = k / n * math.pi + rng.uniform(-.2, .2)
        d = Vector((math.cos(a), math.sin(a), 0))
        u0, v0 = quad if quad else (0, 0)
        du = 0.5 if quad else 1.0
        C.card(bm, Vector((0, 0, h / 2)), d, h, (u0, v0, u0 + du, v0 + du), rot=0, custom=custom)
    bm.verts.index_update()
    nrm = {v.index: Vector((0, 0, 1)) for v, _ in custom}
    ob = C.new_obj(name, bm, [mat])
    C.apply_custom_normals(ob, nrm)
    ob.location = loc
    return ob


def make_stalls():
    for kind in ("biome", "chrono", "sky"):
        C.reset()
        rng = random.Random({"biome": 1, "chrono": 2, "sky": 3}[kind])
        objs, wood = stall_frame("stall_" + kind, f"sign_{kind}.jpg", rng)
        iron = C.material("iron", color=(0.12, 0.1, 0.09), rough=0.55, metal=0.6)
        clay = C.material("clay", tex="clay.jpg", rough=0.7)
        brass = C.material("brass", tex="brass.jpg", rough=0.35, metal=0.8)
        cloth = C.material("cloth", tex="cloth.jpg", rough=0.9, double=True)
        objs += barrel("barrel_a", wood, iron, (1.75, -0.4, 0))
        objs += barrel("barrel_b", wood, iron, (-1.8, -0.1, 0), s=0.8)
        if kind == "biome":
            fern = C.material("herbs", tex="fern.png", rough=0.8, alpha_tex=True, double=True)
            flw = C.material("blooms", tex="flowers.png", rough=0.8, alpha_tex=True, double=True)
            for i, x in enumerate((-0.9, 0.0, 0.9)):
                objs.append(C.box_obj(f"planter{i}", (0.7, 0.4, 0.22), (x, -0.45, 1.18), wood, bevel=0.02, uv_scale=0.6))
                objs.append(plant_cards(f"herb{i}", fern if i != 1 else flw, (x, -0.45, 1.27), rng, n=5, h=0.5, quad=None if i != 1 else (0, 0)))
            for i, x in enumerate((-1.0, -0.3, 0.4, 1.0)):
                objs.append(pot(f"spot{i}", clay, (x, 0.45, 1.48), "jar", s=0.8))
                objs.append(plant_cards(f"sherb{i}", flw if i % 2 else fern, (x, 0.45, 1.68), rng, n=4, h=0.4,
                                        quad=((0.5, 0) if i % 2 else None)))
            objs.append(C.box_obj("crate", (0.6, 0.5, 0.4), (1.2, -1.25, 0.2), wood, rot=(0, 0, 0.2), bevel=0.02, uv_scale=0.6))
            objs.append(plant_cards("crate_plants", flw, (1.2, -1.25, 0.4), rng, n=5, h=0.45, quad=(0.5, 0.5)))
        elif kind == "chrono":
            kinds = ["amphora", "bowl", "jar", "vase", "jar", "amphora"]
            xs = [-1.05, -0.55, -0.05, 0.4, 0.8, 1.15]
            for i, (k, x) in enumerate(zip(kinds, xs)):
                objs.append(pot(f"pot{i}", clay, (x, -0.42 + rng.uniform(-.08, .08), 1.065), k, s=rng.uniform(0.75, 1.0)))
            for i, x in enumerate((-0.9, -0.2, 0.6)):
                objs.append(pot(f"spot{i}", clay, (x, 0.45, 1.48), ["vase", "bowl", "amphora"][i], s=0.7))
            # hourglass
            objs.append(lathe_obj("hg_glass", [(0.0, 0.0), (0.09, 0.02), (0.1, 0.1), (0.02, 0.2), (0.1, 0.3), (0.09, 0.38), (0.0, 0.4)],
                                  C.material("glass", color=(0.85, 0.9, 0.95), rough=0.1), segs=14, loc=(1.15, 0.0, 1.11)))
            for z in (1.06, 1.53):
                objs.append(C.box_obj(f"hg_plate{z}", (0.3, 0.3, 0.05), (1.15, 0.0, z + 0.02), wood, bevel=0.01, uv_scale=0.6))
            objs.append(lathe_obj("hg_sand", [(0.0, 0.0), (0.08, 0.0), (0.0, 0.07)], C.material("sand", color=(0.85, 0.7, 0.4), rough=0.9), segs=12, loc=(1.15, 0.0, 1.13)))
            objs.append(pot("big_amphora", clay, (-1.6, -1.2, 0.0), "amphora", s=1.6))
            # rolled scroll
            sc = lathe_obj("scroll", [(0.0, 0.0), (0.05, 0.0), (0.05, 0.5), (0.0, 0.5)], cloth, segs=12, loc=(-0.3, 0.0, 1.11), rot=(0, math.pi / 2, 0.3))
            objs.append(sc)
        else:
            # armillary sphere: rings on a stand
            base = (0.2, -0.35, 1.065)
            objs.append(lathe_obj("arm_stand", [(0.0, 0.0), (0.16, 0.0), (0.12, 0.05), (0.03, 0.08), (0.03, 0.3), (0.0, 0.3)], brass, segs=16, loc=base))
            ctr = (base[0], base[1], base[2] + 0.62)
            objs.append(torus_obj("arm_r1", 0.3, 0.012, brass, loc=ctr, rot=(math.pi / 2, 0, 0), seg=32, rseg=6))
            objs.append(torus_obj("arm_r2", 0.3, 0.012, brass, loc=ctr, rot=(math.pi / 2, 0, math.pi / 2), seg=32, rseg=6))
            objs.append(torus_obj("arm_r3", 0.3, 0.012, brass, loc=ctr, rot=(0.41, 0, 0), seg=32, rseg=6))
            sph = lathe_obj("arm_core", [(0.0, -0.08), (0.06, -0.06), (0.08, 0.0), (0.06, 0.06), (0.0, 0.08)],
                            C.material("sun_core", color=(1, 0.75, 0.3), emissive=(1.0, 0.7, 0.25), emissive_strength=2.0), segs=14, loc=ctr)
            objs.append(sph)
            for i in range(4):
                objs.append(lathe_obj(f"chart{i}", [(0.0, 0.0), (0.045, 0.0), (0.045, 0.62), (0.0, 0.62)], cloth, segs=10,
                                      loc=(-1.1 + i * 0.12, -0.35 + rng.uniform(-.1, .1), 1.11 + 0.045), rot=(0, math.pi / 2, rng.uniform(-.3, .3))))
            # hanging star mobile under the roof
            star = C.material("star", color=(1, 0.85, 0.4), emissive=(1, 0.8, 0.35), emissive_strength=3.0)
            for i in range(5):
                x = -1.0 + i * 0.5
                objs.append(C.box_obj(f"string{i}", (0.008, 0.008, 0.4), (x, -0.4, 2.15), iron, bevel=0))
                st = lathe_obj(f"star{i}", [(0.0, -0.07), (0.07, 0.0), (0.0, 0.07)], star, segs=5, loc=(x, -0.4, 1.9), rot=(math.pi / 2, 0, 0))
                objs.append(st)
            # a kite leaning on the post
            bm = bmesh.new()
            uvl = bm.loops.layers.uv.verify()
            vs = [bm.verts.new(v) for v in ((0, 0, 0), (0.35, 0, 0.5), (0, 0, 1.2), (-0.35, 0, 0.5))]
            f = bm.faces.new(vs)
            for loop, uv in zip(f.loops, ((0.5, 0), (1, 0.4), (0.5, 1), (0, 0.4))):
                loop[uvl].uv = uv
            kite = C.new_obj("kite", bm, [cloth])
            kite.location = (1.62, -0.95, 0.9)
            kite.rotation_euler = (0.25, 0, 0.5)
            objs.append(kite)
        r = group("stall_" + kind, objs)
        C.export("stall_" + kind, [r])


# =============================================================================== telescope
def make_telescope():
    C.reset()
    wood = C.material("tel_wood", tex="wood.jpg", normal="wood_n.jpg", rough=0.8)
    brass = C.material("tel_brass", tex="brass.jpg", rough=0.3, metal=0.85)
    dark = C.material("tel_dark", color=(0.1, 0.08, 0.07), rough=0.5, metal=0.5)
    glass = C.material("tel_lens", color=(0.3, 0.45, 0.6), emissive=(0.25, 0.45, 0.7), emissive_strength=0.6, rough=0.05)
    objs = []
    bm = bmesh.new()
    for k in range(3):
        a = k / 3 * math.pi * 2 + math.pi / 2
        top = Vector((0, 0, 1.25))
        foot = Vector((math.cos(a) * 0.7, math.sin(a) * 0.7, 0))
        C.tube(bm, [top + (foot - top) * t for t in (0, 0.5, 1)], [0.045, 0.042, 0.038], sides=8, v_scale=0.8, u_repeat=1)
    legs = C.new_obj("legs", bm, [wood])
    C.shade_smooth(legs)
    objs.append(legs)
    objs.append(lathe_obj("hub", [(0.0, 0.0), (0.12, 0.0), (0.12, 0.08), (0.06, 0.12), (0.06, 0.22), (0.0, 0.22)], brass, segs=16, loc=(0, 0, 1.18)))
    # tube along +Y, tilted up 32 degrees, pivot at the hub top
    tilt = math.radians(32)
    prof = [(0.0, -0.55), (0.07, -0.55), (0.075, -0.5), (0.065, -0.48), (0.07, -0.2), (0.085, -0.18), (0.085, -0.14), (0.08, -0.12),
            (0.095, 0.4), (0.11, 0.42), (0.11, 0.5), (0.1, 0.52), (0.115, 0.9), (0.13, 0.92), (0.13, 1.02), (0.12, 1.04), (0.11, 1.04)]
    t = lathe_obj("tube", prof, brass, segs=20, loc=(0, 0, 1.45), rot=(-(math.pi / 2 - tilt), 0, 0), v_scale=2, u_scale=2, cap=True)
    objs.append(t)
    lens = lathe_obj("lens", [(0.0, 1.03), (0.105, 1.03), (0.0, 1.04)], glass, segs=20, loc=(0, 0, 1.45), rot=(-(math.pi / 2 - tilt), 0, 0))
    objs.append(lens)
    for z in (0.0, 0.55):
        objs.append(lathe_obj(f"band{z}", [(0.0, z - 0.03), (0.1 + z * 0.03, z - 0.03), (0.1 + z * 0.03, z + 0.03), (0.0, z + 0.03)], dark, segs=20,
                              loc=(0, 0, 1.45), rot=(-(math.pi / 2 - tilt), 0, 0), cap=False))
    objs.append(C.box_obj("yoke", (0.06, 0.2, 0.2), (0.12, 0, 1.42), brass, bevel=0.01))
    objs.append(C.box_obj("yoke2", (0.06, 0.2, 0.2), (-0.12, 0, 1.42), brass, bevel=0.01))
    r = group("telescope", objs)
    C.export("telescope", [r])


# =============================================================================== boulders
def make_boulders():
    C.reset()
    rock = C.material("boulder", tex="rock.jpg", normal="rock_n.jpg", rough=0.92, vcol=True, normal_strength=1.5)
    objs = []
    for i, (sx, sy, sz, sub) in enumerate(((1.0, 0.8, 0.62, 3), (1.3, 1.0, 0.8, 3), (0.7, 0.6, 0.5, 3))):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
        off = Vector((i * 17.0, i * 5.0, i * 9.0))
        for v in bm.verts:
            n = v.co.normalized()
            d = 1.0 + 0.32 * C.fbm(n * 1.2 + off, 4) + 0.08 * C.fbm(n * 4 + off, 2)
            v.co = Vector((n.x * sx * d, n.y * sy * d, n.z * sz * d))
            if v.co.z < -0.15 * sz:
                v.co.z = -0.15 * sz + (v.co.z + 0.15 * sz) * 0.2
        ob = C.new_obj(f"boulder_{'abc'[i]}", bm, [rock])
        md = ob.modifiers.new("sub", "SUBSURF")
        md.levels = 1
        C.apply_all(ob)
        md = ob.modifiers.new("dec", "DECIMATE")
        md.ratio = 0.42
        C.apply_all(ob)
        for v in ob.data.vertices:
            v.co.z += 0.15 * sz
        C.box_uv(ob, 0.45)
        C.shade_smooth(ob)

        def col(p, nrm, off=off):
            m = max(0.0, nrm.z - 0.25) * 1.8 * (0.6 + 0.6 * C.fbm(p * 1.5 + off, 3))
            ao = 0.55 + 0.45 * min(1.0, max(0.0, p.z / 0.6))
            c = Vector((1, 0.98, 0.95)).lerp(Vector((0.38, 0.58, 0.22)), min(1.0, max(0.0, m))) * ao
            return (c.x, c.y, c.z)

        C.paint_vcol(ob, col)
        ob.location = (i * 3.0 - 3.0, 0, 0)
        objs.append(ob)
    for o in objs:
        print(o.name, C.tris(o))
    # each variant at the origin, so the game can instance it anywhere
    for o in objs:
        o.location = (0, 0, 0)
    C.export("boulders", objs)


if __name__ == "__main__":
    which = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["lantern", "plaza", "stalls", "telescope", "boulders"]
    for w in which:
        {"lantern": make_lantern, "plaza": make_plaza, "stalls": make_stalls, "telescope": make_telescope, "boulders": make_boulders}[w]()
