# EdVerse OpenWorld v2 concept frames: one fjord coast, rendered in several universes.
# blender -b --factory-startup -P scene.py -- <universe> <out.png> [width] [samples]
import bpy, bmesh, math, sys, random
import numpy as np
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
UNI = argv[0] if argv else "prime"
OUT = argv[1] if len(argv) > 1 else "/tmp/out.png"
WIDTH = int(argv[2]) if len(argv) > 2 else 1600
SAMPLES = int(argv[3]) if len(argv) > 3 else 96
PORTAL = argv[4] if len(argv) > 4 else ""

U = {
    "prime": dict(sea=0.0, mtn=1.0, snow=95, grass=(0.16, 0.22, 0.07), rock=(0.20, 0.18, 0.16), sun_el=7, sun_rot=166,
                  air=1.0, dust=1.2, ozone=1.0, fog=(0.62, 0.70, 0.78), fog_amt=0.55, trees=110000, tree_h=1.0, tree_w=1.0,
                  tree_c=(0.025, 0.06, 0.03), lighthouse=True, glacier=False, dead=False, lift=(1, 1, 1), gain=(1.0, 1.0, 1.0), gamma=(1, 1, 1)),
    "glacial": dict(sea=-16.0, mtn=1.0, snow=22, grass=(0.20, 0.18, 0.11), rock=(0.22, 0.22, 0.23), sun_el=6, sun_rot=180,
                    air=1.0, dust=0.4, ozone=1.6, fog=(0.72, 0.80, 0.90), fog_amt=0.7, trees=2500, tree_h=0.45, tree_w=1.0,
                    tree_c=(0.04, 0.06, 0.04), lighthouse=False, glacier=True, dead=False, lift=(0.98, 1.0, 1.04), gain=(0.95, 1.0, 1.08), gamma=(1, 1, 1.03)),
    "drowned": dict(sea=9.0, mtn=1.0, snow=400, grass=(0.24, 0.22, 0.08), rock=(0.22, 0.18, 0.14), sun_el=4, sun_rot=168,
                    air=1.6, dust=7.0, ozone=0.6, fog=(0.85, 0.66, 0.48), fog_amt=0.85, trees=60000, tree_h=0.9, tree_w=1.0,
                    tree_c=(0.035, 0.05, 0.025), lighthouse=True, glacier=False, dead=True, lift=(1.03, 1.0, 0.96), gain=(1.08, 1.0, 0.9), gamma=(1, 1, 1)),
    "halfg": dict(sea=0.0, mtn=1.75, snow=170, grass=(0.07, 0.17, 0.13), rock=(0.15, 0.14, 0.18), sun_el=3, sun_rot=176,
                  air=2.2, dust=2.0, ozone=3.5, fog=(0.50, 0.46, 0.70), fog_amt=0.6, trees=90000, tree_h=2.3, tree_w=0.6,
                  tree_c=(0.02, 0.06, 0.05), lighthouse=True, glacier=False, dead=False, lift=(1.0, 0.97, 1.06), gain=(1.0, 0.92, 1.12), gamma=(1, 1, 1)),
}[UNI]

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
random.seed(7)

# ---------------------------------------------------------------- terrain height
def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

def ridged(x, y, octaves=7):
    s, amp, f, tot = 0.0, 1.0, 1.0, 0.0
    for i in range(octaves):
        n = noise.noise(Vector((x * f + 13.1 * i, y * f - 7.7 * i, 0.37 * i)), noise_basis="PERLIN_ORIGINAL")
        r = 1.0 - abs(n)
        s += r * r * amp
        tot += amp
        amp *= 0.5
        f *= 2.03
    return s / tot

def fbm(x, y, octaves=5):
    return noise.fractal(Vector((x, y, 0.5)), 1.0, 2.0, octaves, noise_basis="PERLIN_ORIGINAL")

def xcenter(y):
    return 22 * math.sin(y / 95.0) + 9 * math.sin(y / 33.0 + 1.0)

CLIFF = (-150.0, 30.0)
ISLET = (-112.0, 165.0)

def height(x, y):
    d = abs(x - xcenter(y))
    w = 165 + max(y, 0) * 0.08
    dd_ = d + fbm(x / 70, y / 70) * 45
    shelf = smooth(w - 20, w + 25, dd_) * (30 + fbm(x / 35, y / 35, 4) * 10)
    t = smooth(w + 70, w + 320 + max(y, 0) * 0.15, dd_)
    far = 0.55 + min(max(y, 0) / 520.0, 1.6)
    r = ridged(x / 210.0, y / 210.0)
    h = -22 + shelf + t * ((50 + 230 * far * r) * U["mtn"] * t)
    h += fbm(x / 25, y / 25, 4) * 2.5 * (0.3 + t)
    # foreground headland with a flat top for the tuning circle
    rr = math.hypot(x - CLIFF[0], y - CLIFF[1]) + fbm(x / 14, y / 14, 3) * 5
    plateau = 38 + fbm(x / 30, y / 30, 3) * 1.2 - max(0, rr - 24) ** 1.35 * 1.6
    # the promontory continues inland behind the camera
    if x < CLIFF[0] and y < CLIFF[1] + 10:
        plateau = max(plateau, 38 + fbm(x / 30, y / 30, 3) * 1.2 - max(0, (y - CLIFF[1] - 10)) * 3)
    ri = math.hypot(x - ISLET[0], y - ISLET[1]) + fbm(x / 9, y / 9, 3) * 4
    islet = 4.5 + fbm(x / 7, y / 7, 3) * 1.2 - max(0, ri - 9) * 0.9
    return max(h, plateau, islet)

