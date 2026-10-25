"""Phase 3 - community garden kit for the Idea Grove.

OW_TEX=<tex> OW_OUT=<glb> blender -b --factory-startup -P make_garden.py [-- names...]
names: bed_empty bed_soil watering_can seed_packets sunflower lavender foxglove clover tomato milkweed
Plants: one .glb per plant with three nodes <plant>_sprout / <plant>_young / <plant>_flowering (origin at
the base of each; laid out along X). Flowering nodes carry an empty child <plant>_visit where a
pollinator lands to feed. bed_soil carries empties plot_0..plot_5 (planting spots).
Real-world sizes: sunflower 1.7 m, foxglove 1.2 m, milkweed 1.0 m, tomato 0.95 m (+stake),
lavender 0.6 m, clover 0.2 m.
"""
import math
import random
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import p345 as P  # noqa: E402
from p345 import C, PI, UP, V, VB, leaf, lerp, mulc  # noqa: E402

G_DARK = (0.2, 0.36, 0.14)
G_MID = (0.32, 0.52, 0.2)
G_LIGHT = (0.5, 0.68, 0.3)
STEM = (0.36, 0.5, 0.22)


def plant_mats():
    return [P.mat("plant_soft", rough=0.65, double=True)]


def empty(name, loc, parent):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.empty_display_size = 0.05
    e.parent = parent
    e.location = V(loc) - parent.location
    return e


def soil_mound(vb, r=0.06, h=0.02):
    P.mound(vb, r, h)


def cotyledons(vb, top, size, col=(0.48, 0.7, 0.28), shape="ovate", n=2, yaw=0.0):
    for k in range(n):
        a = yaw + k * 2 * PI / n
        d = V((math.cos(a), math.sin(a), 0.45)).normalized()
        leaf(vb, top, d, UP, size, size * 0.55, lerp(col, G_MID, 0.4), col, shape=shape, segs=4, cols=1, fold=0.25, droop=0.25)


def stem(vb, pts, r0, r1, col=STEM, sides=7):
    n = len(pts)
    vb.tube(pts, [r0 + (r1 - r0) * i / (n - 1) for i in range(n)], col, sides=sides)


def basis(n):
    n = V(n).normalized()
    t = n.cross(UP)
    if t.length < 1e-3:
        t = V((1, 0, 0))
    t.normalize()
    b = n.cross(t).normalized()
    if b.z < 0:
        t, b = -t, -b
    return n, t, b


def finish(vb, name, mats, ao=None):
    return vb.obj(name, mats, ao=ao)


# =============================================================================== garden beds
def bed_frame(wood, rng):
    objs = []
    L, Wd, H = 1.6, 0.9, 0.36
    th = 0.045
    for k in range(2):  # two stacked boards per side
        z = 0.02 + k * 0.17 + 0.085
        for sy in (-1, 1):
            objs.append(C.box_obj(f"board_l{k}{sy}", (L, th, 0.165), (0, sy * (Wd / 2 - th / 2), z), wood, bevel=0.012, uv_scale=1.2,
                                  noise_amp=0.004, seed=k * 3 + sy))
        for sx in (-1, 1):
            objs.append(C.box_obj(f"board_s{k}{sx}", (th, Wd - 2 * th, 0.165), (sx * (L / 2 - th / 2), 0, z), wood, bevel=0.012,
                                  uv_scale=1.2, noise_amp=0.004, seed=k * 5 + sx))
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(C.box_obj(f"post{sx}{sy}", (0.08, 0.08, 0.42), (sx * (L / 2 + 0.01), sy * (Wd / 2 + 0.01), 0.21), wood, bevel=0.018,
                                  uv_scale=1.2))
            objs.append(C.box_obj(f"postcap{sx}{sy}", (0.095, 0.095, 0.025), (sx * (L / 2 + 0.01), sy * (Wd / 2 + 0.01), 0.43), wood, bevel=0.01,
                                  uv_scale=1.2))
    for sy in (-1, 1):  # middle stake + top rail ledge to sit on
        objs.append(C.box_obj(f"stake{sy}", (0.06, 0.05, 0.34), (0, sy * (Wd / 2 + 0.02), 0.18), wood, bevel=0.012, uv_scale=1.2))
        objs.append(C.box_obj(f"rail{sy}", (L - 0.06, 0.09, 0.03), (0, sy * (Wd / 2 - 0.005), H + 0.005), wood, bevel=0.01, uv_scale=1.2))
    for sx in (-1, 1):
        objs.append(C.box_obj(f"rail_s{sx}", (0.09, Wd - 0.14, 0.03), (sx * (L / 2 - 0.005), 0, H + 0.005), wood, bevel=0.01, uv_scale=1.2))
    # nail heads
    iron = P.mat("bed_iron", tex="brass.jpg", tint=(0.35, 0.33, 0.32), rough=0.5, metal=0.6)
    for sx in (-1, 1):
        for sy in (-1, 1):
            for z in (0.1, 0.27):
                ob = P.VB()
                ob.blob((sx * (L / 2 - 0.004), sy * (Wd / 2 + 0.054), z), (0.007, 0.004, 0.007), (0.5, 0.5, 0.5), seg=6, ring=4)
                objs.append(ob.obj(f"nail{sx}{sy}{z}", [iron]))
    for o in objs:
        if o.data.materials[0] == wood:
            P.paint(o, P.wood_fn((0.95, 0.86, 0.74), seed=hash(o.name) % 50), ao=(0.0, 0.3))
    return objs


