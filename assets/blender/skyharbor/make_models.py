"""Skyharbor models (EdVerse OpenWorld), built from scratch in headless Blender 4.2.

blender -b --factory-startup -P make_models.py -- [names...]
names: observatory airship greenhouse workshop robot harbor cliff glowplants gate (default: all)
Outputs build/glb/sh_<name>.glb. Textures come from textures.py (build/tex).
Conventions: metres, Z-up (exported Y-up), origin at the base centre, fronts face -Y.
Named nodes the game animates: airship prop_0/prop_1 (spin about X) and mesh "sails";
workshop gear_N (spin about their own axis); robot robot_head / arm_l / arm_r (pivots at the joints);
gate "portal"; anything with a *glow* material is emissive.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import shcommon as S  # noqa: E402
from shcommon import C  # noqa: E402

PI = math.pi


def mats():
    """The district's shared material set (same names in every model)."""
    M = {}
    M["stone"] = C.material("sh_masonry", tex="sh_masonry.jpg", normal="sh_masonry_n.jpg", rough=0.9)
    M["rock"] = C.material("sh_rock", tex="sh_rock.jpg", normal="sh_rock_n.jpg", rough=0.92, vcol=True)
    M["wood"] = C.material("sh_wood", tex="sh_wood.jpg", normal="sh_wood_n.jpg", rough=0.8)
    M["brass"] = C.material("sh_brass", tex="sh_brass.jpg", rough=0.38, metal=0.85)
    M["copper"] = C.material("sh_copper", tex="sh_copper.jpg", rough=0.45, metal=0.7)
    M["iron"] = C.material("sh_iron", color=(0.08, 0.075, 0.08), rough=0.55, metal=0.6)
    M["canvas"] = C.material("sh_canvas", tex="sh_canvas.jpg", rough=0.9, double=True)
    M["window"] = C.material("sh_window_glow", tex="sh_window.jpg", emissive_tex="sh_window.jpg", emissive_strength=2.2, rough=0.4)
    M["window_soft"] = C.material("sh_windowarch_glow", color=(1.0, 0.72, 0.4), emissive=(1.0, 0.68, 0.36), emissive_strength=1.7, rough=0.4)
    M["warm"] = C.material("sh_lamp_glow", color=(1.0, 0.78, 0.45), emissive=(1.0, 0.7, 0.35), emissive_strength=4.0, rough=0.3)
    M["teal"] = C.material("sh_teal_glow", color=(0.3, 0.95, 0.9), emissive=(0.25, 0.95, 0.88), emissive_strength=3.0, rough=0.3)
    M["dome"] = C.material("sh_dome_glow", color=(0.35, 0.22, 0.12), emissive=(1.0, 0.55, 0.22), emissive_strength=0.9, rough=0.15)
    M["glass"] = C.material("sh_glass", color=(0.55, 0.85, 0.85), rough=0.08, metal=0.0)
    M["paint"] = C.material("sh_paint", tex="sh_paint.jpg", rough=0.45)
    M["face"] = C.material("sh_face_glow", tex="sh_face.jpg", emissive_tex="sh_face.jpg", emissive_strength=1.6, rough=0.2)
    M["plants"] = C.material("sh_plants_glow", tex="sh_glow.png", emissive_tex="sh_glow_e.jpg", emissive_strength=2.0, alpha_tex=True, double=True, rough=0.7)
    M["leaves"] = C.material("sh_leaves", tex="sh_leaves.png", alpha_tex=True, double=True, rough=0.8)
    M["red"] = C.material("sh_pennant", color=(0.75, 0.2, 0.18), rough=0.8, double=True)
    M["portal"] = C.material("sh_portal_glow", tex="sh_portal.jpg", emissive_tex="sh_portal.jpg", emissive_strength=1.8, rough=0.3, double=True)
    M["sign"] = C.material("sh_sign", tex="sh_sign.jpg", rough=0.6)
    M["rope"] = C.material("sh_rope", color=(0.42, 0.33, 0.22), rough=0.95)
    return M


def face_out(ob, a, r, z):
    """Place an object on a circle (angle a from -Y, clockwise seen from above) facing outward."""
    ob.location = (math.sin(a) * r, -math.cos(a) * r, z)
    ob.rotation_euler = (0, 0, a)
    return ob


def lamp_head(prefix, loc, M, scale=1.0):
    """A little brass lantern (cap, glass, base) at loc."""
    x, y, z = loc
    s = scale
    out = [
        S.lathe_obj(prefix + "_cap", [(0.0, 0.32 * s), (0.05 * s, 0.32 * s), (0.16 * s, 0.22 * s), (0.17 * s, 0.19 * s)], M["brass"], segs=8, loc=(x, y, z)),
        S.lathe_obj(prefix + "_glass", [(0.1 * s, 0.0), (0.13 * s, 0.1 * s), (0.11 * s, 0.2 * s)], M["warm"], segs=8, loc=(x, y, z)),
        S.lathe_obj(prefix + "_base", [(0.0, -0.06 * s), (0.13 * s, -0.04 * s), (0.12 * s, 0.01 * s)], M["brass"], segs=8, loc=(x, y, z)),
    ]
    return out


