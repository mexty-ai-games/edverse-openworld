"""Biome Frontier structures: research pier, field-station hut on stilts, rope bridge, icon signposts,
camera trap, trail gate back to the Idea Grove.

OW_TEX=build/tex OW_OUT=build/glb blender -b --factory-startup -P make_structures.py
Weathered planks (planks.jpg), thatch, rope; signs are icons only (signs.jpg atlas) so 4-6 year-olds can
read them. Fronts face -Y in Blender (+Z in the game). The pier and the bridge run along +X.
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

# atlas quadrants of signs.jpg in Blender UV space (v flipped): rainforest, canyon, coast, grove
QUAD = {"forest": (0.0, 0.5, 0.5, 1.0), "canyon": (0.5, 0.5, 1.0, 1.0), "coast": (0.0, 0.0, 0.5, 0.5), "grove": (0.5, 0.0, 1.0, 0.5)}


def mats():
    return {
        "wood": C.material("bf_wood", tex="planks.jpg", normal="planks_n.jpg", rough=0.85, vcol=True),
        "log": C.material("bf_log", tex="bark.jpg", normal="bark_n.jpg", rough=0.9),
        "rope": C.material("bf_rope", color=(0.72, 0.58, 0.36), rough=0.95),
        "thatch": C.material("bf_thatch", tex="thatch.jpg", rough=0.95, double=True),
        "sign": C.material("bf_sign", tex="signs.jpg", rough=0.8),
        "metal": C.material("bf_metal", color=(0.3, 0.32, 0.34), rough=0.45, metal=0.7),
    }


def wood_vcol(ob):
    C.paint_vcol(ob, lambda p, n: tuple(Vector((1, 0.97, 0.93)) * (0.8 + 0.2 * max(0.0, min(1.0, 0.5 + C.fbm(p * 1.3, 2))))))


def plank(name, size, loc, M, rot=(0, 0, 0), seed=0):
    b = C.box_obj(name, size, loc, M["wood"], rot=rot, bevel=0.02, segments=1, uv_scale=0.7, noise_amp=0.008, seed=seed)
    wood_vcol(b)
    return b


def log(name, a, b, r, M, sides=8):
    bm = bmesh.new()
    C.tube(bm, [Vector(a).lerp(Vector(b), t / 3) for t in range(4)], [r] * 4, sides=sides, cap_start=True, v_scale=0.6, noise_amp=0.06, seed=int(a[0] * 7))
    ob = C.new_obj(name, bm, [M["log"]])
    C.shade_smooth(ob)
    return ob


def rope(bm, a, b, sag, r=0.025, segs=10):
    pts = []
    for i in range(segs + 1):
        t = i / segs
        pts.append(Vector(a).lerp(Vector(b), t) + Vector((0, 0, -sag * math.sin(t * math.pi))))
    C.tube(bm, pts, [r] * len(pts), sides=5, cap_end=False)


def board(name, outline, depth, rect, M, loc=(0, 0, 0), rot=(0, 0, 0)):
    """An extruded 2D board (outline in X/Z) whose front and back carry an atlas rectangle of signs.jpg."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    xs = [p[0] for p in outline]
    zs = [p[1] for p in outline]
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
    u0, v0, u1, v1 = rect
    front = [bm.verts.new((x, -depth / 2, z)) for x, z in outline]
    back = [bm.verts.new((x, depth / 2, z)) for x, z in outline]
    ff = bm.faces.new(list(reversed(front)))
    fb = bm.faces.new(back)
    for f, flip in ((ff, False), (fb, True)):
        for loop in f.loops:
            x, z = loop.vert.co.x, loop.vert.co.z
            u = (x - x0) / (x1 - x0)
            if flip:
                u = 1 - u
            loop[uvl].uv = (u0 + (u1 - u0) * u, v0 + (v1 - v0) * (z - z0) / (z1 - z0))
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((front[i], front[j], back[j], back[i]))
        for loop in f.loops:
            loop[uvl].uv = (u0 + 0.02, v0 + 0.02)
    ob = C.new_obj(name, bm, [M["sign"]])
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def arrow_outline(w, h, point):
    return [(-w / 2, -h / 2), (w / 2 - point, -h / 2), (w / 2, 0), (w / 2 - point, h / 2), (-w / 2, h / 2)]