# ---------------------------------------------------------------- terrain mesh
NX, NY = 640, 760
X0, X1, Y0, Y1 = -650.0, 650.0, -150.0, 1900.0
bpy.ops.mesh.primitive_grid_add(x_subdivisions=NX, y_subdivisions=NY, size=1)
terrain = bpy.context.object
terrain.name = "terrain"
me = terrain.data
n = len(me.vertices)
co = np.empty(n * 3, dtype=np.float32)
me.vertices.foreach_get("co", co)
co = co.reshape(-1, 3)
# warp the grid so density is higher close to camera
u = co[:, 0] + 0.5
v = co[:, 1] + 0.5
xs = X0 + u * (X1 - X0)
ys = Y0 + (v ** 1.6) * (Y1 - Y0)
zs = np.array([height(float(a), float(b)) for a, b in zip(xs, ys)], dtype=np.float32)
co[:, 0], co[:, 1], co[:, 2] = xs, ys, zs
me.vertices.foreach_set("co", co.ravel())
me.update()
for p in me.polygons:
    p.use_smooth = True

# tree density weights
normals = np.empty(n * 3, dtype=np.float32)
me.vertices.foreach_get("normal", normals)
nz = normals.reshape(-1, 3)[:, 2]
vg = terrain.vertex_groups.new(name="trees")
sea = U["sea"]
treeline = 160 if UNI != "glacial" else 18
for i in range(n):
    z = zs[i]
    x, y = xs[i], ys[i]
    if z < sea + 2.5 or z > treeline * (1.4 if UNI == "halfg" else 1.0):
        continue
    if math.hypot(x - CLIFF[0], (y - CLIFF[1]) * 0.8) < 30:
        continue
    slope = smooth(0.45, 0.75, nz[i])
    clump = smooth(-0.35, 0.15, fbm(x / 40, y / 40, 3))
    wv = slope * clump * (1 - smooth(treeline * 0.7, treeline, z))
    if wv > 0.02:
        vg.add([i], float(wv), "REPLACE")

vgn = terrain.vertex_groups.new(name="near")
CAMXY = (CLIFF[0] - 22, CLIFF[1] - 30)
for i in range(n):
    dd = math.hypot(xs[i] - CAMXY[0], ys[i] - CAMXY[1])
    if dd < 75 and zs[i] > 30 and nz[i] > 0.8:
        g = (1 - smooth(40, 75, dd)) * smooth(-0.3, 0.2, fbm(xs[i] / 6, ys[i] / 6, 3))
        if math.hypot(xs[i] - CLIFF[0], ys[i] - CLIFF[1]) < 5.5 or math.hypot(xs[i] - (CLIFF[0] - 8.2), ys[i] - (CLIFF[1] - 13.2)) < 1.6:
            g *= 0.15
        if g > 0.02:
            vgn.add([i], float(g), "REPLACE")

# ---------------------------------------------------------------- materials
def mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree.nodes, m.node_tree.links

