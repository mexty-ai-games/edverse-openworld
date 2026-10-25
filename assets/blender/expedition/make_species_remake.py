"""Movement-ready remakes of the first Biome Frontier species (the originals were one static group each).

OW_TEX=<tex> OW_OUT=<glb> blender -b --factory-startup -P make_species_remake.py [-- name ...]
toucan, tree_frog, morpho, tortoise, horned_lizard, sea_turtle, clownfish, sea_star: same species and
palette as biome-frontier/make_species.py, re-sculpted with named bones and the clips idle / move / feed /
special (see SPECIES_CLIPS). Facing -Y in Blender (+Z in glTF), origin at the feet / under the animal.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import xrig as R  # noqa: E402
from make_species import painter  # noqa: E402
from xrig import C, Cs, S, X, Y, Z, blob, capsule, eyes, flat, mixc, smooth_pts, smoothstep, soft, tube  # noqa: E402

V = Vector
BLACK = (0.1, 0.1, 0.13)


def smile_pts(c, w, y, z, curve=0.025, n=7):
    return [c + V((math.sin(a) * w, y + abs(math.sin(a)) * w * 0.4, z + (1 - math.cos(a)) * curve)) for a in [-0.9 + i * (1.8 / (n - 1)) for i in range(n)]]


def flat_shape(name, center, outline, thick, mat, col, seg=28, ring=10, rot=None):
    """A thin rounded plate (wings, fins, flippers): outline(angle) -> (rx, ry) radius in the XY plane."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=1.0)
    for v in bm.verts:
        u = V(v.co)
        a = math.atan2(u.y, u.x)
        rx, ry = outline(a)
        p = V((u.x * rx, u.y * ry, u.z * thick))
        if rot is not None:
            p = rot @ p
        v.co = p + V(center)
    ob = C.new_obj(name, bm, [mat])
    C.box_uv(ob, 2.0)
    C.shade_smooth(ob)
    C.paint_vcol(ob, col)
    return ob


# =============================================================================== toucan
def toucan():
    rig = R.Rig("toucan")
    m = soft("toucan_feathers", rough=0.55)
    beak_m = soft("toucan_beak", rough=0.3)
    foot_m = soft("toucan_feet", rough=0.5)
    yellow, red = (1.0, 0.84, 0.25), (0.9, 0.2, 0.15)

    def body_c(p, n):
        if n.y < -0.25 and p.z > 0.36 and abs(p.x) < 0.13:
            return mixc(yellow, (1.0, 0.95, 0.75), smoothstep(0.42, 0.55, p.z) * 0.3)
        if p.z < 0.2 and n.y > 0.2:
            return red  # red under-tail
        return BLACK

    rig.bone("root", (0, 0, 0), (0, 0, 0.1))
    body = blob("toucan_body", (0, 0.02, 0.34), (0.15, 0.17, 0.22), m, seg=24, ring=16,
                fn=lambda u: V((0, 0.05 * u.z, 0)) + V((0, -0.03 * max(0, -u.y) * (u.z > -0.2), 0)), col=painter(BLACK, body_c))
    rig.bone("body", (0, 0.02, 0.18), (0, 0.0, 0.5), "root")
    rig.add(body, "body")
    HC = V((0, -0.05, 0.6))
    head = blob("toucan_head", HC, (0.12, 0.12, 0.12), m, seg=22, ring=14,
                col=painter(BLACK, lambda p, n: yellow if n.y < -0.15 and p.z < HC.z + 0.02 else None))

    def beak_c(p, n):
        t = (-(p.y - HC.y) - 0.1) / 0.3
        c = mixc((0.45, 0.78, 0.3), (1.0, 0.6, 0.12), t * 1.6)
        c = mixc(c, (0.92, 0.2, 0.12), (t - 0.75) * 4)
        if n.z < -0.6 and t < 0.6:
            c = mixc(c, (0.3, 0.55, 0.9), 0.6)
        return c

    beak = blob("toucan_beak", HC + V((0, -0.24, -0.01)), (0.065, 0.2, 0.08), beak_m, seg=20, ring=12,
                fn=lambda u: V((0, 0, -0.07 * max(0.0, -u.y) ** 2 + 0.01 * u.z * (u.y > 0))), col=painter((1, 0.6, 0.1), beak_c))
    ring_m = soft("toucan_eyering", rough=0.5)
    rings = [blob(f"toucan_ring{s}", HC + V((s * 0.09, -0.06, 0.03)), (0.03, 0.04, 0.045), ring_m, seg=12, ring=8,
                  col=painter((0.55, 0.85, 0.55))) for s in (-1, 1)]
    ey = eyes("toucan", [HC + V((s * 0.1, -0.07, 0.035)) for s in (-1, 1)], 0.027, look=V((0, -0.8, 0)))
    smile = tube("toucan_smile", smile_pts(HC, 0.05, -0.115, -0.04, 0.012), [0.004] * 7, flat("toucan_mouth", (0.15, 0.1, 0.1)), sides=4)
    rig.bone("head", (0, -0.02, 0.5), HC + V((0, 0, 0.12)), "body")
    rig.add([head, beak, smile] + rings + ey, "head")
    # wings folded along the sides
    for sd, s in (("L", 1), ("R", -1)):
        rot = Matrix.Rotation(s * 0.12, 3, "Y") @ Matrix.Rotation(-0.35, 3, "X")
        w = flat_shape(f"toucan_wing{sd}", (s * 0.145, 0.07, 0.33), lambda a: (0.15 + 0.05 * max(0, -math.sin(a)), 0.1), 0.03, m,
                       painter(BLACK, lambda p, n: (0.16, 0.16, 0.2)), rot=Matrix.Rotation(math.pi / 2, 3, "Y") @ Matrix.Identity(3))
        # re-shape: flat_shape lies in XY; rotate the plate upright (YZ plane), pointing down-back
        w.data.transform(Matrix.Translation(V((s * 0.145, 0.07, 0.33))) @ rot.to_4x4() @ Matrix.Translation(-V((s * 0.145, 0.07, 0.33))))
        rig.bone(f"wing.{sd}", (s * 0.13, -0.04, 0.47), (s * 0.15, 0.15, 0.18), "body")
        rig.add(w, f"wing.{sd}")
        # legs + zygodactyl toes
        hip, foot = V((s * 0.06, -0.01, 0.16)), V((s * 0.065, -0.02, 0.025))
        leg = tube(f"toucan_leg{sd}", [hip, foot], [0.022, 0.018], foot_m, sides=8, col=painter((0.35, 0.55, 0.9)))
        toes = [tube(f"toucan_toe{sd}{k}", [foot, foot + V((dx, dy, -0.015))], [0.012, 0.007], foot_m, sides=6, col=painter((0.35, 0.55, 0.9)))
                for k, (dx, dy) in enumerate(((0.02, -0.06), (-0.02, -0.06), (0.025, 0.045), (-0.02, 0.045)))]
        rig.bone(f"leg.{sd}", hip, foot, "body")
        rig.add([leg] + toes, f"leg.{sd}")
    tail = tube("toucan_tail", smooth_pts([(0, 0.13, 0.22), (0, 0.24, 0.1), (0, 0.33, -0.0)], 3), [0.07, 0.068, 0.06, 0.05, 0.04, 0.03, 0.012], m,
                sides=10, col=painter(BLACK))
    for v in tail.data.vertices:  # flatten into a broad tail
        v.co.x *= 1.0
    rig.bone("tail", (0, 0.12, 0.24), (0, 0.33, 0.0), "body")
    rig.add(tail, "tail")
    rig.build()

    def idle(t):
        return {"body": {"scale": 1 + 0.015 * S(t, 2)},
                "head": {"rot": [(Z, 0.35 * S(t, 1)), (Y, 0.12 * S(t, 1, 0.25))]},
                "tail": {"rot": [(X, -0.12 * max(0.0, S(t, 2)) ** 6)]}}

    rig.clip("idle", 96, idle)

    def hop(t):
        k = (t * 2) % 1.0
        h = max(0.0, math.sin(min(1.0, max(0.0, (k - 0.2) / 0.6)) * math.pi))
        crouch = max(0.0, 1 - abs(k - 0.12) / 0.12) + max(0.0, 1 - abs(k - 0.9) / 0.1)
        p = idle(t)
        p["root"] = {"loc": (0, 0, 0.1 * h - 0.025 * crouch)}
        p["body"]["rot"] = [(X, 0.15 * crouch - 0.08 * h)]
        for sd, s in (("L", 1), ("R", -1)):
            p[f"wing.{sd}"] = {"rot": [(Y, -s * 0.5 * h)]}
            p[f"leg.{sd}"] = {"rot": [(X, -0.4 * h)]}
        p["tail"] = {"rot": [(X, -0.25 * h)]}
        return p

    rig.clip("move", 36, hop, step=1)

    def peck(t):
        p = idle(t)
        e = smoothstep(0.0, 0.15, t) * (1 - smoothstep(0.85, 1.0, t))
        dip = max(0.0, S(t, 3)) ** 2 * e
        p["body"]["rot"] = [(X, 0.35 * e)]
        p["head"] = {"rot": [(X, 0.3 * e + 0.5 * dip)]}
        p["tail"] = {"rot": [(X, -0.3 * e)]}
        return p

    rig.clip("feed", 72, peck, step=1)

    def fly(t):
        p = {"root": {"loc": (0, 0, 0.3 + 0.04 * S(t, 2, 0.25))}, "body": {"rot": [(X, -0.25)]},
             "head": {"rot": [(X, 0.2)]}, "tail": {"rot": [(X, -0.35)]}}
        for sd, s in (("L", 1), ("R", -1)):
            flap = 1.2 + 0.75 * S(t, 2)
            p[f"wing.{sd}"] = {"rot": [(Y, -s * flap)]}
            p[f"leg.{sd}"] = {"rot": [(X, 1.1)]}
        return p

    rig.clip("special", 24, fly, step=1)
    return rig


