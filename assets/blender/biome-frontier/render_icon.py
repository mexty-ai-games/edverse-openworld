"""Square picture of a species model for the field card (Cycles), on a soft painted backdrop.

blender -b -P render_icon.py -- in.glb out.png [yaw_deg] [elev_deg] [bg r,g,b]
"""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
yaw = float(argv[2]) if len(argv) > 2 else 28
elev = float(argv[3]) if len(argv) > 3 else 18
bg = tuple(float(x) for x in argv[4].split(",")) if len(argv) > 4 else (0.93, 0.88, 0.76)
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
# soft shadow catcher
bpy.ops.mesh.primitive_plane_add(size=rad * 12, location=(ctr.x, ctr.y, lo.z))
g = bpy.context.active_object
g.is_shadow_catcher = True
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
bpy.context.collection.objects.link(cam)
d = rad * 2.25
y, e = math.radians(yaw), math.radians(elev)
cam.location = ctr + Vector((math.sin(y) * math.cos(e) * d, -math.cos(y) * math.cos(e) * d, math.sin(e) * d))
cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 50
bpy.context.scene.camera = cam
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.5
sun.data.angle = math.radians(20)
sun.data.color = (1.0, 0.93, 0.8)
sun.rotation_euler = (math.radians(45), 0, math.radians(-30))
bpy.context.collection.objects.link(sun)
w = bpy.data.worlds.new("w")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.85, 0.9, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
bpy.context.scene.world = w
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = 32
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x = 512
sc.render.resolution_y = 512
sc.render.filepath = dst
sc.view_settings.view_transform = "Standard"
bpy.ops.render.render(write_still=True)
