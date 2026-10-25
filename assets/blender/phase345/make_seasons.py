"""Phase 5 - Seasons: creatures, seasonal set dressing, photo challenge board, class expedition flag post.

OW_TEX=<tex> OW_OUT=<glb> blender -b --factory-startup -P make_seasons.py [-- names...]
names: robin swallow cicada leaves snow blossoms photo_board flag
Creatures are real size (robin 14 cm, swallow 18 cm with streamers, cicada 4 cm), rigged, facing -Y (glTF +Z),
origin under the feet; clips idle / move / special:
  robin   (winter) move = one hop (in place), special = singing (head up, beak opens, breast puffs)
  swallow (spring) move = flight loop (in place, 8 cm up), special = swoop (dive with wings swept, climb)
  cicada  (summer) move = flight loop, special = singing (abdomen tymbal buzz)
The autumn monarch migration reuses p3_monarch.glb (clips move = flap-and-glide, special = roost).
Kits (nodes laid out along X, origin at each base): p5_leaf_piles (leaf_pile_0..2), p5_snow_caps
(snow_cap_small/medium/large, concave underside sits on a rock top), p5_blossoms (blossom_0/1 hanging clusters,
origin at the twig end that meets the branch; blossom_2 fallen petals on the ground).
photo_board: mesh board_face (0-1 UV, 2:1) shows this week's theme. flag: mesh flag_cloth (0-1 UV, 4:3, hoist at u=0)
skinned to a 4-bone chain, clip wave.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import p345 as P  # noqa: E402
import xrig as R  # noqa: E402
from p345 import C, PI, UP, V, VB, leaf, lerp, mulc  # noqa: E402
from xrig import Cs, S, X, Y, Z  # noqa: E402
from make_pollinators import antennae, bug_eyes, legs6, part, wing_card, wing_mat  # noqa: E402

K = 0.01


def c(x, y, z):
    return V((x, y, z)) * K


def toes(vb, foot, s, col, r=0.1, L=0.9):
    for k in (-1, 0, 1):
        vb.tube([foot, foot + c(s * 0.05 + k * 0.32 * L, -L + abs(k) * 0.25 * L, -0.02)], [r * K, r * K * 0.6], col, sides=4)
    vb.tube([foot, foot + c(0, L * 0.7, -0.02)], [r * K, r * K * 0.6], col, sides=4)


def wing_blades(vb, root, d, out, lens, W, c0, c1, edge=None, spread=0.05):
    for k, Lk in enumerate(lens):
        leaf(vb, root + d * (k * 0.12 * K) + V((0, 0, -k * 0.06 * K)), (d + out * (spread * k)).normalized(), out, Lk * K, W * K,
             lerp(c0, c1, 0.15 * k), c1, shape="strap", segs=4, cols=1, droop=0.04, fold=0.05, rib=0.08, edge=edge)


# =============================================================================== robin
def robin():
    feather = P.mat("rb_feather", tex="fur.jpg", rough=0.85)
    beakm = P.mat("rb_beak", tex="paint.jpg", rough=0.4)
    rig = R.Rig("robin")
    orange, brown, grey, cream, dark, leg = (0.93, 0.45, 0.18), (0.52, 0.41, 0.28), (0.66, 0.66, 0.63), (0.96, 0.93, 0.86), (0.2, 0.16, 0.13), (0.6, 0.44, 0.36)
    rig.bone("root", (0, 0, 0), c(0, 0, 1))
    BC = c(0, 0.6, 5.6)

    def body(vb):
        def col(u):
            if u.z < -0.35 and u.y > -0.55:
                return cream
            if u.y < 0.05 and abs(u.x) < 0.88:
                return orange
            if u.y < 0.3:
                return grey
            return brown
        vb.blob(BC, (3.1 * K, 4.0 * K, 3.3 * K), col, seg=22, ring=14, noise=0.12 * K, nscale=90, rot=Matrix.Rotation(-0.35, 3, "X"))
        for s in (-1, 1):
            hip = BC + c(s * 0.9, 0.4, -2.6)
            knee = c(s * 1.0, 0.8, 1.4)
            foot = c(s * 1.0, -0.2, 0.12)
            vb.tube([hip, knee, foot], [0.22 * K, 0.17 * K, 0.15 * K], leg, sides=5)
            toes(vb, foot, s, leg, r=0.12, L=1.0)
    rig.bone("body", c(0, 3.5, 4.6), c(0, -2.5, 7.0), "root")
    rig.add(part(body, "rb_body", [feather]), "body")
    HC = c(0, -2.6, 8.7)

    def head(vb):
        def col(u):
            if u.y < -0.1 and u.z < 0.35:
                return orange
            if u.y < 0.15 and u.z < 0.5:
                return grey
            return brown
        vb.blob(HC, (2.25 * K, 2.3 * K, 2.2 * K), col, seg=18, ring=12, noise=0.08 * K, nscale=90)
        vb.mi = 1
        vb.tube([HC + c(0, -1.9, -0.25), HC + c(0, -2.6, -0.38), HC + c(0, -3.15, -0.5)], [0.34 * K, 0.18 * K, 0.04 * K], dark, sides=7)
        vb.mi = 0
    rig.bone("head", c(0, -1.6, 7.6), c(0, -3.4, 9.6), "body")
    hp = part(head, "rb_head", [feather, beakm])
    ey = R.eyes("rb", [HC + c(s * 1.42, -1.32, 0.45) for s in (-1, 1)], 0.55 * K, iris=(0.07, 0.05, 0.04))
    P.ensure_cols(ey)
    rig.add([hp] + ey, "head")

    def jaw(vb):
        vb.tube([HC + c(0, -1.8, -0.55), HC + c(0, -2.4, -0.62), HC + c(0, -2.9, -0.66)], [0.26 * K, 0.14 * K, 0.04 * K], dark, sides=6)
    rig.bone("jaw", HC + c(0, -1.8, -0.55), HC + c(0, -2.9, -0.66), "head")
    rig.add(part(jaw, "rb_jaw", [beakm]), "jaw")

    def tail(vb):
        for k in range(5):
            a = (k - 2) * 0.13
            leaf(vb, BC + c(0, 3.2, -1.2), V((math.sin(a), 1, -0.3)).normalized(), V((0, 0.2, 1)), 4.4 * K, 1.15 * K, brown,
                 mulc(brown, 0.75), shape="strap", segs=3, cols=1, droop=0.05, rib=0.1)
    rig.bone("tail", BC + c(0, 3.0, -1.1), BC + c(0, 7.2, -2.4), "body")
    rig.add(part(tail, "rb_tail", [feather]), "tail")
    for s, sd in ((1, "L"), (-1, "R")):
        root = BC + c(s * 2.75, -1.2, 1.2)
        d = c(-s * 0.04, 1.0, -0.55).normalized()

        def wg(vb, root=root, s=s, d=d):
            wing_blades(vb, root, d, c(s, 0, 0.15).normalized(), (5.2, 4.4, 3.5), 1.5, brown, mulc(brown, 0.72), edge=(0.86, 0.76, 0.58),
                        spread=0.0)
        rig.bone(f"wing.{sd}", root, root + d * 5 * K, "body")
        rig.add(part(wg, f"rb_wing{sd}", [feather]), f"wing.{sd}")
    rig.build()

    def idle(t):
        look = [0.0, 0.5, 0.5, -0.3, -0.3, 0.2, 0.2, 0.0][int(t * 8) % 8]
        flick = max(0.0, S(t, 2, 0.1)) ** 8
        return {"head": {"rot": [(Z, look), (X, 0.06 * S(t, 2))]},
                "tail": {"rot": [(X, -0.35 * flick)]},
                "body": {"scale": 1 + 0.025 * S(t, 4)},
                "wing.L": {"rot": [(Y, -0.06 * flick)]}, "wing.R": {"rot": [(Y, 0.06 * flick)]}}
    rig.clip("idle", 96, idle)

    def hop(t):
        air = max(0.0, math.sin(t * PI * 2)) if t < 0.5 else 0.0
        crouch = max(0.0, -math.sin(t * PI * 2)) * 0.6
        return {"root": {"loc": (0, 0, (2.6 * air - 0.5 * crouch) * K)},
                "body": {"rot": [(X, -0.15 * air + 0.12 * crouch)]},
                "head": {"rot": [(X, 0.12 * air - 0.08 * crouch)]},
                "tail": {"rot": [(X, -0.25 * crouch + 0.15 * air)]},
                "wing.L": {"rot": [(Z, -0.35 * air), (Y, -0.3 * air)]}, "wing.R": {"rot": [(Z, 0.35 * air), (Y, 0.3 * air)]}}
    rig.clip("move", 24, hop, step=1)

    def sing(t):
        e = R.ease_in_out(t)
        trill = 0.5 + 0.5 * S(t, 10)
        return {"head": {"rot": [(X, -0.45 * e), (Z, 0.08 * S(t, 2) * e)]},
                "jaw": {"rot": [(X, 0.4 * e * trill)]},
                "body": {"rot": [(X, -0.08 * e)], "scale": 1 + 0.06 * e * trill},
                "tail": {"rot": [(X, 0.15 * e)]}}
    rig.clip("special", 96, sing, step=1)
    return rig


# =============================================================================== swallow
def swallow():
    feather = P.mat("sw_feather", tex="paint.jpg", rough=0.35, metal=0.2)
    rig = R.Rig("swallow")
    navy, navy2, rust, cream, dark = (0.13, 0.23, 0.52), (0.2, 0.33, 0.66), (0.8, 0.32, 0.17), (0.97, 0.9, 0.78), (0.1, 0.11, 0.16)
    rig.bone("root", (0, 0, 0), c(0, 0, 1))
    BC = c(0, 0.6, 3.3)

    def body(vb):
        def col(u):
            if u.z < -0.25:
                return cream
            if u.y < -0.7 and u.z < 0.35:
                return navy
            return lerp(navy, navy2, 0.5 + 0.5 * u.z)
        vb.blob(BC, (1.75 * K, 3.6 * K, 1.8 * K), col, seg=20, ring=12, rot=Matrix.Rotation(-0.12, 3, "X"))
        for s in (-1, 1):
            foot = c(s * 0.7, -0.4, 0.08)
            vb.tube([BC + c(s * 0.6, -0.2, -1.4), c(s * 0.7, 0.0, 0.9), foot], [0.14 * K, 0.11 * K, 0.1 * K], dark, sides=4)
            toes(vb, foot, s, dark, r=0.07, L=0.6)
    rig.bone("body", c(0, 3.6, 3.1), c(0, -2.6, 3.8), "root")
    rig.add(part(body, "sw_body", [feather]), "body")
    HC = c(0, -3.0, 4.6)

    def head(vb):
        def col(u):
            if u.z < -0.05 and u.y < 0.35:
                return rust
            if u.y < -0.72 and u.z > -0.05 and u.z < 0.55:
                return rust
            return lerp(navy, navy2, 0.5 + 0.5 * u.z)
        vb.blob(HC, (1.5 * K, 1.65 * K, 1.5 * K), col, seg=16, ring=12)
        vb.tube([HC + c(0, -1.45, -0.1), HC + c(0, -2.05, -0.2)], [0.25 * K, 0.04 * K], dark, sides=6)
    rig.bone("head", c(0, -2.0, 4.0), c(0, -3.6, 5.4), "body")
    hp = part(head, "sw_head", [feather])
    ey = R.eyes("sw", [HC + c(s * 0.98, -0.92, 0.32) for s in (-1, 1)], 0.42 * K, iris=(0.06, 0.05, 0.05))
    P.ensure_cols(ey)
    rig.add([hp] + ey, "head")

    def tail(vb):
        root = BC + c(0, 3.2, -0.2)
        for s in (-1, 1):
            leaf(vb, root, V((s * 0.2, 1, -0.06)).normalized(), V((0, 0, 1)), 7.6 * K, 0.6 * K, navy, dark, shape="strap", segs=5, cols=1,
                 droop=0.03, rib=0.1)
            for k in (0.06, 0.12):
                leaf(vb, root, V((s * k, 1, -0.08)).normalized(), V((0, 0, 1)), 3.6 * K, 0.9 * K, navy, dark, shape="strap", segs=3,
                     cols=1, droop=0.03, rib=0.1, edge=(0.9, 0.9, 0.9))
    rig.bone("tail", BC + c(0, 3.0, -0.2), BC + c(0, 8.0, -0.6), "body")
    rig.add(part(tail, "sw_tail", [feather]), "tail")
    for s, sd in ((1, "L"), (-1, "R")):
        root = BC + c(s * 1.4, -1.3, 0.8)
        d = c(-s * 0.05, 1.0, -0.04).normalized()

        def wg(vb, root=root, s=s, d=d):
            wing_blades(vb, root, d, c(s, 0, 0.2).normalized(), (9.4, 8.0, 6.2), 1.3, navy, dark, spread=0.0)
        rig.bone(f"wing.{sd}", root, root + d * 8 * K, "body")
        rig.add(part(wg, f"sw_wing{sd}", [feather]), f"wing.{sd}")
    rig.build()

    def idle(t):
        look = [0.0, 0.4, 0.4, -0.35, -0.35, 0.0][int(t * 6) % 6]
        return {"head": {"rot": [(Z, look), (X, 0.05 * S(t, 2))]},
                "tail": {"rot": [(Z, 0.06 * S(t, 3))]},
                "body": {"scale": 1 + 0.02 * S(t, 4)}}
    rig.clip("idle", 96, idle)

    def wingpose(spread, flap, sweep=0.0):
        return {"wing.L": {"rot": [(Z, -1.35 * spread + sweep), (Y, -flap)]}, "wing.R": {"rot": [(Z, 1.35 * spread - sweep), (Y, flap)]}}

    def fly(t):
        f = Cs(t, 3)
        p = wingpose(1.0, 0.75 * f)
        p["root"] = {"loc": (0, 0, (8.0 + 0.6 * S(t, 3, 0.25)) * K)}
        p["body"] = {"rot": [(X, -0.05)]}
        p["tail"] = {"rot": [(X, 0.05 * S(t, 3))]}
        return p
    rig.clip("move", 24, fly, step=1)

    def swoop(t):
        dive = R.smoothstep(0.05, 0.3, t) * (1 - R.smoothstep(0.45, 0.6, t))
        climb = R.smoothstep(0.45, 0.6, t) * (1 - R.smoothstep(0.85, 1.0, t))
        z = 8.0 - 6.0 * math.sin(PI * R.smoothstep(0.05, 0.7, t)) + 0.6 * S(t, 2)
        flapping = 1 - dive
        p = wingpose(1.0 - 0.55 * dive, 0.75 * Cs(t, 6) * flapping, sweep=0.0)
        p["root"] = {"loc": (0, 0, z * K)}
        p["body"] = {"rot": [(X, 0.45 * dive - 0.35 * climb)]}
        p["tail"] = {"rot": [(X, -0.2 * climb)]}
        p["head"] = {"rot": [(X, -0.2 * dive)]}
        return p
    rig.clip("special", 72, swoop, step=1)
    return rig


# =============================================================================== cicada
def cicada():
    bodym = P.mat("ci_body", tex="paint.jpg", rough=0.45)
    shine = C.material("ci_shine", color=(1, 1, 1), emissive=(1, 1, 1), emissive_strength=0.8, rough=0.2)
    wing = wing_mat("ci_wing", "p_clear_wing.png", tint=(0.86, 1.0, 0.86))
    mats = [bodym, shine, wing]
    rig = R.Rig("cicada")
    green, olive, gold, dark = (0.42, 0.58, 0.26), (0.3, 0.36, 0.18), (0.78, 0.7, 0.32), (0.16, 0.14, 0.1)
    rig.bone("root", (0, 0, 0), c(0, 0, 0.3))
    TH = c(0, -0.15, 0.78)

    def body(vb):
        def col(u):
            if u.z > 0.35 and abs(u.x) < 0.22 + 0.25 * (u.y + 1) and abs(u.x) > 0.12 * (1 - u.y):
                return green
            if u.z > 0.1 and u.y < -0.75:
                return gold
            return (0.24, 0.28, 0.14) if u.z > 0.0 else olive
        vb.blob(TH, (0.66 * K, 0.78 * K, 0.52 * K), col, seg=16, ring=10)
        legs6(vb, (0.32, 0.36, 0.2), (-0.35, -0.1, 0.15), 0.45, 0.28, 0.42, r=0.06)
    rig.bone("body", c(0, 0.5, 0.78), c(0, -0.8, 0.8), "root")
    rig.add(part(body, "ci_thorax", mats), "body")
    AB = c(0, 0.95, 0.56)

    def abdomen(vb):
        def col(u):
            band = math.sin((u.y + 1) * PI * 4)
            return mulc(olive, 0.9) if band > 0.4 else (0.22, 0.22, 0.13)
        vb.blob(AB, (0.46 * K, 0.95 * K, 0.34 * K), col, seg=16, ring=10, fn=lambda u: V((0, 0, -0.1 * K * max(0, u.y))))
    rig.bone("abdomen", c(0, 0.4, 0.68), c(0, 1.8, 0.5), "body")
    rig.add(part(abdomen, "ci_abdomen", mats), "abdomen")
    HC = c(0, -1.02, 0.78)

    def head(vb):
        vb.blob(HC, (0.8 * K, 0.3 * K, 0.34 * K), lambda u: green if (u.z > -0.1 and abs(u.x) < 0.6) else olive, seg=14, ring=8)
        vb.blob(HC + c(0, -0.22, -0.05), (0.26 * K, 0.18 * K, 0.3 * K), lambda u: olive if math.sin(u.z * 14) > 0 else mulc(olive, 0.7),
                seg=10, ring=8)
        bug_eyes(vb, [HC + c(s * 0.82, 0.04, 0.12) for s in (-1, 1)], 0.22 * K, col=(0.42, 0.3, 0.16))
        antennae(vb, [HC + c(s * 0.3, -0.2, 0.15) for s in (-1, 1)], dark, 0.28)
        vb.tube([HC + c(0, -0.2, -0.3), HC + c(0, 0.1, -0.55), HC + c(0, 0.55, -0.62)], [0.05 * K, 0.04 * K, 0.03 * K], dark, sides=4)
    rig.bone("head", c(0, -0.75, 0.8), c(0, -1.35, 0.8), "body")
    rig.add(part(head, "ci_head", mats), "head")
    for s, sd in ((1, "L"), (-1, "R")):
        root = TH + c(s * 0.22, -0.3, 0.44)
        d = c(s * 0.03, 1.0, -0.07).normalized()

        def wg(vb, root=root, s=s, d=d):
            vb.mi = 2
            on = c(s * 0.5, 0, -1.0).normalized()  # roof-like tent over the abdomen
            top = TH + c(s * 0.04, -0.3, 0.56)
            wing_card(vb, top + on * 0.47 * K, d, on, 3.0 * K, 0.95 * K, uv=(0, 0.12, 1, 0.88), segs=2)
            wing_card(vb, top + c(0, 0.35, -0.05) + on * 0.42 * K, (d + c(s * 0.08, 0, 0)).normalized(), on, 1.7 * K, 0.6 * K,
                      uv=(0, 0.12, 1, 0.88))
        rig.bone(f"wing.{sd}", root, root + d * 2.5 * K, "body")
        rig.add(part(wg, f"ci_wing{sd}", mats, light=0), f"wing.{sd}")
    rig.build()

    def idle(t):
        return {"abdomen": {"rot": [(X, 0.03 * S(t, 3))], "scale": 1 + 0.03 * S(t, 3)},
                "head": {"rot": [(Z, 0.12 * S(t, 1)), (X, 0.05 * S(t, 2))]},
                "body": {"rot": [(Y, 0.02 * S(t, 1))]}}
    rig.clip("idle", 96, idle)

    def fly(t):
        f = Cs(t, 8)
        return {"root": {"loc": (0, 0, (2.6 + 0.3 * S(t, 2)) * K)},
                "body": {"rot": [(X, -0.15)]},
                "abdomen": {"rot": [(X, 0.1 + 0.04 * S(t, 2))]},
                "wing.L": {"rot": [(Z, -1.25), (X, -0.3), (Y, -0.8 * f)]}, "wing.R": {"rot": [(Z, 1.25), (X, -0.3), (Y, 0.8 * f)]}}
    rig.clip("move", 24, fly, step=1)

    def sing(t):
        e = R.smoothstep(0.0, 0.1, t) * (1 - R.smoothstep(0.85, 1.0, t))
        buzz = S(t, 36)
        return {"abdomen": {"rot": [(X, -0.08 * e + 0.04 * e * buzz)], "scale": 1 + e * (0.05 + 0.05 * buzz)},
                "body": {"rot": [(Y, 0.015 * e * S(t, 30))]},
                "wing.L": {"rot": [(Z, -0.12 * e)]}, "wing.R": {"rot": [(Z, 0.12 * e)]},
                "head": {"rot": [(X, -0.05 * e)]}}
    rig.clip("special", 72, sing, step=1)
    return rig


# =============================================================================== leaf piles
AUTUMN = [(0.86, 0.3, 0.12), (0.93, 0.52, 0.14), (0.97, 0.76, 0.24), (0.66, 0.32, 0.13), (0.78, 0.2, 0.12), (0.9, 0.62, 0.2)]


def autumn_leaf(vb, rng, base, d, up, size):
    cb = rng.choice(AUTUMN)
    ct = lerp(cb, rng.choice(AUTUMN), 0.6)
    shape = rng.choice(("ovate", "ovate", "heart", "lance", "round"))
    leaf(vb, base, d, up, size, size * (0.55 if shape == "lance" else 0.75), mulc(cb, 0.85), ct, shape=shape, segs=2, cols=1,
         fold=0.18, droop=-0.08, curl_side=0.25, rib=0.15, serr=0.08 if shape != "lance" else 0.0)


def leaf_pile(name, Rr, H, n, seed):
    rng = random.Random(seed)
    m = P.mat("lp_leaf", tex="paint.jpg", rough=0.75, double=True)
    vb = VB()
    zc = -H * 0.35
    off = V((seed, seed * 0.7, 0))

    def litter(co):
        k = C.fbm(co * (9.0 / Rr) + off, 2)
        return lerp(lerp((0.55, 0.26, 0.1), (0.85, 0.45, 0.15), 0.5 + k), (0.95, 0.7, 0.25), max(0.0, k) * 0.6)
    n0 = len(vb.bm.verts)
    prof = [(Rr * 1.02, -0.01), (Rr * 0.9, H * 0.35), (Rr * 0.65, H * 0.75), (Rr * 0.35, H * 0.95), (0.0, H)]
    vb.lathe(prof, litter, segs=22, cap=False, scale=(1, 0.85, 1))
    vb.bm.verts.ensure_lookup_table()
    for v in list(vb.bm.verts)[n0:]:
        if v.co.z > 0.0:
            v.co.z += H * 0.18 * C.fbm(v.co * (6.0 / Rr) + off, 2)

    def surf(x, y):
        q = 1 - (x / Rr) ** 2 - (y / (Rr * 0.85)) ** 2
        if q <= 0:
            return None
        return H * q ** 0.8
    for i in range(n):
        ring = rng.random() < 0.18
        a = rng.uniform(0, 2 * PI)
        if ring:  # a few strays around the pile
            r = Rr * rng.uniform(0.95, 1.5)
            x, y = math.cos(a) * r, math.sin(a) * r * 0.9
            z, up = 0.006, V((rng.uniform(-0.15, 0.15), rng.uniform(-0.15, 0.15), 1)).normalized()
        else:
            r = Rr * math.sqrt(rng.random()) * 0.97
            x, y = math.cos(a) * r, math.sin(a) * r * 0.85
            z = surf(x, y)
            if z is None or z < 0.0:
                z = 0.006
            up = V((x / Rr ** 2 * H, y / (Rr * 0.85) ** 2 * H, 0.6)).normalized()
            up = (up + V((rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), 0.3))).normalized()
            z += 0.01
        d = up.cross(V((math.cos(rng.uniform(0, 2 * PI)), math.sin(rng.uniform(0, 2 * PI)), 0))).normalized()
        sz = rng.uniform(0.07, 0.12)
        autumn_leaf(vb, rng, V((x, y, z)) - d * sz * 0.4, d, up, sz)
        if rng.random() < 0.5:  # little stem
            vb.tube([V((x, y, z)) - d * sz * 0.4, V((x, y, z)) - d * sz * 0.6], 0.003, (0.4, 0.25, 0.12), sides=3)
    return vb.obj(name, [m], light=0.25)


def make_leaves():
    C.reset()
    objs = [leaf_pile("leaf_pile_0", 0.32, 0.12, 240, 11), leaf_pile("leaf_pile_1", 0.5, 0.18, 390, 23), leaf_pile("leaf_pile_2", 0.72, 0.24, 560, 37)]
    P.layout(objs, gap=0.5)
    P.export("p5_leaf_piles", objs)


# =============================================================================== snow caps
def snow_cap(name, Rr, H, seed):
    m = P.mat("sn_snow", tex="paint.jpg", rough=0.55)
    vb = VB()
    off = V((seed * 1.7, seed * 0.3, 0))

    def fn(u):
        a = math.atan2(u.y, u.x)
        rim = 1 + 0.12 * math.sin(a * 3 + seed) + 0.06 * math.sin(a * 7 + seed * 2)
        rr = math.sqrt(u.x * u.x + u.y * u.y)
        if u.z >= 0:
            z = H * (u.z ** 0.75) * (1 + 0.15 * C.fbm(u * 2.5 + off, 2))
        else:  # concave underside: drooping rim, rising to the centre (sits on a rounded rock top)
            z = -H * 0.38 * (1 - abs(u.z)) ** 1.5 + H * 0.12 * (abs(u.z))
        p = V((u.x * Rr * rim, u.y * Rr * rim * 0.9, z))
        return p - V((u.x, u.y, u.z)) * 0  # absolute position (radii set to 0 below)

    def col(u):
        if u.z < 0:
            return (0.7, 0.78, 0.92)
        k = C.fbm(u * 3.0 + off, 2)
        return lerp((0.74, 0.82, 0.95), (0.95, 0.96, 0.99), min(1.0, u.z ** 0.5 * 0.8 + 0.3 * k))
    vb.blob((0, 0, H * 0.38), (0.0, 0.0, 0.0), col, seg=32, ring=16, fn=fn)
    rng = random.Random(seed)
    for k in range(5 + int(Rr * 6)):  # soft lumps of fresh snow on top
        a, r = rng.uniform(0, 2 * PI), Rr * rng.uniform(0.0, 0.7)
        q = 1 - (r / (Rr * 1.05)) ** 2
        z = H * 0.38 + H * q ** 0.7 * 0.92
        s = Rr * rng.uniform(0.12, 0.22)
        vb.blob((math.cos(a) * r, math.sin(a) * r, z), (s, s * 0.9, s * 0.45), lambda u: lerp((0.8, 0.86, 0.96), (0.97, 0.98, 1.0), 0.5 + 0.5 * u.z),
                seg=10, ring=6)
    ob = vb.obj(name, [m], light=0.18, warm=0.02)
    return ob


def make_snow():
    C.reset()
    objs = [snow_cap("snow_cap_small", 0.3, 0.12, 3), snow_cap("snow_cap_medium", 0.55, 0.18, 5), snow_cap("snow_cap_large", 0.9, 0.26, 7)]
    P.layout(objs, gap=0.5)
    P.export("p5_snow_caps", objs)


# =============================================================================== blossoms
PINK, WHITE, DEEP = (0.98, 0.72, 0.82), (1.0, 0.96, 0.97), (0.92, 0.45, 0.62)


def flower(vb, rng, center, nrm, r):
    nrm = V(nrm).normalized()
    t = nrm.cross(V((0.3, 0.2, 1))).normalized()
    if t.length < 1e-3:
        t = V((1, 0, 0))
    b = nrm.cross(t).normalized()
    a0 = rng.uniform(0, 2 * PI)
    base = lerp(WHITE, PINK, rng.uniform(0.2, 1.0))
    for k in range(5):
        a = a0 + k * 2 * PI / 5
        d = (t * math.cos(a) + b * math.sin(a) + nrm * 0.25).normalized()
        leaf(vb, center, d, nrm, r, r * 0.85, mulc(DEEP, 1.05), base, shape="petal", segs=2, cols=1, fold=-0.1, droop=-0.15, rib=0.0)
    vb.blob(center + nrm * r * 0.08, (r * 0.22,) * 3, (0.98, 0.82, 0.36), seg=6, ring=4)


def blossom_cluster(name, seed, n, L):
    rng = random.Random(seed)
    bark = P.mat("bl_bark", tex="bark.jpg", normal="bark_n.jpg", tint=(0.55, 0.4, 0.36), rough=0.9)
    petal = P.mat("bl_petal", tex="paint.jpg", rough=0.6, double=True)
    tw, fl = VB(), VB()
    # main twig from the branch end (origin) out along -Y and drooping a little
    main = [V((0, 0, 0)), V((0.02, -L * 0.35, -0.03)), V((-0.02, -L * 0.7, -0.09)), V((0.01, -L, -0.18))]
    mp = R.smooth_pts(main, 4)
    tw.tube(mp, [0.018 - 0.014 * i / (len(mp) - 1) for i in range(len(mp))], (0.6, 0.45, 0.4), sides=6, noise=0.003)
    sprigs = []
    for k in range(5):
        tt = 0.2 + 0.16 * k
        p0 = main[1].lerp(main[2], tt) if tt < 0.6 else main[2].lerp(main[3], (tt - 0.6) / 0.4)
        s = 1 if k % 2 else -1
        p1 = p0 + V((s * rng.uniform(0.08, 0.16), -rng.uniform(0.03, 0.1), rng.uniform(-0.02, 0.08)))
        tw.tube([p0, (p0 + p1) / 2 + V((0, 0, 0.02)), p1], [0.007, 0.005, 0.003], (0.6, 0.45, 0.4), sides=5)
        sprigs.append((p0, p1))
    pts = [main[0].lerp(main[3], i / 12) for i in range(3, 13)] + [a.lerp(b, f) for a, b in sprigs for f in (0.5, 1.0)]
    for i in range(n):
        p = rng.choice(pts) + V((rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), rng.uniform(-0.04, 0.05)))
        nrm = V((rng.uniform(-1, 1), rng.uniform(-1, 0.3), rng.uniform(-0.2, 1)))
        flower(fl, rng, p, nrm, rng.uniform(0.016, 0.024))
    for i in range(n // 5):  # buds and fresh leaves
        p = rng.choice(pts) + V((rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03), rng.uniform(-0.02, 0.03)))
        if i % 2:
            fl.blob(p, (0.008, 0.008, 0.011), DEEP, seg=6, ring=4)
        else:
            d = V((rng.uniform(-1, 1), rng.uniform(-1, 0.2), rng.uniform(-0.2, 0.6))).normalized()
            leaf(fl, p, d, V((0, 0, 1)), 0.05, 0.022, (0.42, 0.62, 0.26), (0.62, 0.78, 0.36), shape="ovate", segs=3, cols=1, droop=0.15)
    a = tw.obj(name + "_twig", [bark], light=0.2)
    b = fl.obj(name + "_flowers", [petal], light=0.15)
    return P.join([a, b], name)


def fallen_petals(name, seed, n, Rr):
    rng = random.Random(seed)
    petal = P.mat("bl_petal", tex="paint.jpg", rough=0.6, double=True)
    vb = VB()
    for i in range(n):
        a, r = rng.uniform(0, 2 * PI), Rr * math.sqrt(rng.random()) * (1 if rng.random() < 0.8 else 1.3)
        p = V((math.cos(a) * r, math.sin(a) * r, 0.004 + rng.uniform(0, 0.004)))
        d = V((math.cos(rng.uniform(0, 2 * PI)), math.sin(rng.uniform(0, 2 * PI)), rng.uniform(-0.05, 0.1))).normalized()
        s = rng.uniform(0.02, 0.03)
        leaf(vb, p, d, V((0, 0, 1)), s, s * 0.85, lerp(PINK, DEEP, rng.uniform(0, 0.5)), lerp(WHITE, PINK, rng.uniform(0.4, 1)), shape="petal",
             segs=2, cols=1, fold=-0.15, droop=-0.2)
    for i in range(6):  # a few whole flowers that fell
        a, r = rng.uniform(0, 2 * PI), Rr * rng.uniform(0, 0.8)
        flower(vb, rng, V((math.cos(a) * r, math.sin(a) * r, 0.008)), V((rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), 1)), 0.02)
    return vb.obj(name, [petal], light=0.1)


def make_blossoms():
    C.reset()
    objs = [blossom_cluster("blossom_0", 41, 52, 0.45), blossom_cluster("blossom_1", 59, 72, 0.6), fallen_petals("blossom_2", 77, 240, 0.5)]
    for o in objs[:2]:  # lift for the preview layout only (the origin stays at the twig end)
        o.location.z = 0.35
    P.layout(objs, gap=0.4)
    P.export("p5_blossoms", objs)


# =============================================================================== photo challenge board
def make_photo_board():
    C.reset()
    wood = P.mat("pb_wood", tex="p_timber.jpg", normal="p_timber_n.jpg", tint=(0.9, 0.76, 0.6), rough=0.8)
    brass = P.mat("pb_brass", tex="brass.jpg", rough=0.35, metal=0.85)
    paint = P.mat("pb_paint", tex="sh_paint.jpg", rough=0.45, metal=0.1)
    lens = P.glass("pb_lens", color=(0.5, 0.75, 0.85), alpha=0.6)
    face_m = C.material("board_face", tex="p_photo_board.jpg", rough=0.7)
    objs = []

    def wb(nm, size, loc, rot=(0, 0, 0), base=(0.92, 0.8, 0.64), m=wood, bevel=0.015):
        o = C.box_obj(nm, size, loc, m, rot=rot, bevel=bevel, segments=1, uv_scale=1.5)
        P.paint(o, P.wood_fn(base, seed=len(nm)), ao=(0, 0.6))
        objs.append(o)
        return o
    W, H, Z0, T = 1.5, 0.75, 0.75, 0.12  # board tilted back like an easel
    for sx in (-1, 1):  # two front legs and splayed feet
        wb(f"leg{sx}", (0.08, 0.08, Z0 + H + 0.25), (sx * (W / 2 + 0.02), 0.08, (Z0 + H + 0.25) / 2), rot=(-T, 0, 0))
        wb(f"foot{sx}", (0.14, 0.42, 0.07), (sx * (W / 2 + 0.02), 0.12, 0.035), base=(0.8, 0.66, 0.52))
    wb("backleg", (0.07, 0.07, Z0 + H), (0, 0.55, (Z0 + H) / 2 - 0.05), rot=(0.42, 0, 0))
    zc = Z0 + H / 2
    yb = 0.08 - math.sin(T) * (zc - (Z0 + H + 0.25) / 2)
    wb("backing", (W, 0.04, H), (0, yb + 0.03, zc), rot=(-T, 0, 0), base=(0.72, 0.58, 0.46))
    for k, (sx, sz, dx, dz) in enumerate(((W + 0.12, 0.07, 0, H / 2), (W + 0.12, 0.07, 0, -H / 2), (0.07, H, W / 2, 0), (0.07, H, -W / 2, 0))):
        o = C.box_obj(f"fr{k}", (sx, 0.07, sz), (0, 0, 0), brass, bevel=0.012, segments=1)
        o.location = V((dx, yb, zc)) + Matrix.Rotation(-T, 3, "X") @ V((0, 0, dz))
        o.rotation_euler = (-T, 0, 0)
        P.paint(o, None)
        objs.append(o)
    ledge = wb("ledge", (W + 0.1, 0.14, 0.04), (0, yb - 0.08 + math.sin(T) * H / 2, Z0 - 0.03), base=(0.85, 0.7, 0.55))
    # a friendly wooden camera sitting on top of the board
    top = V((0, yb + math.sin(T) * H / 2, Z0 + H + 0.04))
    cam = VB()
    cam.box((0.34, 0.16, 0.2), top + V((0, 0, 0.13)), (0.95, 0.42, 0.3), bevel=0.03, segs=2)
    cam.box((0.1, 0.1, 0.06), top + V((-0.08, 0.0, 0.26)), (0.95, 0.42, 0.3), bevel=0.015, segs=2)
    cam.box((0.06, 0.04, 0.03), top + V((0.1, 0.0, 0.245)), (0.98, 0.82, 0.3), bevel=0.01, segs=1)
    objs.append(cam.obj("camera_body", [paint]))
    rim = VB()
    rim.lathe([(0.0, 0.0), (0.085, 0.0), (0.09, 0.05), (0.07, 0.07), (0.0, 0.07)], (1, 1, 1), segs=18, loc=top + V((0, -0.07, 0.13)),
              rot=Matrix.Rotation(PI / 2, 3, "X").to_quaternion())
    objs.append(rim.obj("camera_lens_rim", [brass]))
    ln = VB()
    ln.blob(top + V((0, -0.145, 0.13)), (0.058, 0.02, 0.058), (1, 1, 1), seg=14, ring=8)
    objs.append(ln.obj("camera_lens", [lens], light=0))
    body = P.join(objs, "photo_board_body")
    fv = VB()
    rot = Matrix.Rotation(-T, 3, "X")
    w2, h2 = W / 2 - 0.03, H / 2 - 0.03
    q = [fv.v(V((0, yb - 0.006, zc)) + rot @ V((x, 0, z)), (1, 1, 1)) for x, z in ((-w2, -h2), (w2, -h2), (w2, h2), (-w2, h2))]
    fv.f(q, [(0, 0), (1, 0), (1, 1), (0, 1)])
    fo = fv.obj("board_face", [face_m], light=0)
    root = bpy.data.objects.new("photo_board", None)
    bpy.context.collection.objects.link(root)
    body.parent = root
    fo.parent = root
    P.export("p5_photo_board", [root])


# =============================================================================== class expedition flag post
def make_flag():
    C.reset()
    wood = P.mat("fl_wood", tex="p_timber.jpg", normal="p_timber_n.jpg", tint=(0.92, 0.78, 0.6), rough=0.75)
    brass = P.mat("fl_brass", tex="brass.jpg", rough=0.35, metal=0.85)
    stone = P.mat("fl_stone", tex="mossrock.jpg", normal="mossrock_n.jpg", rough=0.9)
    rope = P.mat("fl_rope", tex="canvas.jpg", tint=(0.86, 0.74, 0.52), rough=0.95)
    cloth = C.material("flag_cloth", tex="p_flag.jpg", rough=0.9, double=True)
    PH, FW, FH = 3.0, 1.2, 0.9
    objs = []
    st = C.box_obj("base", (0.7, 0.7, 0.32), (0, 0, 0.16), stone, bevel=0.07, segments=2, uv_scale=1.0, noise_amp=0.02, seed=3)
    P.paint(st, lambda p, n: (0.92, 0.9, 0.86), ao=(0, 0.3))
    objs.append(st)
    vb = VB()
    vb.tube([V((0, 0, 0.25)), V((0, 0, PH))], [0.065, 0.045], (0.95, 0.82, 0.62), sides=12)
    pole = vb.obj("pole", [wood])
    C.box_uv(pole, 1.0)
    objs.append(pole)
    vb = VB()
    vb.lathe([(0.0, 0.0), (0.06, 0.0), (0.07, 0.04), (0.04, 0.08), (0.09, 0.15), (0.06, 0.24), (0.0, 0.27)], (1, 1, 1), segs=14,
             loc=(0, 0, PH))
    vb.lathe([(0.0, 0.0), (0.075, 0.0), (0.075, 0.05), (0.0, 0.05)], (1, 1, 1), segs=14, loc=(0, 0, PH - FH - 0.15))
    for z in (PH - 0.08, PH - FH + 0.02):  # rings holding the flag
        vb.lathe([(0.0, 0.0), (0.06, 0.0), (0.06, 0.03), (0.0, 0.03)], (1, 1, 1), segs=12, loc=(0, 0, z), cap=True)
    objs.append(vb.obj("finial", [brass]))
    vb = VB()  # halyard rope tied off on a cleat
    vb.tube([V((0.05, -0.02, PH - 0.05)), V((0.055, -0.03, 1.2)), V((0.06, -0.06, 1.05))], 0.008, (1, 1, 1), sides=5)
    vb.box((0.03, 0.04, 0.12), (0.06, -0.05, 1.1), (1, 1, 1), bevel=0.008, segs=1)
    objs.append(vb.obj("halyard", [rope]))
    post = P.join(objs, "flag_post")
    # cloth: grid, u along the fly (0 at the hoist), v up; a resting ripple is baked in
    rig = R.Rig("flag_cloth")
    x0, zt = 0.05, PH - 0.06
    pts = [V((x0 + FW * i / 4, 0, zt - FH / 2)) for i in range(5)]
    rig.bone("flag_root", V((0, 0, zt - FH / 2)), V((x0, 0, zt - FH / 2)))
    names = rig.chain("flag", pts, "flag_root")
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    nx, nz = 18, 8
    grid = []
    for i in range(nx + 1):
        row = []
        for j in range(nz + 1):
            u, v = i / nx, j / nz
            y = 0.035 * math.sin(u * PI * 2.2) * u
            row.append(bm.verts.new((x0 + FW * u, y, zt - FH + FH * v - 0.03 * u * u)))
        grid.append(row)
    for i in range(nx):
        for j in range(nz):
            f = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
            for loop, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                loop[uvl].uv = (a / nx, b / nz)
    co = C.new_obj("flag_cloth_mesh", bm, [cloth])
    C.shade_smooth(co)
    P.paint(co, None, light=0.06)
    rig.add_chain(co, names)
    rig.build()

    def wave(t):
        p = {}
        for i, nm in enumerate(names):
            amp = 0.12 + 0.05 * i
            p[nm] = {"rot": [(Z, amp * S(t, 2, -0.18 * i) + 0.04 * S(t, 1, 0.3)), (X, 0.03 * S(t, 2, -0.2 * i))]}
        p["flag_root"] = {"rot": [(Z, 0.05 * S(t, 1))]}
        return p
    rig.clip("wave", 48, wave, step=1)
    post.parent = rig.rig
    rig.export(os.path.abspath(os.path.join(C.OUT, "p5_expedition_flag.glb")), extra=[post])


NAMES = {"robin": robin, "swallow": swallow, "cicada": cicada}
STATIC = {"leaves": make_leaves, "snow": make_snow, "blossoms": make_blossoms, "photo_board": make_photo_board, "flag": make_flag}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for n in (argv or list(NAMES) + list(STATIC)):
        if n in NAMES:
            C.reset()
            rig = NAMES[n]()
            rig.export(os.path.abspath(os.path.join(C.OUT, f"p5_{n}.glb")))
        else:
            STATIC[n]()
