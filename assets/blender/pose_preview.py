"""Renders the avatar in each of its animations (one frame each) to check the rig.
blender -b -P pose_preview.py -- kid_avatar.glb out_prefix"""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
bpy.context.collection.objects.link(cam)
cam.location = Vector((1.3, -2.6, 1.3))
cam.rotation_euler = (Vector((0, 0, 0.7)) - cam.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = cam
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 4
sun.rotation_euler = (math.radians(50), 0, math.radians(20))
bpy.context.collection.objects.link(sun)
w = bpy.data.worlds.new("w")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.6, 0.65, 0.6, 1)
bpy.context.scene.world = w
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.samples = 16
sc.render.resolution_x = 360
sc.render.resolution_y = 480
sc.view_settings.view_transform = "AgX"
if rig.animation_data:
    for tr in rig.animation_data.nla_tracks:
        tr.mute = True
for name, frame in (("idle", 0), ("walk", 5), ("wave", 15), ("cheer", 12)):
    act = bpy.data.actions.get(name) or bpy.data.actions.get(name + "_kid_rig")
    if not act:
        print("missing", name, [a.name for a in bpy.data.actions])
        continue
    rig.animation_data_create()
    rig.animation_data.action = act
    sc.frame_set(frame)
    sc.render.filepath = f"{argv[1]}_{name}.png"
    bpy.ops.render.render(write_still=True)
