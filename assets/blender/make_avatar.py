"""Kid avatar base for EdVerse OpenWorld: stylised child, rigged, with idle / walk / wave / cheer.

blender --background --factory-startup --python make_avatar.py
- Faces -Y in Blender (+Z in glTF), feet at the origin, about 1.3 m tall.
- Materials are named skin, hair, shirt, pants, shoes, bag, eyes, mouth: the game tints them per
  avatar preset (many looks from one base; no identity, preset parts only).
- Each body part is skinned rigidly to one bone; joints are hidden by rounded overlaps.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402

C.reset()
M = {
    "skin": C.material("skin", tex="skin.jpg", color=None, rough=0.6),
    "hair": C.material("hair", tex="fabric.jpg", rough=0.55),
    "shirt": C.material("shirt", tex="fabric.jpg", rough=0.85),
    "pants": C.material("pants", tex="fabric.jpg", rough=0.85),
    "shoes": C.material("shoes", tex="fabric.jpg", rough=0.6),
    "bag": C.material("bag", tex="fabric.jpg", rough=0.8),
    "eyes": C.material("eyes", color=(0.05, 0.04, 0.04), rough=0.15),
    "white": C.material("eye_light", color=(1, 1, 1), emissive=(1, 1, 1), emissive_strength=0.6, rough=0.2),
    "mouth": C.material("mouth", color=(0.45, 0.12, 0.1), rough=0.6),
    "cheek": C.material("cheek", color=(0.95, 0.55, 0.5), rough=0.7),
}
# neutral base tints (the game replaces them per preset)
for k, c in (("skin", (0.93, 0.74, 0.6)), ("hair", (0.28, 0.17, 0.1)), ("shirt", (0.95, 0.55, 0.25)), ("pants", (0.25, 0.32, 0.5)),
             ("shoes", (0.55, 0.3, 0.2)), ("bag", (0.35, 0.55, 0.35))):
    bsdf = M[k].node_tree.nodes["Principled BSDF"]
    # tint = texture x colour: put a Multiply between the texture and Base Color
    nt = M[k].node_tree
    tex_link = bsdf.inputs["Base Color"].links[0]
    src = tex_link.from_socket
    nt.links.remove(tex_link)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs[7].default_value = (*c, 1)
    nt.links.new(src, mix.inputs[6])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])

parts = []  # (object, bone)


def ellipsoid(name, mat, ctr, rad, bone, segs=20, rings=12, squash_bottom=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0, calc_uvs=True)
    for v in bm.verts:
        z = v.co.z
        if squash_bottom is not None and z < squash_bottom:
            z = squash_bottom + (z - squash_bottom) * 0.3
        v.co = Vector((v.co.x * rad[0], v.co.y * rad[1], z * rad[2]))
    ob = C.new_obj(name, bm, [M[mat]])
    ob.location = ctr
    C.shade_smooth(ob)
    parts.append((ob, bone))
    return ob


def limb(name, mat, a, b, ra, rb, bone, sides=14):
    bm = bmesh.new()
    a, b = Vector(a), Vector(b)
    pts = [a + (b - a) * t for t in (0, 0.25, 0.5, 0.75, 1)]
    rad = [ra + (rb - ra) * t for t in (0, 0.25, 0.5, 0.75, 1)]
    rad[0] *= 0.92
    C.tube(bm, pts, rad, sides=sides, v_scale=2, u_repeat=1, cap_end=True)
    ob = C.new_obj(name, bm, [M[mat]])
    C.shade_smooth(ob)
    parts.append((ob, bone))
    return ob


def lathe_part(name, mat, prof, bone, loc=(0, 0, 0), segs=20, sy=1.0):
    bm = bmesh.new()
    C.lathe(bm, prof, segs=segs, v_scale=2)
    for v in bm.verts:
        v.co.y *= sy
    ob = C.new_obj(name, bm, [M[mat]])
    ob.location = loc
    C.shade_smooth(ob)
    parts.append((ob, bone))
    return ob


# ---------------------------------------------------------------- body
HEAD_Z = 1.13
ellipsoid("head", "skin", (0, 0, HEAD_Z), (0.185, 0.175, 0.19), "head", segs=24, rings=16)
ellipsoid("ear_l", "skin", (0.18, 0.0, HEAD_Z - 0.01), (0.03, 0.045, 0.05), "head", segs=10, rings=6)
ellipsoid("ear_r", "skin", (-0.18, 0.0, HEAD_Z - 0.01), (0.03, 0.045, 0.05), "head", segs=10, rings=6)
ellipsoid("nose", "skin", (0, -0.172, HEAD_Z - 0.03), (0.022, 0.02, 0.02), "head", segs=10, rings=6)
for s, x in (("l", 0.068), ("r", -0.068)):
    ellipsoid("eye_" + s, "eyes", (x, -0.158, HEAD_Z + 0.015), (0.03, 0.02, 0.04), "head", segs=12, rings=8)
    ellipsoid("eyel_" + s, "white", (x + 0.01, -0.175, HEAD_Z + 0.03), (0.009, 0.006, 0.011), "head", segs=8, rings=4)
    ellipsoid("cheek_" + s, "cheek", (x * 1.45, -0.148, HEAD_Z - 0.045), (0.03, 0.012, 0.018), "head", segs=10, rings=6)
# smile
bm = bmesh.new()
pts = [Vector((math.sin(t) * 0.045, -0.172 - 0.0 * t, HEAD_Z - 0.085 + (1 - math.cos(t)) * 0.06)) for t in [(-0.9 + i * 0.3) for i in range(7)]]
C.tube(bm, pts, [0.007] * 7, sides=6, u_repeat=1)
mouth = C.new_obj("mouth", bm, [M["mouth"]])
parts.append((mouth, "head"))
# hair: a cap over the top/back plus a few soft tufts
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=1.0, calc_uvs=True)
for v in bm.verts:
    n = v.co.copy()
    front = n.y < -0.2 and n.z < 0.55
    z = n.z
    if z < 0.05 and n.y < 0.3:
        z = 0.05 + (z - 0.05) * 0.15  # cut above the face, longer at the back
    if front:
        z = max(z, 0.35 + 0.1 * math.sin(n.x * 12))
    r = 1.0 + 0.06 * C.fbm(n * 3.0, 2)
    v.co = Vector((n.x * 0.2 * r, n.y * 0.195 * r, z * 0.205 * r))
hair = C.new_obj("hair", bm, [M["hair"]])
hair.location = (0, 0.008, HEAD_Z + 0.015)
C.shade_smooth(hair)
parts.append((hair, "head"))
for i, (x, y, z, s) in enumerate(((0.06, -0.12, 0.16, 0.06), (-0.05, -0.13, 0.15, 0.055), (0.0, -0.05, 0.2, 0.07), (0.12, 0.02, 0.14, 0.05), (-0.12, 0.03, 0.14, 0.05))):
    ellipsoid(f"tuft{i}", "hair", (x, y, HEAD_Z + z), (s, s * 0.9, s * 0.7), "head", segs=10, rings=6)
limb("neck", "skin", (0, 0, 0.9), (0, 0, 0.98), 0.05, 0.048, "spine", sides=12)
# torso: shirt with a rounded chest and belly
lathe_part("torso", "shirt", [(0.0, 0.6), (0.15, 0.6), (0.165, 0.66), (0.17, 0.78), (0.165, 0.86), (0.14, 0.92), (0.07, 0.96), (0.0, 0.965)], "spine", sy=0.82)
lathe_part("shorts", "pants", [(0.0, 0.5), (0.155, 0.5), (0.168, 0.56), (0.165, 0.66), (0.0, 0.66)], "hips", sy=0.85)
# backpack
C.box_obj("bag_body", (0.24, 0.11, 0.27), (0, 0.17, 0.78), M["bag"], bevel=0.04, segments=3, uv_scale=2)
parts.append((bpy.data.objects["bag_body"], "spine"))
C.box_obj("bag_pocket", (0.17, 0.05, 0.11), (0, 0.235, 0.72), M["bag"], bevel=0.02, segments=2, uv_scale=2)
parts.append((bpy.data.objects["bag_pocket"], "spine"))
for s in (1, -1):
    bm = bmesh.new()
    pts = [Vector((s * 0.09, 0.16, 0.9)), Vector((s * 0.1, 0.05, 0.96)), Vector((s * 0.11, -0.12, 0.9)), Vector((s * 0.11, -0.14, 0.75)), Vector((s * 0.1, 0.0, 0.66)), Vector((s * 0.09, 0.14, 0.68))]
    C.tube(bm, pts, [0.016] * len(pts), sides=6, u_repeat=1)
    st = C.new_obj("strap", bm, [M["bag"]])
    parts.append((st, "spine"))
# arms: sleeve, forearm, hand
SH = 0.89
for s, side in ((1, "L"), (-1, "R")):
    ellipsoid("shoulder" + side, "shirt", (s * 0.165, 0, SH), (0.065, 0.065, 0.065), "upper_arm." + side, segs=12, rings=8)
    limb("sleeve" + side, "shirt", (s * 0.17, 0, SH), (s * 0.2, 0, 0.72), 0.058, 0.052, "upper_arm." + side)
    ellipsoid("elbow" + side, "skin", (s * 0.2, 0, 0.715), (0.04, 0.04, 0.04), "forearm." + side, segs=10, rings=6)
    limb("forearm" + side, "skin", (s * 0.2, 0, 0.72), (s * 0.215, -0.01, 0.56), 0.04, 0.034, "forearm." + side)
    ellipsoid("hand" + side, "skin", (s * 0.218, -0.015, 0.52), (0.042, 0.035, 0.05), "forearm." + side, segs=12, rings=8)
    ellipsoid("thumb" + side, "skin", (s * 0.205, -0.045, 0.535), (0.015, 0.015, 0.025), "forearm." + side, segs=8, rings=5)
    # legs: trouser leg + knee + shin + shoe
    hx = s * 0.085
    limb("thigh" + side, "pants", (hx, 0, 0.58), (hx, 0, 0.34), 0.07, 0.06, "thigh." + side)
    ellipsoid("knee" + side, "pants", (hx, 0, 0.33), (0.058, 0.058, 0.05), "shin." + side, segs=12, rings=8)
    limb("shin" + side, "pants", (hx, 0, 0.34), (hx, 0, 0.1), 0.057, 0.05, "shin." + side)
    ellipsoid("sock" + side, "skin", (hx, 0, 0.1), (0.045, 0.045, 0.03), "shin." + side, segs=10, rings=6)
    ellipsoid("shoe" + side, "shoes", (hx, -0.035, 0.045), (0.06, 0.105, 0.055), "shin." + side, segs=16, rings=10, squash_bottom=-0.5)
    C.box_obj("sole" + side, (0.115, 0.205, 0.022), (hx, -0.035, 0.011), M["shoes"], bevel=0.008, segments=2, uv_scale=2)
    parts.append((bpy.data.objects["sole" + side], "shin." + side))

# ---------------------------------------------------------------- armature
arm_data = bpy.data.armatures.new("rig")
rig = bpy.data.objects.new("kid_rig", arm_data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones


def bone(name, head, tail, parent=None):
    b = eb.new(name)
    b.head = head
    b.tail = tail
    b.roll = 0
    if parent:
        b.parent = eb[parent]
    return b


bone("root", (0, 0, 0), (0, 0, 0.25))
bone("hips", (0, 0, 0.56), (0, 0, 0.66), "root")
bone("spine", (0, 0, 0.66), (0, 0, 0.95), "hips")
bone("head", (0, 0, 0.98), (0, 0, 1.3), "spine")
for s, side in ((1, "L"), (-1, "R")):
    bone("upper_arm." + side, (s * 0.17, 0, SH), (s * 0.2, 0, 0.72), "spine")
    bone("forearm." + side, (s * 0.2, 0, 0.72), (s * 0.218, 0, 0.52), "upper_arm." + side)
    bone("thigh." + side, (s * 0.085, 0, 0.58), (s * 0.085, 0, 0.34), "hips")
    bone("shin." + side, (s * 0.085, 0, 0.34), (s * 0.085, 0, 0.06), "thigh." + side)
bpy.ops.object.mode_set(mode="OBJECT")

# ---------------------------------------------------------------- skin: rigid vertex groups, join
for ob, bn in parts:
    vg = ob.vertex_groups.new(name=bn)
    vg.add(list(range(len(ob.data.vertices))), 1.0, "REPLACE")
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ob.select_set(False)
body = C.join([p[0] for p in parts], "kid")
md = body.modifiers.new("rig", "ARMATURE")
md.object = rig
body.parent = rig
print("kid tris:", C.tris(body))

# ---------------------------------------------------------------- animation
pb = rig.pose.bones
for b in pb:
    b.rotation_mode = "XYZ"


def tail_after(bn, axis, angle):
    b = pb[bn]
    old = b.rotation_euler.copy()
    e = [0, 0, 0]
    e[axis] = angle
    b.rotation_euler = e
    bpy.context.view_layer.update()
    t = rig.matrix_world @ b.tail
    b.rotation_euler = old
    bpy.context.view_layer.update()
    return t


# calibrate: which sign swings a leg forward (-Y), which axis/sign raises an arm sideways
FWD = 1 if tail_after("thigh.L", 0, 0.5).y < 0 else -1
ARM_FWD = 1 if tail_after("upper_arm.L", 0, 0.5).y < 0 else -1
KNEE = 1 if tail_after("shin.L", 0, 0.6).y > 0 else -1  # knees bend backward
ELB = 1 if tail_after("forearm.L", 0, 0.6).y < 0 else -1  # elbows bend forward
raise_axis, raise_sign = 2, 1
best = -9
for ax in (0, 1, 2):
    for sg in (1, -1):
        t = tail_after("upper_arm.L", ax, sg * 1.2)
        score = t.x + t.z
        if score > best:
            best, raise_axis, raise_sign = score, ax, sg
print("calib", FWD, ARM_FWD, KNEE, ELB, raise_axis, raise_sign)
FPS = 24
bpy.context.scene.render.fps = FPS


def key(bn, frame, rot=None, loc=None):
    b = pb[bn]
    if rot is not None:
        b.rotation_euler = rot
        b.keyframe_insert("rotation_euler", frame=frame)
    if loc is not None:
        b.location = loc
        b.keyframe_insert("location", frame=frame)


def arm_side(side, ang):
    e = [0, 0, 0]
    e[raise_axis] = raise_sign * ang * (1 if side == "L" else -1)
    return e


def rest_all(frame):
    for b in pb:
        key(b.name, frame, rot=(0, 0, 0), loc=(0, 0, 0))


actions = []


def new_action(name):
    act = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = act
    actions.append(act)
    return act


# idle: breathing, gentle arm sway, a look around
new_action("idle")
N = 72
for f in range(0, N + 1, 6):
    t = f / N * math.pi * 2
    key("spine", f, rot=(0.03 * math.sin(t) * FWD, 0, 0))
    key("head", f, rot=(0.04 * math.sin(t + 1) * FWD, 0, 0.12 * math.sin(t * 0.5)))
    key("root", f, loc=(0, 0.006 * math.sin(t), 0))
    for side in ("L", "R"):
        r = arm_side(side, 0.12 + 0.03 * math.sin(t))
        key("upper_arm." + side, f, rot=r)
        key("forearm." + side, f, rot=(ELB * 0.15, 0, 0))
        key("thigh." + side, f, rot=(0, 0, 0))
        key("shin." + side, f, rot=(0, 0, 0))

# walk: 20-frame stride
new_action("walk")
N = 20
for f in range(0, N + 1, 2):
    t = f / N * math.pi * 2
    s = math.sin(t)
    key("root", f, loc=(0, 0.03 * abs(math.cos(t)), 0))
    key("hips", f, rot=(0, 0, 0.08 * s))
    key("spine", f, rot=(0.06 * FWD, 0, -0.12 * s))
    key("head", f, rot=(-0.04 * FWD, 0, 0.06 * s))
    key("thigh.L", f, rot=(FWD * 0.55 * s, 0, 0))
    key("thigh.R", f, rot=(-FWD * 0.55 * s, 0, 0))
    key("shin.L", f, rot=(KNEE * 0.7 * max(0.0, -math.sin(t - 0.6)), 0, 0))
    key("shin.R", f, rot=(KNEE * 0.7 * max(0.0, math.sin(t - 0.6)), 0, 0))
    for side, ph in (("L", -1), ("R", 1)):
        r = arm_side(side, 0.1)
        r[0] += ARM_FWD * 0.5 * s * ph
        key("upper_arm." + side, f, rot=r)
        key("forearm." + side, f, rot=(ELB * 0.35, 0, 0))

# wave: right arm up, forearm swinging
new_action("wave")
N = 36
for f in range(0, N + 1, 3):
    t = f / N * math.pi * 2
    up = min(1.0, f / 6) if f < N - 6 else max(0.0, (N - f) / 6)
    key("upper_arm.R", f, rot=arm_side("R", 2.5 * up))
    key("forearm.R", f, rot=[0, 0, 0] if True else None)
    e = arm_side("R", 0.5 * math.sin(t * 2) * up)
    key("forearm.R", f, rot=e)
    key("upper_arm.L", f, rot=arm_side("L", 0.12))
    key("head", f, rot=(0, 0, 0.1 * up))
    key("spine", f, rot=(0, 0, 0))
    key("root", f, loc=(0, 0, 0))
    for side in ("L", "R"):
        key("thigh." + side, f, rot=(0, 0, 0))
        key("shin." + side, f, rot=(0, 0, 0))
    key("forearm.L", f, rot=(ELB * 0.15, 0, 0))

# cheer: both arms up, a little hop
new_action("cheer")
N = 30
for f in range(0, N + 1, 3):
    t = f / N
    up = math.sin(min(1.0, t * 3) * math.pi / 2) if t < 0.8 else max(0.0, (1 - t) / 0.2)
    hop = max(0.0, math.sin(t * math.pi * 2)) * 0.12
    key("root", f, loc=(0, hop, 0))
    for side in ("L", "R"):
        key("upper_arm." + side, f, rot=arm_side(side, 2.7 * up))
        key("forearm." + side, f, rot=arm_side(side, 0.2 * up))
        key("thigh." + side, f, rot=(FWD * 0.2 * hop * 5, 0, 0))
        key("shin." + side, f, rot=(KNEE * 0.4 * hop * 5, 0, 0))
    key("head", f, rot=(-0.15 * up * FWD, 0, 0))
    key("spine", f, rot=(-0.05 * up * FWD, 0, 0))
    key("hips", f, rot=(0, 0, 0))

for act in actions:
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
    tr = rig.animation_data.nla_tracks.new()
    tr.name = act.name
    tr.strips.new(act.name, 0, act)
    act.use_fake_user = True
rig.animation_data.action = None
for b in pb:
    b.rotation_euler = (0, 0, 0)
    b.location = (0, 0, 0)

bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
body.select_set(True)
path = os.path.abspath(os.path.join(C.OUT, "kid_avatar.glb"))
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_animations=True,
                          export_animation_mode="ACTIONS", export_skins=True, export_image_format="AUTO", export_apply=False)
print(f"EXPORTED kid_avatar.glb tris={C.tris(body)} bytes={os.path.getsize(path)}")

# preview poses for checking (rendered by the caller)
for name, frame in (("idle", 0), ("walk", 5), ("wave", 15), ("cheer", 12)):
    pass
