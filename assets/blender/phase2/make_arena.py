"""The Bug Games arena: a friendly wooden "nature olympics" set (separate pieces so it fits the Idea Grove's edge or
Biome Frontier). OW_TEX=<tex> OW_OUT=<glb> blender -b --factory-startup -P make_arena.py [-- name ...]

Metres, Z up in Blender (+Y in glTF), each piece's origin on the ground at its centre, front facing -Y (+Z glTF).
grandstand   3-tier bleacher 4 m wide, leaf garland, pennant strings (node 'grandstand_pennants' to sway)
long_jump    sand lane 4.4 x 0.7 m, take-off board at y=-2, distance markers 1..8 every 0.5 m along +Y
             (marker k at y = -2 + 0.5 k); node 'long_jump_sand'
weight_pull  rail track 3 m along Y, sled node 'pull_sled' (move along Y, start y=-1.3), weight discs node
             'pull_weights' (child-free, place on the sled), finish flag
race_lane    two-lane track 4 m along Y, start gate y=-1.9, finish gate y=+1.9 (nodes 'race_start', 'race_finish')
hide_board   leafy camouflage board 1.8 x 1.3 m with twigs (where the stick insect hides); node 'hide_leaves'
night_box    1 m dark box with star lining, round side peep windows and a lift-up lid (node 'night_box_lid',
             hinge along its back edge y=+0.5, z=1.0)
podium       1-2-3 podium with leaf medals on a stand (nodes 'medal_gold', 'medal_silver', 'medal_bronze')
scoreboard   framed board on posts; node 'scoreboard_screen' uses material 'scoreboard_screen' (slate.jpg,
             UV 0..1, 2:1) - replace its map with a CanvasTexture to draw scores/names in game
"""
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import p2 as R  # noqa: E402
from p2 import C, blob, box, flat, lathe_obj, shade, smooth_pts, soft, tube  # noqa: E402

V = Vector
# Okabe-Ito based, colour-blind safe pennant colours
PAL = [(0.9, 0.6, 0.0), (0.35, 0.7, 0.9), (0.0, 0.62, 0.45), (0.94, 0.89, 0.26), (0.0, 0.45, 0.7), (0.84, 0.37, 0.0), (0.8, 0.47, 0.65)]


def lin(c):
    return tuple(max(0.0, x) ** 2.2 for x in c)


def painter(base, fn=None, amt=0.15):
    def f(p, n):
        c = fn(p, n) if fn else None
        return lin(shade(c if c is not None else base, n, amt))
    return f


_M = {}


def M(kind):
    if kind in _M:
        return _M[kind]
    if kind == "wood":
        m = C.material("arena_wood", tex="wood.jpg", normal="wood_n.jpg", rough=0.7, normal_strength=0.6, vcol=True)
    elif kind == "leaf":
        m = C.material("arena_leaves", tex="leafcard.png", alpha_tex=True, rough=0.7)
        m.use_backface_culling = False
    elif kind == "fabric":
        m = soft("arena_fabric", tex="fabric.jpg", rough=0.9)
        m.use_backface_culling = False
    elif kind == "sand":
        m = C.material("arena_sand", tex="sand.jpg", rough=0.95)
    elif kind == "digits":
        m = C.material("arena_digits", tex="digits.png", alpha_tex=True, rough=0.6)
    elif kind == "paint":
        m = soft("arena_paint", tex="paint.jpg", rough=0.6)
    elif kind == "rope":
        m = soft("arena_rope", tex="bark.jpg", rough=0.95)
    elif kind == "night":
        m = C.material("arena_night", tex="night.jpg", rough=0.9, emissive_tex="night.jpg", emissive_strength=0.6)
    elif kind == "slate":
        m = C.material("scoreboard_screen", tex="slate.jpg", rough=0.85)
    elif kind == "brass":
        m = C.material("arena_brass", color=(0.86, 0.66, 0.3), rough=0.3, metal=0.85)
    _M[kind] = m
    return m


def plank(name, size, loc, tint=(0.95, 0.85, 0.72), rot=(0, 0, 0), seed=0):
    """A bevelled, gently warped painted board (vertex tint: lighter worn top edges)."""
    rng = random.Random(seed)
    ob = box(name, size, loc, M("wood"), rot=rot, bevel=min(0.02, min(size) * 0.3), seg=2, uv=1.0, noise=0.006, seed=seed)
    t = tuple(c * rng.uniform(0.92, 1.05) for c in tint)
    C.paint_vcol(ob, painter(t, lambda p, n: tuple(min(1, c * 1.1) for c in t) if n.z > 0.7 else None))
    return ob


def post(name, base, h, r=0.05, tint=(0.85, 0.7, 0.55), cap=True):
    base = V(base)
    o = [tube(name, [base, base + V((0, 0, h * 0.5)), base + V((0, 0, h))], [r * 1.08, r, r * 0.95], M("wood"), sides=10, noise=0.05, nscale=8,
              col=painter(tint))]
    if cap:
        o.append(blob(name + "_cap", base + V((0, 0, h)), (r * 1.25, r * 1.25, r * 0.8), M("wood"), seg=12, ring=6, col=painter(tint)))
    return o


