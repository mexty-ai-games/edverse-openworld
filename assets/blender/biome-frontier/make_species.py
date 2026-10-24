"""Biome Frontier species: friendly, stylised-painterly animals and a cactus for the field survey.

OW_TEX=build/tex OW_OUT=build/glb blender -b --factory-startup -P make_species.py [-- name ...]
toucan, tree_frog, morpho (butterfly), tortoise, horned_lizard, saguaro, sea_turtle, clownfish, sea_star.
Soft rounded forms (sculpted spheres and swept tubes, smooth shaded), big friendly eyes with highlights,
colour patterns painted per vertex over light painted textures. Origin at the feet / base, facing -Y.
"""
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402
from make_flora import group  # noqa: E402


def blob(name, center, radii, mat, seg=24, ring=14, fn=None, col=None, noise=0.0):
    """A sculpted ellipsoid; fn(v_local)->offset lets us pull beaks, snouts, flattened bellies."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=1.0)
    for v in bm.verts:
        p = Vector((v.co.x * radii[0], v.co.y * radii[1], v.co.z * radii[2]))
        if fn:
            p += fn(Vector(v.co))
        if noise:
            p += Vector(v.co) * C.fbm(p * 4, 2) * noise
        v.co = p + Vector(center)
    ob = C.new_obj(name, bm, [mat])
    C.box_uv(ob, 2.0)
    C.shade_smooth(ob)
    if col:
        C.paint_vcol(ob, col)
    return ob


def limb(name, pts, radii, mat, sides=8, col=None):
    bm = bmesh.new()
    C.tube(bm, [Vector(p) for p in pts], radii, sides=sides, cap_start=True)
    ob = C.new_obj(name, bm, [mat])
    C.box_uv(ob, 2.0)
    C.shade_smooth(ob)
    if col:
        C.paint_vcol(ob, col)
    return ob


def eyes(prefix, centers, r, look=Vector((0, -1, 0)), iris=(0.08, 0.06, 0.05)):
    white = C.material(prefix + "_eyewhite", color=(0.97, 0.97, 0.95), rough=0.25)
    dark = C.material(prefix + "_pupil", color=iris, rough=0.15)
    shine = C.material(prefix + "_shine", color=(1, 1, 1), emissive=(1, 1, 1), emissive_strength=1.5)
    out = []
    for i, c in enumerate(centers):
        c = Vector(c)
        out.append(blob(f"{prefix}_eye{i}", c, (r, r, r), white, seg=14, ring=8))
        d = (look + (c - Vector((0, c.y, c.z))).normalized() * 0.35 if abs(c.x) > 1e-4 else look).normalized()
        out.append(blob(f"{prefix}_pupil{i}", c + d * r * 0.62, (r * 0.62, r * 0.62, r * 0.62), dark, seg=12, ring=8))
        out.append(blob(f"{prefix}_shine{i}", c + d * r * 1.12 + Vector((r * 0.2, 0, r * 0.3)), (r * 0.18, r * 0.18, r * 0.18), shine, seg=8, ring=5))
    return out


def soft(name, rough=0.6, tex="bone.jpg"):
    """Light painted base (vertex colours carry the species' colours)."""
    return C.material(name, tex=tex, rough=rough, vcol=True)


def mixc(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(x + (y - x) * t for x, y in zip(a, b))


# =============================================================================== rainforest
def toucan():
    m = soft("toucan_body")
    beak_m = soft("toucan_beak", rough=0.35)
    body = blob("toucan_body", (0, 0, 0.42), (0.17, 0.2, 0.26), m, fn=lambda v: Vector((0, v.z * 0.06, 0)) if v.z > 0 else Vector((0, 0, 0)),
                col=lambda p, n: (0.06, 0.06, 0.08) if not (n.y < -0.35 and p.z > 0.42) else (1.0, 0.86, 0.3))
    head = blob("toucan_head", (0, -0.06, 0.72), (0.13, 0.13, 0.13), m,
                col=lambda p, n: (0.98, 0.95, 0.85) if n.y < -0.2 and p.z < 0.76 else (0.06, 0.06, 0.08))

    def beak_col(p, n):
        t = (-p.y - 0.12) / 0.34
        c = mixc((0.4, 0.75, 0.25), (1.0, 0.6, 0.1), t * 1.4)
        return mixc(c, (0.9, 0.15, 0.1), (t - 0.75) * 4)

    beak = blob("toucan_beak", (0, -0.3, 0.71), (0.075, 0.24, 0.085), beak_m,
                fn=lambda v: Vector((0, 0, -0.06 * max(0.0, -v.y) ** 2)), col=beak_col)
    tail = limb("toucan_tail", [(0, 0.14, 0.3), (0, 0.24, 0.1), (0, 0.3, -0.06)], [0.07, 0.06, 0.03], m, col=lambda p, n: (0.06, 0.06, 0.08))
    wings = [blob(f"toucan_wing{s}", (s * 0.15, 0.03, 0.42), (0.04, 0.16, 0.2), m, col=lambda p, n: (0.08, 0.08, 0.12)) for s in (-1, 1)]
    feet_m = C.material("toucan_feet", color=(0.35, 0.55, 0.9), rough=0.5)
    feet = [limb(f"toucan_leg{s}", [(s * 0.06, -0.02, 0.2), (s * 0.06, -0.04, 0.02)], [0.025, 0.02], feet_m) for s in (-1, 1)]
    perch_m = C.material("toucan_perch", tex="bark.jpg", rough=0.9)
    perch = limb("toucan_perch", [(-0.45, 0, 0.0), (0, -0.02, -0.01), (0.45, 0, 0.02)], [0.05, 0.05, 0.045], perch_m)
    ring_m = C.material("toucan_eyering", color=(0.4, 0.85, 0.5), rough=0.5)
    rings = [blob(f"toucan_ring{s}", (s * 0.105, -0.1, 0.75), (0.03, 0.045, 0.045), ring_m) for s in (-1, 1)]
    ey = eyes("toucan", [(-0.12, -0.11, 0.75), (0.12, -0.11, 0.75)], 0.028, look=Vector((0, -0.6, 0)))
    return [body, head, beak, tail, perch] + wings + feet + rings + ey


def tree_frog():
    m = soft("frog_skin", rough=0.35)

    def body_col(p, n):
        if n.z < -0.3 or (n.y < -0.5 and p.z < 0.12):
            return (0.98, 0.95, 0.75)
        side = abs(n.x) > 0.75 and 0.06 < p.z < 0.16
        return (0.25, 0.4, 0.95) if side else (0.3, 0.82, 0.25)

    body = blob("frog_body", (0, 0.02, 0.12), (0.16, 0.2, 0.11), m, fn=lambda v: Vector((0, 0, -0.03 * max(0.0, v.y))), col=body_col)
    head = blob("frog_head", (0, -0.14, 0.17), (0.15, 0.12, 0.09), m, col=body_col)
    legs = []
    toe_m = C.material("frog_toes", color=(1.0, 0.5, 0.12), rough=0.5)
    for s in (-1, 1):
        legs.append(limb(f"frog_back{s}", [(s * 0.12, 0.12, 0.08), (s * 0.24, 0.06, 0.06), (s * 0.2, -0.04, 0.02)], [0.05, 0.035, 0.025], m,
                         col=lambda p, n: (0.25, 0.4, 0.95) if abs(n.x) > 0.6 else (0.3, 0.82, 0.25)))
        legs.append(limb(f"frog_front{s}", [(s * 0.1, -0.15, 0.1), (s * 0.17, -0.22, 0.03)], [0.03, 0.022], m, col=lambda p, n: (0.3, 0.82, 0.25)))
        for (fx, fy) in ((s * 0.2, -0.05), (s * 0.18, -0.24)):
            legs.append(blob(f"frog_toe{s}{fy}", (fx, fy, 0.012), (0.035, 0.035, 0.014), toe_m))
    ey = eyes("frog", [(-0.085, -0.2, 0.25), (0.085, -0.2, 0.25)], 0.055, look=Vector((0, -1, 0.2)), iris=(0.85, 0.12, 0.08))
    return [body, head] + legs + ey


def morpho():
    wing_m = soft("morpho_wing", rough=0.3)
    wing_m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 0.0
    body_m = C.material("morpho_body", color=(0.08, 0.06, 0.05), rough=0.6)
    objs = [limb("morpho_body", [(0, 0.12, 0.3), (0, 0, 0.3), (0, -0.1, 0.31)], [0.018, 0.022, 0.02], body_m),
            blob("morpho_head", (0, -0.12, 0.31), (0.025, 0.025, 0.025), body_m)]

    def wcol(p, n):
        r = math.hypot(p.x, p.y - 0.0) / 0.32
        c = mixc((0.25, 0.7, 1.0), (0.08, 0.2, 0.6), (r - 0.6) * 3)
        edge = r > 0.9
        return (0.05, 0.05, 0.08) if edge else c

    for s in (-1, 1):
        for (cy, ry, rx) in ((-0.05, 0.13, 0.17), (0.11, 0.1, 0.13)):
            bm = bmesh.new()
            bmesh.ops.create_circle(bm, cap_ends=True, radius=1.0, segments=20)
            for v in bm.verts:
                v.co = Vector((s * (0.02 + rx + v.co.x * rx), cy + v.co.y * ry, 0.31 + abs(v.co.x * rx) * 0.5))
            w = C.new_obj(f"morpho_wing{s}{cy}", bm, [wing_m])
            C.paint_vcol(w, wcol)
            objs.append(w)
    for s in (-1, 1):
        objs.append(limb(f"morpho_ant{s}", [(0, -0.13, 0.32), (s * 0.04, -0.2, 0.38), (s * 0.06, -0.24, 0.4)], [0.004, 0.004, 0.006], body_m, sides=4))
    return objs


# =============================================================================== desert canyon
def tortoise():
    shell_m = C.material("tortoise_shell", tex="shell.jpg", rough=0.6)
    skin_m = soft("tortoise_skin", tex="scales.jpg")
    skin = lambda p, n: (0.62, 0.55, 0.4)  # noqa: E731
    shell = blob("tortoise_shell", (0, 0.02, 0.1), (0.28, 0.34, 0.14), shell_m, seg=28, ring=14,
                 fn=lambda v: Vector((0, 0, -0.2 * (1 - abs(v.z)) * (v.z < 0) - 0.06 * (v.z < -0.2))))
    rim = blob("tortoise_rim", (0, 0.02, 0.1), (0.3, 0.36, 0.04), shell_m, seg=28, ring=6)
    head = blob("tortoise_head", (0, -0.42, 0.17), (0.08, 0.1, 0.07), skin_m, col=skin)
    neck = limb("tortoise_neck", [(0, -0.25, 0.12), (0, -0.36, 0.16)], [0.06, 0.055], skin_m, col=skin)
    legs = [limb(f"tortoise_leg{x}{y}", [(x * 0.2, y * 0.2, 0.12), (x * 0.27, y * 0.27, 0.06), (x * 0.29, y * 0.29, -0.02)], [0.055, 0.06, 0.065], skin_m, col=skin)
            for x in (-1, 1) for y in (-1, 1)]
    ey = eyes("tortoise", [(-0.05, -0.48, 0.2), (0.05, -0.48, 0.2)], 0.022)
    return [shell, rim, head, neck] + legs + ey


def horned_lizard():
    m = soft("lizard_skin", tex="scales.jpg")

    def col(p, n):
        b = 0.5 + C.fbm(p * 18, 2)
        c = mixc((0.78, 0.6, 0.4), (0.55, 0.38, 0.24), b)
        return c if n.z > -0.3 else (0.92, 0.85, 0.7)

    body = blob("lizard_body", (0, 0.02, 0.07), (0.15, 0.22, 0.065), m, col=col)
    head = blob("lizard_head", (0, -0.22, 0.08), (0.09, 0.08, 0.05), m, col=col)
    tail = limb("lizard_tail", [(0, 0.2, 0.05), (0.03, 0.34, 0.03), (0.08, 0.44, 0.015)], [0.04, 0.025, 0.008], m, col=col)
    spikes_m = C.material("lizard_horns", color=(0.86, 0.72, 0.5), rough=0.6)
    objs = [body, head, tail]
    for k, (x, y) in enumerate(((-0.07, -0.27), (-0.03, -0.29), (0.03, -0.29), (0.07, -0.27))):
        objs.append(limb(f"lizard_horn{k}", [(x, y + 0.04, 0.1), (x * 1.3, y + 0.08, 0.14)], [0.014, 0.002], spikes_m, sides=5))
    for s in (-1, 1):
        for k in range(4):
            objs.append(limb(f"lizard_fringe{s}{k}", [(s * 0.14, -0.1 + k * 0.08, 0.07), (s * 0.18, -0.1 + k * 0.08, 0.075)], [0.012, 0.002], spikes_m, sides=4))
        for y in (-0.1, 0.12):
            objs.append(limb(f"lizard_leg{s}{y}", [(s * 0.12, y, 0.05), (s * 0.2, y - 0.02, 0.0)], [0.03, 0.02], m, col=col))
    objs += eyes("lizard", [(-0.055, -0.27, 0.11), (0.055, -0.27, 0.11)], 0.018)
    return objs


def saguaro():
    m = soft("saguaro_skin", rough=0.7)

    def col(p, n):
        rib = 0.5 + 0.5 * math.cos(math.atan2(n.y, n.x) * 12)
        return mixc((0.22, 0.48, 0.22), (0.4, 0.66, 0.32), rib)

    def ribbed(name, pts, r):
        bm = bmesh.new()
        C.tube(bm, [Vector(p) for p in pts], r, sides=24, flare=lambda i, a: 0.025 * math.cos(a * 12))
        ob = C.new_obj(name, bm, [m])
        C.box_uv(ob, 2)
        C.shade_smooth(ob)
        C.paint_vcol(ob, col)
        return ob

    trunk = ribbed("saguaro_trunk", [(0, 0, 0), (0, 0, 1.2), (0, 0, 2.4), (0, 0, 3.3), (0, 0, 3.55)], [0.3, 0.3, 0.28, 0.24, 0.05])
    arm1 = ribbed("saguaro_arm1", [(0.2, 0, 1.3), (0.6, 0, 1.35), (0.75, 0, 1.7), (0.75, 0, 2.4), (0.75, 0, 2.6)], [0.18, 0.18, 0.18, 0.16, 0.04])
    arm2 = ribbed("saguaro_arm2", [(-0.2, 0, 1.8), (-0.55, 0, 1.85), (-0.65, 0, 2.2), (-0.65, 0, 2.7), (-0.65, 0, 2.85)], [0.15, 0.15, 0.15, 0.13, 0.03])
    flower = C.material("saguaro_flower", color=(1.0, 0.86, 0.4), rough=0.6)
    fl = [blob(f"saguaro_flower{k}", (math.cos(k * 2.1) * 0.2, math.sin(k * 2.1) * 0.2, 3.38), (0.09, 0.09, 0.03), flower, seg=10, ring=5,
               col=None) for k in range(4)]
    return [trunk, arm1, arm2] + fl


# =============================================================================== coral coast
def sea_turtle():
    shell_m = C.material("turtle_shell", tex="shell.jpg", rough=0.5)
    m = soft("turtle_skin", tex="scales.jpg")
    skin = lambda p, n: (0.52, 0.62, 0.4) if n.z > -0.2 else (0.88, 0.86, 0.68)  # noqa: E731
    shell = blob("turtle_shell", (0, 0.02, 0.12), (0.34, 0.44, 0.13), shell_m, seg=28, ring=12,
                 fn=lambda v: Vector((0, 0.08 * v.y * (v.y > 0), -0.08 * (v.z < 0))))
    belly = blob("turtle_belly", (0, 0.02, 0.07), (0.3, 0.4, 0.06), m, col=lambda p, n: (0.92, 0.88, 0.66))
    head = blob("turtle_head", (0, -0.5, 0.12), (0.1, 0.13, 0.08), m, col=skin)
    objs = [shell, belly, head]
    for s in (-1, 1):
        objs.append(blob(f"turtle_flipper_f{s}", (s * 0.42, -0.2, 0.08), (0.26, 0.09, 0.025), m, col=skin,
                         fn=lambda v, s=s: Vector((0, -0.08 * max(0.0, v.x * s), 0))))
        objs.append(blob(f"turtle_flipper_b{s}", (s * 0.24, 0.42, 0.07), (0.12, 0.08, 0.02), m, col=skin))
    objs += eyes("turtle", [(-0.065, -0.58, 0.15), (0.065, -0.58, 0.15)], 0.024)
    return objs


def clownfish():
    m = soft("clownfish_skin", rough=0.35)

    def col(p, n):
        y = p.y
        for b in (-0.1, 0.02, 0.13):
            if abs(y - b) < 0.022:
                return (1.0, 1.0, 1.0)
            if abs(y - b) < 0.03:
                return (0.08, 0.06, 0.06)
        return (1.0, 0.45, 0.08)

    body = blob("clownfish_body", (0, 0, 0.3), (0.06, 0.17, 0.09), m, seg=48, ring=20, col=col)
    tail = blob("clownfish_tail", (0, 0.19, 0.3), (0.012, 0.06, 0.07), m, col=lambda p, n: (1.0, 0.45, 0.08) if p.y < 0.23 else (0.08, 0.06, 0.06))
    fin = blob("clownfish_fin", (0, 0.03, 0.39), (0.01, 0.1, 0.035), m, col=lambda p, n: (1.0, 0.5, 0.1) if p.z < 0.41 else (0.08, 0.06, 0.06))
    side = [blob(f"clownfish_pec{s}", (s * 0.06, -0.05, 0.28), (0.012, 0.04, 0.025), m, col=lambda p, n: (1.0, 0.55, 0.12)) for s in (-1, 1)]
    ey = eyes("clownfish", [(-0.04, -0.12, 0.32), (0.04, -0.12, 0.32)], 0.018)
    # its sea anemone home
    an_m = soft("anemone", rough=0.6)
    bm = bmesh.new()
    rng = random.Random(4)
    for k in range(34):
        a = rng.uniform(0, 6.28)
        r = rng.uniform(0.02, 0.22)
        base = Vector((math.cos(a) * r, math.sin(a) * r, 0.04))
        d = (Vector((math.cos(a) * r * 2, math.sin(a) * r * 2, 1))).normalized()
        L = rng.uniform(0.12, 0.2)
        C.tube(bm, [base, base + d * L * 0.5 + Vector((rng.uniform(-.02, .02), rng.uniform(-.02, .02), 0)), base + d * L], [0.018, 0.016, 0.012], sides=5)
    res = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=6, radius=0.24)
    for v in res["verts"]:
        v.co.z = max(0.0, v.co.z) * 0.3
    an = C.new_obj("anemone", bm, [an_m])
    C.shade_smooth(an)
    C.paint_vcol(an, lambda p, n: mixc((0.85, 0.45, 0.75), (1.0, 0.8, 0.9), p.z * 5))
    return [body, tail, fin, an] + side + ey


def sea_star():
    m = soft("seastar_skin", rough=0.6)
    bm = bmesh.new()
    res = bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=10, radius=1.0)
    for v in res["verts"]:
        a = math.atan2(v.co.y, v.co.x)
        arm = 0.45 + 0.55 * (0.5 + 0.5 * math.cos(a * 5)) ** 2.2
        v.co = Vector((v.co.x * 0.26 * arm, v.co.y * 0.26 * arm, max(-0.2, v.co.z) * 0.05 * (0.6 + arm * 0.6) + 0.04))
    ob = C.new_obj("sea_star", bm, [m])
    C.box_uv(ob, 3)
    C.shade_smooth(ob)
    C.paint_vcol(ob, lambda p, n: (1.0, 0.92, 0.75) if (math.sin(p.x * 120) * math.sin(p.y * 120)) > 0.75 and n.z > 0.3 else (1.0, 0.45, 0.25))
    ey = eyes("seastar", [(-0.03, -0.03, 0.09), (0.03, -0.03, 0.09)], 0.016, look=Vector((0, -0.5, 1)))
    return [ob] + ey


SPECIES = {
    "toucan": toucan, "tree_frog": tree_frog, "morpho": morpho, "tortoise": tortoise, "horned_lizard": horned_lizard,
    "saguaro": saguaro, "sea_turtle": sea_turtle, "clownfish": clownfish, "sea_star": sea_star,
}

if __name__ == "__main__":
    which = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(SPECIES)
    for name in which:
        C.reset()
        r = group(name, SPECIES[name]())
        C.export(name, [r])