def terrain_mat():
    m, N, L = mat("terrain")
    bsdf = N["Principled BSDF"]
    geo = N.new("ShaderNodeNewGeometry")
    sep = N.new("ShaderNodeSeparateXYZ")
    L.new(geo.outputs["Position"], sep.inputs[0])
    nsep = N.new("ShaderNodeSeparateXYZ")
    L.new(geo.outputs["Normal"], nsep.inputs[0])
    tc = N.new("ShaderNodeTexCoord")
    nz_ = N.new("ShaderNodeTexNoise"); nz_.inputs["Scale"].default_value = 0.08; nz_.inputs["Detail"].default_value = 8
    L.new(tc.outputs["Object"], nz_.inputs["Vector"])
    vor = N.new("ShaderNodeTexNoise"); vor.inputs["Scale"].default_value = 0.9; vor.inputs["Detail"].default_value = 14; vor.inputs["Roughness"].default_value = 0.65
    L.new(tc.outputs["Object"], vor.inputs["Vector"])
    strata = N.new("ShaderNodeTexWave"); strata.wave_type = "BANDS"; strata.bands_direction = "Z"
    strata.inputs["Scale"].default_value = 0.03; strata.inputs["Distortion"].default_value = 18; strata.inputs["Detail"].default_value = 6
    L.new(tc.outputs["Object"], strata.inputs["Vector"])
    # rock colour with variation
    rock = N.new("ShaderNodeValToRGB")
    rock.color_ramp.elements[0].color = (*[c * 0.55 for c in U["rock"]], 1)
    rock.color_ramp.elements[1].color = (*[min(1, c * 1.6) for c in U["rock"]], 1)
    rk = N.new("ShaderNodeMix"); rk.data_type = "FLOAT"; rk.inputs[0].default_value = 0.25
    L.new(nz_.outputs["Fac"], rk.inputs[2]); L.new(vor.outputs["Fac"], rk.inputs[3])
    L.new(rk.outputs[0], rock.inputs[0])
    grass = N.new("ShaderNodeValToRGB")
    grass.color_ramp.elements[0].color = (*[c * 0.6 for c in U["grass"]], 1)
    grass.color_ramp.elements[1].color = (*[min(1, c * 1.5) for c in U["grass"]], 1)
    L.new(nz_.outputs["Fac"], grass.inputs[0])
    # slope mask: flat = grass
    slope = N.new("ShaderNodeMapRange")
    slope.inputs["From Min"].default_value = 0.78; slope.inputs["From Max"].default_value = 0.9
    L.new(nsep.outputs["Z"], slope.inputs["Value"])
    nmix = N.new("ShaderNodeMath"); nmix.operation = "ADD"
    L.new(slope.outputs["Result"], nmix.inputs[0])
    nn = N.new("ShaderNodeMath"); nn.operation = "MULTIPLY"; nn.inputs[1].default_value = 0.35
    L.new(nz_.outputs["Fac"], nn.inputs[0]); L.new(nn.outputs[0], nmix.inputs[1])
    gmask = N.new("ShaderNodeMapRange"); gmask.inputs["From Min"].default_value = 0.6; gmask.inputs["From Max"].default_value = 1.0
    L.new(nmix.outputs[0], gmask.inputs["Value"])
    mix1 = N.new("ShaderNodeMix"); mix1.data_type = "RGBA"
    L.new(gmask.outputs["Result"], mix1.inputs["Factor"])
    L.new(rock.outputs["Color"], mix1.inputs[6]); L.new(grass.outputs["Color"], mix1.inputs[7])
    # wet shore / sea bed below sea level + 1.5
    shore = N.new("ShaderNodeMapRange")
    shore.inputs["From Min"].default_value = sea + 0.3; shore.inputs["From Max"].default_value = sea + 2.2
    L.new(sep.outputs["Z"], shore.inputs["Value"])
    mix2 = N.new("ShaderNodeMix"); mix2.data_type = "RGBA"
    L.new(shore.outputs["Result"], mix2.inputs["Factor"])
    mix2.inputs[6].default_value = (0.09, 0.08, 0.065, 1)
    L.new(mix1.outputs[2], mix2.inputs[7])
    # snow: above snow line, on gentler slopes
    sh = N.new("ShaderNodeMapRange")
    sh.inputs["From Min"].default_value = U["snow"] - 12; sh.inputs["From Max"].default_value = U["snow"] + 12
    L.new(sep.outputs["Z"], sh.inputs["Value"])
    ss = N.new("ShaderNodeMapRange"); ss.inputs["From Min"].default_value = 0.55; ss.inputs["From Max"].default_value = 0.75
    L.new(nsep.outputs["Z"], ss.inputs["Value"])
    sm = N.new("ShaderNodeMath"); sm.operation = "MULTIPLY"; sm.use_clamp = True
    L.new(sh.outputs["Result"], sm.inputs[0]); L.new(ss.outputs["Result"], sm.inputs[1])
    mix3 = N.new("ShaderNodeMix"); mix3.data_type = "RGBA"
    L.new(sm.outputs[0], mix3.inputs["Factor"])
    L.new(mix2.outputs[2], mix3.inputs[6]); mix3.inputs[7].default_value = (0.82, 0.86, 0.92, 1)
    L.new(mix3.outputs[2], bsdf.inputs["Base Color"])
    rough = N.new("ShaderNodeMix"); rough.data_type = "FLOAT"
    L.new(shore.outputs["Result"], rough.inputs["Factor"]); rough.inputs[2].default_value = 0.25; rough.inputs[3].default_value = 0.9
    L.new(rough.outputs[0], bsdf.inputs["Roughness"])
    bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.8; bump.inputs["Distance"].default_value = 0.6
    bh = N.new("ShaderNodeMath"); bh.operation = "ADD"
    L.new(vor.outputs["Fac"], bh.inputs[0]); L.new(strata.outputs["Fac"], bh.inputs[1])
    L.new(bh.outputs[0], bump.inputs["Height"])
    L.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m

terrain.data.materials.append(terrain_mat())

def simple(name, color, rough=0.6, emit=None, strength=0.0, alpha=1.0, sss=0.0, trans=0.0):
    m, N, L = mat(name)
    b = N["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
    if sss:
        b.inputs["Subsurface Weight"].default_value = sss
    if trans:
        b.inputs["Transmission Weight"].default_value = trans
    return m

# ---------------------------------------------------------------- water
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 650, sea))
water = bpy.context.object
water.scale = (900, 1800, 1)
wm, N, L = mat("water")
b = N["Principled BSDF"]
b.inputs["Base Color"].default_value = (0.006, 0.02, 0.025, 1)
b.inputs["Roughness"].default_value = 0.035
b.inputs["IOR"].default_value = 1.33
tc = N.new("ShaderNodeTexCoord")
mp = N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1.0, 2.6, 1.0)
L.new(tc.outputs["Object"], mp.inputs["Vector"])
wv = N.new("ShaderNodeTexNoise"); wv.inputs["Scale"].default_value = 260; wv.inputs["Detail"].default_value = 6; wv.inputs["Roughness"].default_value = 0.6
L.new(mp.outputs[0], wv.inputs["Vector"])
bp = N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.12
L.new(wv.outputs["Fac"], bp.inputs["Height"]); L.new(bp.outputs["Normal"], b.inputs["Normal"])
water.data.materials.append(wm)

