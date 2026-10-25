"""Expedition helpers: sculpted parts, painterly vertex colour, and a tiny rigging/animation kit.

Parts are modelled in place (world space, facing -Y, Z up). Each part is bound to a bone, either
rigidly or smoothly along a bone chain (tails, tentacles, arms). Clips are written as functions of
t in [0,1] that return rotations about ARMATURE axes (applied on top of the parent's pose), sampled
densely, every bone keyed in every clip so clips cross-fade cleanly in three.js.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Quaternion, Vector  # noqa: E402

import common as C  # noqa: E402


# ----------------------------------------------------------------------------- colour helpers
def mixc(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def shade(c, n, amt=0.22, warm=0.06):
    """Painterly baked light: top-lit, cool-dark underside, warm rim."""
    k = 1.0 - amt * 0.5 + amt * 0.5 * n.z
    c = (min(1, c[0] * k + warm * max(0, n.z) * 0.5), min(1, c[1] * k), min(1, c[2] * k * (0.97 + 0.06 * (n.z < 0))))
    return tuple(max(0.0, x) ** 2.2 for x in c)  # colours are authored in sRGB; vertex colours are stored linear


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ----------------------------------------------------------------------------- materials
def soft(name, tex="paint.jpg", rough=0.6, color=None):
    """Painted base texture x vertex colours (+ optional constant tint, exported as baseColorFactor)."""
    m = C.material(name, tex=tex, rough=rough, vcol=True)
    if color is not None:
        tint_mat(m, color)
    return m


def tint_mat(m, color):
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    link = bsdf.inputs["Base Color"].links[0]
    src = link.from_socket
    nt.links.remove(link)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs[7].default_value = (*color, 1)
    nt.links.new(src, mix.inputs[6])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    return m


def flat(name, color, rough=0.5, **kw):
    return C.material(name, color=color, rough=rough, **kw)


# ----------------------------------------------------------------------------- shapes
def blob(name, center, radii, mat, seg=24, ring=14, fn=None, col=None, noise=0.0, nscale=4.0):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=1.0)
    for v in bm.verts:
        u = Vector(v.co)
        p = Vector((u.x * radii[0], u.y * radii[1], u.z * radii[2]))
        if fn:
            p += fn(u)
        if noise:
            p += u * C.fbm(p * nscale + Vector(center), 2) * noise
        v.co = p + Vector(center)
    ob = C.new_obj(name, bm, [mat])
    C.box_uv(ob, 2.0)
    C.shade_smooth(ob)
    if col:
        C.paint_vcol(ob, col)
    return ob


def tube(name, pts, radii, mat, sides=10, col=None, noise=0.0, nscale=3.0, cap=True, flare=None, uvrep=1.0, uv="box"):
    bm = bmesh.new()
    C.tube(bm, [Vector(p) for p in pts], radii, sides=sides, cap_start=cap, cap_end=cap, noise_amp=noise, noise_scale=nscale, flare=flare,
           u_repeat=uvrep)
    ob = C.new_obj(name, bm, [mat])
    if uv == "box":
        C.box_uv(ob, 2.0)
    C.shade_smooth(ob)
    if col:
        C.paint_vcol(ob, col)
    return ob


def smooth_pts(ctrl, steps=6):
    """Catmull-Rom through control points."""
    ctrl = [Vector(c) for c in ctrl]
    out = []
    P = [ctrl[0]] + ctrl + [ctrl[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(steps):
            t = k / steps
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(ctrl[-1])
    return out


def eyes(prefix, centers, r, look=Vector((0, -1, 0)), iris=(0.1, 0.07, 0.05), lid=None, lidcol=None, seg=14):
    """Big friendly eyes: white ball, large dark iris, two highlights; optional soft upper lid."""
    white = flat(prefix + "_eyewhite", (0.97, 0.96, 0.93), 0.25)
    dark = flat(prefix + "_iris", iris, 0.12)
    shine = flat(prefix + "_shine", (1, 1, 1), 0.2, emissive=(1, 1, 1), emissive_strength=1.2)
    out = []
    for i, c in enumerate(centers):
        c = Vector(c)
        out.append(blob(f"{prefix}_eye{i}", c, (r, r, r), white, seg=seg, ring=seg // 2 + 2))
        side = Vector((math.copysign(1, c.x), 0, 0)) if abs(c.x) > 1e-4 else Vector((0, 0, 0))
        d = (look.normalized() + side * 0.28).normalized()
        out.append(blob(f"{prefix}_iris{i}", c + d * r * 0.52, (r * 0.66, r * 0.66, r * 0.66), dark, seg=14, ring=9))
        up = Vector((0, 0, 1))
        sx = d.cross(up).normalized()
        out.append(blob(f"{prefix}_shine{i}", c + d * r * 1.08 + up * r * 0.32 - sx * r * 0.2, (r * 0.2,) * 3, shine, seg=8, ring=5))
        out.append(blob(f"{prefix}_shineb{i}", c + d * r * 1.1 - up * r * 0.25 + sx * r * 0.25, (r * 0.09,) * 3, shine, seg=6, ring=4))
        if lid is not None:  # a soft brow lid over the top of the eye (sleepy-kind look)
            out.append(blob(f"{prefix}_lid{i}", c, (r * 1.1, r * 1.1, r * 1.1), lid, seg=seg, ring=seg // 2 + 2,
                            fn=lambda u: Vector((0, 0, 0)) if u.z > 0.62 else Vector((0, 0, (0.62 - u.z) * r * 1.1)), col=lidcol))
    return out


# ----------------------------------------------------------------------------- rig
class Rig:
    def __init__(self, name):
        self.name = name
        self.bones = {}
        self.order = []
        self.parts = []

    def bone(self, name, head, tail, parent=None):
        self.bones[name] = (Vector(head), Vector(tail), parent)
        self.order.append(name)
        return name

    def chain(self, prefix, pts, parent=None):
        names = []
        for i in range(len(pts) - 1):
            n = f"{prefix}{i}" if len(pts) > 2 else prefix
            self.bone(n, pts[i], pts[i + 1], parent if i == 0 else names[-1])
            names.append(n)
        return names

    def add(self, objs, bone):
        if not isinstance(objs, (list, tuple)):
            objs = [objs]
        for o in objs:
            self.parts.append((o, bone))

    def add_chain(self, objs, bones, soft_w=0.5):
        if not isinstance(objs, (list, tuple)):
            objs = [objs]
        for o in objs:
            self.parts.append((o, list(bones)))

    def _weights(self, ob, bones):
        segs = [(self.bones[b][0], self.bones[b][1]) for b in bones]
        groups = {b: ob.vertex_groups.new(name=b) for b in bones}
        for v in ob.data.vertices:
            p = ob.matrix_world @ v.co
            best, bi, bs = 1e9, 0, 0.0
            for i, (a, b) in enumerate(segs):
                ab = b - a
                s = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
                d = (a + ab * s - p).length
                if d < best - 1e-6:
                    best, bi, bs = d, i, s
            w = {bi: 1.0}
            if bs < 0.35 and bi > 0:
                f = 0.5 + 0.5 * (bs / 0.35)
                w = {bi: f, bi - 1: 1 - f}
            elif bs > 0.65 and bi < len(bones) - 1:
                f = 0.5 + 0.5 * ((1 - bs) / 0.35)
                w = {bi: f, bi + 1: 1 - f}
            for i, ww in w.items():
                groups[bones[i]].add([v.index], ww, "REPLACE")

    def build(self):
        ad = bpy.data.armatures.new(self.name + "_rig")
        rig = bpy.data.objects.new(self.name + "_rig", ad)
        bpy.context.collection.objects.link(rig)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.mode_set(mode="EDIT")
        for n in self.order:
            h, t, par = self.bones[n]
            b = ad.edit_bones.new(n)
            b.head, b.tail = h, t
            b.roll = 0
        for n in self.order:
            par = self.bones[n][2]
            if par:
                ad.edit_bones[n].parent = ad.edit_bones[par]
        bpy.ops.object.mode_set(mode="OBJECT")
        objs = []
        for ob, bn in self.parts:
            if isinstance(bn, list):
                self._weights(ob, bn)
            else:
                vg = ob.vertex_groups.new(name=bn)
                vg.add(list(range(len(ob.data.vertices))), 1.0, "REPLACE")
            objs.append(ob)
        for ob in objs:
            bpy.context.view_layer.objects.active = ob
            ob.select_set(True)
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
            ob.select_set(False)
        for ob in objs:
            me = ob.data
            if not me.uv_layers:
                C.box_uv(ob, 1.0)
            me.uv_layers[0].name = "UVMap"
            while len(me.uv_layers) > 1:
                me.uv_layers.remove(me.uv_layers[1])
        body = C.join(objs, self.name)
        md = body.modifiers.new("rig", "ARMATURE")
        md.object = rig
        body.parent = rig
        self.rig, self.body = rig, body
        for pb in rig.pose.bones:
            pb.rotation_mode = "QUATERNION"
        self.actions = []
        return rig, body

    # ------------------------------------------------------------------ animation
    def clip(self, name, frames, fn, step=2, fps=24):
        """fn(t) -> {bone: {'rot': [(axis, angle), ...], 'loc': (x,y,z), 'scale': s or (x,y,z)}} in armature axes."""
        rig = self.rig
        bpy.context.scene.render.fps = fps
        act = bpy.data.actions.new(name)
        rig.animation_data_create()
        rig.animation_data.action = act
        pbs = rig.pose.bones
        rest = {pb.name: pb.bone.matrix_local.to_quaternion() for pb in pbs}
        fl = list(range(0, frames + 1, step))
        if fl[-1] != frames:
            fl.append(frames)
        for f in fl:
            pose = fn(f / frames)
            for pb in pbs:
                spec = pose.get(pb.name, {})
                q = Quaternion()
                for ax, ang in spec.get("rot", []):
                    q = Quaternion(Vector(ax), ang) @ q
                R = rest[pb.name]
                pb.rotation_quaternion = R.inverted() @ q @ R
                loc = Vector(spec.get("loc", (0, 0, 0)))
                pb.location = R.inverted() @ loc
                s = spec.get("scale", 1.0)
                if isinstance(s, (int, float)):
                    s = (s, s, s)
                # a tuple is in the bone's own axes (Y = along the bone)
                pb.scale = s
                pb.keyframe_insert("rotation_quaternion", frame=f)
                pb.keyframe_insert("location", frame=f)
                pb.keyframe_insert("scale", frame=f)
        for fc in act.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"
        tr = rig.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, 0, act)
        act.use_fake_user = True
        self.actions.append(name)
        rig.animation_data.action = None
        for pb in pbs:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)

    def export(self, path, extra=()):
        bpy.ops.object.select_all(action="DESELECT")
        self.rig.select_set(True)
        self.body.select_set(True)
        for o in extra:
            o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_animations=True,
                                  export_animation_mode="ACTIONS", export_skins=True, export_image_format="AUTO", export_apply=False,
                                  export_vertex_color="ACTIVE")
        t = C.tris(self.body) + sum(C.tris(o) for o in extra if o.type == "MESH")
        print(f"EXPORTED {os.path.basename(path)} tris={t} bytes={os.path.getsize(path)} clips={self.actions}")
        return t


# rotation shorthands (armature axes; model faces -Y, so +X is the model's left side... see notes)
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)


def S(t, k=1.0, ph=0.0):
    return math.sin((t * k + ph) * math.pi * 2)


def Cs(t, k=1.0, ph=0.0):
    return math.cos((t * k + ph) * math.pi * 2)


def ease_in_out(t):
    """0 -> 1 -> 0 envelope over a clip, for gestures that start and end at rest."""
    return math.sin(math.pi * max(0.0, min(1.0, t))) ** 0.6
