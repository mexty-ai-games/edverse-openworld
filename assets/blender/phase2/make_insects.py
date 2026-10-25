"""Phase 2 creatures for catch-and-release and the Bug Games: friendly, stylised, scientifically recognisable.

OW_TEX=<tex> OW_OUT=<glb> blender -b --factory-startup -P make_insects.py [-- name ...]

flea, dung_beetle (+ separate 'dung_ball' node on bone 'ball'), locust (desert locust), tiger_beetle (green tiger
beetle), firefly (material 'firefly_glow' = the lantern, pulse its emissive in code), leafcutter_ant (+ 'ant_leaf'
node on the head bone), stick_insect (+ stick_insect_camo.glb: same rig/clips, camouflage material), snail (garden
snail), honeybee, monarch_caterpillar.

Every creature: one skinned mesh + armature, clips idle / move / special (+ named aliases: flea & locust 'jump',
tiger_beetle 'run', firefly & honeybee 'fly', dung_beetle 'push'). Facing -Y in Blender (+Z in glTF), origin at the
feet, modelled at DISPLAY size (about 0.3 m long: real insects are 2 mm - 10 cm, the game scales them). Six legs,
three body parts and two antennae on every insect; < 6k triangles each.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import p2 as R  # noqa: E402
from p2 import C, S, X, Y, Z, blob, flat, mixc, shade, smooth_pts, smoothstep, soft, tube  # noqa: E402

V = Vector


def lin(c):
    """Colours are written as painted (sRGB); vertex colours are stored linear."""
    return tuple(max(0.0, x) ** 2.2 for x in c)


def painter(base, fn=None, amt=0.22):
    def f(p, n):
        c = fn(p, n) if fn else None
        return lin(shade(c if c is not None else base, n, amt))
    return f


def membrane(name, color=(0.9, 0.95, 1.0), alpha=0.45):
    m = C.material(name, color=color, rough=0.15)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Alpha"].default_value = alpha
    m.blend_method = "BLEND"
    try:
        m.surface_render_method = "BLENDED"
    except Exception:
        pass
    m.use_backface_culling = False
    return m


def bug_eyes(prefix, centers, r, color=(0.08, 0.06, 0.06), look=V((0, -1, 0)), ring=None):
    """Big glossy compound eyes (true to insects) with two soft catch-lights, so they read friendly and alive."""
    eye = C.material(prefix + "_eye", color=color, rough=0.12)
    shine = flat(prefix + "_shine", (1, 1, 1), 0.2, emissive=(1, 1, 1), emissive_strength=1.0)
    out = []
    for i, c in enumerate(centers):
        c = V(c)
        side = V((math.copysign(1, c.x), 0, 0))
        d = (look.normalized() * 0.7 + side * 0.55 + V((0, 0, 0.25))).normalized()
        out.append(blob(f"{prefix}_eye{i}", c, (r, r, r), eye, seg=14, ring=9))
        up = V((0, 0, 1))
        sx = d.cross(up).normalized()
        out.append(blob(f"{prefix}_sh{i}", c + d * r * 0.88 + up * r * 0.38, (r * 0.22, r * 0.22, r * 0.16), shine, seg=8, ring=5))
        out.append(blob(f"{prefix}_shb{i}", c + d * r * 0.96 - up * r * 0.18 + sx * r * 0.25 * side.x, (r * 0.09,) * 3, shine, seg=6, ring=4))
    return out


class Bug:
    """Insect rig scaffold: root > body (thorax) > head / abdomen / legs / antennae / wings."""

    def __init__(self, name):
        self.r = R.Rig(name)
        self.name = name
        self.legs = []          # (bone0, bone1, side, pair)
        self.extras = []        # loose nodes parented to bones (ball, leaf)
        self.r.bone("root", (0, 0, 0), (0, 0, 0.05))

    def leg(self, side, pair, root, knee, foot, rad, mat, col, sides=8, foot_r=None):
        s = 1 if side == "L" else -1
        root, knee, foot = V(root), V(knee), V(foot)
        root.x *= s
        knee.x *= s
        foot.x *= s
        pts = smooth_pts([root, knee, foot], 4)
        n = len(pts)
        radii = [rad * (1.0 - 0.45 * (i / (n - 1))) * (1.15 if 3 <= i <= 5 else 1.0) for i in range(n)]
        lg = tube(f"{self.name}_leg{side}{pair}", pts, radii, mat, sides=sides, col=col)
        kn = blob(f"{self.name}_knee{side}{pair}", knee, (rad * 1.05,) * 3, mat, seg=8, ring=6, col=col)
        ft = blob(f"{self.name}_foot{side}{pair}", foot + V((0, -0.004, 0.002)), (foot_r or rad * 0.75,) * 3, mat, seg=8, ring=5, col=col)
        names = self.r.chain(f"leg{side}{pair}", [root, knee, foot], "body")
        self.r.add_chain([lg], names)
        self.r.add(ft, names[-1])
        self.r.add(kn, names[0])
        self.legs.append((names[0], names[1], s, pair))

    def antenna(self, side, pts, rad, mat, col, tip=None, parent="head", sides=5):
        s = 1 if side == "L" else -1
        P = [V((p[0] * s, p[1], p[2])) for p in pts]
        sm = smooth_pts(P, 4)
        n = len(sm)
        radii = [rad * (1 - 0.5 * i / (n - 1)) for i in range(n)]
        an = tube(f"{self.name}_ant{side}", sm, radii, mat, sides=sides, col=col)
        mid = len(P) // 2
        names = self.r.chain(f"ant{side}", [P[0], P[mid], P[-1]], parent)
        self.r.add_chain([an], names)
        if tip:
            self.r.add(blob(f"{self.name}_anttip{side}", P[-1], (tip,) * 3, mat, seg=8, ring=5, col=col), names[-1])

    def build(self):
        rig, body = self.r.build()
        for ob, bone in self.extras:
            ob.parent = rig
            ob.parent_type = "BONE"
            ob.parent_bone = bone
            # keep world position: bone parenting offsets to the bone tail
            pb = rig.data.bones[bone]
            ob.matrix_parent_inverse = (rig.matrix_world @ pb.matrix_local @ __import__("mathutils").Matrix.Translation((0, pb.length, 0))).inverted()
        return rig, body

    def clip(self, name, frames, fn):
        self.r.clip(name, frames, fn)

    def export(self, path):
        return self.r.export(path, extra=[o for o, _ in self.extras])

    # ------------------------------------------------------------------ shared motion
    def gait(self, t, cycles=2, swing=0.35, lift=0.35, phase_off=0.0):
        """Alternating tripod: L0 R1 L2 together, then R0 L1 R2."""
        p = {}
        for b0, b1, s, pair in self.legs:
            grp = (pair + (0 if s > 0 else 1)) % 2
            k = (t * cycles + grp * 0.5 + phase_off) % 1.0
            sw = math.cos(k * math.pi * 2)            # +1 forward ... -1 back
            up = max(0.0, math.sin(k * math.pi * 2))   # lifted on the forward stroke
            p[b0] = {"rot": [(Z, -s * swing * sw), (Y, -s * lift * up)]}
            p[b1] = {"rot": [(Y, s * lift * 0.6 * up)]}
        return p

    def legs_pose(self, fn):
        p = {}
        for b0, b1, s, pair in self.legs:
            r0, r1 = fn(s, pair)
            p[b0] = {"rot": r0}
            p[b1] = {"rot": r1}
        return p


def merge(*ds):
    out = {}
    for d in ds:
        for k, v in d.items():
            if k in out:
                o = dict(out[k])
                o["rot"] = o.get("rot", []) + v.get("rot", [])
                for kk in ("loc", "scale"):
                    if kk in v:
                        o[kk] = v[kk]
                out[k] = o
            else:
                out[k] = v
    return out


def breathe(t, k=1):
    return {"abdomen": {"scale": (1 + 0.03 * S(t, k), 1.0, 1 + 0.03 * S(t, k))}}


def antennae(t, amp=0.25, k=2, ph=0.0):
    return {"antL0": {"rot": [(X, amp * S(t, k, ph)), (Z, amp * 0.5 * S(t, k, ph + 0.3))]},
            "antR0": {"rot": [(X, amp * S(t, k, ph + 0.4)), (Z, -amp * 0.5 * S(t, k, ph + 0.1))]},
            "antL1": {"rot": [(X, amp * 0.6 * S(t, k, ph + 0.2))]},
            "antR1": {"rot": [(X, amp * 0.6 * S(t, k, ph + 0.6))]}}


def hop(t, h):
    """0..1 -> vertical offset of a parabolic hop."""
    return 4 * h * t * (1 - t)


# =============================================================================== flea
def flea():
    b = Bug("flea")
    sh = soft("flea_shell", tex="chitin.jpg", rough=0.32)
    brown, dark, gold = (0.56, 0.28, 0.14), (0.36, 0.17, 0.08), (0.76, 0.46, 0.24)

    def segs(p, n):
        band = (p.y * 70) % 1.0                         # segment plates along the body
        c = mixc(gold, brown, smoothstep(0.1, 0.5, n.z * 0.5 + 0.5))
        return mixc(c, dark, 0.45 if band < 0.16 else 0.0)

    BZ = 0.115
    # laterally flattened, tall oval body: the shape that slips between hairs
    bodyo = blob("flea_body", (0, 0.02, BZ), (0.045, 0.115, 0.09), sh, seg=22, ring=14,
                 fn=lambda u: V((0, 0, 0.02 * u.y * (u.z > 0))), col=painter(brown, segs))
    b.r.bone("body", (0, -0.06, BZ), (0, 0.04, BZ), "root")
    b.r.add(bodyo, "body")
    ab = blob("flea_abdomen", (0, 0.1, BZ + 0.015), (0.042, 0.075, 0.08), sh, seg=20, ring=12, col=painter(brown, segs))
    b.r.bone("abdomen", (0, 0.05, BZ), (0, 0.16, BZ + 0.02), "body")
    b.r.add(ab, "abdomen")
    HC = V((0, -0.105, BZ - 0.005))
    head = blob("flea_head", HC, (0.042, 0.05, 0.05), sh, seg=18, ring=12, fn=lambda u: V((0, -0.01 * max(0, -u.y), -0.012 * max(0, -u.y))),
                col=painter(gold, lambda p, n: mixc(gold, brown, 0.3)))
    ey = bug_eyes("flea", [HC + V((s * 0.03, -0.022, 0.012)) for s in (-1, 1)], 0.017, color=(0.18, 0.06, 0.04))
    mouth = tube("flea_mouth", [HC + V((0, -0.045, -0.02)), HC + V((0, -0.05, -0.05))], [0.006, 0.004], sh, sides=5, col=painter(dark))
    b.r.bone("head", (0, -0.07, BZ), HC + V((0, -0.05, 0)), "body")
    b.r.add([head, mouth] + ey, "head")
    for sd in ("L", "R"):
        b.antenna(sd, [HC + V((0.025, 0.0, 0.03)), HC + V((0.035, 0.012, 0.045)), HC + V((0.04, 0.025, 0.05))], 0.006, sh,
                  painter(gold), tip=0.009)
        # front, middle legs short; hind legs long, thick femur (the jumper)
        b.leg(sd, 0, (0.025, -0.075, 0.06), (0.06, -0.1, 0.07), (0.07, -0.135, 0.008), 0.013, sh, painter(gold))
        b.leg(sd, 1, (0.03, -0.01, 0.05), (0.075, -0.02, 0.075), (0.09, -0.02, 0.008), 0.014, sh, painter(gold))
        b.leg(sd, 2, (0.03, 0.07, 0.06), (0.075, 0.15, 0.11), (0.08, 0.1, 0.008), 0.024, sh, painter(gold))
    b.build()

    def idle(t):
        return merge(breathe(t, 2), antennae(t, 0.2, 2),
                     {"head": {"rot": [(Z, 0.12 * S(t, 1, 0.1))]}, "body": {"rot": [(X, 0.02 * S(t, 2))]}})

    def move(t):  # three small hops
        k = (t * 3) % 1.0
        z = hop(k, 0.06)
        crouch = 0.15 * math.cos(k * math.pi * 2) * 0.5 + 0.08
        p = merge(antennae(t, 0.3, 3), b.legs_pose(lambda s, pr: ([(X, (0.6 * math.sin(k * math.pi)) if pr == 2 else 0.2 * math.sin(k * math.pi))],
                                                              [(X, -0.7 * math.sin(k * math.pi) if pr == 2 else 0)])))
        p["root"] = {"loc": (0, 0, z)}
        p["body"] = {"rot": [(X, -0.15 * math.sin(k * math.pi) + crouch * 0.1)]}
        return p

    def jump(t):  # crouch ... spring very high ... land (the long-jump champion)
        p = merge(antennae(t, 0.2, 1))
        if t < 0.3:
            c = smoothstep(0, 0.3, t)
            p["root"] = {"loc": (0, 0, -0.03 * c)}
            p.update(merge(p, b.legs_pose(lambda s, pr: ([(X, -0.35 * c)] if pr == 2 else [], [(X, 0.6 * c)] if pr == 2 else []))))
            p["body"] = {"rot": [(X, 0.12 * c)]}
        elif t < 0.85:
            k = (t - 0.3) / 0.55
            p["root"] = {"loc": (0, 0, hop(k, 0.55))}
            p["body"] = {"rot": [(X, -0.5 * math.sin(k * math.pi)), (Y, 0.0)]}
            p.update(merge(p, b.legs_pose(lambda s, pr: ([(X, 0.9 * math.sin(k * math.pi))] if pr == 2 else [(X, -0.5 * math.sin(k * math.pi))],
                                                       [(X, -0.8 * math.sin(k * math.pi))] if pr == 2 else []))))
        else:
            k = (t - 0.85) / 0.15
            p["root"] = {"loc": (0, 0, -0.025 * math.sin(k * math.pi))}
        return p

    b.clip("idle", 96, idle)
    b.clip("move", 72, move)
    b.clip("special", 60, jump)
    b.clip("jump", 60, jump)
    return b


# =============================================================================== dung beetle
def dung_beetle():
    b = Bug("dung_beetle")
    sh = soft("dung_beetle_shell", tex="chitin.jpg", rough=0.28)
    leg_m = soft("dung_beetle_leg", tex="chitin.jpg", rough=0.4)
    black, bronze, blue = (0.12, 0.1, 0.09), (0.32, 0.24, 0.14), (0.16, 0.18, 0.26)

    def shellc(p, n):
        rim = smoothstep(0.55, 0.95, abs(n.z))
        return mixc(blue, bronze, 0.4 * (1 - rim) + 0.15 * (p.x > 0))

    BZ = 0.08
    # rounded, domed elytra with a fine seam and grooves
    ely = blob("dung_beetle_elytra", (0, 0.04, BZ + 0.02), (0.09, 0.1, 0.07), sh, seg=26, ring=14,
               fn=lambda u: V((0, 0, -0.012 * abs(math.sin(u.x * 9)) * max(0, u.z) - 0.025 * (u.z < -0.2))),
               col=painter(black, lambda p, n: mixc(black, (0.04, 0.03, 0.03), 1.0) if abs(p.x) < 0.004 else shellc(p, n)))
    pron = blob("dung_beetle_pronotum", (0, -0.065, BZ + 0.02), (0.085, 0.05, 0.055), sh, seg=22, ring=12, col=painter(black, shellc))
    b.r.bone("body", (0, -0.08, BZ), (0, 0.02, BZ), "root")
    b.r.add(pron, "body")
    b.r.bone("abdomen", (0, 0.0, BZ), (0, 0.12, BZ), "body")
    b.r.add(ely, "abdomen")
    # broad shovel head (clypeus) with a scalloped rim: what it shapes the ball with
    HC = V((0, -0.125, BZ - 0.005))
    head = blob("dung_beetle_head", HC, (0.065, 0.04, 0.025), sh, seg=22, ring=10,
                fn=lambda u: V((0, -0.006 * math.cos(u.x * 10) * max(0, -u.y), 0.01 * max(0, -u.y) * u.y)), col=painter(black, shellc))
    ey = bug_eyes("dung_beetle", [HC + V((s * 0.055, 0.0, 0.015)) for s in (-1, 1)], 0.016, color=(0.1, 0.07, 0.05))
    b.r.bone("head", (0, -0.1, BZ), HC + V((0, -0.05, 0)), "body")
    b.r.add([head] + ey, "head")
    lc = painter((0.15, 0.12, 0.1))
    for sd in ("L", "R"):
        b.antenna(sd, [HC + V((0.03, -0.02, 0.0)), HC + V((0.05, -0.04, 0.01)), HC + V((0.06, -0.055, 0.02))], 0.005, leg_m,
                  painter((0.45, 0.32, 0.18)), tip=0.012)
        # broad toothed front legs for digging, long curved hind legs for holding the ball
        b.leg(sd, 0, (0.05, -0.08, 0.06), (0.11, -0.12, 0.08), (0.12, -0.17, 0.008), 0.018, leg_m, lc)
        b.leg(sd, 1, (0.06, 0.0, 0.05), (0.13, 0.0, 0.09), (0.16, 0.03, 0.008), 0.016, leg_m, lc)
        b.leg(sd, 2, (0.05, 0.07, 0.05), (0.12, 0.13, 0.09), (0.11, 0.2, 0.008), 0.016, leg_m, lc)
    # the dung ball: a clean, round, earthy ball (separate node 'dung_ball' on bone 'ball')
    ball_m = soft("dung_ball", tex="rock.jpg", rough=0.95)
    BC = V((0, 0.31, 0.11))
    ball = blob("dung_ball", BC, (0.11, 0.11, 0.11), ball_m, seg=24, ring=14, noise=0.006, nscale=14,
                col=painter((0.55, 0.38, 0.24), lambda p, n: (0.62, 0.45, 0.3) if C.fbm(p * 30, 2) > 0.15 else None))
    b.r.bone("ball", BC - V((0, 0, 0.11)), BC, "root")
    b.extras.append((ball, "ball"))
    b.build()

    def idle(t):
        return merge(breathe(t, 2), antennae(t, 0.2, 2), {"head": {"rot": [(Z, 0.1 * S(t))]}})

    def move(t):
        p = merge(b.gait(t, 2), antennae(t, 0.25, 4))
        p["body"] = {"rot": [(Y, 0.04 * S(t, 4))], "loc": (0, 0, 0.004 * abs(S(t, 4)))}
        return p

    def push(t):  # head down, hind legs up on the ball, ball rolls (the strongest insect for its size)
        p = merge(b.gait(t, 2, swing=0.22, lift=0.25))
        lean = 0.3
        p["body"] = {"rot": [(X, lean)], "loc": (0, 0, 0.0)}
        for s, sd in ((1, "L"), (-1, "R")):
            p[f"leg{sd}20"] = {"rot": [(X, -0.5 - 0.2 * S(t, 2, 0 if s > 0 else 0.5))]}
            p[f"leg{sd}21"] = {"rot": [(X, -0.3)]}
        p["ball"] = {"rot": [(X, t * math.pi * 2)]}
        p["head"] = {"rot": [(X, 0.15)]}
        return p

    b.clip("idle", 96, idle)
    b.clip("move", 48, move)
    b.clip("special", 96, push)
    b.clip("push", 96, push)
    return b


# =============================================================================== desert locust
def locust():
    b = Bug("locust")
    sh = soft("locust_body", tex="paint.jpg", rough=0.45)
    wing = soft("locust_wing", tex="paint.jpg", rough=0.5)
    yel, ochre, brown = (0.95, 0.8, 0.28), (0.82, 0.6, 0.2), (0.45, 0.3, 0.16)

    BZ = 0.075
    th = blob("locust_thorax", (0, -0.06, BZ + 0.01), (0.04, 0.06, 0.045), sh, seg=20, ring=12,
              fn=lambda u: V((0, 0, 0.012 * max(0, u.z))), col=painter(yel, lambda p, n: ochre if n.z > 0.6 else None))
    b.r.bone("body", (0, -0.1, BZ), (0, -0.02, BZ), "root")
    b.r.add(th, "body")
    abp = smooth_pts([(0, -0.02, BZ), (0, 0.08, BZ + 0.005), (0, 0.17, BZ + 0.0), (0, 0.22, BZ - 0.005)], 4)
    abr = [0.035, 0.036, 0.035, 0.032, 0.03, 0.028, 0.025, 0.022, 0.018, 0.014, 0.008, 0.004, 0.002]
    ab = tube("locust_abdomen", abp, abr[:len(abp)], sh, sides=12,
              col=painter(yel, lambda p, n: mixc(yel, ochre, 0.6) if (p.y * 55) % 1.0 < 0.2 else None))
    b.r.chain("abdomen", [V((0, -0.02, BZ)), V((0, 0.1, BZ)), V((0, 0.22, BZ))], "body")
    b.r.add_chain([ab], ["abdomen0", "abdomen1"])
    HC = V((0, -0.13, BZ + 0.02))
    head = blob("locust_head", HC, (0.033, 0.035, 0.05), sh, seg=18, ring=12,
                fn=lambda u: V((0, -0.008 * max(0, -u.z), 0)), col=painter(yel))
    ey = bug_eyes("locust", [HC + V((s * 0.028, -0.008, 0.02)) for s in (-1, 1)], 0.017, color=(0.3, 0.18, 0.08))
    b.r.bone("head", (0, -0.1, BZ), HC + V((0, -0.05, 0)), "body")
    b.r.add([head] + ey, "head")
    # folded forewings with brown spots (wing bones open them in the jump/fly)
    for s, sd in ((1, "L"), (-1, "R")):
        wpts = [V((s * 0.02, -0.06, BZ + 0.045)), V((s * 0.03, 0.27, BZ + 0.03))]
        w = blob(f"locust_wing{sd}", (wpts[0] + wpts[1]) / 2, (0.025, 0.17, 0.008), wing, seg=16, ring=8,
                 fn=lambda u: V((0, 0, 0.008 * (1 - u.x * u.x))),
                 col=painter((0.86, 0.74, 0.42), lambda p, n: brown if C.fbm(p * 60, 2) > 0.18 else None))
        b.r.bone(f"wing{sd}", wpts[0], wpts[1], "body")
        b.r.add(w, f"wing{sd}")
    lc = painter(yel, lambda p, n: ochre if n.z < 0 else None)
    for sd in ("L", "R"):
        b.antenna(sd, [HC + V((0.012, -0.03, 0.04)), HC + V((0.035, -0.07, 0.08)), HC + V((0.05, -0.09, 0.11))], 0.005, sh, painter(ochre))
        b.leg(sd, 0, (0.025, -0.07, 0.05), (0.06, -0.1, 0.075), (0.07, -0.13, 0.008), 0.009, sh, lc)
        b.leg(sd, 1, (0.03, -0.035, 0.045), (0.075, -0.03, 0.075), (0.09, -0.02, 0.008), 0.009, sh, lc)
        # big jumping hind legs: chunky femur up high, long tibia folded under (with tiny pink-red spines)
        b.leg(sd, 2, (0.035, 0.0, 0.06), (0.065, 0.15, 0.135), (0.06, 0.2, 0.008), 0.02, sh,
              painter(yel, lambda p, n: (0.85, 0.42, 0.32) if p.z < 0.12 and p.y > 0.155 else (mixc(yel, brown, 0.3) if n.z > 0.5 and p.z > BZ else None)))
    b.build()

    def idle(t):
        return merge(breathe(t, 2), antennae(t, 0.2, 2), {"head": {"rot": [(Z, 0.15 * S(t, 1, 0.2))]},
                                                           "body": {"rot": [(X, 0.02 * S(t, 2))]}})

    def move(t):
        p = merge(b.gait(t, 2, swing=0.3, lift=0.3), antennae(t, 0.2, 4))
        p["legL2"] = {"rot": [(X, 0.05 * S(t, 2))]}
        p["legR2"] = {"rot": [(X, 0.05 * S(t, 2, 0.5))]}
        p["legL21"] = {"rot": []}
        p["body"] = {"loc": (0, 0, 0.003 * abs(S(t, 4)))}
        return p

    def jump(t):
        p = merge(antennae(t, 0.15, 1))
        if t < 0.25:
            c = smoothstep(0, 0.25, t)
            p["root"] = {"loc": (0, 0, -0.02 * c)}
            p["body"] = {"rot": [(X, 0.1 * c)]}
        elif t < 0.85:
            k = (t - 0.25) / 0.6
            e = math.sin(k * math.pi)
            p["root"] = {"loc": (0, 0, hop(k, 0.35))}
            p["body"] = {"rot": [(X, -0.35 * e)]}
            for s, sd in ((1, "L"), (-1, "R")):
                p[f"leg{sd}20"] = {"rot": [(X, 0.7 * e)]}
                p[f"leg{sd}21"] = {"rot": [(X, -1.2 * e)]}
                p[f"wing{sd}"] = {"rot": [(Z, -s * 0.5 * e), (Y, -s * 0.5 * e * (0.6 + 0.4 * S(k, 6)))]}
        else:
            k = (t - 0.85) / 0.15
            p["root"] = {"loc": (0, 0, -0.015 * math.sin(k * math.pi))}
        return p

    b.clip("idle", 96, idle)
    b.clip("move", 48, move)
    b.clip("special", 60, jump)
    b.clip("jump", 60, jump)
    return b


# =============================================================================== tiger beetle
def tiger_beetle():
    b = Bug("tiger_beetle")
    sh = soft("tiger_beetle_shell", tex="chitin.jpg", rough=0.22)
    sh.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.45
    leg_m = soft("tiger_beetle_leg", tex="paint.jpg", rough=0.35)
    green, teal, cream, copper = (0.2, 0.62, 0.32), (0.12, 0.45, 0.4), (0.98, 0.92, 0.72), (0.72, 0.42, 0.22)
    spots = [V((s * 0.035, y, 0)) for s in (-1, 1) for y in (-0.005, 0.07, 0.12)]

    def ely(p, n):
        for sp in spots:
            if (V((p.x, p.y, 0)) - sp).length < 0.013:
                return cream
        if abs(p.x) < 0.003:
            return (0.08, 0.3, 0.18)
        return mixc(green, teal, smoothstep(0.2, 0.9, abs(n.x)))

    BZ = 0.065
    el = blob("tiger_beetle_elytra", (0, 0.06, BZ + 0.01), (0.055, 0.1, 0.04), sh, seg=24, ring=12,
              fn=lambda u: V((0, 0, -0.02 * (u.z < -0.2))), col=painter(green, ely))
    pr = blob("tiger_beetle_pronotum", (0, -0.06, BZ + 0.015), (0.035, 0.035, 0.03), sh, seg=18, ring=10,
              col=painter(green, lambda p, n: mixc(green, copper, 0.35 * (1 - n.z))))
    b.r.bone("body", (0, -0.09, BZ), (0, -0.02, BZ), "root")
    b.r.add(pr, "body")
    b.r.bone("abdomen", (0, -0.02, BZ), (0, 0.15, BZ), "body")
    b.r.add(el, "abdomen")
    HC = V((0, -0.115, BZ + 0.02))
    head = blob("tiger_beetle_head", HC, (0.042, 0.032, 0.028), sh, seg=20, ring=10, col=painter(green, lambda p, n: mixc(green, copper, 0.3)))
    ey = bug_eyes("tiger_beetle", [HC + V((s * 0.038, -0.005, 0.014)) for s in (-1, 1)], 0.021, color=(0.12, 0.1, 0.06))
    # small, rounded cream mandibles (characteristic, never sharp-looking)
    md = []
    for s in (-1, 1):
        md.append(tube(f"tiger_beetle_mand{s}", smooth_pts([HC + V((s * 0.016, -0.026, -0.01)), HC + V((s * 0.017, -0.04, -0.012)),
                                                            HC + V((s * 0.006, -0.047, -0.012))], 3), [0.007, 0.007, 0.006, 0.005, 0.0045, 0.004, 0.0035],
                       leg_m, sides=6, col=painter(cream)))
    b.r.bone("head", (0, -0.085, BZ), HC + V((0, -0.06, 0)), "body")
    b.r.add([head] + ey + md, "head")
    lc = painter((0.42, 0.36, 0.22), lambda p, n: mixc((0.42, 0.36, 0.22), (0.3, 0.55, 0.35), 0.4) if n.z > 0.3 else None)
    for sd in ("L", "R"):
        b.antenna(sd, [HC + V((0.03, -0.02, 0.02)), HC + V((0.06, -0.06, 0.06)), HC + V((0.08, -0.1, 0.07))], 0.004, leg_m, painter(copper))
        # long, slender running legs (fastest runner for its size)
        b.leg(sd, 0, (0.03, -0.07, 0.045), (0.075, -0.1, 0.075), (0.09, -0.145, 0.006), 0.01, leg_m, lc)
        b.leg(sd, 1, (0.035, -0.045, 0.045), (0.09, -0.035, 0.08), (0.115, -0.01, 0.006), 0.01, leg_m, lc)
        b.leg(sd, 2, (0.035, -0.02, 0.045), (0.09, 0.05, 0.08), (0.11, 0.13, 0.006), 0.01, leg_m, lc)
    b.build()

    def idle(t):
        return merge(breathe(t, 3), antennae(t, 0.25, 3), {"head": {"rot": [(Z, 0.2 * S(t, 1, 0.1))]}})

    def move(t):
        p = merge(b.gait(t, 3, swing=0.35, lift=0.3), antennae(t, 0.2, 6))
        p["body"] = {"loc": (0, 0, 0.004 * abs(S(t, 6)))}
        return p

    def run(t):  # sprint bursts: tiger beetles run so fast they stop to look again
        p = merge(b.gait(t, 6, swing=0.5, lift=0.4), antennae(t, 0.1, 6))
        p["body"] = {"rot": [(X, -0.08)], "loc": (0, 0, 0.012 + 0.006 * abs(S(t, 12)))}
        p["antL0"] = {"rot": [(X, -0.5)]}
        p["antR0"] = {"rot": [(X, -0.5)]}
        return p

    b.clip("idle", 72, idle)
    b.clip("move", 48, move)
    b.clip("special", 48, run)
    b.clip("run", 48, run)
    return b


# =============================================================================== firefly
def firefly():
    b = Bug("firefly")
    sh = soft("firefly_body", tex="paint.jpg", rough=0.4)
    glow = C.material("firefly_glow", color=(0.8, 1.0, 0.35), rough=0.3, emissive=(0.55, 1.0, 0.12), emissive_strength=2.5)
    hw = membrane("firefly_hindwing", (0.85, 0.85, 0.8), 0.4)
    dark, yel, pink, red = (0.18, 0.15, 0.13), (0.95, 0.82, 0.38), (0.96, 0.62, 0.55), (0.82, 0.3, 0.22)
    BZ = 0.055
    pr = blob("firefly_pronotum", (0, -0.06, BZ + 0.025), (0.045, 0.04, 0.02), sh, seg=20, ring=10,
              col=painter(pink, lambda p, n: (0.15, 0.12, 0.1) if abs(p.x) < 0.012 and n.z > 0.5 else (yel if abs(p.x) > 0.035 else None)))
    th = blob("firefly_thorax", (0, -0.045, BZ), (0.032, 0.04, 0.03), sh, seg=16, ring=10, col=painter(dark))
    b.r.bone("body", (0, -0.08, BZ), (0, -0.02, BZ), "root")
    b.r.add([pr, th], "body")
    ab = blob("firefly_abdomen", (0, 0.06, BZ - 0.005), (0.032, 0.085, 0.025), sh, seg=18, ring=10,
              col=painter(dark, lambda p, n: (0.6, 0.5, 0.42) if (p.y * 60) % 1.0 < 0.2 else None))
    lantern = blob("firefly_lantern", (0, 0.135, BZ - 0.004), (0.028, 0.04, 0.022), glow, seg=16, ring=8,
                   fn=lambda u: V((0, 0.012 * max(0.0, u.y) ** 2, 0)))
    b.r.bone("abdomen", (0, -0.02, BZ), (0, 0.15, BZ), "body")
    b.r.add([ab, lantern], "abdomen")
    HC = V((0, -0.098, BZ + 0.005))
    head = blob("firefly_head", HC, (0.022, 0.02, 0.02), sh, seg=14, ring=8, col=painter(dark))
    ey = bug_eyes("firefly", [HC + V((s * 0.02, -0.006, 0.006)) for s in (-1, 1)], 0.014, color=(0.12, 0.1, 0.1))
    b.r.bone("head", (0, -0.08, BZ), HC + V((0, -0.04, 0)), "body")
    b.r.add([head] + ey, "head")
    for s, sd in ((1, "L"), (-1, "R")):
        # elytra: soft black-brown with cream-yellow edges (Photinus colours)
        e0, e1 = V((s * 0.018, -0.035, BZ + 0.028)), V((s * 0.026, 0.13, BZ + 0.02))
        el = blob(f"firefly_elytron{sd}", (e0 + e1) / 2, (0.022, 0.09, 0.009), sh, seg=16, ring=8,
                  fn=lambda u: V((0, 0, 0.006 * (1 - u.x * u.x))),
                  col=painter(dark, lambda p, n, s=s: yel if abs(p.x) > 0.036 or abs(p.x) < 0.006 else None))
        h0, h1 = V((s * 0.015, -0.03, BZ + 0.02)), V((s * 0.02, 0.1, BZ + 0.018))
        hwo = blob(f"firefly_hw{sd}", (h0 + h1) / 2, (0.02, 0.07, 0.002), hw, seg=12, ring=6)
        b.r.bone(f"wing{sd}", e0, e1, "body")
        b.r.add(el, f"wing{sd}")
        b.r.bone(f"hwing{sd}", h0, h1, "body")
        b.r.add(hwo, f"hwing{sd}")
    lc = painter(dark)
    for sd in ("L", "R"):
        b.antenna(sd, [HC + V((0.01, -0.015, 0.015)), HC + V((0.04, -0.05, 0.04)), HC + V((0.06, -0.07, 0.06))], 0.004, sh, lc)
        b.leg(sd, 0, (0.022, -0.07, 0.04), (0.05, -0.09, 0.055), (0.06, -0.115, 0.006), 0.0075, sh, lc)
        b.leg(sd, 1, (0.025, -0.045, 0.035), (0.06, -0.04, 0.06), (0.075, -0.025, 0.006), 0.0075, sh, lc)
        b.leg(sd, 2, (0.024, -0.02, 0.035), (0.06, 0.02, 0.06), (0.07, 0.06, 0.006), 0.0075, sh, lc)
    b.build()

    def idle(t):
        return merge(breathe(t, 2), antennae(t, 0.2, 2), {"abdomen": {"rot": [(X, 0.08 * max(0, S(t, 2)))]}})

    def fly(t):  # elytra held open, hind wings beating, gentle bobbing hover 0.25 above ground
        p = merge(antennae(t, 0.15, 2))
        p["root"] = {"loc": (0, 0, 0.2 + 0.03 * S(t, 2))}
        p["body"] = {"rot": [(X, 0.35 + 0.04 * S(t, 2))]}
        for s, sd in ((1, "L"), (-1, "R")):
            p[f"wing{sd}"] = {"rot": [(Z, -s * 0.45), (Y, -s * 0.7)]}
            p[f"hwing{sd}"] = {"rot": [(Z, -s * 1.0), (Y, -s * (0.2 + 0.6 * S(t, 16)))]}
        p.update(merge(p, b.legs_pose(lambda s, pr: ([(Y, s * 0.4)], [(Y, -s * 0.5)]))))
        p["abdomen"] = {"rot": [(X, -0.15)]}
        return p

    def flash(t):  # perched, raises the glowing tail and flicks the wing covers (courtship flash)
        e = R.ease_in_out(t)
        p = merge(antennae(t, 0.3, 3))
        p["abdomen"] = {"rot": [(X, 0.45 * e)]}
        for s, sd in ((1, "L"), (-1, "R")):
            p[f"wing{sd}"] = {"rot": [(Z, -s * 0.2 * e), (Y, -s * 0.25 * e)]}
        p["body"] = {"rot": [(X, -0.06 * e)]}
        return p

    b.clip("idle", 96, idle)
    b.clip("move", 48, fly)
    b.clip("fly", 48, fly)
    b.clip("special", 72, flash)
    return b


# =============================================================================== leafcutter ant
def leafcutter_ant():
    b = Bug("leafcutter_ant")
    sh = soft("leafcutter_ant_body", tex="chitin.jpg", rough=0.4)
    rust, dark, light = (0.62, 0.27, 0.13), (0.42, 0.17, 0.08), (0.8, 0.45, 0.24)
    BZ = 0.07
    th = tube("leafcutter_ant_thorax", smooth_pts([(0, -0.08, BZ + 0.0), (0, -0.05, BZ + 0.015), (0, -0.02, BZ + 0.005)], 3),
              [0.022, 0.026, 0.027, 0.024, 0.02, 0.018, 0.016], sh, sides=12, col=painter(rust))
    spines = [tube(f"leafcutter_ant_spine{s}{k}", [V((s * 0.012, y, BZ + 0.02)), V((s * 0.022, y + 0.008, BZ + 0.042))], [0.005, 0.002], sh,
                   sides=5, col=painter(dark)) for s in (-1, 1) for k, y in enumerate((-0.07, -0.025))]
    b.r.bone("body", (0, -0.085, BZ), (0, -0.01, BZ), "root")
    b.r.add([th] + spines, "body")
    pet = [blob(f"leafcutter_ant_petiole{k}", (0, y, BZ + 0.005), (0.012, 0.012, 0.014), sh, seg=12, ring=8, col=painter(rust)) for k, y in
           enumerate((0.0, 0.022))]
    gas = blob("leafcutter_ant_gaster", (0, 0.075, BZ + 0.012), (0.042, 0.05, 0.038), sh, seg=20, ring=12, col=painter(dark, lambda p, n: light if n.z > 0.7 else None))
    b.r.bone("abdomen", (0, -0.01, BZ), (0, 0.13, BZ), "body")
    b.r.add(pet + [gas], "abdomen")
    # big heart-shaped head with strong (rounded) mandibles holding the leaf
    HC = V((0, -0.125, BZ + 0.025))
    head = blob("leafcutter_ant_head", HC, (0.045, 0.038, 0.04), sh, seg=22, ring=12,
                fn=lambda u: V((0, 0, -0.015 * max(0, u.z) * (1 - abs(u.x)) ** 2 * (u.y > -0.3))),
                col=painter(rust, lambda p, n: light if n.z > 0.6 else None))
    ey = bug_eyes("leafcutter_ant", [HC + V((s * 0.038, -0.012, 0.012)) for s in (-1, 1)], 0.013, color=(0.12, 0.06, 0.04))
    md = [blob(f"leafcutter_ant_mand{s}", HC + V((s * 0.016, -0.04, -0.018)), (0.014, 0.016, 0.008), sh, seg=10, ring=6,
               col=painter(dark)) for s in (-1, 1)]
    b.r.bone("head", (0, -0.085, BZ + 0.01), HC + V((0, -0.05, 0)), "body")
    b.r.add([head] + ey + md, "head")
    # a fresh leaf, gripped by its base in the mandibles and carried high like a sail
    # (separate node 'ant_leaf' on the head bone; painted leaf card, alpha-clipped, double-sided)
    import bmesh
    leaf_m = C.material("ant_leaf", tex="leafcard.png", alpha_tex=True, rough=0.6)
    leaf_m.use_backface_culling = False
    base = HC + V((0, -0.05, -0.02))
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    n = 6
    Hh, Ww = 0.16, 0.16
    grid = []
    for i in range(n + 1):
        row = []
        for j in range(n + 1):
            u, v = j / n, i / n
            x = (u - 0.5) * Ww
            z = v * Hh
            y = 0.03 * v * v - 0.02 * (u - 0.5) ** 2 * 4 * v   # leans back over the head, cupped
            row.append(bm.verts.new(base + V((x, y + 0.13 * v, z * 0.75 + 0.01))))
        grid.append(row)
    for i in range(n):
        for j in range(n):
            f = bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
            for lp, (jj, ii) in zip(f.loops, ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))):
                lp[uvl].uv = (jj / n * 0.5, 0.5 + ii / n * 0.5)
    lf = C.new_obj("ant_leaf", bm, [leaf_m])
    C.shade_smooth(lf)
    b.extras.append((lf, "head"))
    lc = painter(rust)
    for sd in ("L", "R"):
        b.antenna(sd, [HC + V((0.02, -0.03, 0.025)), HC + V((0.07, -0.04, 0.06)), HC + V((0.09, -0.09, 0.07))], 0.0045, sh, lc, tip=0.006)
        b.leg(sd, 0, (0.018, -0.07, 0.055), (0.06, -0.09, 0.08), (0.075, -0.13, 0.006), 0.0085, sh, lc)
        b.leg(sd, 1, (0.02, -0.045, 0.055), (0.07, -0.04, 0.085), (0.095, -0.02, 0.006), 0.0085, sh, lc)
        b.leg(sd, 2, (0.02, -0.02, 0.055), (0.07, 0.04, 0.09), (0.09, 0.1, 0.006), 0.0085, sh, lc)
    b.build()

    def idle(t):
        return merge(breathe(t, 2), antennae(t, 0.3, 3), {"head": {"rot": [(Z, 0.08 * S(t))]}})

    def move(t):  # marching with the leaf held high like a sail
        p = merge(b.gait(t, 3, swing=0.35, lift=0.3), antennae(t, 0.3, 6))
        p["body"] = {"loc": (0, 0, 0.003 * abs(S(t, 6)))}
        p["head"] = {"rot": [(Y, 0.05 * S(t, 3))]}
        return p

    def cut(t):  # snip-snip: head nods as the mandibles cut, then lifts the leaf proudly
        p = merge(antennae(t, 0.35, 4))
        p["head"] = {"rot": [(X, 0.18 * max(0, S(t, 4)))]}
        p["body"] = {"rot": [(X, 0.05 * S(t, 4))]}
        return p

    b.clip("idle", 96, idle)
    b.clip("move", 48, move)
    b.clip("special", 72, cut)
    b.clip("carry", 48, move)
    return b


# =============================================================================== stick insect
def stick_insect(camo=False):
    name = "stick_insect"
    b = Bug(name)
    tex = "bark.jpg"
    sh = soft(name + ("_camo" if camo else "_body"), tex=tex, rough=0.75 if camo else 0.55)
    if camo:  # mottled twig brown with lichen-green blotches: vanishes against the leafy board
        base = (0.5, 0.4, 0.27)

        def cf(p, n):
            m = C.fbm(p * 25 + V((3, 1, 0)), 3)
            if m > 0.22:
                return (0.48, 0.55, 0.3)
            if m < -0.25:
                return (0.35, 0.27, 0.18)
            return None
    else:      # fresh-leaf green with a warm brown back stripe: readable in the hand
        base = (0.45, 0.7, 0.3)

        def cf(p, n):
            return (0.62, 0.5, 0.28) if n.z > 0.8 else None
    col = painter(base, cf, 0.18)
    BZ = 0.06
    bp = smooth_pts([(0, -0.17, BZ + 0.005), (0, -0.08, BZ + 0.0), (0, 0.0, BZ)], 3)
    th = tube(name + "_thorax", bp, [0.017, 0.019, 0.02, 0.02, 0.019, 0.019, 0.019], sh, sides=10, col=col)
    b.r.bone("body", (0, -0.17, BZ), (0, 0.0, BZ), "root")
    b.r.add(th, "body")
    ap = smooth_pts([(0, 0.0, BZ), (0, 0.12, BZ + 0.005), (0, 0.24, BZ + 0.01), (0, 0.32, BZ + 0.025)], 4)
    ar = [0.019 - 0.01 * (i / (len(ap) - 1)) for i in range(len(ap))]
    ab = tube(name + "_abdomen", ap, ar, sh, sides=9, col=painter(base, lambda p, n: (mixc(base, (0.3, 0.25, 0.15), 0.5) if (p.y * 40) % 1.0 < 0.1 else cf(p, n)), 0.18))
    b.r.chain("abdomen", [V((0, 0.0, BZ)), V((0, 0.16, BZ + 0.005)), V((0, 0.32, BZ + 0.025))], "body")
    b.r.add_chain([ab], ["abdomen0", "abdomen1"])
    HC = V((0, -0.19, BZ + 0.01))
    head = blob(name + "_head", HC, (0.02, 0.027, 0.018), sh, seg=14, ring=8, col=col)
    ey = bug_eyes(name, [HC + V((s * 0.016, -0.01, 0.006)) for s in (-1, 1)], 0.009, color=(0.2, 0.14, 0.08))
    b.r.bone("head", (0, -0.17, BZ), HC + V((0, -0.04, 0)), "body")
    b.r.add([head] + ey, "head")
    for sd in ("L", "R"):
        b.antenna(sd, [HC + V((0.008, -0.022, 0.01)), HC + V((0.03, -0.1, 0.03)), HC + V((0.04, -0.17, 0.02))], 0.003, sh, col)
        b.leg(sd, 0, (0.012, -0.15, 0.05), (0.035, -0.2, 0.08), (0.05, -0.29, 0.005), 0.0075, sh, col, sides=6)
        b.leg(sd, 1, (0.014, -0.07, 0.05), (0.07, -0.085, 0.095), (0.1, -0.05, 0.005), 0.0075, sh, col, sides=6)
        b.leg(sd, 2, (0.014, -0.01, 0.05), (0.07, 0.04, 0.095), (0.09, 0.13, 0.005), 0.0075, sh, col, sides=6)
    b.build()

    def idle(t):  # sways like a twig in the breeze (a real stick-insect trick)
        p = merge(antennae(t, 0.12, 1))
        p["body"] = {"rot": [(Z, 0.04 * S(t, 2)), (Y, 0.05 * S(t, 2, 0.25))], "loc": (0.006 * S(t, 2), 0, 0)}
        p["abdomen0"] = {"rot": [(Z, -0.04 * S(t, 2, 0.1))]}
        return p

    def move(t):  # slow, rocking walk
        p = merge(b.gait(t, 1, swing=0.28, lift=0.3), antennae(t, 0.1, 2))
        p["body"] = {"rot": [(Y, 0.08 * S(t, 2))], "loc": (0.008 * S(t, 2), 0, 0)}
        return p

    def freeze(t):  # alarmed: front legs and antennae stretched forward, others tucked: a perfect twig
        e = R.ease_in_out(t)
        p = {}
        for b0, b1, s, pr in b.legs:
            if pr == 0:
                p[b0] = {"rot": [(Z, s * 0.6 * e), (Y, s * 0.3 * e)]}
                p[b1] = {"rot": [(Y, -s * 0.6 * e)]}
            else:
                p[b0] = {"rot": [(Z, -s * 0.4 * e)]}
                p[b1] = {"rot": [(Y, -s * 0.2 * e)]}
        for sd, s in (("L", 1), ("R", -1)):
            p[f"ant{sd}0"] = {"rot": [(Z, -s * 0.25 * e)]}
        p["root"] = {"loc": (0, 0, -0.01 * e)}
        return p

    b.clip("idle", 120, idle)
    b.clip("move", 96, move)
    b.clip("special", 96, freeze)
    return b


def spiral_shell(name, SC, mat, R0=0.075, turns=3.0, bgrow=0.12, H0=0.035, rows=72, sides=16):
    import bmesh
    axis = V((1.0, 0.1, 0.25)).normalized()          # coiling axis points to the snail's left, tilted up
    Yp = V((0, 1, 0))
    Yp = (Yp - axis * Yp.dot(axis)).normalized()
    Zp = axis.cross(Yp).normalized()
    if Zp.z < 0:
        Zp = -Zp
    TH = turns * math.pi * 2
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    grid, cols = [], []
    for i in range(rows + 1):
        th = TH * i / rows
        g = math.exp(bgrow * (th - TH))
        Rw, rt = R0 * g, R0 * g * 0.78
        tp = th - TH - math.pi / 2
        rad = Yp * math.cos(tp) + Zp * math.sin(tp)
        c = SC + rad * Rw + axis * (H0 * (1 - g))
        row = []
        for j in range(sides):
            ph = j / sides * math.pi * 2
            flare = 1.0 + (0.12 if i == rows else 0.0)
            pnt = c + (rad * math.cos(ph) + axis * math.sin(ph)) * rt * flare
            row.append(bm.verts.new(pnt))
            band = math.sin(ph * 3 + 0.6) > 0.35
            fleck = (th * 2.2) % 1.0 < 0.3
            base = (0.82, 0.62, 0.32)
            col = (0.4, 0.25, 0.12) if band and not fleck else base
            if i >= rows - 1:
                col = (0.96, 0.9, 0.78)                  # pale lip
            cols.append(col)
        grid.append(row)
    for i in range(rows):
        for j in range(sides):
            j2 = (j + 1) % sides
            f = bm.faces.new((grid[i][j], grid[i][j2], grid[i + 1][j2], grid[i + 1][j]))
            for lp, (u, v) in zip(f.loops, ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))):
                lp[uvl].uv = (u / sides, v / rows * 6)
    bm.faces.new(list(reversed(grid[0])))
    ob = C.new_obj(name, bm, [mat])
    C.shade_smooth(ob)
    me = ob.data
    ca = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
    me.color_attributes.active_color = ca
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            n = me.vertices[vi].normal
            c = lin(shade(cols[vi], n, 0.25))
            ca.data[li].color = (*c, 1.0)
    return ob


# =============================================================================== garden snail
def snail():
    r = R.Rig("snail")
    skin = soft("snail_body", tex="paint.jpg", rough=0.3)
    shell_m = soft("snail_shell", tex="chitin.jpg", rough=0.35)
    ey_m = flat("snail_eyedot", (0.08, 0.06, 0.06), 0.2)
    shine = flat("snail_shine", (1, 1, 1), 0.2, emissive=(1, 1, 1), emissive_strength=1.0)
    grey, light = (0.66, 0.6, 0.52), (0.8, 0.75, 0.66)
    r.bone("root", (0, 0, 0), (0, 0, 0.05))
    # soft foot/body: a long slug-shaped tube rising into the head
    bp = smooth_pts([(0, 0.2, 0.02), (0, 0.08, 0.035), (0, -0.06, 0.045), (0, -0.15, 0.07), (0, -0.19, 0.1)], 4)
    br = []
    for i in range(len(bp)):
        k = i / (len(bp) - 1)
        br.append(0.012 + 0.04 * math.sin(math.pi * min(1, k * 1.1)) ** 0.5 if k < 0.95 else 0.03)
    body = tube("snail_body", bp, br, skin, sides=14, noise=0.05, nscale=30,
                col=painter(grey, lambda p, n: mixc(light, grey, 0.5) if n.z < -0.3 else ((0.55, 0.48, 0.42) if C.fbm(p * 80, 2) > 0.2 else None)))
    # flatten the sole
    for v in body.data.vertices:
        if v.co.z < 0.012:
            v.co.z = 0.004 + (v.co.z - 0.004) * 0.2
    C.paint_vcol(body, painter(grey, lambda p, n: light if n.z < -0.3 else ((0.55, 0.48, 0.42) if C.fbm(p * 80, 2) > 0.2 else None)))
    names = r.chain("body", [V((0, 0.2, 0.03)), V((0, 0.05, 0.04)), V((0, -0.1, 0.06)), V((0, -0.19, 0.1))], "root")
    r.add_chain([body], names)
    # eye stalks (upper tentacles, eyes at the tips) and short feelers
    for s, sd in ((1, "L"), (-1, "R")):
        b0 = V((s * 0.016, -0.19, 0.12))
        tip = V((s * 0.04, -0.23, 0.21))
        st = tube(f"snail_stalk{sd}", smooth_pts([b0, (b0 + tip) / 2 + V((0, -0.01, 0)), tip], 3), [0.009, 0.008, 0.007, 0.006, 0.0055, 0.005, 0.005],
                  skin, sides=8, col=painter(grey))
        eb = blob(f"snail_eyebulb{sd}", tip, (0.011,) * 3, skin, seg=10, ring=6, col=painter(grey))
        ed = blob(f"snail_eye{sd}", tip + V((s * 0.003, -0.008, 0.002)), (0.0065,) * 3, ey_m, seg=10, ring=6)
        es = blob(f"snail_eyesh{sd}", tip + V((s * 0.003, -0.0135, 0.0045)), (0.0022,) * 3, shine, seg=6, ring=4)
        nm = r.chain(f"stalk{sd}", [b0, (b0 + tip) / 2, tip], names[-1])
        r.add_chain([st], nm)
        r.add([eb, ed, es], nm[-1])
        f0, f1 = V((s * 0.02, -0.215, 0.085)), V((s * 0.035, -0.245, 0.07))
        fe = tube(f"snail_feeler{sd}", [f0, f1], [0.006, 0.0045], skin, sides=6, col=painter(grey))
        r.bone(f"feeler{sd}", f0, f1, names[-1])
        r.add([fe, blob(f"snail_feelertip{sd}", f1, (0.005,) * 3, skin, seg=6, ring=4, col=painter(grey))], f"feeler{sd}")
    # the shell: a true logarithmic helico-spiral (whorls touch), spiral brown bands broken by gold growth flecks
    SC = V((0, 0.04, 0.165))
    sh = spiral_shell("snail_shell", SC, shell_m)
    r.bone("shell", SC + V((0, 0.0, -0.08)), SC + V((0, 0, 0.05)), "root")
    r.add(sh, "shell")
    r.build()

    def idle(t):
        return {"stalkL0": {"rot": [(X, 0.15 * S(t, 1)), (Z, 0.15 * S(t, 1, 0.2))]}, "stalkR0": {"rot": [(X, 0.15 * S(t, 1, 0.5)), (Z, -0.12 * S(t, 1, 0.1))]},
                "stalkL1": {"rot": [(X, 0.2 * S(t, 2))]}, "stalkR1": {"rot": [(X, 0.2 * S(t, 2, 0.3))]},
                "feelerL": {"rot": [(Z, 0.2 * S(t, 2))]}, "feelerR": {"rot": [(Z, -0.2 * S(t, 2, 0.4))]},
                "body2": {"rot": [(Z, 0.06 * S(t, 1, 0.1))]},
                "shell": {"rot": [(Y, 0.02 * S(t, 1))]}}

    def move(t):  # muscular waves glide along the foot; head sways, shell bobs
        p = idle(t)
        for i in range(3):
            p[f"body{i}"] = {"scale": (1.0, 1 + 0.06 * S(t, 2, -i * 0.25), 1.0), "rot": p.get(f"body{i}", {}).get("rot", [])}
        p["shell"] = {"rot": [(X, 0.04 * S(t, 2))], "loc": (0, 0, 0.004 * S(t, 2))}
        return p

    def hide(t):  # pulls the eye stalks in and tucks into the shell, then peeks out again
        e = R.ease_in_out(t)
        return {"stalkL0": {"scale": (1, 1 - 0.75 * e, 1)}, "stalkR0": {"scale": (1, 1 - 0.75 * e, 1)},
                "stalkL1": {"scale": (1, 1 - 0.6 * e, 1)}, "stalkR1": {"scale": (1, 1 - 0.6 * e, 1)},
                "feelerL": {"scale": (1, 1 - 0.8 * e, 1)}, "feelerR": {"scale": (1, 1 - 0.8 * e, 1)},
                "body2": {"scale": (1, 1 - 0.55 * e, 1), "rot": [(X, -0.3 * e)]},
                "body1": {"rot": [(X, -0.1 * e)]},
                "shell": {"loc": (0, 0.01 * e, -0.012 * e)}}

    r.clip("idle", 120, idle)
    r.clip("move", 96, move)
    r.clip("special", 96, hide)
    return r


# =============================================================================== honeybee
def honeybee():
    b = Bug("honeybee")
    fuzz = soft("honeybee_fuzz", tex="paint.jpg", rough=0.9)
    sh = soft("honeybee_body", tex="paint.jpg", rough=0.45)
    wing = membrane("honeybee_wing", (0.92, 0.96, 1.0), 0.35)
    gold, amber, dark, tan = (0.95, 0.7, 0.22), (0.86, 0.55, 0.16), (0.2, 0.14, 0.1), (0.8, 0.6, 0.38)
    pollen_m = soft("honeybee_pollen", tex="paint.jpg", rough=0.8)
    BZ = 0.08
    th = blob("honeybee_thorax", (0, -0.035, BZ + 0.01), (0.045, 0.045, 0.045), fuzz, seg=20, ring=12, noise=0.012, nscale=60,
              col=painter(tan, lambda p, n: (0.55, 0.38, 0.22) if n.z > 0.6 else None))
    b.r.bone("body", (0, -0.08, BZ), (0, 0.01, BZ), "root")
    b.r.add(th, "body")

    def stripes(p, n):
        k = (p.y - 0.02) / 0.11
        if k > 0.82:
            return dark
        return dark if (k * 4.2) % 1.0 > 0.62 else mixc(gold, amber, smoothstep(0.0, 0.8, -n.z))

    ab = blob("honeybee_abdomen", (0, 0.07, BZ - 0.01), (0.045, 0.07, 0.042), sh, seg=22, ring=14,
              fn=lambda u: V((0, 0.012 * max(0, u.y) ** 2, -0.01 * max(0, u.y))), col=painter(gold, stripes))
    b.r.bone("abdomen", (0, 0.01, BZ), (0, 0.15, BZ - 0.02), "body")
    b.r.add(ab, "abdomen")
    HC = V((0, -0.098, BZ + 0.01))
    head = blob("honeybee_head", HC, (0.036, 0.025, 0.034), fuzz, seg=18, ring=10, col=painter(dark, lambda p, n: (0.4, 0.3, 0.2) if n.y < -0.6 else None))
    ey = bug_eyes("honeybee", [HC + V((s * 0.028, -0.008, 0.01)) for s in (-1, 1)], 0.017, color=(0.14, 0.1, 0.08))
    b.r.bone("head", (0, -0.075, BZ), HC + V((0, -0.04, 0)), "body")
    b.r.add([head] + ey, "head")
    for s, sd in ((1, "L"), (-1, "R")):
        w0, w1 = V((s * 0.02, -0.04, BZ + 0.05)), V((s * 0.05, 0.1, BZ + 0.06))
        fw = blob(f"honeybee_wing{sd}", (w0 + w1) / 2, (0.03, 0.075, 0.002), wing, seg=14, ring=6)
        b.r.bone(f"wing{sd}", w0, w1, "body")
        b.r.add(fw, f"wing{sd}")
    lc = painter(dark)
    for sd in ("L", "R"):
        b.antenna(sd, [HC + V((0.01, -0.025, 0.02)), HC + V((0.025, -0.05, 0.06)), HC + V((0.04, -0.08, 0.06))], 0.0045, sh, lc)
        b.leg(sd, 0, (0.025, -0.06, 0.05), (0.055, -0.08, 0.065), (0.065, -0.105, 0.006), 0.008, sh, lc)
        b.leg(sd, 1, (0.03, -0.035, 0.045), (0.07, -0.03, 0.07), (0.085, -0.01, 0.006), 0.008, sh, lc)
        b.leg(sd, 2, (0.028, -0.01, 0.045), (0.07, 0.05, 0.075), (0.075, 0.1, 0.006), 0.009, sh, lc)
    # pollen baskets: bright orange pollen packed on the hind legs (corbiculae)
    for s, sd in ((1, "L"), (-1, "R")):
        pc = V((s * 0.073, 0.075, 0.04))
        pb = blob(f"honeybee_pollen{sd}", pc, (0.016, 0.02, 0.016), pollen_m, seg=12, ring=8, noise=0.004, nscale=80, col=painter((1.0, 0.62, 0.15)))
        b.r.add(pb, f"leg{sd}21")
    b.build()

    def idle(t):
        p = merge(breathe(t, 3), antennae(t, 0.25, 3))
        for s, sd in ((1, "L"), (-1, "R")):
            p[f"wing{sd}"] = {"rot": [(Y, -s * 0.15 * max(0, S(t, 3)) ** 6)]}
        return p

    def fly(t):  # wings a blur, legs dangling, hovering bob 0.3 above ground
        p = merge(antennae(t, 0.15, 2))
        p["root"] = {"loc": (0, 0, 0.22 + 0.025 * S(t, 2))}
        p["body"] = {"rot": [(X, 0.12 + 0.03 * S(t, 2))]}
        for s, sd in ((1, "L"), (-1, "R")):
            p[f"wing{sd}"] = {"rot": [(Z, -s * 0.9), (Y, -s * (0.35 + 0.8 * S(t, 24)))]}
        p.update(merge(p, b.legs_pose(lambda s, pr: ([(Y, s * 0.3), (X, 0.2 * pr)], [(Y, -s * 0.5)]))))
        p["abdomen"] = {"rot": [(X, -0.12 + 0.04 * S(t, 2))]}
        return p

    def waggle(t):  # the waggle dance: body shimmies side to side while buzzing (tells the hive where flowers are)
        p = merge(b.gait(t, 4, swing=0.2, lift=0.2), antennae(t, 0.2, 4))
        w = S(t, 12) * (0.25 if (t * 2) % 1.0 < 0.6 else 0.0)
        p["body"] = {"rot": [(Z, w * 0.6)]}
        p["abdomen"] = {"rot": [(Z, w)]}
        for s, sd in ((1, "L"), (-1, "R")):
            p[f"wing{sd}"] = {"rot": [(Y, -s * (0.2 + 0.15 * S(t, 24)))]}
        return p

    b.clip("idle", 72, idle)
    b.clip("move", 48, fly)
    b.clip("fly", 48, fly)
    b.clip("special", 96, waggle)
    return b


# =============================================================================== monarch caterpillar
def monarch_caterpillar():
    r = R.Rig("monarch_caterpillar")
    skin = soft("monarch_caterpillar_skin", tex="paint.jpg", rough=0.4)
    blk = flat("monarch_caterpillar_black", (0.05, 0.05, 0.06), 0.35)
    white, yellow, black = (0.97, 0.96, 0.9), (1.0, 0.82, 0.12), (0.06, 0.06, 0.07)
    r.bone("root", (0, 0, 0), (0, 0, 0.05))
    NSEG = 12
    L0, L1 = -0.15, 0.15
    pts = [V((0, L0 + (L1 - L0) * i / NSEG, 0.035)) for i in range(NSEG + 1)]
    # rings: plump segments with creases; stripes black / yellow / white repeated per segment (true monarch pattern)
    sp, rr = [], []
    RPS = 8
    for i in range(NSEG * RPS + 1):
        k = i / (NSEG * RPS)
        y = L0 + (L1 - L0) * k
        sp.append(V((0, y, 0.035)))
        seg = (k * NSEG) % 1.0
        crease = 0.88 + 0.12 * math.sin(seg * math.pi)
        taper = min(1.0, k * 9, (1 - k) * 7) ** 0.4
        rr.append(0.033 * crease * taper + 0.002)

    PAT = [black, black, white, yellow, yellow, white, black, white]

    def band(p, n):
        idx = int(round((p.y - L0) / (L1 - L0) * NSEG * RPS)) % RPS
        c = PAT[idx]
        if c == yellow and n.z < -0.5:
            return white
        return c

    body = tube("monarch_caterpillar_body", sp, rr, skin, sides=14, col=painter(white, band, 0.18))
    for v in body.data.vertices:  # flatter belly
        if v.co.z < 0.012:
            v.co.z = 0.012 - (0.012 - v.co.z) * 0.4
    C.paint_vcol(body, painter(white, band, 0.18))
    bones = r.chain("seg", [pts[0], pts[3], pts[6], pts[9], pts[12]], "root")
    r.add_chain([body], bones)
    HC = V((0, L0 - 0.012, 0.04))
    head = blob("monarch_caterpillar_head", HC, (0.028, 0.024, 0.027), skin, seg=18, ring=10,
                col=painter(yellow, lambda p, n: black if abs(p.x) < 0.012 or abs(p.x) > 0.022 else None))
    ey = []
    shine = flat("monarch_caterpillar_shine", (1, 1, 1), 0.2, emissive=(1, 1, 1), emissive_strength=1.0)
    for s in (-1, 1):
        c = HC + V((s * 0.016, -0.02, 0.006))
        ey.append(blob(f"mc_eye{s}", c, (0.0085,) * 3, blk, seg=10, ring=6))
        ey.append(blob(f"mc_eyesh{s}", c + V((s * 0.002, -0.007, 0.004)), (0.003,) * 3, shine, seg=6, ring=4))
    smile = tube("mc_smile", [HC + V((math.sin(a) * 0.01, -0.022 + abs(math.sin(a)) * 0.004, -0.012 + (1 - math.cos(a)) * 0.01)) for a in
                              [-0.9 + i * 0.3 for i in range(7)]], [0.0018] * 7, blk, sides=4)
    r.bone("head", pts[0], HC + V((0, -0.03, 0.0)), bones[0])
    r.add([head, smile] + ey, "head")
    # filaments: a long pair behind the head, a shorter pair near the tail
    for s, sd in ((1, "L"), (-1, "R")):
        for nm, y, ln, par in (("front", L0 + 0.04, 0.07, bones[0]), ("back", L1 - 0.04, 0.045, bones[-1])):
            b0 = V((s * 0.012, y, 0.065))
            d = V((s * 0.35, -0.5 if nm == "front" else 0.5, 1)).normalized()
            fpts = smooth_pts([b0, b0 + d * ln * 0.5, b0 + d * ln + V((s * 0.01, (-0.02 if nm == 'front' else 0.02), -0.01))], 3)
            fl = tube(f"mc_fil{nm}{sd}", fpts, [0.0035 * (1 - 0.6 * i / (len(fpts) - 1)) for i in range(len(fpts))], blk, sides=5)
            r.bone(f"fil{nm}{sd}", b0, b0 + d * ln, par)
            r.add_chain([fl], [f"fil{nm}{sd}"])
    # true legs (3 pairs, black) and prolegs (pale, with dark tips)
    for s in (-1, 1):
        for k in range(3):
            y = L0 + 0.03 + k * 0.022
            lg = tube(f"mc_leg{s}{k}", [V((s * 0.02, y, 0.015)), V((s * 0.026, y - 0.006, 0.002))], [0.005, 0.003], blk, sides=5)
            r.add(lg, bones[0])
        for k in range(5):
            y = L0 + 0.13 + k * 0.03
            if k == 4:
                y = L1 - 0.015
            pl = blob(f"mc_proleg{s}{k}", (s * 0.022, y, 0.009), (0.008, 0.009, 0.009), skin, seg=8, ring=5,
                      col=painter((0.85, 0.85, 0.78), lambda p, n: black if p.z < 0.004 else None))
            r.add(pl, bones[min(3, int((y - L0) / (L1 - L0) * 4))])
    r.build()

    def idle(t):
        return {"head": {"rot": [(Z, 0.15 * S(t, 1)), (X, 0.05 * S(t, 2))]},
                "filfrontL": {"rot": [(X, 0.2 * S(t, 2))]}, "filfrontR": {"rot": [(X, 0.2 * S(t, 2, 0.3))]},
                "filbackL": {"rot": [(X, 0.15 * S(t, 2, 0.2))]}, "filbackR": {"rot": [(X, 0.15 * S(t, 2, 0.5))]},
                "seg0": {"rot": [(Z, 0.03 * S(t))]}}

    def move(t):  # a hump travels from tail to head (how caterpillars crawl)
        p = {}
        for i in range(4):
            ph = 0.25 * i
            w = S(t, 2, ph)
            p[f"seg{i}"] = {"rot": [(X, -0.18 * w if i % 2 == 0 else 0.18 * w)]}
        p["head"] = {"rot": [(X, 0.1 * S(t, 2, 0.1))]}
        for sd in ("L", "R"):
            p[f"filfront{sd}"] = {"rot": [(X, 0.25 * S(t, 2, 0.3))]}
            p[f"filback{sd}"] = {"rot": [(X, 0.2 * S(t, 2, 0.6))]}
        return p

    def munch(t):  # munching milkweed: head nibbles up-down, body rears a little
        e = R.ease_in_out(t)
        return {"seg0": {"rot": [(X, -0.25 * e)]},
                "head": {"rot": [(X, 0.25 * e * max(0.0, S(t, 8)))]},
                "filfrontL": {"rot": [(X, 0.2 * S(t, 4))]}, "filfrontR": {"rot": [(X, 0.2 * S(t, 4, 0.2))]}}

    r.clip("idle", 96, idle)
    r.clip("move", 72, move)
    r.clip("special", 96, munch)
    r.clip("eat", 96, munch)
    return r


ALL = {"flea": flea, "dung_beetle": dung_beetle, "locust": locust, "tiger_beetle": tiger_beetle, "firefly": firefly,
       "leafcutter_ant": leafcutter_ant, "stick_insect": stick_insect, "stick_insect_camo": lambda: stick_insect(True),
       "snail": snail, "honeybee": honeybee, "monarch_caterpillar": monarch_caterpillar}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    names = argv or list(ALL)
    for n in names:
        C.reset()
        obj = ALL[n]()
        path = os.path.join(C.OUT, n + ".glb")
        obj.export(path)