# ---------------------------------------------------------------- glacier (Last Glacial Maximum)
if U["glacier"]:
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=120, y_subdivisions=200, size=1)
    ice = bpy.context.object
    ic = np.empty(len(ice.data.vertices) * 3, dtype=np.float32)
    ice.data.vertices.foreach_get("co", ic)
    ic = ic.reshape(-1, 3)
    ix = -260 + (ic[:, 0] + 0.5) * 520
    iy = 230 + (ic[:, 1] + 0.5) * 1250
    iz = np.array([14 + (b_ - 230) * 0.075 + fbm(a / 30, b_ / 30, 4) * 2.2 + abs(a - xcenter(b_)) * 0.05 for a, b_ in zip(ix, iy)], dtype=np.float32)
    ic[:, 0], ic[:, 1], ic[:, 2] = ix, iy, iz
    ice.data.vertices.foreach_set("co", ic.ravel())
    ice.data.update()
    sol = ice.modifiers.new("solid", "SOLIDIFY"); sol.thickness = 45; sol.offset = -1
    im, N, L = mat("ice")
    b = N["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.78, 0.87, 0.95, 1)
    b.inputs["Subsurface Weight"].default_value = 0.4
    b.inputs["Subsurface Radius"].default_value = (2.0, 4.0, 8.0)
    b.inputs["Roughness"].default_value = 0.35
    cr = N.new("ShaderNodeTexWave"); cr.inputs["Scale"].default_value = 0.4; cr.inputs["Distortion"].default_value = 6
    bp = N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.4
    L.new(cr.outputs["Fac"], bp.inputs["Height"]); L.new(bp.outputs["Normal"], b.inputs["Normal"])
    ice.data.materials.append(im)
    for p in ice.data.polygons:
        p.use_smooth = True

# ---------------------------------------------------------------- trees
def cone_tree(name, levels=7):
    bm = bmesh.new()
    h = 0.0
    trunk = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.35, radius2=0.2, depth=3.0)
    bmesh.ops.translate(bm, vec=(0, 0, 1.5), verts=trunk["verts"])
    for i in range(levels):
        r = 2.6 * (1 - i / levels) + 0.35
        d = 3.2 * (1 - i / (levels * 1.4))
        z = 2.0 + i * 1.45
        c = bmesh.ops.create_cone(bm, cap_ends=True, segments=11, radius1=r, radius2=0.05, depth=d)
        bmesh.ops.rotate(bm, verts=c["verts"], cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(random.random() * 6.28, 3, "Z"))
        bmesh.ops.translate(bm, vec=(0, 0, z + d / 2), verts=c["verts"])
    for v in bm.verts:
        if v.co.z > 2.2:
            k = 0.35 * (noise.noise(v.co * 0.9) + 0.4 * noise.noise(v.co * 3.1))
            v.co.x += k
            v.co.y += k * 0.7
    me_ = bpy.data.meshes.new(name)
    bm.to_mesh(me_)
    ob = bpy.data.objects.new(name, me_)
    tm = simple("needles", U["tree_c"], rough=0.8, sss=0.1)
    ob.data.materials.append(tm)
    for p in ob.data.polygons:
        p.use_smooth = False
    return ob

from mathutils import Matrix
def x_up(ob, sx=1.0, sz=1.0):
    ob.data.transform(Matrix.Diagonal((sx, sx, sz, 1)))
    ob.data.update()

coll = bpy.data.collections.new("trees")
scn.collection.children.link(coll)
for k in range(3):
    t = cone_tree("tree%d" % k, levels=6 + k)
    x_up(t, U["tree_w"], U["tree_h"])
    coll.objects.link(t)
    t.location = (0, 0, -500)
coll.hide_render = False

def scatter(obj, name, group, collection, density, smin, smax, seed):
    """Geometry Nodes: upright instances of a collection, density from a vertex group."""
    ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N_, L_ = ng.nodes, ng.links
    gi = N_.new("NodeGroupInput"); go = N_.new("NodeGroupOutput")
    attr = N_.new("GeometryNodeInputNamedAttribute"); attr.data_type = "FLOAT"; attr.inputs["Name"].default_value = group
    dist = N_.new("GeometryNodeDistributePointsOnFaces"); dist.distribute_method = "RANDOM"
    dist.inputs["Seed"].default_value = seed
    mul = N_.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = density
    L_.new(attr.outputs["Attribute"], mul.inputs[0])
    L_.new(gi.outputs[0], dist.inputs["Mesh"]); L_.new(mul.outputs[0], dist.inputs["Density"])
    ci = N_.new("GeometryNodeCollectionInfo"); ci.inputs["Collection"].default_value = collection
    ci.inputs["Separate Children"].default_value = True; ci.inputs["Reset Children"].default_value = True
    inst = N_.new("GeometryNodeInstanceOnPoints"); inst.inputs["Pick Instance"].default_value = True
    L_.new(dist.outputs["Points"], inst.inputs["Points"]); L_.new(ci.outputs[0], inst.inputs["Instance"])
    rid = N_.new("FunctionNodeRandomValue"); rid.data_type = "INT"; rid.inputs["Min"].default_value = 0; rid.inputs["Max"].default_value = 99; rid.inputs["Seed"].default_value = seed + 1
    L_.new(rid.outputs[2], inst.inputs["Instance Index"])
    rr_ = N_.new("FunctionNodeRandomValue"); rr_.data_type = "FLOAT"; rr_.inputs[2].default_value = 0; rr_.inputs[3].default_value = 6.283; rr_.inputs["Seed"].default_value = seed + 2
    cv = N_.new("ShaderNodeCombineXYZ"); L_.new(rr_.outputs[1], cv.inputs["Z"])
    L_.new(cv.outputs[0], inst.inputs["Rotation"])
    rs = N_.new("FunctionNodeRandomValue"); rs.data_type = "FLOAT"; rs.inputs[2].default_value = smin; rs.inputs[3].default_value = smax; rs.inputs["Seed"].default_value = seed + 3
    L_.new(rs.outputs[1], inst.inputs["Scale"])
    jo = N_.new("GeometryNodeJoinGeometry")
    L_.new(gi.outputs[0], jo.inputs[0]); L_.new(inst.outputs[0], jo.inputs[0])
    L_.new(jo.outputs[0], go.inputs[0])
    md = obj.modifiers.new(name, "NODES"); md.node_group = ng
    return md