# =============================================================================== pier
def pier():
    C.reset()
    M = mats()
    objs = []
    L, Wd, top = 12.0, 2.4, 0.55
    rng = random.Random(3)
    # deck planks across the walkway, with small gaps
    x = -1.2
    i = 0
    while x < L:
        z = top if x >= 0 else top * (x + 1.2) / 1.2  # a little ramp up from the sand
        objs.append(plank(f"deck{i}", (0.28, Wd, 0.07), (x + 0.15, 0, z - 0.035), M, rot=(0, -0.42 if x < 0 else 0, rng.uniform(-.012, .012)), seed=i))
        x += 0.31
        i += 1
    # end platform
    for k in range(13):
        objs.append(plank(f"plat{k}", (4.0, 0.3, 0.07), (L + 1.6, -1.9 + k * 0.315, top - 0.035), M, seed=100 + k))
    # stringers + posts
    for y in (-Wd / 2 + 0.15, Wd / 2 - 0.15):
        objs.append(plank(f"stringer{y}", (L, 0.12, 0.18), (L / 2, y, top - 0.16), M))
    for k, px in enumerate([0.2, 2.2, 4.2, 6.2, 8.2, 10.2, 11.9]):
        for y in (-Wd / 2, Wd / 2):
            objs.append(log(f"post{k}{y}", (px, y, -1.8), (px, y, 1.45), 0.12, M))
    for (px, py) in ((L + 3.5, -2.0), (L + 3.5, 2.0), (L - 0.2, -2.0), (L - 0.2, 2.0)):
        objs.append(log(f"ppost{px}{py}", (px, py, -1.8), (px, py, 1.45), 0.13, M))
    bm = bmesh.new()
    xs = [0.2, 2.2, 4.2, 6.2, 8.2, 10.2, 11.9]
    for y in (-Wd / 2, Wd / 2):
        for a, b in zip(xs[:-1], xs[1:]):
            rope(bm, (a, y, 1.35), (b, y, 1.35), 0.18)
            rope(bm, (a, y, 0.9), (b, y, 0.9), 0.12)
    for (a, b) in (((L - 0.2, 2.0), (L + 3.5, 2.0)), ((L + 3.5, 2.0), (L + 3.5, -2.0)), ((L + 3.5, -2.0), (L - 0.2, -2.0))):
        rope(bm, (*a, 1.35), (*b, 1.35), 0.2)
    ro = C.new_obj("pier_ropes", bm, [M["rope"]])
    C.shade_smooth(ro)
    objs.append(ro)
    # research table with instruments, crates, lamp, life ring
    objs.append(plank("table_top", (1.4, 0.8, 0.06), (L + 2.2, 1.2, top + 0.85), M))
    for dx in (-0.6, 0.6):
        for dy in (-0.32, 0.32):
            objs.append(plank("table_leg", (0.06, 0.06, 0.82), (L + 2.2 + dx, 1.2 + dy, top + 0.42), M))
    glass = C.material("bf_glass", color=(0.6, 0.85, 0.9), rough=0.05, emissive=(0.2, 0.5, 0.55), emissive_strength=0.3)
    for k in range(3):
        bm = bmesh.new()
        C.lathe(bm, [(0.0, 0.0), (0.06, 0.0), (0.06, 0.22), (0.03, 0.26), (0.03, 0.3)], segs=10)
        jar = C.new_obj(f"jar{k}", bm, [glass])
        jar.location = (L + 1.75 + k * 0.22, 1.25, top + 0.88)
        C.shade_smooth(jar)
        objs.append(jar)
    scope = C.material("bf_scope", color=(0.9, 0.9, 0.86), rough=0.4)
    objs.append(C.box_obj("microscope_base", (0.3, 0.22, 0.05), (L + 2.6, 1.15, top + 0.91), scope, bevel=0.015))
    objs.append(C.box_obj("microscope_arm", (0.06, 0.06, 0.32), (L + 2.66, 1.18, top + 1.08), scope, rot=(0, -0.3, 0), bevel=0.01))
    for k, (cx, cy) in enumerate(((L + 0.6, -1.4), (L + 1.1, -1.5), (L + 0.8, -1.35))):
        objs.append(plank(f"crate{k}", (0.6, 0.6, 0.5), (cx, cy, top + 0.25 + (0.5 if k == 2 else 0)), M, rot=(0, 0, k * 0.4), seed=k))
    # lamp post
    objs.append(log("lamp_post", (L + 3.5, 2.0, 1.45), (L + 3.5, 2.0, 2.6), 0.08, M))
    lamp = C.material("bf_lamp", color=(1, 0.85, 0.5), emissive=(1.0, 0.8, 0.45), emissive_strength=3.0)
    bm = bmesh.new()
    C.lathe(bm, [(0.0, 0.0), (0.12, 0.0), (0.14, 0.18), (0.1, 0.3), (0.0, 0.32)], segs=8)
    lp = C.new_obj("lamp_glow", bm, [lamp])
    lp.location = (L + 3.5, 1.8, 2.25)
    objs.append(lp)
    ring_m = C.material("bf_lifering", color=(0.95, 0.4, 0.25), rough=0.5)
    bm = bmesh.new()
    rings = []
    for i in range(24):
        a = i / 24 * math.pi * 2
        rings.append(Vector((math.cos(a) * 0.32, 0, math.sin(a) * 0.32)))
    rings.append(rings[0])
    C.tube(bm, rings, [0.08] * len(rings), sides=8, cap_end=False)
    lr = C.new_obj("lifering", bm, [ring_m])
    C.paint_vcol(lr, lambda p, n: (1, 1, 1) if int((math.atan2(p.z - 1.0, p.x) + 4) * 4 / math.pi) % 2 else (1, 0.35, 0.25))
    lr.location = (L + 1.6, -2.05, 1.0)
    C.shade_smooth(lr)
    objs.append(lr)
    r = group("pier", objs)
    C.export("pier", [r])