# =============================================================================== tree frog
def tree_frog():
    rig = R.Rig("tree_frog")
    m = soft("frog_skin", rough=0.32)
    toe_m = soft("frog_toes", rough=0.45)
    green, cream, blue, orange = (0.36, 0.8, 0.26), (0.98, 0.95, 0.75), (0.2, 0.42, 0.92), (1.0, 0.55, 0.12)

    def skin(p, n):
        if n.z < -0.35:
            return cream
        if abs(n.x) > 0.72 and 0.05 < p.z < 0.15 and n.z < 0.3:
            bar = math.sin(p.y * 70) > 0.55
            return (0.98, 0.9, 0.4) if bar else blue
        return green

    rig.bone("root", (0, 0, 0), (0, 0, 0.1))
    body = blob("frog_body", (0, 0.03, 0.11), (0.14, 0.18, 0.1), m, seg=24, ring=14,
                fn=lambda u: V((0, 0, -0.025 * max(0.0, u.y) + 0.02 * max(0, -u.y) * (u.z > 0))), col=painter(green, skin))
    rig.bone("body", (0, 0.15, 0.1), (0, -0.08, 0.13), "root")
    rig.add(body, "body")
    HC = V((0, -0.12, 0.155))
    head = blob("frog_head", HC, (0.14, 0.11, 0.085), m, seg=22, ring=12, fn=lambda u: V((0, -0.01 * u.z, 0)), col=painter(green, skin))
    throat = blob("frog_throat", HC + V((0, -0.03, -0.055)), (0.08, 0.07, 0.04), m, seg=14, ring=8, col=painter(cream))
    smile = tube("frog_smile", smile_pts(HC + V((0, 0, -0.02)), 0.1, -0.098, -0.0, 0.03, 9), [0.005] * 9, flat("frog_mouth", (0.15, 0.3, 0.12)), sides=4)
    tongue = blob("frog_tongue", HC + V((0, -0.02, -0.02)), (0.022, 0.07, 0.012), soft("frog_tongue"), seg=10, ring=6, col=painter((1.0, 0.45, 0.5)))
    ey = eyes("frog", [HC + V((s * 0.08, -0.03, 0.075)) for s in (-1, 1)], 0.052, look=V((0, -1, 0.25)), iris=(0.85, 0.12, 0.08))
    pupils = [blob(f"frog_slit{s}", HC + V((s * 0.08, -0.03, 0.075)) + (V((s * 0.28, -1, 0.25)).normalized() * 0.052 * 1.03), (0.008, 0.004, 0.02),
                   flat("frog_slit", (0.05, 0.03, 0.03)), seg=8, ring=5) for s in (-1, 1)]
    rig.bone("head", (0, -0.06, 0.15), HC + V((0, -0.1, 0)), "body")
    rig.bone("throat", HC + V((0, 0.02, -0.06)), HC + V((0, -0.06, -0.06)), "head")
    rig.bone("tongue", HC + V((0, 0.04, -0.02)), HC + V((0, -0.09, -0.02)), "head")
    rig.add([head, smile] + ey + pupils, "head")
    rig.add(throat, "throat")
    rig.add(tongue, "tongue")
    for sd, s in (("L", 1), ("R", -1)):
        hip, knee, ankle, toe = V((s * 0.1, 0.13, 0.08)), V((s * 0.22, 0.04, 0.07)), V((s * 0.15, 0.17, 0.03)), V((s * 0.19, -0.02, 0.012))
        thigh = tube(f"frog_thigh{sd}", smooth_pts([hip, knee], 2), [0.055, 0.045, 0.035], m, sides=12, col=painter(green, skin))
        shin = tube(f"frog_shin{sd}", smooth_pts([knee, ankle], 2), [0.035, 0.03, 0.022], m, sides=10, col=painter(green, skin))
        foot = tube(f"frog_foot{sd}", smooth_pts([ankle, (ankle + toe) / 2 + V((0, 0, 0.01)), toe], 2), [0.02, 0.016, 0.014, 0.012, 0.01], m, sides=8,
                    col=painter(green))
        pads = [blob(f"frog_pad{sd}{k}", toe + V((s * dx, dy, -0.002)), (0.02, 0.02, 0.009), toe_m, seg=10, ring=6, col=painter(orange))
                for k, (dx, dy) in enumerate(((0.03, -0.01), (0.0, -0.035), (-0.03, -0.015)))]
        rig.bone(f"thigh.{sd}", hip, knee, "body")
        rig.bone(f"shin.{sd}", knee, ankle, f"thigh.{sd}")
        rig.bone(f"foot.{sd}", ankle, toe, f"shin.{sd}")
        rig.add(thigh, f"thigh.{sd}")
        rig.add(shin, f"shin.{sd}")
        rig.add([foot] + pads, f"foot.{sd}")
        sh, hand = V((s * 0.09, -0.1, 0.09)), V((s * 0.15, -0.2, 0.015))
        arm = tube(f"frog_arm{sd}", smooth_pts([sh, sh + V((s * 0.05, -0.03, -0.02)), hand], 2), [0.03, 0.026, 0.022, 0.02, 0.016], m, sides=10,
                   col=painter(green, skin))
        hpads = [blob(f"frog_hpad{sd}{k}", hand + V((s * dx, dy, -0.002)), (0.017, 0.017, 0.008), toe_m, seg=10, ring=6, col=painter(orange))
                 for k, (dx, dy) in enumerate(((0.025, -0.01), (0.0, -0.03), (-0.022, -0.012)))]
        rig.bone(f"arm.{sd}", sh, hand, "body")
        rig.add([arm] + hpads, f"arm.{sd}")
    rig.build()

    def idle(t):
        return {"body": {"scale": 1 + 0.02 * S(t, 2)}, "throat": {"scale": 1 + 0.18 * max(0.0, S(t, 2))},
                "head": {"rot": [(Z, 0.12 * S(t, 1, 0.1))]}}

    rig.clip("idle", 72, idle)

    def hop(t):
        p = idle(t)
        h = max(0.0, math.sin(min(1.0, max(0.0, (t - 0.2) / 0.55)) * math.pi))
        crouch = max(0.0, 1 - abs(t - 0.15) / 0.15) + max(0.0, 1 - abs(t - 0.85) / 0.12) * 0.6
        ext = smoothstep(0.15, 0.3, t) * (1 - smoothstep(0.55, 0.75, t))
        p["root"] = {"loc": (0, -0.0, 0.2 * h - 0.02 * crouch)}
        p["body"]["rot"] = [(X, -0.35 * ext + 0.1 * crouch)]
        for sd, s in (("L", 1), ("R", -1)):
            p[f"thigh.{sd}"] = {"rot": [(Z, s * 0.9 * ext), (X, 0.6 * ext)]}
            p[f"shin.{sd}"] = {"rot": [(Z, -s * 1.2 * ext)]}
            p[f"foot.{sd}"] = {"rot": [(X, 0.5 * ext)]}
            p[f"arm.{sd}"] = {"rot": [(X, -0.5 * h)]}
        return p

    rig.clip("move", 30, hop, step=1)

    def snap(t):
        p = idle(t)
        e = max(0.0, 1 - abs(t - 0.45) / 0.18)
        p["tongue"] = {"scale": (1 + 0.8 * e, 1 + 2.6 * e, 1 + 0.3 * e), "loc": (0, -0.02 * e, -0.01 * e)}
        p["head"] = {"rot": [(X, -0.15 * e)]}
        p["body"]["rot"] = [(X, -0.06 * e)]
        return p

    rig.clip("feed", 40, snap, step=1)

    def call(t):
        p = idle(t)
        puff = max(0.0, S(t, 2, -0.25) * 0.5 + 0.5) ** 2 if t < 0.9 else 0.0
        p["throat"] = {"scale": 1 + 0.75 * puff}
        p["head"] = {"rot": [(X, -0.2 * puff)]}
        return p

    rig.clip("special", 48, call, step=1)
    return rig


