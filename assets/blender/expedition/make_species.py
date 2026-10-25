"""Expedition species: living, rigged, friendly-stylised animals for the Biome Frontier field survey.

OW_TEX=<tex> OW_OUT=<glb> blender -b --factory-startup -P make_species.py [-- name ...]
New: sloth (two-toed), bighorn (desert bighorn sheep), octopus (common octopus).
Movement-ready remakes of the district's first species: toucan, tree_frog, morpho, tortoise,
horned_lizard, sea_turtle, clownfish, sea_star (the saguaro is a plant: unchanged, no rig).
Every animal: one skinned mesh + armature, clips named exactly idle / move / feed / special.
Facing -Y in Blender (+Z in glTF), origin at the feet (the sloth: origin on its branch).
"""
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import xrig as R  # noqa: E402
from xrig import C, Cs, S, X, Y, Z, blob, eyes, flat, mixc, shade, smooth_pts, smoothstep, soft, tube  # noqa: E402

V = Vector


def painter(base, fn=None):
    """Vertex-colour painter: fn(p, n) -> colour or None (falls back to base), then baked soft light."""
    def f(p, n):
        c = fn(p, n) if fn else None
        return shade(c if c is not None else base, n)
    return f


# =============================================================================== sloth
def sloth():
    rig = R.Rig("sloth")
    fur = soft("sloth_fur", tex="fur.jpg", rough=0.85)
    face_m = soft("sloth_face", rough=0.7)
    claw_m = flat("sloth_claw", (0.22, 0.17, 0.12), 0.4)
    nose_m = flat("sloth_nose", (0.16, 0.1, 0.08), 0.3)
    bark = C.material("sloth_branch", tex="bark.jpg", rough=0.9, normal="bark_n.jpg")
    leaf = soft("sloth_leaf", rough=0.55)

    furc = painter((0.55, 0.41, 0.28), lambda p, n: mixc((0.55, 0.41, 0.28), (0.7, 0.56, 0.4), smoothstep(0.2, 0.9, n.z)))
    # branch (origin on it), a few leaf sprigs
    br = tube("sloth_branch", [(-0.75, 0.0, 0.0), (-0.3, 0.01, 0.01), (0.2, -0.01, -0.005), (0.75, 0.0, 0.01)], [0.05, 0.048, 0.046, 0.042], bark, sides=12, uv="tube", uvrep=1.0)
    leaves = []
    for k, (x, a) in enumerate(((-0.6, 0.6), (0.55, -0.7), (0.66, 2.3))):
        d = V((math.cos(a) * 0.3, math.sin(a), 0.6)).normalized()
        base = V((x, 0, 0.03))
        leaves.append(tube(f"sloth_twig{k}", [base, base + d * 0.12], [0.012, 0.008], bark, sides=5))
        for j in range(3):
            c = base + d * (0.1 + j * 0.03) + V((math.cos(a + j * 2) * 0.05, math.sin(a + j * 2) * 0.05, 0.02))
            leaves.append(blob(f"sloth_leaf{k}{j}", c, (0.06, 0.03, 0.008), leaf, seg=10, ring=6,
                               fn=lambda u: V((0, 0, 0.02 * u.x * u.x)), col=painter((0.32, 0.62, 0.25))))
    rig.bone("root", (0, 0, 0), (0, 0, 0.2))
    rig.add([br] + leaves, "root")

    # body hangs under the branch, belly up, head at +X looking at the viewer (-Y)
    body = blob("sloth_body", (0.0, 0.0, -0.3), (0.27, 0.17, 0.15), fur, seg=24, ring=14, noise=0.025, nscale=9,
                fn=lambda u: V((0, 0, 0.03 * u.x)), col=furc)
    rig.bone("body", (-0.22, 0, -0.3), (0.22, 0, -0.3), "root")
    rig.add(body, "body")
    # shaggy fur tufts along the back (underside, it hangs belly-up)
    tufts = []
    rng = random.Random(3)
    for k in range(9):
        x = -0.2 + k * 0.05
        tufts.append(blob(f"sloth_tuft{k}", (x, rng.uniform(-0.08, 0.08), -0.43 + abs(x) * 0.3), (0.06, 0.05, 0.035), fur, seg=10, ring=6,
                          noise=0.01, col=painter((0.5, 0.38, 0.27))))
    rig.add(tufts, "body")

    HC = V((0.31, -0.05, -0.2))
    head = blob("sloth_head", HC, (0.115, 0.11, 0.11), fur, seg=24, ring=14, noise=0.012, nscale=8, col=furc)
    face = blob("sloth_face", HC + V((0.0, -0.06, -0.005)), (0.09, 0.06, 0.08), face_m, seg=22, ring=12,
                col=painter((0.93, 0.86, 0.72)))
    patches = []
    patch_m = soft("sloth_patch", rough=0.7)
    for s in (-1, 1):
        patches.append(blob(f"sloth_mask{s}", HC + V((s * 0.042, -0.112, 0.012)), (0.04, 0.014, 0.03), patch_m, seg=12, ring=8,
                            fn=lambda u, s=s: V((0, 0, -0.01 * u.x * s)), col=painter((0.33, 0.22, 0.14))))
    nose = blob("sloth_nose", HC + V((0, -0.125, -0.025)), (0.024, 0.014, 0.016), nose_m, seg=12, ring=8)
    smile = tube("sloth_smile", [HC + V((math.sin(a) * 0.026, -0.121 + abs(math.sin(a)) * 0.006, -0.05 + (1 - math.cos(a)) * 0.03)) for a in
                                 [-0.9 + i * 0.3 for i in range(7)]], [0.0045] * 7, nose_m, sides=5)
    ey = eyes("sloth", [HC + V((s * 0.042, -0.117, 0.014)) for s in (-1, 1)], 0.017, iris=(0.12, 0.07, 0.04))
    rig.bone("head", (0.22, -0.02, -0.26), HC + V((0, 0, 0.1)), "body")
    rig.add([head, face, nose, smile] + patches + ey, "head")

    # limbs: arms (front, +X) and legs (back, -X) reaching up to hook the branch
    claws = []
    for side, s in (("L", 1), ("R", -1)):
        for kind, x0, x1, nclaw in (("arm", 0.17, 0.3, 2), ("leg", -0.18, -0.3, 3)):
            sh = V((x0, s * 0.12, -0.27))
            el = V(((x0 + x1) * 0.5 + (0.04 if kind == "arm" else -0.04), s * 0.15, -0.12))
            hd = V((x1, s * 0.055, 0.0))
            pts = smooth_pts([sh, el, hd + V((0, s * 0.02, -0.04)), hd], 4)
            rad = [0.065 - 0.03 * (i / (len(pts) - 1)) for i in range(len(pts))]
            limb = tube(f"sloth_{kind}{side}", pts, rad, fur, sides=12, noise=0.15, nscale=12, col=furc)
            paw = blob(f"sloth_{kind}paw{side}", hd + V((0, s * 0.01, -0.005)), (0.04, 0.035, 0.035), fur, seg=12, ring=8, col=furc)
            names = rig.chain(f"{kind}.{side}", [sh, el, hd + V((0, 0, 0.03))], "body")
            rig.add_chain([limb], names)
            # long curved claws hooking over the branch
            cl = []
            for c in range(nclaw):
                off = (c - (nclaw - 1) / 2) * 0.022
                b0 = hd + V((off, s * 0.02, 0.0))
                cp = [b0, b0 + V((0, -s * 0.02, 0.05)), b0 + V((0, -s * 0.07, 0.07)), b0 + V((0, -s * 0.1, 0.035))]
                cl.append(tube(f"sloth_claw{kind}{side}{c}", smooth_pts(cp, 2), [0.011, 0.01, 0.008, 0.006, 0.004, 0.003, 0.0015],
                               claw_m, sides=5))
            rig.add(cl + [paw], names[-1])
            claws += cl
    rig.build()

    def hang(t, amp=1.0):
        return {"body": {"rot": [(X, 0.05 * S(t) * amp)], "scale": 1 + 0.012 * S(t, 2)},
                "head": {"rot": [(Z, 0.18 * S(t, 1, 0.1) * amp), (X, 0.05 * S(t, 1, 0.3))]}}

    rig.clip("idle", 120, lambda t: hang(t))

    def climb(t):
        p = hang(t, 0.5)
        p["body"]["loc"] = (0.02 * S(t, 2), 0, 0.01 * Cs(t, 2))
        for side, s in (("L", 1), ("R", -1)):
            for kind, ph in (("arm", 0.0 if s > 0 else 0.5), ("leg", 0.5 if s > 0 else 0.0)):
                k = (t + ph) % 1.0
                reach = S(k)                     # swing along the branch
                lift = max(0.0, S(k, 1, 0.0)) if k < 0.5 else 0.0
                sgn = 1 if kind == "arm" else -1
                p[f"{kind}.{side}0"] = {"rot": [(Y, sgn * 0.22 * reach), (X, -s * 0.35 * lift)]}
                p[f"{kind}.{side}1"] = {"rot": [(X, -s * 0.3 * lift)]}
        p["head"]["rot"] = [(Z, 0.1 * S(t)), (Y, 0.06 * S(t, 2))]
        return p

    rig.clip("move", 120, climb)

    def feed(t):
        p = hang(t, 0.3)
        e = R.ease_in_out(t)
        p["head"]["rot"] = [(Z, -0.35 * e), (X, 0.25 * e + 0.06 * S(t, 6) * e)]
        p["arm.L0"] = {"rot": [(Y, -0.3 * e)]}
        return p

    rig.clip("feed", 96, feed)

    def wave(t):
        p = hang(t, 0.3)
        e = R.ease_in_out(t)
        # front (viewer-side, -Y) arm lets go and waves slowly
        p["arm.R0"] = {"rot": [(X, 0.85 * e), (Y, -0.35 * e)]}
        p["arm.R1"] = {"rot": [(X, 0.3 * e), (Z, 0.5 * S(t, 2) * e)]}
        p["head"]["rot"] = [(Z, -0.1 * e), (Y, 0.15 * e)]
        return p

    rig.clip("special", 120, wave)
    return rig


