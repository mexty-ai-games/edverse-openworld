"""Transparent icon / preview of a .glb or one node of a kit (Cycles), soft painted light, front 3/4.

blender -b -P render.py -- in.glb out.png [size] [node|-] [clip|-] [t] [yaw] [elev] [shadow 0/1] [zoom]
Several jobs in one Blender run: pass a file with one argument line per job instead:
blender -b -P render.py -- @jobs.txt
"""
import math
import shlex
import sys

import bpy
from mathutils import Vector


def job(argv):
    src, dst = argv[0], argv[1]
    size = int(argv[2]) if len(argv) > 2 else 256
    node = argv[3] if len(argv) > 3 and argv[3] != "-" else None
    clip = argv[4] if len(argv) > 4 and argv[4] != "-" else None
    tt = float(argv[5]) if len(argv) > 5 else 0.0
    yaw = float(argv[6]) if len(argv) > 6 else -30
    elev = float(argv[7]) if len(argv) > 7 else 18
    shadow = (argv[8] != "0") if len(argv) > 8 else True
    zoom = float(argv[9]) if len(argv) > 9 else 1.0
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    sc = bpy.context.scene
    keep = None
    if node:
        root = sc.objects.get(node)
        if root is None:
            print("NO NODE", node, [o.name for o in sc.objects if o.parent is None])
        else:
            keep = {root} | set(root.children_recursive)
            # an armature-skinned mesh: keep its rig too
            p = root.parent
            while p is not None:
                keep.add(p)
                p = p.parent
            for o in sc.objects:
                if o not in keep and o.type == "MESH":
                    o.hide_render = True
            root.location = (0, 0, 0)
    rig = next((o for o in sc.objects if o.type == "ARMATURE"), None)
    if clip and rig:
        act = next((a for a in bpy.data.actions if a.name == clip or a.name.split("|")[-1] == clip or a.name.startswith(clip + "_")), None)
        rig.animation_data_create()
        for tr in list(rig.animation_data.nla_tracks):
            rig.animation_data.nla_tracks.remove(tr)
        if act:
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
            if o.type == "ARMATURE":
                for pb in o.pose.bones:
                    pb.location = (0, 0, 0)
                    pb.rotation_quaternion = (1, 0, 0, 0)
                    pb.scale = (1, 1, 1)
        sc.frame_set(0)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    for o in sc.objects:
        if o.type == "MESH" and not o.visible_get():
            o.hide_render = True  # e.g. the importer's bone-shape icosphere
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
    rad = (hi - lo).length / 2
    if shadow:
        bpy.ops.mesh.primitive_plane_add(size=rad * 12, location=(ctr.x, ctr.y, lo.z))
        bpy.context.active_object.is_shadow_catcher = True
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    d = rad * 2.75 / zoom
    y, e = math.radians(yaw), math.radians(elev)
    cam.location = ctr + Vector((math.sin(y) * math.cos(e) * d, -math.cos(y) * math.cos(e) * d, math.sin(e) * d))
    cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50
    cam.data.clip_start = rad * 0.01
    cam.data.clip_end = rad * 50
    sc.camera = cam

    def light(name, kind, energy, rot, color, angle=None):
        l = bpy.data.lights.new(name, kind)
        l.energy = energy
        l.color = color
        if angle is not None:
            l.angle = math.radians(angle)
        o = bpy.data.objects.new(name, l)
        o.rotation_euler = [math.radians(a) for a in rot]
        sc.collection.objects.link(o)

    light("key", "SUN", 3.0, (48, 0, -35), (1.0, 0.93, 0.8), angle=25)
    light("rim", "SUN", 1.5, (60, 0, 160), (0.8, 0.9, 1.0), angle=30)
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.84, 0.9, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.1
    sc.world = w
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 20
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = size
    sc.render.resolution_y = size
    sc.render.filepath = dst
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    bpy.ops.render.render(write_still=True)
    print("RENDERED", dst)


argv = sys.argv[sys.argv.index("--") + 1:]
if argv and argv[0].startswith("@"):
    for line in open(argv[0][1:]):
        if line.strip():
            try:
                job(shlex.split(line))
            except Exception as ex:  # keep going
                print("FAILED", line.strip(), ex)
else:
    job(argv)
