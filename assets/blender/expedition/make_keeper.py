"""The Grove Keeper: a kind old naturalist who stands by the Idea Tree and gives the expedition quests.

OW_TEX=<tex> OW_OUT=<glb> blender -b --factory-startup -P make_keeper.py
Same construction and shading as the kid avatar (../make_avatar.py): sculpted parts skinned rigidly to
one bone each, painted fabric/skin textures tinted per material. About 1.72 m to the hat top, faces -Y
in Blender (+Z in glTF), feet at the origin. Wide-brim explorer hat, round glasses, white hair and
brows, olive field vest with pockets, rolled sleeves, leather satchel, binoculars, neckerchief.
Clips: idle, wave, talk, point.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import xrig as R  # noqa: E402
from xrig import C, Cs, S, X, Y, Z, smooth_pts, smoothstep, tint_mat  # noqa: E402

V = Vector
C.reset()


def fabric(name, color, tex="fabric.jpg", rough=0.85):
    return tint_mat(C.material(name, tex=tex, rough=rough), color)


M = {
    "skin": fabric("skin", (0.9, 0.7, 0.56), tex="skin.jpg", rough=0.6),
    "hair": fabric("hair", (0.93, 0.92, 0.9), rough=0.6),
    "shirt": fabric("shirt", (0.82, 0.74, 0.55)),
    "vest": fabric("vest", (0.42, 0.5, 0.3)),
    "pants": fabric("pants", (0.4, 0.29, 0.2)),
    "boots": fabric("boots", (0.75, 0.62, 0.5), tex="leather.jpg", rough=0.55),
    "hat": fabric("hat", (0.86, 0.74, 0.52), tex="canvas.jpg", rough=0.8),
    "band": fabric("hat_band", (0.45, 0.3, 0.2), rough=0.7),
    "bag": fabric("bag", (0.95, 0.8, 0.65), tex="leather.jpg", rough=0.6),
    "scarf": fabric("scarf", (0.9, 0.42, 0.25)),
    "brass": C.material("brass", tex="brass.jpg", rough=0.35, metal=0.8),
    "dark": C.material("binocular_body", color=(0.12, 0.11, 0.1), rough=0.5),
    "glass": C.material("lens_glass", color=(0.55, 0.75, 0.85), rough=0.05, emissive=(0.3, 0.45, 0.55), emissive_strength=0.25),
    "eyes": C.material("eyes", color=(0.12, 0.08, 0.05), rough=0.15),
    "white": C.material("eye_light", color=(1, 1, 1), emissive=(1, 1, 1), emissive_strength=0.6, rough=0.2),
    "mouth": C.material("mouth", color=(0.45, 0.14, 0.12), rough=0.6),
    "cheek": C.material("cheek", color=(0.95, 0.55, 0.5), rough=0.7),
    "leaf": C.material("hat_leaf", color=(0.35, 0.65, 0.28), rough=0.6),
}
parts = []


def add(ob, bone):
    parts.append((ob, bone))
    return ob


def ell(name, mat, ctr, rad, bone, segs=20, rings=12, fn=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0, calc_uvs=True)
    for v in bm.verts:
        u = V(v.co)
        p = V((u.x * rad[0], u.y * rad[1], u.z * rad[2]))
        if fn:
            p += fn(u)
        v.co = p + V(ctr)
    ob = C.new_obj(name, bm, [M[mat]])
    C.shade_smooth(ob)
    return add(ob, bone)


def limb(name, mat, pts, rads, bone, sides=14):
    bm = bmesh.new()
    C.tube(bm, [V(p) for p in pts], rads, sides=sides, v_scale=2, u_repeat=1, cap_end=True)
    ob = C.new_obj(name, bm, [M[mat]])
    C.shade_smooth(ob)
    return add(ob, bone)


def lathe(name, mat, prof, bone, loc=(0, 0, 0), segs=24, sy=1.0, cut_front=None):
    bm = bmesh.new()
    C.lathe(bm, prof, segs=segs, v_scale=2)
    for v in bm.verts:
        v.co.y *= sy
    if cut_front:  # open the front (a vest): drop faces facing -Y within the angle
        kill = [f for f in bm.faces if f.calc_center_median().y < 0 and abs(math.atan2(f.calc_center_median().x, -f.calc_center_median().y)) < cut_front]
        bmesh.ops.delete(bm, geom=kill, context="FACES")
    ob = C.new_obj(name, bm, [M[mat]])
    ob.location = loc
    C.shade_smooth(ob)
    if cut_front:  # give the open vest some thickness
        md = ob.modifiers.new("solid", "SOLIDIFY")
        md.thickness = 0.012
        md.offset = 1.0
        C.apply_all(ob)
    return add(ob, bone)


def torus(name, mat, ctr, R0, r, bone, axis="Z", segs=24, ring=8, sy=1.0):
    bm = bmesh.new()
    for i in range(segs):
        for j in range(ring):
            a, b = i / segs * math.pi * 2, j / ring * math.pi * 2
            p = V(((R0 + r * math.cos(b)) * math.cos(a), (R0 + r * math.cos(b)) * math.sin(a) * sy, r * math.sin(b)))
            bm.verts.new(p)
    bm.verts.ensure_lookup_table()
    for i in range(segs):
        for j in range(ring):
            a = i * ring + j
            b = ((i + 1) % segs) * ring + j
            c = ((i + 1) % segs) * ring + (j + 1) % ring
            d = i * ring + (j + 1) % ring
            bm.faces.new((bm.verts[a], bm.verts[b], bm.verts[c], bm.verts[d]))
    ob = C.new_obj(name, bm, [M[mat]])
    if axis == "Y":
        ob.rotation_euler = (math.pi / 2, 0, 0)
    elif axis == "X":
        ob.rotation_euler = (0, math.pi / 2, 0)
    ob.location = ctr
    C.shade_smooth(ob)
    return add(ob, bone)


# ---------------------------------------------------------------- head (kind, round, smiling)
HZ = 1.5
ell("head", "skin", (0, 0, HZ), (0.148, 0.142, 0.158), "head", segs=26, rings=16)
for s, x in (("l", 1), ("r", -1)):
    ell("ear_" + s, "skin", (x * 0.147, 0.005, HZ - 0.01), (0.026, 0.04, 0.05), "head", segs=10, rings=6)
ell("nose", "skin", (0, -0.152, HZ - 0.03), (0.032, 0.03, 0.03), "head", segs=12, rings=8)
for s, x in (("l", 0.055), ("r", -0.055)):
    ell("eye_" + s, "eyes", (x, -0.13, HZ + 0.015), (0.021, 0.014, 0.026), "head", segs=12, rings=8)
    ell("eyel_" + s, "white", (x + 0.007, -0.142, HZ + 0.026), (0.007, 0.005, 0.008), "head", segs=8, rings=4)
    ell("cheek_" + s, "cheek", (x * 1.6, -0.12, HZ - 0.04), (0.03, 0.012, 0.02), "head", segs=10, rings=6)
    # bushy white brows, kindly arched
    ell("brow_" + s, "hair", (x * 1.05, -0.135, HZ + 0.06), (0.036, 0.016, 0.013), "head", segs=10, rings=6,
        fn=lambda u, x=x: V((0, 0, -0.012 * (u.x * (1 if x > 0 else -1)) ** 2 - 0.004 * u.x * (1 if x > 0 else -1))))
    # smile crinkles
    bm = bmesh.new()
    sx = 1 if x > 0 else -1
    C.tube(bm, [V((x + sx * 0.035, -0.12, HZ + 0.005)), V((x + sx * 0.045, -0.112, HZ - 0.008))], [0.003, 0.002], sides=4)
    add(C.new_obj("crinkle_" + s, bm, [M["mouth"]]), "head")
bm = bmesh.new()
C.tube(bm, [V((math.sin(t) * 0.042, -0.142, HZ - 0.085 + (1 - math.cos(t)) * 0.05)) for t in [(-0.9 + i * 0.3) for i in range(7)]], [0.006] * 7, sides=6,
       u_repeat=1)
add(C.new_obj("mouth", bm, [M["mouth"]]), "head")
# round glasses
for s, x in (("l", 0.055), ("r", -0.055)):
    torus("glasses_" + s, "brass", (x, -0.148, HZ + 0.015), 0.036, 0.0045, "head", axis="Y", segs=20, ring=6)
limb("glasses_bridge", "brass", [(0.02, -0.153, HZ + 0.025), (0, -0.158, HZ + 0.03), (-0.02, -0.153, HZ + 0.025)], [0.004] * 3, "head", sides=5)
for x in (1, -1):
    limb("glasses_arm", "brass", [(x * 0.09, -0.145, HZ + 0.02), (x * 0.14, -0.07, HZ + 0.02), (x * 0.148, 0.0, HZ + 0.01)], [0.004] * 3, "head", sides=5)
# white hair: soft puffs at the sides and back under the hat, a little bun at the nape
for i, (x, y, z, s) in enumerate(((0.12, 0.02, 0.04, 0.06), (-0.12, 0.02, 0.04, 0.06), (0.1, 0.08, 0.0, 0.065), (-0.1, 0.08, 0.0, 0.065),
                                  (0.0, 0.11, 0.02, 0.08), (0.05, 0.11, -0.04, 0.06), (-0.05, 0.11, -0.04, 0.06), (0.0, 0.15, -0.08, 0.05))):
    ell(f"hair{i}", "hair", (x, y, HZ + z), (s, s * 0.85, s * 0.8), "head", segs=12, rings=8,
        fn=lambda u: u * 0.012 * C.fbm(u * 3 + V((i, 0, 0)), 2))
# explorer hat: dented crown, wide brim with upturned edge, band and a leaf pin
lathe("hat_crown", "hat", [(0.0, 0.0), (0.155, 0.0), (0.158, 0.05), (0.15, 0.1), (0.13, 0.135), (0.07, 0.15), (0.0, 0.14)], "head",
      loc=(0, 0.01, HZ + 0.09), segs=28, sy=1.08)
lathe("hat_brim", "hat", [(0.15, 0.012), (0.2, 0.004), (0.26, -0.002), (0.31, 0.008), (0.325, 0.03), (0.318, 0.036), (0.3, 0.018),
                          (0.25, 0.008), (0.2, 0.014), (0.15, 0.022)], "head", loc=(0, 0.01, HZ + 0.09), segs=36, sy=1.05)
lathe("hat_band", "band", [(0.159, 0.012), (0.161, 0.045), (0.155, 0.046)], "head", loc=(0, 0.01, HZ + 0.09), segs=28, sy=1.08)
for k, a in enumerate((0.0, 0.5)):
    ell(f"hat_leaf{k}", "leaf", (0.15, -0.06 + k * 0.03, HZ + 0.15 + k * 0.01), (0.012, 0.035, 0.008), "head", segs=10, rings=6,
        fn=lambda u, a=a: V((0, 0, 0.012 * u.y * u.y)))

# ---------------------------------------------------------------- body
limb("neck", "skin", [(0, 0, 1.3), (0, 0, 1.38)], [0.058, 0.055], "chest", sides=12)
# neckerchief knot
torus("scarf", "scarf", (0, 0, 1.33), 0.062, 0.022, "chest", segs=20, ring=8)
ell("scarf_knot", "scarf", (0, -0.075, 1.31), (0.03, 0.022, 0.028), "chest", segs=10, rings=6)
for x in (1, -1):
    ell("scarf_tail", "scarf", (x * 0.02, -0.08, 1.26), (0.018, 0.01, 0.04), "chest", segs=8, rings=6)
# shirt torso (gentle round belly) and the open olive vest over it
lathe("torso", "shirt", [(0.0, 0.86), (0.17, 0.86), (0.19, 0.95), (0.195, 1.06), (0.19, 1.17), (0.18, 1.24), (0.14, 1.3), (0.06, 1.33), (0.0, 1.335)],
      "chest", sy=0.8)
lathe("vest", "vest", [(0.182, 0.88), (0.2, 0.96), (0.205, 1.06), (0.2, 1.17), (0.19, 1.24), (0.155, 1.3), (0.1, 1.325)], "chest", sy=0.82,
      cut_front=0.32)
for x in (1, -1):
    C.box_obj("pocket", (0.09, 0.03, 0.085), (x * 0.1, -0.17, 1.0), M["vest"], bevel=0.012, segments=2, uv_scale=2)
    add(bpy.data.objects[bpy.context.view_layer.objects.active.name if False else "pocket"], "chest")
    bpy.data.objects["pocket"].name = "pocket_done"
    C.box_obj("flap", (0.095, 0.035, 0.03), (x * 0.1, -0.178, 1.045), M["vest"], bevel=0.01, segments=2, uv_scale=2)
    add(bpy.data.objects["flap"], "chest")
    bpy.data.objects["flap"].name = "flap_done"
    C.box_obj("chest_pocket", (0.07, 0.025, 0.06), (x * 0.12, -0.155, 1.18), M["vest"], bevel=0.01, segments=2, uv_scale=2)
    add(bpy.data.objects["chest_pocket"], "chest")
    bpy.data.objects["chest_pocket"].name = "chest_pocket_done"
# a pencil in the chest pocket
limb("pencil", "hat_band" if False else "brass", [(0.135, -0.16, 1.2), (0.14, -0.162, 1.27)], [0.006, 0.006], "chest", sides=6)
# belt + buckle
lathe("belt", "band", [(0.178, 0.84), (0.182, 0.88), (0.176, 0.885)], "hips", sy=0.82, segs=28)
C.box_obj("buckle", (0.05, 0.014, 0.04), (0, -0.148, 0.862), M["brass"], bevel=0.006, segments=2)
add(bpy.data.objects["buckle"], "hips")
lathe("hips_pants", "pants", [(0.0, 0.72), (0.17, 0.72), (0.178, 0.8), (0.176, 0.87), (0.0, 0.87)], "hips", sy=0.84)
# satchel on the right hip, strap over the left shoulder
C.box_obj("satchel", (0.2, 0.08, 0.17), (-0.2, -0.02, 0.84), M["bag"], rot=(0, 0, 0.25), bevel=0.03, segments=3, uv_scale=2)
add(bpy.data.objects["satchel"], "hips")
C.box_obj("satchel_flap", (0.205, 0.088, 0.085), (-0.2, -0.026, 0.9), M["bag"], rot=(0, 0, 0.25), bevel=0.025, segments=3, uv_scale=2)
add(bpy.data.objects["satchel_flap"], "hips")
C.box_obj("satchel_clasp", (0.03, 0.01, 0.03), (-0.21, -0.07, 0.88), M["brass"], rot=(0, 0, 0.25), bevel=0.005, segments=2)
add(bpy.data.objects["satchel_clasp"], "hips")
strap = [V((0.13, -0.11, 1.29)), V((0.12, 0.0, 1.335)), V((0.1, 0.13, 1.25)), V((-0.05, 0.16, 1.05)), V((-0.2, 0.06, 0.92)),
         V((-0.21, -0.16, 1.02)), V((-0.02, -0.19, 1.17)), V((0.13, -0.11, 1.29))]
limb("satchel_strap", "bag", smooth_pts(strap, 4), [0.014] * (len(strap) - 1) * 4 + [0.014], "chest", sides=6)
# binoculars on a cord, resting on the chest
for x in (1, -1):
    limb("binocular_tube", "dark", [(x * 0.035, -0.17, 1.15), (x * 0.035, -0.205, 1.2)], [0.03, 0.026], "chest", sides=14)
    torus("binocular_rim", "brass", (x * 0.035, -0.205, 1.2), 0.025, 0.006, "chest", axis="Y", segs=16, ring=6)
    limb("binocular_eye", "dark", [(x * 0.035, -0.205, 1.2), (x * 0.035, -0.215, 1.215)], [0.02, 0.02], "chest", sides=12)
C.box_obj("binocular_bridge", (0.04, 0.02, 0.03), (0, -0.19, 1.18), M["brass"], bevel=0.006, segments=2)
add(bpy.data.objects["binocular_bridge"], "chest")
limb("binocular_cord", "band", smooth_pts([(0.06, -0.17, 1.2), (0.09, -0.12, 1.3), (0.0, 0.03, 1.36), (-0.09, -0.12, 1.3), (-0.06, -0.17, 1.2)], 3),
     [0.005] * 13, "chest", sides=4)

# ---------------------------------------------------------------- arms (rolled sleeves) and hands
SH = 1.25
for s, side in ((1, "L"), (-1, "R")):
    ell("shoulder" + side, "shirt", (s * 0.19, 0, SH), (0.07, 0.07, 0.07), "upper_arm." + side, segs=12, rings=8)
    limb("sleeve" + side, "shirt", [(s * 0.19, 0, SH), (s * 0.215, 0, 1.05)], [0.062, 0.055], "upper_arm." + side)
    torus("cuff" + side, "shirt", (s * 0.216, 0, 1.04), 0.05, 0.016, "upper_arm." + side, segs=16, ring=6)
    ell("elbow" + side, "skin", (s * 0.217, 0, 1.03), (0.042, 0.042, 0.042), "forearm." + side, segs=10, rings=6)
    limb("forearm" + side, "skin", [(s * 0.217, 0, 1.03), (s * 0.228, -0.01, 0.84)], [0.042, 0.035], "forearm." + side)
    # hand: palm mitten, thumb, and an index finger (for pointing)
    ell("hand" + side, "skin", (s * 0.232, -0.012, 0.79), (0.03, 0.042, 0.055), "hand." + side, segs=12, rings=8)
    ell("fingers" + side, "skin", (s * 0.234, -0.008, 0.735), (0.027, 0.036, 0.03), "hand." + side, segs=10, rings=6)
    ell("thumb" + side, "skin", (s * 0.225, -0.05, 0.795), (0.015, 0.015, 0.03), "hand." + side, segs=8, rings=5)
    limb("index" + side, "skin", [(s * 0.232, -0.035, 0.76), (s * 0.233, -0.04, 0.705)], [0.012, 0.01], "hand." + side, sides=8)
    # legs: trousers, knee, boots with a turned cuff
    hx = s * 0.095
    limb("thigh" + side, "pants", [(hx, 0, 0.8), (hx, 0, 0.47)], [0.08, 0.068], "thigh." + side)
    ell("knee" + side, "pants", (hx, 0, 0.46), (0.066, 0.066, 0.055), "shin." + side, segs=12, rings=8)
    limb("shin" + side, "pants", [(hx, 0, 0.47), (hx, 0, 0.17)], [0.064, 0.058], "shin." + side)
    lathe("boot_top" + side, "boots", [(0.062, 0.1), (0.066, 0.2), (0.07, 0.21), (0.0, 0.21)], "shin." + side, loc=(hx, 0, 0), segs=16)
    ell("boot" + side, "boots", (hx, -0.04, 0.06), (0.068, 0.12, 0.065), "shin." + side, segs=16, rings=10)
    C.box_obj("sole" + side, (0.13, 0.25, 0.026), (hx, -0.04, 0.013), M["band"], bevel=0.01, segments=2, uv_scale=2)
    add(bpy.data.objects["sole" + side], "shin." + side)

# ---------------------------------------------------------------- rig (same bone names as the kid, plus chest and hands)
rig = R.Rig("keeper")
rig.bone("root", (0, 0, 0), (0, 0, 0.25))
rig.bone("hips", (0, 0, 0.8), (0, 0, 0.92), "root")
rig.bone("spine", (0, 0, 0.92), (0, 0, 1.08), "hips")
rig.bone("chest", (0, 0, 1.08), (0, 0, 1.33), "spine")
rig.bone("head", (0, 0, 1.36), (0, 0, 1.72), "chest")
for s, side in ((1, "L"), (-1, "R")):
    rig.bone("upper_arm." + side, (s * 0.19, 0, SH), (s * 0.217, 0, 1.03), "chest")
    rig.bone("forearm." + side, (s * 0.217, 0, 1.03), (s * 0.23, -0.01, 0.83), "upper_arm." + side)
    rig.bone("hand." + side, (s * 0.23, -0.01, 0.83), (s * 0.234, -0.03, 0.7), "forearm." + side)
    rig.bone("thigh." + side, (s * 0.095, 0, 0.8), (s * 0.095, 0, 0.47), "hips")
    rig.bone("shin." + side, (s * 0.095, 0, 0.47), (s * 0.095, 0, 0.08), "thigh." + side)
for ob, bn in parts:
    if ob.name in bpy.data.objects:
        rig.add(ob, bn)
# spine-weighted vest/torso parts move with chest; give the lower shirt to the spine
rig.build()
print("keeper tris:", C.tris(rig.body))


# ---------------------------------------------------------------- clips
def rest_arms(t, amp=1.0):
    return {"upper_arm.L": {"rot": [(Y, -0.1 - 0.02 * S(t) * amp)]}, "upper_arm.R": {"rot": [(Y, 0.1 + 0.02 * S(t) * amp)]},
            "forearm.L": {"rot": [(X, -0.18)]}, "forearm.R": {"rot": [(X, -0.18)]}}


def idle(t):
    p = rest_arms(t)
    p["chest"] = {"rot": [(X, 0.02 * S(t))], "scale": 1 + 0.01 * S(t)}
    p["head"] = {"rot": [(Z, 0.12 * S(t, 1, 0.15)), (X, 0.03 * S(t, 2))]}
    p["hips"] = {"rot": [(Y, 0.012 * S(t))]}
    return p


rig.clip("idle", 120, idle)


def wave(t):
    p = idle(t)
    e = smoothstep(0.0, 0.18, t) * (1 - smoothstep(0.82, 1.0, t))
    p["upper_arm.R"] = {"rot": [(Y, 0.1 + 2.3 * e), (X, -0.25 * e)]}
    p["forearm.R"] = {"rot": [(Y, 0.45 * S(t, 3) * e), (X, -0.2 * e)]}
    p["hand.R"] = {"rot": [(Y, 0.2 * S(t, 3, -0.1) * e)]}
    p["head"] = {"rot": [(Z, -0.12 * e), (Y, 0.08 * e)]}
    p["chest"] = {"rot": [(Y, 0.05 * e)]}
    return p


rig.clip("wave", 60, wave, step=1)


def talk(t):
    p = idle(t)
    a, b = max(0.0, S(t, 2)), max(0.0, S(t, 2, 0.5))
    p["upper_arm.L"] = {"rot": [(Y, -0.2 - 0.15 * a), (X, -0.35 * a)]}
    p["forearm.L"] = {"rot": [(X, -0.9 - 0.4 * a), (Z, 0.3 * a)]}
    p["hand.L"] = {"rot": [(Y, -0.3 * a)]}
    p["upper_arm.R"] = {"rot": [(Y, 0.2 + 0.15 * b), (X, -0.35 * b)]}
    p["forearm.R"] = {"rot": [(X, -0.9 - 0.4 * b), (Z, -0.3 * b)]}
    p["hand.R"] = {"rot": [(Y, 0.3 * b)]}
    p["head"] = {"rot": [(X, 0.08 * S(t, 4)), (Z, 0.12 * S(t, 1))]}
    p["chest"] = {"rot": [(Z, 0.06 * S(t, 1)), (X, 0.03 * S(t, 2))]}
    return p


rig.clip("talk", 96, talk)


def point(t):
    p = idle(t)
    e = smoothstep(0.0, 0.2, t) * (1 - smoothstep(0.8, 1.0, t))
    p["upper_arm.R"] = {"rot": [(X, -1.35 * e), (Z, 0.35 * e), (Y, 0.1 + 0.05 * e)]}
    p["forearm.R"] = {"rot": [(X, -0.05 * e)]}
    p["hand.R"] = {"rot": [(X, -0.15 * e)]}
    p["head"] = {"rot": [(Z, 0.3 * e), (X, -0.05 * e)]}
    p["chest"] = {"rot": [(Z, 0.12 * e)]}
    p["upper_arm.L"] = {"rot": [(Y, -0.12), (X, 0.1 * e)]}
    return p


rig.clip("point", 72, point)
rig.export(os.path.abspath(os.path.join(C.OUT, "keeper.glb")))