def make_bed(filled):
    C.reset()
    rng = random.Random(4)
    wood = P.mat("bed_wood", tex="planks.jpg", normal="planks_n.jpg", rough=0.8)
    soil = P.mat("bed_soil", tex="p_soil.jpg", normal="p_soil_n.jpg", rough=0.95)
    objs = bed_frame(wood, rng)
    L, Wd = 1.6 - 0.09, 0.9 - 0.09
    vb = VB()
    nx, ny = 28, 16
    top = 0.33 if filled else 0.05
    grid = []
    for i in range(nx + 1):
        row = []
        for j in range(ny + 1):
            x = -L / 2 + L * i / nx
            y = -Wd / 2 + Wd * j / ny
            edge = min(i, nx - i, j, ny - j)
            z = top
            if filled:
                fur = math.cos((y / Wd) * PI * 4) * 0.018  # two planting rows (ridges) and furrows
                z += fur * min(1, edge / 2) + C.fbm(V((x * 4, y * 4, 0)), 3) * 0.02
                if edge == 0:
                    z -= 0.015
            else:
                z += C.fbm(V((x * 5, y * 5, 0)), 3) * 0.008
            c = (0.95, 0.9, 0.85) if filled else (0.8, 0.72, 0.66)
            row.append(vb.v((x, y, z), mulc(c, 0.9 + 0.1 * (z - top) / 0.03)))
        grid.append(row)
    for i in range(nx):
        for j in range(ny):
            vb.f((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]),
                 ((i / nx * 2.5, j / ny * 1.4), ((i + 1) / nx * 2.5, j / ny * 1.4), ((i + 1) / nx * 2.5, (j + 1) / ny * 1.4),
                  (i / nx * 2.5, (j + 1) / ny * 1.4)))
    if filled:
        for k in range(26):  # clods
            x, y = rng.uniform(-0.7, 0.7), rng.uniform(-0.38, 0.38)
            s = rng.uniform(0.012, 0.03)
            vb.blob((x, y, top + 0.012), (s, s * 0.9, s * 0.6), (0.85, 0.8, 0.75), seg=7, ring=5, noise=s * 0.6, nscale=40)
    else:
        for k in range(10):  # a few stones on the bare bottom
            x, y = rng.uniform(-0.7, 0.7), rng.uniform(-0.38, 0.38)
            s = rng.uniform(0.015, 0.03)
            vb.blob((x, y, top + 0.005), (s, s * 0.8, s * 0.5), (0.9, 0.85, 0.82), seg=7, ring=5, noise=s * 0.5, nscale=30)
    objs.append(vb.obj("soil", [soil], light=0.15))
    name = "bed_soil" if filled else "bed_empty"
    root = P.join(objs, name)
    if filled:
        k = 0
        for x in (-0.5, 0.0, 0.5):
            for y in (-0.2, 0.2):
                empty(f"plot_{k}", (x, y, 0.35), root)
                k += 1
    P.export("p3_" + name, [root])


# =============================================================================== watering can
def make_watering_can():
    C.reset()
    paint = P.mat("can_paint", tex="sh_paint.jpg", rough=0.42, metal=0.25)
    brass = P.mat("can_brass", tex="brass.jpg", rough=0.35, metal=0.85)
    teal, cream = (0.24, 0.56, 0.52), (0.95, 0.88, 0.7)
    vb = VB()
    prof = [(0.0, 0.0), (0.1, 0.0), (0.112, 0.012), (0.118, 0.06), (0.12, 0.13), (0.114, 0.19), (0.095, 0.225), (0.06, 0.245),
            (0.035, 0.25), (0.0, 0.25)]
    vb.lathe(prof, lambda co: cream if 0.1 < co.z < 0.125 else (mulc(teal, 0.8) if co.z < 0.012 else teal), segs=28, scale=(1, 0.78, 1))
    # fill opening on top (slightly back)
    vb.lathe([(0.045, 0.235), (0.05, 0.27), (0.044, 0.275), (0.036, 0.265), (0.03, 0.25)], teal, segs=16, loc=(0, 0.035, 0), cap=False)
    # spout from the lower front, angled up, with a brass rose
    a, b = V((0, -0.07, 0.05)), V((0, -0.33, 0.27))
    vb.tube(P.curve_pts(a, b, (0, 0.0, -0.02), 6), [0.022, 0.02, 0.018, 0.016, 0.014, 0.013, 0.012], teal, sides=10)
    vb.mi = 1
    d = (b - a).normalized()
    rot = d.to_track_quat("Z", "Y")
    vb.lathe([(0.012, -0.005), (0.018, 0.0), (0.035, 0.045), (0.038, 0.05), (0.0, 0.052)], (1, 1, 1), segs=16, loc=b - d * 0.01, rot=rot)
    vb.mi = 0
    # handles: an arch over the top and a grip down the back
    arch = [V((0, -0.06 + 0.12 * t, 0.24 + math.sin(t * PI) * 0.13)) for t in [i / 8 for i in range(9)]]
    vb.tube(arch, 0.012, teal, sides=8)
    back = [V((0, 0.085 + math.sin(t * PI) * 0.075, 0.06 + 0.15 * t)) for t in [i / 6 for i in range(7)]]
    vb.tube(back, 0.011, teal, sides=8)
    # rivets along the seam
    vb.mi = 1
    for k in range(6):
        vb.blob((0, -0.094, 0.03 + k * 0.035), (0.006, 0.004, 0.006), (1, 1, 1), seg=6, ring=4)
    vb.mi = 0
    ob = vb.obj("watering_can", [paint, brass])
    P.export("p3_watering_can", [ob])