# =============================================================================== blue morpho
def morpho():
    rig = R.Rig("morpho")
    wm = soft("morpho_wing", rough=0.5)
    body_m = soft("morpho_body", rough=0.5)

    def wing_col(center, span, fore):
        def f(p, n):
            q = p - center
            r = math.hypot(q.x / span[0], q.y / span[1])
            if n.z < -0.2:  # underside: warm brown with eyespots
                c = (0.45, 0.32, 0.2)
                for ex, ey in ((0.35, 0.1), (0.55, -0.25)) if fore else ((0.45, 0.2),):
                    d = math.hypot(q.x / span[0] * math.copysign(1, center.x) - ex, q.y / span[1] - ey)
                    if d < 0.09:
                        return (0.15, 0.1, 0.08)
                    if d < 0.15:
                        return (0.95, 0.75, 0.3)
                return c
            if r > 0.74:
                dots = (math.sin(math.atan2(q.y, q.x) * 9) > 0.7) and 0.84 < r < 0.95
                return (0.95, 0.95, 0.9) if dots else (0.06, 0.06, 0.1)
            return mixc((0.15, 0.62, 1.0), (0.03, 0.16, 0.62), smoothstep(0.05, 0.72, r))
        return f

    rig.bone("root", (0, 0, 0), (0, 0, 0.1))
    BZ = 0.3
    body = tube("morpho_body", smooth_pts([(0, 0.15, BZ - 0.01), (0, 0.04, BZ), (0, -0.07, BZ + 0.01)], 3), [0.012, 0.02, 0.025, 0.026, 0.024, 0.02, 0.018],
                body_m, sides=10, col=painter((0.2, 0.16, 0.12)))
    head = blob("morpho_head", (0, -0.1, BZ + 0.015), (0.03, 0.03, 0.03), body_m, seg=14, ring=10, col=painter((0.2, 0.16, 0.12)))
    ey = eyes("morpho", [(s * 0.02, -0.115, BZ + 0.03) for s in (-1, 1)], 0.014, iris=(0.05, 0.04, 0.04))
    ants = [tube(f"morpho_ant{s}", smooth_pts([(s * 0.01, -0.12, BZ + 0.04), (s * 0.05, -0.2, BZ + 0.1), (s * 0.075, -0.25, BZ + 0.12)], 3),
                 [0.004] * 6 + [0.009], body_m, sides=5, col=painter((0.15, 0.12, 0.1))) for s in (-1, 1)]
    rig.bone("body", (0, 0.15, BZ), (0, -0.1, BZ), "root")
    rig.add([body, head] + ey + ants, "body")
    for sd, s in (("L", 1), ("R", -1)):
        fc = V((s * 0.17, -0.04, BZ + 0.005))
        fore = flat_shape(f"morpho_fore{sd}", fc, lambda a: (0.16 * (1 + 0.15 * math.cos(a * 2)), 0.12 * (1 + 0.1 * math.sin(a))), 0.006, wm,
                          wing_col(fc, (0.16, 0.12), True), seg=32, ring=8)
        hc = V((s * 0.13, 0.1, BZ - 0.005))
        hind = flat_shape(f"morpho_hind{sd}", hc, lambda a: (0.12, 0.11 * (1 + 0.15 * max(0, math.sin(a)))), 0.006, wm,
                          wing_col(hc, (0.12, 0.11), False), seg=28, ring=8)
        for w in (fore, hind):  # gentle upward dihedral
            for v in w.data.vertices:
                v.co.z += abs(v.co.x) * 0.12
        rig.bone(f"wing.{sd}", (s * 0.02, 0.02, BZ), (s * 0.3, 0.0, BZ), "body")
        rig.add([fore, hind], f"wing.{sd}")
    rig.build()

    def wings(a, s):
        return {"rot": [(Y, -s * a)]}

    def idle(t):
        a = 0.2 + 0.9 * (0.5 - 0.5 * Cs(t))
        return {"wing.L": wings(a, 1), "wing.R": wings(a, -1), "body": {"rot": [(X, 0.03 * S(t))]}}

    rig.clip("idle", 72, idle)

    def flap(t):
        a = 0.35 + 0.95 * (0.5 - 0.5 * Cs(t, 3))
        return {"root": {"loc": (0, 0, 0.12 + 0.03 * S(t, 3, 0.25))}, "body": {"rot": [(X, -0.15)]}, "wing.L": wings(a, 1), "wing.R": wings(a, -1)}

    rig.clip("move", 36, flap, step=1)

    def sip(t):
        a = 1.45 + 0.05 * S(t, 4)
        return {"wing.L": wings(a, 1), "wing.R": wings(a, -1), "body": {"rot": [(X, 0.15 + 0.03 * S(t, 2))]}}

    rig.clip("feed", 48, sip)

    def glide(t):
        a = 0.1 + 0.5 * max(0.0, S(t, 2)) ** 3
        return {"root": {"loc": (0, 0, 0.15 + 0.04 * S(t))}, "body": {"rot": [(Y, 0.25 * S(t)), (X, -0.1)]}, "wing.L": wings(a, 1), "wing.R": wings(a, -1)}

    rig.clip("special", 72, glide)
    return rig


