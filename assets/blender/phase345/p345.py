"""Shared helpers for the OpenWorld phase 3-5 asset scripts (Blender 4.2, headless).

Builds on the Idea Grove helpers (../common.py) and the Expedition rig kit (xrig.py, a copy).
VB is a small mesh builder that carries a painted colour per vertex (stored in float layers so welds
and merges keep it), turned into the 'Col' corner colour that the soft materials multiply with the
painted texture, with a baked top light (painterly, warm top / cool underside).
Conventions: metres, Z-up (exported Y-up), front faces -Y, origin at the base centre.
Kits: one .glb with several top-level nodes, each with its origin at its own base; they are laid out
along X for previews, so the game resets a node's position when it clones one.
"""
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import common as C  # noqa: E402
import xrig as R  # noqa: E402

V = Vector
PI = math.pi
UP = V((0, 0, 1))


def lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def mulc(c, k):
    return tuple(min(1.0, x * k) for x in c)


# ----------------------------------------------------------------------------- materials
def mat(name, tex="paint.jpg", tint=None, rough=0.6, metal=0.0, vcol=True, double=False, normal=None, alpha_tex=False,
        emissive=None, emissive_strength=1.0, emissive_tex=None):
    m = C.material(name, tex=tex, rough=rough, metal=metal, vcol=vcol, double=double, normal=normal, alpha_tex=alpha_tex,
                   emissive=emissive, emissive_strength=emissive_strength, emissive_tex=emissive_tex)
    if tint is not None:
        R.tint_mat(m, tint)
    return m


def glass(name, color=(0.75, 0.9, 0.95), alpha=0.25, rough=0.05):
    m = C.material(name, color=color, rough=rough)
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Alpha"].default_value = alpha
    m.blend_method = "BLEND"
    m.use_backface_culling = False
    return m


def glow(name, color, strength=2.5):
    return C.material(name, color=color, emissive=color, emissive_strength=strength, rough=0.35)