# =============================================================================== seed packets
PLANTS = ["sunflower", "lavender", "foxglove", "clover", "tomato", "milkweed"]


def packet(name, cell, m):
    """A paper packet with a bulge of seeds, crimped top, front face mapped to atlas cell (3x2)."""
    W, Hh, T = 0.09, 0.13, 0.012
    cu, cv = cell % 3, cell // 3
    u0, u1 = cu / 3 + 0.015, (cu + 1) / 3 - 0.015
    v1, v0 = 1 - cv / 2 - 0.01, 1 - (cv + 1) / 2 + 0.01
    vb = VB()
    nx, nz = 6, 8
    for side in (-1, 1):  # front (-Y) and back (+Y)
        rows = []
        for i in range(nx + 1):
            row = []
            for j in range(nz + 1):
                x = -W / 2 + W * i / nx
                z = Hh * j / nz
                bul = (1 - (2 * i / nx - 1) ** 2) * (1 - (2 * j / nz - 1) ** 2)
                bul *= 1 - 0.5 * (j / nz)
                y = side * (T * 0.15 + T * 0.85 * bul)
                row.append(vb.v((x, y, z), (1, 1, 1)))
            rows.append(row)
        for i in range(nx):
            for j in range(nz):
                q = [rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]]
                if side > 0:
                    q = q[::-1]
                if side < 0:
                    uvs = [(u0 + (u1 - u0) * (ii / nx), v0 + (v1 - v0) * (jj / nz)) for ii, jj in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
                else:
                    uvs = [(u0 + 0.01, v1 - 0.005)] * 4
                vb.f(q, uvs)
        if side < 0:
            front = rows
        else:
            backr = rows
    # close the edges (sides and bottom)
    for i in range(nx):
        vb.f((front[i][0], backr[i][0], backr[i + 1][0], front[i + 1][0]), [(u0 + 0.01, v1 - 0.005)] * 4)
    for j in range(nz):
        vb.f((front[0][j + 1], backr[0][j + 1], backr[0][j], front[0][j]), [(u0 + 0.01, v1 - 0.005)] * 4)
        vb.f((front[nx][j], backr[nx][j], backr[nx][j + 1], front[nx][j + 1]), [(u0 + 0.01, v1 - 0.005)] * 4)
    for i in range(nx):
        vb.f((front[i][nz], front[i + 1][nz], backr[i + 1][nz], backr[i][nz]), [(u0 + 0.01, v1 - 0.005)] * 4)
    # crimped top fold
    vb.box((W * 0.98, 0.006, 0.02), (0, 0.0, Hh + 0.006), (0.85, 0.82, 0.76))
    for k in range(9):
        vb.box((0.003, 0.0075, 0.016), (-W / 2 + 0.006 + k * (W - 0.012) / 8, 0, Hh + 0.006), (0.7, 0.66, 0.6))
    ob = vb.obj(name, [m], light=0.12)
    return ob


def make_seed_packets():
    C.reset()
    m = P.mat("packet_paper", tex="p_packets.jpg", rough=0.85)
    objs = [packet(f"packet_{p}", i, m) for i, p in enumerate(PLANTS)]
    P.layout(objs, 0.04)
    P.export("p3_seed_packets", objs)


# =============================================================================== plants
def make_plant(kind):
    C.reset()
    mats = plant_mats()
    extra = {}
    if kind == "sunflower":
        mats.append(P.mat("sunflower_disc", tex="p_sunflower_disc.jpg", rough=0.8))
    fn = globals()["plant_" + kind]
    rng = random.Random(PLANTS.index(kind) + 11)
    objs = []
    for stage in ("sprout", "young", "flowering"):
        vb = VB()
        visit = fn(vb, stage, rng)
        ob = vb.obj(f"{kind}_{stage}", mats)
        if visit is not None:
            extra[ob.name] = visit
        objs.append(ob)
    P.layout(objs, 0.25)
    for ob in objs:
        if ob.name in extra:
            empty(f"{kind}_visit", ob.location + V(extra[ob.name]), ob)
    P.export("p3_plant_" + kind, objs)


def sprout_generic(vb, rng, h, coty, coty_col=(0.5, 0.72, 0.28), true_leaf=None):
    soil_mound(vb, 0.035, 0.012)
    top = V((0.004, -0.003, h))
    stem(vb, P.curve_pts((0, 0, 0.0), top, (0.006, 0, 0), 4), 0.0035 * (h / 0.08) ** 0.5, 0.0025, col=(0.5, 0.62, 0.3))
    cotyledons(vb, top, coty, coty_col, yaw=rng.uniform(0, PI))
    if true_leaf:
        true_leaf(top)


def plant_sunflower(vb, stage, rng):
    if stage == "sprout":
        def tl(top):
            for s in (-1, 1):
                leaf(vb, top + V((0, 0, 0.004)), V((0, s * 0.4, 1)), V((0, -s, 0)), 0.03, 0.022, G_MID, G_LIGHT, shape="heart", segs=4,
                     cols=1, droop=0.1)
        sprout_generic(vb, rng, 0.08, 0.04, true_leaf=tl)
        return None
    tall = 0.62 if stage == "young" else 1.62
    soil_mound(vb, 0.09, 0.025)
    top = V((0.03, 0.02, tall))
    pts = [V((0, 0, 0)), V((0.01, 0, tall * 0.3)), V((0.03, 0.01, tall * 0.7)), top]
    pts = R_smooth(pts, 4)
    stem(vb, pts, 0.016 if stage == "young" else 0.024, 0.008 if stage == "young" else 0.013, sides=9)
    n = 8 if stage == "young" else 13
    for k in range(n):
        t = 0.08 + 0.86 * k / n
        p = sample(pts, t)
        a = k * 2.4 + 0.3
        d = V((math.cos(a), math.sin(a), 0.5 - 0.25 * (1 - t))).normalized()
        L = (0.22 if stage == "young" else 0.32) * (1.1 - 0.55 * t)
        vb.tube([p, p + d * 0.05], [0.004, 0.003], STEM, sides=5, cap=True)
        leaf(vb, p + d * 0.045, d, UP, L, L * 0.72, lerp(G_DARK, G_MID, 0.3), G_MID, shape="heart", segs=8, cols=3, fold=0.18,
             droop=0.45, serr=0.05, rib=0.18, edge=(0.45, 0.6, 0.25))
    if stage == "young":
        vb.blob(top + V((0, 0, 0.02)), (0.028, 0.028, 0.03), G_MID, seg=10, ring=7)
        for k in range(9):
            a = k / 9 * 2 * PI
            d = V((math.cos(a), math.sin(a), 1.4)).normalized()
            leaf(vb, top + V((math.cos(a) * 0.02, math.sin(a) * 0.02, 0.0)), d, -d.cross(V((-math.sin(a), math.cos(a), 0))), 0.05,
                 0.018, G_MID, G_LIGHT, shape="lance", segs=3, cols=1, droop=-0.2)
        return None
    # flower head: nodding toward -Y and slightly down
    nrm, t_, b_ = basis(V((0.15, -1, -0.28)))
    hc = top + V((0.0, -0.06, 0.04))
    vb.tube([top, top + V((0, -0.03, 0.05)), hc + nrm * -0.04], [0.013, 0.012, 0.014], STEM, sides=8)
    R0 = 0.135
    # back of the head: a green cushion
    vb.lathe([(0.0, -0.05), (R0 * 0.5, -0.045), (R0 * 0.95, -0.02), (R0 * 1.02, 0.0)], lerp(G_MID, G_LIGHT, 0.3), segs=20,
             loc=hc, rot=nrm.to_track_quat("Z", "Y"), cap=False)
    # bracts behind the petals
    for k in range(18):
        a = k / 18 * 2 * PI + 0.1
        r = t_ * math.cos(a) + b_ * math.sin(a)
        leaf(vb, hc + r * R0 * 0.8 - nrm * 0.02, (r * 0.8 - nrm * 0.6).normalized(), nrm, 0.05, 0.022, G_MID, G_LIGHT, shape="lance",
             segs=3, cols=1, droop=-0.3)
    # ray petals: two rings
    for ring, (n_, L, tilt, c0, c1) in enumerate(((22, 0.12, 0.12, (0.96, 0.6, 0.06), (1.0, 0.8, 0.2)),
                                                  (20, 0.105, 0.3, (0.92, 0.55, 0.05), (0.98, 0.74, 0.16)))):
        for k in range(n_):
            a = (k + 0.5 * ring) / n_ * 2 * PI + rng.uniform(-0.05, 0.05)
            r = t_ * math.cos(a) + b_ * math.sin(a)
            d = (r - nrm * tilt + nrm * rng.uniform(-0.05, 0.05)).normalized()
            leaf(vb, hc + r * R0 * 0.92 + nrm * (0.012 - 0.006 * ring), d, nrm, L * rng.uniform(0.9, 1.08), 0.034, c0, c1, shape="petal",
                 segs=4, cols=1, fold=0.15, droop=0.12 + ring * 0.1, twist=rng.uniform(-0.2, 0.2), rib=0.0)
    vb.mi = 1
    vb.disc(hc + nrm * 0.01, nrm, R0, (1, 1, 1), dome=0.022, segs=24, rings=4)
    vb.mi = 0
    return hc + nrm * 0.035


def R_smooth(pts, steps):
    from xrig import smooth_pts
    return smooth_pts(pts, steps)


def sample(pts, t):
    f = t * (len(pts) - 1)
    i = min(int(f), len(pts) - 2)
    return pts[i].lerp(pts[i + 1], f - i)


def plant_lavender(vb, stage, rng):
    grey = (0.48, 0.58, 0.42)
    greyl = (0.62, 0.7, 0.55)
    if stage == "sprout":
        def tl(top):
            for s in (-1, 1):
                leaf(vb, top, V((s * 0.2, 0.2, 1)), V((0, 1, 0)), 0.025, 0.006, grey, greyl, shape="lance", segs=3, cols=1, droop=0.1)
        sprout_generic(vb, rng, 0.05, 0.022, coty_col=(0.52, 0.66, 0.36), true_leaf=tl)
        return None
    big = stage == "flowering"
    soil_mound(vb, 0.1, 0.025)
    nst = 22 if big else 14
    R0 = 0.24 if big else 0.15
    H = 0.24 if big else 0.17
    tips = []
    wood = (0.5, 0.48, 0.34)
    for k in range(nst):  # short woody base, then soft grey-green shoots densely clothed in needle leaves
        a = k / nst * 2 * PI + rng.uniform(-0.2, 0.2)
        rr = R0 * rng.uniform(0.5, 1.0)
        tip = V((math.cos(a) * rr, math.sin(a) * rr, H * rng.uniform(0.7, 1.1)))
        pts = P.curve_pts(V((math.cos(a) * 0.01, math.sin(a) * 0.01, 0.01)), tip, V((math.cos(a) * 0.02, math.sin(a) * 0.02, 0.04)), 4)
        vb.tube(pts, [0.005, 0.004, 0.0035, 0.003, 0.002], lambda co: wood if co.z < 0.05 else grey, sides=5)
        for j in range(6):
            p = sample(pts, 0.3 + j * 0.12)
            for s in range(2):
                aa = a + s * 3.1 + j * 1.3
                d = (V((math.cos(aa), math.sin(aa), 1.0 + 0.4 * j / 7)) + (tip - pts[0]).normalized()).normalized()
                leaf(vb, p, d, UP, rng.uniform(0.04, 0.065) * (1 - j * 0.06), 0.0065, grey, greyl, shape="lance", segs=3, cols=1,
                     fold=0.35, droop=0.25)
        tips.append(tip)
    if not big:
        return None
    purple, deep, pale = (0.6, 0.48, 0.86), (0.36, 0.26, 0.62), (0.76, 0.68, 0.94)
    for k in range(15):
        base = tips[k % len(tips)] * 0.8 + V((0, 0, 0.01))
        a = k * 2.4
        top = base + V((math.cos(a) * 0.1, math.sin(a) * 0.1, rng.uniform(0.2, 0.3)))
        vb.tube(P.curve_pts(base, top, V((0, 0, 0)), 3), [0.0028, 0.0024, 0.002, 0.0018], (0.46, 0.56, 0.36), sides=4, cap=False)
        d = (top - base).normalized()
        n_wh = 7
        for i in range(n_wh):  # whorls of tiny florets, gaps lower down, packed at the tip
            t = i / (n_wh - 1)
            zc = top + d * (0.014 + t * 0.075)
            sc = 1.7 - 0.7 * t
            for j in range(3):
                aa = j * 2 * PI / 3 + i * 0.9
                u = V((math.cos(aa), math.sin(aa), 0.35)).normalized()
                vb.blob(zc + u * 0.006 * sc, (0.0055 * sc, 0.0055 * sc, 0.007 * sc), lerp(deep, purple, t) if j % 2 else lerp(purple, pale, t),
                        seg=5, ring=3)
        vb.tube([top, top + d * 0.095], [0.004, 0.002], deep, sides=4)
    return V((0, -0.05, 0.6))


def plant_foxglove(vb, stage, rng):
    soft_g, soft_l = (0.34, 0.5, 0.28), (0.5, 0.64, 0.38)
    if stage == "sprout":
        def tl(top):
            for s in (-1, 1):
                leaf(vb, top, V((s * 0.6, 0.3, 0.8)), UP, 0.035, 0.016, soft_g, soft_l, shape="ovate", segs=4, cols=1, droop=0.2)
        sprout_generic(vb, rng, 0.03, 0.025, true_leaf=tl)
        return None
    soil_mound(vb, 0.1, 0.025)
    n = 11 if stage == "young" else 13
    for k in range(n):  # soft rosette
        a = k * 2.4
        d = V((math.cos(a), math.sin(a), 0.55 - 0.03 * k)).normalized()
        L = 0.2 + 0.1 * rng.random() + (0.04 if stage == "flowering" else 0)
        leaf(vb, V((0, 0, 0.02)), d, UP, L, L * 0.38, soft_g, soft_l, shape="ovate", segs=8, cols=3, fold=0.25, droop=0.5, rib=0.25,
             serr=0.03, edge=(0.42, 0.56, 0.3))
    if stage == "young":
        return None
    pink, pinkl, inside = (0.86, 0.42, 0.7), (0.95, 0.62, 0.82), (0.99, 0.9, 0.94)
    top = V((0.0, 0.01, 1.2))
    pts = R_smooth([V((0, 0, 0.02)), V((0.0, 0.0, 0.5)), V((0.01, 0.0, 0.9)), top], 4)
    stem(vb, pts, 0.015, 0.006, col=(0.42, 0.52, 0.3), sides=8)
    for k in range(5):
        p = sample(pts, 0.1 + 0.07 * k)
        a = k * 2.2
        d = V((math.cos(a), math.sin(a), 0.6)).normalized()
        leaf(vb, p, d, UP, 0.1 - 0.012 * k, 0.03, soft_g, soft_l, shape="lance", segs=4, cols=1, droop=0.3)
    nb = 26
    for k in range(nb):
        t = 0.42 + 0.53 * k / nb
        p = sample(pts, t)
        a = -PI / 2 + (k % 3 - 1) * 0.85 + rng.uniform(-0.15, 0.15)  # bells mostly on one side (-Y)
        out = V((math.cos(a), math.sin(a), 0))
        sc = 1.45 - 0.75 * (k / nb)
        vb.tube([p, p + out * 0.02 * sc + V((0, 0, -0.005))], [0.0022, 0.0018], (0.42, 0.52, 0.3), sides=4, cap=False)
        base = p + out * 0.02 * sc
        d = (out * 0.75 + V((0, 0, -0.65))).normalized()
        L = 0.05 * sc

        def bcol(co, base=base, d=d, L=L):
            h = (co - base).dot(d) / L
            return lerp(pink, inside, max(0.0, (h - 0.82) * 5)) if h > 0.5 else lerp(pinkl, pink, h * 2)
        prof = [(0.004 * sc, 0.0), (0.011 * sc, 0.008 * sc), (0.014 * sc, 0.025 * sc), (0.017 * sc, 0.042 * sc), (0.022 * sc, L),
                (0.019 * sc, L + 0.002), (0.012 * sc, L - 0.008)]
        vb.lathe(prof, bcol, segs=10, loc=base, rot=d.to_track_quat("Z", "Y"), cap=True)
    for k in range(6):  # buds at the tip
        p = sample(pts, 0.95 + k * 0.009)
        s = 0.008 * (1 - k * 0.12)
        vb.blob(p + V((0, -0.01, 0)), (s, s, s * 1.4), lerp((0.55, 0.62, 0.36), pink, 0.4 - k * 0.06), seg=8, ring=6)
    return sample(pts, 0.7) + V((0, -0.06, -0.02))


def trifoliate(vb, base, tip, size, rng, chev=True):
    vb.tube([base, (base + tip) / 2 + V((0, 0, 0.01)), tip], [0.0016, 0.0014, 0.0012], (0.45, 0.6, 0.3), sides=4, cap=False)
    yaw = rng.uniform(0, 2 * PI)
    for k in range(3):
        a = yaw + k * 2 * PI / 3
        d = V((math.cos(a), math.sin(a), 0.25)).normalized()
        sp = (lambda t, u: (0.78, 0.86, 0.66) if 0.35 < t < 0.6 and abs(u) > 0.4 else None) if chev else None
        leaf(vb, tip, d, UP, size, size * 0.9, (0.22, 0.46, 0.18), (0.34, 0.58, 0.24), shape="heart", segs=4, cols=2, fold=-0.12,
             droop=-0.05, spots=sp)


def plant_clover(vb, stage, rng):
    if stage == "sprout":
        def tl(top):
            trifoliate(vb, top, top + V((0.004, 0, 0.012)), 0.01, rng, chev=False)
        sprout_generic(vb, rng, 0.025, 0.01, coty_col=(0.45, 0.66, 0.3), true_leaf=tl)
        return None
    soil_mound(vb, 0.12, 0.012)
    n = 26 if stage == "young" else 44
    spread = 0.12 if stage == "young" else 0.17
    for k in range(n):
        r = spread * math.sqrt(rng.random())
        a = rng.uniform(0, 2 * PI)
        base = V((math.cos(a) * r * 0.5, math.sin(a) * r * 0.5, 0.005))
        tip = V((math.cos(a) * r, math.sin(a) * r, rng.uniform(0.025, 0.065)))
        trifoliate(vb, base, tip, rng.uniform(0.018, 0.026), rng)
    if stage == "young":
        return None
    head0 = None
    for k in range(7):
        a = k * 0.9 + 0.4
        r = 0.04 + 0.06 * (k % 3) / 2
        base = V((math.cos(a) * r * 0.5, math.sin(a) * r * 0.5, 0.005))
        hc = V((math.cos(a) * r, math.sin(a) * r, rng.uniform(0.1, 0.14)))
        vb.tube(P.curve_pts(base, hc, V((0, 0, 0)), 3), [0.0018, 0.0016, 0.0015, 0.0014], (0.45, 0.6, 0.3), sides=4, cap=False)
        vb.blob(hc, (0.012, 0.012, 0.012), lambda u: (0.98, 0.94, 0.92) if u.z > -0.3 else (0.86, 0.66, 0.6), seg=10, ring=8)
        for j in range(24):  # florets: rounded petals, white on top, blush-pink and tan underneath
            u = V((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1) + 0.2)).normalized()
            low = u.z < -0.2
            vb.blob(hc + u * 0.012, (0.0035, 0.0035, 0.006), (0.9, 0.7, 0.66) if low else lerp((0.98, 0.86, 0.9), (1, 1, 0.98), u.z),
                    seg=5, ring=3, rot=u.to_track_quat("Z", "Y").to_matrix())
        if head0 is None:
            head0 = hc
    return head0 + V((0, 0, 0.01))