def leaves(name, centers, radius, count, seed=1, flat=0.85):
    """Leaf-card clumps (alpha-clipped painted leaves, normals bent outward for a soft, full look)."""
    bm = bmesh.new()
    custom = []
    rng = random.Random(seed)
    for c in centers:
        C.leaf_clump(bm, V(c), radius, count, rng, custom, flat=flat)
    bm.verts.index_update()
    m = {v.index: nn for v, nn in custom}
    ob = C.new_obj(name, bm, [M("leaf")])
    C.shade_smooth(ob)
    C.apply_custom_normals(ob, m)
    return ob


def bushes(name, spots, radius, seed=1):
    """Low, grounded shrubs: a dome of leaf cards on a few short twiggy stems (spots are (x, y) on the ground)."""
    rng = random.Random(seed)
    centers, stems = [], []
    for k, (x, y) in enumerate(spots):
        c = V((x, y, radius * 0.55))
        centers += [c, c + V((radius * 0.45, rng.uniform(-0.1, 0.1), -radius * 0.2)), c + V((-radius * 0.4, rng.uniform(-0.1, 0.1), -radius * 0.25))]
        for j in range(3):
            a = rng.uniform(0, 6.28)
            top = c + V((math.cos(a) * radius * 0.4, math.sin(a) * radius * 0.4, -radius * 0.1))
            stems.append(tube(f"{name}_stem{k}{j}", [V((x, y, 0.0)), (V((x, y, 0)) + top) / 2, top], [0.018, 0.012, 0.006], M("rope"), sides=5,
                              col=painter((0.45, 0.34, 0.22))))
    lv = leaves(name + "_lv", centers, radius * 0.75, 12, seed, flat=0.6)
    return C.join([lv] + stems, name)


def garland(name, p0, p1, sag, n_clumps, radius=0.12, seed=3):
    pts = []
    for i in range(n_clumps):
        k = i / max(1, n_clumps - 1)
        p = V(p0).lerp(V(p1), k) + V((0, 0, -sag * 4 * k * (1 - k)))
        pts.append(p)
    rope = tube(name + "_rope", [V(p0).lerp(V(p1), i / 12) + V((0, 0, -sag * 4 * (i / 12) * (1 - i / 12))) for i in range(13)], [0.012] * 13,
                M("rope"), sides=6, col=painter((0.6, 0.48, 0.32)))
    return [rope, leaves(name + "_leaves", pts, radius, 7, seed)]


def pennants(name, p0, p1, sag, n, size=0.22, seed=5):
    """A string of triangular cloth flags in colour-blind safe colours, each slightly turned."""
    rng = random.Random(seed)
    p0, p1 = V(p0), V(p1)
    line = [p0.lerp(p1, i / 16) + V((0, 0, -sag * 4 * (i / 16) * (1 - i / 16))) for i in range(17)]
    objs = [tube(name + "_string", line, [0.008] * 17, M("rope"), sides=5, col=painter((0.92, 0.88, 0.78)))]
    d = (p1 - p0).normalized()
    for i in range(n):
        k = (i + 0.5) / n
        top = p0.lerp(p1, k) + V((0, 0, -sag * 4 * k * (1 - k)))
        bm = bmesh.new()
        w = size * 0.5
        side = d * w
        a = bm.verts.new(top - side)
        b = bm.verts.new(top + side)
        tw = V((rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), 0))
        c = bm.verts.new(top + V((0, 0, -size * 1.15)) + tw)
        f = bm.faces.new((a, b, c))
        uv = bm.loops.layers.uv.verify()
        for lp, t in zip(f.loops, ((0, 1), (1, 1), (0.5, 0))):
            lp[uv].uv = t
        o = C.new_obj(f"{name}_flag{i}", bm, [M("fabric")])
        col = PAL[i % len(PAL)]
        C.paint_vcol(o, lambda p, nrm, col=col: lin(col))
        sol = o.modifiers.new("s", "SOLIDIFY")
        sol.thickness = 0.006
        C.apply_all(o)
        objs.append(o)
    return objs