# =============================================================================== desert tortoise
def tortoise():
    rig = R.Rig("tortoise")
    shell_m = soft("tortoise_shell", tex="paint.jpg", rough=0.55)
    skin_m = soft("tortoise_skin", tex="scalesoft.jpg", rough=0.7)
    nail_m = flat("tortoise_nails", (0.25, 0.2, 0.15), 0.4)
    SC = V((0, 0.03, 0.17))
    centers = [V((0, 0, 1))] + [V((math.cos(a) * 0.62, math.sin(a) * 0.62, 0.78)).normalized() for a in [k * math.pi / 3 + 0.5 for k in range(6)]] + \
              [V((math.cos(a) * 0.95, math.sin(a) * 0.95, 0.3)).normalized() for a in [k * math.pi / 6 for k in range(12)]]

    def scute(u):
        ds = sorted((u - c).length for c in centers)
        return ds[0], ds[1] - ds[0]

    def shell_fn(u):
        if u.z < 0:
            return V((0, 0, 0))
        d0, edge = scute(u)
        bump = 0.018 * (1 - smoothstep(0.0, 0.35, d0)) - 0.012 * (1 - smoothstep(0.0, 0.06, edge))
        return u * bump

    def shell_col(p, n):
        u = (p - SC)
        u = V((u.x / 0.3, u.y / 0.36, u.z / 0.2)).normalized()
        if u.z < 0.0:
            return (0.75, 0.62, 0.4)
        d0, edge = scute(u)
        if edge < 0.05:
            return (0.32, 0.22, 0.14)
        return mixc((0.85, 0.66, 0.38), (0.5, 0.35, 0.2), smoothstep(0.05, 0.35, d0))

    rig.bone("root", (0, 0, 0), (0, 0, 0.1))
    shell = blob("tortoise_shell", SC, (0.3, 0.36, 0.2), shell_m, seg=36, ring=18,
                 fn=lambda u: shell_fn(u) + V((0, 0, -0.12 * (1 + u.z) * (u.z < 0))), col=painter((0.6, 0.45, 0.28), shell_col))
    rim = blob("tortoise_rim", SC + V((0, 0, -0.035)), (0.315, 0.375, 0.045), shell_m, seg=32, ring=7,
               fn=lambda u: V((0, 0.02 * u.y * (u.y > 0.5), 0)), col=painter((0.55, 0.4, 0.25), lambda p, n: (0.42, 0.3, 0.18) if n.z < 0.2 else None))
    plastron = blob("tortoise_plastron", SC + V((0, 0, -0.06)), (0.27, 0.33, 0.04), shell_m, seg=24, ring=8, col=painter((0.85, 0.75, 0.52)))
    rig.bone("shell", (0, 0.2, 0.17), (0, -0.2, 0.17), "root")
    rig.add([shell, rim, plastron], "shell")

    head_m = soft("tortoise_head", rough=0.6)
    sk = (0.62, 0.56, 0.42)
    skc = painter(sk, lambda p, n: (0.82, 0.76, 0.6) if n.z < -0.4 else None)
    nb, nt = V((0, -0.24, 0.14)), V((0, -0.38, 0.19))
    neck = tube("tortoise_neck", smooth_pts([nb, nt], 3), [0.07, 0.066, 0.062, 0.058], head_m, sides=14, col=skc)
    HC = V((0, -0.46, 0.21))
    head = blob("tortoise_head", HC, (0.085, 0.1, 0.075), head_m, seg=20, ring=12, fn=lambda u: V((0, -0.015 * max(0, -u.y) * u.z, 0)), col=skc)
    beak = tube("tortoise_smile", smile_pts(HC, 0.05, -0.085, -0.035, 0.018), [0.005] * 7, flat("tortoise_mouth", (0.25, 0.18, 0.12)), sides=4)
    ey = eyes("tortoise", [HC + V((s * 0.05, -0.068, 0.03)) for s in (-1, 1)], 0.024, iris=(0.15, 0.1, 0.05))
    rig.bone("neck", nb, nt, "shell")
    rig.bone("head", nt, HC + V((0, -0.1, 0)), "neck")
    rig.add_chain(neck, ["neck"])
    rig.add([head, beak] + ey, "head")
    tail = tube("tortoise_tail", [(0, 0.36, 0.1), (0, 0.42, 0.07), (0, 0.45, 0.05)], [0.03, 0.02, 0.006], skin_m, sides=8, col=skc)
    rig.add(tail, "shell")
    # sturdy columnar legs: scaly upper limb from under the shell, an elephant-like foot with toenails
    for sd, sx in (("L", 1), ("R", -1)):
        for fb, sy in (("F", -1), ("B", 1)):
            front = fb == "F"
            top = V((sx * 0.2, sy * 0.2, 0.15))
            knee = V((sx * 0.29, sy * 0.25, 0.1))
            foot = V((sx * 0.3, sy * 0.26, 0.0))
            r0 = 0.07 if front else 0.075
            upper = capsule(f"tortoise_upper{fb}{sd}", top, knee, r0 * 0.95, r0, skin_m, col=skc, bulge=0.1)
            lower = capsule(f"tortoise_lower{fb}{sd}", knee, foot + V((0, 0, 0.03)), r0, r0 * 1.08, skin_m, col=skc, squash=0.8 if front else 1.0)
            pad = blob(f"tortoise_foot{fb}{sd}", foot + V((0, -0.01 * (1 if front else 0), 0.018)), (r0 * 1.12, r0 * 1.15, 0.03), skin_m, seg=16, ring=8,
                       fn=lambda u: V((0, 0, 0)) if u.z > -0.2 else V((0, 0, (-0.2 - u.z) * 0.02)), col=skc)
            nails = []
            fwd = V((sx * 0.35, -1 if front else -0.6, 0)).normalized()
            side = fwd.cross(V((0, 0, 1)))
            for k in range(4 if front else 3):
                off = (k - (1.5 if front else 1.0)) * 0.026
                c = foot + fwd * (r0 * 1.0) + side * off + V((0, 0, 0.008))
                nails.append(blob(f"tortoise_nail{fb}{sd}{k}", c, (0.012, 0.012, 0.009), nail_m, seg=6, ring=4,
                                  fn=lambda u, fwd=fwd: fwd * 0.006 * max(0, u.dot(fwd))))
            u, l = f"leg{fb}.{sd}0", f"leg{fb}.{sd}1"
            rig.bone(u, top, knee, "shell")
            rig.bone(l, knee, foot, u)
            rig.add(upper, u)
            rig.add([lower, pad] + nails, l)
    rig.build()

    def idle(t):
        return {"neck": {"rot": [(X, -0.06 * S(t))], "scale": 1 + 0.04 * S(t)}, "head": {"rot": [(Z, 0.3 * S(t, 1, 0.15))]},
                "shell": {"scale": 1 + 0.008 * S(t, 2)}}

    rig.clip("idle", 120, idle)

    def walk(t):
        p = idle(t)
        p["shell"] = {"rot": [(Y, 0.035 * S(t)), (Z, 0.03 * S(t))], "loc": (0, 0, 0.012 * abs(S(t, 2)))}
        p["head"] = {"rot": [(Z, 0.08 * S(t)), (X, 0.05 * S(t, 2))]}
        for sd, sx in (("L", 1), ("R", -1)):
            for fb in ("F", "B"):
                ph = (0.0 if (sd == "L") == (fb == "F") else 0.5)
                k = (t + ph) % 1.0
                sw = S(k)
                lift = max(0.0, Cs(k))
                p[f"leg{fb}.{sd}0"] = {"rot": [(X, -0.32 * sw), (Y, -sx * 0.35 * lift)]}
                p[f"leg{fb}.{sd}1"] = {"rot": [(Y, sx * 0.25 * lift)]}
        return p

    rig.clip("move", 72, walk)

    def munch(t):
        p = idle(t)
        e = smoothstep(0.0, 0.2, t) * (1 - smoothstep(0.8, 1.0, t))
        p["neck"] = {"rot": [(X, 0.45 * e)], "scale": 1 + 0.1 * e}
        p["head"] = {"rot": [(X, 0.25 * e + 0.1 * S(t, 5) * e)]}
        return p

    rig.clip("feed", 96, munch)

    def hide(t):
        e = smoothstep(0.0, 0.25, t) * (1 - smoothstep(0.7, 0.95, t))
        p = {"neck": {"loc": (0, 0.17 * e, -0.03 * e), "scale": 1 - 0.3 * e}, "head": {"rot": [(X, -0.1 * e)]},
             "shell": {"loc": (0, 0, -0.04 * e)}}
        for sd, sx in (("L", 1), ("R", -1)):
            for fb, sy in (("F", -1), ("B", 1)):
                p[f"leg{fb}.{sd}0"] = {"rot": [(Y, -sx * 0.5 * e)], "loc": (-sx * 0.04 * e, 0, 0)}
        return p

    rig.clip("special", 96, hide)
    return rig