bpy.context.view_layer.layer_collection.children["trees"].exclude = True
for t in coll.objects:
    t.location = (0, 0, 0)

def tuft(name, col):
    bm = bmesh.new()
    for i in range(22):
        a = random.random() * 6.283
        r = random.random() * 0.12
        hgt = random.uniform(0.18, 0.42)
        lean = random.uniform(0.04, 0.16)
        bx, by = math.cos(a) * r, math.sin(a) * r
        tx, ty = bx + math.cos(a) * lean, by + math.sin(a) * lean
        v1 = bm.verts.new((bx - 0.008, by, 0)); v2 = bm.verts.new((bx + 0.008, by, 0))
        v3 = bm.verts.new(((bx + tx) / 2 + 0.01, (by + ty) / 2, hgt * 0.6)); v4 = bm.verts.new((tx, ty, hgt))
        bm.faces.new((v1, v2, v3, v4))
    me_ = bpy.data.meshes.new(name); bm.to_mesh(me_)
    ob = bpy.data.objects.new(name, me_)
    gm = simple("blade_" + name, col, rough=0.7, sss=0.0)
    gm.node_tree.nodes["Principled BSDF"].inputs["Transmission Weight"].default_value = 0.0
    ob.data.materials.append(gm)
    return ob

gcoll = bpy.data.collections.new("grass")
scn.collection.children.link(gcoll)
gc = U["grass"]
for k, f in enumerate((0.55, 0.8, 1.1)):
    _t = tuft("tuft%d" % k, tuple(min(1, c * f) for c in gc)); x_up(_t); gcoll.objects.link(_t)
bpy.context.view_layer.layer_collection.children["grass"].exclude = True
# terrain modifiers: trees first, then grass (both read the original mesh's vertex groups)
_tm = scatter(terrain, "trees_gn", "trees", coll, 0.05 * (U["trees"] / 110000.0), 0.6, 1.25, 3)
_gm = scatter(terrain, "grass_gn", "near", gcoll, 22.0 if UNI != "glacial" else 8.0, 0.6, 1.4, 11)
# the second scatter must read the original mesh, not the trees: chain them by using the instances only on top
# drowned forest: dead trunks standing in the new sea
if U["dead"]:
    dm = simple("deadwood", (0.12, 0.1, 0.085), rough=0.85)
    placed = 0
    tries = 0
    while placed < 70 and tries < 20000:
        tries += 1
        x = random.uniform(-260, 40)
        y = random.uniform(120, 420)
        z = height(x, y)
        if sea - 6 < z < sea - 0.5:
            hgt = random.uniform(5, 11)
            bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=0.35, radius2=0.04, depth=hgt, location=(x, y, z + hgt / 2))
            o = bpy.context.object
            o.rotation_euler = (random.uniform(-0.15, 0.15), random.uniform(-0.15, 0.15), 0)
            o.data.materials.append(dm)
            for j in range(3):
                bz = z + hgt * random.uniform(0.45, 0.85)
                bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=0.09, radius2=0.01, depth=random.uniform(1.2, 2.6), location=(x, y, bz))
                br = bpy.context.object
                a = random.uniform(0, 6.28)
                br.rotation_euler = (math.cos(a) * 1.0, math.sin(a) * 1.0, 0)
                br.data.materials.append(dm)
            placed += 1

# ---------------------------------------------------------------- tuning circle, rift and explorers
cz = height(*CLIFF)
stone_m, N, L = mat("stone")
_b = N["Principled BSDF"]; _b.inputs["Roughness"].default_value = 0.85
_g = N.new("ShaderNodeNewGeometry"); _s = N.new("ShaderNodeSeparateXYZ"); L.new(_g.outputs["Normal"], _s.inputs[0])
_n = N.new("ShaderNodeTexNoise"); _n.inputs["Scale"].default_value = 4; _n.inputs["Detail"].default_value = 10
_m = N.new("ShaderNodeMapRange"); _m.inputs["From Min"].default_value = 0.55; _m.inputs["From Max"].default_value = 0.8
_a = N.new("ShaderNodeMath"); _a.operation = "ADD"; L.new(_s.outputs["Z"], _a.inputs[0]); L.new(_n.outputs["Fac"], _a.inputs[1])
_a2 = N.new("ShaderNodeMath"); _a2.operation = "SUBTRACT"; _a2.inputs[1].default_value = 0.45; L.new(_a.outputs[0], _a2.inputs[0])
L.new(_a2.outputs[0], _m.inputs["Value"])
_c = N.new("ShaderNodeValToRGB"); _c.color_ramp.elements[0].color = (0.045, 0.045, 0.05, 1); _c.color_ramp.elements[1].color = (0.13, 0.125, 0.12, 1)
L.new(_n.outputs["Fac"], _c.inputs[0])
_mx = N.new("ShaderNodeMix"); _mx.data_type = "RGBA"; L.new(_m.outputs["Result"], _mx.inputs["Factor"])
L.new(_c.outputs["Color"], _mx.inputs[6]); _mx.inputs[7].default_value = (*[c_ * 0.8 for c_ in U["grass"]], 1)
L.new(_mx.outputs[2], _b.inputs["Base Color"])
_bp = N.new("ShaderNodeBump"); _bp.inputs["Strength"].default_value = 0.5; L.new(_n.outputs["Fac"], _bp.inputs["Height"]); L.new(_bp.outputs["Normal"], _b.inputs["Normal"])
for i in range(7):
    a = i / 7 * 6.283 + 0.4
    r = 7.5
    hgt = random.uniform(2.6, 4.2)
    x, y = CLIFF[0] + math.cos(a) * r, CLIFF[1] + math.sin(a) * r
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1, location=(x, y, height(x, y) + hgt / 2 - 0.4))
    st_ = bpy.context.object
    st_.scale = (0.75, 0.42, hgt / 2)
    st_.rotation_euler = (random.uniform(-0.1, 0.1), random.uniform(-0.1, 0.1), a + 1.57)
    tx = bpy.data.textures.new("st%d" % i, "VORONOI"); tx.noise_scale = 0.6
    dp = st_.modifiers.new("disp", "DISPLACE"); dp.texture = tx; dp.strength = 0.35; dp.mid_level = 0.6
    tx2 = bpy.data.textures.new("sc%d" % i, "CLOUDS"); tx2.noise_scale = 0.25; tx2.noise_depth = 4
    dp2 = st_.modifiers.new("disp2", "DISPLACE"); dp2.texture = tx2; dp2.strength = 0.08
    st_.data.materials.append(stone_m)
    for p_ in st_.data.polygons:
        p_.use_smooth = False