# =============================================================================== observatory
def make_observatory():
    C.reset()
    M = mats()
    objs = []
    R = 3.4
    # plinth and tower
    objs.append(S.lathe_obj("plinth", [(0.0, 0.0), (4.4, 0.0), (4.4, 0.35), (4.0, 0.42), (3.9, 0.7), (0.0, 0.7)], M["stone"], segs=32, u_scale=9, v_scale=0.35))
    objs.append(S.lathe_obj("tower", [(R + 0.12, 0.7), (R + 0.05, 2.0), (R, 4.5), (R - 0.05, 7.1)], M["stone"], segs=32, u_scale=7, v_scale=0.33, cap=False))
    objs.append(S.lathe_obj("cornice", [(R - 0.1, 7.05), (R + 0.35, 7.12), (R + 0.45, 7.3), (R + 0.3, 7.45), (0.0, 7.45)], M["stone"], segs=32, u_scale=8, v_scale=0.4))
    objs.append(S.torus_obj("band_lo", R + 0.14, 0.07, M["brass"], loc=(0, 0, 1.2), seg=40, rseg=6))
    # gallery: deck ring + railing
    objs.append(S.lathe_obj("gallery", [(R + 0.3, 7.25), (4.6, 7.25), (4.6, 7.42), (R + 0.3, 7.42)], M["wood"], segs=36, u_scale=10, v_scale=0.5, cap=False))
    for k in range(28):
        a = k / 28 * PI * 2
        objs.append(S.rod(f"gpost{k}", (math.sin(a) * 4.45, -math.cos(a) * 4.45, 7.4), (math.sin(a) * 4.45, -math.cos(a) * 4.45, 8.25), 0.035, M["brass"], sides=6))
    objs.append(S.torus_obj("grail", 4.45, 0.05, M["brass"], loc=(0, 0, 8.25), seg=48, rseg=6))
    objs.append(S.torus_obj("grail2", 4.45, 0.025, M["brass"], loc=(0, 0, 7.85), seg=48, rseg=5))
    # brackets under the gallery
    for k in range(12):
        a = (k + 0.5) / 12 * PI * 2
        objs.append(S.tube_obj(f"brk{k}", [(math.sin(a) * (R + 0.02), -math.cos(a) * (R + 0.02), 6.3), (math.sin(a) * 3.9, -math.cos(a) * 3.9, 7.0), (math.sin(a) * 4.45, -math.cos(a) * 4.45, 7.25)], [0.07, 0.06, 0.05], M["iron"], sides=6))
    # dome: glowing glass, brass ribs, base ring, shutter slot frame, finial
    DR, DZ = 3.25, 7.45
    prof = [(DR * math.cos(t), DZ + DR * math.sin(t)) for t in [i / 12 * PI / 2 for i in range(13)]]
    prof[-1] = (0.001, prof[-1][1])
    objs.append(S.lathe_obj("dome", prof, M["dome"], segs=36, cap=False))
    for k in range(14):
        a = k / 14 * PI * 2
        pts = [(math.sin(a) * (DR + 0.05) * math.cos(t), -math.cos(a) * (DR + 0.05) * math.cos(t), DZ + (DR + 0.05) * math.sin(t)) for t in [i / 10 * PI / 2 * 0.97 for i in range(11)]]
        objs.append(S.tube_obj(f"rib{k}", pts, 0.06, M["brass"], sides=6))
    for z_, rr in ((0.35, 0.9), (0.75, 0.62)):
        objs.append(S.torus_obj(f"lat{z_}", (DR + 0.05) * math.cos(math.asin(z_)), 0.045, M["brass"], loc=(0, 0, DZ + DR * z_), seg=40, rseg=5))
    objs.append(S.torus_obj("domering", DR + 0.12, 0.13, M["brass"], loc=(0, 0, DZ + 0.05), seg=48, rseg=8))
    # shutter: two thick rails along one meridian (facing the plaza, a little to the right)
    sa = -0.35
    for off in (-0.45, 0.45):
        pts = []
        for i in range(12):
            t = i / 11 * PI / 2 * 0.98
            rr = DR + 0.14
            px = math.sin(sa) * rr * math.cos(t) + math.cos(sa) * off
            py = -math.cos(sa) * rr * math.cos(t) + math.sin(sa) * off
            pts.append((px, py, DZ + rr * math.sin(t)))
        objs.append(S.tube_obj(f"shut{off}", pts, 0.11, M["copper"], sides=6))
    objs.append(S.lathe_obj("finial", [(0.0, 0.0), (0.22, 0.0), (0.12, 0.25), (0.06, 0.6), (0.0, 0.75)], M["brass"], segs=12, loc=(0, 0, DZ + DR - 0.02)))
    objs.append(S.sphere("finial_glow", 0.12, (0, 0, DZ + DR + 0.8), M["teal"], segs=10, rings=6))
    # telescope poking out of the slot
    scope = S.lathe_obj("scope", [(0.0, -1.2), (0.36, -1.2), (0.36, -0.9), (0.3, -0.85), (0.3, 1.6), (0.36, 1.65), (0.4, 2.2), (0.36, 2.25), (0.0, 2.25)], M["brass"], segs=20)
    scope.location = (math.sin(sa) * 1.6, -math.cos(sa) * 1.6, DZ + 2.0)
    scope.rotation_euler = (math.radians(42), 0, sa)
    objs.append(scope)
    objs.append(S.torus_obj("scope_band", 0.33, 0.05, M["copper"], loc=scope.location, rot=scope.rotation_euler, seg=20, rseg=5))
    # windows (two rows, arched, glowing) with stone sills
    for row, (z, n, off) in enumerate(((2.6, 5, 0.6), (5.0, 6, 0.0))):
        for k in range(n):
            a = off + k / n * PI * 2
            if row == 0 and abs(((a + PI) % (2 * PI)) - PI) < 0.5:
                continue  # the door is there
            w = C.box_obj(f"win{row}_{k}", (0.62, 0.16, 0.95), (0, 0, 0), M["window"], bevel=0.04)
            arch = S.lathe_obj(f"wa{row}_{k}", [(0.0, -0.08), (0.31, -0.08), (0.31, 0.08), (0.0, 0.08)], M["window_soft"], segs=12, rot=(PI / 2, 0, 0))
            arch.location = (0, 0, 0.47)
            frame = C.box_obj(f"wf{row}_{k}", (0.8, 0.12, 1.15), (0, 0.04, -0.02), M["wood"], bevel=0.03)
            sill = C.box_obj(f"ws{row}_{k}", (0.92, 0.3, 0.1), (0, -0.06, -0.55), M["stone"], bevel=0.02)
            win = C.join([w, arch, frame, sill], f"window{row}_{k}")
            face_out(win, a, R - 0.02, z)
            win.rotation_euler = (0, 0, a)
            objs.append(win)
    # door with arch, steps and two wall lamps (front = -Y)
    door = C.box_obj("door", (1.3, 0.25, 2.0), (0, -R - 0.05, 1.7), M["wood"], bevel=0.04, uv_scale=0.6)
    darch = S.lathe_obj("darch", [(0.0, -0.12), (0.65, -0.12), (0.65, 0.12), (0.0, 0.12)], M["wood"], segs=14, rot=(PI / 2, 0, 0), loc=(0, -R - 0.05, 2.7))
    dframe = S.torus_obj("dframe", 0.72, 0.1, M["stone"], loc=(0, -R - 0.12, 2.7), rot=(PI / 2, 0, 0), seg=20, rseg=6)
    objs += [door, darch, dframe]
    for sx in (-0.72, 0.72):
        objs.append(C.box_obj(f"jamb{sx}", (0.2, 0.28, 2.05), (sx, -R - 0.12, 1.72), M["stone"], bevel=0.03))
    objs.append(S.sphere("knob", 0.06, (0.4, -R - 0.2, 1.7), M["brass"], segs=8, rings=5))
    for i in range(3):
        objs.append(C.box_obj(f"step{i}", (2.0 - i * 0.3, 0.45, 0.24), (0, -R - 1.1 + i * 0.4, 0.12 + i * 0.22 - 0.1), M["stone"], bevel=0.03, noise_amp=0.01, seed=i))
    for sx in (-1.15, 1.15):
        arm = S.tube_obj(f"larm{sx}", [(sx, -R + 0.02, 2.7), (sx, -R - 0.3, 2.8), (sx, -R - 0.42, 2.65)], 0.03, M["iron"], sides=6)
        objs.append(arm)
        objs += lamp_head(f"wl{sx}", (sx, -R - 0.42, 2.25), M, 1.2)
    # spiral stair up to the gallery (outside, on the right side)
    steps = 24
    for i in range(steps):
        a = 0.9 + i / steps * 2.6
        z = 0.7 + i / steps * 6.55
        st = C.box_obj(f"sst{i}", (1.05, 0.42, 0.1), (0, 0, 0), M["wood"], bevel=0.015, uv_scale=0.8)
        face_out(st, a, R + 0.55, z)
        objs.append(st)
        if i % 3 == 0:
            p0 = (math.sin(a) * (R + 1.02), -math.cos(a) * (R + 1.02), z)
            objs.append(S.rod(f"spost{i}", p0, (p0[0], p0[1], z + 0.85), 0.03, M["brass"], sides=6))
    hand = [(math.sin(0.9 + t * 2.6) * (R + 1.02), -math.cos(0.9 + t * 2.6) * (R + 1.02), 0.7 + t * 6.55 + 0.85) for t in [i / 16 for i in range(17)]]
    objs.append(S.tube_obj("handrail", hand, 0.035, M["brass"], sides=6))
    # copper pipe and gauge on the back
    pipe = [(math.sin(2.6) * (R + 0.15), -math.cos(2.6) * (R + 0.15), z) for z in (0.5, 3.0, 6.9)]
    objs.append(S.tube_obj("pipe", pipe, 0.09, M["copper"], sides=8))
    # small brass weather vane on the finial side and an antenna mast
    objs.append(S.rod("mast", (2.2, 1.6, 7.4), (2.2, 1.6, 10.6), 0.04, M["iron"], sides=6))
    objs.append(S.sphere("mast_glow", 0.1, (2.2, 1.6, 10.7), M["warm"], segs=8, rings=5))
    for o in objs:
        if o.type == "MESH" and not o.data.uv_layers:
            C.box_uv(o, 1.0)
    S.group("observatory", objs)
    C.export("sh_observatory")


