"""Chrono Quarter shared props: cherry trees, street lamp, exit gate, era plinths, the Time Dial
(timeline station), jungle plants and pond life (koi, lily pad, lotus).

OW_TEX=build/tex OW_OUT=build/glb blender -b --factory-startup -P make_quarter.py [-- cherry lamp gate plinths dial jungle pond]
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import cq  # noqa: E402
from cq import C  # noqa: E402


# =============================================================================== cherry tree
def cherry(name, seed, scale=1.0):
    rng = random.Random(seed)
    s = scale
    bark = C.material(name + "_bark", tex="bark.jpg", normal="bark_n.jpg", rough=0.9, vcol=True, normal_strength=1.2)
    bloom = C.material(name + "_blossom", tex="blossom.png", rough=0.8, alpha_tex=True, double=True)
    core = C.material(name + "_core", color=(0.62, 0.3, 0.4), rough=0.95)
    bm = bmesh.new()
    # short, leaning, slightly twisted trunk that splits into wide spreading limbs
    lean = Vector((rng.uniform(-.35, .35), rng.uniform(-.35, .35), 0))
    tpts = [Vector((0, 0, -0.2)) + lean * (t * t) * s + Vector((0, 0, t * 1.9 * s)) for t in [i / 8 for i in range(9)]]
    C.tube(bm, tpts, [(0.32 - 0.1 * (i / 8)) * s for i in range(9)], sides=12, twist=0.06, noise_amp=0.15, noise_scale=2.0, seed=seed,
           v_scale=0.6, u_repeat=2.0, flare=lambda i, a: max(0.0, 1 - i / 2.5) ** 2 * 0.18 * s * (0.5 + 0.5 * math.sin(a * 4 + seed)))
    top = tpts[-1]
    clumps = []
    limbs = 5
    base_a = rng.uniform(0, 6.28)
    for li in range(limbs):
        a = base_a + li / limbs * math.pi * 2 + rng.uniform(-.3, .3)
        d = Vector((math.cos(a), math.sin(a), 0))
        reach = rng.uniform(1.9, 2.6) * s
        p0 = top - Vector((0, 0, 0.25 * s))
        p3 = p0 + d * reach + Vector((0, 0, rng.uniform(1.0, 1.7) * s))
        pts = C.bezier_pts(p0, p0 + d * reach * 0.25 + Vector((0, 0, 0.7 * s)), p0 + d * reach * 0.7 + Vector((0, 0, 0.8 * s)), p3, 8)
        C.tube(bm, pts, [(0.2 - 0.15 * (i / 8)) * s for i in range(9)], sides=7, noise_amp=0.12, noise_scale=2.5, seed=seed + li, v_scale=0.7, u_repeat=1.0)
        clumps.append((p3 + Vector((0, 0, 0.25 * s)), rng.uniform(1.0, 1.3) * s))
        mid = pts[5]
        clumps.append((mid + Vector((0, 0, 0.55 * s)) + d.cross(Vector((0, 0, 1))) * rng.uniform(-.5, .5) * s, rng.uniform(0.8, 1.05) * s))
    clumps.append((top + Vector((0, 0, 1.6 * s)), 1.25 * s))
    wood = C.new_obj(name + "_wood", bm, [bark])
    C.shade_smooth(wood)

    def bark_col(p, n):
        ao = 0.55 + 0.45 * min(1.0, max(0.0, (p.z + 0.2) / (1.5 * s)))
        c = Vector((0.78, 0.68, 0.66)) * ao  # cherry bark: darker, reddish
        m = max(0.0, n.z - 0.3) * max(0.0, C.fbm(p * 1.5, 2) + 0.1)
        c = c.lerp(Vector((0.42, 0.55, 0.3)) * ao, min(1.0, m * 1.4))
        return (c.x, c.y, c.z)

    C.paint_vcol(wood, bark_col)
    bmc = bmesh.new()
    for (cpos, cr) in clumps:
        res = bmesh.ops.create_icosphere(bmc, subdivisions=1, radius=cr * 0.68)
        for v in res["verts"]:
            v.co = Vector((v.co.x, v.co.y, v.co.z * 0.75)) + cpos
    core_ob = C.new_obj(name + "_core", bmc, [core])
    C.shade_smooth(core_ob)
    bml = bmesh.new()
    custom = []
    for (cpos, cr) in clumps:
        C.leaf_clump(bml, cpos, cr, 34, rng, custom, flat=0.75)
    # a few drooping blossom sprays hanging lower
    for k in range(10):
        cpos, cr = clumps[rng.randrange(len(clumps))]
        p = cpos + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), -0.6)) * cr
        C.card(bml, p, Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), -0.3)).normalized(), cr * 0.8, (0, 0, 0.5, 0.5), rot=rng.uniform(0, 6), custom=custom,
               center_for_normals=cpos)
    bml.verts.index_update()
    nrm = {v.index: n for v, n in custom}
    leaves = C.new_obj(name + "_blossom", bml, [bloom])
    C.shade_smooth(leaves)
    C.apply_custom_normals(leaves, nrm)
    ob = cq.merge([wood, core_ob, leaves], name)
    print(name, C.tris(ob))
    return ob


def make_cherry():
    C.reset()
    a = cherry("cherry_a", 21, 1.0)
    b = cherry("cherry_b", 34, 0.85)
    C.export("cq_cherry_tree", [a, b])


# =============================================================================== street lamp
def make_lamp():
    C.reset()
    iron = C.material("lamp_iron", tex="iron.jpg", rough=0.5, metal=0.7)
    glow = C.material("lamp_glass", tex="lamp_glow.jpg", emissive_tex="lamp_glow.jpg", emissive_strength=4.0, rough=0.3)
    stone = C.material("lamp_stone", tex="granite.jpg", normal="granite_n.jpg", rough=0.9, vcol=True)
    objs = []
    objs.append(cq.lathe_obj("lamp_footing", [(0.0, 0.0), (0.3, 0.0), (0.3, 0.18), (0.22, 0.24), (0.0, 0.24)], stone, segs=8))
    objs.append(cq.lathe_obj("lamp_post", [(0.0, 0.0), (0.12, 0.0), (0.13, 0.12), (0.08, 0.25), (0.06, 0.4), (0.07, 0.45), (0.05, 0.6), (0.045, 2.5),
                                           (0.07, 2.55), (0.06, 2.62), (0.0, 2.62)], iron, segs=10, loc=(0, 0, 0.24)))
    # four-sided lantern cage with glowing glass
    lz = 2.86
    objs.append(cq.lathe_obj("lamp_base", [(0.0, 0.0), (0.09, 0.0), (0.18, 0.06), (0.17, 0.09), (0.0, 0.09)], iron, segs=4, loc=(0, 0, lz - 0.12), rot=(0, 0, math.pi / 4)))
    objs.append(cq.lathe_obj("lamp_glass", [(0.0, 0.0), (0.13, 0.0), (0.16, 0.34), (0.0, 0.34)], glow, segs=4, loc=(0, 0, lz - 0.04), rot=(0, 0, math.pi / 4)))
    for k in range(4):
        a = k / 4 * math.pi * 2 + math.pi / 4
        objs.append(C.box_obj(f"lamp_bar{k}", (0.025, 0.025, 0.38), (math.cos(a) * 0.15, math.sin(a) * 0.15, lz + 0.14), iron, rot=(0, 0, a), bevel=0.0))
    objs.append(cq.lathe_obj("lamp_roof", [(0.0, 0.0), (0.24, 0.0), (0.22, 0.03), (0.08, 0.16), (0.04, 0.2), (0.0, 0.2)], iron, segs=4, loc=(0, 0, lz + 0.3), rot=(0, 0, math.pi / 4)))
    objs.append(cq.lathe_obj("lamp_finial", [(0.0, 0.0), (0.03, 0.0), (0.05, 0.05), (0.0, 0.14)], iron, segs=8, loc=(0, 0, lz + 0.5)))
    cq.paint(objs, stone, cq.stone_vcol(moss=1.0, ao_h=0.3, seed=1))
    ob = cq.merge(objs, "street_lamp")
    C.export("cq_street_lamp", [ob])


# =============================================================================== exit gate
def make_gate():
    C.reset()
    rng = random.Random(5)
    stone = C.material("gate_travertine", tex="travertine.jpg", normal="travertine_n.jpg", rough=0.8, vcol=True)
    wood = C.material("gate_wood", tex="edo_wood.jpg", normal="edo_wood_n.jpg", rough=0.8, vcol=True)
    roof = C.material("gate_kawara", tex="roof_kawara.jpg", normal="roof_kawara_n.jpg", rough=0.7, vcol=True)
    portal = C.material("gate_portal", tex="portal.jpg", emissive_tex="portal.jpg", emissive_strength=1.6, rough=1.0, double=True)
    vines = C.material("gate_vines", tex="vines.png", rough=0.8, alpha_tex=True, double=True)
    glow = C.material("gate_lamp", tex="lamp_glow.jpg", emissive_tex="lamp_glow.jpg", emissive_strength=3.5, rough=0.5)
    objs = []
    OW, PW, H = 3.0, 1.1, 3.6  # opening width, pier width, pier height
    for sx in (-1, 1):
        x = sx * (OW / 2 + PW / 2)
        objs.append(C.box_obj(f"pier{sx}", (PW, 1.2, H), (x, 0, H / 2), stone, bevel=0.05, uv_scale=0.35, noise_amp=0.015, seed=2 + sx))
        objs.append(C.box_obj(f"pier_base{sx}", (PW + 0.25, 1.45, 0.4), (x, 0, 0.2), stone, bevel=0.05, uv_scale=0.35))
        objs.append(C.box_obj(f"pier_cap{sx}", (PW + 0.2, 1.35, 0.22), (x, 0, H + 0.11), stone, bevel=0.04, uv_scale=0.35))
    # round arch of voussoirs over the opening
    R = OW / 2
    n = 13
    for k in range(n):
        a0 = math.pi * k / n
        a1 = math.pi * (k + 1) / n
        am = (a0 + a1) / 2
        L = R * (a1 - a0) * 1.12
        objs.append(C.box_obj(f"vous{k}", (L, 1.15, 0.5), (math.cos(am) * (R + 0.25), 0, H + math.sin(am) * (R + 0.25) - 0.4), stone,
                              rot=(0, -(am - math.pi / 2), 0), bevel=0.03, uv_scale=0.35, noise_amp=0.01, seed=k))
    # attic block with a small tiled roof (a meeting of the eras)
    objs.append(C.box_obj("attic", (OW + PW * 2 + 0.2, 1.2, 1.0), (0, 0, H + R + 0.3), stone, bevel=0.04, uv_scale=0.35))
    objs.append(C.box_obj("attic_beam", (OW + PW * 2 + 0.6, 1.4, 0.18), (0, 0, H + R + 0.86), wood, bevel=0.03, uv_scale=0.5))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import make_edo
    objs.append(make_edo.curved_roof("gate_roof", roof, (OW + PW * 2) / 2 + 0.7, 1.15, (OW + PW * 2) / 2 - 0.4, 0.08, H + R + 0.95, 0.8, lift=0.28, n_edge=8, rings=6))
    # the shimmering way home: a portal sheet in the arch (animated in the game)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    ring = []
    for k in range(17):
        a = math.pi * k / 16
        ring.append(Vector((math.cos(a) * R * 0.98, 0, H - 0.4 + math.sin(a) * R * 0.98)))
    pts = [Vector((R * 0.98, 0, 0.0))] + ring + [Vector((-R * 0.98, 0, 0.0))]
    vs = [bm.verts.new(p) for p in pts]
    f = bm.faces.new(vs)
    for loop in f.loops:
        co = loop.vert.co
        loop[uvl].uv = (co.x / (2 * R) + 0.5, co.z / (H + R))
    objs.append(C.new_obj("portal", bm, [portal]))
    # hanging lanterns and vines
    for sx in (-1, 1):
        x = sx * (OW / 2 + PW / 2)
        objs.append(cq.lathe_obj(f"lamp{sx}", [(0.0, 0.0), (0.12, 0.02), (0.16, 0.16), (0.12, 0.32), (0.0, 0.34)], glow, segs=10, loc=(x, -0.85, H - 0.9)))
        objs.append(C.box_obj(f"lamp_arm{sx}", (0.05, 0.3, 0.05), (x, -0.72, H - 0.5), wood, bevel=0.0))
        objs.append(C.box_obj(f"lamp_cord{sx}", (0.02, 0.02, 0.22), (x, -0.85, H - 0.6), wood, bevel=0.0))
    anchors = [(Vector((sx * (OW / 2 + PW * rng.uniform(0.1, 0.9)), -0.62, H + rng.uniform(-0.2, 0.3))), Vector((0, -1, 0))) for sx in (-1, 1) for _ in range(4)]
    objs.append(cq.hanging_vines("gate_vines", vines, anchors, rng, length=(0.8, 1.8), width=0.6))
    cq.paint(objs, stone, cq.stone_vcol(moss=0.9, ao_h=2.0, seed=3))
    cq.paint(objs, wood, cq.stone_vcol(moss=0.0, ao_h=6.0, seed=3))
    cq.paint(objs, roof, cq.stone_vcol(moss=0.3, ao_h=30, seed=3))
    r = cq.group("quarter_gate", objs)
    C.export("cq_quarter_gate", [r])


# =============================================================================== era plinths
def make_plinths():
    C.reset()
    trav = C.material("plinth_travertine", tex="travertine.jpg", normal="travertine_n.jpg", rough=0.75, vcol=True)
    relief = C.material("plinth_relief", tex="relief.jpg", normal="relief_n.jpg", rough=0.8, vcol=True)
    wood = C.material("plinth_wood", tex="edo_wood.jpg", normal="edo_wood_n.jpg", rough=0.75, vcol=True)
    red = C.material("plinth_lacquer", tex="lacquer.jpg", rough=0.4, vcol=True)
    roof = C.material("plinth_kawara", tex="roof_kawara.jpg", normal="roof_kawara_n.jpg", rough=0.7, vcol=True)
    lime = C.material("plinth_limestone", tex="limestone.jpg", normal="limestone_n.jpg", rough=0.9, vcol=True)
    glyph = C.material("plinth_glyphs", tex="glyph_panel.jpg", normal="glyph_panel_n.jpg", rough=0.9, vcol=True)
    bronze = C.material("plinth_bronze", tex="bronze.jpg", rough=0.35, metal=0.85)
    out = []
    # Rome: a moulded pedestal (top at 1.0 m, 1.3 x 1.3) with a relief band and a bronze laurel ring
    o = [cq.lathe_obj("pr_base", [(0.0, 0.0), (0.98, 0.0), (0.98, 0.14), (0.86, 0.22), (0.82, 0.3), (0.0, 0.3)], trav, segs=4, rot=(0, 0, math.pi / 4))]
    o.append(C.box_obj("pr_die", (1.05, 1.05, 0.6), (0, 0, 0.6), trav, bevel=0.03, uv_scale=0.6))
    o.append(cq.quad_obj("pr_relief", relief, 0.9, 0.24, loc=(0, -0.53, 0.62), uv=(0.25, 0, 0.75, 1)))
    o.append(cq.lathe_obj("pr_top", [(0.0, 0.0), (0.82, 0.0), (0.9, 0.06), (0.95, 0.1), (0.95, 0.12), (0.0, 0.12)], trav, segs=4, loc=(0, 0, 0.9), rot=(0, 0, math.pi / 4)))
    o.append(cq.torus_obj("pr_laurel", 0.18, 0.025, bronze, loc=(0, -0.56, 0.62), rot=(math.pi / 2, 0, 0), seg=18, rseg=5))
    cq.paint(o, trav, cq.stone_vcol(moss=0.6, ao_h=0.8, seed=1))
    cq.paint(o, relief, cq.stone_vcol(moss=0.2, ao_h=2, seed=1))
    out.append(cq.merge(o, "plinth_rome"))
    # Edo: a lacquered display stand on a granite-free wooden base with a little roof on two posts
    o = [C.box_obj("pe_base", (1.4, 1.2, 0.2), (0, 0, 0.1), wood, bevel=0.03, uv_scale=0.6)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(C.box_obj(f"pe_leg{sx}{sy}", (0.1, 0.1, 0.7), (sx * 0.55, sy * 0.45, 0.55), red, bevel=0.015, uv_scale=1))
    o.append(C.box_obj("pe_top", (1.3, 1.1, 0.1), (0, 0, 0.95), red, bevel=0.025, uv_scale=1))
    o.append(C.box_obj("pe_shelf", (1.2, 1.0, 0.06), (0, 0, 0.45), wood, bevel=0.015, uv_scale=0.6))
    for sx in (-1, 1):
        o.append(C.box_obj(f"pe_post{sx}", (0.09, 0.09, 1.5), (sx * 0.62, 0.5, 1.75), wood, bevel=0.015, uv_scale=0.6))
    import make_edo
    o.append(make_edo.curved_roof("pe_roof", roof, 0.95, 0.75, 0.55, 0.05, 2.45, 0.45, lift=0.12, n_edge=6, rings=5))
    o[-1].location.y += 0.3
    cq.paint(o, wood, cq.stone_vcol(moss=0.0, ao_h=1.0, seed=2))
    cq.paint(o, red, cq.stone_vcol(moss=0.0, ao_h=1.0, seed=2))
    cq.paint(o, roof, cq.stone_vcol(moss=0.2, ao_h=9, seed=2))
    out.append(cq.merge(o, "plinth_edo"))
    # Maya: a stepped limestone altar with a glyph band
    o = [C.box_obj("pm_step0", (1.5, 1.5, 0.3), (0, 0, 0.15), lime, bevel=0.03, uv_scale=0.3, noise_amp=0.01)]
    o.append(C.box_obj("pm_step1", (1.25, 1.25, 0.3), (0, 0, 0.45), lime, bevel=0.03, uv_scale=0.3, noise_amp=0.01, seed=1))
    o.append(C.box_obj("pm_step2", (1.05, 1.05, 0.4), (0, 0, 0.8), lime, bevel=0.03, uv_scale=0.3, noise_amp=0.01, seed=2))
    o.append(cq.quad_obj("pm_glyphs", glyph, 0.9, 0.34, loc=(0, -0.53, 0.8), uv=(0, 0.42, 1, 0.62)))
    cq.paint(o, lime, cq.stone_vcol(moss=1.1, ao_h=0.8, seed=3))
    cq.paint(o, glyph, cq.stone_vcol(moss=0.5, ao_h=2, seed=3))
    out.append(cq.merge(o, "plinth_maya"))
    for ob in out:
        print(ob.name, C.tris(ob))
    C.export("cq_era_plinths", out)


# =============================================================================== Time Dial
def make_dial():
    """The detective's timeline station: a round stone table with a bronze dial, three sockets for the
    era tokens and a pointer, under a small roofless ring of posts."""
    C.reset()
    trav = C.material("dial_stone", tex="granite.jpg", normal="granite_n.jpg", rough=0.85, vcol=True)
    bronze = C.material("dial_bronze", tex="bronze.jpg", rough=0.35, metal=0.85)
    glow = C.material("dial_glow", color=(1.0, 0.8, 0.45), emissive=(1.0, 0.72, 0.35), emissive_strength=2.0)
    objs = []
    objs.append(cq.lathe_obj("dial_steps", [(0.0, 0.0), (1.7, 0.0), (1.7, 0.14), (1.45, 0.16), (1.45, 0.3), (0.0, 0.3)], trav, segs=32, v_scale=0.5, u_scale=4))
    objs.append(cq.lathe_obj("dial_pedestal", [(0.0, 0.0), (0.55, 0.0), (0.4, 0.15), (0.32, 0.55), (0.42, 0.7), (0.0, 0.7)], trav, segs=20, loc=(0, 0, 0.3)))
    objs.append(cq.lathe_obj("dial_table", [(0.0, 0.0), (0.9, 0.0), (1.0, 0.08), (1.0, 0.16), (0.92, 0.2), (0.0, 0.2)], trav, segs=32, loc=(0, 0, 1.0)))
    objs.append(cq.lathe_obj("dial_disc", [(0.0, 0.0), (0.82, 0.0), (0.85, 0.03), (0.0, 0.04)], bronze, segs=32, loc=(0, 0, 1.2)))
    objs.append(cq.torus_obj("dial_ring", 0.62, 0.02, bronze, loc=(0, 0, 1.25), seg=32, rseg=5))
    objs.append(cq.torus_obj("dial_ring2", 0.3, 0.018, bronze, loc=(0, 0, 1.25), seg=24, rseg=5))
    # three sockets on an arc, oldest on the left
    for k in range(3):
        a = math.pi * (0.8 - k * 0.3)
        objs.append(cq.lathe_obj(f"socket{k}", [(0.0, 0.0), (0.13, 0.0), (0.15, 0.05), (0.11, 0.06), (0.0, 0.04)], bronze, segs=16, loc=(math.cos(a) * 0.62, -math.sin(a) * 0.62 * -1 * -1, 1.24)))
    # gnomon / pointer arrow
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in ((-0.03, 0, 1.25), (0.03, 0, 1.25), (0.0, 0.0, 1.62), (0.0, 0.55, 1.25))]
    bm.faces.new((vs[0], vs[1], vs[2]))
    bm.faces.new((vs[0], vs[3], vs[2]))
    bm.faces.new((vs[1], vs[2], vs[3]))
    objs.append(C.new_obj("gnomon", bm, [bronze]))
    objs.append(cq.lathe_obj("dial_gem", [(0.0, 0.0), (0.07, 0.04), (0.0, 0.12)], glow, segs=8, loc=(0, 0, 1.25)))
    cq.paint(objs, trav, cq.stone_vcol(moss=0.8, ao_h=1.0, seed=4))
    r = cq.group("time_dial", objs)
    C.export("cq_time_dial", [r])


# =============================================================================== jungle plants
def make_jungle():
    C.reset()
    rng = random.Random(8)
    leaf = C.material("jungle_broadleaf", tex="broadleaf.png", rough=0.6, alpha_tex=True, double=True)
    palm = C.material("jungle_palm", tex="palm.png", rough=0.7, alpha_tex=True, double=True)
    bark = C.material("jungle_trunk", tex="bark.jpg", normal="bark_n.jpg", rough=0.9, vcol=True)
    out = []
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    custom = []
    cq.leaf_tuft(bm, uvl, Vector((0, 0, 0.05)), rng, custom, n=9, length=1.5, width=0.75, lift=1.2, droop=0.55)
    cq.leaf_tuft(bm, uvl, Vector((0, 0, 0.1)), rng, custom, n=4, length=0.9, width=0.5, lift=1.3, droop=0.1)
    out.append(cq.finish_cards("jungle_broadleaf", bm, leaf, custom))
    # small palm: curved ringed trunk + a crown of arching fronds
    bm = bmesh.new()
    pts = [Vector((math.sin(t * 1.4) * 0.5, 0, t * 3.2)) for t in [i / 10 for i in range(11)]]
    C.tube(bm, pts, [0.16 - 0.06 * i / 10 for i in range(11)], sides=8, noise_amp=0.05, v_scale=1.2, u_repeat=1.0,
           flare=lambda i, a: 0.025 * (i % 2))
    trunk = C.new_obj("palm_trunk", bm, [bark])
    C.shade_smooth(trunk)
    C.paint_vcol(trunk, lambda p, n: (0.85, 0.78, 0.62))
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    custom = []
    cq.leaf_tuft(bm, uvl, pts[-1], rng, custom, n=9, length=2.0, width=0.75, lift=0.45, droop=1.1)
    crown = cq.finish_cards("palm_crown", bm, palm, custom)
    out.append(cq.merge([trunk, crown], "jungle_palm"))
    for ob in out:
        print(ob.name, C.tris(ob))
    C.export("cq_jungle_plants", out)


# =============================================================================== pond life
def make_pond():
    C.reset()
    koi = C.material("koi_skin", tex="koi.jpg", rough=0.35)
    fin = C.material("koi_fin", color=(0.98, 0.82, 0.7), rough=0.5, double=True)
    lily = C.material("lily", tex="lily.png", rough=0.6, alpha_tex=True, double=True)
    out = []
    # koi: a lathe body along -Y (front), flattened sideways, with tail and fins
    bm = bmesh.new()
    prof = [(0.0, -0.31), (0.035, -0.29), (0.06, -0.24), (0.075, -0.14), (0.072, -0.02), (0.055, 0.1), (0.032, 0.2), (0.018, 0.26), (0.0, 0.28)]
    uvl = bm.loops.layers.uv.verify()
    segs = 12
    rings = []
    for r, y in prof:
        ring = []
        for k in range(segs):
            a = k / segs * math.pi * 2
            ring.append(bm.verts.new((math.cos(a) * r * 0.75, y, math.sin(a) * r)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            f = bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
            for loop in f.loops:
                co = loop.vert.co
                loop[uvl].uv = ((co.y + 0.31) / 0.6, math.atan2(co.z, co.x) / (2 * math.pi) + 0.5)
    body = C.new_obj("koi_body", bm, [koi])
    C.shade_smooth(body)
    fins = []
    tail = cq.quad_obj("koi_tail", fin, 0.18, 0.16, loc=(0, 0.34, 0), rot=(0, math.pi / 2, math.pi / 2))
    fins.append(tail)
    for sx in (-1, 1):
        fins.append(cq.quad_obj(f"koi_pec{sx}", fin, 0.08, 0.06, loc=(sx * 0.07, -0.16, -0.03), rot=(0.3, 0, sx * 0.6)))
    fins.append(cq.quad_obj("koi_dorsal", fin, 0.16, 0.05, loc=(0, 0.0, 0.08), rot=(0, 0, math.pi / 2)))
    out.append(cq.merge([body] + fins, "koi"))
    # lily pad (flat, slightly cupped) and lotus flower (crossed cards)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    c = bm.verts.new((0, 0, 0.0))
    ring = [bm.verts.new((math.cos(k / 16 * 6.283) * 0.3, math.sin(k / 16 * 6.283) * 0.3, 0.015)) for k in range(16)]
    for k in range(16):
        f = bm.faces.new((c, ring[k], ring[(k + 1) % 16]))
        for loop in f.loops:
            co = loop.vert.co
            loop[uvl].uv = (co.x / 0.6 * 0.5 + 0.25, co.y / 0.6 + 0.5)
    out.append(C.new_obj("lily_pad", bm, [lily]))
    lo = []
    for k in range(2):
        q = cq.quad_obj(f"lotus{k}", lily, 0.26, 0.26, loc=(0, 0, 0.11), rot=(0, 0, k * math.pi / 2), uv=(0.5, 0, 1, 1))
        lo.append(q)
    out.append(cq.merge(lo, "lotus"))
    for ob in out:
        print(ob.name, C.tris(ob))
    C.export("cq_pond_life", out)


if __name__ == "__main__":
    which = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["cherry", "lamp", "gate", "plinths", "dial", "jungle", "pond"]
    for w in which:
        {"cherry": make_cherry, "lamp": make_lamp, "gate": make_gate, "plinths": make_plinths, "dial": make_dial, "jungle": make_jungle, "pond": make_pond}[w]()