# =============================================================================== field station
def field_station():
    C.reset()
    M = mats()
    objs = []
    W, D, floor = 4.4, 3.6, 0.8
    rng = random.Random(4)
    for x in (-W / 2, W / 2):
        for y in (-D / 2, D / 2):
            objs.append(log(f"stilt{x}{y}", (x, y, -0.2), (x, y, floor + 2.3), 0.13, M))
    # floor + porch (front, -Y)
    for k in range(15):
        objs.append(plank(f"floor{k}", (W + 0.4, 0.32, 0.07), (0, -D / 2 - 1.2 + k * 0.33, floor), M, seed=k))
    # walls: horizontal planks, door gap and a window gap at the front
    for k in range(7):
        z = floor + 0.2 + k * 0.3
        objs.append(plank(f"wall_back{k}", (W, 0.08, 0.28), (0, D / 2, z), M, seed=20 + k))
        for x in (-W / 2, W / 2):
            objs.append(plank(f"wall_side{k}{x}", (0.08, D, 0.28), (x, 0, z), M, rot=(0, 0, 0), seed=30 + k))
        # front: door (centre-left) and window (right)
        segs = [(-W / 2, -0.95), (-0.05, W / 2)]
        if 2 <= k <= 3:
            segs = [(-W / 2, -0.95), (-0.05, 0.5), (1.6, W / 2)]
        if k >= 5:
            segs = [(-W / 2, W / 2)]
        for (a, b) in segs:
            objs.append(plank(f"wall_front{k}{a}", (b - a, 0.08, 0.28), ((a + b) / 2, -D / 2, z), M, seed=40 + k))
    # roof: hipped thatch
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    ov = 0.7
    zt = floor + 2.35
    corners = [Vector((-W / 2 - ov, -D / 2 - ov - 1.0, zt - 0.3)), Vector((W / 2 + ov, -D / 2 - ov - 1.0, zt - 0.3)),
               Vector((W / 2 + ov, D / 2 + ov, zt - 0.3)), Vector((-W / 2 - ov, D / 2 + ov, zt - 0.3))]
    ridge = [Vector((-W / 4, -0.4, zt + 1.7)), Vector((W / 4, -0.4, zt + 1.7))]
    vs = [bm.verts.new(c) for c in corners] + [bm.verts.new(r) for r in ridge]
    for f in ((0, 1, 5, 4), (1, 2, 5), (2, 3, 4, 5), (3, 0, 4)):
        face = bm.faces.new([vs[i] for i in f])
        for loop in face.loops:
            co = loop.vert.co
            loop[uvl].uv = (co.x * 0.4 + co.y * 0.1, (zt + 1.7 - co.z) * 0.6)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
    roof = C.new_obj("roof", bm, [M["thatch"]])
    for v in roof.data.vertices:
        v.co.z += C.fbm(v.co * 0.8, 2) * 0.12
    # thickness via solidify
    md = roof.modifiers.new("solid", "SOLIDIFY")
    md.thickness = 0.18
    C.apply_all(roof)
    objs.append(roof)
    # porch steps
    for k in range(3):
        objs.append(plank(f"step{k}", (1.2, 0.34, 0.07), (-0.5, -D / 2 - 1.45 - k * 0.32, floor - 0.25 - k * 0.25), M, seed=60 + k))
    # survey board on the front wall (the painted map)
    bm_mat = C.material("survey_board", tex="survey_board.jpg", rough=0.8)
    sb = C.box_obj("survey_board", (1.1, 0.04, 0.9), (0.85, -D / 2 - 0.07, floor + 1.25), bm_mat, bevel=0.01, uv_scale=1.0)
    me = sb.data
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            me.uv_layers.active.data[li].uv = (co.x / 1.1 + 0.5, co.z / 0.9 + 0.5)
    objs.append(sb)
    # antenna + weather vane on the roof, barrel, plants in a pot
    objs.append(log("antenna", (W / 4, -0.4, zt + 1.5), (W / 4, -0.4, zt + 3.0), 0.03, M, sides=5))
    objs.append(C.box_obj("vane", (0.5, 0.02, 0.18), (W / 4 + 0.15, -0.4, zt + 2.9), M["metal"], bevel=0.005))
    bm = bmesh.new()
    C.lathe(bm, [(0.0, 0.0), (0.3, 0.0), (0.36, 0.4), (0.3, 0.8), (0.0, 0.8)], segs=14, v_scale=1.5, u_scale=2)
    barrel = C.new_obj("barrel", bm, [M["wood"]])
    wood_vcol(barrel)
    barrel.location = (W / 2 + 0.6, -D / 2 - 0.6, 0)
    C.shade_smooth(barrel)
    objs.append(barrel)
    leaf = C.material("station_plants", tex="bigleaf.png", rough=0.6, alpha_tex=True, double=True)
    stem = C.material("station_stems", color=(0.3, 0.5, 0.18), rough=0.8)
    for i, (x, y) in enumerate(((-W / 2 - 0.7, -D / 2 - 0.4), (W / 2 + 0.5, D / 2 + 0.3), (-W / 2 - 0.4, D / 2 + 0.5))):
        ps = leaf_plant(f"station_plant{i}", leaf, stem, (0.0, 0.0, 0.5, 1.0) if i % 2 else (0.5, 0.0, 1.0, 1.0), rng, leaves=6,
                        height=rng.uniform(0.9, 1.5), length=1.4, width=0.7, rise=0.4, droop=0.6)
        for o in ps:
            o.location = (x, y, 0)
        objs += ps
    # a small sign of the three biomes over the door
    objs.append(board("door_sign", [(-0.5, -0.22), (0.5, -0.22), (0.5, 0.22), (-0.5, 0.22)], 0.05, QUAD["forest"], M,
                      loc=(-0.5, -D / 2 - 0.08, floor + 2.25)))
    r = group("field_station", objs)
    C.export("field_station", [r])