# =============================================================================== horned lizard
def horned_lizard():
    rig = R.Rig("horned_lizard")
    m = soft("lizard_skin", tex="scalesoft.jpg", rough=0.7)
    horn_m = soft("lizard_horns", rough=0.55)

    def col(p, n):
        if n.z < -0.35:
            return (0.93, 0.86, 0.7)
        b = 0.5 + C.fbm(p * 14, 2)
        c = mixc((0.82, 0.64, 0.42), (0.6, 0.43, 0.28), b)
        if n.z > 0.5 and math.sin(p.y * 32) > 0.75 and abs(p.x) > 0.03:
            c = (0.45, 0.3, 0.2)  # dark back blotches
        return c

    pc = painter((0.8, 0.62, 0.42), col)
    hc = painter((0.92, 0.8, 0.6))
    rig.bone("root", (0, 0, 0), (0, 0, 0.1))
    body = blob("lizard_body", (0, 0.03, 0.08), (0.15, 0.21, 0.065), m, seg=28, ring=14, fn=lambda u: V((0.02 * u.x * (u.z > 0) * 0, 0, 0.012 * (u.z > 0))), col=pc)
    rig.bone("body", (0, 0.2, 0.08), (0, -0.14, 0.08), "root")
    spikes = []
    for s in (-1, 1):
        for k in range(6):  # fringe scales along the flanks
            y = -0.13 + k * 0.055
            b = V((s * 0.145 * math.sqrt(max(0.05, 1 - ((y - 0.03) / 0.22) ** 2)), y, 0.075))
            spikes.append(tube(f"lizard_fringe{s}{k}", [b, b + V((s * 0.035, 0.005, 0.01))], [0.011, 0.002], horn_m, sides=5, col=hc))
    for k in range(10):  # back spines
        y = -0.12 + k * 0.03
        for s in (-1, 1):
            b = V((s * (0.035 + 0.02 * (k % 2)), y, 0.135 - abs(y - 0.03) * 0.15))
            spikes.append(tube(f"lizard_spine{s}{k}", [b, b + V((0, 0.005, 0.018))], [0.007, 0.001], horn_m, sides=4, col=hc))
    rig.add([body] + spikes, "body")
    HC = V((0, -0.21, 0.09))
    head = blob("lizard_head", HC, (0.085, 0.08, 0.05), m, seg=20, ring=12, fn=lambda u: V((0, 0, 0.01 * (u.z > 0))), col=pc)
    smile = tube("lizard_smile", smile_pts(HC, 0.04, -0.075, -0.02, 0.012), [0.004] * 7, flat("lizard_mouth", (0.35, 0.22, 0.15)), sides=4)
    ey = eyes("lizard", [HC + V((s * 0.05, -0.035, 0.03)) for s in (-1, 1)], 0.02, iris=(0.15, 0.1, 0.05))
    horns = [tube(f"lizard_horn{k}", [HC + V((x, 0.04, 0.03)), HC + V((x * 1.4, 0.1, 0.075))], [0.015, 0.002], horn_m, sides=6, col=hc)
             for k, x in enumerate((-0.06, -0.025, 0.025, 0.06))]
    rig.bone("head", (0, -0.13, 0.08), HC + V((0, -0.08, 0)), "body")
    rig.add([head, smile] + ey + horns, "head")
    tail = tube("lizard_tail", smooth_pts([(0, 0.2, 0.06), (0.02, 0.3, 0.04), (0.05, 0.4, 0.02)], 3), [0.045, 0.038, 0.03, 0.022, 0.015, 0.009, 0.004], m,
                sides=10, col=pc)
    tb = rig.chain("tail", [V((0, 0.19, 0.06)), V((0.02, 0.3, 0.04)), V((0.05, 0.41, 0.02))], "body")
    rig.add_chain(tail, tb)
    for sd, s in (("L", 1), ("R", -1)):
        for fb, y in (("F", -0.1), ("B", 0.13)):
            sh, el, ft = V((s * 0.1, y, 0.06)), V((s * 0.19, y + 0.01, 0.06)), V((s * 0.22, y - 0.03, 0.005))
            up = tube(f"lizard_up{fb}{sd}", [sh, el], [0.028, 0.022], m, sides=8, col=pc)
            lo = tube(f"lizard_lo{fb}{sd}", [el, ft], [0.02, 0.015], m, sides=8, col=pc)
            toes = [tube(f"lizard_toe{fb}{sd}{k}", [ft, ft + V((s * 0.02 * k, -0.03, -0.002))], [0.007, 0.003], m, sides=4, col=pc) for k in (-1, 0, 1)]
            rig.bone(f"leg{fb}.{sd}0", sh, el, "body")
            rig.bone(f"leg{fb}.{sd}1", el, ft, f"leg{fb}.{sd}0")
            rig.add(up, f"leg{fb}.{sd}0")
            rig.add([lo] + toes, f"leg{fb}.{sd}1")
    rig.build()

    def idle(t):
        return {"body": {"scale": 1 + 0.015 * S(t, 2)}, "head": {"rot": [(Z, 0.15 * S(t, 1, 0.2)), (Y, 0.1 * S(t, 1))]},
                "tail0": {"rot": [(Z, 0.08 * S(t))]}, "tail1": {"rot": [(Z, 0.12 * S(t, 1, -0.1))]}}

    rig.clip("idle", 96, idle)

    def scuttle(t):
        p = idle(t)
        p["body"] = {"rot": [(Z, 0.12 * S(t))], "loc": (0, 0, 0.006 * abs(S(t, 2)))}
        p["tail0"] = {"rot": [(Z, -0.25 * S(t))]}
        p["tail1"] = {"rot": [(Z, -0.25 * S(t, 1, -0.15))]}
        for sd, s in (("L", 1), ("R", -1)):
            for fb in ("F", "B"):
                ph = 0.0 if (sd == "L") == (fb == "F") else 0.5
                k = (t + ph) % 1.0
                p[f"leg{fb}.{sd}0"] = {"rot": [(Z, -s * 0.5 * S(k)), (Y, -s * 0.35 * max(0.0, Cs(k)))]}
        return p

    rig.clip("move", 16, scuttle, step=1)

    def lick(t):
        p = idle(t)
        e = smoothstep(0.0, 0.2, t) * (1 - smoothstep(0.75, 1.0, t))
        dart = max(0.0, S(t, 3)) ** 4 * e
        p["head"] = {"rot": [(X, 0.25 * e + 0.15 * dart)]}
        p["body"]["rot"] = [(X, 0.08 * e)]
        return p

    rig.clip("feed", 48, lick, step=1)

    def bask(t):
        e = smoothstep(0.0, 0.25, t) * (1 - smoothstep(0.8, 1.0, t))
        p = {"body": {"scale": (1 + 0.12 * e, 1, 1), "rot": [(Y, 0.12 * e)], "loc": (0, 0, -0.012 * e)},
             "head": {"rot": [(X, -0.3 * e)]}, "tail0": {"rot": [(Z, 0.15 * e)]}}
        for sd, s in (("L", 1), ("R", -1)):
            for fb in ("F", "B"):
                p[f"leg{fb}.{sd}0"] = {"rot": [(Y, s * 0.3 * e)]}
        return p

    rig.clip("special", 120, bask)
    return rig


