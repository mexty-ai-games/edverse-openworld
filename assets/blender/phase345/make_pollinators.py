"""Phase 3 - garden pollinators, rigged, real size (scale them up 3-5x in game for readability).

OW_TEX=<tex> OW_OUT=<glb> blender -b --factory-startup -P make_pollinators.py [-- bumblebee hummingbird hoverfly monarch]
Each: one skinned mesh + armature, facing -Y (glTF +Z), origin under the feet.
Clips: idle / fly / feed. The monarch also has move (migration flap-and-glide) and special (roost:
wings closed, swaying) so it doubles as the autumn migration creature (instance it for a flock).
Who visits what (real habits): bumblebee - sunflower, lavender, foxglove, clover, tomato (buzz
pollination); hoverfly - lavender, clover; hummingbird - foxglove (tubular flowers); monarch - milkweed.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import p345 as P  # noqa: E402
import xrig as R  # noqa: E402
from p345 import C, PI, V, VB, leaf, lerp, mulc  # noqa: E402
from xrig import Cs, S, X, Y, Z  # noqa: E402

K = 0.01  # model in centimetres


def c(x, y, z):
    return V((x, y, z)) * K


def wing_mat(name, tex, tint=None):
    """Membrane: texture alpha straight to Alpha, blended, double sided."""
    m = C.material(name, tex=tex, rough=0.25, double=True)
    nt = m.node_tree
    it = [n for n in nt.nodes if n.type == "TEX_IMAGE"][0]
    nt.links.new(it.outputs["Alpha"], nt.nodes["Principled BSDF"].inputs["Alpha"])
    m.blend_method = "BLEND"
    m.use_backface_culling = False
    if tint:
        R.tint_mat(m, tint)
    return m


def cutout_mat(name, tex):
    return C.material(name, tex=tex, rough=0.55, alpha_tex=True, double=True)


def part(fn, name, mats, light=0.2):
    vb = VB()
    fn(vb)
    return vb.obj(name, mats, light=light)


def bug_eyes(vb, centers, r, col=(0.12, 0.08, 0.06), shine_mi=1, look=V((0, -1, 0))):
    """Glossy compound-eye domes with two soft highlights (friendly, never staring)."""
    for cc in centers:
        cc = V(cc)
        vb.blob(cc, (r * 0.85, r, r * 1.1), col, seg=14, ring=10)
        side = V((math.copysign(1, cc.x), 0, 0))
        d = (look * 0.8 + side * 0.6 + V((0, 0, 0.35))).normalized()
        mi = vb.mi
        vb.mi = shine_mi
        vb.blob(cc + d * r * 0.95, (r * 0.28,) * 3, (1, 1, 1), seg=6, ring=4)
        vb.blob(cc + (d + V((0, 0, -0.6))).normalized() * r * 0.98, (r * 0.13,) * 3, (1, 1, 1), seg=5, ring=4)
        vb.mi = mi


def wing_card(vb, root, along, out, L, Wd, uv=(0, 0, 1, 1), segs=2):
    """A flat wing quad (root at one short edge), UV over uv rect: u along length, v across."""
    along, out = V(along).normalized(), V(out).normalized()
    u0, v0, u1, v1 = uv
    rows = []
    for i in range(segs + 1):
        t = i / segs
        row = []
        for j, s in enumerate((-0.5, 0.5)):
            p = V(root) + along * L * t + out * Wd * s
            row.append(vb.v(p, (1, 1, 1)))
        rows.append(row)
    for i in range(segs):
        a, b = rows[i], rows[i + 1]
        vb.f((a[0], b[0], b[1], a[1]), ((u0 + (u1 - u0) * i / segs, v0), (u0 + (u1 - u0) * (i + 1) / segs, v0),
                                         (u0 + (u1 - u0) * (i + 1) / segs, v1), (u0 + (u1 - u0) * i / segs, v1)))


def legs6(vb, col, ys, z_hip, spread, foot_out, r=0.05, basket=None):
    """Six jointed insect legs, from hips under the thorax to feet on the ground (z=0)."""
    for i, y in enumerate(ys):
        for s in (-1, 1):
            hip = c(s * spread, y, z_hip)
            knee = c(s * (spread + 0.18), y + (i - 1) * 0.12, z_hip * 0.75)
            foot = c(s * (spread + foot_out), y + (i - 1) * 0.3, 0.02)
            vb.tube(R.smooth_pts([hip, knee, foot], 2), [r * K, r * K * 0.85, r * K * 0.7, r * K * 0.6, r * K * 0.5], col, sides=5)
            vb.blob(foot + c(0, -0.02, 0.01), (r * 0.8 * K, r * 1.3 * K, r * 0.6 * K), col, seg=5, ring=3)
            if basket and i == 2:
                vb.blob((knee + foot) / 2 + c(s * 0.05, 0, 0.02), (0.11 * K, 0.16 * K, 0.1 * K), basket, seg=8, ring=6)


def antennae(vb, base_pts, col, length, club=None, bend=0.5):
    for s, b in zip((-1, 1), base_pts):
        b = V(b)
        mid = b + c(s * 0.15, -length * 0.45, length * 0.55)
        tip = mid + c(s * 0.15, -length * 0.45, -length * bend * 0.2)
        vb.tube([b, mid, tip], [0.035 * K, 0.03 * K, 0.025 * K], col, sides=4)
        if club:
            vb.blob(tip, (club * K, club * K * 1.6, club * K), col, seg=6, ring=4, rot=Matrix.Rotation(0.5, 3, "X"))


# =============================================================================== bumblebee
def bumblebee():
    fur = P.mat("bee_fur", tex="fur.jpg", rough=0.9)
    shine = C.material("bee_shine", color=(1, 1, 1), emissive=(1, 1, 1), emissive_strength=0.8, rough=0.2)
    wing = wing_mat("bee_wing", "p_clear_wing.png", tint=(0.95, 0.97, 1.0))
    mats = [fur, shine, wing]
    rig = R.Rig("bumblebee")
    yellow, black, white, orange = (0.98, 0.78, 0.22), (0.1, 0.09, 0.08), (0.97, 0.95, 0.9), (0.95, 0.55, 0.15)
    rig.bone("root", (0, 0, 0), c(0, 0, 0.3))
    TH = c(0, 0, 0.78)

    def body(vb):
        vb.blob(TH, (0.44 * K, 0.46 * K, 0.42 * K), lambda u: yellow if u.y < -0.35 and u.z > -0.2 else black, seg=16, ring=12,
                noise=0.05 * K, nscale=300)
        legs6(vb, (0.16, 0.12, 0.1), (-0.22, 0.0, 0.22), 0.42, 0.2, 0.4, r=0.075, basket=orange)
    rig.bone("body", c(0, 0.3, 0.78), c(0, -0.3, 0.78), "root")
    rig.add(part(body, "bee_thorax", mats), "body")
    AB = c(0, 0.78, 0.68)

    def abdomen(vb):
        def col(u):
            y = u.y
            if y > 0.62:
                return white
            if -0.45 < y < -0.05:
                return yellow
            return black
        vb.blob(AB, (0.5 * K, 0.62 * K, 0.46 * K), col, seg=18, ring=12, noise=0.05 * K, nscale=300,
                fn=lambda u: V((0, 0, -0.08 * K * max(0, u.y))))
    rig.bone("abdomen", c(0, 0.25, 0.75), c(0, 1.35, 0.6), "body")
    rig.add(part(abdomen, "bee_abdomen", mats), "abdomen")
    HC = c(0, -0.58, 0.74)

    def head(vb):
        vb.blob(HC, (0.32 * K, 0.26 * K, 0.3 * K), black, seg=14, ring=10, noise=0.03 * K, nscale=300)
        vb.blob(HC + c(0, -0.2, 0.18), (0.16 * K, 0.08 * K, 0.08 * K), yellow, seg=8, ring=6, noise=0.02 * K, nscale=300)
        bug_eyes(vb, [HC + c(s * 0.2, -0.1, 0.04) for s in (-1, 1)], 0.15 * K)
        antennae(vb, [HC + c(s * 0.1, -0.18, 0.2) for s in (-1, 1)], (0.1, 0.09, 0.08), 0.55, club=0.05)
        vb.tube([HC + c(0, -0.2, -0.15), HC + c(0, -0.3, -0.32)], [0.04 * K, 0.025 * K], (0.2, 0.15, 0.1), sides=4)
    rig.bone("head", c(0, -0.35, 0.76), c(0, -0.85, 0.76), "body")
    rig.add(part(head, "bee_head", mats), "head")
    for s, sd in ((1, "L"), (-1, "R")):
        root = c(s * 0.22, -0.12, 1.08)

        def wg(vb, root=root, s=s):
            vb.mi = 2
            wing_card(vb, root, c(s * 0.25, 1, 0.05), c(s, -0.1, 0.0), 1.2 * K, 0.42 * K, uv=(0, 0.15, 1, 0.85))
            wing_card(vb, root + c(0, 0.15, -0.02), c(s * 0.45, 1, 0.0), c(s, -0.2, 0.0), 0.8 * K, 0.3 * K, uv=(0, 0.15, 1, 0.85))
        rig.bone(f"wing.{sd}", root, root + c(s * 0.25, 1.0, 0.05), "body")
        rig.add(part(wg, f"bee_wing{sd}", mats, light=0), f"wing.{sd}")
    rig.build()
    insect_clips(rig, flap=0.85, hover=0.35, feed_dip=0.35)
    return rig


def insect_clips(rig, flap=0.8, hover=0.3, feed_dip=0.3, two_wings=True, spread=1.35):
    """idle (wings folded, breathing), fly (hover with fast flaps), feed (dipping head into a flower)."""
    def folded(t, shiver=0.0):
        return {"wing.L": {"rot": [(Z, -0.05 + shiver * S(t, 9))]}, "wing.R": {"rot": [(Z, 0.05 - shiver * S(t, 9))]}}

    def idle(t):
        p = folded(t, 0.02 if S(t, 1, 0.3) > 0.8 else 0.0)
        p["abdomen"] = {"rot": [(X, 0.04 * S(t, 3))], "scale": 1 + 0.04 * S(t, 3)}
        p["head"] = {"rot": [(Z, 0.25 * S(t, 1)), (X, 0.08 * S(t, 2, 0.2))]}
        p["body"] = {"rot": [(Y, 0.03 * S(t, 1, 0.5))]}
        return p
    rig.clip("idle", 96, idle)

    def fly(t):
        f = Cs(t, 12)  # 12 beats over 24 frames, keyed every frame -> a fast blur-like beat
        p = {"root": {"loc": (0.04 * K * S(t, 1), 0, (0.9 + hover * S(t, 2)) * K)},
             "body": {"rot": [(X, -0.12 + 0.03 * S(t, 2))]},
             "abdomen": {"rot": [(X, 0.12 + 0.05 * S(t, 2))]},
             "head": {"rot": [(Z, 0.05 * S(t, 1))]}}
        p["wing.L"] = {"rot": [(Z, -spread), (Y, -flap * f)]}
        p["wing.R"] = {"rot": [(Z, spread), (Y, flap * f)]}
        return p
    rig.clip("fly", 24, fly, step=1)

    def feed(t):
        e = R.smoothstep(0.0, 0.15, t) * (1 - R.smoothstep(0.85, 1.0, t))
        dip = e * (0.5 + 0.5 * S(t, 4))
        p = folded(t)
        p["body"] = {"rot": [(X, feed_dip * e), (Y, 0.05 * S(t, 2))]}
        p["head"] = {"rot": [(X, (0.35 * dip))]}
        p["abdomen"] = {"rot": [(X, -0.1 * e + 0.05 * S(t, 6))], "scale": 1 + 0.03 * S(t, 6)}
        return p
    rig.clip("feed", 96, feed)


# =============================================================================== hoverfly
def hoverfly():
    soft = P.mat("hf_body", tex="paint.jpg", rough=0.45)
    shine = C.material("hf_shine", color=(1, 1, 1), emissive=(1, 1, 1), emissive_strength=0.8, rough=0.2)
    wing = wing_mat("hf_wing", "p_clear_wing.png", tint=(0.95, 0.98, 1.0))
    mats = [soft, shine, wing]
    rig = R.Rig("hoverfly")
    yellow, black, olive = (0.98, 0.72, 0.12), (0.1, 0.08, 0.06), (0.3, 0.3, 0.16)
    rig.bone("root", (0, 0, 0), c(0, 0, 0.2))
    TH = c(0, 0, 0.5)

    def body(vb):
        vb.blob(TH, (0.24 * K, 0.3 * K, 0.24 * K), lambda u: mulc(olive, 1.2) if u.z > 0.2 else olive, seg=14, ring=10)
        legs6(vb, (0.5, 0.36, 0.16), (-0.12, 0.0, 0.12), 0.32, 0.1, 0.28, r=0.035)
    rig.bone("body", c(0, 0.2, 0.5), c(0, -0.2, 0.5), "root")
    rig.add(part(body, "hf_thorax", mats), "body")
    AB = c(0, 0.62, 0.45)

    def abdomen(vb):
        def col(u):
            y = (u.y + 1) / 2
            band = math.sin(y * PI * 7.0)
            if u.z < -0.3:
                return mulc(yellow, 0.7)
            return yellow if band > 0.15 else black
        vb.blob(AB, (0.3 * K, 0.5 * K, 0.12 * K), col, seg=18, ring=10, fn=lambda u: V((0, 0, 0)))
    rig.bone("abdomen", c(0, 0.2, 0.48), c(0, 1.1, 0.42), "body")
    rig.add(part(abdomen, "hf_abdomen", mats), "abdomen")
    HC = c(0, -0.36, 0.5)

    def head(vb):
        vb.blob(HC, (0.24 * K, 0.16 * K, 0.22 * K), (0.95, 0.8, 0.45), seg=12, ring=8)
        bug_eyes(vb, [HC + c(s * 0.13, -0.02, 0.04) for s in (-1, 1)], 0.17 * K, col=(0.45, 0.16, 0.08))
        antennae(vb, [HC + c(s * 0.04, -0.14, 0.08) for s in (-1, 1)], (0.2, 0.12, 0.06), 0.18, club=0.035)
    rig.bone("head", c(0, -0.2, 0.5), c(0, -0.55, 0.5), "body")
    rig.add(part(head, "hf_head", mats), "head")
    for s, sd in ((1, "L"), (-1, "R")):
        root = c(s * 0.14, -0.08, 0.7)

        def wg(vb, root=root, s=s):
            vb.mi = 2
            wing_card(vb, root, c(s * 0.35, 1, 0.02), c(s, -0.25, 0.0), 0.95 * K, 0.34 * K, uv=(0, 0.15, 1, 0.85))
        rig.bone(f"wing.{sd}", root, root + c(s * 0.35, 1.0, 0.02), "body")
        rig.add(part(wg, f"hf_wing{sd}", mats, light=0), f"wing.{sd}")
    rig.build()
    insect_clips(rig, flap=0.7, hover=0.08, feed_dip=0.25, spread=1.25)
    return rig


# =============================================================================== hummingbird
def hummingbird():
    feather = P.mat("hb_feather", tex="paint.jpg", rough=0.4, metal=0.15)
    beak_m = P.mat("hb_beak", tex="paint.jpg", rough=0.35)
    rig = R.Rig("hummingbird")
    green, green2, white, ruby, dark = (0.3, 0.62, 0.36), (0.42, 0.72, 0.4), (0.94, 0.94, 0.9), (0.85, 0.16, 0.3), (0.16, 0.14, 0.13)
    rig.bone("root", (0, 0, 0), c(0, 0, 1))
    BC = c(0, 0.3, 1.75)

    def body(vb):
        def col(u):
            if u.z < -0.25 and u.y < 0.3:
                return white
            return lerp(green, green2, 0.5 + 0.5 * u.z)
        vb.blob(BC, (1.05 * K, 1.6 * K, 1.1 * K), col, seg=20, ring=14, fn=lambda u: V((0, 0, -0.25 * K * max(0, u.y) * u.z)),
                rot=Matrix.Rotation(-0.35, 3, "X"))
        for s in (-1, 1):  # tiny feet gripping
            vb.tube([BC + c(s * 0.3, 0.2, -0.8), c(s * 0.3, 0.15, 0.25), c(s * 0.3, -0.2, 0.04)], 0.08 * K, dark, sides=4)
            for k in (-1, 0, 1):
                vb.tube([c(s * 0.3, 0.12, 0.08), c(s * 0.3 + k * 0.12, -0.25 + abs(k) * 0.1, 0.03)], 0.04 * K, dark, sides=3)
    rig.bone("body", c(0, 1.6, 1.35), c(0, -1.0, 2.15), "root")
    rig.add(part(body, "hb_body", [feather]), "body")
    HC = c(0, -1.25, 2.7)

    def head(vb):
        vb.blob(HC, (0.85 * K, 0.85 * K, 0.85 * K), lambda u: ruby if (u.z < -0.15 and u.y < 0.2) else lerp(green, green2, 0.5 + 0.5 * u.z),
                seg=18, ring=12)
        vb.blob(HC + c(0, -0.1, -0.55), (0.62 * K, 0.6 * K, 0.42 * K), ruby, seg=12, ring=8)
        for s in (-1, 1):  # white spot behind the eye
            vb.blob(HC + c(s * 0.7, 0.25, 0.15), (0.12 * K, 0.18 * K, 0.1 * K), white, seg=6, ring=4)
        vb.mi = 1
        tip = HC + c(0, -2.6, -0.25)
        vb.tube([HC + c(0, -0.7, -0.05), HC + c(0, -1.6, -0.12), tip], [0.16 * K, 0.08 * K, 0.035 * K], dark, sides=6)
        vb.mi = 0
    rig.bone("head", c(0, -0.6, 2.35), c(0, -1.6, 2.95), "body")
    hp = part(head, "hb_head", [feather, beak_m])
    ey = R.eyes("hb", [HC + c(s * 0.55, -0.45, 0.2) for s in (-1, 1)], 0.24 * K, iris=(0.08, 0.06, 0.05))
    P.ensure_cols(ey)
    rig.add([hp] + ey, "head")

    def tailp(vb):
        for k in range(5):
            a = (k - 2) * 0.22
            d = V((math.sin(a), 1, -0.45)).normalized()
            leaf(vb, BC + c(0, 1.3, -0.45), d, V((0, 0.3, 1)), 1.5 * K, 0.42 * K, lerp(green, dark, 0.3), dark, shape="strap", segs=3,
                 cols=1, droop=0.05, rib=0.15)
    rig.bone("tail", c(0, 1.5, 1.35), c(0, 2.8, 0.75), "body")
    rig.add(part(tailp, "hb_tail", [feather]), "tail")
    for s, sd in ((1, "L"), (-1, "R")):
        root = BC + c(s * 0.75, -0.6, 0.45)

        def wg(vb, root=root, s=s):
            d = c(s * 0.12, 1.0, -0.32).normalized()
            for k in range(3):  # layered feather blades: primaries + coverts, folded along the flank
                leaf(vb, root + c(s * 0.05 * k, k * 0.15, -k * 0.06), (d + c(s * 0.04 * k, 0, 0)).normalized(), c(s * 1, 0, 0.25),
                     (3.3 - k * 0.7) * K, (0.65 - k * 0.1) * K, lerp(green, dark, 0.25 + 0.2 * k), lerp(dark, green, 0.2), shape="strap",
                     segs=4, cols=1, droop=0.04, fold=0.05, rib=0.1)
        rig.bone(f"wing.{sd}", root, root + c(s * 0.8, 3.2, -0.8), "body")
        rig.add(part(wg, f"hb_wing{sd}", [feather]), f"wing.{sd}")
    rig.build()

    def perch(t, amp=1.0):
        return {"head": {"rot": [(Z, 0.45 * S(t, 1) * amp * (abs(S(t, 1)) > 0.3)), (X, 0.08 * S(t, 2))]},
                "tail": {"rot": [(X, 0.08 * S(t, 3))]},
                "body": {"scale": 1 + 0.02 * S(t, 4)}}
    rig.clip("idle", 96, perch)

    def hover(t, feed=False):
        f = Cs(t, 12)
        e = R.ease_in_out(t) if feed else 0.0
        p = {"root": {"loc": (0, -0.3 * K * e * (0.5 + 0.5 * S(t, 3)), (3.0 + 0.25 * S(t, 2)) * K)},
             "body": {"rot": [(X, 0.55 - 0.25 * e)]},
             "head": {"rot": [(X, -0.45 + 0.3 * e + 0.08 * S(t, 3) * e)]},
             "tail": {"rot": [(X, -0.25 + 0.15 * S(t, 2))]}}
        for s, sd in ((1, "L"), (-1, "R")):
            p[f"wing.{sd}"] = {"rot": [(Z, -s * 1.25), (X, 0.25 * f), (Y, -s * 0.9 * f)]}
        return p
    rig.clip("fly", 24, hover, step=1)
    rig.clip("feed", 48, lambda t: hover(t, True), step=1)
    return rig


# =============================================================================== monarch
def monarch():
    bodym = P.mat("mon_body", tex="paint.jpg", rough=0.5)
    shine = C.material("mon_shine", color=(1, 1, 1), emissive=(1, 1, 1), emissive_strength=0.8, rough=0.2)
    wingm = cutout_mat("mon_wing", "p_monarch_wing.png")
    mats = [bodym, shine, wingm]
    rig = R.Rig("monarch")
    black, white = (0.1, 0.08, 0.07), (0.95, 0.94, 0.9)
    rig.bone("root", (0, 0, 0), c(0, 0, 0.3))

    def body(vb):
        dots = lambda u: white if (abs(math.sin(u.y * 9 + u.x * 6)) > 0.93 and u.z < 0.4) else black
        vb.blob(c(0, -0.2, 0.9), (0.24 * K, 0.5 * K, 0.24 * K), dots, seg=12, ring=8)
        vb.blob(c(0, 0.85, 0.85), (0.18 * K, 0.75 * K, 0.18 * K), black, seg=12, ring=8)
        HC = c(0, -0.82, 0.95)
        vb.blob(HC, (0.22 * K, 0.2 * K, 0.21 * K), lambda u: white if u.z < -0.5 else black, seg=12, ring=8)
        bug_eyes(vb, [HC + c(s * 0.13, -0.08, 0.05) for s in (-1, 1)], 0.11 * K, col=(0.1, 0.08, 0.07))
        antennae(vb, [HC + c(s * 0.06, -0.12, 0.15) for s in (-1, 1)], black, 1.5, club=0.07, bend=0.2)
        # curled proboscis
        pts = [HC + c(0, -0.2, -0.12) + c(0, -0.12 * math.sin(a), -0.12 * (1 - math.cos(a))) * (1 - a / 9) for a in [i * 0.9 for i in range(9)]]
        vb.tube(pts, 0.025 * K, (0.2, 0.15, 0.1), sides=4)
        for i, y in enumerate((-0.35, -0.05, 0.25)):  # legs (front pair tucked)
            for s in (-1, 1):
                hip = c(s * 0.12, y, 0.75)
                if i == 0:
                    vb.tube([hip, c(s * 0.2, y - 0.2, 0.6), c(s * 0.15, y - 0.3, 0.7)], 0.035 * K, black, sides=4)
                    continue
                knee = c(s * 0.55, y, 0.85)
                foot = c(s * 0.7, y + (i - 1.5) * 0.4, 0.02)
                vb.tube([hip, knee, foot], [0.04 * K, 0.035 * K, 0.025 * K], black, sides=4)
    rig.bone("body", c(0, 1.5, 0.85), c(0, -0.8, 0.9), "root")
    rig.add(part(body, "mon_body", mats), "body")
    # wings: forewing UV in the atlas' left half, hindwing in the right half (see textures.monarch_wing)
    for s, sd in ((1, "L"), (-1, "R")):
        root = c(s * 0.18, -0.25, 1.0)

        def wg(vb, root=root, s=s):
            vb.mi = 2
            sc = 6.2 * K  # atlas half-width -> cm

            def place(uvroot, du, dv, rect, rootp):
                u0, v0, u1, v1 = rect
                q = []
                for (u, v) in ((u0, v0), (u1, v0), (u1, v1), (u0, v1)):
                    a, b = u - uvroot[0], v - uvroot[1]
                    p = V(rootp) + (du * a + dv * b) * sc
                    q.append(vb.v(p, (1, 1, 1)))
                vb.f(q, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)])

            # forewing: the texture's v (0.07 -> 0.97) runs out & forward, u runs backward
            fdu = V((s * 0.62, 0.9, 0.0))
            fdv = V((s * 0.85, -0.72, 0.04))
            hdu = V((s * 1.0, 0.25, 0.0))
            hdv = V((s * -0.15, -1.0, 0.03))
            place((0.05, 0.07), fdu, fdv, (0.0, 0.0, 0.5, 1.0), root)
            place((0.55, 0.6), hdu, hdv, (0.5, 0.0, 1.0, 1.0), root + c(0, 0.35, -0.03))
        rig.bone(f"wing.{sd}", root, root + c(s * 1.0, 0, 0), "body")
        rig.add(part(wg, f"mon_wing{sd}", mats, light=0), f"wing.{sd}")
    rig.build()

    def wings(a):
        return {"wing.L": {"rot": [(Y, -a)]}, "wing.R": {"rot": [(Y, a)]}}

    def idle(t):  # basking: slow open-close
        a = 0.15 + 0.55 * (0.5 + 0.5 * S(t, 2))
        p = wings(a)
        p["body"] = {"rot": [(Y, 0.02 * S(t))]}
        return p
    rig.clip("idle", 96, idle)

    def fly(t):
        a = 0.2 + 0.85 * Cs(t, 4)
        p = wings(a)
        p["root"] = {"loc": (0, 0, (3.0 + 0.6 * S(t, 4, 0.25)) * K)}
        p["body"] = {"rot": [(X, -0.12 + 0.08 * S(t, 4, 0.1))]}
        return p
    rig.clip("fly", 24, fly, step=1)

    def feed(t):
        a = 0.95 + 0.25 * S(t, 1)  # wings held up, slowly fanning
        p = wings(a)
        p["body"] = {"rot": [(X, 0.12 + 0.03 * S(t, 3))]}
        return p
    rig.clip("feed", 96, feed)

    def migrate(t):  # three beats then a long glide (soaring on autumn thermals)
        k = (t * 2) % 1.0
        a = 0.3 * Cs(k / 0.45, 1.5) if k < 0.45 else -0.12 + 0.03 * S(k, 1)
        p = wings(a)
        p["root"] = {"loc": (0, 0, (3.0 + 0.8 * S(t, 2)) * K)}
        p["body"] = {"rot": [(X, -0.08), (Y, 0.08 * S(t, 1))]}
        return p
    rig.clip("move", 96, migrate, step=1)

    def roost(t):  # winter roost: wings closed upright, gently swaying in the cluster
        p = wings(1.45 + 0.04 * S(t, 2))
        p["body"] = {"rot": [(Y, 0.06 * S(t, 1)), (X, 0.04 * S(t, 1, 0.3))]}
        return p
    rig.clip("special", 120, roost)
    return rig


NAMES = {"bumblebee": bumblebee, "hoverfly": hoverfly, "hummingbird": hummingbird, "monarch": monarch}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for n in (argv or list(NAMES)):
        C.reset()
        rig = NAMES[n]()
        rig.export(os.path.abspath(os.path.join(C.OUT, f"p3_{n}.glb")))