# =============================================================================== airship
def make_airship():
    C.reset()
    M = mats()
    objs = []
    L = 5.4
    stations = 26
    secs = []
    edges_l, edges_r, keel = [], [], []
    for i in range(stations + 1):
        x = -L + 2 * L * i / stations
        t = x / L
        w = 1.75 * max(0.03, (1 - t * t)) ** 0.55 * (1 - 0.18 * max(0, t))
        d = 1.55 * max(0.05, 1 - (x / (L + 0.4)) ** 2) ** 0.7
        ztop = 0.35 * t * t + (0.25 if t < -0.6 else 0)
        sec = []
        M_ = 16
        for j in range(M_ + 1):
            ph = j / M_ * PI
            y = w * math.cos(ph)
            z = ztop - d * math.sin(ph) ** 0.75
            sec.append(Vector((x, y, z)))
        secs.append(sec)
        edges_l.append(Vector((x, w, ztop)))
        edges_r.append(Vector((x, -w, ztop)))
        keel.append(Vector((x, 0, ztop - d - 0.04)))
    objs.append(S.loft("hull", secs, M["wood"], u_scale=0.32, v_scale=0.42))
    # deck (recessed) between the edges
    dsecs = [[Vector((e.x, e.y * 0.97, e.z - 0.12)), Vector((r.x, r.y * 0.97, r.z - 0.12))] for e, r in zip(edges_l, edges_r)]
    objs.append(S.loft("deck", dsecs, M["wood"], u_scale=0.4, v_scale=0.4))
    objs.append(S.tube_obj("gun_l", [e + Vector((0, 0, 0.12)) for e in edges_l], 0.09, M["wood"], sides=6))
    objs.append(S.tube_obj("gun_r", [e + Vector((0, 0, 0.12)) for e in edges_r], 0.09, M["wood"], sides=6))
    objs.append(S.tube_obj("keel", keel, 0.1, M["brass"], sides=6))
    for k in range(1, 6):
        i = int(stations * k / 6)
        objs.append(S.tube_obj(f"rib{k}", [p + (p - Vector((p.x, 0, -0.3))).normalized() * 0.03 for p in secs[i]], 0.045, M["brass"], sides=5, cap_end=False))
    # railing posts
    for side in (edges_l, edges_r):
        for i in range(2, stations - 1, 3):
            p = side[i]
            objs.append(S.rod(f"rp{i}{side is edges_l}", p, p + Vector((0, 0, 0.55)), 0.03, M["brass"], sides=5))
        objs.append(S.tube_obj(f"rr{side is edges_l}", [side[i] + Vector((0, 0, 0.55)) for i in range(2, stations - 1)], 0.03, M["brass"], sides=5))
    # stern cabin with glowing windows
    cab = C.box_obj("cabin", (1.7, 2.2, 1.15), (-3.6, 0, 0.75), M["wood"], bevel=0.05, uv_scale=0.6)
    roof = C.box_obj("cabin_roof", (2.0, 2.5, 0.16), (-3.6, 0, 1.4), M["copper"], bevel=0.04)
    objs += [cab, roof]
    for y in (-1.11, 1.11):
        for x in (-4.0, -3.2):
            objs.append(C.box_obj(f"cw{x}{y}", (0.42, 0.06, 0.42), (x, y, 0.85), M["window"], bevel=0.02))
    objs.append(C.box_obj("cw_back", (0.06, 0.9, 0.42), (-4.46, 0, 0.85), M["window"], bevel=0.02))
    objs += lamp_head("stern_lamp", (-4.9, 0, 1.0), M, 1.3)
    # masts, yards, sails
    for mx, mh, sw, sh in ((1.3, 6.4, 2.9, 3.4), (-1.5, 5.6, 2.5, 2.9)):
        objs.append(S.tube_obj(f"mast{mx}", [(mx, 0, -0.2), (mx, 0, mh)], [0.13, 0.08], M["wood"], sides=8))
        for yz, yw in ((mh - 0.35, sw * 0.55), (mh - 0.35 - sh, sw * 0.62)):
            objs.append(S.tube_obj(f"yard{mx}{yz}", [(mx + 0.12, -yw, yz), (mx + 0.12, yw, yz)], 0.05, M["wood"], sides=6))
        # crow's nest on the main mast
        if mx > 0:
            objs.append(S.lathe_obj("nest", [(0.0, 0.0), (0.42, 0.0), (0.48, 0.35), (0.44, 0.38)], M["wood"], segs=12, loc=(mx, 0, mh - 1.0), cap=True))
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.verify()
        G = 8
        vs = {}
        top, bot = mh - 0.4, mh - 0.4 - sh
        for a in range(G + 1):
            for b in range(G + 1):
                u, v = a / G, b / G
                halfw = sw * 0.5 * (0.55 + 0.07 * (1 - v)) / 0.55 * (0.9 + 0.1 * v)
                y = (u - 0.5) * 2 * halfw
                z = bot + (top - bot) * v
                x = mx + 0.2 + 0.55 * math.sin(PI * u) * math.sin(PI * (0.15 + 0.85 * v))
                vs[a, b] = bm.verts.new((x, y, z))
        for a in range(G):
            for b in range(G):
                f = bm.faces.new((vs[a, b], vs[a + 1, b], vs[a + 1, b + 1], vs[a, b + 1]))
                for loop, (aa, bb) in zip(f.loops, ((a, b), (a + 1, b), (a + 1, b + 1), (a, b + 1))):
                    loop[uvl].uv = (aa / G, bb / G)
        sail = C.new_obj(f"sails{mx}", bm, [M["canvas"]])
        C.shade_smooth(sail)
        objs.append(sail)
    # jib (triangle from the bowsprit to the main mast top)
    objs.append(S.tube_obj("bowsprit", [(L - 0.4, 0, 0.55), (L + 1.8, 0, 1.25)], [0.1, 0.05], M["wood"], sides=6))
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    v1, v2, v3 = bm.verts.new((L + 1.7, 0, 1.25)), bm.verts.new((1.45, 0, 6.0)), bm.verts.new((1.6, 0, 0.6))
    f = bm.faces.new((v1, v2, v3))
    for loop, uv in zip(f.loops, ((1, 0), (0, 1), (0, 0))):
        loop[uvl].uv = uv
    objs.append(C.new_obj("sails_jib", bm, [M["canvas"]]))
    # pennant
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    a_, b_, c_ = bm.verts.new((1.3, 0, 6.4)), bm.verts.new((1.3, 0, 6.05)), bm.verts.new((0.1, 0.05, 6.25))
    f = bm.faces.new((a_, b_, c_))
    objs.append(C.new_obj("sails_pennant", bm, [M["red"]]))
    # rigging ropes
    for (p, q) in (((1.3, 0, 6.3), (L - 0.6, 0, 0.6)), ((1.3, 0, 6.3), (-0.4, 1.6, 0.5)), ((1.3, 0, 6.3), (-0.4, -1.6, 0.5)),
                   ((-1.5, 0, 5.5), (-3.0, 1.5, 0.6)), ((-1.5, 0, 5.5), (-3.0, -1.5, 0.6)), ((1.3, 0, 6.3), (-1.5, 0, 5.5))):
        objs.append(S.rod(f"rope{p}{q}", p, q, 0.018, M["rope"], sides=4))
    # engine pods under the hull, with headlamps and propellers
    for side, yy in ((0, 1.85), (1, -1.85)):
        pod = S.lathe_obj(f"pod{side}", [(0.0, -1.1), (0.28, -1.0), (0.42, -0.6), (0.45, 0.2), (0.38, 0.8), (0.3, 1.05), (0.0, 1.1)], M["copper"], segs=16)
        pod.location = (0.4, yy, -0.75)
        pod.rotation_euler = (0, PI / 2, 0)
        objs.append(pod)
        objs.append(S.torus_obj(f"podband{side}", 0.44, 0.05, M["brass"], loc=(0.6, yy, -0.75), rot=(0, PI / 2, 0), seg=18, rseg=5))
        lamp = S.lathe_obj(f"podlamp{side}", [(0.0, 0.0), (0.24, 0.0), (0.22, 0.08), (0.0, 0.1)], M["warm"], segs=14)
        lamp.location = (1.5, yy, -0.75)
        lamp.rotation_euler = (0, PI / 2, 0)
        objs.append(lamp)
        objs.append(S.torus_obj(f"lampring{side}", 0.26, 0.05, M["brass"], loc=(1.5, yy, -0.75), rot=(0, PI / 2, 0), seg=16, rseg=5))
        objs.append(S.tube_obj(f"strut{side}", [(0.4, yy * 0.45, -0.35), (0.4, yy, -0.5)], 0.07, M["iron"], sides=6))
        objs.append(S.tube_obj(f"strutb{side}", [(-0.4, yy * 0.45, -0.25), (-0.2, yy, -0.5)], 0.06, M["iron"], sides=6))
        blades = []
        for b in range(3):
            a = b / 3 * PI * 2
            bl = C.box_obj(f"bl{side}{b}", (0.06, 0.16, 0.7), (0, math.cos(a) * 0.35, math.sin(a) * 0.35), M["wood"], rot=(a - PI / 2, 0.35, 0), bevel=0.02)
            blades.append(bl)
        blades.append(S.sphere(f"spin{side}", 0.11, (0, 0, 0), M["brass"], segs=10, rings=6))
        prop = C.join(blades, f"prop_{side}")
        prop.location = (-0.75, yy, -0.75)
        objs.append(prop)
    # hanging lanterns along the rails
    for i in (6, 13, 20):
        for side in (edges_l, edges_r):
            p = side[i]
            objs += lamp_head(f"rl{i}{side is edges_l}", (p.x, p.y * 1.04, p.z + 0.25), M, 0.9)
    # stern fins
    for zz, ry in ((0.6, 0.0),):
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.verify()
        a1, a2, a3, a4 = (bm.verts.new(c) for c in ((-L + 0.3, 0, 0.2), (-L - 1.2, 0, 1.4), (-L - 1.4, 0, -0.6), (-L + 0.2, 0, -0.7)))
        f = bm.faces.new((a1, a2, a3, a4))
        for loop, uv in zip(f.loops, ((1, 0.5), (0, 1), (0, 0), (1, 0))):
            loop[uvl].uv = uv
        objs.append(C.new_obj("sails_fin", bm, [M["canvas"]]))
    for o in objs:
        if o.type == "MESH" and not o.data.uv_layers:
            C.box_uv(o, 1.0)
    S.group("airship", objs)
    C.export("sh_airship")