# the rift: a vertical gold ring with a shimmering window
gold = simple("riftgold", (1, 0.6, 0.2), emit=(1.0, 0.45, 0.08), strength=14)
ring_c = Vector((CLIFF[0] + 0.5, CLIFF[1] + 1.5, cz + 4.2))
bpy.ops.mesh.primitive_torus_add(major_radius=3.2, minor_radius=0.07, major_segments=96, minor_segments=12, location=ring_c)
ring = bpy.context.object
ring.rotation_euler = (math.radians(90), 0, math.radians(18))
ring.data.materials.append(gold)
bpy.ops.mesh.primitive_torus_add(major_radius=3.55, minor_radius=0.025, major_segments=96, minor_segments=8, location=ring_c)
r2 = bpy.context.object
r2.rotation_euler = (math.radians(90), math.radians(8), math.radians(18))
r2.data.materials.append(gold)
bpy.ops.mesh.primitive_circle_add(vertices=96, radius=3.15, fill_type="NGON", location=ring_c)
win = bpy.context.object
win.rotation_euler = (math.radians(90), 0, math.radians(18))
wm2, N, L = mat("window")
out = N["Material Output"]
N.remove(N["Principled BSDF"])
tc = N.new("ShaderNodeTexCoord")
gr = N.new("ShaderNodeTexGradient"); gr.gradient_type = "SPHERICAL"
mp = N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.31, 0.31, 0.31)
L.new(tc.outputs["Object"], mp.inputs["Vector"]); L.new(mp.outputs[0], gr.inputs["Vector"])
rim = N.new("ShaderNodeValToRGB")
rim.color_ramp.elements[0].position = 0.0; rim.color_ramp.elements[0].color = (1.0, 0.45, 0.1, 1)
rim.color_ramp.elements[1].position = 0.22; rim.color_ramp.elements[1].color = (0, 0, 0, 1)
L.new(gr.outputs["Fac"], rim.inputs[0])
rimE = N.new("ShaderNodeEmission"); rimE.inputs["Strength"].default_value = 6.0
L.new(rim.outputs["Color"], rimE.inputs["Color"])
if PORTAL:
    ns = N.new("ShaderNodeTexNoise"); ns.inputs["Scale"].default_value = 2.0; ns.inputs["Detail"].default_value = 4
    L.new(tc.outputs["Object"], ns.inputs["Vector"])
    off = N.new("ShaderNodeVectorMath"); off.operation = "SCALE"; off.inputs[3].default_value = 0.006
    L.new(ns.outputs["Color"], off.inputs[0])
    wv = N.new("ShaderNodeVectorMath"); wv.operation = "ADD"
    L.new(tc.outputs["Window"], wv.inputs[0]); L.new(off.outputs[0], wv.inputs[1])
    img = N.new("ShaderNodeTexImage"); img.image = bpy.data.images.load(PORTAL); img.extension = "EXTEND"
    img.image.colorspace_settings.name = "sRGB"
    L.new(wv.outputs[0], img.inputs["Vector"])
    base = N.new("ShaderNodeEmission"); base.inputs["Strength"].default_value = 1.0
    L.new(img.outputs["Color"], base.inputs["Color"])
else:
    base = N.new("ShaderNodeBsdfTransparent")
add = N.new("ShaderNodeAddShader")
L.new(base.outputs[0], add.inputs[0]); L.new(rimE.outputs[0], add.inputs[1])
L.new(add.outputs[0], out.inputs["Surface"])
win.data.materials.append(wm2)
# light from the rift onto the stones
bpy.ops.object.light_add(type="POINT", location=ring_c)
pl = bpy.context.object
pl.data.energy = 500
pl.data.color = (1.0, 0.7, 0.4)
pl.data.shadow_soft_size = 1.5

