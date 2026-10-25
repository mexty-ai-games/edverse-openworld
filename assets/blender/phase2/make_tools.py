"""Phase 2 field tools (held props): net, jar, ruler, tape, balance scale, brush, trowel, sound recorder, lantern.

OW_TEX=<tex> OW_OUT=<glb> blender -b --factory-startup -P make_tools.py [-- name ...]

Real-world size in metres (a child-held tool). Origin = the hand grip; the tool points up (+Z in Blender, +Y in
glTF) so it can be parented straight to a hand bone. Named nodes for the moving parts:
net: net_handle, net_bag (sways) · jar: jar_glass, jar_lid (unscrews), jar_leaf · tape: tape_case, tape_blade
(scale X to pull it out, 1 = 30 cm) · scale: scale_base, scale_beam (tilt about X), scale_pan_L / scale_pan_R
(move in Z with the beam), scale_pointer · recorder: recorder_body, recorder_led (material 'recorder_led', blink
its emissive) · lantern: lantern_body, lantern_glow (material 'lantern_glow' = the light, add a PointLight there).
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import p2 as R  # noqa: E402
from p2 import C, blob, box, flat, lathe_obj, mixc, shade, smooth_pts, soft, tube  # noqa: E402

V = Vector


def lin(c):
    return tuple(max(0.0, x) ** 2.2 for x in c)


def painter(base, fn=None, amt=0.2):
    def f(p, n):
        c = fn(p, n) if fn else None
        return lin(shade(c if c is not None else base, n, amt))
    return f


def wood_m(name="tool_wood"):
    return C.material(name, tex="wood.jpg", normal="wood_n.jpg", rough=0.6, normal_strength=0.5)


def metal(name, color, rough=0.32):
    return C.material(name, color=color, rough=rough, metal=0.85)


def glass(name, color=(0.85, 0.95, 1.0), alpha=0.28):
    m = C.material(name, color=color, rough=0.05)
    m.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = alpha
    m.blend_method = "BLEND"
    try:
        m.surface_render_method = "BLENDED"
    except Exception:
        pass
    m.use_backface_culling = False
    return m


def torus(name, center, R0, r, mat, axis="Z", seg=32, ring=8, col=None, arc=1.0):
    pts = []
    for i in range(seg + 1):
        a = i / seg * math.pi * 2 * arc
        if axis == "Z":
            pts.append(V(center) + V((math.cos(a) * R0, math.sin(a) * R0, 0)))
        elif axis == "Y":
            pts.append(V(center) + V((math.cos(a) * R0, 0, math.sin(a) * R0)))
        else:
            pts.append(V(center) + V((0, math.cos(a) * R0, math.sin(a) * R0)))
    return tube(name, pts, [r] * len(pts), mat, sides=ring, col=col, cap=arc < 1.0)


def handle(name, z0, z1, r, mat, col=None, sides=14):
    """Turned wooden handle: slight belly, rounded butt."""
    n = 9
    pts = [V((0, 0, z0 + (z1 - z0) * i / (n - 1))) for i in range(n)]
    rad = [r * (0.85 + 0.25 * math.sin(math.pi * i / (n - 1))) for i in range(n)]
    rad[0] *= 0.8
    ob = tube(name, pts, rad, mat, sides=sides, col=col)
    return ob


# =============================================================================== butterfly net
def net():
    wood = wood_m()
    brass = metal("net_brass", (0.85, 0.66, 0.3))
    wire = metal("net_wire", (0.75, 0.75, 0.72), 0.4)
    mesh_m = C.material("net_mesh", tex="netmesh.png", alpha_tex=True, rough=0.8, double=True)
    mesh_m.use_backface_culling = False
    cloth = soft("net_rim", tex="fabric.jpg", rough=0.9)
    h = handle("net_handle_wood", -0.25, 0.75, 0.016, wood)
    grip = tube("net_grip", [V((0, 0, -0.22)), V((0, 0, 0.02))], [0.02, 0.02], cloth, sides=14, col=painter((0.25, 0.55, 0.62)))
    fer = lathe_obj("net_ferrule", [(0.018, 0.72), (0.02, 0.73), (0.02, 0.8), (0.014, 0.82)], brass, segs=16, cap=False)
    HC = V((0, 0, 0.82 + 0.2))
    hoop = torus("net_hoop", HC, 0.2, 0.007, wire, axis="Y", seg=40)
    rim = torus("net_rimcloth", HC, 0.2, 0.014, cloth, axis="Y", seg=40, ring=8, col=painter((0.96, 0.94, 0.86)))
    hb = C.join([h, grip, fer], "net_handle")
    hoopo = C.join([hoop, rim], "net_hoop")
    # the bag: hangs back from the hoop, a soft rounded cone (alpha-clipped mesh), separate node to sway
    bm = bmesh.new()
    segs, rings = 28, 9
    uvl = bm.loops.layers.uv.verify()
    grid = []
    for j in range(rings + 1):
        k = j / rings
        rr = 0.2 * math.cos(k * math.pi * 0.5) ** 0.7 + 0.004
        depth = 0.42 * k
        row = []
        for i in range(segs):
            a = i / segs * math.pi * 2
            x, z = math.cos(a) * rr, math.sin(a) * rr
            # droop down under gravity toward the tip
            p = HC + V((x, depth, z - 0.18 * k * k))
            row.append(bm.verts.new(p))
        grid.append(row)
    for j in range(rings):
        for i in range(segs):
            i2 = (i + 1) % segs
            f = bm.faces.new((grid[j][i], grid[j][i2], grid[j + 1][i2], grid[j + 1][i]))
            for lp, (u, v) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uvl].uv = (u / segs * 4, v / rings * 2)
    bag = C.new_obj("net_bag", bm, [mesh_m])
    C.shade_smooth(bag)
    C.paint_vcol(bag, painter((0.98, 0.98, 0.95)))
    C.paint_vcol(hoopo, painter((0.96, 0.94, 0.86)))
    head = C.join([hoopo], "net_hoop")
    R.set_origin(bag, HC)
    return [hb, head, bag]


# =============================================================================== catch-and-release jar
def jar():
    g = glass("jar_glass_m")
    tin = C.material("jar_lid_m", tex="paint.jpg", rough=0.4, metal=0.6, vcol=True)
    paper = soft("jar_label", tex="paper.jpg" if os.path.exists(os.path.join(C.TEX, "paper.jpg")) else "fabric.jpg", rough=0.9)
    leaf = soft("jar_leaf_m", tex="paint.jpg", rough=0.6)
    prof = [(0.0, 0.0), (0.055, 0.0), (0.065, 0.006), (0.07, 0.02), (0.07, 0.15), (0.064, 0.165), (0.05, 0.172), (0.05, 0.19)]
    body = lathe_obj("jar_glass", prof, g, segs=32, cap=False)
    # glass thickness ring at the lip
    lip = torus("jar_lip", (0, 0, 0.19), 0.05, 0.004, g, seg=32, ring=6)
    glass_n = C.join([body, lip], "jar_glass")
    # lid: domed tin, painted leaf green, with punched air holes (dark dimples) and a rolled rim
    lid = lathe_obj("jar_lid", [(0.0, 0.215), (0.03, 0.214), (0.048, 0.21), (0.056, 0.2), (0.057, 0.183), (0.054, 0.18)], tin, segs=32, cap=False)
    C.paint_vcol(lid, painter((0.3, 0.62, 0.38)))
    ribs = [torus(f"jar_lidrib{k}", (0, 0, 0.186 + k * 0.007), 0.0575, 0.0025, tin, seg=32, ring=5, col=painter((0.26, 0.55, 0.33))) for k in range(3)]
    holes = []
    hole_m = flat("jar_hole", (0.05, 0.06, 0.05), 0.6)
    for k in range(7):
        a = k / 7 * math.pi * 2
        r = 0.0 if k == 0 else 0.026
        if k == 0:
            p = V((0, 0, 0.2155))
        else:
            p = V((math.cos(a) * r, math.sin(a) * r, 0.2135))
        holes.append(blob(f"jar_hole{k}", p, (0.0045, 0.0045, 0.002), hole_m, seg=10, ring=5))
    lid_n = C.join([lid] + ribs + holes, "jar_lid")
    # a paper label band with a magnifier sketch, and a fresh leaf inside for the visitor
    lab = lathe_obj("jar_labelband", [(0.0712, 0.06), (0.0712, 0.12)], paper, segs=32, cap=False)
    C.paint_vcol(lab, painter((0.97, 0.93, 0.8)))
    lf = blob("jar_leafpiece", (0.0, 0.0, 0.012), (0.045, 0.022, 0.004), leaf, seg=14, ring=6,
              fn=lambda u: V((0, 0, 0.008 * u.x * u.x)), col=painter((0.4, 0.7, 0.3), lambda p, n: (0.62, 0.82, 0.45) if abs(p.y) < 0.002 else None))
    tw = tube("jar_twig", smooth_pts([(-0.04, 0.02, 0.01), (0.0, 0.0, 0.05), (0.03, -0.01, 0.1)], 3), [0.004] * 7, leaf, sides=5,
              col=painter((0.5, 0.36, 0.22)))
    inside = C.join([lf, tw], "jar_leaf")
    glass_n = C.join([glass_n, lab], "jar_glass")
    for o in (glass_n, lid_n, inside):
        o.location.z -= 0.0  # grip = jar base centre
    R.set_origin(lid_n, (0, 0, 0.2))
    return [glass_n, lid_n, inside]


# =============================================================================== ruler (30 cm, wood, painted scale)
def ruler():
    wood = wood_m("ruler_wood")
    face = C.material("ruler_face", tex="ruler.png", rough=0.55)
    body = box("ruler_body", (0.32, 0.034, 0.004), (0.0, 0.0, 0.0), wood, bevel=0.0015, uv=6)
    # top face with the scale texture (U along X = 0..30 cm)
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((-0.157, -0.016, 0.0021), (0.157, -0.016, 0.0021), (0.157, 0.016, 0.0021), (-0.157, 0.016, 0.0021))]
    f = bm.faces.new(vs)
    uv = bm.loops.layers.uv.verify()
    for lp, t in zip(f.loops, ((0, 1), (1, 1), (1, 0), (0, 0))):
        lp[uv].uv = t
    top = C.new_obj("ruler_scale", bm, [face])
    hole = blob("ruler_hole", (0.148, 0.0, 0.0), (0.004, 0.004, 0.0035), flat("ruler_holem", (0.2, 0.14, 0.08)), seg=10, ring=6)
    r = C.join([body, top, hole], "ruler")
    # stand it up: held at one end, pointing up
    r.rotation_euler = (0, -math.pi / 2, math.pi / 2)   # long axis up, scale face toward -Y (the viewer)
    r.location = (0, 0, 0.14)
    bpy.context.view_layer.objects.active = r
    r.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    r.select_set(False)
    return [r]


# =============================================================================== tape measure
def tape():
    shell = soft("tape_case_m", tex="paint.jpg", rough=0.4)
    rub = soft("tape_rubber", tex="fabric.jpg", rough=0.9)
    steel = metal("tape_hook", (0.78, 0.78, 0.76))
    blade_m = C.material("tape_blade_m", tex="ruler.png", rough=0.45)
    # round case on its side (disc in the XZ plane), grip at its centre
    case = lathe_obj("tape_case_shell", [(0.0, -0.022), (0.04, -0.022), (0.05, -0.016), (0.052, 0.0), (0.05, 0.016), (0.04, 0.022), (0.0, 0.022)],
                     shell, segs=36, cap=False, rot=(math.pi / 2, 0, 0))
    C.paint_vcol(case, painter((1.0, 0.76, 0.18)))
    band = lathe_obj("tape_band", [(0.0535, -0.012), (0.0535, 0.012)], rub, segs=36, cap=False, rot=(math.pi / 2, 0, 0))
    C.paint_vcol(band, painter((0.2, 0.22, 0.24)))
    hub = blob("tape_hub", (0, -0.023, 0), (0.016, 0.004, 0.016), steel, seg=16, ring=6)
    btn = blob("tape_lock", (0.0, 0.0, 0.054), (0.012, 0.01, 0.006), rub, seg=12, ring=6, col=painter((0.85, 0.25, 0.2)))
    case_n = C.join([case, band, hub, btn], "tape_case")
    # blade: 30 cm out along +X from the mouth; scale X of this node to pull it in/out (origin at the mouth)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.verify()
    n = 10
    rows = []
    for i in range(n + 1):
        x = 0.3 * i / n
        row = []
        for j, w in enumerate((-0.0095, 0.0, 0.0095)):
            row.append(bm.verts.new((x, w, 0.0035 * (1 - abs(w) / 0.0095))))  # slight concave curve like real tape
        rows.append(row)
    for i in range(n):
        for j in range(2):
            f = bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]))
            for lp, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uv].uv = (a / n, 1 - b / 2)
    blade = C.new_obj("tape_blade", bm, [blade_m])
    hook = box("tape_hookend", (0.004, 0.022, 0.016), (0.302, 0, 0.004), steel, bevel=0.001)
    blade = C.join([blade, hook], "tape_blade")
    blade.location = (0.05, 0, -0.045)
    bpy.context.view_layer.objects.active = blade
    return [case_n, blade]


# =============================================================================== pan balance scale
def scale():
    wood = wood_m("scale_wood")
    brass = metal("scale_brass", (0.88, 0.68, 0.32), 0.28)
    base = lathe_obj("scale_base_w", [(0.0, 0.0), (0.13, 0.0), (0.135, 0.01), (0.13, 0.03), (0.11, 0.04), (0.0, 0.04)], wood, segs=32, cap=False)
    post = lathe_obj("scale_post", [(0.022, 0.04), (0.016, 0.06), (0.012, 0.3), (0.02, 0.31), (0.02, 0.33)], brass, segs=16, cap=False)
    base_n = C.join([base, post], "scale_base")
    PZ = 0.34
    beam = tube("scale_beam_bar", [V((-0.2, 0, PZ)), V((-0.1, 0, PZ + 0.008)), V((0, 0, PZ + 0.012)), V((0.1, 0, PZ + 0.008)), V((0.2, 0, PZ))],
                [0.008, 0.009, 0.012, 0.009, 0.008], brass, sides=10)
    knob = [blob(f"scale_knob{s}", (s * 0.205, 0, PZ), (0.013,) * 3, brass, seg=12, ring=8) for s in (-1, 1)]
    pivot = blob("scale_pivot", (0, 0, PZ + 0.01), (0.022, 0.015, 0.022), brass, seg=14, ring=8)
    beam_n = C.join([beam, pivot] + knob, "scale_beam")
    pointer = tube("scale_pointer", [V((0, -0.016, PZ + 0.012)), V((0, -0.016, PZ + 0.13))], [0.004, 0.002], brass, sides=6)
    dial = lathe_obj("scale_dial", [(0.0, 0.0), (0.05, 0.0), (0.05, 0.004)], wood, segs=24, cap=False,
                     rot=(math.pi / 2, 0, 0), loc=(0, -0.012, PZ + 0.1))
    pointer_n = C.join([pointer], "scale_pointer")
    base_n = C.join([base_n, dial], "scale_base")
    pans = []
    for s, sd in ((-1, "L"), (1, "R")):
        cx = s * 0.205
        dish = lathe_obj(f"scale_dish{sd}", [(0.0, 0.0), (0.06, 0.006), (0.085, 0.022), (0.088, 0.026)], brass, segs=28, cap=False, loc=(cx, 0, 0.12))
        rods = []
        for k in range(3):
            a = k / 3 * math.pi * 2 + 0.5
            rods.append(tube(f"scale_cord{sd}{k}", [V((cx + math.cos(a) * 0.082, math.sin(a) * 0.082, 0.146)), V((cx, 0, PZ - 0.012))], [0.0018, 0.0018],
                             brass, sides=4, cap=False))
        hook = blob(f"scale_hook{sd}", (cx, 0, PZ - 0.012), (0.008,) * 3, brass, seg=8, ring=6)
        pans.append(C.join([dish, hook] + rods, f"scale_pan_{sd}"))
    R.set_origin(beam_n, (0, 0, PZ))
    R.set_origin(pointer_n, (0, 0, PZ))
    for p, s in zip(pans, (-1, 1)):
        R.set_origin(p, (s * 0.205, 0, PZ - 0.012))
    return [base_n, beam_n, pointer_n] + pans


# =============================================================================== soft brush
def brush():
    wood = wood_m("brush_wood")
    brass = metal("brush_ferrule", (0.86, 0.66, 0.32))
    bristle = soft("brush_bristle", tex="bark.jpg", rough=0.9)
    h = handle("brush_handle", -0.02, 0.15, 0.011, wood)
    tip = blob("brush_butt", (0, 0, -0.02), (0.009, 0.009, 0.008), wood, seg=12, ring=6)
    fer = lathe_obj("brush_fer", [(0.012, 0.145), (0.018, 0.16), (0.02, 0.19), (0.021, 0.2)], brass, segs=18, cap=False)
    # flat, fluffy hog-hair tuft: soft rounded end, painted cream with a dusty tip
    tuft = blob("brush_tuft", (0, 0, 0.235), (0.026, 0.011, 0.045), bristle, seg=18, ring=10,
                fn=lambda u: V((0.004 * u.x * (u.z > 0), 0, -0.012 * (u.x * u.x) * (u.z > 0))), noise=0.002, nscale=120,
                col=painter((0.95, 0.88, 0.7), lambda p, n: (0.78, 0.66, 0.5) if p.z > 0.262 else None))
    hang = torus("brush_cord", (0, 0, -0.035), 0.012, 0.0025, flat("brush_cordm", (0.75, 0.25, 0.2), 0.9), axis="Y", seg=16, ring=4)
    return [C.join([h, tip, fer, tuft, hang], "brush")]


# =============================================================================== trowel
def trowel():
    wood = wood_m("trowel_wood")
    steel = metal("trowel_steel", (0.62, 0.63, 0.64), 0.38)
    h = handle("trowel_handle", 0.0, 0.11, 0.015, wood)
    cap = blob("trowel_cap", (0, 0, -0.002), (0.014, 0.014, 0.01), wood, seg=12, ring=6)
    fer = lathe_obj("trowel_fer", [(0.014, 0.105), (0.011, 0.125), (0.007, 0.135)], steel, segs=14, cap=False)
    tang = tube("trowel_tang", smooth_pts([(0, 0, 0.13), (0, -0.012, 0.15), (0, -0.018, 0.17)], 3), [0.006] * 7, steel, sides=8)
    # pointed archaeologist's trowel blade with a gentle scoop
    bm = bmesh.new()
    uv = bm.loops.layers.uv.verify()
    n, m = 10, 6
    rows = []
    for i in range(n + 1):
        k = i / n
        w = 0.045 * (1 - k ** 1.6) * (0.85 + 0.15 * math.sin(k * math.pi))
        row = []
        for j in range(m + 1):
            s = j / m * 2 - 1
            x = s * w
            row.append(bm.verts.new((x, -0.018 - 0.006 * (1 - s * s), 0.17 + k * 0.15)))
        rows.append(row)
    for i in range(n):
        for j in range(m):
            f = bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
            for lp, (a, b) in zip(f.loops, ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))):
                lp[uv].uv = (a / m, b / n)
    blade = C.new_obj("trowel_blade", bm, [steel])
    sol = blade.modifiers.new("s", "SOLIDIFY")
    sol.thickness = 0.003
    C.apply_all(blade)
    C.shade_smooth(blade)
    return [C.join([h, cap, fer, tang, blade], "trowel")]


# =============================================================================== sound recorder
def recorder():
    shell = soft("recorder_shell", tex="paint.jpg", rough=0.45)
    rub = soft("recorder_rubber", tex="fabric.jpg", rough=0.9)
    grille = metal("recorder_grille", (0.7, 0.72, 0.74), 0.5)
    scr = C.material("recorder_screen", tex="screen.png", rough=0.2, emissive_tex="screen.png", emissive_strength=0.6)
    led = C.material("recorder_led", color=(1.0, 0.3, 0.25), rough=0.3, emissive=(1.0, 0.25, 0.2), emissive_strength=3.0)
    fur = soft("recorder_windshield", tex="bark.jpg", rough=1.0)
    body = box("recorder_case", (0.065, 0.03, 0.15), (0, 0, 0.065), shell, bevel=0.014, seg=4, col=painter((0.24, 0.62, 0.66)))
    gripb = box("recorder_grip", (0.069, 0.034, 0.06), (0, 0, 0.02), rub, bevel=0.012, seg=3, col=painter((0.2, 0.22, 0.25)))
    # screen with a waveform, big red record button, two small buttons
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((-0.024, -0.0155, 0.085), (0.024, -0.0155, 0.085), (0.024, -0.0155, 0.115), (-0.024, -0.0155, 0.115))]
    f = bm.faces.new(vs)
    uv = bm.loops.layers.uv.verify()
    for lp, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = t
    screen = C.new_obj("recorder_scr", bm, [scr])
    rec = blob("recorder_recbtn", (0, -0.016, 0.06), (0.012, 0.005, 0.012), shell, seg=16, ring=8, col=painter((0.92, 0.26, 0.22)))
    btns = [blob(f"recorder_btn{s}", (s * 0.02, -0.016, 0.062), (0.005, 0.003, 0.005), rub, seg=10, ring=6, col=painter((0.95, 0.92, 0.85))) for s in (-1, 1)]
    # microphone: neck + fluffy windshield ball (friendly 'pom-pom')
    neck = lathe_obj("recorder_neck", [(0.014, 0.14), (0.01, 0.16), (0.01, 0.17)], grille, segs=14, cap=False)
    ball = blob("recorder_mic", (0, 0, 0.195), (0.03, 0.03, 0.032), fur, seg=18, ring=12, noise=0.006, nscale=90,
                col=painter((0.93, 0.86, 0.72)))
    body_n = C.join([body, gripb, screen, rec, neck, ball] + btns, "recorder_body")
    led_o = blob("recorder_led", (0.022, -0.0158, 0.123), (0.004, 0.002, 0.004), led, seg=10, ring=6)
    strap = torus("recorder_strap", (0, 0.0, -0.015), 0.012, 0.003, rub, axis="X", seg=16, ring=4, col=painter((0.85, 0.5, 0.2)))
    return [C.join([body_n, strap], "recorder_body"), led_o]


# =============================================================================== lantern
def lantern():
    brass = metal("lantern_brass", (0.86, 0.64, 0.3), 0.3)
    green = C.material("lantern_paint", tex="paint.jpg", rough=0.5, metal=0.3, vcol=True)
    gl = glass("lantern_glass", (1.0, 0.95, 0.82), 0.25)
    glow = C.material("lantern_glow", color=(1.0, 0.82, 0.45), rough=0.4, emissive=(1.0, 0.72, 0.35), emissive_strength=6.0)
    # held by the bail handle: origin at the top of the handle, the lantern hangs below
    Z0 = -0.36
    base = lathe_obj("lantern_base", [(0.0, Z0), (0.085, Z0), (0.09, Z0 + 0.01), (0.09, Z0 + 0.05), (0.07, Z0 + 0.06), (0.06, Z0 + 0.065)],
                     green, segs=28, cap=False)
    C.paint_vcol(base, painter((0.25, 0.48, 0.36)))
    chim = lathe_obj("lantern_chimney", [(0.05, Z0 + 0.065), (0.07, Z0 + 0.1), (0.072, Z0 + 0.15), (0.06, Z0 + 0.2), (0.045, Z0 + 0.22)], gl, segs=28, cap=False)
    guards = []
    for k in range(4):
        a = k / 4 * math.pi * 2 + math.pi / 4
        guards.append(tube(f"lantern_guard{k}", smooth_pts([(math.cos(a) * 0.065, math.sin(a) * 0.065, Z0 + 0.06),
                                                            (math.cos(a) * 0.082, math.sin(a) * 0.082, Z0 + 0.14),
                                                            (math.cos(a) * 0.06, math.sin(a) * 0.06, Z0 + 0.225)], 3), [0.004] * 7, brass, sides=6))
    top = lathe_obj("lantern_top", [(0.045, Z0 + 0.22), (0.075, Z0 + 0.235), (0.07, Z0 + 0.25), (0.03, Z0 + 0.28), (0.015, Z0 + 0.3), (0.0, Z0 + 0.305)],
                    green, segs=28, cap=False)
    C.paint_vcol(top, painter((0.25, 0.48, 0.36)))
    bail = tube("lantern_bail", smooth_pts([(0.075, 0, Z0 + 0.235), (0.085, 0, Z0 + 0.32), (0.0, 0, 0.0), (-0.085, 0, Z0 + 0.32), (-0.075, 0, Z0 + 0.235)], 5),
                [0.0035] * 21, brass, sides=6)
    grip = tube("lantern_grip", [V((-0.03, 0, -0.004)), V((0.03, 0, -0.004))], [0.009, 0.009], C.material("lantern_wood", tex="wood.jpg", rough=0.6), sides=10)
    knob = blob("lantern_knob", (0.0, -0.09, Z0 + 0.035), (0.012, 0.008, 0.012), brass, seg=10, ring=6)
    body = C.join([base, chim, top, bail, grip, knob] + guards, "lantern_body")
    flame = blob("lantern_glow", (0, 0, Z0 + 0.13), (0.026, 0.026, 0.045), glow, seg=16, ring=10,
                 fn=lambda u: V((0, 0, 0.015 * max(0, u.z) ** 2)))
    return [body, flame]


ALL = {"net": net, "jar": jar, "ruler": ruler, "tape": tape, "scale": scale, "brush": brush, "trowel": trowel,
       "recorder": recorder, "lantern": lantern}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for n in argv or list(ALL):
        C.reset()
        objs = ALL[n]()
        R.export_static(os.path.join(C.OUT, "tool_" + n + ".glb"), objs)