# =============================================================================== geodesic greenhouse
def make_greenhouse():
    C.reset()
    M = mats()
    objs = []
    R = 3.0
    base = 0.45
    objs.append(S.lathe_obj("gh_base", [(0.0, 0.0), (R + 0.35, 0.0), (R + 0.35, 0.3), (R + 0.15, base), (0.0, base)], M["stone"], segs=30, u_scale=6, v_scale=0.4))
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    # rotate so a vertex is not straight up (looks more like a real geodesic greenhouse)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(0.31, 3, "X"))
    kill = [f for f in bm.faces if f.calc_center_median().z < -0.12]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    for v in bm.verts:
        v.co = Vector((v.co.x * R, v.co.y * R, max(0.0, v.co.z + 0.12) * R * 0.92 + base))
    edges = [(e.verts[0].co.copy(), e.verts[1].co.copy()) for e in bm.edges]
    glass = C.new_obj("gh_glass", bm, [M["glass"]])
    for p in glass.data.polygons:
        p.use_smooth = False
    C.box_uv(glass, 0.5)
    objs.append(glass)
    frame = []
    for i, (a, b) in enumerate(edges):
        frame.append(S.rod(f"e{i}", a * 1.004, b * 1.004, 0.045, M["brass"], sides=5))
    hubs = {}
    for a, b in edges:
        for p in (a, b):
            hubs[(round(p.x, 2), round(p.y, 2), round(p.z, 2))] = p
    for i, p in enumerate(hubs.values()):
        frame.append(S.sphere(f"hub{i}", 0.075, p * 1.004, M["brass"], segs=6, rings=4))
    fr = C.join(frame, "gh_frame")
    objs.append(fr)
    # door frame at the front
    objs.append(S.torus_obj("gh_door", 0.62, 0.07, M["brass"], loc=(0, -R + 0.1, base + 1.0), rot=(PI / 2, 0, 0), seg=20, rseg=5))
    for sx in (-0.62, 0.62):
        objs.append(S.rod(f"gh_jamb{sx}", (sx, -R + 0.1, base), (sx, -R + 0.1, base + 1.0), 0.07, M["brass"], sides=6))
    # planter ring + glowing plants inside
    objs.append(S.lathe_obj("planter", [(1.0, base), (2.4, base), (2.4, base + 0.35), (2.25, base + 0.35), (2.25, base + 0.25), (1.15, base + 0.25), (1.15, base + 0.35), (1.0, base + 0.35)], M["wood"], segs=24, u_scale=4, v_scale=0.5, cap=False))
    rng = random.Random(5)
    bm = bmesh.new()
    quads = [(0, 0.5, 0.5, 1.0), (0.5, 0.5, 1.0, 1.0), (0.0, 0.0, 0.5, 0.5), (0.5, 0.0, 1.0, 0.5)]
    for k in range(22):
        a = rng.random() * PI * 2
        r = rng.uniform(1.2, 2.2)
        q = rng.choice((0, 0, 1, 1, 2, 3))
        h = rng.uniform(0.9, 1.7) * (1.3 if q == 0 else 1.0)
        S.cross_cards(bm, (math.cos(a) * r, math.sin(a) * r, base + 0.25), h * 0.9, h, quads[q], count=2, rot=rng.random() * PI, tilt=rng.uniform(-0.15, 0.15))
    # a tall centre plant
    for k in range(3):
        S.cross_cards(bm, (0, 0, base), 2.0, 2.4, quads[0], count=3, rot=k * 0.4)
    plants = C.new_obj("gh_plants", bm, [M["plants"]])
    objs.append(plants)
    # glowing mushroom caps (real geometry) around the base
    for k in range(5):
        a = rng.random() * PI * 2
        r = rng.uniform(0.4, 0.8)
        s = rng.uniform(0.18, 0.32)
        objs.append(S.lathe_obj(f"cap{k}", [(0.0, 0.0), (s * 0.18, 0.0), (s * 0.14, s * 1.4), (s, s * 1.5), (s * 0.85, s * 1.85), (0.0, s * 2.0)], M["teal"], segs=12, loc=(math.cos(a) * r, math.sin(a) * r, base)))
    # brass finial vent on top
    top = max(v[1].z for v in edges)
    objs.append(S.lathe_obj("vent", [(0.0, 0.0), (0.35, 0.0), (0.3, 0.25), (0.12, 0.35), (0.05, 0.7), (0.0, 0.72)], M["brass"], segs=12, loc=(0, 0, top - 0.05)))
    objs.append(S.sphere("vent_glow", 0.09, (0, 0, top + 0.72), M["teal"], segs=8, rings=5))
    for o in objs:
        if o.type == "MESH" and not o.data.uv_layers:
            C.box_uv(o, 1.0)
    S.group("greenhouse", objs)
    C.export("sh_greenhouse")