def explorer(loc, yaw, ghost=False):
    """A cloaked explorer: hooded travelling cloak, pack, a field instrument held at the side."""
    x, y, z = loc
    if ghost:
        cloth = simple("ghost", (1, 0.5, 0.15), emit=(1.0, 0.42, 0.08), strength=2.2, alpha=0.45)
        pack_m = trim = cloth
    else:
        cloth = simple("cloak", (0.05, 0.075, 0.09), rough=0.85, sss=0.05)
        pack_m = simple("pack", (0.075, 0.05, 0.035), rough=0.75)
        trim = simple("trim", (1, 0.7, 0.3), emit=(1.0, 0.62, 0.22), strength=4)
    bm = bmesh.new()
    # cloak: a flared cone with noise folds
    c = bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=0.48, radius2=0.17, depth=1.38)
    bmesh.ops.translate(bm, vec=(0, 0, 0.69), verts=c["verts"])
    for v in c["verts"]:
        a = math.atan2(v.co.y, v.co.x)
        fold = 0.035 * math.sin(a * 9) * (1.4 - v.co.z)
        k = 1 + fold
        v.co.x *= k; v.co.y *= k
        if v.co.z < 0.05:
            v.co.z += 0.04 * math.sin(a * 5)
    # shoulders + hood
    sh = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=0.24)
    bmesh.ops.scale(bm, vec=(1.15, 0.85, 0.7), verts=sh["verts"])
    bmesh.ops.translate(bm, vec=(0, 0, 1.36), verts=sh["verts"])
    hd = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=0.16)
    for v in hd["verts"]:
        if v.co.z > 0:
            v.co.z *= 1.35
        if v.co.y > 0.05:
            v.co.y *= 0.9
    bmesh.ops.translate(bm, vec=(0, 0.02, 1.6), verts=hd["verts"])
    me_ = bpy.data.meshes.new("explorer"); bm.to_mesh(me_)
    ob = bpy.data.objects.new("explorer", me_)
    scn.collection.objects.link(ob)
    ob.data.materials.append(cloth)
    sub = ob.modifiers.new("s", "SUBSURF"); sub.levels = 1; sub.render_levels = 2
    for p in ob.data.polygons:
        p.use_smooth = True
    # pack with a bedroll, on the back (towards the camera, -Y)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.24, 1.12))
    pk = bpy.context.object; pk.scale = (0.36, 0.2, 0.5); pk.data.materials.append(pack_m)
    bv = pk.modifiers.new("b", "BEVEL"); bv.width = 0.05; bv.segments = 3
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.09, depth=0.5, location=(0, -0.27, 1.43))
    br = bpy.context.object; br.rotation_euler = (0, math.radians(90), 0); br.data.materials.append(pack_m)
    # instrument: a staff with a glowing tuning lens
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.018, depth=1.7, location=(0.42, 0.05, 0.85))
    st = bpy.context.object; st.rotation_euler = (0.05, -0.06, 0); st.data.materials.append(pack_m)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.09, minor_radius=0.012, location=(0.47, 0.05, 1.72))
    ln = bpy.context.object; ln.rotation_euler = (math.radians(90), 0, 0); ln.data.materials.append(trim)
    for o in (pk, br, st, ln):
        o.parent = ob
    ob.location = (x, y, z - 0.03)
    ob.rotation_euler.z = yaw
    return ob

def ground(x, y):
    return height(x, y)

EXP = (CLIFF[0] - 8.2, CLIFF[1] - 13.2)
ex = explorer((EXP[0], EXP[1], ground(*EXP)), math.radians(-18))
gh = explorer((CLIFF[0] + 3.0, CLIFF[1] - 3.0, ground(CLIFF[0] + 3.0, CLIFF[1] - 3.0)), math.radians(-35), ghost=True)

# ---------------------------------------------------------------- lighthouse on the far headland
if U["lighthouse"]:
    lx, ly = ISLET
    lz = 4.3
    wall = simple("whitewash", (0.62, 0.6, 0.55), rough=0.75)
    red = simple("redband", (0.32, 0.05, 0.03), rough=0.6)
    hgt = 26 if UNI != "halfg" else 46
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=2.6, radius2=1.7, depth=hgt, location=(lx, ly, lz + hgt / 2 - 1))
    bpy.context.object.data.materials.append(wall)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=1.95, depth=2.5, location=(lx, ly, lz + hgt * 0.55))
    bpy.context.object.data.materials.append(red)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=2.3, depth=0.4, location=(lx, ly, lz + hgt - 0.6))
    bpy.context.object.data.materials.append(red)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=1.25, depth=2.2, location=(lx, ly, lz + hgt + 0.7))
    bpy.context.object.data.materials.append(simple("lamp", (1, 0.9, 0.6), emit=(1.0, 0.8, 0.45), strength=30))
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=1.6, radius2=0.08, depth=1.8, location=(lx, ly, lz + hgt + 2.7))
    bpy.context.object.data.materials.append(red)
    # keeper's cottage
    bpy.ops.mesh.primitive_cube_add(size=1, location=(lx + 6, ly - 2, lz + 1.6))
    hs = bpy.context.object; hs.scale = (6, 4, 3.4); hs.data.materials.append(wall)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=4.3, radius2=0, depth=2.4, location=(lx + 6, ly - 2, lz + 4.5))
    rf = bpy.context.object; rf.rotation_euler.z = math.radians(45); rf.scale = (1.0, 0.7, 1); rf.data.materials.append(red)
    if UNI == "drowned":
        bpy.ops.object.light_add(type="POINT", location=(lx, ly, lz + hgt + 0.7))
        bpy.context.object.data.energy = 3000; bpy.context.object.data.color = (1, 0.8, 0.5)

