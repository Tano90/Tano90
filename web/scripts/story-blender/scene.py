"""GLB scroll story – photoreal restaurant scene for Blender (Cycles), built entirely from this script.

Run with Blender as a Python module (pip install bpy==5.2.3):
    python scene.py --assets DIR --screens DIR --out DIR [--still NAME] [--frames A-B] [--portrait]

One building, used by every shot (metres, Z up, the street facade faces -Y):
    office    x 0…5,   y 0…4.5   front left corner, large window to the street; the camera leaves through it
    dining    x 5…16,  y 0…14    main room behind the glass front, service station near the entrance
    bar       x 16…24, y 6…14    counter along the back, shelves, pendant lights
    banquet   x 16…24, y 0…6     long tables with linen, lighter floor, folding glass to the bar
Furniture models: Khronos glTF sample assets (CC0 / CC-BY 4.0, see STATUS.md). Everything else is modelled here,
all materials are procedural. Screens show real screenshots of the GLB demo (web/public/story/*.jpg).
"""
import argparse
import json
import math
import os
import sys

import bpy  # noqa: I001 – bpy must be imported before addon_utils
import addon_utils
from mathutils import Euler, Matrix, Vector

ARGS = None


# ------------------------------------------------------------------ helpers
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for mod in ("cycles", "io_scene_gltf2"):
        addon_utils.enable(mod, default_set=True)


def link(obj, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj)
    return obj