# =============================================================================== robot workshop
def make_workshop():
    C.reset()
    M = mats()
    objs = []
    W, D = 5.4, 3.4
    objs.append(C.box_obj("floor", (W, D, 0.3), (0, 0, 0.15), M["wood"], bevel=0.04, uv_scale=0.5))
    for sx in (-W / 2 + 0.15, W / 2 - 0.15):
        for sy in (-D / 2 + 0.15, D / 2 - 0.15):
            h = 3.0 if sy > 0 else 2.6
            objs.append(C.box_obj(f"post{sx}{sy}", (0.24, 0.24, h), (sx, sy, 0.3 + h / 2), M["wood"], bevel=0.03, uv_scale=0.8))
    objs.append(C.box_obj("backwall", (W - 0.3, 0.14, 2.75), (0, D / 2 - 0.15, 0.3 + 1.375), M["wood"], bevel=0.02, uv_scale=0.45))
    for sx in (-1, 1):
        objs.append(C.box_obj(f"side{sx}", (0.12, D - 0.4, 1.2), (sx * (W / 2 - 0.15), 0.1, 0.9), M["wood"], bevel=0.02, uv_scale=0.45))
    # roof: shed roof of copper sheets on rafters, front overhang
    roof = C.box_obj("roof", (W + 0.8, D + 1.2, 0.12), (0, -0.1, 3.15), M["copper"], rot=(math.radians(-8), 0, 0), bevel=0.03, uv_scale=0.6)
    objs.append(roof)
    for k in range(5):
        x = -W / 2 + 0.3 + k * (W - 0.6) / 4
        objs.append(C.box_obj(f"rafter{k}", (0.12, D + 1.0, 0.16), (x, -0.1, 3.02), M["wood"], rot=(math.radians(-8), 0, 0), bevel=0.02))
    objs.append(C.box_obj("beam", (W + 0.2, 0.2, 0.22), (0, -D / 2 + 0.15, 2.85), M["wood"], bevel=0.03))
    # gears on the back wall (separate, spun by the game)
    gears = [(-1.55, 1.95, 0.85, 16, "brass"), (-0.42, 1.55, 0.52, 10, "copper"), (0.45, 2.25, 0.42, 8, "brass"),
             (1.45, 1.75, 0.72, 14, "copper"), (0.55, 1.25, 0.28, 7, "brass")]
    for i, (x, z, r, t, mk) in enumerate(gears):
        g = S.gear_obj(f"gear_{i}", r, t, 0.12, M[mk], hub_mat=M["iron"])
        g.location = (x, D / 2 - 0.32, z + 0.3)
        objs.append(g)
    # big flywheel outside the right wall
    fw = S.gear_obj("gear_5", 1.05, 20, 0.16, M["iron"], hub_mat=M["brass"])
    fw.location = (W / 2 + 0.35, 0.6, 1.4)
    fw.rotation_euler = (0, 0, PI / 2)
    objs.append(fw)
    objs.append(C.box_obj("fw_stand", (0.3, 0.3, 1.4), (W / 2 + 0.35, 0.6, 0.7), M["iron"], bevel=0.03))
    # workbench with vice, tools, small gears, a glowing jar and a desk lamp
    objs.append(C.box_obj("bench", (2.6, 0.9, 0.1), (-0.9, 0.55, 1.2), M["wood"], bevel=0.02, uv_scale=0.6))
    for sx in (-2.1, 0.3):
        for sy in (0.2, 0.9):
            objs.append(C.box_obj(f"bleg{sx}{sy}", (0.1, 0.1, 0.9), (sx, sy, 0.75), M["wood"], bevel=0.01))
    objs.append(C.box_obj("shelf", (2.4, 0.8, 0.06), (-0.9, 0.55, 0.55), M["wood"], bevel=0.01))
    objs.append(C.box_obj("vice", (0.24, 0.3, 0.2), (0.2, 0.2, 1.36), M["iron"], bevel=0.02))
    objs.append(S.rod("vice_bar", (0.05, 0.02, 1.36), (0.35, 0.02, 1.36), 0.02, M["brass"], sides=5))
    for k, (x, y) in enumerate(((-1.8, 0.4), (-1.5, 0.7), (-0.5, 0.35), (-1.2, 0.3))):
        g = S.gear_obj(f"sg{k}", 0.1 + 0.03 * k, 8, 0.03, M["brass"], spokes=3)
        g.location = (x, y, 1.27)
        g.rotation_euler = (PI / 2, 0, k)
        objs.append(g)
    objs.append(S.rod("wrench", (-0.9, 0.3, 1.27), (-0.45, 0.55, 1.27), 0.025, M["iron"], sides=5))
    objs.append(S.torus_obj("wrench_head", 0.05, 0.02, M["iron"], loc=(-0.42, 0.57, 1.27), seg=10, rseg=4))
    jar = S.lathe_obj("jar", [(0.0, 0.0), (0.11, 0.0), (0.12, 0.22), (0.08, 0.26), (0.0, 0.26)], M["teal"], segs=12, loc=(-2.0, 0.75, 1.25))
    objs.append(jar)
    objs.append(S.lathe_obj("jar_lid", [(0.0, 0.26), (0.09, 0.26), (0.09, 0.31), (0.0, 0.31)], M["brass"], segs=12, loc=(-2.0, 0.75, 1.25)))
    objs.append(S.tube_obj("lamp_arm", [(-0.2, 0.9, 1.25), (-0.15, 0.85, 1.75), (-0.45, 0.6, 1.95)], 0.025, M["brass"], sides=5))
    objs += lamp_head("bench_lamp", (-0.45, 0.6, 1.72), M, 0.9)
    # blueprint sheet (canvas, flat)
    objs.append(C.box_obj("blueprint", (0.6, 0.45, 0.01), (-1.05, 0.65, 1.255), C.material("sh_blueprint", color=(0.18, 0.32, 0.55), emissive=(0.1, 0.3, 0.5), emissive_strength=0.4), rot=(0, 0, 0.12), bevel=0.0))
    # pegboard with tools on the right of the back wall
    objs.append(C.box_obj("pegboard", (1.2, 0.05, 0.9), (1.6, D / 2 - 0.25, 1.45), M["wood"], bevel=0.01))
    for k in range(4):
        objs.append(S.rod(f"tool{k}", (1.2 + k * 0.26, D / 2 - 0.3, 1.75), (1.2 + k * 0.26, D / 2 - 0.3, 1.3 - (k % 2) * 0.1), 0.025, M["iron"] if k % 2 else M["brass"], sides=5))
    # copper pipes with a gauge
    objs.append(S.tube_obj("pipe", [(-W / 2 + 0.4, D / 2 - 0.3, 0.3), (-W / 2 + 0.4, D / 2 - 0.3, 2.6), (W / 2 - 0.4, D / 2 - 0.3, 2.6)], 0.06, M["copper"], sides=6))
    gauge = S.lathe_obj("gauge", [(0.0, 0.0), (0.16, 0.0), (0.16, 0.06), (0.0, 0.06)], M["brass"], segs=14, rot=(PI / 2, 0, 0), loc=(-W / 2 + 0.4, D / 2 - 0.36, 2.2))
    objs.append(gauge)
    # crates of parts and a hanging lantern
    for k, (x, y, s, r) in enumerate(((2.1, -0.9, 0.55, 0.2), (2.15, -0.25, 0.45, -0.3), (-2.15, -1.1, 0.5, 0.1))):
        objs.append(C.box_obj(f"crate{k}", (s, s, s), (x, y, 0.3 + s / 2), M["wood"], rot=(0, 0, r), bevel=0.03, uv_scale=1.2))
    objs.append(S.rod("hang", (0.9, -D / 2 + 0.15, 2.85), (0.9, -D / 2 + 0.15, 2.5), 0.015, M["iron"], sides=4))
    objs += lamp_head("hang_lamp", (0.9, -D / 2 + 0.15, 2.18), M, 1.1)
    # round sign over the front: gear and star on canvas
    sign = S.lathe_obj("sign", [(0.0, -0.05), (0.5, -0.05), (0.5, 0.05), (0.0, 0.05)], M["canvas"], segs=20, rot=(PI / 2, 0, 0), loc=(0, -D / 2 + 0.02, 3.35))
    me = sign.data
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            me.uv_layers.active.data[li].uv = (0.5 + co.x * 0.36, 0.52 + co.y * 0.36)
    objs.append(sign)
    objs.append(S.torus_obj("sign_ring", 0.52, 0.05, M["brass"], loc=(0, -D / 2 + 0.02, 3.35), rot=(PI / 2, 0, 0), seg=24, rseg=5))
    for o in objs:
        if o.type == "MESH" and not o.data.uv_layers:
            C.box_uv(o, 1.0)
    S.group("workshop", objs)
    C.export("sh_workshop")