# =============================================================================== bighorn
def bighorn():
    rig = R.Rig("bighorn")
    coat = soft("bighorn_coat", tex="fur.jpg", rough=0.85)
    horn_m = soft("bighorn_horn", tex="paint.jpg", rough=0.55)
    hoof_m = flat("bighorn_hoof", (0.16, 0.12, 0.1), 0.45)
    nose_m = flat("bighorn_nose", (0.2, 0.13, 0.11), 0.35)
    brown, cream, white = (0.52, 0.4, 0.29), (0.93, 0.86, 0.74), (0.98, 0.96, 0.92)

    def coatc(p, n):
        if p.y > 0.3 and n.y > 0.15 and p.z > 0.38:
            return white  # white rump patch
        if n.z < -0.45:
            return cream
        return mixc(brown, (0.48, 0.32, 0.2), smoothstep(0.75, 0.95, p.z) * 0.6)

    rig.bone("root", (0, 0, 0), (0, 0, 0.2))
    BZ = 0.56
    body = blob("bighorn_body", (0, 0.04, BZ), (0.24, 0.4, 0.25), coat, seg=28, ring=16, noise=0.012, nscale=6,
                fn=lambda u: V((0, 0, 0.04 * max(0.0, -u.y) * (u.z > 0) - 0.03 * (u.z < -0.3))), col=painter(brown, coatc))
    chest = blob("bighorn_chest", (0, -0.3, BZ + 0.02), (0.19, 0.17, 0.22), coat, seg=20, ring=12, col=painter(brown, coatc))
    tail = blob("bighorn_tail", (0, 0.47, BZ + 0.1), (0.045, 0.05, 0.06), coat, seg=10, ring=8, col=painter((0.35, 0.25, 0.17)))
    rig.bone("body", (0, 0.4, BZ), (0, -0.3, BZ), "root")
    rig.add([body, chest], "body")
    rig.bone("tail", (0, 0.44, BZ + 0.12), (0, 0.52, BZ + 0.04), "body")
    rig.add(tail, "tail")

    # neck + head
    nb, nt = V((0, -0.3, BZ + 0.1)), V((0, -0.47, BZ + 0.25))
    neck = tube("bighorn_neck", smooth_pts([nb, (nb + nt) / 2 + V((0, 0.0, 0.01)), nt], 3), [0.14, 0.13, 0.12, 0.11, 0.105, 0.1, 0.1], coat, sides=16,
                col=painter(brown, coatc))
    rig.bone("neck", nb, nt, "body")
    rig.add_chain(neck, ["neck"])
    HC = V((0, -0.57, BZ + 0.3))
    head = blob("bighorn_head", HC, (0.088, 0.15, 0.095), coat, seg=22, ring=14,
                fn=lambda u: V((0, -0.03 * max(0.0, -u.y), -0.03 * max(0.0, -u.y))), col=painter(brown))
    muzzle = blob("bighorn_muzzle", HC + V((0, -0.13, -0.05)), (0.062, 0.085, 0.058), coat, seg=18, ring=10, col=painter(cream))
    nose = blob("bighorn_nose", HC + V((0, -0.205, -0.03)), (0.026, 0.012, 0.016), nose_m, seg=10, ring=6)
    smile = tube("bighorn_smile", [HC + V((math.sin(a) * 0.03, -0.19 + abs(math.sin(a)) * 0.02, -0.08 + (1 - math.cos(a)) * 0.025))
                                   for a in [-0.9 + i * 0.3 for i in range(7)]], [0.004] * 7, nose_m, sides=5)
    ey = eyes("bighorn", [HC + V((s * 0.058, -0.085, 0.03)) for s in (-1, 1)], 0.026, look=V((0, -1, 0.05)), iris=(0.2, 0.12, 0.05))
    hp = [head, muzzle, nose, smile] + ey
    ears = []
    for s, sd in ((1, "L"), (-1, "R")):
        ear = blob(f"bighorn_ear{sd}", HC + V((s * 0.11, 0.05, -0.02)), (0.05, 0.018, 0.024), coat, seg=12, ring=8,
                   fn=lambda u: V((0, 0, -0.015 * u.x * u.x)), col=painter(brown, lambda p, n: cream if n.y < -0.3 else None))
        rig.bone(f"ear.{sd}", HC + V((s * 0.08, 0.02, 0.02)), HC + V((s * 0.18, 0.02, 0.02)), "head")
        rig.add(ear, f"ear.{sd}")
        # big friendly curled horns: grow up-back from the crown, curl out, down and forward round the ear
        pts, rad = [], []
        N = 22
        for i in range(N + 1):
            k = i / N
            phi = 0.1 + k * 1.6 * math.pi
            r0 = 0.12 - 0.065 * k
            # side-view spiral: up from the crown, back, down behind the ear, then forward
            pts.append(HC + V((s * (0.05 + 0.21 * k ** 1.2), 0.07 + r0 * math.sin(phi), -0.04 + r0 * math.cos(phi))))
            rad.append(0.055 * (1 - k) ** 0.8 + 0.008)
        # swing the curl's plane outward so it reads from the front 3/4 too
        from mathutils import Matrix
        piv = pts[0].copy()
        rot = Matrix.Rotation(-s * 0.65, 3, "Z") @ Matrix.Rotation(s * 0.25, 3, "Y")
        pts = [piv + rot @ (q - piv) for q in pts]
        horn = tube(f"bighorn_horn{sd}", pts, rad, horn_m, sides=12, flare=lambda i, a: 0.006 * math.cos(i * 2.6),
                    col=painter((0.6, 0.48, 0.34), lambda p, n: mixc((0.66, 0.54, 0.38), (0.5, 0.39, 0.27), 0.5 + 0.5 * math.sin(p.length * 160))))
        hp.append(horn)
    rig.bone("head", nt, HC + V((0, -0.2, 0.0)), "neck")
    rig.add(hp, "head")

    # legs
    for sd, sx in (("L", 1), ("R", -1)):
        for fb, y in (("F", -0.28), ("B", 0.3)):
            top, knee, foot = V((sx * 0.13, y, BZ - 0.06)), V((sx * 0.13, y + (0.02 if fb == "F" else -0.03), 0.26)), V((sx * 0.13, y, 0.05))
            thigh = blob(f"bighorn_thigh{fb}{sd}", (top + knee) / 2 + V((0, 0, 0.04)), (0.085, 0.11, 0.16), coat, seg=14, ring=10,
                         col=painter(brown, coatc))
            shin = tube(f"bighorn_shin{fb}{sd}", [knee + V((0, 0, 0.06)), knee, (knee + foot) / 2, foot], [0.055, 0.05, 0.042, 0.04], coat, sides=10,
                        col=painter((0.45, 0.32, 0.22), lambda p, n: white if n.y > 0.4 else None))
            hoof = blob(f"bighorn_hoof{fb}{sd}", foot + V((0, -0.012, -0.015)), (0.042, 0.05, 0.036), hoof_m, seg=12, ring=8,
                        fn=lambda u: V((0, 0, 0)) if u.z > -0.3 else V((0, 0, (-0.3 - u.z) * 0.03)))
            u, l = f"leg{fb}.{sd}0", f"leg{fb}.{sd}1"
            rig.bone(u, top, knee, "body")
            rig.bone(l, knee, foot, u)
            rig.add(thigh, u)
            rig.add([shin, hoof], l)
    rig.build()

    def base(t, amp=1.0):
        return {"body": {"scale": 1 + 0.01 * S(t, 2)},
                "neck": {"rot": [(X, -0.03 * S(t))]},
                "head": {"rot": [(Z, 0.25 * S(t, 1, 0.2) * amp), (X, 0.04 * S(t, 2))]},
                "ear.L": {"rot": [(Y, -0.25 * max(0.0, S(t, 3)) ** 8)]},
                "ear.R": {"rot": [(Y, 0.25 * max(0.0, S(t, 2, 0.3)) ** 8)]},
                "tail": {"rot": [(Z, 0.3 * S(t, 4))]}}

    rig.clip("idle", 96, base)

    def walk(t):
        p = base(t, 0.2)
        p["root"] = {"loc": (0, 0, 0.02 * abs(S(t, 2)))}
        p["body"]["rot"] = [(Y, 0.04 * S(t)), (X, 0.02 * S(t, 2))]
        for sd, sx, phF in (("L", 1, 0.0), ("R", -1, 0.5)):
            for fb, ph in (("F", phF), ("B", (phF + 0.5) % 1.0)):
                k = (t + ph) % 1.0
                sw = S(k)
                lift = max(0.0, Cs(k))
                p[f"leg{fb}.{sd}0"] = {"rot": [(X, -0.38 * sw)]}
                p[f"leg{fb}.{sd}1"] = {"rot": [(X, (0.55 if fb == "F" else -0.55) * lift * -1)]}
        p["neck"] = {"rot": [(X, 0.06 * S(t, 2))]}
        return p

    rig.clip("move", 32, walk, step=1)

    def graze(t):
        p = base(t, 0.0)
        e = smoothstep(0.0, 0.2, t) * (1 - smoothstep(0.8, 1.0, t))
        chew = S(t, 6) * e
        p["body"]["rot"] = [(X, 0.08 * e)]
        p["neck"] = {"rot": [(X, 1.05 * e)]}
        p["head"] = {"rot": [(X, 0.55 * e + 0.06 * chew), (Z, 0.08 * S(t, 2) * e)]}
        for sd in ("L", "R"):
            p[f"legF.{sd}0"] = {"rot": [(X, -0.08 * e)]}
            p[f"legF.{sd}1"] = {"rot": [(X, 0.0)]}
        return p

    rig.clip("feed", 120, graze)

    def hop(t):
        p = base(t, 0.0)
        h = max(0.0, math.sin(min(1.0, max(0.0, (t - 0.25) / 0.5)) * math.pi))
        crouch = max(0.0, 1 - abs(t - 0.22) / 0.12) + max(0.0, 1 - abs(t - 0.8) / 0.12)
        p["root"] = {"loc": (0, 0, 0.32 * h - 0.05 * crouch)}
        p["body"]["rot"] = [(X, -0.15 * h)]
        for sd in ("L", "R"):
            p[f"legF.{sd}0"] = {"rot": [(X, -0.35 * h)]}
            p[f"legF.{sd}1"] = {"rot": [(X, 0.45 * h)]}
            p[f"legB.{sd}0"] = {"rot": [(X, 0.3 * h)]}
            p[f"legB.{sd}1"] = {"rot": [(X, -0.35 * h)]}
        p["head"] = {"rot": [(X, -0.2 * h)]}
        return p

    rig.clip("special", 48, hop, step=1)
    return rig