def mesh_obj(name, verts, faces, mat=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    if mat:
        ob.data.materials.append(mat)
    return link(ob)


def cube(name, size, loc, mat=None, bevel=0.0, rot=(0, 0, 0)):
    """Box of size (x, y, z) centred at loc, optional rounded edges."""
    sx, sy, sz = (s / 2 for s in size)
    v = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz), (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    ob = mesh_obj(name, v, f, mat)
    ob.location = loc
    ob.rotation_euler = rot
    if bevel > 0:
        m = ob.modifiers.new("bevel", "BEVEL")
        m.width = bevel
        m.segments = 3
        m.limit_method = "ANGLE"
        ob.modifiers.new("wn", "WEIGHTED_NORMAL")
        for p in ob.data.polygons:
            p.use_smooth = True
    return ob


def cylinder(name, r, h, loc, mat=None, seg=32, rot=(0, 0, 0), r2=None):
    r2 = r if r2 is None else r2
    v, f = [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        v.append((r * math.cos(a), r * math.sin(a), -h / 2))
        v.append((r2 * math.cos(a), r2 * math.sin(a), h / 2))
    for i in range(seg):
        j = (i + 1) % seg
        f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    f.append(tuple(2 * i for i in reversed(range(seg))))
    f.append(tuple(2 * i + 1 for i in range(seg)))
    ob = mesh_obj(name, v, f, mat)
    ob.location = loc
    ob.rotation_euler = rot
    for p in ob.data.polygons[:-2]:
        p.use_smooth = True
    return ob


def plane(name, w, h, loc, mat=None, rot=(0, 0, 0)):
    ob = mesh_obj(name, [(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)], [(0, 1, 2, 3)], mat)
    ob.location = loc
    ob.rotation_euler = rot
    uv = ob.data.uv_layers.new()
    for i, l in enumerate(ob.data.loops):
        uv.data[i].uv = [(0, 0), (1, 0), (1, 1), (0, 1)][l.vertex_index]
    return ob


def import_glb(name, loc, rot_z=0.0, scale=1.0, target_height=None):
    path = os.path.join(ARGS.assets, name + ".glb")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(name, None)
    link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    if target_height:
        bpy.context.view_layer.update()
        zs = [(o.matrix_world @ Vector(c)).z for o in new if o.type == "MESH" for c in o.bound_box]
        if zs:
            scale *= target_height / max(1e-6, max(zs) - min(zs))
    root.location = loc
    root.rotation_euler = (0, 0, rot_z)
    root.scale = (scale, scale, scale)
    return root


# ------------------------------------------------------------------ materials (procedural)
def nodes_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    return m, nt, bsdf


def mat_simple(name, color, rough=0.5, metal=0.0, **extra):
    m, nt, b = nodes_mat(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    for k, v in extra.items():
        b.inputs[k].default_value = v
    return m


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def mat_wood(name, light, dark, scale=6.0, planks=False, rough=0.45):
    """Wood: fine grain stretched along local X (noise), slow colour variation; optional planks with per-plank tint."""
    m, nt, b = nodes_mat(name)
    N, L = nt.nodes, nt.links
    tc = N.new("ShaderNodeTexCoord")
    mp = N.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.2 * scale, 40 * scale, 1.2 * scale)
    L.new(tc.outputs["Object"], mp.inputs["Vector"])
    grain = N.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 1.0
    grain.inputs["Detail"].default_value = 6
    grain.inputs["Distortion"].default_value = 0.4
    L.new(mp.outputs["Vector"], grain.inputs["Vector"])
    slow = N.new("ShaderNodeTexNoise")
    slow.inputs["Scale"].default_value = 1.5
    slow.inputs["Detail"].default_value = 2
    L.new(tc.outputs["Object"], slow.inputs["Vector"])
    ramp = N.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[0].color = (*srgb(dark), 1)
    ramp.color_ramp.elements[1].color = (*srgb(light), 1)
    mix = N.new("ShaderNodeMix")
    mix.data_type = "FLOAT"
    mix.inputs["Factor"].default_value = 0.45
    L.new(grain.outputs["Fac"], mix.inputs["A"])
    L.new(slow.outputs["Fac"], mix.inputs["B"])
    L.new(mix.outputs["Result"], ramp.inputs["Fac"])
    col = ramp.outputs["Color"]
    hb = N.new("ShaderNodeBump")
    hb.inputs["Strength"].default_value = 0.04
    L.new(grain.outputs["Fac"], hb.inputs["Height"])
    if planks:
        brick = N.new("ShaderNodeTexBrick")
        brick.offset = 0.37
        brick.inputs["Scale"].default_value = 1.0
        brick.inputs["Brick Width"].default_value = 1.4
        brick.inputs["Row Height"].default_value = 0.16
        brick.inputs["Mortar Size"].default_value = 0.0025
        brick.inputs["Bias"].default_value = 0.0
        brick.inputs["Color1"].default_value = (1, 1, 1, 1)
        brick.inputs["Color2"].default_value = (0.86, 0.83, 0.8, 1)
        brick.inputs["Mortar"].default_value = (0.35, 0.3, 0.26, 1)
        L.new(tc.outputs["Object"], brick.inputs["Vector"])
        mul = N.new("ShaderNodeMix")
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = 1.0
        L.new(col, mul.inputs["A"])
        L.new(brick.outputs["Color"], mul.inputs["B"])
        col = mul.outputs["Result"]
        pb = N.new("ShaderNodeBump")
        pb.inputs["Strength"].default_value = 0.3
        L.new(brick.outputs["Fac"], pb.inputs["Height"])
        L.new(hb.outputs["Normal"], pb.inputs["Normal"])
        L.new(pb.outputs["Normal"], b.inputs["Normal"])
    else:
        L.new(hb.outputs["Normal"], b.inputs["Normal"])
    L.new(col, b.inputs["Base Color"])
    rr = N.new("ShaderNodeMapRange")
    rr.inputs["To Min"].default_value = rough - 0.06
    rr.inputs["To Max"].default_value = rough + 0.08
    L.new(grain.outputs["Fac"], rr.inputs["Value"])
    L.new(rr.outputs["Result"], b.inputs["Roughness"])
    return m


def mat_plaster(name, color, bump=0.03):
    m, nt, b = nodes_mat(name)
    N, L = nt.nodes, nt.links
    b.inputs["Base Color"].default_value = (*srgb(color), 1)
    b.inputs["Roughness"].default_value = 0.92
    n = N.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 40
    n.inputs["Detail"].default_value = 12
    bp = N.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = bump
    L.new(n.outputs["Fac"], bp.inputs["Height"])
    L.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_brick(name):
    m, nt, b = nodes_mat(name)
    N, L = nt.nodes, nt.links
    tc = N.new("ShaderNodeTexCoord")
    sep = N.new("ShaderNodeSeparateXYZ")
    add = N.new("ShaderNodeMath")
    comb = N.new("ShaderNodeCombineXYZ")
    L.new(tc.outputs["Object"], sep.inputs["Vector"])
    L.new(sep.outputs["X"], add.inputs[0])
    L.new(sep.outputs["Y"], add.inputs[1])
    L.new(add.outputs["Value"], comb.inputs["X"])
    L.new(sep.outputs["Z"], comb.inputs["Y"])
    br = N.new("ShaderNodeTexBrick")
    br.inputs["Scale"].default_value = 4.2
    br.inputs["Mortar Size"].default_value = 0.012
    br.inputs["Brick Width"].default_value = 0.5
    br.inputs["Row Height"].default_value = 0.17
    br.inputs["Color1"].default_value = (*srgb("#7a4231"), 1)
    br.inputs["Color2"].default_value = (*srgb("#93573f"), 1)
    br.inputs["Mortar"].default_value = (*srgb("#a99f92"), 1)
    L.new(comb.outputs["Vector"], br.inputs["Vector"])
    n = N.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 25
    mx = N.new("ShaderNodeMix")
    mx.data_type = "RGBA"
    mx.blend_type = "OVERLAY"
    mx.inputs["Factor"].default_value = 0.35
    L.new(br.outputs["Color"], mx.inputs["A"])
    L.new(n.outputs["Color"], mx.inputs["B"])
    L.new(mx.outputs["Result"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.85
    bp = N.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.4
    bp.invert = True
    L.new(br.outputs["Fac"], bp.inputs["Height"])
    L.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_stone(name, color, scale=3.0, rough=0.35):
    m, nt, b = nodes_mat(name)
    N, L = nt.nodes, nt.links
    tc = N.new("ShaderNodeTexCoord")
    n = N.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = 14
    n.inputs["Roughness"].default_value = 0.7
    L.new(tc.outputs["Object"], n.inputs["Vector"])
    v = N.new("ShaderNodeTexVoronoi")
    v.inputs["Scale"].default_value = scale * 6
    L.new(tc.outputs["Object"], v.inputs["Vector"])
    ramp = N.new("ShaderNodeValToRGB")
    c = srgb(color)
    ramp.color_ramp.elements[0].color = (c[0] * 0.82, c[1] * 0.82, c[2] * 0.82, 1)
    ramp.color_ramp.elements[1].color = (min(1, c[0] * 1.08), min(1, c[1] * 1.08), min(1, c[2] * 1.08), 1)
    L.new(n.outputs["Fac"], ramp.inputs["Fac"])
    L.new(ramp.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    bp = N.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.05
    L.new(v.outputs["Distance"], bp.inputs["Height"])
    L.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_glass(name, tint=(0.95, 0.98, 0.97)):
    m = mat_simple(name, tint, rough=0.0, **{"Transmission Weight": 1.0, "IOR": 1.5})
    return m


def mat_screen(name, image_path, strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    for n in list(N):
        N.remove(n)
    out = N.new("ShaderNodeOutputMaterial")
    tex = N.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(image_path)
    tex.interpolation = "Cubic"
    em = N.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = strength
    # a thin glossy layer on top, like a real display
    gl = N.new("ShaderNodeBsdfGlossy")
    gl.inputs["Roughness"].default_value = 0.08
    gl.inputs["Color"].default_value = (1, 1, 1, 1)
    fr = N.new("ShaderNodeFresnel")
    fr.inputs["IOR"].default_value = 1.5
    mix = N.new("ShaderNodeMixShader")
    L.new(tex.outputs["Color"], em.inputs["Color"])
    L.new(fr.outputs["Fac"], mix.inputs["Fac"])
    L.new(em.outputs["Emission"], mix.inputs[1])
    L.new(gl.outputs["BSDF"], mix.inputs[2])
    L.new(mix.outputs["Shader"], out.inputs["Surface"])
    return m


def mat_emit(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*srgb(color), 1)
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return m


class Mats:
    def __init__(self):
        self.oak = mat_wood("oak", "#c9a57c", "#9a7650", scale=1.0)
        self.oak_top = mat_wood("oak_top", "#d1ae84", "#a17c55", scale=0.8, rough=0.32)
        self.walnut = mat_wood("walnut", "#7d5a40", "#54372a", scale=1.0, rough=0.4)
        self.floor = mat_wood("floor", "#bf9c74", "#94714f", scale=0.6, planks=True, rough=0.38)
        self.floor_office = mat_wood("floor_office", "#b4936f", "#8a6a4b", scale=0.6, planks=True, rough=0.45)
        self.plaster = mat_plaster("plaster", "#ece6dc")
        self.plaster_warm = mat_plaster("plaster_warm", "#e4d8c6")
        self.petrol_wall = mat_plaster("petrol_wall", "#2f5f5a", 0.02)
        self.brick = mat_brick("brick")
        self.stone = mat_stone("stone", "#b9b2a6", rough=0.22)
        self.stone_floor = mat_stone("stone_floor", "#c9c1b4", scale=1.2, rough=0.55)
        self.concrete = mat_stone("concrete", "#b9b4ab", scale=2.0, rough=0.8)
        self.pavement = mat_stone("pavement", "#aaa49a", scale=0.8, rough=0.85)
        self.asphalt = mat_stone("asphalt", "#4b4a48", scale=6, rough=0.9)
        self.grass = mat_stone("grass", "#5d7343", scale=10, rough=0.95)
        self.glass = mat_glass("glass")
        self.alu = mat_simple("alu", srgb("#c8cbce"), rough=0.32, metal=1.0, **{"Anisotropic": 0.4})
        self.alu_dark = mat_simple("alu_dark", srgb("#55595e"), rough=0.35, metal=1.0)
        self.mirror = mat_simple("mirror", srgb("#8f8a84"), rough=0.08, metal=1.0)
        self.black_metal = mat_simple("black_metal", srgb("#222426"), rough=0.4, metal=0.6)
        self.brass = mat_simple("brass", srgb("#b8925a"), rough=0.25, metal=1.0)
        self.keys = mat_simple("keys", srgb("#1e2023"), rough=0.55)
        self.bezel = mat_simple("bezel", srgb("#0d0e10"), rough=0.2)
        self.paper = mat_simple("paper", srgb("#f3f0ea"), rough=0.9)
        self.linen = mat_simple("linen", srgb("#f4f0e8"), rough=0.95, **{"Sheen Weight": 0.6})
        self.leather = mat_simple("leather", srgb("#6b3f27"), rough=0.45, **{"Coat Weight": 0.2})
        self.fabric = mat_simple("fabric", srgb("#b9a789"), rough=0.95, **{"Sheen Weight": 0.5})
        self.petrol_fabric = mat_simple("petrol_fabric", srgb("#1f5b55"), rough=0.95, **{"Sheen Weight": 0.5})
        self.ceramic = mat_simple("ceramic", srgb("#f2efe9"), rough=0.15)
        self.binder_a = mat_simple("binder_a", srgb("#1f5b55"), rough=0.6)
        self.binder_b = mat_simple("binder_b", srgb("#c8b89c"), rough=0.6)
        self.binder_c = mat_simple("binder_c", srgb("#6e6a63"), rough=0.6)
        self.lamp_warm = mat_emit("lamp_warm", "#ffd9a8", 25)
        self.leaf = mat_simple("leaf", srgb("#4f6b3a"), rough=0.6, **{"Subsurface Weight": 0.2})
        self.bark = mat_simple("bark", srgb("#5a4632"), rough=0.9)
        self.dashboard = mat_screen("screen_dashboard", os.path.join(ARGS.screens, "screen-dashboard.jpg"), 0.95)
        self.mobile = mat_screen("screen_mobile", os.path.join(ARGS.screens, "screen-mobile.jpg"), 0.95)


def recolor(root, hexcol):
    """Tint the base colour of an imported model (keeps its textures' detail via multiply)."""
    for o in [root] + list(root.children_recursive):
        if o.type != "MESH":
            continue
        for slot in o.material_slots:
            m = slot.material
            if not m or not m.use_nodes:
                continue
            b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if b:
                for k in ("Sheen Tint",):
                    if k in b.inputs and not b.inputs[k].is_linked:
                        b.inputs[k].default_value = (*srgb(hexcol), 1)
            if b and not b.inputs["Base Color"].is_linked:
                b.inputs["Base Color"].default_value = (*srgb(hexcol), 1)
            elif b:
                src = b.inputs["Base Color"].links[0].from_socket
                mx = m.node_tree.nodes.new("ShaderNodeMix")
                mx.data_type = "RGBA"
                mx.blend_type = "MULTIPLY"
                mx.inputs["Factor"].default_value = 1.0
                mx.inputs["B"].default_value = (*srgb(hexcol), 1)
                m.node_tree.links.new(src, mx.inputs["A"])
                m.node_tree.links.new(mx.outputs["Result"], b.inputs["Base Color"])


# ------------------------------------------------------------------ objects
def laptop(M, loc, rot_z=0.0, open_deg=108):
    """A 14" laptop: aluminium base with keyboard and trackpad, lid with bezel and the real dashboard as screen."""
    root = bpy.data.objects.new("laptop", None)
    link(root)
    W, D, T = 0.316, 0.221, 0.0155
    base = cube("lap_base", (W, D, T), (0, 0, T / 2), M.alu, bevel=0.004)
    base.parent = root
    # keyboard: 6 rows of keys in a recessed well
    well = cube("lap_well", (W * 0.9, D * 0.42, 0.001), (0, 0.018, T + 0.0001), M.bezel)
    well.parent = root
    # widths per row in key units (the bottom row has a wide space bar)
    rows = [[1] * 14, [1] * 14, [1] * 14, [1.5] + [1] * 11 + [1.5], [2] + [1] * 10 + [2], [1, 1, 1, 1.3, 5.6, 1.3, 1, 1, 1]]
    kw, gap = 0.0168, 0.0026
    for r, units in enumerate(rows):
        y = 0.056 - r * (kw + gap) * 0.95
        widths = [u * kw + (u - 1) * gap for u in units]
        total = sum(widths) + gap * (len(widths) - 1)
        x = -total / 2
        for i, w in enumerate(widths):
            k = cube(f"key{r}_{i}", (w, kw * (0.62 if r == 0 else 1.0), 0.0012), (x + w / 2, y, T + 0.0008), M.keys, bevel=0.0012)
            k.parent = root
            x += w + gap
    pad = cube("lap_pad", (0.11, 0.068, 0.0006), (0, -0.068, T + 0.0003), M.alu_dark, bevel=0.002)
    pad.parent = root
    # lid hinged at the back edge
    hinge = bpy.data.objects.new("lap_hinge", None)
    link(hinge)
    hinge.parent = root
    hinge.location = (0, D / 2 - 0.004, T)
    hinge.rotation_euler = (math.radians(90 - open_deg), 0, 0)  # lid leans back, screen faces up and forward
    LH = 0.214
    lid = cube("lap_lid", (W, 0.006, LH), (0, 0.004, LH / 2), M.alu, bevel=0.003)
    lid.parent = hinge
    bez = cube("lap_bezel", (W - 0.006, 0.0008, LH - 0.006), (0, 0.0005, LH / 2 + 0.0005), M.bezel)
    bez.parent = hinge
    sw = W - 0.022
    sh = sw / 1.6
    scr = plane("lap_screen", sw, sh, (0, -0.0001, LH / 2 + 0.004), M.dashboard, rot=(math.radians(90), 0, 0))
    scr.parent = hinge
    root.location = loc
    root.rotation_euler = (0, 0, rot_z)
    return root, scr, (sw, sh)


def phone(M, loc, rot_z=0.0, lean_deg=15):
    root = bpy.data.objects.new("phone", None)
    link(root)
    stand = cube("phone_stand", (0.08, 0.07, 0.012), (0, 0.01, 0.006), M.walnut, bevel=0.003)
    stand.parent = root
    piv = bpy.data.objects.new("phone_pivot", None)
    link(piv)
    piv.parent = root
    piv.location = (0, 0.0, 0.012)
    piv.rotation_euler = (math.radians(-lean_deg), 0, 0)
    H, W = 0.1605, 0.0745
    body = cube("phone_body", (W, 0.0082, H), (0, 0.0, H / 2), M.bezel, bevel=0.006)
    body.parent = piv
    frame = cube("phone_frame", (W + 0.0008, 0.006, H + 0.0008), (0, 0.0, H / 2), M.alu_dark, bevel=0.005)
    frame.parent = piv
    sh = 0.149
    sw = sh * 390 / 844
    scr = plane("phone_screen", sw, sh, (0, -0.0043, H / 2), M.mobile, rot=(math.radians(90), 0, 0))
    scr.parent = piv
    root.location = loc
    root.rotation_euler = (0, 0, rot_z)
    return root, scr, (sw, sh)


def chair_wood(M, loc, rot_z, seat_mat=None):
    """Bistro chair: bent-wood look, upholstered seat."""
    root = bpy.data.objects.new("chair", None)
    link(root)
    seat = cube("c_seat", (0.44, 0.42, 0.05), (0, 0, 0.46), seat_mat or M.leather, bevel=0.015)
    seat.parent = root
    for x, y in ((-0.19, -0.17), (0.19, -0.17), (-0.19, 0.17), (0.19, 0.17)):
        lg = cylinder("c_leg", 0.016, 0.45, (x, y, 0.225), M.walnut, seg=12, r2=0.013)
        lg.parent = root
    for x in (-0.19, 0.19):
        p = cylinder("c_post", 0.014, 0.42, (x, 0.19, 0.69), M.walnut, seg=12)
        p.parent = root
    back = cube("c_back", (0.42, 0.025, 0.12), (0, 0.2, 0.84), M.walnut, bevel=0.01)
    back.parent = root
    root.location = loc
    root.rotation_euler = (0, 0, rot_z)
    return root


def window(M, x0, x1, y, z0, z1, mullion_every=None, open_gap=None, frame_mat=None):
    """Glazing in the plane y between x0..x1 and z0..z1 with slim black frames; open_gap=(xa, xb) leaves a door open."""
    fm = frame_mat or M.black_metal
    t = 0.05
    cube("win_bottom", (x1 - x0, 0.08, t), ((x0 + x1) / 2, y, z0 + t / 2), fm)
    cube("win_top", (x1 - x0, 0.08, t), ((x0 + x1) / 2, y, z1 - t / 2), fm)
    xs = [x0, x1]
    if mullion_every:
        n = max(1, round((x1 - x0) / mullion_every))
        xs = [x0 + (x1 - x0) * i / n for i in range(n + 1)]
    for x in xs:
        cube("win_mullion", (t, 0.08, z1 - z0), (x, y, (z0 + z1) / 2), fm)
    for a, b in zip(xs[:-1], xs[1:]):
        if open_gap and a >= open_gap[0] - 1e-6 and b <= open_gap[1] + 1e-6:
            continue
        cube("win_glass", (b - a - t, 0.012, z1 - z0 - 2 * t), ((a + b) / 2, y, (z0 + z1) / 2), M.glass)


# ------------------------------------------------------------------ the building
def build(M):
    H = 3.4  # clear interior height
    # ground: street, pavement, terrace, lawn
    cube("street", (80, 14, 0.1), (12, -16, -0.05), M.asphalt)
    cube("pavement", (80, 7, 0.14), (12, -5.5, -0.03), M.pavement)
    cube("lawn", (300, 200, 0.1), (12, 120, -0.06), M.grass)
    cube("ground_far", (300, 200, 0.1), (12, -120, -0.08), M.pavement)
    # the other side of the street: a row of houses (brick and plaster), so windows never look into empty space
    xs = -30.0
    for i, (w, h, mat) in enumerate(((10, 10.5, M.brick), (8, 13, M.plaster_warm), (12, 9.5, M.brick), (9, 12, M.plaster), (11, 10, M.brick), (10, 14, M.plaster_warm), (12, 9, M.brick))):
        cube("opposite", (w - 0.2, 12, h), (xs + w / 2, -30, h / 2), mat)
        for fl in range(1, int(h // 3) + 1):
            for k in range(int(w // 2.4)):
                cube("op_win", (1.3, 0.06, 1.6), (xs + 1.2 + k * 2.4, -23.97, fl * 3 - 1.1), M.glass)
                cube("op_frame", (1.42, 0.05, 1.72), (xs + 1.2 + k * 2.4, -23.94, fl * 3 - 1.1), M.black_metal)
        cube("op_shop", (w - 1.0, 0.08, 2.4), (xs + w / 2, -23.95, 1.3), M.glass)
        xs += w
    cube("pavement_far", (80, 5, 0.14), (12, -21.5, -0.03), M.pavement)
    cube("lawn_side_l", (20, 18, 0.1), (-10, 7, -0.06), M.grass)
    cube("lawn_side_r", (20, 18, 0.1), (34, 7, -0.06), M.grass)
    # slab and floors
    cube("slab", (24.4, 14.4, 0.3), (12, 7, -0.15), M.concrete)
    cube("floor_office", (5, 4.5, 0.02), (2.5, 2.25, 0.01), M.floor_office)
    cube("floor_dining", (11, 14, 0.02), (10.5, 7, 0.01), M.floor)
    cube("floor_corridor", (5, 9.5, 0.02), (2.5, 9.25, 0.01), M.floor)
    cube("floor_bar", (8, 8, 0.02), (20, 10, 0.01), M.stone_floor)
    cube("floor_banquet", (8, 6, 0.02), (20, 3, 0.01), M.floor)
    # exterior walls: brick back and sides, glass front with a brick pier at the office corner
    wt = 0.3
    cube("wall_back", (24.6, wt, H + 0.5), (12, 14.15, (H + 0.5) / 2), M.brick)
    cube("wall_left", (wt, 14.6, H + 0.5), (-0.15, 7, (H + 0.5) / 2), M.brick)
    cube("wall_right", (wt, 14.6, H + 0.5), (24.15, 7, (H + 0.5) / 2), M.brick)
    cube("front_parapet", (24.6, wt, 0.5), (12, -0.15, H + 0.25), M.brick)
    cube("pier_office", (0.5, wt, H), (5.25, -0.15, H / 2), M.brick)
    cube("pier_bar", (0.4, wt, H), (16.2, -0.15, H / 2), M.brick)
    # interior: inner walls in plaster
    cube("wall_back_in", (24, 0.02, H), (12, 13.99, H / 2), M.plaster_warm)
    cube("wall_left_in", (0.02, 14, H), (0.01, 7, H / 2), M.plaster)
    # office: wall to the dining room (x=5) with a door, wall to the corridor (y=4.5)
    cube("office_wall_e", (0.12, 3.0, H), (5.0, 3.0, H / 2), M.plaster)
    cube("office_wall_e_top", (0.12, 1.5, H - 2.2), (5.0, 0.75, 2.2 + (H - 2.2) / 2), M.plaster)
    cube("office_wall_n", (5.0, 0.12, H), (2.5, 4.56, H / 2), M.brick)
    # front glazing: office window (left), dining front with the entrance, banquet front
    window(M, 0.0, 5.0, -0.1, 0.0, H, mullion_every=1.25, open_gap=(2.5, 3.75))  # office: one leaf open
    window(M, 5.5, 16.0, -0.1, 0.0, H, mullion_every=1.5, open_gap=(9.5, 11.0))  # entrance doors open
    window(M, 16.4, 24.0, -0.1, 0.0, H, mullion_every=1.9)
    # roof with a slim edge and two skylights over the dining room
    cube("roof", (24.6, 14.6, 0.25), (12, 7, H + 0.125), M.concrete)
    cube("ceiling", (24, 14, 0.02), (12, 7, H - 0.01), M.plaster)
    # canopy over the entrance, house number plate without text
    cube("canopy", (4.2, 1.4, 0.12), (10.25, -0.8, 2.75), M.black_metal)

    # ---------- office (detailed: the first shot)
    desk_y = 3.95
    cube("desk_top", (1.6, 0.75, 0.035), (2.6, desk_y, 0.74), M.oak_top, bevel=0.004)
    for dx in (-0.74, 0.74):
        cube("desk_leg", (0.05, 0.68, 0.72), (2.6 + dx, desk_y, 0.36), M.black_metal, bevel=0.003)
    cube("desk_rail", (1.45, 0.03, 0.05), (2.6, desk_y + 0.3, 0.68), M.black_metal)
    # the person at the desk faces the wall; the screen faces them and the window behind them (-Y)
    lp, lp_screen, lp_size = laptop(M, (2.55, desk_y + 0.02, 0.7575), rot_z=0.0)
    # desk items
    cube("notebook", (0.15, 0.21, 0.012), (2.05, desk_y - 0.05, 0.764), M.binder_a, bevel=0.002, rot=(0, 0, 0.2))
    cube("paper_stack", (0.21, 0.297, 0.02), (3.15, desk_y + 0.05, 0.768), M.paper, rot=(0, 0, -0.1))
    cylinder("pen", 0.004, 0.14, (2.1, desk_y - 0.18, 0.762), M.black_metal, seg=10, rot=(math.pi / 2, 0, 0.6))
    import_glb("DiffuseTransmissionTeacup", (3.0, desk_y - 0.2, 0.7575), rot_z=0.4, target_height=0.075)
    # office chair behind the desk (towards the window)
    ch = import_glb("SheenChair", (2.6, desk_y - 0.85, 0.0), rot_z=math.pi, target_height=0.85)
    recolor(ch, "#6f6a62")
    # shelf with binders on the left wall, plant, a framed print, pendant light
    cube("shelf", (0.38, 1.8, 2.0), (0.22, 2.4, 1.0), M.walnut, bevel=0.005)
    for s in range(4):
        cube("shelf_board", (0.34, 1.74, 0.025), (0.24, 2.4, 0.35 + s * 0.48), M.oak)
        for i in range(9):
            mat = (M.binder_a, M.binder_b, M.binder_c)[(i + s) % 3]
            cube("binder", (0.28, 0.07, 0.32), (0.24, 1.65 + i * 0.085 + (s % 2) * 0.03, 0.53 + s * 0.48), mat, bevel=0.003)
    import_glb("DiffuseTransmissionPlant", (4.5, 3.9, 0.0), target_height=1.2)
    # wall shelf above the desk with a few things
    cube("wall_shelf", (1.3, 0.24, 0.03), (2.2, 4.37, 1.62), M.oak, bevel=0.003)
    for i, (w, hh, mat) in enumerate(((0.05, 0.3, M.binder_a), (0.05, 0.3, M.binder_b), (0.05, 0.28, M.binder_c), (0.05, 0.3, M.binder_a))):
        cube("book", (w, 0.2, hh), (1.65 + i * 0.06, 4.37, 1.635 + hh / 2), mat, bevel=0.002)
    cylinder("jar", 0.05, 0.14, (2.3, 4.37, 1.705), M.ceramic, seg=24)
    import_glb("GlassVaseFlowers", (2.7, 4.37, 1.635), target_height=0.32)
    cylinder("pendant_cord", 0.003, 1.3, (2.6, 3.7, H - 0.65), M.black_metal, seg=8)
    cylinder("pendant_shade", 0.2, 0.18, (2.6, 3.7, H - 1.35), M.black_metal, seg=40, r2=0.05)
    cylinder("pendant_bulb", 0.05, 0.05, (2.6, 3.7, H - 1.43), M.lamp_warm, seg=16)
    rug = cube("rug", (2.0, 1.4, 0.01), (2.6, 3.0, 0.025), M.fabric)

    ph_screen, ph_size = build_rest(M, H)
    zones = {"buero": (2.5, 2.2, 1.0), "restaurant": (10.5, 7, 1.0), "bar": (20, 10, 1.0), "bankett": (20, 3, 1.0)}
    return {"laptop": (lp_screen, lp_size), "phone": (ph_screen, ph_size), "zones": zones}


def lathe(name, profile, loc, mat, seg=28):
    """Rotational body from (radius, z) pairs, bottom to top."""
    v, f = [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        for r, z in profile:
            v.append((r * math.cos(a), r * math.sin(a), z))
    n = len(profile)
    for i in range(seg):
        j = (i + 1) % seg
        for k in range(n - 1):
            f.append((i * n + k, j * n + k, j * n + k + 1, i * n + k + 1))
    ob = mesh_obj(name, v, f, mat)
    ob.location = loc
    for poly in ob.data.polygons:
        poly.use_smooth = True
    return ob


def bottle(M, loc, mat, h=0.3):
    return lathe("bottle", [(0.0, 0), (0.037, 0.0), (0.038, 0.01), (0.038, h * 0.62), (0.03, h * 0.72), (0.013, h * 0.8), (0.012, h * 0.97), (0.014, h), (0.0, h)], loc, mat)


def wine_glass(M, loc):
    return lathe("wglass", [(0.0, 0), (0.035, 0), (0.035, 0.004), (0.004, 0.01), (0.004, 0.09), (0.03, 0.12), (0.038, 0.16), (0.033, 0.2), (0.032, 0.2)], loc, M.glass, seg=24)


def plate(M, loc):
    return lathe("plate", [(0.0, 0), (0.09, 0), (0.12, 0.012), (0.135, 0.02), (0.13, 0.021), (0.1, 0.012), (0.0, 0.012)], loc, M.ceramic, seg=36)


def table_round(M, loc, r=0.42, setting=2, rot=0.0):
    x, y = loc
    cylinder("tbl_top", r, 0.035, (x, y, 0.745), M.oak_top, seg=48)
    cylinder("tbl_col", 0.035, 0.7, (x, y, 0.38), M.black_metal, seg=16)
    cylinder("tbl_foot", 0.24, 0.025, (x, y, 0.0125), M.black_metal, seg=32)
    for i in range(setting):
        a = rot + i * 2 * math.pi / setting
        px, py = x + math.cos(a) * r * 0.62, y + math.sin(a) * r * 0.62
        plate(M, (px, py, 0.763))
        wine_glass(M, (x + math.cos(a + 0.5) * r * 0.55, y + math.sin(a + 0.5) * r * 0.55, 0.763))
        chair_wood(M, (x + math.cos(a) * (r + 0.32), y + math.sin(a) * (r + 0.32), 0), a - math.pi / 2)


def pendant(M, x, y, z_ceiling, drop, shade_r=0.18):
    cylinder("pd_cord", 0.003, drop, (x, y, z_ceiling - drop / 2), M.black_metal, seg=8)
    sh = lathe("pd_shade", [(0.02, 0.0), (shade_r, -0.02), (shade_r * 1.05, -0.2), (shade_r * 1.02, -0.205), (0.02, 0.0)], (x, y, z_ceiling - drop), M.brass, seg=36)
    cylinder("pd_bulb", 0.035, 0.05, (x, y, z_ceiling - drop - 0.12), M.lamp_warm, seg=16)
    return sh


def build_rest(M, H):
    # ---------- street side: terrace with bistro tables and parasols, planters, lamp posts, neighbours
    for i, x in enumerate((7.0, 9.0, 12.4, 14.4)):
        cylinder("ter_top", 0.33, 0.03, (x, -2.4, 0.74), M.stone, seg=40)
        cylinder("ter_col", 0.025, 0.72, (x, -2.4, 0.37), M.black_metal, seg=12)
        cylinder("ter_foot", 0.2, 0.02, (x, -2.4, 0.01), M.black_metal, seg=24)
        for a in (0.3, math.pi + 0.3):
            chair_wood(M, (x + math.cos(a) * 0.62, -2.4 + math.sin(a) * 0.62, 0), a - math.pi / 2, M.petrol_fabric)
        if i % 2 == 0:
            cylinder("parasol_pole", 0.02, 2.4, (x + 1.0, -2.4, 1.2), M.oak, seg=10)
            lathe("parasol", [(0.0, 2.45), (1.35, 2.15), (1.36, 2.1), (0.0, 2.38)], (x + 1.0, -2.4, 0), M.linen, seg=8)
    for x in (5.9, 15.6, 17.5, 22.5):
        cube("planter", (0.9, 0.45, 0.55), (x, -1.3, 0.275), M.concrete, bevel=0.01)
        import_glb("DiffuseTransmissionPlant", (x, -1.3, 0.55), rot_z=x, target_height=0.9)
    for x in (-3.0, 12.0, 27.0):
        cylinder("lamp_post", 0.05, 4.2, (x, -8.6, 2.1), M.black_metal, seg=12)
        cube("lamp_head", (0.5, 0.18, 0.08), (x + 0.2, -8.6, 4.2), M.black_metal, bevel=0.01)
    cube("curb", (80, 0.2, 0.18), (12, -9.05, 0.0), M.concrete)
    for i in range(10):
        cube("lane_mark", (2.5, 0.12, 0.002), (-10 + i * 5, -16, 0.0), M.paper)
    # neighbour buildings (brick, windows) so the block reads as a street
    for x0, w, h in ((-12.5, 11.4, 9.5), (25.5, 12, 7.5)):
        cube("neighbour", (w, 14, h), (x0 + w / 2, 7, h / 2), M.brick)
        for fl in range(1, int(h // 3) + 1):
            for k in range(int(w // 2.2)):
                cube("nb_window", (1.2, 0.05, 1.5), (x0 + 1.1 + k * 2.2, -0.03, fl * 3 - 1.2), M.glass)
                cube("nb_frame", (1.3, 0.04, 1.6), (x0 + 1.1 + k * 2.2, -0.0, fl * 3 - 1.2), M.black_metal)
    # roof equipment
    cube("roof_unit", (2.2, 1.4, 1.0), (19, 10, H + 0.75), M.alu_dark, bevel=0.02)
    cube("roof_unit2", (1.4, 1.0, 0.8), (6, 11, H + 0.65), M.alu_dark, bevel=0.02)
    cube("sign_band", (6.2, 0.08, 0.5), (10.25, -0.22, H - 0.4), M.black_metal)

    # ---------- dining: tables, banquette along the back wall, pendants, plants, art
    for (x, y), n in zip(((7.0, 2.6), (9.6, 2.6), (12.4, 2.6), (7.0, 5.4), (9.6, 5.4), (12.4, 5.4), (7.0, 8.4), (9.6, 8.4), (12.4, 8.4)), (2, 4, 2, 4, 2, 4, 2, 4, 2)):
        table_round(M, (x, y), r=0.42 if n == 2 else 0.55, setting=n, rot=0.3 * x)
        pendant(M, x, y, H, 1.25)
    sofa = import_glb("SheenWoodLeatherSofa", (9.7, 12.95, 0), rot_z=0.0, target_height=0.85)
    for x in (7.2, 9.7, 12.2):
        cube("long_table", (1.6, 0.7, 0.035), (x, 11.9, 0.745), M.oak_top, bevel=0.004)
        cylinder("lt_leg", 0.03, 0.72, (x, 11.9, 0.37), M.black_metal, seg=12)
        chair_wood(M, (x - 0.4, 11.25, 0), math.pi)
        chair_wood(M, (x + 0.4, 11.25, 0), math.pi)
        import_glb("GlassHurricaneCandleHolder", (x, 11.9, 0.763), target_height=0.18)
    for x in (6.0, 15.3):
        import_glb("DiffuseTransmissionPlant", (x, 13.4, 0), rot_z=x, target_height=1.6)
    for x in (7.5, 11.9):
        cube("art_frame", (1.6, 0.04, 1.1), (x, 13.97, 2.2), M.walnut, bevel=0.005)
        cube("art", (1.45, 0.02, 0.95), (x, 13.95, 2.2), M.plaster_warm)
    # service station by the entrance with the phone on a stand: the mobile view of the suite
    sx, sy = 13.6, 1.2
    cube("st_body", (1.6, 0.6, 0.95), (sx, sy, 0.475), M.walnut, bevel=0.01)
    cube("st_top", (1.7, 0.68, 0.04), (sx, sy, 0.97), M.stone, bevel=0.004)
    for i in range(4):
        wine_glass(M, (sx - 0.65 + i * 0.11, sy + 0.18, 0.99))
    cube("st_menus", (0.24, 0.32, 0.03), (sx + 0.55, sy + 0.05, 1.005), M.leather, bevel=0.004, rot=(0, 0, 0.15))
    ph, ph_screen, ph_size = phone(M, (sx - 0.05, sy - 0.08, 0.99), rot_z=0.0)
    import_glb("GlassVaseFlowers", (sx + 0.3, sy + 0.2, 0.99), target_height=0.35)

    # ---------- bar: counter with stone top, stools, back bar with bottles, refrigerator, pendants
    cube("bar_front", (6.0, 0.6, 1.05), (20, 9.0, 0.525), M.walnut, bevel=0.01)
    cube("bar_top", (6.2, 0.75, 0.05), (20, 9.0, 1.075), M.stone, bevel=0.005)
    cylinder("bar_rail", 0.02, 6.0, (20, 8.62, 0.22), M.brass, seg=12, rot=(0, math.pi / 2, 0))
    for i in range(7):
        x = 17.4 + i * 0.85
        cylinder("stool_seat", 0.19, 0.06, (x, 8.3, 0.76), M.leather, seg=28)
        cylinder("stool_col", 0.025, 0.73, (x, 8.3, 0.38), M.black_metal, seg=12)
        cylinder("stool_foot", 0.2, 0.02, (x, 8.3, 0.01), M.black_metal, seg=24)
        cylinder("stool_ring", 0.17, 0.012, (x, 8.3, 0.3), M.brass, seg=24)
    cube("backbar", (6.4, 0.45, 2.6), (20, 13.7, 1.3), M.walnut, bevel=0.005)
    cube("backbar_mirror", (5.8, 0.02, 1.4), (20, 13.46, 1.95), M.mirror)
    bottle_mats = [mat_simple(f"bt{i}", c, rough=0.05, **{"Transmission Weight": 0.85}) for i, c in enumerate((srgb("#4e6b3a"), srgb("#8a5a24"), srgb("#d8d2c4"), srgb("#5b2d22")))]
    for shelf in range(3):
        z = 1.0 + shelf * 0.45
        cube("bb_shelf", (5.8, 0.3, 0.025), (20, 13.4, z), M.oak)
        for i in range(22):
            bottle(M, (17.3 + i * 0.26, 13.4, z + 0.013), bottle_mats[(i * 7 + shelf) % 4], h=0.26 + (i % 3) * 0.04)
    import_glb("CommercialRefrigerator", (23.3, 12.6, 0), rot_z=-math.pi / 2, target_height=1.9)
    for x in (18.0, 20.0, 22.0):
        pendant(M, x, 9.0, H, 1.35, 0.14)
    cube("bar_counter_back", (6.0, 0.6, 0.9), (20, 12.6, 0.45), M.stone_floor)

    # ---------- banquet: long tables with linen, petrol chairs, folding glass to the bar
    for y in (2.0, 4.2):
        cube("bq_cloth", (5.4, 1.1, 0.7), (20, y, 0.4), M.linen, bevel=0.03)
        cube("bq_top", (5.42, 1.12, 0.03), (20, y, 0.76), M.linen, bevel=0.01)
        for i in range(6):
            x = 17.8 + i * 0.88
            chair_wood(M, (x, y - 0.8, 0), 0.0, M.petrol_fabric)
            chair_wood(M, (x, y + 0.8, 0), math.pi, M.petrol_fabric)
            plate(M, (x, y - 0.35, 0.775))
            plate(M, (x, y + 0.35, 0.775))
            wine_glass(M, (x + 0.2, y - 0.25, 0.775))
        for x in (18.5, 21.5):
            import_glb("GlassVaseFlowers", (x, y, 0.775), target_height=0.3)
    window(M, 16.2, 24.0, 6.0, 0.0, H, mullion_every=1.3, open_gap=(16.2, 17.5))
    # wall between dining and banquet with a wide opening
    cube("bq_wall_a", (0.15, 3.0, H), (16.1, 1.5, H / 2), M.plaster_warm)
    cube("bq_wall_b", (0.15, 0.8, H), (16.1, 5.6, H / 2), M.plaster_warm)
    cube("bq_wall_top", (0.15, 2.2, 0.7), (16.1, 4.1, H - 0.35), M.plaster_warm)
    for x in (18.0, 22.0):
        pendant(M, x, 3.1, H, 0.9, 0.24)
    # interior light: warm ceiling fixtures over every zone (invisible to the camera, like recessed panels + bounce)
    def ceiling_lights(x0, x1, y0, y1, nx, ny, energy, color="#ffe2bf"):
        for i in range(nx):
            for j in range(ny):
                l = bpy.data.lights.new("ceil", "AREA")
                l.shape = "SQUARE"
                l.size = 1.1
                l.energy = energy
                l.color = srgb(color)
                o = bpy.data.objects.new("ceil", l)
                o.location = (x0 + (x1 - x0) * (i + 0.5) / nx, y0 + (y1 - y0) * (j + 0.5) / ny, H - 0.03)
                o.visible_camera = False
                link(o)
    ceiling_lights(5.2, 16.0, 0.4, 13.8, 4, 4, 55)
    ceiling_lights(16.2, 24.0, 6.2, 13.8, 3, 3, 45, "#ffd6a6")
    ceiling_lights(16.2, 24.0, 0.2, 5.8, 3, 2, 60, "#fff0dc")
    ceiling_lights(0.2, 5.0, 4.8, 13.8, 2, 3, 40)
    return ph_screen, ph_size


# ------------------------------------------------------------------ light, world, render settings
def world_and_light(sun_elev=32, sun_rot=215):
    sc = bpy.context.scene
    w = bpy.data.worlds.new("sky")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    sky = nt.nodes.new("ShaderNodeTexSky")
    for t in ("MULTIPLE_SCATTERING", "NISHITA", "HOSEK_WILKIE"):
        try:
            sky.sky_type = t
            break
        except TypeError:
            continue
    try:
        sky.sun_disc = False
        sky.sun_elevation = math.radians(sun_elev)
        sky.sun_rotation = math.radians(sun_rot)
        sky.altitude = 50
    except AttributeError:
        pass
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.35
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 4.5
    sun.angle = math.radians(0.8)
    sun.color = srgb("#fff0d8")
    so = bpy.data.objects.new("sun", sun)
    d = Vector((0.35, 0.8, -0.5)).normalized()  # late-morning sun from the street side
    so.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    link(so)
    # soft warm fill inside the office (like light bouncing off the ceiling)
    for name, loc, size, energy in (("fill_office", (2.5, 2.4, 3.3), (4.5, 4.0), 90),):
        l = bpy.data.lights.new(name, "AREA")
        l.shape = "RECTANGLE"
        l.size, l.size_y = size
        l.energy = energy
        l.color = srgb("#ffe6c8")
        o = bpy.data.objects.new(name, l)
        o.location = loc
        link(o)


def render_settings(w, h, samples):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.03
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 3
    sc.cycles.glossy_bounces = 3
    sc.cycles.transmission_bounces = 6
    sc.cycles.transparent_max_bounces = 8
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.sample_clamp_indirect = 4.0
    sc.render.use_persistent_data = True
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 86
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    sc.view_settings.exposure = 0.3


# ------------------------------------------------------------------ camera
def camera(lens=32):
    cam = bpy.data.cameras.new("cam")
    cam.lens = lens
    cam.sensor_fit = "HORIZONTAL"
    cam.clip_start = 0.005
    co = bpy.data.objects.new("cam", cam)
    link(co)
    bpy.context.scene.camera = co
    return co


def look(co, pos, target, roll=0.0):
    co.location = Vector(pos)
    d = Vector(target) - Vector(pos)
    co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    if roll:
        co.rotation_euler.rotate_axis("Z", roll)


def screen_fill_pose(scr, size, co, aspect, margin=1.0):
    """Camera in front of a screen so that it fills the frame (contain). Returns (pos, target)."""
    bpy.context.view_layer.update()
    mw = scr.matrix_world
    c = mw.translation.copy()
    n = (mw.to_3x3() @ Vector((0, 0, 1))).normalized()
    sw, sh = size
    cam = co.data
    # horizontal fov from lens and sensor
    fov_x = 2 * math.atan(cam.sensor_width / (2 * cam.lens))
    fov_y = 2 * math.atan(math.tan(fov_x / 2) / aspect)
    d = max((sw / 2) / math.tan(fov_x / 2), (sh / 2) / math.tan(fov_y / 2)) * margin
    return c + n * d, c


def screen_corners(scr, size):
    sw, sh = size
    mw = scr.matrix_world
    return [mw @ Vector(p) for p in ((-sw / 2, -sh / 2, 0), (sw / 2, -sh / 2, 0), (sw / 2, sh / 2, 0), (-sw / 2, sh / 2, 0))]


def project(co, p):
    from bpy_extras.object_utils import world_to_camera_view

    v = world_to_camera_view(bpy.context.scene, co, p)
    return [round(v.x, 5), round(1 - v.y, 5), round(v.z, 4)]


def smoother(x):
    return x * x * x * (x * (x * 6 - 15) + 10)


def catmull(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


def path_at(keys, u):
    """keys: list of (time, pos, target); u in 0..1. Catmull-Rom through the poses, eased within each segment."""
    n = len(keys) - 1
    i = 0
    while i < n - 1 and u > keys[i + 1][0]:
        i += 1
    s = smoother(min(1, max(0, (u - keys[i][0]) / (keys[i + 1][0] - keys[i][0]))))
    P = [Vector(k[1]) for k in keys]
    T = [Vector(k[2]) for k in keys]
    g = lambda arr, j: arr[max(0, min(n, j))]
    return catmull(g(P, i - 1), g(P, i), g(P, i + 1), g(P, i + 2), s), catmull(g(T, i - 1), g(T, i), g(T, i + 1), g(T, i + 2), s)


def story_keys(info, co, aspect):
    """One continuous camera flight, split into shots; every shot starts at the end pose of the previous one."""
    V = Vector
    portrait = aspect < 1
    scr, size = info["laptop"]
    up = (scr.matrix_world.to_3x3() @ V((0, 1, 0))).normalized()
    # opening/closing frame: the dashboard fills the upper part of the picture, keyboard edge below (room for text)
    p0, t0 = screen_fill_pose(scr, size, co, aspect, 1.06 if portrait else 1.26)
    shift = up * (-size[1] * (0.62 if portrait else 0.13))
    open_pos, open_tgt = V(p0) + shift, V(t0) + shift
    lp_fill, lp_c = screen_fill_pose(scr, size, co, aspect, 1.0)
    c = V(lp_c)
    n = (V(lp_fill) - c).normalized()
    pscr, psize = info["phone"]
    pf, pc = screen_fill_pose(pscr, psize, co, aspect, 1.08 if portrait else 1.02)
    pc = V(pc)
    pn = (V(pf) - pc).normalized()
    wide = 1.3 if portrait else 1.0  # portrait frames step further back on wide shots

    def far(pos, tgt):
        return (V(tgt) + (V(pos) - V(tgt)) * wide, V(tgt))

    E = (V((3.12, -1.6, 2.05)), V((2.5, 3.6, 0.9)))
    A = far((4, -26, 15), (12, 5, 1))
    near_phone = (pc + pn * 0.55 + V((0, 0, 0.1)), pc)
    banquet = (V((17.3, 0.8, 1.9)), V((21.5, 4.0, 0.7)))
    return {
        "office": [
            (0.0, open_pos, open_tgt),
            (0.12, c + n * 0.42, c),
            (0.32, c + n * 0.95 + V((0.05, 0, 0.18)), c + V((0, 0, -0.08))),
            (0.55, V((2.95, 1.75, 1.55)), V((2.6, 3.95, 0.92))),
            (0.78, V((3.12, 0.35, 1.7)), V((2.55, 3.9, 0.95))),
            (1.0, *E),
        ],
        "aerial": [
            (0.0, *E),
            (0.35, V((2.2, -6.5, 4.2)), V((5, 3, 1.2))),
            (0.7, *far((-2, -18, 10), (10, 5, 1))),
            (1.0, *A),
        ],
        "enter": [
            (0.0, *A),
            (0.35, *far((10.7, -12, 5), (10.5, 0, 1.6))),
            (0.65, V((10.7, -3.2, 1.7)), V((10.5, 3, 1.3))),
            (0.85, V((11.6, 0.9, 1.55)), V((13.6, 1.1, 1.0))),
            (1.0, *near_phone),
        ],
        "phone": [
            (0.0, *near_phone),
            (0.55, V(pf), pc),
            (1.0, V(pf) + pn * 0.01, pc),
        ],
        "outlets": [
            (0.0, V(pf) + pn * 0.01, pc),
            (0.15, pc + pn * 0.7 + V((0.2, 0, 0.25)), pc + V((-1, 2, 0))),
            (0.32, V((14.6, 2.2, 1.65)), V((9.0, 10.0, 0.9))),  # restaurant
            (0.55, V((15.0, 8.2, 1.7)), V((20.5, 13.2, 1.3))),  # bar
            (0.72, V((17.1, 7.0, 1.7)), V((19.5, 2.5, 0.8))),
            (0.84, V((16.85, 5.6, 1.7)), V((21.0, 2.8, 0.8))),  # through the glass door
            (1.0, *banquet),
        ],
        "return": [
            (0.0, *banquet),
            (0.22, V((16.9, 4.1, 1.7)), V((12.0, 3.0, 1.3))),  # through the opening back into the dining room
            (0.45, V((11.5, 2.2, 1.6)), V((5.0, 0.9, 1.4))),
            (0.62, V((6.3, 0.85, 1.55)), V((3.0, 2.6, 1.0))),
            (0.75, V((4.2, 0.85, 1.45)), c),  # through the office door
            (0.88, V((3.0, 2.55, 1.3)), c),
            (1.0, open_pos, open_tgt),
        ],
    }


def render_shot(name, info, co, frames, out):
    sc = bpy.context.scene
    aspect = sc.render.resolution_x / sc.render.resolution_y
    keys = story_keys(info, co, aspect)[name]
    meta = {"shot": name, "frames": frames, "size": [sc.render.resolution_x, sc.render.resolution_y], "laptop": [], "phone": [], "zones": []}
    scr, size = info["laptop"]
    pscr, psize = info["phone"]
    only = getattr(ARGS, "only", None)
    import time

    half = getattr(ARGS, "half", False)
    for f in range(frames - 1 if half else frames):
        # --half renders the in-between frames (u halfway between frame f and f+1) for a smoother sequence
        u = (f + 0.5) / (frames - 1) if half else f / (frames - 1)
        pos, tgt = path_at(keys, u)
        look(co, pos, tgt)
        bpy.context.view_layer.update()
        meta["laptop"].append([project(co, c) for c in screen_corners(scr, size)])
        meta["phone"].append([project(co, c) for c in screen_corners(pscr, psize)])
        meta["zones"].append({k: project(co, Vector(v)) for k, v in info["zones"].items()})
        if only is not None and f not in only:
            continue
        path = os.path.join(out, f"{name}{'_h' if half else ''}_{f:04d}.jpg")
        if os.path.exists(path) and not ARGS.force:
            continue
        sc.render.filepath = path
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print("FRAME", f, round(time.time() - t, 1), [round(x, 3) for x in pos], [round(x, 3) for x in tgt], flush=True)
    with open(os.path.join(out, f"{name}{'_h' if half else ''}.json"), "w") as fh:
        json.dump(meta, fh)


def main():
    global ARGS
    ap = argparse.ArgumentParser()
    ap.add_argument("--assets", required=True)
    ap.add_argument("--screens", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--still", default="")
    ap.add_argument("--pose", default="")  # px,py,pz,tx,ty,tz for a still
    ap.add_argument("--samples", type=int, default=48)
    ap.add_argument("--size", default="1280x720")
    ap.add_argument("--blend", default="")
    ap.add_argument("--shot", default="")
    ap.add_argument("--poses", default="")  # name:px,py,pz,tx,ty,tz;name2:...
    ap.add_argument("--frames", type=int, default=48)
    ap.add_argument("--only", default="")  # e.g. 0,12,24 – render only these frames (meta for all)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--half", action="store_true")
    ARGS = ap.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:])
    reset()
    M = Mats()
    info = build(M)
    world_and_light()
    w, h = (int(x) for x in ARGS.size.split("x"))
    render_settings(w, h, ARGS.samples)
    co = camera()
    os.makedirs(ARGS.out, exist_ok=True)
    if ARGS.blend:
        bpy.ops.wm.save_as_mainfile(filepath=ARGS.blend)
    if ARGS.only:
        ARGS.only = {int(x) for x in ARGS.only.split(",")}
    else:
        ARGS.only = None
    if ARGS.shot:
        render_shot(ARGS.shot, info, co, ARGS.frames, ARGS.out)
        return
    if ARGS.poses:
        for spec in ARGS.poses.split(";"):
            nm, vals = spec.split(":")
            p = [float(x) for x in vals.split(",")]
            look(co, p[:3], p[3:])
            bpy.context.scene.render.filepath = os.path.join(ARGS.out, nm + ".jpg")
            bpy.ops.render.render(write_still=True)
            print("POSE", nm, flush=True)
        return
    if ARGS.still:
        scr, size = info["laptop"]
        if ARGS.pose == "fill":
            pos, tgt = screen_fill_pose(scr, size, co, w / h, 1.0)
        else:
            p = [float(x) for x in ARGS.pose.split(",")]
            pos, tgt = p[:3], p[3:]
        look(co, pos, tgt)
        bpy.context.scene.render.filepath = os.path.join(ARGS.out, ARGS.still + ".jpg")
        import time

        t = time.time()
        bpy.ops.render.render(write_still=True)
        print("RENDER_SECONDS", round(time.time() - t, 1))
        print("SCREEN", json.dumps([project(co, c) for c in screen_corners(scr, size)]))


if __name__ == "__main__":
    main()