# =============================================================================== sea turtle
def sea_turtle():
    rig = R.Rig("sea_turtle")
    shell_m = soft("turtle_shell", rough=0.7)
    m = soft("turtle_skin", tex="scalesoft.jpg", rough=0.55)
    SC = V((0, 0.03, 0.14))
    centers = [V((0, y, 1)).normalized() for y in (-0.55, 0.0, 0.55)] + \
              [V((s * 0.75, y, 0.8)).normalized() for s in (-1, 1) for y in (-0.45, 0.1, 0.6)]

    def shell_col(p, n):
        u = p - SC
        u = V((u.x / 0.34, u.y / 0.44, u.z / 0.14)).normalized()
        if u.z < 0.25:
            return (0.42, 0.3, 0.18)
        ds = sorted((u - c).length for c in centers)
        if ds[1] - ds[0] < 0.05:
            return (0.7, 0.55, 0.32)
        return mixc((0.56, 0.4, 0.22), (0.46, 0.32, 0.17), C.fbm(p * 5, 2) * 0.6 + 0.5)

    def shell_fn(u):
        if u.z < 0:
            return V((0, 0, -0.06 * (-u.z)))
        ds = sorted((u - c).length for c in centers)
        return u * (0.012 * (1 - smoothstep(0, 0.4, ds[0])))

    rig.bone("root", (0, 0, 0), (0, 0, 0.1))
    shell = blob("turtle_shell", SC, (0.34, 0.44, 0.14), shell_m, seg=36, ring=16,
                 fn=lambda u: shell_fn(u) + V((0, 0.08 * u.y * (u.y > 0), 0)), col=painter((0.5, 0.42, 0.22), shell_col))
    belly = blob("turtle_belly", SC + V((0, 0, -0.045)), (0.3, 0.4, 0.05), m, seg=24, ring=8, col=painter((0.95, 0.9, 0.68)))
    rig.bone("body", (0, 0.3, 0.13), (0, -0.3, 0.13), "root")
    rig.add([shell, belly], "body")
    skin = painter((0.45, 0.6, 0.38), lambda p, n: (0.92, 0.9, 0.7) if n.z < -0.3 else None)
    HC = V((0, -0.52, 0.13))
    neck = tube("turtle_neck", [V((0, -0.32, 0.12)), V((0, -0.44, 0.13))], [0.075, 0.07], m, sides=12, col=skin)
    head = blob("turtle_head", HC, (0.095, 0.12, 0.08), m, seg=20, ring=12, col=skin)
    smile = tube("turtle_smile", smile_pts(HC, 0.05, -0.105, -0.035, 0.016), [0.005] * 7, flat("turtle_mouth", (0.2, 0.25, 0.15)), sides=4)
    ey = eyes("turtle", [HC + V((s * 0.058, -0.07, 0.035)) for s in (-1, 1)], 0.025, iris=(0.12, 0.08, 0.05))
    rig.bone("head", (0, -0.34, 0.12), HC + V((0, -0.1, 0)), "body")
    rig.add([neck, head, smile] + ey, "head")
    for sd, s in (("L", 1), ("R", -1)):
        rot = Matrix.Rotation(-s * 0.45, 3, "Z")
        fc = V((s * 0.45, -0.22, 0.1))
        ff = flat_shape(f"turtle_ffl{sd}", fc, lambda a: (0.24 * (1 - 0.25 * math.cos(a) * s) , 0.075 * (1 + 0.3 * math.cos(a) * s)), 0.022, m, skin,
                        seg=24, ring=8, rot=rot)
        sh = V((s * 0.22, -0.2, 0.11))
        tip = fc + rot @ V((s * 0.24, 0, 0))
        rig.chain(f"flipF.{sd}", [sh, (sh + tip) / 2 + V((0, 0, 0)), tip], "body")
        rig.add_chain(ff, [f"flipF.{sd}0", f"flipF.{sd}1"])
        bc = V((s * 0.25, 0.45, 0.08))
        bf = flat_shape(f"turtle_fbl{sd}", bc, lambda a: (0.1, 0.075), 0.02, m, skin, seg=16, ring=6, rot=Matrix.Rotation(s * 0.5, 3, "Z"))
        rig.bone(f"flipB.{sd}", (s * 0.15, 0.35, 0.1), (s * 0.32, 0.52, 0.08), "body")
        rig.add(bf, f"flipB.{sd}")
    rig.build()

    def stroke(t, amp, sd, s, k=1):
        a = S(t, k)
        return {f"flipF.{sd}0": {"rot": [(Y, -s * 0.55 * a * amp), (Z, s * 0.25 * Cs(t, k) * amp)]},
                f"flipF.{sd}1": {"rot": [(Y, -s * 0.35 * S(t, k, -0.1) * amp)]},
                f"flipB.{sd}": {"rot": [(Z, -s * 0.2 * S(t, k, 0.3) * amp)]}}

    def idle(t):
        p = {"root": {"loc": (0, 0, 0.02 * S(t))}, "head": {"rot": [(Z, 0.2 * S(t, 1, 0.2))]}, "body": {"rot": [(X, 0.03 * S(t))]}}
        for sd, s in (("L", 1), ("R", -1)):
            p.update(stroke(t, 0.35, sd, s))
        return p

    rig.clip("idle", 96, idle)

    def swim(t):
        p = {"root": {"loc": (0, 0, 0.05 + 0.04 * Cs(t))}, "body": {"rot": [(X, -0.06 * S(t))]}, "head": {"rot": [(X, 0.06 * S(t, 1, 0.2))]}}
        for sd, s in (("L", 1), ("R", -1)):
            p.update(stroke(t, 1.0, sd, s))
        return p

    rig.clip("move", 48, swim)

    def nibble(t):
        p = idle(t)
        e = smoothstep(0.0, 0.2, t) * (1 - smoothstep(0.8, 1.0, t))
        p["head"] = {"rot": [(X, 0.35 * e + 0.12 * S(t, 5) * e)]}
        p["body"]["rot"] = [(X, 0.08 * e)]
        return p

    rig.clip("feed", 72, nibble)

    def roll(t):
        p = swim(t)
        p["body"]["rot"] = [(Y, 0.3 * S(t)), (X, -0.05)]
        p["head"] = {"rot": [(Z, -0.3 * S(t))]}
        return p

    rig.clip("special", 96, roll)
    return rig


