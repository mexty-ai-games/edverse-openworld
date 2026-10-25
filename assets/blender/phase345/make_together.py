"""Phase 3 - Explorers' Museum (building + display furniture) and BioBlitz event props.

OW_TEX=<tex> OW_OUT=<glb> blender -b --factory-startup -P make_together.py [-- names...]
names: museum frame case plinth sticker_board banner totem badges
Swappable surfaces are their own named meshes with 0-1 UVs:
  frame: "photo_card" (the photo card face) - banner: "banner_cloth".
Empties: museum "spot_00".."spot_11" (display spots on the floor, facing in), "entrance";
case/plinth "item_slot" (where a crafted object sits); sticker_board "sticker_area" (centre of the cork,
1.1 x 0.62 m usable, facing -Y). Totem: "totem_fill" (emissive column, origin at its bottom; scale its
local Y in three.js 0..1 for progress) and "totem_crown" (glows when the goal is reached).
Badges: kit nodes badge_leaf (green, circle), badge_drop (sky blue, hexagon), badge_sun (orange, shield),
badge_flower (purple-pink, scalloped) - Okabe-Ito colours plus a distinct shape and icon each.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import p345 as P  # noqa: E402
from p345 import C, PI, UP, V, VB, lerp, mulc  # noqa: E402


def empty(name, loc, parent=None, rot=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.empty_display_size = 0.2
    if parent is not None:
        e.parent = parent
        e.location = V(loc) - parent.location
    else:
        e.location = loc
    e.rotation_euler = rot
    return e


def mats():
    M = {}
    M["wood"] = P.mat("ow_timber", tex="p_timber.jpg", normal="p_timber_n.jpg", rough=0.7)
    M["planks"] = P.mat("ow_planks", tex="planks.jpg", normal="planks_n.jpg", rough=0.8)
    M["stone"] = P.mat("ow_stone", tex="mossrock.jpg", normal="mossrock_n.jpg", rough=0.9)
    M["roof"] = P.mat("ow_shingle", tex="planks.jpg", normal="planks_n.jpg", tint=(0.62, 0.42, 0.32), rough=0.85)
    M["glass"] = P.glass("ow_glass", color=(0.62, 0.82, 0.84), alpha=0.16)
    M["brass"] = P.mat("ow_brass", tex="brass.jpg", rough=0.35, metal=0.85)
    M["cloth"] = P.mat("ow_velvet", tex="cloth.jpg", tint=(0.2, 0.42, 0.42), rough=0.95)
    M["lamp"] = P.glow("ow_lamp_glow", (1.0, 0.78, 0.45), 3.0)
    M["soft"] = P.mat("ow_soft", rough=0.6, double=True)
    return M


def woodcol(o, base=(0.95, 0.85, 0.72), ao=None):
    P.paint(o, P.wood_fn(base, seed=hash(o.name) % 97), ao=ao)
    return o


def box(name, size, loc, m, rot=(0, 0, 0), bevel=0.02, uv=1.0, base=(0.95, 0.85, 0.72), ao=None, noise=0.0, segs=1):
    o = C.box_obj(name, size, loc, m, rot=rot, bevel=bevel, segments=segs, uv_scale=uv, noise_amp=noise, seed=len(name))
    return woodcol(o, base, ao)


def quad(name, m, w, h, loc, rot=(0, 0, 0), uv=(0, 0, 1, 1)):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    vs = [bm.verts.new(v) for v in ((-w / 2, 0, -h / 2), (w / 2, 0, -h / 2), (w / 2, 0, h / 2), (-w / 2, 0, h / 2))]
    f = bm.faces.new(vs)
    u0, v0, u1, v1 = uv
    for loop, t in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
        loop[uvl].uv = t
    ob = C.new_obj(name, bm, [m])
    ob.location = loc
    ob.rotation_euler = rot
    P.paint(ob, None, light=0)
    return ob


def lantern(M, loc, objs):
    x, y, z = loc
    vb = VB()
    vb.lathe([(0.0, -0.02), (0.07, -0.02), (0.09, 0.0), (0.09, 0.02), (0.0, 0.02)], (0.3, 0.26, 0.22), segs=12, loc=(x, y, z))
    vb.lathe([(0.0, 0.26), (0.11, 0.26), (0.06, 0.34), (0.0, 0.36)], (0.3, 0.26, 0.22), segs=12, loc=(x, y, z))
    for k in range(4):
        a = k * PI / 2 + PI / 4
        vb.tube([V((x + math.cos(a) * 0.075, y + math.sin(a) * 0.075, z)), V((x + math.cos(a) * 0.075, y + math.sin(a) * 0.075, z + 0.27))],
                0.008, (0.3, 0.26, 0.22), sides=4)
    objs.append(vb.obj("lantern_frame", [M["brass"]]))
    g = VB()
    g.lathe([(0.0, 0.02), (0.06, 0.03), (0.07, 0.14), (0.05, 0.25), (0.0, 0.26)], (1, 1, 1), segs=10, loc=(x, y, z))
    objs.append(g.obj("lantern_glow", [M["lamp"]], light=0))


# =============================================================================== museum building
def make_museum():
    C.reset()
    M = mats()
    rng = random.Random(7)
    objs = []
    W, D, FH, WH = 12.0, 8.0, 0.4, 3.6   # width, depth, floor height, wall height (front faces -Y)
    y0, y1 = -D / 2, D / 2
    # foundation: rough stone plinth, timber floor
    objs.append(box("plinth", (W + 0.5, D + 0.5, FH), (0, 0, FH / 2), M["stone"], bevel=0.06, uv=0.5, base=(0.92, 0.9, 0.86), noise=0.02))
    objs.append(box("floor", (W - 0.1, D - 0.1, 0.06), (0, 0, FH + 0.01), M["planks"], bevel=0.0, uv=0.35, base=(0.98, 0.9, 0.78)))
    # wide front steps (centre) + a gentle ramp (left) - everyone gets in
    for k in range(2):
        h = FH * (k + 1) / 3
        objs.append(box(f"step{k}", (4.2, 0.36 + (1 - k) * 0.36, h), (0, y0 - 0.25 - 0.18 - (1 - k) * 0.18, h / 2), M["stone"], bevel=0.04, uv=0.5,
                        base=(0.92, 0.9, 0.86)))
    rl = 3.0
    ang = math.atan2(FH, rl)
    objs.append(box("ramp", (1.4, rl / math.cos(ang), 0.12), (-4.6, y0 - rl / 2 - 0.2, FH / 2 - 0.02), M["stone"], rot=(-ang, 0, 0),
                    bevel=0.03, uv=0.5, base=(0.92, 0.9, 0.86)))
    for sx in (-1, 1):  # ramp handrail
        x = -4.6 + sx * 0.66
        objs.append(P_rail(M, V((x, y0 - rl - 0.15, 0.05)), V((x, y0 - 0.2, FH + 0.05)), 0.9))
    # timber frame: posts on a 2 m grid along sides/back, big portal at the front
    posts = []
    for i in range(7):
        x = -W / 2 + i * W / 6
        posts += [(x, y1)]
        if i in (0, 6):
            for j in range(1, 4):
                posts.append((x, y0 + j * D / 4))
        posts.append((x, y0))
    for (x, y) in posts:
        objs.append(box(f"post{x:.1f}_{y:.1f}", (0.24, 0.24, WH), (x, y, FH + WH / 2), M["wood"], bevel=0.03, uv=0.8, ao=(FH, FH + 1.5)))
        objs.append(box(f"base{x:.1f}_{y:.1f}", (0.34, 0.34, 0.16), (x, y, FH + 0.08), M["stone"], bevel=0.03, uv=0.8, base=(0.9, 0.88, 0.84)))
    # ring beam + corner braces
    for y in (y0, y1):
        objs.append(box(f"beam_y{y}", (W + 0.4, 0.3, 0.32), (0, y, FH + WH + 0.16), M["wood"], bevel=0.03, uv=0.8))
    for x in (-W / 2, W / 2):
        objs.append(box(f"beam_x{x}", (0.3, D + 0.1, 0.32), (x, 0, FH + WH + 0.16), M["wood"], bevel=0.03, uv=0.8))
    # glass walls with mullions on the sides and the front (open doorway in the middle third)
    def glazing(xa, ya, xb, yb, name):
        L = math.hypot(xb - xa, yb - ya)
        rot = (0, 0, math.atan2(yb - ya, xb - xa))
        cx, cy = (xa + xb) / 2, (ya + yb) / 2
        g = C.box_obj(name, (L - 0.24, 0.03, WH - 0.5), (cx, cy, FH + 0.25 + (WH - 0.5) / 2), M["glass"], rot=rot, bevel=0.0)
        P.paint(g, None, light=0)
        objs.append(g)
        objs.append(box(name + "_sill", (L - 0.2, 0.18, 0.25), (cx, cy, FH + 0.125), M["wood"], rot=rot, bevel=0.02, uv=0.8))
        objs.append(box(name + "_mid", (L - 0.2, 0.08, 0.08), (cx, cy, FH + 2.2), M["wood"], rot=rot, bevel=0.015, uv=0.8))
        objs.append(box(name + "_mull", (0.07, 0.07, WH - 0.5), (cx, cy, FH + 0.25 + (WH - 0.5) / 2), M["wood"], rot=rot, bevel=0.01, uv=0.8))
    for j in range(4):
        for x in (-W / 2, W / 2):
            glazing(x, y0 + j * D / 4, x, y0 + (j + 1) * D / 4, f"side{x}_{j}")
    for i in (0, 1, 4, 5):
        glazing(-W / 2 + i * W / 6, y0, -W / 2 + (i + 1) * W / 6, y0, f"front{i}")
    # back wall: warm timber boards (for hanging frames), with a high window band
    objs.append(box("backwall", (W - 0.2, 0.14, WH - 0.9), (0, y1 - 0.02, FH + (WH - 0.9) / 2), M["planks"], bevel=0.01, uv=0.4,
                    base=(0.98, 0.88, 0.74), ao=(FH, FH + 2)))
    for i in range(6):
        g = C.box_obj(f"clerestory{i}", (W / 6 - 0.3, 0.03, 0.75), (-W / 2 + (i + 0.5) * W / 6, y1, FH + WH - 0.45), M["glass"], bevel=0.0)
        P.paint(g, None, light=0)
        objs.append(g)
    # front portal: thick lintel with the museum crest (icon only), lanterns either side
    objs.append(box("portal_lintel", (W / 3 + 0.8, 0.44, 0.5), (0, y0 - 0.06, FH + WH - 0.1), M["wood"], bevel=0.05, uv=0.8))
    crest = P.mat("ow_crest", tex="p_crest.jpg", rough=0.7)
    objs.append(quad("crest", crest, 2.2, 1.1, (0, y0 - 0.32, FH + WH + 0.75)))
    objs.append(box("crest_board", (2.5, 0.12, 1.35), (0, y0 - 0.24, FH + WH + 0.75), M["wood"], bevel=0.04, uv=0.8))
    for sx in (-1, 1):
        objs.append(box(f"portal_post{sx}", (0.36, 0.36, WH + 0.1), (sx * (W / 6), y0 - 0.06, FH + (WH + 0.1) / 2), M["wood"], bevel=0.05, uv=0.8))
        for k in range(2):  # carved bands
            objs.append(box(f"band{sx}{k}", (0.42, 0.42, 0.08), (sx * (W / 6), y0 - 0.06, FH + 0.9 + k * 1.6), M["brass"], bevel=0.02, uv=1.0,
                            base=(1, 1, 1)))
        lantern(M, (sx * (W / 6 + 0.5), y0 - 0.32, FH + 2.2), objs)
        objs.append(box(f"lantern_arm{sx}", (0.5, 0.06, 0.06), (sx * (W / 6 + 0.32), y0 - 0.2, FH + 2.62), M["wood"], bevel=0.01))
    # roof: gable along X with a deep overhang, visible rafter tails, a ridge skylight
    RH = 2.1
    over = 0.9
    top = FH + WH + 0.32
    half = D / 2 + over
    L = math.hypot(half, RH)
    a = math.atan2(RH, half)
    for sy in (-1, 1):
        objs.append(box(f"roof{sy}", (W + 1.6, L, 0.16), (0, sy * half / 2, top + RH / 2), M["roof"], rot=(-sy * a, 0, 0), bevel=0.04, uv=0.6,
                        base=(0.9, 0.8, 0.72)))
        for k in range(12):  # shingle courses: little steps catch the light
            t = (k + 0.5) / 12
            objs.append(box(f"course{sy}{k}", (W + 1.6, 0.06, 0.05), (0, sy * half * (1 - t), top + RH * t + 0.1), M["roof"], rot=(-sy * a, 0, 0),
                            bevel=0.015, uv=0.6, base=(0.78, 0.66, 0.58)))
        for i in range(9):
            x = -W / 2 - 0.2 + i * (W + 0.4) / 8
            objs.append(box(f"rafter{sy}{i}", (0.14, 0.9, 0.18), (x, sy * (D / 2 + 0.35), top - 0.02), M["wood"], rot=(-sy * a, 0, 0), bevel=0.02,
                            uv=0.8))
    objs.append(box("ridge", (W + 1.8, 0.34, 0.26), (0, 0, top + RH + 0.08), M["wood"], bevel=0.05, uv=0.8))
    # gable ends: timber boards in a triangle
    for x in (-W / 2 - 0.05, W / 2 + 0.05):
        vb = VB()
        for k in range(8):
            z0 = top + k * RH / 8
            hw = half * (1 - k / 8) - 0.6
            if hw > 0.1:
                vb.box((0.08, hw * 2, RH / 8 - 0.02), (x, 0, z0 + RH / 16), (0.95, 0.84, 0.7))
        objs.append(vb.obj(f"gable{x}", [M["planks"]]))
        C.box_uv(objs[-1], 0.5)
    # flower boxes under the front glazing (warm, alive)
    leaves = P.mat("ow_box_plants", rough=0.65, double=True)
    for i in (0, 1, 4, 5):
        x = -W / 2 + (i + 0.5) * W / 6
        objs.append(box(f"flowerbox{i}", (1.6, 0.36, 0.3), (x, y0 - 0.32, FH + 0.15), M["planks"], bevel=0.02, uv=0.8))
        vb = VB()
        for k in range(14):
            px = x - 0.7 + k * 0.1 + rng.uniform(-0.03, 0.03)
            c = V((px, y0 - 0.32 + rng.uniform(-0.08, 0.08), FH + 0.32))
            vb.blob(c, (0.09, 0.09, 0.08), (0.3, 0.52, 0.22), seg=7, ring=5, noise=0.04, nscale=8)
            if k % 2 == 0:
                col = rng.choice([(0.95, 0.75, 0.2), (0.9, 0.5, 0.7), (0.7, 0.6, 0.95), (1.0, 0.95, 0.9)])
                vb.blob(c + V((0, -0.04, 0.07)), (0.035, 0.035, 0.03), col, seg=6, ring=4)
        objs.append(vb.obj(f"flowers{i}", [leaves]))
    root = P.join(objs, "museum_building")
    # display spots: 5 along the back wall, 3 each side, 1 centre-ish island pair
    k = 0
    for x in (-4.4, -2.2, 0, 2.2, 4.4):
        empty(f"spot_{k:02d}", (x, y1 - 0.7, FH + 0.04), root, rot=(0, 0, PI)); k += 1
    for sx in (-1, 1):
        for y in (-1.6, 0.4, 2.0):
            empty(f"spot_{k:02d}", (sx * (W / 2 - 0.8), y, FH + 0.04), root, rot=(0, 0, -sx * PI / 2)); k += 1
    for x in (-1.3, 1.3):
        empty(f"spot_{k:02d}", (x, -0.2, FH + 0.04), root); k += 1
    empty("entrance", (0, y0 - 1.0, 0.0), root)
    P.export("p3_museum_building", [root])


def P_rail(M, a, b, h):
    vb = VB()
    for t in (0.0, 0.5, 1.0):
        p = a.lerp(b, t)
        vb.tube([p, p + V((0, 0, h))], 0.03, (0.9, 0.8, 0.66), sides=6)
    vb.tube([a + V((0, 0, h)), b + V((0, 0, h))], 0.035, (0.9, 0.8, 0.66), sides=8)
    o = vb.obj("rail", [M["wood"]])
    C.box_uv(o, 1.0)
    return o


# =============================================================================== frame on a stand
def make_frame():
    C.reset()
    M = mats()
    objs = []
    # easel: two front legs + a back leg, a ledge, the frame resting on it
    for sx in (-1, 1):
        objs.append(box(f"leg{sx}", (0.05, 0.05, 1.75), (sx * 0.32, 0.0, 0.86), M["wood"], rot=(0.12, sx * 0.1, 0), bevel=0.012))
    objs.append(box("leg_back", (0.05, 0.05, 1.7), (0, 0.36, 0.8), M["wood"], rot=(-0.32, 0, 0), bevel=0.012))
    objs.append(box("ledge", (0.86, 0.12, 0.05), (0, -0.07, 0.62), M["wood"], rot=(0.12, 0, 0), bevel=0.012))
    objs.append(box("lip", (0.86, 0.02, 0.05), (0, -0.13, 0.66), M["wood"], rot=(0.12, 0, 0), bevel=0.006))
    objs.append(box("crossbar", (0.6, 0.04, 0.04), (0, 0.03, 1.55), M["wood"], rot=(0.12, 0, 0), bevel=0.01))
    # frame: moulded border (4 bevelled bars, warm honey wood), a brass corner on each
    fw, fh, fz = 0.66, 0.86, 1.08
    rot = (0.12, 0, 0)
    R = Matrix.Rotation(0.12, 3, "X")
    c0 = V((0, -0.09, fz))
    for k, (sx, sz, dx, dz) in enumerate(((fw + 0.1, 0.1, 0, fh / 2), (fw + 0.1, 0.1, 0, -fh / 2), (0.1, fh, fw / 2, 0), (0.1, fh, -fw / 2, 0))):
        objs.append(box(f"frame{k}", (sx, 0.06, sz), c0 + R @ V((dx, 0, dz)), M["wood"], rot=rot, bevel=0.025, base=(1.0, 0.82, 0.58)))
    for sx in (-1, 1):
        for sz in (-1, 1):
            vb = VB()
            vb.blob(c0 + R @ V((sx * fw / 2, -0.035, sz * fh / 2)), (0.03, 0.012, 0.03), (1, 1, 1), seg=8, ring=5)
            objs.append(vb.obj(f"corner{sx}{sz}", [M["brass"]]))
    objs.append(box("backing", (fw - 0.02, 0.02, fh - 0.02), c0 + R @ V((0, 0.015, 0)), M["planks"], rot=rot, bevel=0.0, base=(0.9, 0.85, 0.78)))
    body = P.join(objs, "frame_body")
    card_m = C.material("photo_card", color=(0.97, 0.94, 0.86), rough=0.6)
    card = quad("photo_card", card_m, fw - 0.06, fh - 0.06, c0 + R @ V((0, -0.008, 0)), rot=(0.12, 0, 0))
    root = empty("museum_frame", (0, 0, 0))
    body.parent = root
    card.parent = root
    P.export("p3_museum_frame", [root])


# =============================================================================== display case
def make_case():
    C.reset()
    M = mats()
    objs = []
    objs.append(box("cab", (0.9, 0.6, 0.86), (0, 0, 0.45), M["wood"], bevel=0.03, base=(0.86, 0.66, 0.48), ao=(0, 0.6)))
    objs.append(box("plinthb", (0.98, 0.68, 0.08), (0, 0, 0.04), M["wood"], bevel=0.02, base=(0.7, 0.52, 0.38)))
    objs.append(box("cap", (0.96, 0.66, 0.06), (0, 0, 0.9), M["wood"], bevel=0.02, base=(0.9, 0.7, 0.5)))
    for sx in (-1, 1):  # panelled front doors
        objs.append(box(f"panel{sx}", (0.36, 0.03, 0.6), (sx * 0.2, -0.305, 0.46), M["wood"], bevel=0.02, base=(0.95, 0.76, 0.56)))
        vb = VB()
        vb.blob((sx * 0.05, -0.33, 0.5), (0.018, 0.018, 0.018), (1, 1, 1), seg=8, ring=5)
        objs.append(vb.obj(f"knob{sx}", [M["brass"]]))
    objs.append(box("velvet", (0.82, 0.52, 0.04), (0, 0, 0.95), M["cloth"], bevel=0.015, base=(1, 1, 1)))
    g = C.box_obj("glass_box", (0.86, 0.56, 0.52), (0, 0, 1.19), M["glass"], bevel=0.0)
    P.paint(g, None, light=0)
    objs.append(g)
    for sx in (-1, 1):  # brass edges
        for sy in (-1, 1):
            objs.append(box(f"edge{sx}{sy}", (0.025, 0.025, 0.52), (sx * 0.43, sy * 0.28, 1.19), M["brass"], bevel=0.006, base=(1, 1, 1)))
    for sy in (-1, 1):
        objs.append(box(f"topedge_x{sy}", (0.88, 0.025, 0.025), (0, sy * 0.28, 1.45), M["brass"], bevel=0.006, base=(1, 1, 1)))
    for sx in (-1, 1):
        objs.append(box(f"topedge_y{sx}", (0.025, 0.58, 0.025), (sx * 0.43, 0, 1.45), M["brass"], bevel=0.006, base=(1, 1, 1)))
    root = P.join(objs, "display_case")
    empty("item_slot", (0, 0, 0.97), root)
    P.export("p3_display_case", [root])


# =============================================================================== plinth
def make_plinth():
    C.reset()
    M = mats()
    objs = []
    stone = P.mat("plinth_stone", tex="travertine.jpg", normal="travertine_n.jpg", rough=0.8)
    for k, (w, h, z) in enumerate(((0.7, 0.12, 0.06), (0.6, 0.08, 0.16), (0.5, 0.66, 0.53), (0.6, 0.06, 0.89), (0.66, 0.06, 0.95))):
        objs.append(box(f"tier{k}", (w, w, h), (0, 0, z), stone, bevel=0.02, uv=1.0, base=(1.0, 0.95, 0.88), ao=(0, 0.6)))
    for sx in (-1, 1):  # carved fluting suggestion: shallow pilasters
        for sy in (-1, 1):
            objs.append(box(f"pil{sx}{sy}", (0.06, 0.06, 0.6), (sx * 0.24, sy * 0.24, 0.53), stone, bevel=0.02, uv=1.0, base=(0.95, 0.9, 0.84)))
    objs.append(box("plate", (0.22, 0.012, 0.09), (0, -0.256, 0.72), M["brass"], bevel=0.004, base=(1, 1, 1)))
    vb = VB()
    pts = []
    for k in range(10):  # star on the plate (no text)
        a = PI / 2 + k * PI / 5
        r = 0.032 if k % 2 == 0 else 0.014
        pts.append(V((math.cos(a) * r, -0.264, 0.72 + math.sin(a) * r)))
    c = vb.v(V((0, -0.266, 0.72)), (0.55, 0.35, 0.15))
    ring = [vb.v(p, (0.55, 0.35, 0.15)) for p in pts]
    for k in range(10):
        vb.f((c, ring[(k + 1) % 10], ring[k]))
    objs.append(vb.obj("plate_star", [M["soft"]], light=0))
    objs.append(box("cushion", (0.44, 0.44, 0.05), (0, 0, 1.0), M["cloth"], bevel=0.02, base=(1, 1, 1)))
    root = P.join(objs, "plinth")
    empty("item_slot", (0, 0, 1.025), root)
    P.export("p3_plinth", [root])


# =============================================================================== sticker board
def make_sticker_board():
    C.reset()
    M = mats()
    objs = []
    cork = P.mat("sb_cork", tex="p_cork.jpg", rough=0.95)
    stk = C.material("sb_stickers", tex="p_stickers.png", rough=0.5, alpha_tex=True, double=False)
    W, H, z0 = 1.3, 0.9, 0.75
    for sx in (-1, 1):
        objs.append(box(f"leg{sx}", (0.08, 0.08, 1.75), (sx * (W / 2 + 0.06), 0, 0.875), M["wood"], bevel=0.02, base=(1.0, 0.84, 0.62)))
        objs.append(box(f"foot{sx}", (0.12, 0.5, 0.08), (sx * (W / 2 + 0.06), 0, 0.04), M["wood"], bevel=0.02, base=(0.92, 0.76, 0.56)))
        vb = VB()
        vb.lathe([(0.0, 0.0), (0.05, 0.0), (0.06, 0.04), (0.035, 0.08), (0.0, 0.1)], (1, 1, 1), segs=10, loc=(sx * (W / 2 + 0.06), 0, 1.75))
        objs.append(vb.obj(f"finial{sx}", [M["brass"]]))
    cb = C.box_obj("cork", (W, 0.04, H), (0, 0, z0 + H / 2), cork, bevel=0.005)
    C.box_uv(cb, 1.4)
    P.paint(cb, None, light=0.1)
    objs.append(cb)
    for k, (sx, sz, dx, dz) in enumerate(((W + 0.12, 0.07, 0, H / 2), (W + 0.12, 0.07, 0, -H / 2), (0.07, H, W / 2, 0), (0.07, H, -W / 2, 0))):
        objs.append(box(f"fr{k}", (sx, 0.07, sz), (dx, 0, z0 + H / 2 + dz), M["wood"], bevel=0.02, base=(1.0, 0.84, 0.62)))
    # header: the six preset stickers painted on a little shelf board, so everyone sees what they can leave
    objs.append(box("header", (W + 0.1, 0.06, 0.2), (0, -0.01, z0 + H + 0.14), M["planks"], bevel=0.02, base=(0.98, 0.92, 0.8)))
    for i in range(6):
        u0, v0 = (i % 3) / 3, 1 - (i // 3 + 1) / 2
        objs.append(quad(f"stk{i}", stk, 0.16, 0.16, (-W / 2 + 0.13 + i * (W - 0.26) / 5, -0.045, z0 + H + 0.14), uv=(u0, v0, u0 + 1 / 3, v0 + 0.5)))
    # a little tray of brass pins
    objs.append(box("tray", (0.5, 0.12, 0.04), (0, -0.07, z0 - 0.04), M["wood"], bevel=0.01, base=(0.95, 0.8, 0.6)))
    rng = random.Random(3)
    vb = VB()
    for k in range(9):
        vb.blob((rng.uniform(-0.2, 0.2), -0.07 + rng.uniform(-0.03, 0.03), z0 - 0.01), (0.012, 0.012, 0.01), (1, 1, 1), seg=6, ring=4)
    objs.append(vb.obj("pins", [M["brass"]]))
    root = P.join(objs, "sticker_board")
    empty("sticker_area", (0, -0.025, z0 + H / 2), root)
    P.export("p3_sticker_board", [root])


# =============================================================================== BioBlitz banner
def make_banner():
    C.reset()
    M = mats()
    objs = []
    cloth = C.material("banner_cloth", tex="p_banner.jpg", rough=0.9, double=True)
    stone = P.mat("bn_stone", tex="mossrock.jpg", normal="mossrock_n.jpg", rough=0.9)
    PW, PH = 3.0, 3.0
    for sx in (-1, 1):
        x = sx * PW / 2
        vb = VB()
        vb.tube([V((x, 0, 0.2)), V((x, 0, PH))], [0.07, 0.055], (0.95, 0.82, 0.62), sides=10)
        objs.append(vb.obj(f"pole{sx}", [M["wood"]]))
        C.box_uv(objs[-1], 1.0)
        vb = VB()
        vb.lathe([(0.0, 0.0), (0.08, 0.0), (0.1, 0.06), (0.06, 0.12), (0.09, 0.2), (0.0, 0.3)], (1, 1, 1), segs=12, loc=(x, 0, PH))
        objs.append(vb.obj(f"finial{sx}", [M["brass"]]))
        objs.append(box(f"weight{sx}", (0.5, 0.5, 0.3), (x, 0, 0.15), stone, bevel=0.06, base=(0.92, 0.9, 0.86), noise=0.02))
        # pennant flag
        vb = VB()
        a, b, c = V((x, 0, PH + 0.32)), V((x, 0, PH + 0.08)), V((x + sx * 0.45, 0.02, PH + 0.2))
        vb.f((vb.v(a, (0.98, 0.78, 0.3)), vb.v(b, (0.98, 0.78, 0.3)), vb.v(c, (0.95, 0.6, 0.2))))
        objs.append(vb.obj(f"pennant{sx}", [M["soft"]], light=0.1))
    objs.append(box("bar", (PW + 0.2, 0.08, 0.08), (0, 0, PH - 0.1), M["wood"], bevel=0.02, base=(0.95, 0.82, 0.62)))
    # rope loops
    vb = VB()
    for k in range(7):
        x = -PW / 2 + 0.25 + k * (PW - 0.5) / 6
        vb.tube([V((x, -0.05, PH - 0.05)), V((x, -0.06, PH - 0.16)), V((x, 0.0, PH - 0.22))], 0.012, (0.85, 0.75, 0.55), sides=5)
    objs.append(vb.obj("ropes", [M["soft"]]))
    body = P.join(objs, "banner_frame")
    # cloth: a gently waving sheet, 0-1 UVs (swap the texture for each event)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    nx, nz = 16, 8
    BW, BH = PW - 0.4, 1.4
    grid = []
    for i in range(nx + 1):
        row = []
        for j in range(nz + 1):
            u, v = i / nx, j / nz
            x = -BW / 2 + BW * u
            z = PH - 0.2 - BH * (1 - v)
            y = 0.04 * math.sin(u * PI * 3) * (1 - v * 0.6) - 0.02
            z -= 0.04 * math.sin(u * PI) * (1 - v)
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for i in range(nx):
        for j in range(nz):
            f = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
            for loop, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                loop[uvl].uv = (a / nx, b / nz)
    co = C.new_obj("banner_cloth", bm, [cloth])
    C.shade_smooth(co)
    P.paint(co, None, light=0.08)
    root = empty("bioblitz_banner", (0, 0, 0))
    body.parent = root
    co.parent = root
    P.export("p3_bioblitz_banner", [root])


# =============================================================================== progress totem
def make_totem():
    C.reset()
    M = mats()
    objs = []
    stone = P.mat("tt_stone", tex="mossrock.jpg", normal="mossrock_n.jpg", rough=0.9)
    objs.append(box("base", (0.9, 0.9, 0.3), (0, 0, 0.15), stone, bevel=0.06, base=(0.92, 0.9, 0.86), noise=0.02))
    objs.append(box("base2", (0.7, 0.7, 0.14), (0, 0, 0.37), M["wood"], bevel=0.03, base=(0.9, 0.72, 0.52)))
    H0, H1 = 0.44, 2.14
    for sx in (-1, 1):  # four carved posts around a glass tube
        for sy in (-1, 1):
            vb = VB()
            pts = [V((sx * 0.24, sy * 0.24, H0 + (H1 - H0) * t)) for t in (0, 0.25, 0.5, 0.75, 1.0)]
            vb.tube(pts, [0.06, 0.05, 0.055, 0.05, 0.06], (0.95, 0.8, 0.6), sides=8, flare=lambda i, a: 0.008 * math.cos(i * 3.1))
            objs.append(vb.obj(f"post{sx}{sy}", [M["wood"]]))
            C.box_uv(objs[-1], 1.0)
    # leaf-carved rings marking quarters (25 / 50 / 75 %)
    for k in range(1, 4):
        z = H0 + (H1 - H0) * k / 4
        vb = VB()
        vb.lathe([(0.2, z - 0.03), (0.32, z - 0.02), (0.33, z + 0.02), (0.2, z + 0.03)], (1, 1, 1), segs=20, cap=False)
        objs.append(vb.obj(f"ring{k}", [M["brass"]]))
    g = VB()
    g.lathe([(0.17, H0), (0.17, H1), (0.0, H1 + 0.001)], (1, 1, 1), segs=20, cap=True)
    gt = g.obj("tube_glass", [M["glass"]], light=0)
    objs.append(gt)
    objs.append(box("cap", (0.66, 0.66, 0.1), (0, 0, H1 + 0.05), M["wood"], bevel=0.03, base=(0.9, 0.72, 0.52)))
    body = P.join(objs, "totem_body")
    # the fill: emissive column, origin at its bottom (scale local Y in glTF for progress)
    fill_m = P.glow("totem_fill_glow", (0.55, 1.0, 0.55), 2.6)
    f = VB()
    f.lathe([(0.0, 0.0), (0.15, 0.0), (0.15, H1 - H0 - 0.02), (0.0, H1 - H0)], (1, 1, 1), segs=18)
    fill = f.obj("totem_fill", [fill_m], light=0)
    fill.location = (0, 0, H0 + 0.005)
    # the crown: a leaf-star that glows when the room reaches its goal
    crown_m = P.glow("totem_crown_glow", (1.0, 0.82, 0.35), 2.0)
    cv = VB()
    for k in range(6):
        a = k / 6 * 2 * PI
        d = V((math.cos(a) * 0.9, math.sin(a) * 0.9, 1.0)).normalized()
        P.leaf(cv, V((0, 0, 0.02)), d, UP, 0.34, 0.14, (1, 0.95, 0.8), (1, 1, 1), shape="ovate", segs=4, cols=1, fold=0.3, droop=0.15)
    cv.blob((0, 0, 0.08), (0.09, 0.09, 0.09), (1, 1, 1), seg=12, ring=8)
    crown = cv.obj("totem_crown", [crown_m], light=0)
    crown.location = (0, 0, H1 + 0.1)
    root = empty("progress_totem", (0, 0, 0))
    for o in (body, fill, crown):
        o.parent = root
    P.export("p3_progress_totem", [root])


# =============================================================================== team badges
TEAMS = [("leaf", "circle"), ("drop", "hexagon"), ("sun", "shield"), ("flower", "scallop")]
TEAM_COL = {"leaf": (0.0, 0.62, 0.45), "drop": (0.34, 0.7, 0.91), "sun": (0.9, 0.62, 0.0), "flower": (0.8, 0.47, 0.65)}


def outline(shape, R=0.05, n=40):
    pts = []
    for k in range(n):
        a = k / n * 2 * PI
        if shape == "circle":
            r = R
        elif shape == "hexagon":
            seg = PI / 3
            r = R * math.cos(seg / 2) / math.cos((a % seg) - seg / 2)
        elif shape == "scallop":
            r = R * (0.9 + 0.1 * abs(math.cos(a * 4)))
        else:
            r = R
        p = (math.cos(a) * r, math.sin(a) * r)
        if shape == "shield":
            x, z = math.cos(a) * R, math.sin(a) * R
            if z < 0:
                z = z * (1.35 - 0.35 * abs(x) / R)
                x = x * (1 - 0.35 * (-z / (R * 1.35)))
            else:
                z = min(z, R * 0.8)
            p = (x, z)
        pts.append(p)
    return pts


def badge(name, shape, cell, m_face, m_rim):
    vb = VB()
    col = TEAM_COL[name]
    ol = outline(shape)
    T = 0.012
    u0, v0 = (cell % 2) * 0.5, 1 - (cell // 2 + 1) * 0.5

    def uvof(x, z):
        return (u0 + 0.25 + x / 0.105 * 0.5, v0 + 0.25 + z / 0.105 * 0.5)
    # rim: outer band and back (coloured metal)
    outer = [vb.v(V((x * 1.08, 0.0, z * 1.08)), col) for x, z in ol]
    outer_f = [vb.v(V((x * 1.08, -T, z * 1.08)), mulc(col, 1.15)) for x, z in ol]
    inner = [vb.v(V((x * 0.96, -T - 0.003, z * 0.96)), (1, 1, 1)) for x, z in ol]
    n = len(ol)
    for k in range(n):
        k2 = (k + 1) % n
        vb.f((outer[k], outer[k2], outer_f[k2], outer_f[k]))
    cb = vb.v(V((0, 0.0, 0)), col)
    for k in range(n):
        vb.f((cb, outer[(k + 1) % n], outer[k]))
    vb.mi = 1
    cf = vb.v(V((0, -T - 0.004, 0)), (1, 1, 1))
    for k in range(n):
        k2 = (k + 1) % n
        vb.f((outer_f[k], outer_f[k2], inner[k2], inner[k]), [uvof(*ol[k]), uvof(*ol[k2]), uvof(*ol[k2]), uvof(*ol[k])])
        vb.f((cf, inner[k], inner[k2]), [uvof(0, 0), uvof(*ol[k]), uvof(*ol[k2])])
    vb.mi = 0
    # pin + ribbon tails
    vb.tube([V((0, 0.0, 0.0)), V((0, 0.012, 0.0))], 0.006, (0.8, 0.8, 0.78), sides=6)
    for sx in (-1, 1):
        a = V((sx * 0.012, 0.004, -0.04))
        b = V((sx * 0.03, 0.006, -0.1))
        w = 0.022
        q = [vb.v(a + V((-w / 2, 0, 0)), col), vb.v(a + V((w / 2, 0, 0)), col), vb.v(b + V((w / 2, 0, 0)), mulc(col, 0.85)),
             vb.v(b + V((0, 0, 0.012)), mulc(col, 0.85)), vb.v(b + V((-w / 2, 0, 0)), mulc(col, 0.85))]
        vb.f(q)
    ob = vb.obj("badge_" + name, [m_rim, m_face], light=0.18)
    ob.location = (0, 0, 0)
    return ob


def make_badges():
    C.reset()
    rim = P.mat("badge_rim", tex="brass.jpg", rough=0.4, metal=0.5, double=True)
    face = P.mat("badge_face", tex="p_badges.jpg", rough=0.5)
    objs = []
    for i, (nm, shape) in enumerate(TEAMS):
        o = badge(nm, shape, i, face, rim)
        objs.append(o)
    for o in objs:  # stand them up: origin at the ribbon tips (bottom), facing -Y
        o.data.transform(Matrix.Translation(V((0, 0, 0.1))))
    P.layout(objs, 0.03)
    P.export("p3_team_badges", objs)


NAMES = {"museum": make_museum, "frame": make_frame, "case": make_case, "plinth": make_plinth, "sticker_board": make_sticker_board,
         "banner": make_banner, "totem": make_totem, "badges": make_badges}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for n in (argv or list(NAMES)):
        NAMES[n]()