# ----------------------------------------------------------------------------- vertex-colour builder
class VB:
    """bmesh builder with a painted colour per vertex (float layers r,g,b + 'set' flag)."""

    def __init__(self):
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.verify()
        L = self.bm.verts.layers.float
        self.lr, self.lg, self.lb, self.ls = L.new("cr"), L.new("cg"), L.new("cb"), L.new("cs")
        self.mi = 0  # material index given to new faces

    def setc(self, v, col):
        v[self.lr], v[self.lg], v[self.lb], v[self.ls] = col[0], col[1], col[2], 1.0

    def v(self, co, col=(1, 1, 1)):
        vert = self.bm.verts.new(co)
        self.setc(vert, col)
        return vert

    def f(self, vs, uvs=None):
        try:
            face = self.bm.faces.new(vs)
        except ValueError:
            return None
        face.material_index = self.mi
        if uvs:
            for loop, uv in zip(face.loops, uvs):
                loop[self.uv].uv = uv
        return face

    def colorize(self, fn):
        """Colour every vertex not coloured yet: fn(co) -> rgb, or a constant rgb."""
        for v in self.bm.verts:
            if v[self.ls] < 0.5:
                self.setc(v, fn(v.co) if callable(fn) else fn)

    # --- shapes ------------------------------------------------------------
    def tube(self, pts, radii, col, sides=8, cap=True, noise=0.0, nscale=3.0, flare=None, u_repeat=1.0, v_scale=1.0):
        pts = [V(p) for p in pts]
        if not isinstance(radii, (list, tuple)):
            radii = [radii] * len(pts)
        n0 = len(self.bm.faces)
        C.tube(self.bm, pts, list(radii), sides=sides, cap_end=cap, noise_amp=noise, noise_scale=nscale, flare=flare,
               u_repeat=u_repeat, v_scale=v_scale)
        self.bm.faces.ensure_lookup_table()
        for f in list(self.bm.faces)[n0:]:
            f.material_index = self.mi
        self.colorize(col)

    def lathe(self, profile, col, segs=16, loc=(0, 0, 0), rot=None, scale=(1, 1, 1), cap=True, u_scale=1.0, v_scale=1.0):
        bm2 = bmesh.new()
        C.lathe(bm2, profile, segs=segs, cap_bottom=cap, u_scale=u_scale, v_scale=v_scale)
        mtx = Matrix.Translation(V(loc)) @ (rot.to_matrix().to_4x4() if rot is not None else Matrix()) @ Matrix.Diagonal((*scale, 1))
        bm2.transform(mtx)
        self._absorb(bm2, col)

    def blob(self, center, radii, col, seg=16, ring=10, fn=None, noise=0.0, nscale=4.0, rot=None):
        bm2 = bmesh.new()
        bmesh.ops.create_uvsphere(bm2, u_segments=seg, v_segments=ring, radius=1.0, calc_uvs=True)
        center = V(center)
        cols = {}
        for v in bm2.verts:
            u = V(v.co)
            p = V((u.x * radii[0], u.y * radii[1], u.z * radii[2]))
            if fn:
                p += fn(u)
            if noise:
                p += u * C.fbm(p * nscale + center, 2) * noise
            if rot is not None:
                p = rot @ p
            v.co = p + center
            cols[v.index] = col(u) if callable(col) else col
        self._absorb(bm2, lambda co, c=cols: None, percol=cols)

    def box(self, size, loc, col, rot=None, bevel=0.0, segs=1):
        bm2 = bmesh.new()
        bmesh.ops.create_cube(bm2, size=1.0, calc_uvs=True)
        if bevel > 0:
            bmesh.ops.bevel(bm2, geom=list(bm2.edges) + list(bm2.verts) if False else list(bm2.edges), offset=bevel / max(size) * 1.0,
                            segments=segs, affect="EDGES", profile=0.5)
        for v in bm2.verts:
            v.co = V((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
        mtx = Matrix.Translation(V(loc)) @ (rot.to_matrix().to_4x4() if rot is not None else Matrix())
        bm2.transform(mtx)
        self._absorb(bm2, col)

    def _absorb(self, bm2, col, percol=None):
        """Append bm2 into this builder (verts, faces, uvs), colouring its verts."""
        uv2 = bm2.loops.layers.uv.verify()
        bm2.verts.index_update()
        vmap = {}
        for v in bm2.verts:
            c = percol[v.index] if percol else (col(v.co) if callable(col) else col)
            vmap[v] = self.v(v.co, c)
        for f in bm2.faces:
            nf = self.f([vmap[v] for v in f.verts], [tuple(l[uv2].uv) for l in f.loops])
        bm2.free()

    def disc(self, center, normal, R, col, dome=0.0, segs=20, rings=4, uv_rect=(0, 0, 1, 1), back=None):
        """A (domed) disc facing normal with planar UVs over uv_rect (flower heads, plates, labels)."""
        n = V(normal).normalized()
        t = n.cross(UP)
        if t.length < 1e-3:
            t = V((1, 0, 0))
        t.normalize()
        b = n.cross(t).normalized()
        if b.z < 0:
            t, b = -t, -b
        u0, v0, u1, v1 = uv_rect
        c = V(center)
        cv = self.v(c + n * dome, col)
        prev = None
        ringsv = []
        for i in range(1, rings + 1):
            r = R * i / rings
            h = dome * (1 - (i / rings) ** 2)
            ring = [self.v(c + (t * math.cos(a) + b * math.sin(a)) * r + n * h, col) for a in [k / segs * 2 * PI for k in range(segs)]]
            ringsv.append((ring, r))

        def uvof(vert):
            q = vert.co - c
            return (u0 + (u1 - u0) * (0.5 + q.dot(t) / (2 * R)), v0 + (v1 - v0) * (0.5 + q.dot(b) / (2 * R)))
        r0 = ringsv[0][0]
        for k in range(segs):
            self.f((cv, r0[k], r0[(k + 1) % segs]), [uvof(cv), uvof(r0[k]), uvof(r0[(k + 1) % segs])])
        for i in range(len(ringsv) - 1):
            a, bb = ringsv[i][0], ringsv[i + 1][0]
            for k in range(segs):
                k2 = (k + 1) % segs
                q = (a[k], bb[k], bb[k2], a[k2])
                self.f(q, [uvof(x) for x in q])
        return ringsv[-1][0]

    def obj(self, name, mats, smooth=True, light=0.22, ao=None, warm=0.06):
        bm = self.bm
        ob = C.new_obj(name, bm, mats if isinstance(mats, (list, tuple)) else [mats])
        if smooth:
            C.shade_smooth(ob)
        bake_cols(ob, light=light, ao=ao, warm=warm)
        return ob


def bake_cols(ob, light=0.22, ao=None, warm=0.06):
    """Float colour layers -> 'Col' corner colour with a baked painterly light. ao=(z0, z1): darker below z1."""
    me = ob.data
    n = len(me.vertices)
    cr = me.attributes.get("cr")
    cols = []
    for i in range(n):
        if cr is not None:
            cols.append((me.attributes["cr"].data[i].value, me.attributes["cg"].data[i].value, me.attributes["cb"].data[i].value))
        else:
            cols.append((1, 1, 1))
    if "Col" not in me.color_attributes:
        me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    ca = me.color_attributes["Col"]
    me.color_attributes.active_color = ca
    mw = ob.matrix_world
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            c = cols[vi]
            nn = (mw.to_3x3() @ me.vertices[vi].normal).normalized()
            if light:
                c = R.shade(c, nn, amt=light, warm=warm)
            if ao:
                z = (mw @ me.vertices[vi].co).z
                k = 0.7 + 0.3 * R.smoothstep(ao[0], ao[1], z)
                c = mulc(c, k)
            ca.data[li].color = (c[0], c[1], c[2], 1.0)
    for nm in ("cr", "cg", "cb", "cs"):
        if nm in me.attributes:
            me.attributes.remove(me.attributes[nm])


def paint(ob, fn=None, light=0.22, ao=None):
    """Give an ordinary object a 'Col' attribute: fn(world_pos, normal) -> rgb (default white)."""
    me = ob.data
    if "Col" not in me.color_attributes:
        me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    ca = me.color_attributes["Col"]
    me.color_attributes.active_color = ca
    mw = ob.matrix_world
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            p = mw @ me.vertices[vi].co
            nn = (mw.to_3x3() @ me.vertices[vi].normal).normalized()
            c = fn(p, nn) if fn else (1, 1, 1)
            if light:
                c = R.shade(c, nn, amt=light)
            if ao:
                c = mulc(c, 0.7 + 0.3 * R.smoothstep(ao[0], ao[1], p.z))
            ca.data[li].color = (c[0], c[1], c[2], 1.0)
    return ob


def wood_fn(base=(1, 1, 1), seed=0, edge=0.12):
    off = V((seed * 3.7, seed * 1.3, 0))

    def fn(p, n):
        k = 0.88 + 0.16 * C.fbm(p * 2.2 + off, 3)
        return mulc(base, k)
    return fn


def ensure_cols(objs):
    for o in objs:
        if o.type == "MESH" and "Col" not in o.data.color_attributes:
            paint(o, None, light=0)


# ----------------------------------------------------------------------------- plants
def width_fn(shape):
    if shape == "ovate":
        return lambda t: math.sin(PI * min(1, t)) ** 0.75 * (1 - 0.35 * t) + 0.02
    if shape == "lance":
        return lambda t: math.sin(PI * min(1, t)) ** 1.1 * (1 - 0.3 * t) * 0.7 + 0.01
    if shape == "heart":
        return lambda t: (math.sin(PI * min(1, t ** 0.8)) ** 0.6) * (1 - 0.15 * t) + 0.04
    if shape == "petal":
        return lambda t: math.sin(PI * min(1, t ** 0.9)) ** 0.55 * (0.55 + 0.45 * t) + 0.02
    if shape == "round":
        return lambda t: math.sin(PI * min(1, t)) ** 0.5 + 0.03
    if shape == "strap":
        return lambda t: (1 - t ** 3) * 0.9 * min(1, t * 6) + 0.03
    return lambda t: math.sin(PI * t)


def leaf(vb, base, d, up, L, W, cb, ct, shape="ovate", segs=6, cols=2, fold=0.2, droop=0.25, curl_side=0.0, serr=0.0,
         rib=0.12, edge=None, twist=0.0, spots=None):
    """A sculpted leaf/petal: a grid along d, folded at the midrib, drooping, coloured base->tip."""
    d = V(d).normalized()
    up = V(up)
    side = d.cross(up)
    if side.length < 1e-4:
        side = d.cross(V((1, 0, 0)))
    side.normalize()
    if twist:
        side = Matrix.Rotation(twist, 3, d) @ side
    nrm = side.cross(d).normalized()
    if nrm.dot(up) < 0:
        nrm = -nrm
    wf = width_fn(shape)
    rows = []
    for i in range(segs + 1):
        t = i / segs
        w = wf(t) * W
        row = []
        bend = d * (L * t) + nrm * (-droop * L * t * t)
        for j in range(-cols, cols + 1):
            u = j / cols
            ww = w * (1 + serr * math.sin(t * 34) if abs(j) == cols else w)
            ww = (w * (1 + serr * math.sin(t * 34 + (j > 0) * 1.3)) if abs(j) == cols else w)
            p = V(base) + bend + side * (u * ww) + nrm * (fold * abs(u) * w + curl_side * u * u * w)
            c = lerp(cb, ct, t)
            if rib and j == 0:
                c = mulc(c, 1 + rib)
            if edge is not None and abs(j) == cols:
                c = lerp(c, edge, 0.5)
            if spots and spots(t, u):
                c = spots(t, u)
            row.append(vb.v(p, c))
        rows.append(row)
    for i in range(segs):
        for j in range(2 * cols):
            vb.f((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]),
                 ((j / (2 * cols), i / segs), ((j + 1) / (2 * cols), i / segs), ((j + 1) / (2 * cols), (i + 1) / segs),
                  (j / (2 * cols), (i + 1) / segs)))
    return rows


def curve_pts(p0, p1, bow=V((0, 0, 0)), n=6):
    p0, p1 = V(p0), V(p1)
    return [p0.lerp(p1, i / n) + V(bow) * math.sin(PI * i / n) for i in range(n + 1)]


def mound(vb, r, h, col=(0.3, 0.2, 0.13), seg=20):
    """A small crumbly soil mound under a plant (sinks into the bed's soil)."""
    prof = [(0.0, h), (r * 0.3, h * 0.92), (r * 0.6, h * 0.6), (r * 0.85, h * 0.2), (r, -0.01)]
    n0 = len(vb.bm.verts)
    vb.lathe([(a, b) for a, b in reversed(prof)], col, segs=seg, cap=False)
    vb.bm.verts.ensure_lookup_table()
    for v in list(vb.bm.verts)[n0:]:
        q = v.co.copy()
        k = C.fbm(q * 60, 2)
        v.co += V((q.x, q.y, 0)).normalized() * r * 0.12 * k + V((0, 0, h * 0.25 * k * (v.co.z > 0)))


# ----------------------------------------------------------------------------- kit + export
def layout(objs, gap=0.4):
    """Place kit nodes side by side along X (each keeps its origin at its base centre)."""
    x = 0.0
    for i, o in enumerate(objs):
        bb = [o.matrix_world @ V(c) for c in o.bound_box]
        w0 = min(v.x for v in bb) - o.location.x
        w1 = max(v.x for v in bb) - o.location.x
        if i:
            x += -w0
        o.location.x = x
        x += w1 + gap
    return objs


def fix_uv(objs):
    """One UV layer named 'UVMap' on every mesh (bmesh names its layer 'Float2'; join merges layers by name)."""
    for o in objs:
        if o.type != "MESH":
            continue
        me = o.data
        if not me.uv_layers:
            C.box_uv(o, 1.0)
        me.uv_layers[0].name = "UVMap"
        while len(me.uv_layers) > 1:
            me.uv_layers.remove(me.uv_layers[1])


def join(objs, name):
    objs = [o for o in objs if o.type == "MESH"]
    ensure_cols(objs)
    fix_uv(objs)
    ob = C.join(objs, name)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob


def set_origin(ob, point):
    p = V(point)
    d = p - ob.location
    ob.data.transform(Matrix.Translation(-d))
    ob.location = p


def export(name, objs):
    fix_uv([o for o in objs if o.type == "MESH"] + [c for o in objs for c in o.children_recursive if c.type == "MESH"])
    ensure_cols([o for o in objs if o.type == "MESH"] + [c for o in objs for c in o.children_recursive if c.type == "MESH"])
    return C.export(name, objs)