# =============================================================================== friendly robot
def make_robot():
    C.reset()
    M = mats()
    teal_paint = C.material("sh_paint_teal", tex="sh_paint.jpg", rough=0.45)
    teal_paint.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.2, 0.6, 0.62, 1)
    # tint: multiply the texture by teal
    nt = teal_paint.node_tree
    tex = [n for n in nt.nodes if n.type == "TEX_IMAGE"][0]
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs[7].default_value = (0.25, 0.62, 0.64, 1)
    nt.links.new(tex.outputs["Color"], mix.inputs[6])
    nt.links.new(mix.outputs[2], nt.nodes["Principled BSDF"].inputs["Base Color"])
    base, body = [], []
    # base: chassis + two wheels with treads
    base.append(C.box_obj("chassis", (0.42, 0.34, 0.14), (0, 0, 0.2), M["iron"], bevel=0.04))
    for y in (-0.2, 0.2):
        w = S.lathe_obj(f"wheel{y}", [(0.0, -0.06), (0.14, -0.06), (0.16, -0.03), (0.16, 0.03), (0.14, 0.06), (0.0, 0.06)], M["iron"], segs=16, rot=(PI / 2, 0, 0), loc=(0.0, y, 0.16))
        base.append(w)
        base.append(S.lathe_obj(f"hubcap{y}", [(0.0, -0.065), (0.07, -0.065), (0.07, 0.065), (0.0, 0.065)], M["brass"], segs=10, rot=(PI / 2, 0, 0), loc=(0.0, y, 0.16)))
    # body: rounded barrel, teal belly panel with a glowing heart light, brass collar and neck
    body.append(S.lathe_obj("torso", [(0.0, 0.25), (0.22, 0.25), (0.3, 0.32), (0.32, 0.5), (0.3, 0.7), (0.24, 0.78), (0.0, 0.78)], M["paint"], segs=24))
    belly = S.lathe_obj("belly", [(0.0, -0.012), (0.13, -0.012), (0.12, 0.012), (0.0, 0.016)], teal_paint, segs=20, rot=(PI / 2, 0, 0), loc=(0, -0.305, 0.5))
    body.append(belly)
    body.append(S.sphere("heart", 0.04, (0, -0.315, 0.5), M["teal"], segs=10, rings=6, scale=(1, 0.5, 1)))
    body.append(S.torus_obj("collar", 0.22, 0.04, M["brass"], loc=(0, 0, 0.78), seg=20, rseg=6))
    body.append(S.lathe_obj("neck", [(0.09, 0.76), (0.08, 0.9), (0.0, 0.9)], M["iron"], segs=12, cap=False))
    for k in range(6):
        a = k / 6 * PI * 2
        body.append(S.sphere(f"bolt{k}", 0.022, (math.sin(a) * 0.31, -math.cos(a) * 0.31, 0.64), M["brass"], segs=6, rings=4))
    # cargo pack on the back
    body.append(C.box_obj("pack", (0.34, 0.16, 0.3), (0, 0.3, 0.55), M["brass"], bevel=0.04))
    body.append(S.rod("pack_pipe", (0.12, 0.38, 0.45), (0.12, 0.38, 0.85), 0.025, M["copper"], sides=6))
    # head (pivot at the neck, z 0.82): rounded screen-box with a friendly face
    NZ = 0.82
    head = []
    hb = C.box_obj("headbox", (0.6, 0.46, 0.44), (0, 0, NZ + 0.28), M["paint"], bevel=0.14)
    head.append(hb)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    vs = [bm.verts.new(c) for c in ((-0.2, -0.236, NZ + 0.12), (0.2, -0.236, NZ + 0.12), (0.2, -0.236, NZ + 0.44), (-0.2, -0.236, NZ + 0.44))]
    f = bm.faces.new(vs)
    for loop, uv in zip(f.loops, ((0.05, 0.12), (0.95, 0.12), (0.95, 0.88), (0.05, 0.88))):
        loop[uvl].uv = uv
    head.append(C.new_obj("face", bm, [M["face"]]))
    for x in (-0.31, 0.31):
        head.append(S.lathe_obj(f"ear{x}", [(0.0, -0.04), (0.09, -0.04), (0.07, 0.04), (0.0, 0.05)], M["brass"], segs=12, rot=(0, PI / 2 * (1 if x > 0 else -1), 0), loc=(x, 0, NZ + 0.28)))
    head.append(S.tube_obj("antenna", [(0.08, 0.02, NZ + 0.48), (0.1, 0.03, NZ + 0.64), (0.16, 0.05, NZ + 0.74)], [0.018, 0.015, 0.012], M["iron"], sides=5))
    head.append(S.sphere("antenna_glow", 0.045, (0.16, 0.05, NZ + 0.77), M["warm"], segs=8, rings=5))
    h = C.join(head, "robot_head")
    S.set_origin(h, (0, 0, NZ))
    # arms (pivot at the shoulder): upper arm, elbow, forearm, round hand with two fingers
    arms = []
    for side, sx in (("l", 1), ("r", -1)):
        parts = [S.sphere(f"sh{side}", 0.07, (0, 0, 0), M["brass"], segs=10, rings=6),
                 S.tube_obj(f"ua{side}", [(0, 0, 0), (sx * 0.05, -0.02, -0.17)], 0.045, M["paint"], sides=8),
                 S.sphere(f"el{side}", 0.05, (sx * 0.05, -0.02, -0.17), M["brass"], segs=8, rings=5),
                 S.tube_obj(f"fa{side}", [(sx * 0.05, -0.02, -0.17), (sx * 0.05, -0.13, -0.27)], 0.04, M["paint"], sides=8),
                 S.sphere(f"hand{side}", 0.055, (sx * 0.05, -0.15, -0.29), M["iron"], segs=8, rings=6)]
        for k in (-1, 1):
            parts.append(C.box_obj(f"cl{side}{k}", (0.025, 0.07, 0.025), (sx * 0.05 + k * 0.03, -0.2, -0.31), M["brass"], bevel=0.008))
        a = C.join(parts, f"arm_{side}")
        a.location = (sx * 0.34, 0, 0.66)
        arms.append(a)
    b = C.join(base + body, "robot_body")
    for o in [b, h] + arms:
        if not o.data.uv_layers:
            C.box_uv(o, 1.0)
    S.group("robot", [b, h] + arms)
    C.export("sh_robot")