def digit_sign(name, k, center, size, facing=V((0, -1, 0))):
    """A round cream number disc (digits atlas cell k = 1..8) on a facing quad, double-sided by a backing disc."""
    bm = bmesh.new()
    f = facing.normalized()
    up = V((0, 0, 1))
    rt = up.cross(f).normalized() * -1
    h = size / 2
    c = V(center)
    vs = [bm.verts.new(c + rt * x * h + up * y * h) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    face = bm.faces.new(vs)
    uv = bm.loops.layers.uv.verify()
    i = k - 1
    u0, v0 = (i % 4) * 0.25, 1 - (i // 4 + 1) * 0.5
    for lp, (x, y) in zip(face.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = (u0 + x * 0.25, v0 + y * 0.5)
    o = C.new_obj(name, bm, [M("digits")])
    return o


def export(name, objs):
    R.export_static(os.path.join(C.OUT, "arena_" + name + ".glb"), objs)


# =============================================================================== grandstand
def grandstand():
    W = 4.0
    parts = []
    tints = [(0.95, 0.82, 0.62), (0.9, 0.74, 0.55), (0.98, 0.86, 0.66)]
    for t in range(3):
        y = -0.55 + t * 0.55
        z = 0.38 + t * 0.38
        parts.append(plank(f"gs_seat{t}", (W, 0.42, 0.07), (0, y, z), tints[t], seed=t))
        parts.append(plank(f"gs_riser{t}", (W, 0.05, z - 0.04), (0, y - 0.19, (z - 0.04) / 2), (0.75, 0.55, 0.38), seed=10 + t))
        for k, x in enumerate((-1.9, -0.95, 0.0, 0.95, 1.9)):
            parts.append(plank(f"gs_leg{t}{k}", (0.08, 0.08, z), (x, y + 0.14, z / 2), (0.72, 0.52, 0.36), seed=20 + t * 5 + k))
    # side panels with a big painted leaf-and-beetle emblem disc
    for s in (-1, 1):
        parts.append(plank(f"gs_side{s}", (0.07, 1.7, 1.2), (s * (W / 2 + 0.04), 0.0, 0.6), (0.82, 0.62, 0.42), seed=40 + s))
        em = lathe_obj(f"gs_emblem{s}", [(0.0, 0.0), (0.3, 0.0), (0.32, 0.03), (0.3, 0.05), (0.0, 0.05)], M("paint"), segs=28, cap=False,
                       rot=(0, s * math.pi / 2, 0), loc=(s * (W / 2 + 0.08), 0.0, 0.66))
        C.paint_vcol(em, painter((0.96, 0.9, 0.72), lambda p, n: (0.3, 0.62, 0.36) if (V((p.y, p.z - 0.66, 0))).length < 0.2 else None))
        parts.append(em)
        parts += post(f"gs_pole{s}", (s * (W / 2 + 0.04), 0.75, 0), 2.4, 0.06)
    # back rail
    parts.append(plank("gs_backrail", (W + 0.1, 0.06, 0.08), (0, 0.8, 1.55), (0.85, 0.66, 0.46), seed=50))
    for x in (-1.3, 0.0, 1.3):
        parts.append(plank(f"gs_railpost{x}", (0.06, 0.06, 0.4), (x, 0.8, 1.32), (0.8, 0.6, 0.42), seed=51))
    stand = C.join(parts, "grandstand")
    gl = garland("gs_garland", (-W / 2 - 0.04, 0.8, 1.6), (W / 2 + 0.04, 0.8, 1.6), 0.08, 11, 0.13)
    g = C.join(gl, "grandstand_garland")
    pen = pennants("gs_pen", (-W / 2 - 0.04, 0.75, 2.35), (W / 2 + 0.04, 0.75, 2.35), 0.35, 13)
    pen += pennants("gs_pen2", (-W / 2 - 0.04, 0.75, 2.35), (0, -1.6, 2.0), 0.2, 6, seed=7)
    pen += pennants("gs_pen3", (W / 2 + 0.04, 0.75, 2.35), (0, -1.6, 2.0), 0.2, 6, seed=8)
    pp = post("gs_frontpole", (0, -1.6, 0), 2.1, 0.05)
    p = C.join(pen + pp, "grandstand_pennants")
    export("grandstand", [stand, g, p])


# =============================================================================== long jump
def long_jump():
    L, Wd = 4.4, 0.7
    parts = []
    sand_bm = bmesh.new()
    nx, ny = 8, 40
    grid = []
    uvl = sand_bm.loops.layers.uv.verify()
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            x = -Wd / 2 + Wd * i / nx
            y = -L / 2 + L * j / ny
            z = 0.06 + 0.012 * C.fbm(V((x * 3, y * 3, 0)), 3) + 0.01 * math.cos(x / Wd * math.pi)
            row.append(sand_bm.verts.new((x, y, z)))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            f = sand_bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            for lp in f.loops:
                lp[uvl].uv = (lp.vert.co.x * 1.5, lp.vert.co.y * 1.5)
    sand = C.new_obj("long_jump_sand", sand_bm, [M("sand")])
    C.shade_smooth(sand)
    # border boards
    for s in (-1, 1):
        parts.append(plank(f"lj_side{s}", (0.1, L + 0.2, 0.12), (s * (Wd / 2 + 0.05), 0, 0.06), (0.88, 0.7, 0.5), seed=60 + s))
    for s in (-1, 1):
        parts.append(plank(f"lj_end{s}", (Wd, 0.1, 0.12), (0, s * (L / 2 + 0.05), 0.06), (0.88, 0.7, 0.5), seed=63 + s))
    # take-off board (white) and runway mat before it
    parts.append(plank("lj_takeoff", (Wd, 0.12, 0.075), (0, -L / 2 + 0.4, 0.06), (0.98, 0.97, 0.93), seed=66))
    # distance markers: posts with number discs on the left, white lath lines across the sand
    for k in range(1, 9):
        y = -2.0 + 0.5 * k
        if y > L / 2:
            break
        parts += post(f"lj_mark{k}", (-(Wd / 2 + 0.16), y, 0), 0.38, 0.025, tint=(0.95, 0.9, 0.8), cap=False)
        disc = lathe_obj(f"lj_disc{k}", [(0.0, -0.012), (0.1, -0.012), (0.1, 0.0)], M("paint"), segs=20, cap=False, rot=(math.pi / 2, 0, 0),
                         loc=(-(Wd / 2 + 0.16), y + 0.0, 0.45))
        C.paint_vcol(disc, painter(PAL[k % len(PAL)]))
        parts.append(disc)
        parts.append(digit_sign(f"lj_num{k}", k, (-(Wd / 2 + 0.16), y - 0.014, 0.45), 0.19))
        parts.append(digit_sign(f"lj_numb{k}", k, (-(Wd / 2 + 0.16), y + 0.014, 0.45), 0.19, V((0, 1, 0))))
        parts.append(plank(f"lj_line{k}", (Wd, 0.025, 0.012), (0, y, 0.072), (0.98, 0.97, 0.93), seed=70 + k))
    parts.append(plank("lj_rake", (0.5, 0.05, 0.03), (Wd / 2 + 0.35, -1.2, 0.02), (0.8, 0.6, 0.4), seed=80))
    parts += [tube("lj_rakehandle", [V((Wd / 2 + 0.35, -1.2, 0.03)), V((Wd / 2 + 0.35, -0.2, 0.06))], [0.015, 0.015], M("wood"), sides=8,
                   col=painter((0.85, 0.66, 0.46)))]
    frame = C.join(parts, "long_jump")
    flora = bushes("lj_bush", [(Wd / 2 + 0.3, L / 2 + 0.1), (-Wd / 2 - 0.3, L / 2 + 0.15), (Wd / 2 + 0.35, -L / 2 + 0.1)], 0.26, 9)
    export("long_jump", [frame, sand, flora])


# =============================================================================== weight pull
def weight_pull():
    L = 3.0
    parts = []
    parts.append(plank("wp_bed", (0.7, L, 0.05), (0, 0, 0.025), (0.8, 0.62, 0.44), seed=90))
    for s in (-1, 1):
        parts.append(plank(f"wp_rail{s}", (0.06, L, 0.08), (s * 0.2, 0, 0.09), (0.95, 0.85, 0.66), seed=91 + s))
        parts.append(plank(f"wp_side{s}", (0.06, L, 0.12), (s * 0.38, 0, 0.06), (0.75, 0.56, 0.38), seed=94 + s))
    for k in range(1, 6):
        y = -L / 2 + k * 0.5
        parts.append(plank(f"wp_tick{k}", (0.32, 0.02, 0.01), (0, y, 0.055), (0.98, 0.97, 0.93), seed=96 + k))
        parts.append(digit_sign(f"wp_num{k}", k, (0.38, y, 0.2), 0.14, V((1, 0, 0))))
        parts += post(f"wp_npost{k}", (0.42, y, 0), 0.14, 0.015, cap=False)
    # finish flag on a post, pulley on the start post
    parts += post("wp_finish", (-0.45, L / 2, 0), 0.9, 0.035)
    flag = pennants("wp_flag", (-0.45, L / 2, 0.86), (-0.45, L / 2 - 0.3, 0.86), 0.0, 1, 0.3)
    parts += flag
    parts += post("wp_start", (0, -L / 2 - 0.12, 0), 0.3, 0.04)
    pul = lathe_obj("wp_pulley", [(0.0, -0.02), (0.06, -0.02), (0.045, 0.0), (0.06, 0.02), (0.0, 0.02)], M("brass"), segs=20, cap=False,
                    rot=(0, math.pi / 2, 0), loc=(0, -L / 2 - 0.12, 0.34))
    parts.append(pul)
    track = C.join(parts, "weight_pull")
    # the sled (insect pulls this along Y) and a stack of acorn-cap weight discs
    sp = [plank("sled_deck", (0.34, 0.3, 0.035), (0, 0, 0.12), (0.96, 0.84, 0.62), seed=99)]
    for s in (-1, 1):
        sp.append(tube(f"sled_runner{s}", smooth_pts([(s * 0.2, -0.2, 0.16), (s * 0.2, -0.19, 0.105), (s * 0.2, -0.1, 0.1), (s * 0.2, 0.17, 0.1)], 3),
                       [0.015] * 10, M("wood"), sides=8, col=painter((0.7, 0.5, 0.32))))
    sp.append(tube("sled_rope", smooth_pts([(0, -0.15, 0.14), (0, -0.3, 0.13), (0, -0.45, 0.12)], 3), [0.008] * 7, M("rope"), sides=5,
                   col=painter((0.86, 0.78, 0.6))))
    sled = C.join(sp, "pull_sled")
    sled.location = (0, -L / 2 + 0.2, 0)
    ws = []
    for k in range(4):
        d = lathe_obj(f"pw_disc{k}", [(0.0, 0.0), (0.1 - k * 0.012, 0.0), (0.105 - k * 0.012, 0.02), (0.1 - k * 0.012, 0.04), (0.0, 0.04)], M("paint"),
                      segs=20, cap=False, loc=(0, 0, 0.14 + k * 0.042))
        C.paint_vcol(d, painter([(0.55, 0.36, 0.2), (0.62, 0.42, 0.24), (0.7, 0.5, 0.3), (0.78, 0.6, 0.36)][k]))
        ws.append(d)
    knob = blob("pw_knob", (0, 0, 0.32), (0.025, 0.025, 0.03), M("wood"), seg=10, ring=6, col=painter((0.5, 0.33, 0.2)))
    weights = C.join(ws + [knob], "pull_weights")
    weights.location = (0, -L / 2 + 0.2, 0)
    bush = bushes("pull_bushes", [(-0.62, -1.3), (0.64, 1.35), (-0.62, 0.6)], 0.25, 23)
    export("weight_pull", [track, sled, weights, bush])


# =============================================================================== race lane
def race_lane():
    L = 4.0
    parts = []
    parts.append(plank("rl_bed", (1.0, L, 0.05), (0, 0, 0.025), (0.62, 0.78, 0.5), seed=110))  # green painted track
    for x in (-0.5, 0.0, 0.5):
        parts.append(plank(f"rl_wall{x}", (0.05, L, 0.1), (x, 0, 0.08), (0.95, 0.88, 0.7), seed=111))
    for k in range(1, 8):
        parts.append(plank(f"rl_tick{k}", (0.98, 0.015, 0.006), (0, -L / 2 + k * 0.5, 0.053), (0.98, 0.97, 0.9), seed=115 + k))
    for s, lane in ((-1, 1), (1, 2)):
        parts.append(digit_sign(f"rl_lane{lane}", lane, (s * 0.25, -L / 2 + 0.1, 0.0555), 0.22, V((0, 0, 1))))
    track = C.join(parts, "race_lane")

    def gate(name, y, check):
        g = []
        for s in (-1, 1):
            g += post(f"{name}_p{s}", (s * 0.6, y, 0), 0.9, 0.04)
        arch = tube(f"{name}_arch", smooth_pts([(-0.6, y, 0.9), (-0.3, y, 1.05), (0.3, y, 1.05), (0.6, y, 0.9)], 4), [0.035] * 13, M("wood"), sides=10,
                    col=painter((0.85, 0.66, 0.46)))
        g.append(arch)
        ban = box(f"{name}_banner", (0.8, 0.02, 0.18), (0, y - 0.04, 0.82), M("fabric"), bevel=0.005)
        if check:
            C.paint_vcol(ban, lambda p, n: lin((0.1, 0.1, 0.1)) if (int((p.x + 1) * 11) + int((p.z) * 11)) % 2 else lin((0.97, 0.97, 0.94)))
        else:
            C.paint_vcol(ban, painter((0.0, 0.62, 0.45)))
        g.append(ban)
        g.append(garland(f"{name}_gar", (-0.6, y, 0.95), (0.6, y, 0.95), 0.0, 7, 0.09, seed=int(abs(y) * 10))[1])
        return C.join(g, name)

    st = gate("race_start", -L / 2 + 0.1, False)
    fi = gate("race_finish", L / 2 - 0.1, True)
    bush = bushes("race_bushes", [(-0.78, -1.6), (0.78, -1.5), (-0.78, 0.3), (0.8, 1.7), (-0.76, 1.75)], 0.25, 21)
    export("race_lane", [track, st, fi, bush])


# =============================================================================== hide-and-seek leafy board
def hide_board():
    W, H = 1.8, 1.3
    parts = []
    parts.append(plank("hb_back", (W, 0.05, H), (0, 0.04, 0.25 + H / 2), (0.55, 0.42, 0.28), seed=120))
    for s in (-1, 1):
        parts += post(f"hb_post{s}", (s * (W / 2 + 0.05), 0.06, 0), H + 0.45, 0.05)
    parts.append(plank("hb_top", (W + 0.25, 0.1, 0.09), (0, 0.04, 0.25 + H + 0.04), (0.88, 0.7, 0.5), seed=121))
    parts.append(plank("hb_bottom", (W + 0.1, 0.1, 0.09), (0, 0.0, 0.25), (0.88, 0.7, 0.5), seed=122))
    # magnifier emblem on top (a lens ring with a leaf): "look closely"
    ring = tube("hb_lens", [V((math.cos(a) * 0.14, 0.0, 1.78 + math.sin(a) * 0.14)) for a in [i / 24 * math.pi * 2 for i in range(25)]], [0.025] * 25,
                M("brass"), sides=8)
    hand = tube("hb_lenshandle", [V((0.1, 0.0, 1.68)), V((0.24, 0.0, 1.55))], [0.028, 0.03], M("wood"), sides=8, col=painter((0.7, 0.45, 0.28)))
    parts += [ring, hand]
    frame = C.join(parts, "hide_board")
    # dense leaves on the face of the board + twigs crossing it (the stick insect hides on these)
    rng = random.Random(7)
    cs = []
    for i in range(7):
        for j in range(5):
            cs.append((-W / 2 + 0.13 + i * (W - 0.26) / 6 + rng.uniform(-0.05, 0.05), -0.04, 0.32 + j * (H - 0.14) / 4 + rng.uniform(-0.04, 0.04)))
    lv = leaves("hide_leaves", cs, 0.17, 9, 11)
    tw = []
    for k, (a, b) in enumerate((((-0.85, -0.08, 0.5), (0.7, -0.1, 1.2)), ((-0.6, -0.1, 1.4), (0.85, -0.08, 0.7)), ((-0.2, -0.12, 0.3), (0.1, -0.12, 1.5)))):
        a, b = V(a), V(b)
        mid = (a + b) / 2 + V((0, -0.04, 0.05))
        tw.append(tube(f"hb_twig{k}", smooth_pts([a, mid, b], 5), [0.018 - 0.001 * i for i in range(11)], M("rope"), sides=6,
                       col=painter((0.5, 0.4, 0.27))))
    twigs = C.join(tw, "hide_twigs")
    export("hide_board", [frame, lv, twigs])


# =============================================================================== night box
def night_box():
    S = 1.0
    parts = []
    T = 0.05
    tint = (0.42, 0.33, 0.5)  # dusk-violet painted wood
    for s in (-1, 1):
        parts.append(plank(f"nb_side{s}", (T, S, S), (s * (S / 2 - T / 2), 0, S / 2 + 0.06), tint, seed=130 + s))
    parts.append(plank("nb_back", (S, T, S), (0, S / 2 - T / 2, S / 2 + 0.06), tint, seed=133))
    parts.append(plank("nb_floor", (S, S, T), (0, 0, 0.06 + T / 2), tint, seed=134))
    # front with a low opening for the creature; round peep windows on the sides (not the front, so it never reads as a face)
    parts.append(plank("nb_front_l", (0.28, T, S), (-0.36, -S / 2 + T / 2, S / 2 + 0.06), tint, seed=135))
    parts.append(plank("nb_front_r", (0.28, T, S), (0.36, -S / 2 + T / 2, S / 2 + 0.06), tint, seed=136))
    parts.append(plank("nb_front_t", (0.44, T, 0.62), (0, -S / 2 + T / 2, 0.75), tint, seed=137))
    for sx in (-1, 1):
        parts.append(tube(f"nb_port{sx}", [V((sx * (S / 2 + 0.005), math.cos(a) * 0.1, 0.62 + math.sin(a) * 0.1)) for a in [i / 20 * math.pi * 2 for i in range(21)]],
                          [0.02] * 21, M("brass"), sides=8))
    # feet
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(blob(f"nb_foot{sx}{sy}", (sx * 0.42, sy * 0.42, 0.03), (0.06, 0.06, 0.04), M("wood"), seg=10, ring=6, col=painter((0.4, 0.3, 0.22))))
    # moon and stars painted on the front
    moon = lathe_obj("nb_moon", [(0.0, 0.0), (0.09, 0.0), (0.09, 0.012)], M("paint"), segs=20, cap=False, rot=(math.pi / 2, 0, 0), loc=(-0.3, -S / 2 - 0.004, 0.88))
    C.paint_vcol(moon, painter((0.98, 0.9, 0.55)))
    moon_cut = lathe_obj("nb_mooncut", [(0.0, 0.0), (0.075, 0.0), (0.075, 0.014)], M("paint"), segs=20, cap=False, rot=(math.pi / 2, 0, 0),
                         loc=(-0.26, -S / 2 - 0.008, 0.9))
    C.paint_vcol(moon_cut, painter(tint))
    parts += [moon, moon_cut]
    for k, (x, z, r) in enumerate(((0.05, 0.93, 0.03), (0.22, 0.84, 0.045), (0.33, 0.95, 0.025), (-0.12, 0.8, 0.022), (0.3, 0.6, 0.03), (-0.33, 0.55, 0.025))):
        st = blob(f"nb_fstar{k}", (x, -S / 2 - 0.006, z), (r, 0.006, r), M("paint"), seg=10, ring=4,
                  fn=lambda u: V((u.x, 0, u.z)) * (-0.45 * (0.5 - 0.5 * math.cos(math.atan2(u.z, u.x) * 5))) * 0.03, col=painter((0.98, 0.9, 0.5)))
        parts.append(st)
    box_ = C.join(parts, "night_box")
    # inner star lining (faces inward), glowing faintly
    bm = bmesh.new()
    uv = bm.loops.layers.uv.verify()
    i0 = S / 2 - T - 0.002
    zb, zt = 0.06 + T + 0.002, S + 0.06 - 0.002
    quads = [((-i0, i0, zb), (i0, i0, zb), (i0, i0, zt), (-i0, i0, zt)),
             ((-i0, -i0, zb), (-i0, i0, zb), (-i0, i0, zt), (-i0, -i0, zt)),
             ((i0, i0, zb), (i0, -i0, zb), (i0, -i0, zt), (i0, i0, zt)),
             ((-i0, -i0, zt), (-i0, i0, zt), (i0, i0, zt), (i0, -i0, zt))]
    for q in quads:
        vs = [bm.verts.new(p) for p in q]
        f = bm.faces.new(vs)
        for lp, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            lp[uv].uv = t
    lining = C.new_obj("night_box_lining", bm, [M("night")])
    # the lid, hinged along the back top edge
    lid = [plank("nb_lid", (S + 0.06, S + 0.06, T), (0, 0, S + 0.06 + T / 2), (0.36, 0.28, 0.44), seed=138)]
    lid.append(blob("nb_lidknob", (0, -S / 2 + 0.06, S + 0.06 + T + 0.03), (0.05, 0.05, 0.035), M("brass"), seg=12, ring=6))
    for k, (x, y) in enumerate(((-0.25, -0.1), (0.2, 0.15), (0.3, -0.25), (-0.1, 0.25))):
        st = blob(f"nb_star{k}", (x, y, S + 0.06 + T + 0.004), (0.035, 0.035, 0.008), M("paint"), seg=10, ring=4,
                  fn=lambda u: V((u.x, u.y, 0)) * (0.6 * (0.5 + 0.5 * math.cos(math.atan2(u.y, u.x) * 5)) * 0.035), col=painter((0.98, 0.9, 0.5)))
        lid.append(st)
    lid_n = C.join(lid, "night_box_lid")
    R.set_origin(lid_n, (0, S / 2 + 0.03, S + 0.06))   # hinge: rotate about X to open
    export("night_box", [box_, lining, lid_n])


# =============================================================================== podium + leaf medals
def podium():
    parts = []
    steps = ((0.0, 0.55, 1, (0.98, 0.84, 0.5)), (-0.62, 0.38, 2, (0.86, 0.88, 0.9)), (0.62, 0.25, 3, (0.9, 0.68, 0.48)))
    for x, h, k, tint in steps:
        parts.append(plank(f"pd_block{k}", (0.6, 0.6, h), (x, 0, h / 2), tint, seed=140 + k))
        parts.append(plank(f"pd_trim{k}", (0.64, 0.64, 0.05), (x, 0, h + 0.02), (0.75, 0.55, 0.38), seed=145 + k))
        parts.append(digit_sign(f"pd_num{k}", k, (x, -0.305, h * 0.5), min(0.26, h * 0.8)))
    gar = garland("pd_gar", (-0.92, -0.31, 0.2), (0.92, -0.31, 0.2), -0.0, 9, 0.1, seed=150)[1]
    parts.append(gar)
    # medal stand behind: a little rail with three hooks
    parts += post("pd_standL", (-0.5, 0.45, 0), 1.25, 0.03)
    parts += post("pd_standR", (0.5, 0.45, 0), 1.25, 0.03)
    parts.append(tube("pd_rail", [V((-0.5, 0.45, 1.2)), V((0.5, 0.45, 1.2))], [0.022, 0.022], M("wood"), sides=8, col=painter((0.8, 0.6, 0.42))))
    stand = C.join(parts, "podium")
    medals = []
    for name, x, col in (("gold", 0.0, (1.0, 0.8, 0.25)), ("silver", -0.32, (0.86, 0.88, 0.92)), ("bronze", 0.32, (0.85, 0.52, 0.28))):
        mm = C.material(f"medal_{name}_m", color=col, rough=0.28, metal=0.9)
        rib = C.material(f"medal_{name}_ribbon", color=lin({"gold": (0.0, 0.45, 0.7), "silver": (0.0, 0.62, 0.45), "bronze": (0.84, 0.37, 0.0)}[name]), rough=0.8)
        top = V((x, 0.43, 1.2))
        ribbon = tube(f"medal_{name}_rib", [top + V((-0.05, 0, 0)), top + V((-0.03, -0.01, -0.18)), top + V((0, -0.015, -0.28))], [0.012] * 3, rib,
                      sides=4)
        ribbon2 = tube(f"medal_{name}_rib2", [top + V((0.05, 0, 0)), top + V((0.03, -0.01, -0.18)), top + V((0, -0.015, -0.28))], [0.012] * 3, rib,
                       sides=4)
        c = top + V((0, -0.02, -0.38))
        # a leaf-shaped medal: pointed oval with a raised midrib and veins
        leaf = blob(f"medal_{name}_leaf", c, (0.07, 0.014, 0.1), mm, seg=20, ring=10,
                    fn=lambda u: V((-0.03 * u.x * abs(u.z) ** 2 * 0.0 + 0.0, 0, 0.03 * (u.z ** 3)))
                    + V((u.x * -0.4 * 0.07 * max(0, abs(u.z) - 0.4), 0, 0)))
        mid = tube(f"medal_{name}_vein", [c + V((0, -0.014, -0.09)), c + V((0, -0.016, 0.0)), c + V((0, -0.014, 0.1))], [0.006, 0.006, 0.003], mm,
                   sides=5)
        veins = [tube(f"medal_{name}_v{k}{s}", [c + V((0, -0.015, z)), c + V((s * 0.045, -0.012, z + 0.03))], [0.004, 0.002], mm, sides=4)
                 for k, z in enumerate((-0.04, 0.0, 0.04)) for s in (-1, 1)]
        md = C.join([leaf, mid, ribbon, ribbon2] + veins, f"medal_{name}")
        R.set_origin(md, top)   # hangs from the rail; move it to a winner's neck from here
        medals.append(md)
    export("podium", [stand] + medals)


# =============================================================================== scoreboard
def scoreboard():
    W, H = 2.0, 1.0
    parts = []
    for s in (-1, 1):
        parts += post(f"sb_post{s}", (s * (W / 2 + 0.08), 0.03, 0), 2.6, 0.07)
    parts.append(plank("sb_back", (W + 0.1, 0.06, H + 0.1), (0, 0.04, 1.6), (0.7, 0.5, 0.34), seed=160))
    for z, h in ((1.6 - H / 2 - 0.04, 0.1), (1.6 + H / 2 + 0.04, 0.1)):
        parts.append(plank(f"sb_frame_h{z}", (W + 0.3, 0.1, h), (0, -0.01, z), (0.92, 0.78, 0.56), seed=161))
    for s in (-1, 1):
        parts.append(plank(f"sb_frame_v{s}", (0.1, 0.1, H + 0.18), (s * (W / 2 + 0.06), -0.01, 1.6), (0.92, 0.78, 0.56), seed=163 + s))
    # crest: a carved beetle-and-leaf shield on top
    crest = lathe_obj("sb_crest", [(0.0, 0.0), (0.24, 0.0), (0.25, 0.03), (0.24, 0.05), (0.0, 0.05)], M("paint"), segs=28, cap=False, rot=(math.pi / 2, 0, 0),
                      loc=(0, -0.03, 2.28))
    C.paint_vcol(crest, painter((0.0, 0.62, 0.45), lambda p, n: (0.98, 0.9, 0.55) if (V((p.x, p.z - 2.28, 0))).length < 0.17 else None))
    # a friendly ladybird on the crest: red wing cases, black spots and head
    spots = [V((sx * 0.045, 0, z)) for sx, z in ((-1, 2.3), (1, 2.3), (-1, 2.21), (1, 2.21))] + [V((0, 0, 2.17))]

    def lady(p, n):
        if p.z > 2.335:
            return (0.12, 0.1, 0.1)
        if abs(p.x) < 0.006:
            return (0.12, 0.1, 0.1)
        for sp in spots:
            if (V((p.x, 0, p.z)) - sp).length < 0.024:
                return (0.12, 0.1, 0.1)
        return None
    bug = blob("sb_crestbug", (0, -0.075, 2.26), (0.1, 0.045, 0.1), M("paint"), seg=18, ring=10, col=painter((0.86, 0.18, 0.12), lady))
    hd = blob("sb_crestbughead", (0, -0.07, 2.36), (0.05, 0.035, 0.035), M("paint"), seg=12, ring=8, col=painter((0.12, 0.1, 0.1)))
    eyes = [blob(f"sb_crestbugeye{sx}", (sx * 0.022, -0.1, 2.37), (0.012, 0.008, 0.012), M("paint"), seg=8, ring=6, col=painter((0.98, 0.97, 0.94)))
            for sx in (-1, 1)]
    parts += [crest, bug, hd] + eyes
    board = C.join(parts, "scoreboard")
    gl = C.join(garland("sb_gar", (-W / 2 - 0.15, -0.08, 2.15), (W / 2 + 0.15, -0.08, 2.15), 0.06, 10, 0.12, seed=170), "scoreboard_garland")
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((-W / 2, -0.012, 1.6 - H / 2), (W / 2, -0.012, 1.6 - H / 2), (W / 2, -0.012, 1.6 + H / 2), (-W / 2, -0.012, 1.6 + H / 2))]
    f = bm.faces.new(vs)
    uv = bm.loops.layers.uv.verify()
    for lp, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = t
    scr = C.new_obj("scoreboard_screen", bm, [M("slate")])
    export("scoreboard", [board, gl, scr])


ALL = {"grandstand": grandstand, "long_jump": long_jump, "weight_pull": weight_pull, "race_lane": race_lane, "hide_board": hide_board,
       "night_box": night_box, "podium": podium, "scoreboard": scoreboard}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for n in argv or list(ALL):
        C.reset()
        _M.clear()
        ALL[n]()
