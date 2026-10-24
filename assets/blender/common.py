"""Shared helpers for the Idea Grove Blender scripts (Blender 4.2, run headless).

Geometry is built directly with bmesh/mesh data so every model is exact and repeatable:
organic tubes (trunks, roots, branches) with twist + fractal noise, leaf-card clumps with
normals bent outward (soft, painterly shading), lathe shapes (pots, telescope), bevelled
boxes (wood), and PBR materials using the painted textures from textures.py.
"""
import math
import os
import random

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

TEX = os.environ.get("OW_TEX", "build/tex")
OUT = os.environ.get("OW_OUT", "build/glb")
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _img_cache.clear()
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


# ----------------------------------------------------------------------------- materials
_img_cache = {}


def image(name):
    if name in _img_cache:
        return _img_cache[name]
    img = bpy.data.images.load(os.path.abspath(os.path.join(TEX, name)))
    _img_cache[name] = img
    return img


def material(name, color=None, tex=None, normal=None, rough=0.8, metal=0.0, emissive=None, emissive_tex=None,
             emissive_strength=1.0, alpha_tex=False, vcol=False, double=False, normal_strength=1.0):
    """A Principled material. `tex`/`normal`/`emissive_tex` are file names in TEX. `vcol` multiplies
    the base colour by the mesh's colour attribute (moss / ambient occlusion painted per vertex)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    base_out = None
    if tex:
        it = nt.nodes.new("ShaderNodeTexImage")
        it.image = image(tex)
        base_out = it.outputs["Color"]
        if alpha_tex:
            # alpha clip (exported as glTF alphaMode MASK, cutoff 0.4): crisp, sort-free foliage
            gt = nt.nodes.new("ShaderNodeMath")
            gt.operation = "GREATER_THAN"
            gt.inputs[1].default_value = 0.4
            nt.links.new(it.outputs["Alpha"], gt.inputs[0])
            nt.links.new(gt.outputs[0], bsdf.inputs["Alpha"])
    if color is not None and base_out is None:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    if vcol:
        ca = nt.nodes.new("ShaderNodeVertexColor")
        ca.layer_name = "Col"
        if base_out is not None:
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            nt.links.new(base_out, mix.inputs[6])
            nt.links.new(ca.outputs["Color"], mix.inputs[7])
            base_out = mix.outputs[2]
        else:
            base_out = ca.outputs["Color"]
    if base_out is not None:
        nt.links.new(base_out, bsdf.inputs["Base Color"])
    if normal:
        nm = nt.nodes.new("ShaderNodeTexImage")
        nm.image = image(normal)
        nm.image.colorspace_settings.name = "Non-Color"
        nn = nt.nodes.new("ShaderNodeNormalMap")
        nn.inputs["Strength"].default_value = normal_strength
        nt.links.new(nm.outputs["Color"], nn.inputs["Color"])
        nt.links.new(nn.outputs["Normal"], bsdf.inputs["Normal"])
    if emissive_tex:
        et = nt.nodes.new("ShaderNodeTexImage")
        et.image = image(emissive_tex)
        nt.links.new(et.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emissive_strength
    elif emissive is not None:
        bsdf.inputs["Emission Color"].default_value = (*emissive, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emissive_strength
    m.use_backface_culling = not double
    return m


# ----------------------------------------------------------------------------- objects
def new_obj(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    return ob


def tris(ob):
    me = ob.data
    return sum(len(p.vertices) - 2 for p in me.polygons)


def shade_smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True


def fbm(v, octaves=4, scale=1.0):
    return noise.fractal(v * scale, 0.6, 2.0, octaves, noise_basis="PERLIN_ORIGINAL")


def paint_vcol(ob, fn):
    """Colour attribute 'Col' per corner from fn(world_pos, normal) -> (r,g,b)."""
    me = ob.data
    if "Col" not in me.color_attributes:
        me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    ca = me.color_attributes["Col"]
    me.color_attributes.active_color = ca
    mw = ob.matrix_world
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            v = me.vertices[vi]
            c = fn(mw @ v.co, (mw.to_3x3() @ v.normal).normalized())
            ca.data[li].color = (c[0], c[1], c[2], 1.0)


# ----------------------------------------------------------------------------- tubes
def tube(bm, pts, radii, sides=10, uvmat=None, twist=0.0, noise_amp=0.0, noise_scale=1.0, seed=0, v_scale=1.0,
         cap_start=False, cap_end=True, flare=None, u_repeat=2.0):
    """Sweep a ring along a polyline. pts: list of Vector; radii: per point. UV u around, v along length.
    `flare(i, angle) -> extra radius` lets roots bulge. Returns the end ring verts."""
    n = len(pts)
    rings = []
    length = 0.0
    up = Vector((0, 0, 1))
    prev_side = None
    seedv = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    for i, p in enumerate(pts):
        if i == 0:
            d = (pts[1] - pts[0]).normalized()
        elif i == n - 1:
            d = (pts[-1] - pts[-2]).normalized()
            length += (pts[i] - pts[i - 1]).length
        else:
            d = ((pts[i + 1] - pts[i]).normalized() + (pts[i] - pts[i - 1]).normalized()).normalized()
            length += (pts[i] - pts[i - 1]).length
        ref = prev_side if prev_side is not None else (up if abs(d.dot(up)) < 0.9 else Vector((1, 0, 0)))
        side = (ref - d * ref.dot(d)).normalized()
        prev_side = side
        other = d.cross(side).normalized()
        ring = []
        for k in range(sides + 1):
            a = (k / sides) * math.pi * 2 + twist * i
            r = radii[i]
            if flare:
                r += flare(i, a)
            off = side * math.cos(a) + other * math.sin(a)
            co = p + off * r
            if noise_amp > 0:
                co += off * r * noise_amp * fbm(co + seedv, 3, noise_scale)
            ring.append((bm.verts.new(co), k / sides, length * v_scale))
        rings.append(ring)
    uv = bm.loops.layers.uv.verify()
    for i in range(n - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(sides):
            f = bm.faces.new((a[k][0], a[k + 1][0], b[k + 1][0], b[k][0]))
            for loop, (vv, uu, vvv) in zip(f.loops, (a[k], a[k + 1], b[k + 1], b[k])):
                loop[uv].uv = (uu * u_repeat, vvv)
    # seam duplicates share position: weld them so the tube is smooth
    for ring in rings:
        bmesh.ops.pointmerge(bm, verts=[ring[0][0], ring[-1][0]], merge_co=ring[0][0].co)
    if cap_end:
        last = [r[0] for r in rings[-1][:-1]]
        try:
            bm.faces.new(last)
        except ValueError:
            pass
    return rings


def bezier_pts(p0, p1, p2, p3, steps):
    out = []
    for i in range(steps + 1):
        t = i / steps
        a = (1 - t) ** 3
        b = 3 * (1 - t) ** 2 * t
        c = 3 * (1 - t) * t * t
        d = t ** 3
        out.append(p0 * a + p1 * b + p2 * c + p3 * d)
    return out


# ----------------------------------------------------------------------------- leaf cards
def card(bm, center, normal, size, uv_rect, rot=0.0, bend=0.0, center_for_normals=None, custom=None):
    """A quad facing `normal`, uv_rect=(u0,v0,u1,v1). Appends (vert, normal) to custom for bent normals."""
    n = normal.normalized()
    t = n.cross(Vector((0, 0, 1)))
    if t.length < 1e-3:
        t = Vector((1, 0, 0))
    t.normalize()
    b = n.cross(t).normalized()
    if b.z < 0:  # keep the texture's top pointing up on upright cards
        t, b = -t, -b
    rm = Matrix.Rotation(rot, 3, n)
    t, b = rm @ t, rm @ b
    h = size / 2
    corners = [(-h, -h), (h, -h), (h, h), (-h, h)]
    vs = []
    for x, y in corners:
        co = center + t * x + b * y + n * (bend * (x * x + y * y) / (h * h + 1e-6))
        vs.append(bm.verts.new(co))
    f = bm.faces.new(vs)
    uv = bm.loops.layers.uv.verify()
    u0, v0, u1, v1 = uv_rect
    for loop, (uu, vv) in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
        loop[uv].uv = (uu, vv)
    if custom is not None:
        for v in vs:
            if center_for_normals is not None:
                nn = (v.co - center_for_normals).normalized()
                nn = (nn * 0.75 + Vector((0, 0, 1)) * 0.35).normalized()
            else:
                nn = n
            custom.append((v, nn))
    return f


def apply_custom_normals(ob, custom_by_co):
    """custom_by_co: dict vertex index -> normal, set as custom split normals."""
    me = ob.data
    nrm = [Vector(v.normal) for v in me.vertices]
    for i, n in custom_by_co.items():
        nrm[i] = n
    me.normals_split_custom_set_from_vertices([tuple(n) for n in nrm])


def leaf_clump(bm, center, radius, count, rng, custom, quads=4, flat=0.85):
    """A ball of leaf cards (atlas quadrants), normals pointing out of the clump."""
    for _ in range(count):
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1) * 0.7 + 0.25)).normalized()
        p = center + Vector((d.x * radius, d.y * radius, d.z * radius * flat)) * rng.uniform(0.55, 1.0)
        q = rng.randrange(quads)
        u0, v0 = (q % 2) * 0.5, (q // 2) * 0.5
        nrm = (d + Vector((rng.uniform(-.4, .4), rng.uniform(-.4, .4), rng.uniform(-.2, .5)))).normalized()
        card(bm, p, nrm, radius * rng.uniform(0.85, 1.25), (u0, v0, u0 + 0.5, v0 + 0.5), rot=rng.uniform(0, 6.28),
             center_for_normals=center, custom=custom)


# ----------------------------------------------------------------------------- lathe & boxes
def lathe(bm, profile, segs=24, v_scale=1.0, u_scale=1.0, cap_bottom=True):
    """profile: list of (radius, z). Returns list of rings."""
    uv = bm.loops.layers.uv.verify()
    rings = []
    L = 0.0
    lens = [0.0]
    for i in range(1, len(profile)):
        L += math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1])
        lens.append(L)
    for (r, z), l in zip(profile, lens):
        ring = []
        for k in range(segs):
            a = k / segs * math.pi * 2
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        rings.append((ring, l))
    for i in range(len(rings) - 1):
        a, la = rings[i]
        b, lb = rings[i + 1]
        for k in range(segs):
            k2 = (k + 1) % segs
            f = bm.faces.new((a[k], a[k2], b[k2], b[k]))
            u1 = (k + 1) / segs
            for loop, (uu, vv) in zip(f.loops, ((k / segs, la), (u1, la), (u1, lb), (k / segs, lb))):
                loop[uv].uv = (uu * u_scale, vv * v_scale)
    if cap_bottom:
        try:
            f = bm.faces.new(list(reversed(rings[0][0])))
            for loop in f.loops:
                loop[uv].uv = (loop.vert.co.x * 0.5 + 0.5, loop.vert.co.y * 0.5 + 0.5)
        except ValueError:
            pass
    return rings


def box_obj(name, size, loc, mat, rot=(0, 0, 0), bevel=0.02, segments=2, uv_scale=1.0, noise_amp=0.0, seed=0):
    """A bevelled box with box-projected UVs (world-ish scale), applied modifiers."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    ob = new_obj(name, bm, [mat])
    if bevel > 0:
        md = ob.modifiers.new("bevel", "BEVEL")
        md.width = bevel
        md.segments = segments
        md.limit_method = "NONE"
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier="bevel")
    if noise_amp > 0:
        rng = random.Random(seed)
        off = Vector((rng.random() * 50, rng.random() * 50, rng.random() * 50))
        for v in ob.data.vertices:
            v.co += Vector((fbm(v.co * 3 + off), fbm(v.co * 3 + off + Vector((5, 0, 0))), fbm(v.co * 3 + off + Vector((0, 9, 0))))) * noise_amp
    box_uv(ob, uv_scale)
    ob.rotation_euler = rot
    ob.location = loc
    shade_flat_bevel(ob)
    return ob


