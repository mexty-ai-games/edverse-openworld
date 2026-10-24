"""Edo-period Japan (1603-1868) garden: tea pavilion, arched wooden bridge, stone lantern.

OW_TEX=build/tex OW_OUT=build/glb blender -b --factory-startup -P make_edo.py [-- pavilion bridge lantern]
The bridge's deck top follows z = 0.05 + RISE * sin(pi * t), t = (x + L/2) / L, L = 7.0, RISE = 0.85
(the game uses the same curve so explorers walk over it).
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

BRIDGE_L = 7.0
BRIDGE_RISE = 0.85
BRIDGE_W = 1.7


def curved_roof(name, mat, hx0, hy0, hx1, hy1, z0, H, lift=0.35, n_edge=10, rings=8, sag=1.7, thick=0.14, uv_scale=0.6):
    """A Japanese hip roof: rings shrink from the eave rectangle (hx0, hy0) at z0 to the ridge
    rectangle (hx1, hy1) at z0+H; concave profile (shallow eaves, steep top) and lifted corners."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()

    def ring_pts(t):
        hx = hx0 + (hx1 - hx0) * t
        hy = hy0 + (hy1 - hy0) * t
        z = z0 + H * t ** sag
        pts = []
        corners = [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)]
        for c in range(4):
            ax, ay = corners[c]
            bx, by = corners[(c + 1) % 4]
            for k in range(n_edge):
                s = k / n_edge
                x, y = ax + (bx - ax) * s, ay + (by - ay) * s
                # corner proximity: 1 at a corner, 0 mid-edge
                cp = abs(s - 0.5) * 2
                zz = z + lift * (1 - t) ** 2 * cp ** 3
                pts.append(Vector((x, y, zz)))
        return pts

    rows = []
    for i in range(rings + 1):
        t = i / rings
        rows.append([bm.verts.new(p) for p in ring_pts(t)])
    # fascia under the eave (thickness)
    under = [bm.verts.new(v.co + Vector((0, 0, -thick))) for v in rows[0]]
    N = len(rows[0])
    for i in range(rings):
        a, b = rows[i], rows[i + 1]
        for k in range(N):
            k2 = (k + 1) % N
            f = bm.faces.new((a[k], a[k2], b[k2], b[k]))
            for loop in f.loops:
                co = loop.vert.co
                loop[uvl].uv = ((co.x + co.y) * uv_scale, (co.z - z0) * 2.2 * uv_scale + i * 0.0)
    for k in range(N):
        k2 = (k + 1) % N
        f = bm.faces.new((under[k], under[k2], rows[0][k2], rows[0][k]))
        for loop in f.loops:
            co = loop.vert.co
            loop[uvl].uv = ((co.x + co.y) * uv_scale, co.z * uv_scale)
    # soffit (underside)
    f = bm.faces.new(under[::-1])
    for loop in f.loops:
        loop[uvl].uv = (loop.vert.co.x * 0.2, loop.vert.co.y * 0.2)
    top = rows[-1]
    try:
        f = bm.faces.new(top)
    except ValueError:
        pass
    ob = C.new_obj(name, bm, [mat])
    cq.C.shade_smooth(ob)
    return ob