# =============================================================================== harbor props pack
def make_harbor():
    """rail (2 m railing segment along +X, post at x=0), lamp (lamp post), dock (wooden pier along -Y,
    8 m), crate, bollard, bench. Each is its own object at the origin, for instancing."""
    C.reset()
    M = mats()
    out = []
    # railing segment
    rail = [C.box_obj("r_post", (0.14, 0.14, 1.05), (0, 0, 0.52), M["wood"], bevel=0.02, uv_scale=0.8),
            S.lathe_obj("r_cap", [(0.0, 0.0), (0.1, 0.0), (0.08, 0.06), (0.0, 0.1)], M["brass"], segs=8, loc=(0, 0, 1.05)),
            C.box_obj("r_top", (2.0, 0.1, 0.08), (1.0, 0, 1.0), M["wood"], bevel=0.02, uv_scale=0.8),
            S.rod("r_mid", (0, 0, 0.6), (2.0, 0, 0.6), 0.025, M["brass"], sides=6),
            S.rod("r_low", (0, 0, 0.25), (2.0, 0, 0.25), 0.025, M["brass"], sides=6)]
    for k in range(1, 4):
        rail.append(S.rod(f"r_bal{k}", (k * 0.5, 0, 0.25), (k * 0.5, 0, 0.98), 0.018, M["brass"], sides=5))
    out.append(C.join(rail, "rail"))
    # lamp post
    lamp = [S.lathe_obj("l_foot", [(0.0, 0.0), (0.22, 0.0), (0.2, 0.12), (0.1, 0.2), (0.07, 0.4)], M["iron"], segs=10),
            S.tube_obj("l_pole", [(0, 0, 0.3), (0, 0, 2.5)], [0.055, 0.045], M["iron"], sides=8),
            S.tube_obj("l_curl", [(0, 0, 2.45), (0.12, 0, 2.75), (0.4, 0, 2.8), (0.55, 0, 2.7)], 0.035, M["brass"], sides=6),
            S.rod("l_hang", (0.55, 0, 2.72), (0.55, 0, 2.55), 0.015, M["iron"], sides=4)]
    lamp += lamp_head("l_head", (0.55, 0, 2.2), M, 1.2)
    out.append(C.join(lamp, "lamp"))
    # dock: planks, side beams, posts down, bollards, rope coil
    dock = [C.box_obj("d_deck", (3.0, 8.0, 0.18), (0, -4.0, -0.09), M["wood"], bevel=0.03, uv_scale=0.5)]
    for sx in (-1.45, 1.45):
        dock.append(C.box_obj(f"d_beam{sx}", (0.2, 8.0, 0.3), (sx, -4.0, -0.3), M["wood"], bevel=0.03, uv_scale=0.5))
        for k in range(3):
            y = -1.5 - k * 3.0
            dock.append(S.tube_obj(f"d_leg{sx}{k}", [(sx, y, -0.3), (sx * 0.6, y + 1.2, -4.5 + k * 0.5)], 0.12, M["wood"], sides=6))
            dock.append(S.lathe_obj(f"d_bol{sx}{k}", [(0.0, 0.0), (0.16, 0.0), (0.12, 0.3), (0.18, 0.4), (0.0, 0.45)], M["iron"], segs=10, loc=(sx * 0.95, y, 0.0)))
        # side rails along the pier
        for k in range(5):
            y = -k * 2.0
            dock.append(C.box_obj(f"d_post{sx}{k}", (0.12, 0.12, 1.0), (sx, y, 0.5), M["wood"], bevel=0.02))
        dock.append(C.box_obj(f"d_rail{sx}", (0.09, 8.0, 0.08), (sx, -4.0, 0.98), M["wood"], bevel=0.02, uv_scale=0.6))
        dock.append(S.rod(f"d_rope{sx}", (sx, 0, 0.6), (sx, -8.0, 0.6), 0.025, M["rope"], sides=5))
    dock.append(S.torus_obj("d_coil", 0.22, 0.05, M["rope"], loc=(0.6, -6.6, 0.05), seg=16, rseg=5))
    dock.append(S.torus_obj("d_coil2", 0.16, 0.05, M["rope"], loc=(0.6, -6.6, 0.13), seg=14, rseg=5))
    # a small loading crane at the end
    dock.append(S.tube_obj("d_crane", [(-1.1, -7.5, 0.0), (-1.1, -7.5, 3.0), (-0.2, -8.6, 3.4)], 0.09, M["iron"], sides=6))
    dock.append(S.rod("d_hook", (-0.2, -8.6, 3.4), (-0.2, -8.6, 2.3), 0.015, M["rope"], sides=4))
    dock.append(C.box_obj("d_load", (0.4, 0.4, 0.35), (-0.2, -8.6, 2.1), M["wood"], bevel=0.03, uv_scale=1.2))
    out.append(C.join(dock, "dock"))
    # crate with brass corners
    crate = [C.box_obj("c_box", (0.7, 0.7, 0.7), (0, 0, 0.35), M["wood"], bevel=0.04, uv_scale=1.3)]
    for sx in (-0.34, 0.34):
        for sy in (-0.34, 0.34):
            crate.append(C.box_obj(f"c_corner{sx}{sy}", (0.08, 0.08, 0.72), (sx, sy, 0.36), M["brass"], bevel=0.01))
    out.append(C.join(crate, "crate"))
    # bench
    bench = [C.box_obj("b_seat", (1.6, 0.45, 0.08), (0, 0, 0.45), M["wood"], bevel=0.02, uv_scale=0.8),
             C.box_obj("b_back", (1.6, 0.06, 0.4), (0, 0.22, 0.75), M["wood"], bevel=0.02, uv_scale=0.8)]
    for sx in (-0.7, 0.7):
        bench.append(S.tube_obj(f"b_leg{sx}", [(sx, -0.2, 0.0), (sx, -0.15, 0.45), (sx, 0.22, 0.95)], 0.03, M["iron"], sides=6))
        bench.append(S.rod(f"b_legb{sx}", (sx, 0.18, 0.0), (sx, 0.18, 0.45), 0.03, M["iron"], sides=6))
    out.append(C.join(bench, "bench"))
    for o in out:
        if not o.data.uv_layers:
            C.box_uv(o, 1.0)
        print(o.name, C.tris(o))
    C.export("sh_harbor_props")


# =============================================================================== cliff pieces
def make_cliff():
    """rim_a / rim_b: cliff-face chunks (top at z 0, 26 m deep) placed around the plateau edge;
    spire_a / spire_b: distant rock pillars with mossy tops and trees; rock_a / rock_b: boulders."""
    C.reset()
    M = mats()
    out = []
    for k, name in enumerate(("rim_a", "rim_b")):
        ob = S.rock_obj(name, M["rock"], radius=1.0, scale=(4.6, 3.4, 15.0), seed=10 + k, amp=0.28, subdiv=4, flat_top=0.92 * 15.0, ledges=0.06)
        for v in ob.data.vertices:
            v.co.z -= 13.85
            # taper toward the bottom (an inverted spire under the plateau)
            t = max(0.0, -v.co.z / 28.0)
            v.co.x *= 1.0 - 0.45 * t
            v.co.y *= 1.0 - 0.45 * t
        out.append(ob)
    for k, name in enumerate(("spire_a", "spire_b")):
        ob = S.rock_obj(name, M["rock"], radius=1.0, scale=(5.0 - k, 4.0 - k * 0.5, 22.0), seed=30 + k, amp=0.3, subdiv=4, flat_top=0.94 * 22.0, ledges=0.08)
        for v in ob.data.vertices:
            v.co.z -= 20.6
            t = max(0.0, -v.co.z / 42.0)
            v.co.x *= 1.0 - 0.5 * t
            v.co.y *= 1.0 - 0.5 * t
        # trees: leaf clumps on short trunks on the top
        rng = random.Random(40 + k)
        bm = bmesh.new()
        custom = []
        trunks = []
        for t_ in range(3):
            x, y = rng.uniform(-2, 2), rng.uniform(-1.5, 1.5)
            h = rng.uniform(2.5, 4.0)
            trunks.append(S.tube_obj(f"tr{k}{t_}", [(x, y, 0.6), (x + 0.3, y, 0.6 + h * 0.6), (x + 0.1, y + 0.2, 0.6 + h)], [0.28, 0.18, 0.1], C.material("sh_bark", color=(0.2, 0.14, 0.1), rough=0.9), sides=6))
            for c in range(3):
                cc = Vector((x + rng.uniform(-0.9, 0.9), y + rng.uniform(-0.9, 0.9), 0.6 + h + rng.uniform(-0.4, 0.6)))
                C.leaf_clump(bm, cc, rng.uniform(1.1, 1.6), 14, rng, custom)
        leaves = C.new_obj(name + "_leaves", bm, [M["leaves"]])
        ob = C.join([ob] + trunks + [leaves], name)
        out.append(ob)
    for k, name in enumerate(("rock_a", "rock_b")):
        ob = S.rock_obj(name, M["rock"], radius=1.0, scale=(1.2, 0.95, 0.75 + k * 0.25), seed=50 + k, amp=0.35, subdiv=3)
        for v in ob.data.vertices:
            v.co.z += 0.45
        out.append(ob)
    for o in out:
        print(o.name, C.tris(o))
    C.export("sh_cliff")