def compound_leaf(vb, base, d, L, rng, dark=(0.18, 0.38, 0.14), light=(0.3, 0.52, 0.2)):
    d = d.normalized()
    pts = [base + d * L * t + V((0, 0, -0.25 * L * t * t)) for t in (0, 0.33, 0.66, 1.0)]
    vb.tube(pts, [0.003, 0.0026, 0.002, 0.0015], (0.34, 0.5, 0.22), sides=4, cap=False)
    side = d.cross(UP).normalized()
    for k, t in enumerate((0.3, 0.55, 0.8)):
        p = sample(pts, t)
        for s in (-1, 1):
            dd = (d * 0.6 + side * s).normalized()
            leaf(vb, p, dd, UP, L * (0.48 - 0.06 * k), L * 0.26, dark, light, shape="ovate", segs=5, cols=2, fold=0.2, droop=0.3,
                 serr=0.14)
    leaf(vb, pts[-1], d, UP, L * 0.46, L * 0.26, dark, light, shape="ovate", segs=5, cols=2, fold=0.2, droop=0.3, serr=0.14)


def plant_tomato(vb, stage, rng):
    if stage == "sprout":
        def tl(top):
            compound_leaf(vb, top + V((0, 0, 0.005)), V((0.2, 0.3, 1)), 0.03, rng)
        sprout_generic(vb, rng, 0.06, 0.04, coty_col=(0.46, 0.66, 0.28), true_leaf=tl)
        return None
    big = stage == "flowering"
    soil_mound(vb, 0.1, 0.025)
    H = 0.88 if big else 0.4
    top = V((0.02, 0.0, H))
    pts = R_smooth([V((0, 0, 0)), V((0.02, 0.0, H * 0.4)), V((-0.01, 0.01, H * 0.75)), top], 4)
    stem(vb, pts, 0.012 if big else 0.008, 0.005, col=(0.38, 0.52, 0.24), sides=7)
    n = 10 if big else 6
    for k in range(n):
        t = 0.12 + 0.85 * k / n
        p = sample(pts, t)
        a = k * 2.5
        d = V((math.cos(a), math.sin(a), 0.5))
        compound_leaf(vb, p, d, (0.26 if big else 0.19) * (1.1 - 0.4 * t), rng)
    if not big:
        return None
    wood = (0.7, 0.55, 0.38)
    vb.box((0.022, 0.022, 1.05), (0.07, 0.03, 0.5), wood)
    vb.lathe([(0.0, 1.02), (0.013, 1.02), (0.0, 1.045)], wood, segs=6, loc=(0.07, 0.03, 0))
    for z in (0.3, 0.6, 0.85):  # twine ties
        p = sample(pts, z / H)
        vb.tube([p + V((0, -0.01, 0)), V((0.07, 0.03, z)) + V((0.0, -0.014, 0)), V((0.07, 0.03, z)) + V((0.014, 0.0, 0)),
                 V((0.07, 0.03, z)) + V((0.0, 0.014, 0)), p + V((0, 0.01, 0))], 0.0025, (0.86, 0.74, 0.5), sides=4)
    yellow = (1.0, 0.82, 0.18)
    visit = None
    for k, t in enumerate((0.55, 0.75, 0.93)):  # flower trusses
        p = sample(pts, t)
        a = -PI / 2 + (k - 1) * 0.9
        out = V((math.cos(a), math.sin(a), 0))
        tip = p + out * 0.07 + V((0, 0, -0.02))
        vb.tube([p, p + out * 0.04 + V((0, 0, 0.01)), tip], 0.002, (0.38, 0.52, 0.24), sides=4)
        for j in range(4):
            fc = tip + V((math.cos(j * 1.6) * 0.022, math.sin(j * 1.6) * 0.022, -0.012 - 0.01 * (j % 2)))
            vb.tube([tip, fc], 0.0012, (0.38, 0.52, 0.24), sides=3, cap=False)
            vb.blob(fc, (0.004, 0.004, 0.005), (0.95, 0.7, 0.15), seg=6, ring=4)
            for pp in range(5):
                aa = pp / 5 * 2 * PI
                dd = V((math.cos(aa), math.sin(aa), -0.9)).normalized()
                leaf(vb, fc, dd, -UP, 0.014, 0.0055, yellow, (1.0, 0.92, 0.45), shape="lance", segs=2, cols=1, droop=-0.3, rib=0.0)
            if visit is None:
                visit = fc + V((0, -0.01, 0.0))
    for k, t in enumerate((0.3, 0.45)):  # fruit trusses: green, orange, red
        p = sample(pts, t)
        a = PI / 2 + k * 1.4 - 0.4
        out = V((math.cos(a), math.sin(a), 0))
        tip = p + out * 0.06
        vb.tube([p, tip], 0.0025, (0.38, 0.52, 0.24), sides=4)
        for j, c in enumerate(((0.86, 0.16, 0.1), (0.95, 0.42, 0.12), (0.5, 0.7, 0.24))):
            fc = tip + V((math.cos(j * 2.1) * 0.028, math.sin(j * 2.1) * 0.028, -0.04 - 0.01 * j))
            s = 0.026 - j * 0.004
            vb.tube([tip, fc + V((0, 0, s * 0.8))], 0.0015, (0.38, 0.52, 0.24), sides=3, cap=False)
            vb.blob(fc, (s, s, s * 0.85), c, seg=14, ring=9, fn=lambda u: V((0, 0, -0.002 * abs(math.sin(math.atan2(u.y, u.x) * 3)))))
            for pp in range(5):
                aa = pp / 5 * 2 * PI
                leaf(vb, fc + V((0, 0, s * 0.8)), V((math.cos(aa), math.sin(aa), 0.2)), UP, 0.012, 0.003, (0.28, 0.5, 0.2),
                     (0.36, 0.6, 0.26), shape="lance", segs=2, cols=1, droop=0.3)
    return visit


