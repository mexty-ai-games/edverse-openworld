"""The Idea Tree (hub centrepiece) and a background forest tree.

blender --background --factory-startup --python make_tree.py
Writes idea_tree.glb (with empties hook_00.. under the limbs, where lanterns hang) and forest_tree.glb.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402


def build_tree(name, seed, scale=1.0, limbs=5, hooks=True, clump_cards=56, trunk_sides=22, roots=7, leader=True,
               leaf_tint=(1, 1, 1)):
    rng = random.Random(seed)
    s = scale
    bark = C.material(name + "_bark", tex="bark.jpg", normal="bark_n.jpg", rough=0.9, vcol=True, normal_strength=1.4)
    leaf = C.material(name + "_leaves", tex="leaves.png", rough=0.75, alpha_tex=True, double=True)
    core = C.material(name + "_core", color=(0.10 * leaf_tint[0], 0.19 * leaf_tint[1], 0.07 * leaf_tint[2]), rough=0.95)

    bm = bmesh.new()
    # ---- trunk: twisting, flared base with buttress lobes
    tpts, trad = [], []
    lean = Vector((rng.uniform(-.3, .3), rng.uniform(-.3, .3), 0)) * s
    for i in range(16):
        t = i / 15
        z = t * 6.6 * s
        off = lean * (t * t) + Vector((math.sin(t * 3 + seed) * .25, math.cos(t * 2.4 + seed) * .25, 0)) * s
        tpts.append(Vector((0, 0, z - 0.4 * s)) + off)
        trad.append((2.0 - 0.75 * t ** 0.7) * s)

    def flare(i, a):
        k = max(0.0, 1 - i / 4.0)
        return (k ** 2) * s * (0.9 * (0.5 + 0.5 * math.sin(a * 5 + seed)) + 0.3)

    C.tube(bm, tpts, trad, sides=trunk_sides, twist=0.05, noise_amp=0.12, noise_scale=0.7 / s, seed=seed,
           v_scale=1 / (2.6 * s), u_repeat=4.0, flare=flare, cap_end=True)
    top = tpts[-1]

    # ---- roots spreading over the ground
    for r in range(roots):
        a = r / roots * math.pi * 2 + rng.uniform(-.25, .25)
        d = Vector((math.cos(a), math.sin(a), 0))
        p0 = d * 1.0 * s + Vector((0, 0, 1.4 * s))
        p3 = d * rng.uniform(3.6, 5.2) * s + Vector((0, 0, -0.35 * s))
        p1 = d * 2.0 * s + Vector((0, 0, 0.9 * s))
        p2 = d * 3.0 * s + Vector((0, 0, 0.1 * s))
        pts = C.bezier_pts(p0, p1, p2, p3, 9)
        rad = [(0.85 - 0.7 * (i / 9)) * s for i in range(10)]
        C.tube(bm, pts, rad, sides=9, noise_amp=0.18, noise_scale=1.2 / s, seed=seed + r, v_scale=1 / (2.0 * s))

    # ---- limbs, sub-branches, canopy clumps, hooks
    clumps, hook_pts = [], []
    base_a = rng.uniform(0, math.pi * 2)
    for li in range(limbs):
        a = base_a + li / limbs * math.pi * 2 + rng.uniform(-.25, .25)
        d = Vector((math.cos(a), math.sin(a), 0))
        reach = rng.uniform(6.8, 8.6) * s
        p0 = top + Vector((0, 0, -1.6 * s)) + d * 0.3 * s
        p1 = p0 + d * reach * 0.35 + Vector((0, 0, 1.4 * s))
        p2 = p0 + d * reach * 0.7 + Vector((0, 0, 0.9 * s))
        p3 = p0 + d * reach + Vector((0, 0, rng.uniform(3.0, 4.0) * s))
        pts = C.bezier_pts(p0, p1, p2, p3, 14)
        rad = [(0.95 - 0.72 * (i / 14) ** 0.8) * s for i in range(15)]
        C.tube(bm, pts, rad, sides=12, twist=0.04, noise_amp=0.12, noise_scale=1.0 / s, seed=seed + 20 + li,
               v_scale=1 / (2.2 * s), u_repeat=2.0)
        clumps.append((p3 + Vector((0, 0, 1.4 * s)), rng.uniform(2.3, 2.9) * s))
        if hooks:
            for t in (0.3, 0.5, 0.68):
                i = int(t * 14)
                hp = pts[i] - Vector((0, 0, rad[i] * 0.85))
                hook_pts.append(hp)
        # sub-branches
        for sb in range(3):
            t = rng.uniform(0.25, 0.85)
            i = int(t * 14)
            side = d.cross(Vector((0, 0, 1))) * rng.choice((-1, 1))
            q0 = pts[i]
            ln = rng.uniform(3.0, 4.4) * s
            q3 = q0 + side * ln * 0.5 + d * ln * 0.3 + Vector((0, 0, ln * 0.95))
            q1 = q0 + side * ln * 0.2 + Vector((0, 0, ln * 0.3))
            q2 = q0 + side * ln * 0.45 + d * ln * 0.2 + Vector((0, 0, ln * 0.6))
            spts = C.bezier_pts(q0, q1, q2, q3, 7)
            srad = [(rad[i] * 0.55 - (rad[i] * 0.55 - 0.07 * s) * (k / 7)) for k in range(8)]
            C.tube(bm, spts, srad, sides=7, noise_amp=0.1, noise_scale=1.5 / s, seed=seed + 40 + li * 3 + sb,
                   v_scale=1 / (1.6 * s), u_repeat=1.0)
            clumps.append((q3 + Vector((0, 0, 1.0 * s)), rng.uniform(1.8, 2.4) * s))
    if leader:
        q0 = top + Vector((0, 0, -0.6 * s))
        q3 = top + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 5.5)) * s
        lp = C.bezier_pts(q0, q0 + Vector((0, 0, 2 * s)), q3 - Vector((0, 0, 1.5 * s)), q3, 8)
        C.tube(bm, lp, [(0.8 - 0.65 * k / 8) * s for k in range(9)], sides=10, noise_amp=0.1, noise_scale=1 / s,
               seed=seed + 90, v_scale=1 / (2.2 * s))
        clumps.append((q3 + Vector((0, 0, .5 * s)), 3.0 * s))
        clumps.append((top + Vector((0, 0, 4.4 * s)), 3.4 * s))
    # filler clumps between limbs so the crown reads as one mass
    for k in range(limbs * 2):
        a = base_a + (k + 0.5) / (limbs * 2) * math.pi * 2
        r = rng.uniform(3.5, 6.2) * s
        clumps.append((top + Vector((math.cos(a) * r, math.sin(a) * r, rng.uniform(4.2, 5.6) * s)), rng.uniform(2.2, 2.8) * s))

    wood = C.new_obj(name + "_wood", bm, [bark])
    C.shade_smooth(wood)

    def bark_col(p, n):
        ao = min(1.0, 0.55 + 0.45 * min(1.0, max(0.0, (p.z + 0.3) / (3.0 * s))))
        mossn = max(0.0, n.z - 0.35) * 1.6 * (0.5 + 0.5 * C.fbm(p * 0.6, 3))
        mossn = min(1.0, mossn + (0.6 if p.z < 0.4 * s else 0.0) * max(0.0, C.fbm(p * 1.3, 2) + 0.2))
        base = Vector((1.0, 0.97, 0.92)) * ao
        moss = Vector((0.42, 0.62, 0.26)) * ao
        c = base.lerp(moss, min(1.0, mossn))
        return (c.x, c.y, c.z)

    C.paint_vcol(wood, bark_col)

    # canopy: dark core blobs + leaf cards with outward normals
    bmc = bmesh.new()
    for (cpos, cr) in clumps:
        res = bmesh.ops.create_icosphere(bmc, subdivisions=2, radius=cr * 0.72)
        for v in res["verts"]:
            v.co = Vector((v.co.x, v.co.y, v.co.z * 0.8)) + cpos
            v.co += (v.co - cpos).normalized() * C.fbm(v.co * 0.8, 2) * cr * 0.25
    core_ob = C.new_obj(name + "_core", bmc, [core])
    C.shade_smooth(core_ob)

    bml = bmesh.new()
    custom = []
    for (cpos, cr) in clumps:
        C.leaf_clump(bml, cpos, cr, clump_cards, rng, custom)
    bml.verts.index_update()
    normals = {v.index: n for v, n in custom}
    leaves_ob = C.new_obj(name + "_leaves", bml, [leaf])
    C.shade_smooth(leaves_ob)
    C.apply_custom_normals(leaves_ob, normals)

    objs = [wood, core_ob, leaves_ob]
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for o in objs:
        o.parent = root
    for i, hp in enumerate(hook_pts):
        e = bpy.data.objects.new(f"hook_{i:02d}", None)
        e.location = hp
        e.parent = root
        bpy.context.collection.objects.link(e)
    print(name, "tris:", sum(C.tris(o) for o in objs), "hooks:", len(hook_pts))
    return root


if __name__ == "__main__":
    C.reset()
    r = build_tree("idea_tree", seed=7, scale=1.0, limbs=6, clump_cards=60)
    C.export("idea_tree", [r])
    C.reset()
    r = build_tree("forest_tree", seed=3, scale=0.62, limbs=4, hooks=False, clump_cards=40, trunk_sides=12, roots=5,
                   leaf_tint=(0.9, 1.0, 0.9))
    C.export("forest_tree", [r])