# =============================================================================== glowing plants
def make_glowplants():
    """plant_fern (teal fronds), plant_bell (violet bells), plant_blades (glow-tipped grass),
    plant_caps (3D glowing mushrooms), plant_crystal (a cluster of teal light crystals)."""
    C.reset()
    M = mats()
    out = []
    quads = [(0, 0.5, 0.5, 1.0), (0.5, 0.5, 1.0, 1.0), (0.0, 0.0, 0.5, 0.5)]
    for name, q, w, h, n in (("plant_fern", 0, 1.2, 1.1, 4), ("plant_bell", 1, 0.9, 1.0, 3), ("plant_blades", 2, 0.9, 0.8, 3)):
        bm = bmesh.new()
        rng = random.Random(len(name))
        for c in range(n):
            ang = rng.random() * PI
            off = (rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), 0)
            S.cross_cards(bm, off, w * rng.uniform(0.8, 1.1), h * rng.uniform(0.8, 1.15), quads[q], count=2, rot=ang, tilt=rng.uniform(-0.2, 0.2))
        out.append(C.new_obj(name, bm, [M["plants"]]))
    caps = []
    stem = C.material("sh_stem", color=(0.8, 0.82, 0.78), rough=0.7, emissive=(0.2, 0.4, 0.4), emissive_strength=0.4)
    rng = random.Random(9)
    for k in range(6):
        s = rng.uniform(0.1, 0.24)
        x, y = rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35)
        caps.append(S.lathe_obj(f"stem{k}", [(0.0, 0.0), (s * 0.25, 0.0), (s * 0.18, s * 1.8), (0.0, s * 1.8)], stem, segs=8, loc=(x, y, 0)))
        caps.append(S.lathe_obj(f"cap{k}", [(s * 0.2, s * 1.7), (s * 1.05, s * 1.65), (s * 0.9, s * 2.05), (s * 0.5, s * 2.3), (0.0, s * 2.35)], M["teal"], segs=12, loc=(x, y, 0)))
    out.append(C.join(caps, "plant_caps"))
    cry = []
    vio = C.material("sh_violet_glow", color=(0.7, 0.45, 1.0), emissive=(0.6, 0.3, 1.0), emissive_strength=2.5, rough=0.2)
    for k in range(7):
        h = rng.uniform(0.35, 0.9)
        ob = S.lathe_obj(f"cr{k}", [(0.0, 0.0), (0.09, 0.0), (0.1, h * 0.8), (0.0, h)], M["teal"] if k % 2 else vio, segs=6, smooth=False)
        ob.rotation_euler = (rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), rng.random())
        ob.location = (rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), 0)
        cry.append(ob)
    cry.append(S.rock_obj("cr_rock", M["rock"], radius=0.3, scale=(1.2, 1.0, 0.5), seed=3, subdiv=2))
    out.append(C.join(cry, "plant_crystal"))
    for o in out:
        if not o.data.uv_layers:
            C.box_uv(o, 1.0)
        print(o.name, C.tris(o))
    C.export("sh_glowplants")


# =============================================================================== exit gate
def make_gate():
    C.reset()
    M = mats()
    objs = []
    for sx in (-1.7, 1.7):
        objs.append(C.box_obj(f"pillar{sx}", (0.8, 0.8, 3.3), (sx, 0, 1.65), M["stone"], bevel=0.06, uv_scale=0.45, noise_amp=0.015, seed=int(sx * 10)))
        objs.append(C.box_obj(f"cap{sx}", (1.0, 1.0, 0.22), (sx, 0, 3.4), M["stone"], bevel=0.05, uv_scale=0.45))
        objs.append(C.box_obj(f"foot{sx}", (1.05, 1.05, 0.3), (sx, 0, 0.15), M["stone"], bevel=0.05, uv_scale=0.45))
        objs += lamp_head(f"gl{sx}", (sx, 0, 3.52), M, 1.4)
    objs.append(S.torus_obj("ring", 1.45, 0.14, M["brass"], loc=(0, 0, 1.9), rot=(PI / 2, 0, 0), seg=40, rseg=8))
    objs.append(S.torus_obj("ring2", 1.25, 0.05, M["copper"], loc=(0, 0, 1.9), rot=(PI / 2, 0, 0), seg=40, rseg=5))
    for k in range(8):
        a = k / 8 * PI * 2
        objs.append(S.sphere(f"rivet{k}", 0.07, (math.cos(a) * 1.45, -0.14, 1.9 + math.sin(a) * 1.45), M["brass"], segs=6, rings=4))
    # portal disc (separate, the game swirls it)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    ctr = bm.verts.new((0, 0, 1.9))
    ring = [bm.verts.new((math.cos(a) * 1.35, 0, 1.9 + math.sin(a) * 1.35)) for a in [k / 32 * PI * 2 for k in range(32)]]
    for k in range(32):
        f = bm.faces.new((ctr, ring[k], ring[(k + 1) % 32]))
        for loop in f.loops:
            co = loop.vert.co
            loop[uvl].uv = (0.5 + co.x / 2.7, 0.5 + (co.z - 1.9) / 2.7)
    objs.append(C.new_obj("portal", bm, [M["portal"]]))
    # arch beam and round sign showing the Idea Grove (tree + lanterns)
    objs.append(C.box_obj("lintel", (4.3, 0.5, 0.3), (0, 0, 3.75), M["wood"], bevel=0.04, uv_scale=0.6))
    sign = S.lathe_obj("sign", [(0.0, -0.06), (0.55, -0.06), (0.55, 0.06), (0.0, 0.06)], M["sign"], segs=24, rot=(PI / 2, 0, 0), loc=(0, -0.3, 4.25))
    me = sign.data
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            me.uv_layers.active.data[li].uv = (0.5 + co.x / 1.15, 0.5 + co.y / 1.15)
    objs.append(sign)
    objs.append(S.torus_obj("sign_ring", 0.57, 0.05, M["brass"], loc=(0, -0.3, 4.25), rot=(PI / 2, 0, 0), seg=24, rseg=5))
    # steps in front
    objs.append(C.box_obj("step", (3.2, 1.2, 0.16), (0, 0, 0.08), M["stone"], bevel=0.04, uv_scale=0.5))
    for o in objs:
        if o.type == "MESH" and not o.data.uv_layers:
            C.box_uv(o, 1.0)
    S.group("gate", objs)
    C.export("sh_gate")


ALL = {"observatory": make_observatory, "airship": make_airship, "greenhouse": make_greenhouse, "workshop": make_workshop,
       "robot": make_robot, "harbor": make_harbor, "cliff": make_cliff, "glowplants": make_glowplants, "gate": make_gate}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for n in argv or list(ALL):
        ALL[n]()