# =============================================================================== pavilion
def make_pavilion():
    C.reset()
    rng = random.Random(3)
    wood = C.material("pav_wood", tex="edo_wood.jpg", normal="edo_wood_n.jpg", rough=0.75, vcol=True)
    red = C.material("pav_lacquer", tex="lacquer.jpg", rough=0.45, vcol=True)
    roof = C.material("pav_kawara", tex="roof_kawara.jpg", normal="roof_kawara_n.jpg", rough=0.7, vcol=True)
    shoji = C.material("pav_shoji", tex="shoji.jpg", emissive_tex="shoji_e.jpg", emissive_strength=0.9, rough=0.9)
    stone = C.material("pav_stone", tex="granite.jpg", normal="granite_n.jpg", rough=0.9, vcol=True)
    plaster = C.material("pav_plaster", tex="plaster.jpg", rough=0.9, vcol=True)
    objs = []
    W, D = 5.0, 4.0
    FH = 0.55  # floor height
    # stone footings + base
    objs.append(C.box_obj("base", (W + 0.8, D + 0.8, 0.3), (0, 0, 0.15), stone, bevel=0.06, uv_scale=0.6, noise_amp=0.02, seed=1))
    for i in range(2):
        top = 0.16 * (i + 1) + 0.08
        objs.append(C.box_obj(f"step{i}", (1.7 - i * 0.1, 0.42, top), (0, -D / 2 - 0.62 - 0.4 * (1 - i), top / 2), stone,
                              bevel=0.04, uv_scale=0.6, noise_amp=0.01, seed=5 + i))
    # floor deck (engawa) of planks
    for k in range(14):
        y = -D / 2 - 0.3 + (k + 0.5) * (D + 0.6) / 14
        objs.append(C.box_obj(f"plank{k}", (W + 0.5, (D + 0.6) / 14 * 0.94, 0.08), (0, y, FH), wood, bevel=0.012, segments=1, uv_scale=0.5, noise_amp=0.003, seed=k))
    objs.append(C.box_obj("deck_beam", (W + 0.5, D + 0.6, 0.25), (0, 0, FH - 0.17), wood, bevel=0.02, uv_scale=0.5))
    # posts (lacquered red) and beams
    PH = 2.55
    posts = [(-W / 2, -D / 2), (0, -D / 2), (W / 2, -D / 2), (-W / 2, D / 2), (0, D / 2), (W / 2, D / 2), (-W / 2, 0), (W / 2, 0)]
    for i, (x, y) in enumerate(posts):
        objs.append(C.box_obj(f"post{i}", (0.2, 0.2, PH), (x, y, FH + PH / 2), red, bevel=0.025, uv_scale=1.0))
    for y in (-D / 2, D / 2):
        objs.append(C.box_obj(f"beam_x{y}", (W + 0.6, 0.24, 0.28), (0, y, FH + PH - 0.05), red, bevel=0.025, uv_scale=1.0))
        objs.append(C.box_obj(f"nuki_x{y}", (W + 0.3, 0.14, 0.14), (0, y, FH + PH - 0.6), wood, bevel=0.02, uv_scale=0.5))
    for x in (-W / 2, W / 2):
        objs.append(C.box_obj(f"beam_y{x}", (0.24, D + 0.6, 0.28), (x, 0, FH + PH - 0.05), red, bevel=0.025, uv_scale=1.0))
    # bracket blocks on the posts (simple kumimono)
    for i, (x, y) in enumerate(posts):
        objs.append(C.box_obj(f"bracket{i}", (0.42, 0.42, 0.18), (x, y, FH + PH + 0.17), wood, bevel=0.03, uv_scale=0.5))
    # back wall: plaster lower panel + shoji screens; side walls half shoji, front open with railing
    objs.append(C.box_obj("back_plaster", (W, 0.1, 0.7), (0, D / 2 - 0.05, FH + 0.4), plaster, bevel=0.01, uv_scale=0.5))
    for k in range(4):
        x = -W / 2 + (k + 0.5) * W / 4
        sh = cq.quad_obj(f"back_shoji{k}", shoji, W / 4 - 0.12, PH - 1.25, loc=(x, D / 2 - 0.08, FH + 0.75 + (PH - 1.25) / 2))
        objs.append(sh)
    for sx in (-1, 1):
        for k in range(2):
            y = -D / 2 + D * 0.5 + (k + 0.5) * D / 4
            sh = cq.quad_obj(f"side_shoji{sx}{k}", shoji, D / 4 - 0.12, PH - 0.4, loc=(sx * (W / 2 - 0.02), y, FH + 0.2 + (PH - 0.4) / 2), rot=(0, 0, math.pi / 2 * sx))
            objs.append(sh)
    # front railing with balusters
    for sx in (-1, 1):
        x0 = sx * W / 4 + sx * 0.4
        objs.append(C.box_obj(f"rail{sx}", (W / 2 - 1.0, 0.1, 0.08), (x0, -D / 2 - 0.25, FH + 0.62), red, bevel=0.015, uv_scale=1.0))
        for k in range(5):
            objs.append(C.box_obj(f"bal{sx}{k}", (0.06, 0.06, 0.6), (x0 - (W / 2 - 1.0) / 2 + (k + 0.5) * (W / 2 - 1.0) / 5, -D / 2 - 0.25, FH + 0.32), wood, bevel=0.0))
    # roof: curved hip roof + ridge with end ornaments
    rz = FH + PH + 0.26
    objs.append(curved_roof("roof", roof, W / 2 + 1.25, D / 2 + 1.15, W / 2 - 0.6, 0.12, rz, 1.65, lift=0.38))
    objs.append(C.box_obj("ridge", (W - 0.9, 0.34, 0.3), (0, 0, rz + 1.65 + 0.1), roof, bevel=0.06, uv_scale=0.5))
    for sx in (-1, 1):
        objs.append(cq.lathe_obj(f"onigawara{sx}", [(0.0, 0.0), (0.26, 0.0), (0.3, 0.2), (0.18, 0.5), (0.0, 0.56)], roof, segs=8,
                                 loc=(sx * (W / 2 - 0.42), 0, rz + 1.65 + 0.12)))
    # a little hanging lantern at the front
    glow = C.material("pav_lamp", tex="lamp_glow.jpg", emissive_tex="lamp_glow.jpg", emissive_strength=3.0, rough=0.5)
    objs.append(cq.lathe_obj("lamp", [(0.0, 0.0), (0.14, 0.02), (0.18, 0.18), (0.14, 0.36), (0.0, 0.38)], glow, segs=12, loc=(1.3, -D / 2 - 0.05, FH + PH - 0.85)))
    objs.append(C.box_obj("lamp_cord", (0.02, 0.02, 0.4), (1.3, -D / 2 - 0.05, FH + PH - 0.27), wood, bevel=0.0))
    def wood_ao(p, n):
        ao = 0.65 + 0.35 * min(1.0, p.z / 2.5)
        return (ao, ao * 0.98, ao * 0.95)
    for m in (wood, red, plaster):
        cq.paint(objs, m, wood_ao)
    cq.paint(objs, stone, cq.stone_vcol(moss=1.0, ao_h=0.6, seed=8))
    cq.paint(objs, roof, cq.stone_vcol(moss=0.5, ao_h=30, seed=9, base=(0.95, 0.96, 1.0)))
    r = cq.group("edo_pavilion", objs)
    C.export("cq_edo_pavilion", [r])