# =============================================================================== rope bridge
def rope_bridge():
    C.reset()
    M = mats()
    objs = []
    L, Wd, sag = 10.0, 1.6, 0.35
    rng = random.Random(6)

    def deck_z(x):
        return 0.12 - sag * math.sin(max(0.0, min(1.0, x / L)) * math.pi)

    n = 30
    for k in range(n):
        x = (k + 0.5) / n * L
        dz = (deck_z(x + 0.05) - deck_z(x - 0.05)) / 0.1
        objs.append(plank(f"plank{k}", (0.26, Wd + rng.uniform(-0.1, 0.1), 0.06), (x, rng.uniform(-0.04, 0.04), deck_z(x)), M,
                          rot=(0, -math.atan(dz), rng.uniform(-0.05, 0.05)), seed=k))
    bm = bmesh.new()
    for y in (-Wd / 2 - 0.05, Wd / 2 + 0.05):
        pts = [Vector((x * L / 20, y, deck_z(x * L / 20) - 0.05)) for x in range(21)]
        C.tube(bm, pts, [0.03] * 21, sides=5, cap_end=False)
        hand = [Vector((x * L / 20, y, deck_z(x * L / 20) * 0.6 + 1.05)) for x in range(21)]
        C.tube(bm, hand, [0.035] * 21, sides=5, cap_end=False)
        for k in range(1, 20, 2):
            x = k * L / 20
            rope(bm, (x, y, deck_z(x) - 0.05), (x, y, deck_z(x) * 0.6 + 1.05), 0.0, r=0.015, segs=2)
    ro = C.new_obj("bridge_ropes", bm, [M["rope"]])
    C.shade_smooth(ro)
    objs.append(ro)
    for x in (-0.15, L + 0.15):
        for y in (-Wd / 2 - 0.1, Wd / 2 + 0.1):
            objs.append(log(f"bpost{x}{y}", (x, y, -0.6), (x, y, 1.35), 0.11, M))
    r = group("rope_bridge", objs)
    C.export("rope_bridge", [r])


