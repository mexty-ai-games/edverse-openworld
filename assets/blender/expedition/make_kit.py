"""Expedition kit props: the glowing seed "spark", the Field Camera, the hand lens and the Field Guide.

OW_TEX=<tex> OW_OUT=<glb> blender -b --factory-startup -P make_kit.py [-- name ...]
spark.glb        nodes spark_seed (emissive core), spark_glow (soft halo shell, scale/opacity it to pulse),
                 spark_sprout; ~0.2 m tall, origin at its base.
field_camera.glb nodes camera_body, camera_strap (hide the strap when held); ~0.17 m wide, lens faces -Y.
hand_lens.glb    one node hand_lens; ~0.22 m long, handle down (-Z), glass faces -Y.
field_guide.glb  nodes guide_closed and guide_open, same origin (show one); ~0.22 x 0.16 m closed.
Materials named spark_glow / spark_core carry the emission the game pulses.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from xrig import C, smooth_pts, tint_mat, unify_uv  # noqa: E402

V = Vector


def obj_lathe(name, prof, mat, segs=32, loc=(0, 0, 0), rot=None, sy=1.0):
    bm = bmesh.new()
    C.lathe(bm, prof, segs=segs, v_scale=2)
    for v in bm.verts:
        v.co.y *= sy
    ob = C.new_obj(name, bm, [mat])
    if rot is not None:
        ob.rotation_euler = rot
    ob.location = loc
    C.shade_flat_bevel(ob)
    return ob


def obj_tube(name, pts, rads, mat, sides=10, cap=True):
    bm = bmesh.new()
    C.tube(bm, [V(p) for p in pts], rads, sides=sides, cap_end=cap)
    ob = C.new_obj(name, bm, [mat])
    C.shade_smooth(ob)
    return ob


def obj_ell(name, ctr, rad, mat, seg=24, ring=14, fn=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=1.0, calc_uvs=True)
    for v in bm.verts:
        u = V(v.co)
        p = V((u.x * rad[0], u.y * rad[1], u.z * rad[2]))
        if fn:
            p += fn(u)
        v.co = p + V(ctr)
    ob = C.new_obj(name, bm, [mat])
    C.shade_smooth(ob)
    return ob


def torus(name, ctr, R0, r, mat, axis="Y", segs=32, ring=10):
    bm = bmesh.new()
    vs = []
    for i in range(segs):
        for j in range(ring):
            a, b = i / segs * math.pi * 2, j / ring * math.pi * 2
            vs.append(bm.verts.new(((R0 + r * math.cos(b)) * math.cos(a), (R0 + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
    for i in range(segs):
        for j in range(ring):
            bm.faces.new((vs[i * ring + j], vs[((i + 1) % segs) * ring + j], vs[((i + 1) % segs) * ring + (j + 1) % ring], vs[i * ring + (j + 1) % ring]))
    ob = C.new_obj(name, bm, [mat])
    if axis == "Y":
        ob.rotation_euler = (math.pi / 2, 0, 0)
    elif axis == "X":
        ob.rotation_euler = (0, math.pi / 2, 0)
    ob.location = ctr
    C.shade_smooth(ob)
    return ob


def blend(m, alpha):
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Alpha"].default_value = alpha
    try:
        m.surface_render_method = "BLENDED"
    except Exception:
        m.blend_method = "BLEND"
    return m


def join(objs, name):
    """Join and bake the location too, so every node's origin is the prop's origin."""
    unify_uv(objs)
    ob = C.join(objs, name)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob


# =============================================================================== spark (glowing seed)
def spark():
    core = C.material("spark_core", color=(1.0, 0.62, 0.1), emissive=(1.0, 0.5, 0.05), emissive_strength=0.7, rough=0.35)
    vein = C.material("spark_vein", color=(1.0, 0.97, 0.75), emissive=(1.0, 0.92, 0.5), emissive_strength=1.6, rough=0.3)
    glow = blend(C.material("spark_glow", color=(1.0, 0.7, 0.2), emissive=(1.0, 0.6, 0.15), emissive_strength=0.6, rough=0.5, double=True), 0.14)
    leaf = C.material("spark_leaf", color=(0.45, 0.85, 0.3), emissive=(0.3, 0.7, 0.2), emissive_strength=0.6, rough=0.5)
    # teardrop seed with soft grooves
    seed = obj_ell("spark_seed_core", (0, 0, 0.075), (0.045, 0.045, 0.065), core, seg=28, ring=16,
                   fn=lambda u: V((0, 0, 0.02 * max(0.0, u.z) ** 2)) + V((u.x, u.y, 0)) * (-0.004 * (0.5 + 0.5 * math.cos(math.atan2(u.y, u.x) * 6))))
    veins = []
    for k in range(6):
        a = k / 6 * math.pi * 2 + math.pi / 6
        pts = [V((math.cos(a) * 0.044 * math.sin(t * math.pi * 0.95 + 0.1), math.sin(a) * 0.044 * math.sin(t * math.pi * 0.95 + 0.1),
                  0.075 - 0.062 + t * 0.15)) for t in [i / 10 for i in range(11)]]
        veins.append(obj_tube(f"spark_vein{k}", pts, [0.0035] * 11, vein, sides=5))
    seed_ob = join([seed] + veins, "spark_seed")
    sprout = [obj_tube("spark_stem", smooth_pts([(0, 0, 0.15), (0.005, 0, 0.18), (-0.005, 0, 0.2)], 3), [0.006, 0.0055, 0.005, 0.0045, 0.004, 0.004, 0.0035],
                       leaf, sides=6)]
    for s in (1, -1):
        sprout.append(obj_ell(f"spark_leaf{s}", (s * 0.022, 0, 0.205), (0.022, 0.011, 0.004), leaf, seg=12, ring=6,
                              fn=lambda u, s=s: V((0, 0, 0.012 * (u.x * s + 1) ** 2 * 0.5))))
    sprout_ob = join(sprout, "spark_sprout")
    halo = obj_ell("spark_glow", (0, 0, 0.085), (0.075, 0.075, 0.1), glow, seg=24, ring=14, fn=lambda u: V((0, 0, 0.02 * max(0.0, u.z) ** 2)))
    halo = join([halo], "spark_glow")
    return [seed_ob, sprout_ob, halo]


# =============================================================================== field camera
def field_camera():
    leather = C.material("camera_leather", tex="leather.jpg", rough=0.6)
    metal = C.material("camera_metal", tex="brass.jpg", rough=0.3, metal=0.85)
    silver = tint_mat(C.material("camera_trim", tex="brass.jpg", rough=0.28, metal=0.9), (0.85, 0.88, 0.92))
    dark = C.material("camera_dark", color=(0.08, 0.08, 0.09), rough=0.45)
    glass = C.material("camera_glass", color=(0.25, 0.45, 0.6), rough=0.04, metal=0.2, emissive=(0.15, 0.3, 0.45), emissive_strength=0.4)
    red = C.material("camera_button", color=(0.9, 0.25, 0.18), rough=0.35)
    strap_m = tint_mat(C.material("camera_strap", tex="leather.jpg", rough=0.6), (1.2, 0.95, 0.7))
    W, D, H = 0.17, 0.07, 0.1
    body = [C.box_obj("cam_core", (W, D, H * 0.72), (0, 0, H * 0.42), leather, bevel=0.014, segments=3, uv_scale=6)]
    body.append(C.box_obj("cam_top", (W * 1.01, D * 1.02, H * 0.2), (0, 0, H * 0.86), silver, bevel=0.01, segments=3))
    body.append(C.box_obj("cam_bottom", (W * 1.01, D * 1.02, H * 0.08), (0, 0, H * 0.04), silver, bevel=0.008, segments=2))
    # viewfinder hump + window, winder knob, shutter button, flash shoe
    body.append(C.box_obj("cam_hump", (0.06, 0.05, 0.03), (0, 0, H + 0.006), silver, bevel=0.01, segments=3))
    body.append(C.box_obj("cam_window", (0.03, 0.006, 0.016), (0.0, -0.025, H + 0.008), glass, bevel=0.003, segments=1))
    body.append(obj_lathe("cam_winder", [(0.0, 0.0), (0.016, 0.0), (0.017, 0.012), (0.014, 0.016), (0.0, 0.016)], metal, segs=20, loc=(0.055, 0.008, H * 0.95)))
    body.append(obj_lathe("cam_dial", [(0.0, 0.0), (0.013, 0.0), (0.013, 0.008), (0.0, 0.008)], silver, segs=20, loc=(-0.05, 0.01, H * 0.95)))
    body.append(obj_lathe("cam_shutter", [(0.0, 0.0), (0.007, 0.0), (0.007, 0.01), (0.005, 0.013), (0.0, 0.013)], red, segs=16, loc=(-0.05, 0.01, H * 0.95 + 0.008)))
    # big friendly lens barrel with rings
    prof = [(0.0, 0.0), (0.04, 0.0), (0.042, 0.008), (0.038, 0.012), (0.038, 0.03), (0.041, 0.033), (0.041, 0.042), (0.036, 0.045), (0.034, 0.055),
            (0.037, 0.058), (0.037, 0.064), (0.03, 0.066), (0.0, 0.066)]
    body.append(obj_lathe("cam_lens", prof, dark, segs=36, loc=(0, -D / 2 + 0.002, H * 0.45), rot=(math.pi / 2, 0, 0)))
    body.append(torus("cam_lens_ring", (0, -D / 2 - 0.035, H * 0.45), 0.039, 0.004, silver, axis="Y"))
    body.append(torus("cam_lens_ring2", (0, -D / 2 - 0.06, H * 0.45), 0.034, 0.004, metal, axis="Y"))
    body.append(obj_ell("cam_glass", (0, -D / 2 - 0.063, H * 0.45), (0.027, 0.006, 0.027), glass, seg=24, ring=10))
    body.append(obj_ell("cam_glint", (0.01, -D / 2 - 0.068, H * 0.45 + 0.01), (0.006, 0.002, 0.006),
                        C.material("cam_glint", color=(1, 1, 1), emissive=(1, 1, 1), emissive_strength=2), seg=8, ring=5))
    # strap lugs
    for s in (1, -1):
        body.append(torus(f"cam_lug{s}", (s * (W / 2 + 0.006), 0, H * 0.78), 0.009, 0.003, silver, axis="X", segs=14, ring=6))
    cam = join(body, "camera_body")
    # strap: an arc above the camera, flat leather band
    pts = [V((0.091, 0, H * 0.78)), V((0.12, 0.0, 0.16)), V((0.1, 0.01, 0.28)), V((0.0, 0.02, 0.33)), V((-0.1, 0.01, 0.28)), V((-0.12, 0.0, 0.16)),
           V((-0.091, 0, H * 0.78))]
    sp = smooth_pts(pts, 5)
    st = obj_tube("camera_strap", sp, [0.008] * len(sp), strap_m, sides=8, cap=False)
    for v in st.data.vertices:  # flatten into a band
        v.co.y *= 0.4
    return [cam, st]


# =============================================================================== hand lens
def hand_lens():
    brass = C.material("lens_brass", tex="brass.jpg", rough=0.3, metal=0.85)
    wood = C.material("lens_wood", tex="wood.jpg", rough=0.55)
    glass = blend(C.material("lens_glass", color=(0.7, 0.88, 1.0), rough=0.02, double=True), 0.3)
    shine = C.material("lens_shine", color=(1, 1, 1), emissive=(1, 1, 1), emissive_strength=1.5)
    Z0 = 0.15
    parts = [torus("lens_rim", (0, 0, Z0), 0.055, 0.008, brass, axis="Y", segs=40, ring=10),
             obj_ell("lens_disc", (0, 0, Z0), (0.052, 0.006, 0.052), glass, seg=32, ring=10),
             obj_ell("lens_glint", (-0.022, -0.007, Z0 + 0.022), (0.012, 0.001, 0.006), shine, seg=10, ring=5,
                     fn=lambda u: V((0, 0, 0))),
             obj_lathe("lens_ferrule", [(0.0, 0.0), (0.012, 0.0), (0.013, 0.015), (0.011, 0.03), (0.0, 0.03)], brass, segs=20, loc=(0, 0, Z0 - 0.088)),
             obj_lathe("lens_handle", [(0.0, 0.0), (0.012, 0.0), (0.015, 0.01), (0.016, 0.04), (0.014, 0.075), (0.012, 0.09), (0.0, 0.092)], wood,
                       segs=20, loc=(0, 0, Z0 - 0.088), rot=(math.pi, 0, 0))]
    parts[-1].location = (0, 0, Z0 - 0.088)
    parts.append(obj_tube("lens_neck", [(0, 0, Z0 - 0.06), (0, 0, Z0 - 0.06 - 0.005)], [0.009, 0.01], brass, sides=12))
    ob = join(parts, "hand_lens")
    # origin at the handle end
    mn = min(v.co.z for v in ob.data.vertices)
    for v in ob.data.vertices:
        v.co.z -= mn
    return [ob]


# =============================================================================== field guide
def field_guide():
    leather = tint_mat(C.material("guide_cover", tex="leather.jpg", rough=0.6), (0.85, 1.0, 0.75))
    paper_edge = C.material("guide_page_edge", color=(0.95, 0.9, 0.76), rough=0.9)
    paper = C.material("guide_pages", tex="paper.jpg", rough=0.9)
    ribbon = C.material("guide_ribbon", color=(0.85, 0.2, 0.18), rough=0.6)
    gold = C.material("guide_emblem", tex="brass.jpg", rough=0.3, metal=0.85)
    band_m = C.material("guide_band", color=(0.2, 0.15, 0.12), rough=0.5)
    W, Hh, T = 0.16, 0.22, 0.035  # width (x), height (y), thickness (z)
    # closed: lying flat, cover up
    cl = [C.box_obj("gc_back", (W, Hh, 0.006), (0, 0, 0.003), leather, bevel=0.003, segments=2, uv_scale=6),
          C.box_obj("gc_front", (W, Hh, 0.006), (0, 0, T - 0.003), leather, bevel=0.003, segments=2, uv_scale=6),
          C.box_obj("gc_pages", (W - 0.01, Hh - 0.012, T - 0.012), (0.004, 0, T / 2), paper_edge, bevel=0.002, segments=1)]
    cl.append(obj_tube("gc_spine", [(-W / 2, -Hh / 2, T / 2), (-W / 2, Hh / 2, T / 2)], [T / 2] * 2, leather, sides=16))
    for v in cl[-1].data.vertices:
        if v.co.x > -W / 2:
            v.co.x = -W / 2 + (v.co.x + W / 2) * 0.3
    # embossed leaf emblem
    em = obj_ell("gc_leaf", (0.01, 0.01, T + 0.0005), (0.028, 0.045, 0.0015), gold, seg=16, ring=6,
                 fn=lambda u: V((0.01 * u.y * u.y, 0, 0)))
    vein = obj_tube("gc_vein", [(0.01, -0.035, T + 0.001), (0.012, 0.05, T + 0.001)], [0.0018, 0.0012], gold, sides=4)
    cl += [em, vein]
    # elastic band and the ribbon bookmark hanging out of the bottom
    cl.append(C.box_obj("gc_band", (0.012, Hh + 0.004, T + 0.004), (W / 2 - 0.025, 0, T / 2), band_m, bevel=0.002, segments=1))
    rb = smooth_pts([(0.03, -Hh / 2 + 0.01, T / 2), (0.032, -Hh / 2 - 0.02, T / 2 - 0.004), (0.028, -Hh / 2 - 0.045, 0.004), (0.035, -Hh / 2 - 0.06, 0.001)], 3)
    rib = obj_tube("gc_ribbon", rb, [0.004] * len(rb), ribbon, sides=6)
    for v in rib.data.vertices:
        v.co.x = 0.03 + (v.co.x - 0.03) * 2.5
    cl.append(rib)
    closed = join(cl, "guide_closed")
    # open: two covers flat, two slightly curved page stacks with the painted spread on top
    op = []
    for s in (1, -1):
        op.append(C.box_obj(f"go_cover{s}", (W + 0.004, Hh + 0.006, 0.006), (s * (W / 2 + 0.002), 0, 0.003), leather, bevel=0.003, segments=2, uv_scale=6))
    # page block: a curved sheet stack per side; top surface UV-mapped to half of paper.jpg
    for s in (1, -1):
        bm = bmesh.new()
        uv = bm.loops.layers.uv.verify()
        nx, ny = 16, 2
        top, bot = [], []
        for i in range(nx + 1):
            x = i / nx
            z = 0.006 + 0.016 * math.sin(min(1.0, x * 1.25) * math.pi * 0.5) - 0.006 * x * x
            xx = s * (0.004 + x * (W - 0.01))
            top.append([bm.verts.new((xx, (j / ny - 0.5) * (Hh - 0.012), z)) for j in range(ny + 1)])
            bot.append([bm.verts.new((xx, (j / ny - 0.5) * (Hh - 0.012), 0.006)) for j in range(ny + 1)])
        for i in range(nx):
            for j in range(ny):
                q = [top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1]]
                if s < 0:
                    q = q[::-1]
                f = bm.faces.new(q)
                f.material_index = 0
                for lp in f.loops:
                    # left page -> u in [0, .5], right page -> [.5, 1]
                    ii = next(k for k in range(nx + 1) if lp.vert in top[k])
                    jj = next(k for k in range(ny + 1) if lp.vert is top[ii][k])
                    u = 0.5 + s * 0.5 * (ii / nx)
                    lp[uv].uv = (u, jj / ny)
        # page edges (outer side + top/bottom)
        rim = [top[nx][j] for j in range(ny + 1)]
        rimb = [bot[nx][j] for j in range(ny + 1)]
        for j in range(ny):
            q = [rim[j], rimb[j], rimb[j + 1], rim[j + 1]]
            f = bm.faces.new(q if s > 0 else q[::-1])
            f.material_index = 1
        for j, js in ((0, 1), (ny, -1)):
            for i in range(nx):
                q = [top[i][j], bot[i][j], bot[i + 1][j], top[i + 1][j]]
                f = bm.faces.new(q if (s * js) > 0 else q[::-1])
                f.material_index = 1
        ob = C.new_obj(f"go_pages{s}", bm, [paper, paper_edge])
        C.shade_smooth(ob)
        op.append(ob)
    rb = smooth_pts([(0.0, Hh / 2 - 0.01, 0.024), (0.004, -0.02, 0.025), (0.0, -Hh / 2 + 0.005, 0.02), (0.006, -Hh / 2 - 0.04, 0.002)], 4)
    rib = obj_tube("go_ribbon", rb, [0.004] * len(rb), ribbon, sides=6)
    op.append(rib)
    opened = join(op, "guide_open")
    return [closed, opened]


KIT = {"spark": spark, "field_camera": field_camera, "hand_lens": hand_lens, "field_guide": field_guide}

if __name__ == "__main__":
    which = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(KIT)
    for name in which:
        C.reset()
        objs = KIT[name]()
        C.export(name, objs)
        if name == "field_guide":  # icon helpers (not uploaded): each state on its own
            for o in objs:
                C.export("_icon_" + o.name, [o])
        if name == "field_camera":
            C.export("_icon_camera_body", [objs[0]])