# =============================================================================== bridge
def deck_z(x):
    t = (x + BRIDGE_L / 2) / BRIDGE_L
    return 0.05 + BRIDGE_RISE * math.sin(math.pi * min(1.0, max(0.0, t)))


def make_bridge():
    C.reset()
    wood = C.material("bridge_wood", tex="edo_wood.jpg", normal="edo_wood_n.jpg", rough=0.8, vcol=True)
    red = C.material("bridge_lacquer", tex="lacquer.jpg", rough=0.45, vcol=True)
    bronze = C.material("bridge_bronze", tex="bronze.jpg", rough=0.35, metal=0.85)
    stone = C.material("bridge_stone", tex="granite.jpg", normal="granite_n.jpg", rough=0.9, vcol=True)
    objs = []
    L, Wd = BRIDGE_L, BRIDGE_W
    n = 26
    # deck planks across the width, each tilted to the arch slope
    for k in range(n):
        x = -L / 2 + (k + 0.5) * L / n
        dz = (deck_z(x + 0.01) - deck_z(x - 0.01)) / 0.02
        objs.append(C.box_obj(f"plank{k}", (L / n * 0.96, Wd, 0.07), (x, 0, deck_z(x) - 0.035), wood, rot=(0, -math.atan(dz), 0),
                              bevel=0.01, segments=1, uv_scale=0.5, noise_amp=0.002, seed=k))
    # two arched stringer beams under the deck
    for sy in (-1, 1):
        bm = bmesh.new()
        pts = [Vector((x, sy * (Wd / 2 - 0.15), deck_z(x) - 0.17)) for x in [-L / 2 + i * L / 16 for i in range(17)]]
        C.tube(bm, pts, [0.11] * 17, sides=6, v_scale=0.8, u_repeat=1.0)
        ob = C.new_obj(f"stringer{sy}", bm, [wood])
        C.shade_smooth(ob)
        objs.append(ob)
    # piers going down into the pond
    for x in (-1.6, 1.6):
        for sy in (-1, 1):
            objs.append(C.box_obj(f"pier{x}{sy}", (0.18, 0.18, deck_z(x) + 0.7), (x, sy * (Wd / 2 - 0.15), (deck_z(x) - 0.7) / 2 - 0.1), wood, bevel=0.02, uv_scale=0.5))
        objs.append(C.box_obj(f"pier_tie{x}", (0.12, Wd, 0.12), (x, 0, deck_z(x) - 0.42), wood, bevel=0.015, uv_scale=0.5))
    # railings: posts with bronze giboshi caps, top + mid rails following the arch
    for sy in (-1, 1):
        y = sy * (Wd / 2 - 0.05)
        posts = [-L / 2 + 0.15 + i * (L - 0.3) / 6 for i in range(7)]
        for i, x in enumerate(posts):
            h = 0.95 if i in (0, 6) else 0.8
            objs.append(C.box_obj(f"rpost{sy}{i}", (0.12, 0.12, h), (x, y, deck_z(x) + h / 2), red, bevel=0.015, uv_scale=1.0))
            objs.append(cq.lathe_obj(f"giboshi{sy}{i}", [(0.0, 0.0), (0.08, 0.0), (0.09, 0.04), (0.07, 0.07), (0.09, 0.12), (0.05, 0.2), (0.0, 0.28)],
                                     bronze, segs=10, loc=(x, y, deck_z(x) + h)))
        for zoff, r in ((0.72, 0.045), (0.36, 0.03)):
            bm = bmesh.new()
            xs = [posts[0] + i * (posts[-1] - posts[0]) / 24 for i in range(25)]
            C.tube(bm, [Vector((x, y, deck_z(x) + zoff)) for x in xs], [r] * 25, sides=6, v_scale=0.8, u_repeat=1.0)
            ob = C.new_obj(f"rail{sy}{zoff}", bm, [red])
            C.shade_smooth(ob)
            objs.append(ob)
    # stone abutments at both ends
    for sx in (-1, 1):
        objs.append(C.box_obj(f"abut{sx}", (0.7, Wd + 0.5, 0.35), (sx * (L / 2 + 0.1), 0, 0.1), stone, bevel=0.06, uv_scale=0.6, noise_amp=0.02, seed=3))

    def wao(p, n):
        ao = 0.6 + 0.4 * min(1.0, max(0.0, (p.z + 0.3) / 1.2))
        return (ao, ao * 0.98, ao * 0.95)
    cq.paint(objs, wood, wao)
    cq.paint(objs, red, wao)
    cq.paint(objs, stone, cq.stone_vcol(moss=1.0, ao_h=0.4, seed=4))
    r = cq.group("arched_bridge", objs)
    C.export("cq_arched_bridge", [r])