# =============================================================================== signposts + camera trap
def signs():
    C.reset()
    M = mats()
    out = []
    # direction post: 3 arrows (forest, canyon, coast) at different heights / headings
    objs = [log("sp_post", (0, 0, -0.2), (0, 0, 2.3), 0.08, M)]
    for k, (key, yaw, z) in enumerate((("forest", 2.6, 1.95), ("canyon", 0.4, 1.6), ("coast", -0.9, 1.25))):
        b = board(f"arrow_{key}", arrow_outline(1.0, 0.34, 0.22), 0.05, QUAD[key], M, loc=(0, 0, z))
        b.rotation_euler = (0, 0, yaw)
        # push the board out along its own +X so it hangs off the post
        b.location = Vector((math.cos(yaw) * 0.4, math.sin(yaw) * 0.4, z))
        objs.append(b)
    out.append(group("signpost", objs))
    # area board: two posts and a square icon board (rect chosen in the game by material offset -> 4 variants)
    for key in ("forest", "canyon", "coast", "grove"):
        objs = [log(f"ab_post_l_{key}", (-0.55, 0, -0.2), (-0.55, 0, 1.6), 0.07, M), log(f"ab_post_r_{key}", (0.55, 0, -0.2), (0.55, 0, 1.6), 0.07, M)]
        objs.append(board(f"board_{key}", [(-0.6, -0.6), (0.6, -0.6), (0.6, 0.6), (-0.6, 0.6)], 0.06, QUAD[key], M, loc=(0, -0.08, 1.05)))
        out.append(group(f"board_{key}", objs))
    # camera trap: a stake with a camouflaged camera box (real field-survey tool)
    cam_m = C.material("bf_camtrap", color=(0.3, 0.42, 0.22), rough=0.7)
    lens = C.material("bf_lens", color=(0.05, 0.08, 0.1), rough=0.1, emissive=(0.1, 0.4, 0.6), emissive_strength=0.6)
    objs = [log("ct_stake", (0, 0, -0.2), (0, 0, 0.9), 0.05, M, sides=6)]
    objs.append(C.box_obj("ct_box", (0.2, 0.14, 0.28), (0, -0.09, 0.78), cam_m, bevel=0.03, segments=2))
    bm = bmesh.new()
    C.lathe(bm, [(0.0, 0.0), (0.045, 0.0), (0.045, 0.03), (0.0, 0.03)], segs=12)
    ln = C.new_obj("ct_lens", bm, [lens])
    ln.rotation_euler = (math.pi / 2, 0, 0)
    ln.location = (0, -0.16, 0.82)
    objs.append(ln)
    led = C.material("bf_led", color=(1, 0.3, 0.2), emissive=(1, 0.25, 0.15), emissive_strength=4)
    objs.append(C.box_obj("ct_led", (0.03, 0.02, 0.03), (0.06, -0.165, 0.7), led, bevel=0.005))
    out.append(group("camera_trap", objs))
    C.export("signposts", out)


