"""Preview renders of exported .glb files (Cycles, CPU), used to check every model by eye
and as catalogue thumbnails.  blender -b -P render_preview.py -- in.glb out.png [yaw_deg] [elev_deg]"""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
yaw = float(argv[2]) if len(argv) > 2 else 35
elev = float(argv[3]) if len(argv) > 3 else 22
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
lo = Vector((1e9, 1e9, 1e9))
hi = -lo
for o in objs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo = Vector((min(lo[i], w[i]) for i in range(3)))
        hi = Vector((max(hi[i], w[i]) for i in range(3)))
ctr = (lo + hi) / 2
rad = (hi - lo).length / 2
# ground disc
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=rad * 3, fill_type="NGON", location=(ctr.x, ctr.y, lo.z))
g = bpy.context.active_object
gm = bpy.data.materials.new("ground")
gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.22, 0.3, 0.14, 1)
g.data.materials.append(gm)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
bpy.context.collection.objects.link(cam)
d = rad * 2.6
y, e = math.radians(yaw), math.radians(elev)
cam.location = ctr + Vector((math.sin(y) * math.cos(e) * d, -math.cos(y) * math.cos(e) * d, math.sin(e) * d))
cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 50
bpy.context.scene.camera = cam
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 4.0
sun.data.color = (1.0, 0.9, 0.75)
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
bpy.context.collection.objects.link(sun)
w = bpy.data.worlds.new("w")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.62, 0.55, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
bpy.context.scene.world = w
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = 24
sc.cycles.transparent_max_bounces = 64
sc.cycles.use_denoising = True
sc.render.resolution_x = 640
sc.render.resolution_y = 640
sc.render.filepath = dst
sc.view_settings.view_transform = "AgX"
bpy.ops.render.render(write_still=True)