def plant_milkweed(vb, stage, rng):
    bg, bl = (0.3, 0.48, 0.32), (0.44, 0.6, 0.42)
    if stage == "sprout":
        def tl(top):
            for s in (-1, 1):
                leaf(vb, top + V((0, 0, 0.006)), V((s, 0.2, 0.7)), UP, 0.03, 0.016, bg, bl, shape="ovate", segs=4, cols=1, droop=0.15,
                     rib=0.3)
        sprout_generic(vb, rng, 0.06, 0.026, true_leaf=tl)
        return None
    big = stage == "flowering"
    soil_mound(vb, 0.09, 0.025)
    H = 0.98 if big else 0.5
    top = V((0.01, 0.0, H))
    pts = R_smooth([V((0, 0, 0)), V((0.01, 0.0, H * 0.5)), top], 4)
    stem(vb, pts, 0.011 if big else 0.008, 0.005, col=(0.42, 0.5, 0.34), sides=7)
    pairs = 7 if big else 4
    for k in range(pairs):  # opposite broad leaves, each pair turned 90 degrees
        t = 0.15 + 0.8 * k / pairs
        p = sample(pts, t)
        a = k * PI / 2 + 0.3
        for s in (-1, 1):
            d = V((math.cos(a) * s, math.sin(a) * s, 0.35))
            L = (0.17 if big else 0.13) * (1.05 - 0.35 * t)
            leaf(vb, p, d, UP, L, L * 0.48, bg, bl, shape="ovate", segs=7, cols=3, fold=0.2, droop=0.35, rib=0.4, edge=(0.4, 0.55, 0.38))
    if not big:
        return None
    pink, pinkd, crown = (0.92, 0.6, 0.72), (0.74, 0.38, 0.52), (0.98, 0.84, 0.9)
    umbels = [(top + V((0, 0, 0.02)), V((0, 0, 1)), 1.0), (sample(pts, 0.8), V((0.6, -0.6, 0.4)), 0.8), (sample(pts, 0.66), V((-0.6, 0.5, 0.4)), 0.75)]
    visit = None
    for k, (p, d, sc) in enumerate(umbels):
        d = d.normalized()
        hub = p + d * 0.05 * sc
        vb.tube([p, hub], 0.003, (0.42, 0.5, 0.34), sides=4)
        nflo = 30
        for j in range(nflo):
            u = V((rng.gauss(0, 1), rng.gauss(0, 1), abs(rng.gauss(0, 1)) + 0.4)).normalized()
            u = (Matrix.Rotation(0, 3, "X") @ u)
            q = d.to_track_quat("Z", "Y")
            u = q @ u
            fc = hub + u * 0.06 * sc
            vb.tube([hub, fc], 0.0011, (0.55, 0.5, 0.42), sides=3, cap=False)
            vb.blob(fc, (0.009 * sc, 0.009 * sc, 0.008 * sc), lambda uu: pinkd if uu.dot(V((0, 0, -1))) > 0.3 else pink, seg=7, ring=5,
                    rot=u.to_track_quat("Z", "Y").to_matrix(), fn=lambda uu: V((0, 0, -0.003 * max(0, -uu.z))))
            vb.blob(fc + u * 0.008 * sc, (0.0055 * sc, 0.0055 * sc, 0.0045 * sc), crown, seg=6, ring=4, rot=u.to_track_quat("Z", "Y").to_matrix())
        if k == 0:
            visit = hub + d * 0.06
    return visit


NAMES = {"bed_empty": lambda: make_bed(False), "bed_soil": lambda: make_bed(True), "watering_can": make_watering_can,
         "seed_packets": make_seed_packets}
for _p in PLANTS:
    NAMES[_p] = (lambda k: (lambda: make_plant(k)))(_p)

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for n in (argv or list(NAMES)):
        NAMES[n]()