# =============================================================================== trail gate
def gate():
    C.reset()
    M = mats()
    rng = random.Random(8)
    objs = [log("gate_l", (-1.9, 0, -0.3), (-1.9, 0, 3.6), 0.17, M, sides=10), log("gate_r", (1.9, 0, -0.3), (1.9, 0, 3.6), 0.17, M, sides=10)]
    bm = bmesh.new()
    arc = [Vector((math.sin(t) * 2.2, 0, 3.4 + math.cos(t) * 0.55 - 0.55 + 0.55)) for t in [(-1 + 2 * i / 10) * 1.3 for i in range(11)]]
    C.tube(bm, arc, [0.16] * 11, sides=10, noise_amp=0.05, seed=3)
    ob = C.new_obj("gate_arch", bm, [M["log"]])
    C.shade_smooth(ob)
    objs.append(ob)
    objs.append(board("gate_sign", [(-0.55, -0.4), (0.55, -0.4), (0.55, 0.4), (-0.55, 0.4)], 0.06, QUAD["grove"], M, loc=(0, -0.12, 3.05)))
    bm = bmesh.new()
    rope(bm, (-0.4, -0.12, 3.75), (-0.4, -0.12, 3.4), 0.0, r=0.015, segs=2)
    rope(bm, (0.4, -0.12, 3.75), (0.4, -0.12, 3.4), 0.0, r=0.015, segs=2)
    objs.append(C.new_obj("gate_ropes", bm, [M["rope"]]))
    # leafy crown along the arch and climbing vines
    canopy = C.material("gate_leaves", tex="canopy.png", rough=0.7, alpha_tex=True, double=True)
    bml = bmesh.new()
    custom = []
    for i in range(0, 11, 2):
        C.leaf_clump(bml, arc[i] + Vector((0, 0, 0.15)), 0.6, 10, rng, custom)
    for x in (-1.9, 1.9):
        for z in (0.8, 1.6, 2.4):
            C.leaf_clump(bml, Vector((x, 0, z)), 0.35, 5, rng, custom)
    objs.append(finish_cards("gate_leaves", bml, canopy, custom))
    # glowing lanterns either side (the grove's light)
    lamp = C.material("gate_glow", color=(1, 0.8, 0.45), emissive=(1.0, 0.72, 0.35), emissive_strength=3.0)
    for x in (-1.9, 1.9):
        bm = bmesh.new()
        C.lathe(bm, [(0.0, 0.0), (0.1, 0.0), (0.13, 0.15), (0.1, 0.3), (0.0, 0.32)], segs=8)
        lp = C.new_obj("gate_lantern", bm, [lamp])
        lp.location = (x, -0.25, 2.6)
        objs.append(lp)
    r = group("trail_gate", objs)
    C.export("trail_gate", [r])


if __name__ == "__main__":
    which = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["pier", "station", "bridge", "signs", "gate"]
    if "pier" in which:
        pier()
    if "station" in which:
        field_station()
    if "bridge" in which:
        rope_bridge()
    if "signs" in which:
        signs()
    if "gate" in which:
        gate()