# ---------------------------------------------------------------- world, sun, camera
world = bpy.data.worlds.new("sky")
scn.world = world
world.use_nodes = True
WN = world.node_tree.nodes
sky = WN.new("ShaderNodeTexSky")
sky.sky_type = "NISHITA"
sky.sun_elevation = math.radians(U["sun_el"])
sky.sun_rotation = math.radians(U["sun_rot"] + 180)
sky.air_density = U["air"]
sky.dust_density = U["dust"]
sky.ozone_density = U["ozone"]
sky.sun_size = math.radians(1.2)
sky.sun_intensity = 0.6
bg = WN["Background"]
bg.inputs["Strength"].default_value = 0.35
world.node_tree.links.new(sky.outputs[0], bg.inputs[0])

bpy.ops.object.light_add(type="SUN")
sun = bpy.context.object
sun.data.energy = 3.2
sun.data.angle = math.radians(1.5)
el, az = math.radians(U["sun_el"]), math.radians(U["sun_rot"] + 180)
# Nishita sun direction: rotation is measured from +Y towards -X? match by pointing the lamp at -direction
d = -Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
sun.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
warm = (1.0, 0.78, 0.55) if UNI != "glacial" else (1.0, 0.88, 0.75)
sun.data.color = warm

cam_loc = Vector((CLIFF[0] - 12.5, CLIFF[1] - 24.5, cz + 6.0))
bpy.ops.object.camera_add(location=cam_loc)
cam = bpy.context.object
target = Vector((CLIFF[0] + 105, CLIFF[1] + 300, -38 + (30 if UNI == "halfg" else 0)))
cam.rotation_euler = (target - cam_loc).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 24
cam.data.clip_end = 6000
cam.data.dof.use_dof = True
cam.data.dof.focus_object = ex
cam.data.dof.aperture_fstop = 2.8
scn.camera = cam

# ---------------------------------------------------------------- render + grade
r = scn.render
r.engine = "CYCLES"
scn.cycles.device = "CPU"
scn.cycles.samples = SAMPLES
scn.cycles.use_denoising = True
scn.cycles.max_bounces = 6
r.resolution_x = WIDTH
r.resolution_y = int(WIDTH * 9 / 16)
r.film_transparent = False
scn.view_settings.view_transform = "AgX"
scn.view_settings.look = "AgX - Medium High Contrast"
scn.view_settings.exposure = {"prime": -0.35, "glacial": -0.2, "drowned": 0.15, "halfg": 0.0}[UNI]
vl = scn.view_layers[0]
vl.use_pass_mist = True
world.mist_settings.start = 40
world.mist_settings.depth = 1400
world.mist_settings.falloff = "QUADRATIC"

scn.use_nodes = True
T = scn.node_tree
for nd in list(T.nodes):
    T.nodes.remove(nd)
rl = T.nodes.new("CompositorNodeRLayers")
fogmix = T.nodes.new("CompositorNodeMixRGB"); fogmix.blend_type = "SCREEN"
mistm = T.nodes.new("CompositorNodeMath"); mistm.operation = "MULTIPLY"; mistm.inputs[1].default_value = U["fog_amt"]
T.links.new(rl.outputs["Mist"], mistm.inputs[0])
T.links.new(mistm.outputs[0], fogmix.inputs[0])
T.links.new(rl.outputs["Image"], fogmix.inputs[1])
fogmix.inputs[2].default_value = (*U["fog"], 1)
glare = T.nodes.new("CompositorNodeGlare"); glare.glare_type = "FOG_GLOW"; glare.threshold = 0.9; glare.size = 8; glare.mix = -0.6
T.links.new(fogmix.outputs[0], glare.inputs[0])
cb = T.nodes.new("CompositorNodeColorBalance")
cb.correction_method = "LIFT_GAMMA_GAIN"
cb.lift = U["lift"]; cb.gamma = U["gamma"]; cb.gain = U["gain"]
T.links.new(glare.outputs[0], cb.inputs[1])
lens = T.nodes.new("CompositorNodeLensdist"); lens.inputs["Dispersion"].default_value = 0.012; lens.inputs["Distortion"].default_value = -0.01
T.links.new(cb.outputs[0], lens.inputs[0])
# vignette
ell = T.nodes.new("CompositorNodeEllipseMask"); ell.width = 1.15; ell.height = 1.05
blur = T.nodes.new("CompositorNodeBlur"); blur.size_x = 400; blur.size_y = 400; blur.use_relative = False
T.links.new(ell.outputs[0], blur.inputs[0])
vg_ = T.nodes.new("CompositorNodeMixRGB"); vg_.blend_type = "MULTIPLY"
T.links.new(lens.outputs[0], vg_.inputs[1])
vmap = T.nodes.new("CompositorNodeMapRange")
vmap.inputs[1].default_value = 0; vmap.inputs[2].default_value = 1; vmap.inputs[3].default_value = 0.55; vmap.inputs[4].default_value = 1
T.links.new(blur.outputs[0], vmap.inputs[0])
T.links.new(vmap.outputs[0], vg_.inputs[2])
comp = T.nodes.new("CompositorNodeComposite")
T.links.new(vg_.outputs[0], comp.inputs[0])

r.filepath = OUT
r.image_settings.file_format = "PNG"
bpy.ops.render.render(write_still=True)
print("WROTE", OUT)