# =============================================================================== clownfish
def clownfish():
    rig = R.Rig("clownfish")
    m = soft("clownfish_skin", rough=0.35)
    fin_m = soft("clownfish_fins", rough=0.4)
    orange, white = (1.0, 0.5, 0.1), (1.0, 1.0, 0.98)
    FZ = 0.2

    def bands(p, n):
        for b, w in ((-0.075, 0.022), (0.02, 0.026), (0.12, 0.016)):
            d = abs(p.y - b - 0.01 * (p.z - FZ) * 10)
            if d < w:
                return white
            if d < w + 0.009:
                return BLACK
        return orange

    rig.bone("root", (0, 0, 0), (0, 0, 0.1))
    # body built along its length (rings across the length keep the bands crisp)
    body = blob("clownfish_body", (0, 0, 0), (0.055, 0.085, 0.16), m, seg=28, ring=30,
                fn=lambda u: V((-u.x * 0.02 * max(0.0, -u.z), 0, 0)) + V((0, -0.025 * max(0.0, -u.z) ** 2 * u.y, 0)))
    body.data.transform(Matrix.Translation(V((0, 0, FZ))) @ Matrix.Rotation(math.pi / 2, 4, "X"))
    C.paint_vcol(body, painter(orange, bands))
    bb = rig.chain("body", [V((0, -0.14, FZ)), V((0, 0.0, FZ)), V((0, 0.13, FZ))], "root")
    rig.add_chain(body, bb)

    def fincol(base, edge_r):
        def f(p, n):
            return base
        return f

    edge = lambda c, k: painter(orange, lambda p, n: BLACK if k(p) else None)  # noqa: E731
    TC = V((0, 0.2, FZ))
    tailfin = flat_shape("clownfish_tail", TC, lambda a: (0.055 * (1 + 0.25 * math.cos(a) ** 2), 0.06), 0.008, fin_m,
                         edge(None, lambda p: (p - TC).length > 0.048 and p.y > 0.2), seg=24, ring=6,
                         rot=Matrix.Rotation(math.pi / 2, 3, "Y"))
    rig.bone("tail", (0, 0.13, FZ), (0, 0.26, FZ), bb[-1])
    rig.add(tailfin, "tail")
    dorsal = flat_shape("clownfish_dorsal", V((0, 0.03, FZ + 0.085)), lambda a: (0.035, 0.11), 0.007, fin_m,
                        edge(None, lambda p: p.z > FZ + 0.11), seg=20, ring=6, rot=Matrix.Rotation(math.pi / 2, 3, "Y"))
    for v in dorsal.data.vertices:  # notch between the spiny and soft dorsal
        v.co.z -= 0.012 * math.exp(-((v.co.y - 0.0) / 0.02) ** 2)
    anal = flat_shape("clownfish_anal", V((0, 0.07, FZ - 0.075)), lambda a: (0.03, 0.045), 0.007, fin_m,
                      edge(None, lambda p: p.z < FZ - 0.095), seg=16, ring=6, rot=Matrix.Rotation(math.pi / 2, 3, "Y"))
    rig.add_chain([dorsal, anal], bb)
    HC = V((0, -0.1, FZ + 0.01))
    ey = eyes("clownfish", [HC + V((s * 0.04, -0.01, 0.025)) for s in (-1, 1)], 0.022, look=V((0, -1, 0)), iris=(0.1, 0.06, 0.03))
    smile = tube("clownfish_smile", smile_pts(V((0, -0.155, FZ - 0.02)), 0.022, 0.0, 0.0, 0.01), [0.004] * 7, flat("clownfish_mouth", (0.4, 0.15, 0.08)),
                 sides=4)
    rig.add(ey + [smile], bb[0])
    for sd, s in (("L", 1), ("R", -1)):
        pc = V((s * 0.065, -0.05, FZ - 0.02))
        pec = flat_shape(f"clownfish_pec{sd}", pc, lambda a: (0.02, 0.035), 0.006, fin_m, edge(None, lambda p: abs(p.x) > 0.075 and p.y > -0.03),
                         seg=14, ring=6, rot=Matrix.Rotation(s * 0.5, 3, "Y") @ Matrix.Rotation(math.pi / 2, 3, "Y"))
        rig.bone(f"pec.{sd}", (s * 0.05, -0.07, FZ - 0.02), (s * 0.06, -0.02, FZ - 0.02), bb[0])
        rig.add(pec, f"pec.{sd}")
    rig.build()

    def wag(t, amp, k=1):
        return {bb[0]: {"rot": [(Z, 0.05 * amp * S(t, k))]}, bb[1]: {"rot": [(Z, -0.18 * amp * S(t, k, -0.12))]},
                "tail": {"rot": [(Z, -0.35 * amp * S(t, k, -0.25))]},
                "pec.L": {"rot": [(Z, 0.5 * S(t, 2 * k))]}, "pec.R": {"rot": [(Z, -0.5 * S(t, 2 * k, 0.5))]}}

    def idle(t):
        p = wag(t, 0.3)
        p["root"] = {"loc": (0, 0, 0.015 * S(t))}
        return p

    rig.clip("idle", 48, idle)

    def swim(t):
        p = wag(t, 1.0, 2)
        p["root"] = {"loc": (0, 0, 0.01 * S(t, 2))}
        return p

    rig.clip("move", 24, swim, step=1)

    def nibble(t):
        p = wag(t, 0.5, 2)
        dart = max(0.0, S(t, 2)) ** 3
        p["root"] = {"loc": (0, -0.04 * dart, 0)}
        p[bb[0]]["rot"].append((X, 0.15 * dart))
        return p

    rig.clip("feed", 36, nibble, step=1)

    def spin(t):
        p = wag(t, 0.7, 3)
        e = smoothstep(0.0, 1.0, t)
        p["root"] = {"rot": [(Z, e * math.pi * 2)], "loc": (0, 0, 0.04 * math.sin(t * math.pi))}
        return p

    rig.clip("special", 48, spin, step=1)
    return rig