def box_uv(ob, scale=1.0):
    me = ob.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    uv = me.uv_layers.active.data
    for p in me.polygons:
        n = p.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if ax == 0:
                uv[li].uv = (co.y * scale, co.z * scale)
            elif ax == 1:
                uv[li].uv = (co.x * scale, co.z * scale)
            else:
                uv[li].uv = (co.x * scale, co.y * scale)


def shade_flat_bevel(ob):
    shade_smooth(ob)
    try:
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
        ob.select_set(False)
    except Exception:
        pass


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name
    ob.data.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return ob


def apply_all(ob):
    bpy.context.view_layer.objects.active = ob
    for md in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)


def export(name, objs=None):
    """Exports the given objects (or everything) to OUT/name.glb, Y-up, and prints triangles + size."""
    bpy.ops.object.select_all(action="DESELECT")
    objs = objs or [o for o in bpy.context.scene.objects]
    for o in objs:
        o.select_set(True)
        for c in o.children_recursive:
            c.select_set(True)
    path = os.path.abspath(os.path.join(OUT, name + ".glb"))
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
              export_image_format="AUTO", export_extras=False, export_cameras=False, export_lights=False)
    try:
        bpy.ops.export_scene.gltf(export_vertex_color="ACTIVE", **kw)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)
    t = sum(tris(o) for o in bpy.context.scene.objects if o.type == "MESH" and o.select_get())
    print(f"EXPORTED {name}.glb tris={t} bytes={os.path.getsize(path)}")
    return path