# =============================================================================== octopus
def octopus():
    rig = R.Rig("octopus")
    # colour-change friendly: near-white painted vertex colours x baseColorFactor (tint at runtime)
    skin = soft("octopus_skin", rough=0.55, color=(0.95, 0.42, 0.3))
    sucker_m = soft("octopus_suckers", rough=0.4, color=(1.0, 0.86, 0.78))

    def skinc(p, n):
        sp = C.fbm(p * 14, 2)
        v = 0.92 + 0.12 * max(0.0, sp) - 0.1 * max(0.0, -sp - 0.15)
        c = (v, v * 0.98, v * 0.96)
        if n.z < -0.3:
            c = mixc(c, (1.0, 1.0, 1.0), 0.6)
        return shade(c, n, amt=0.28)

    rig.bone("root", (0, 0, 0), (0, 0, 0.12))
    HC = V((0, -0.02, 0.2))
    head = blob("octopus_head", HC, (0.15, 0.14, 0.13), skin, seg=26, ring=14, col=skinc)
    mantle = blob("octopus_mantle", (0, 0.12, 0.36), (0.16, 0.19, 0.2), skin, seg=28, ring=16,
                  fn=lambda u: V((0, 0.05 * max(0.0, u.z), 0.0)), col=skinc)
    rig.bone("head", (0, 0, 0.1), (0, -0.02, 0.3), "root")
    rig.bone("mantle", (0, 0.04, 0.24), (0, 0.18, 0.5), "head")
    ey = eyes("octopus", [HC + V((s * 0.075, -0.115, 0.06)) for s in (-1, 1)], 0.042, look=V((0, -1, 0.15)), iris=(0.12, 0.08, 0.06),
              )
    smile = tube("octopus_smile", [HC + V((math.sin(a) * 0.03, -0.138 + abs(math.sin(a)) * 0.012, -0.015 + (1 - math.cos(a)) * 0.025))
                                   for a in [-0.9 + i * 0.3 for i in range(7)]], [0.005] * 7, flat("octopus_mouth", (0.45, 0.14, 0.12)), sides=5)
    cheeks = [blob(f"octopus_cheek{s}", HC + V((s * 0.095, -0.115, -0.005)), (0.025, 0.008, 0.016), flat("octopus_blush", (1.0, 0.6, 0.55), 0.7),
                   seg=10, ring=6) for s in (-1, 1)]
    rig.add([head] + ey + [smile] + cheeks, "head")
    rig.add(mantle, "mantle")
    # 8 arms spread on the ground, tips curling up
    arms = []
    for k in range(8):
        a = (k + 0.5) / 8 * math.pi * 2 - math.pi / 2  # arm 0/7 flank the front (-Y)
        rd = V((math.cos(a), math.sin(a), 0))
        front = rd.y < -0.5
        L = 0.85 if front else 1.0
        ctrl = [rd * 0.06 + V((0, 0, 0.13)), rd * 0.17 * L + V((0, 0, 0.05)), rd * 0.3 * L + V((0, 0, 0.035)), rd * 0.42 * L + V((0, 0, 0.05)),
                rd * 0.5 * L + V((0, 0, 0.11)), rd * 0.47 * L + V((0, 0, 0.17))]
        side = rd.cross(V((0, 0, 1)))
        ctrl = [c + side * (0.04 * math.sin(i * 0.9 + k)) for i, c in enumerate(ctrl)]
        pts = smooth_pts(ctrl, 3)
        n = len(pts)
        rad = [0.052 * (1 - i / (n - 1)) ** 0.85 + 0.007 for i in range(n)]
        arm = tube(f"octopus_arm{k}", pts, rad, skin, sides=9, col=skinc)
        bones = rig.chain(f"arm{k}.", [ctrl[0], ctrl[1], ctrl[2], ctrl[3], ctrl[4], ctrl[5]], "head")
        rig.add_chain(arm, bones)
        # suckers on the inside of the curled tip, and along the visible underside edge
        for j in range(n // 2, n - 2, 1):
            p0, p1 = pts[j], pts[j + 1]
            tang = (p1 - p0).normalized()
            inward = (-rd * 1.0 + V((0, 0, 0.6))).normalized()
            if j > n - 7:
                inward = (V((0, 0, 0)) - (p0 - (rd * 0.44 * L + V((0, 0, 0.1))))).normalized()
            inward = (inward - tang * inward.dot(tang)).normalized()
            r = rad[j]
            c = p0 + inward * r * 0.85
            s = blob(f"octopus_sucker{k}_{j}", c, (r * 0.45, r * 0.45, r * 0.45), sucker_m, seg=7, ring=4,
                     col=lambda p, n: (1, 1, 1))
            rig.add_chain(s, bones)
        arms.append(bones)
    rig.build()
    dirs = []
    for k in range(8):
        a = (k + 0.5) / 8 * math.pi * 2 - math.pi / 2
        rd = V((math.cos(a), math.sin(a), 0))
        dirs.append((tuple(rd.cross(V((0, 0, 1))) * -1), tuple(rd)))  # (lift axis, radial axis)

    def wiggle(t, amp=1.0, speed=1):
        p = {"mantle": {"scale": 1 + 0.04 * S(t, speed), "rot": [(X, 0.05 * S(t, speed, 0.2))]},
             "head": {"rot": [(Z, 0.08 * S(t, 1, 0.1) * amp)]}}
        for k, bones in enumerate(arms):
            lift, radial = dirs[k]
            for j, b in enumerate(bones):
                p[b] = {"rot": [(lift, amp * 0.12 * S(t, speed, -j * 0.12 + k * 0.13)), (Z, amp * 0.1 * S(t, speed, -j * 0.1 + k * 0.29))]}
        return p

    rig.clip("idle", 96, lambda t: wiggle(t))

    def swim(t):
        p = wiggle(t, 0.5, 2)
        pulse = S(t, 2)
        p["root"] = {"loc": (0, 0, 0.06 + 0.05 * pulse)}
        p["mantle"]["scale"] = 1 + 0.1 * pulse
        p["mantle"]["rot"] = [(X, -0.25)]
        for k, bones in enumerate(arms):
            lift, radial = dirs[k]
            for j, b in enumerate(bones):
                p[b]["rot"].append((lift, -0.22 * pulse * (1 if j < 2 else 0.6) + 0.12))
        return p

    rig.clip("move", 48, swim, step=1)

    def feed(t):
        p = wiggle(t, 0.4)
        e = R.ease_in_out(t)
        for k in (0, 7):  # the two front arms curl up toward the mouth
            lift, radial = dirs[k]
            for j, b in enumerate(arms[k]):
                p[b]["rot"].append((lift, e * (0.35 if j > 0 else 0.25) + 0.08 * S(t, 4) * e))
        p["head"]["rot"].append((X, 0.12 * e))
        return p

    rig.clip("feed", 96, feed)

    def hello(t):
        p = wiggle(t, 0.4)
        e = R.ease_in_out(t)
        k = 7  # front-left (viewer's right) arm waves hello
        lift, radial = dirs[k]
        for j, b in enumerate(arms[k]):
            p[b] = {"rot": [(lift, e * (0.75 if j == 0 else 0.3) * (1 if j < 3 else -0.6)), (radial, e * 0.35 * S(t, 3, -j * 0.08))]}
        p["head"]["rot"] = [(Z, 0.15 * e), (Y, -0.1 * e)]
        return p

    rig.clip("special", 96, hello)
    return rig


SPECIES = {"sloth": sloth, "bighorn": bighorn, "octopus": octopus}

if __name__ == "__main__":
    which = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(SPECIES)
    for name in which:
        C.reset()
        rig = SPECIES[name]()
        rig.export(os.path.abspath(os.path.join(C.OUT, name + ".glb")))