# =============================================================================== sea star
def sea_star():
    rig = R.Rig("sea_star")
    m = soft("seastar_skin", rough=0.6)
    bump_m = soft("seastar_bumps", rough=0.6)
    base = (1.0, 0.42, 0.22)
    pc = painter(base, lambda p, n: mixc(base, (1.0, 0.65, 0.4), smoothstep(0.05, 0.3, math.hypot(p.x, p.y))) if n.z > -0.3 else (1.0, 0.8, 0.65))
    rig.bone("root", (0, 0, 0), (0, 0, 0.1))
    rig.bone("center", (0, 0, 0.02), (0, -0.05, 0.02), "root")
    core = blob("seastar_core", (0, 0, 0.045), (0.09, 0.09, 0.045), m, seg=20, ring=10, col=pc)
    rig.add(core, "center")
    bumps = []
    for k in range(5):
        a = -math.pi / 2 + k * 2 * math.pi / 5
        d = V((math.cos(a), math.sin(a), 0))
        pts = [d * 0.04 + V((0, 0, 0.045)), d * 0.13 + V((0, 0, 0.038)), d * 0.22 + V((0, 0, 0.03)), d * 0.3 + V((0, 0, 0.035))]
        sp = smooth_pts(pts, 4)
        n = len(sp)
        arm = tube(f"seastar_arm{k}", sp, [0.055 * (1 - 0.8 * i / (n - 1)) + 0.008 for i in range(n)], m, sides=12, col=pc)
        for v in arm.data.vertices:  # flatten underside
            if v.co.z < 0.01:
                v.co.z = 0.01 + (v.co.z - 0.01) * 0.3
        names = rig.chain(f"arm{k}.", pts, "center")
        rig.add_chain(arm, names)
        for j in range(6):
            q = d * (0.06 + j * 0.04) + V((0, 0, 0.07 - j * 0.0065))
            b = blob(f"seastar_bump{k}{j}", q, (0.011 - j * 0.0008,) * 3, bump_m, seg=8, ring=5, col=painter((1.0, 0.86, 0.7)))
            rig.add_chain(b, names)
    ey = eyes("seastar", [(s * 0.034, -0.03, 0.09) for s in (-1, 1)], 0.027, look=V((0, -0.7, 0.7)))
    rig.add(ey, "center")
    rig.build()

    def curl(t, amp, speed=1, wave=0.2):
        p = {}
        for k in range(5):
            a = -math.pi / 2 + k * 2 * math.pi / 5
            lift = (math.sin(a), -math.cos(a), 0)  # rotation axis that lifts this arm's tip
            for j in range(3):
                p[f"arm{k}.{j}"] = {"rot": [(lift, amp * (0.5 + 0.5 * S(t, speed, -k * wave - j * 0.08)) * (0.3 + 0.35 * j))]}
        return p

    rig.clip("idle", 120, lambda t: curl(t, 0.25))

    def crawl(t):
        p = curl(t, 0.6, 1, 0.2)
        p["center"] = {"loc": (0, -0.01 * S(t), 0.008 * abs(S(t)))}
        return p

    rig.clip("move", 96, crawl)

    def hug(t):
        e = smoothstep(0.0, 0.3, t) * (1 - smoothstep(0.7, 1.0, t))
        p = curl(t, 0.1)
        for k in range(5):
            a = -math.pi / 2 + k * 2 * math.pi / 5
            lift = (math.sin(a), -math.cos(a), 0)
            for j in range(3):
                p[f"arm{k}.{j}"]["rot"].append((lift, e * (0.35 + 0.2 * j)))
        p["center"] = {"loc": (0, 0, 0.03 * e)}
        return p

    rig.clip("feed", 96, hug)

    def wave(t):
        p = curl(t, 0.15)
        e = R.ease_in_out(t)
        k = 1  # the arm on the viewer's right waves
        a = -math.pi / 2 + k * 2 * math.pi / 5
        lift = (math.sin(a), -math.cos(a), 0)
        rad = (math.cos(a), math.sin(a), 0)
        p["arm1.0"] = {"rot": [(lift, 0.9 * e)]}
        p["arm1.1"] = {"rot": [(lift, 0.3 * e), ((0, 0, 1), 0.5 * S(t, 3) * e)]}
        p["arm1.2"] = {"rot": [(lift, -0.2 * e), ((0, 0, 1), 0.5 * S(t, 3, -0.1) * e)]}
        p["center"] = {"rot": [(Z, 0.08 * e)]}
        return p

    rig.clip("special", 96, wave)
    return rig


SPECIES = {"toucan": toucan, "tree_frog": tree_frog, "morpho": morpho, "tortoise": tortoise, "horned_lizard": horned_lizard,
           "sea_turtle": sea_turtle, "clownfish": clownfish, "sea_star": sea_star}

if __name__ == "__main__":
    which = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(SPECIES)
    for name in which:
        C.reset()
        rig = SPECIES[name]()
        rig.export(os.path.abspath(os.path.join(C.OUT, name + ".glb")))
