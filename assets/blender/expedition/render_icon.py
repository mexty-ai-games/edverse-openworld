"""Transparent icon / pose preview of a .glb (Cycles), soft painted lighting, front 3/4.

blender -b -P render_icon.py -- in.glb out.png [yaw] [elev] [size] [clip] [t] [zoom]
clip/t: pose the model at fraction t of that animation clip (preview of animations).
"""
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
yaw = float(argv[2]) if len(argv) > 2 else -30
elev = float(argv[3]) if len(argv) > 3 else 16
size = int(argv[4]) if len(argv) > 4 else 512
clip = argv[5] if len(argv) > 5 and argv[5] != "-" else None
tt = float(argv[6]) if len(argv) > 6 else 0.0
zoom = float(argv[7]) if len(argv) > 7 else 1.0
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
if clip:
    rig = next((o for o in sc.objects if o.type == "ARMATURE"), None)
    act = next((a for a in bpy.data.actions if a.name == clip or a.name.startswith(clip + "_") or a.name.split("|")[-1] == clip), None)
    if rig and act:
        rig.animation_data_create()
        for tr in list(rig.animation_data.nla_tracks):
            rig.animation_data.nla_tracks.remove(tr)
        rig.animation_data.action = act
        f0, f1 = act.frame_range
        sc.frame_set(int(round(f0 + (f1 - f0) * tt)))
    else:
        print("NO CLIP", clip, [a.name for a in bpy.data.actions])
else:
    for o in sc.objects:
        if o.animation_data:
            o.animation_data.action = None
            for tr in list(o.animation_data.nla_tracks):
                o.animation_data.nla_tracks.remove(tr)
    for o in sc.objects:
        if o.type == "ARMATURE":
            for pb in o.pose.bones:
                pb.location = (0, 0, 0)
                pb.rotation_quaternion = (1, 0, 0, 0)
                pb.rotation_euler = (0, 0, 0)
                pb.scale = (1, 1, 1)
    sc.frame_set(0)
for o in list(sc.objects):  # the importer's bone-display sphere
    if o.type == "MESH" and o.name.startswith("Icosphere"):
        bpy.data.objects.remove(o)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
lo = Vector((1e9, 1e9, 1e9))
hi = -lo
for o in sc.objects:
    if o.type != "MESH" or o.hide_render:
        continue
    oe = o.evaluated_get(dg)
    me = oe.to_mesh()
    for v in me.vertices:
        w = oe.matrix_world @ v.co
        lo = Vector((min(lo[i], w[i]) for i in range(3)))
        hi = Vector((max(hi[i], w[i]) for i in range(3)))
    oe.to_mesh_clear()
ctr = (lo + hi) / 2
if os.environ.get("TARGETZ"):  # previews: aim at a height (e.g. a face)
    ctr.z = float(os.environ["TARGETZ"])
rad = (hi - lo).length / 2

if not os.environ.get("NOSHADOW"):  # icons: no ground shadow (clean Field Guide pictures and silhouettes)
    bpy.ops.mesh.primitive_plane_add(size=rad * 12, location=(ctr.x, ctr.y, lo.z))
    bpy.context.active_object.is_shadow_catcher = True
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
d = rad * float(os.environ.get("DIST", 2.05)) / zoom
y, e = math.radians(yaw), math.radians(elev)
cam.location = ctr + Vector((math.sin(y) * math.cos(e) * d, -math.cos(y) * math.cos(e) * d, math.sin(e) * d))
cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 50
sc.camera = cam


def light(name, kind, energy, rot, color, angle=None, size=None, loc=None):
    l = bpy.data.lights.new(name, kind)
    l.energy = energy
    l.color = color
    if angle is not None:
        l.angle = math.radians(angle)
    if size is not None:
        l.shadow_soft_size = size
    o = bpy.data.objects.new(name, l)
    o.rotation_euler = [math.radians(a) for a in rot]
    if loc is not None:
        o.location = loc
    sc.collection.objects.link(o)


light("key", "SUN", 3.2, (48, 0, -35), (1.0, 0.93, 0.8), angle=25)
light("rim", "SUN", 1.6, (60, 0, 160), (0.8, 0.9, 1.0), angle=30)
w = bpy.data.worlds.new("w")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.84, 0.9, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.1
sc.world = w
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = int(os.environ.get("SAMPLES", 40))
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = size
sc.render.resolution_y = size
sc.render.filepath = dst
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
bpy.ops.render.render(write_still=True)