# =============================================================================== stone lantern
def make_lantern():
    C.reset()
    stone = C.material("lantern_granite", tex="granite.jpg", normal="granite_n.jpg", rough=0.9, vcol=True)
    glow = C.material("lantern_light", tex="shoji.jpg", emissive_tex="shoji_e.jpg", emissive_strength=2.4, rough=0.9)
    objs = []
    # hexagonal kasuga-style lantern: base, post, platform, light box, roof, jewel
    objs.append(cq.lathe_obj("kiso", [(0.0, 0.0), (0.42, 0.0), (0.42, 0.1), (0.32, 0.18), (0.24, 0.22), (0.0, 0.22)], stone, segs=6))
    objs.append(cq.lathe_obj("sao", [(0.0, 0.0), (0.12, 0.0), (0.11, 0.25), (0.13, 0.3), (0.11, 0.35), (0.1, 0.62), (0.0, 0.62)], stone, segs=12, loc=(0, 0, 0.22)))
    objs.append(cq.lathe_obj("chudai", [(0.0, 0.0), (0.16, 0.0), (0.3, 0.1), (0.34, 0.18), (0.0, 0.18)], stone, segs=6, loc=(0, 0, 0.84)))
    # light box: six stone posts with paper-lit windows between
    for k in range(6):
        a = k / 6 * math.pi * 2
        objs.append(C.box_obj(f"hibukuro_post{k}", (0.07, 0.07, 0.3), (math.cos(a) * 0.24, math.sin(a) * 0.24, 1.17), stone, rot=(0, 0, a), bevel=0.01, uv_scale=1.0))
    objs.append(cq.lathe_obj("hibukuro_light", [(0.0, 0.0), (0.21, 0.0), (0.21, 0.3), (0.0, 0.3)], glow, segs=6, loc=(0, 0, 1.02)))
    # roof: hexagonal, flaring with curled corners (warabite)
    objs.append(cq.lathe_obj("kasa", [(0.0, -0.02), (0.48, -0.02), (0.5, 0.03), (0.4, 0.08), (0.2, 0.2), (0.08, 0.26), (0.0, 0.27)], stone, segs=6, loc=(0, 0, 1.33)))
    for k in range(6):
        a = k / 6 * math.pi * 2
        objs.append(cq.lathe_obj(f"warabite{k}", [(0.0, 0.0), (0.045, 0.0), (0.05, 0.05), (0.0, 0.1)], stone, segs=6,
                                 loc=(math.cos(a) * 0.5, math.sin(a) * 0.5, 1.34)))
    objs.append(cq.lathe_obj("hoju", [(0.0, 0.0), (0.09, 0.0), (0.1, 0.04), (0.07, 0.06), (0.1, 0.12), (0.06, 0.2), (0.0, 0.25)], stone, segs=10, loc=(0, 0, 1.6)))
    for o in objs:
        for v in o.data.vertices:
            v.co += Vector((C.fbm(v.co * 6 + Vector((3, 1, 2))), C.fbm(v.co * 6 + Vector((7, 3, 1))), 0)) * 0.012
    cq.paint(objs, stone, cq.stone_vcol(moss=1.3, ao_h=1.0, seed=10, base=(0.95, 0.96, 0.95)))
    ob = cq.merge(objs, "stone_lantern")
    C.export("cq_stone_lantern", [ob])


if __name__ == "__main__":
    which = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["pavilion", "bridge", "lantern"]
    for w in which:
        {"pavilion": make_pavilion, "bridge": make_bridge, "lantern": make_lantern}[w]()
