"""Build the Barista Express in Blender's UI, using the collection's helpers.

In Blender's Python Console:
  import runpy
  runpy.run_path('/absolute/path/to/build_espresso.py')['run']()

Only this device is rebuilt. The existing nine assets are left untouched.
"""
import bpy
import importlib.util
import json
import math
import random
import traceback
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("hardware_helpers", HERE / "build_models.py")
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
SLUG = "breville-barista-express"
DETAILS = json.loads((h.TEX / "espresso-details.json").read_text())
COLORS = ["sesame", "edge", "steel", "chrome", "coffee", "roast", "darkRoast", "rubber"]


def finish(obj, color, metal=0):
    obj.data.materials.clear()
    obj.data.materials.append(h.material("espresso-finishes", metal=metal))
    i = COLORS.index(color)
    h.uv_rect(obj, (i%4*64+4, i//4*64+4, 56, 56), (256, 128))
    return obj


def slab(name, loc, dims, color="sesame", r=.3, edge=.08, parent=None, metal=0, segments=2):
    return finish(h.slab(name, loc, dims, "black", r, edge, parent, segments), color, metal)


def cyl(name, loc, radius, depth, color="steel", parent=None, vertices=16, axis="z", metal=.25):
    return finish(h.cylinder(name, loc, radius, depth, "silver", parent, vertices, axis), color, metal)


def ring(name, loc, radius, inner, depth, color="chrome", parent=None, segments=20, axis="z"):
    obj = finish(h.ring(name, loc, (radius, radius), (inner, inner), depth, "silver", parent, segments), color, .3)
    if axis == "y": obj.rotation_euler.x = math.pi/2
    return obj


def lathe(name, loc, sections, color, parent=None, segments=16, metal=0):
    return finish(h.oval_sections(name, loc, [(z, r, r) for z, r in sections], "black", parent, segments), color, metal)


def tube(name, a, b, radius=.15, color="chrome", parent=None):
    a, b = Vector(a), Vector(b)
    obj = cyl(name, (a+b)/2, radius, (b-a).length, color, parent, vertices=10)
    obj.rotation_euler = (b-a).to_track_quat("Z", "Y").to_euler()
    return obj


def front_label(name, loc, w, height, key, parent=None):
    obj = h.panel(name, loc, w, height, "espresso-details", DETAILS[key], parent, alpha=True)
    obj.rotation_euler.x = math.pi/2
    return obj


def disc(name, loc, radius, key, parent=None, segments=24):
    verts = [(0, 0, 0)] + [(radius*math.cos(i*2*math.pi/segments), 0, radius*math.sin(i*2*math.pi/segments)) for i in range(segments)]
    faces = [(0, i+1, (i+1)%segments+1) for i in range(segments)]
    obj = h.mesh(name, verts, faces, None, parent)
    obj.location = loc
    obj.data.materials.append(h.material("espresso-details", alpha=True))
    # The join-by-material stage preserves UV sets by name.
    uv = obj.data.uv_layers.new(name="PixelUV")
    rx, ry, w, ht = DETAILS[key]
    for p in obj.data.polygons:
        for loop in p.loop_indices:
            v = verts[obj.data.loops[loop].vertex_index]
            uv.data[loop].uv = ((rx+w*(v[0]/radius+1)/2)/512, 1-(ry+ht*(1-v[2]/radius)/2)/512)
    return obj


def profile(name, points, front, back, color):
    """Extruded x/z outline, with one bevel segment for the PS2 silhouette."""
    n = len(points)
    verts = [(x, y, z) for y in [front, back] for x, z in points]
    faces = [tuple(range(n)), tuple(reversed(range(n, n*2)))]
    faces += [(i, i+n, (i+1)%n+n, (i+1)%n) for i in range(n)]
    obj = h.mesh(name, verts, faces, "black")
    bevel = obj.modifiers.new("Single_edge_chamfer", "BEVEL")
    bevel.width = .12
    bevel.segments = 1
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    obj.select_set(False)
    return finish(obj, color)


def espresso():
    # Front is -Y; Blender units are cm. Silhouette follows the supplied image.
    slab("Footed_black_base", (0, 0, 1.9), (32.2, 28.5, 3.5), r=1.0, edge=.3, segments=3)
    for x in [-13.6, 13.6]:
        for y in [-11, 10.8]: slab("Rubber_foot", (x, y, .3), (3.1, 3.4, .6), "rubber", r=.6)
    # Rear boiler housing and tank leave a genuine recessed working cavity.
    slab("Boiler_housing", (0, 5.7, 17.8), (30.6, 14.8, 29.7), r=.75, edge=.35)
    slab("Rear_water_reservoir", (0, 13.1, 18.3), (27.5, 3.2, 28.7), "edge", r=.7, edge=.15)
    slab("Reservoir_lid", (0, 13.0, 32.9), (28.2, 3.8, .65), "rubber", r=.5)
    slab("Tank_lift_handle", (0, 13.7, 33.4), (7, 1.2, .5), "sesame", r=.2)
    # Brushed stainless back wall catches light even with no web environment map.
    slab("Stainless_backsplash", (0, -1.85, 14.2), (27.2, .25, 20.5), "steel", r=.1, metal=.18)
    for x in [-14.2, 14.2]:
        slab("Side_pillar", (x, -5.1, 14.2), (1.55, 9.4, 22.3), r=.3, edge=.16)
        slab("Pillar_front_edge", (x, -9.81, 14.0), (.65, .14, 21.4), "edge", r=.04, edge=.02)
    slab("Drip_tray_drawer", (0, -7.7, 3.0), (28.4, 12.7, 3.2), "sesame", r=.5, edge=.15)
    slab("Tray_pull_recess", (0, -14.09, 2.35), (7.4, .03, .55), "rubber", r=.01, edge=.005)
    slab("Drip_tray_steel_rim", (0, -7.7, 4.65), (27.9, 12.1, .4), "chrome", r=.5, metal=.25)
    slab("Drip_grid_dark_bed", (0, -7.7, 4.89), (26.8, 11.1, .11), "rubber", r=.3, edge=.025)
    for j in range(20):
        finish(h.box("Drip_grid_slats", (0, -12.85+j*.54, 5.0), (26.3, .26, .13), "silver"), "steel", .2)
    for x in [-9, 0, 9]: slab("Tray_cross_rail", (x, -7.7, 5.06), (.17, 10.7, .11), "chrome", r=.03, metal=.3, segments=1)
    slab("Tray_float_slot", (0, -4.0, 5.15), (2.1, .7, .10), "rubber", r=.12)
    # A shaped lower apron is the recognizable Barista Express face.
    outline = [(-15.6, 32.3), (-15.0, 33.15), (14.9, 33.15), (15.6, 32.3), (15.6, 25.5), (14.8, 24.65), (11.2, 24.65), (8.0, 23.4), (-7.6, 23.4), (-11.0, 24.65), (-14.8, 24.65), (-15.6, 25.5)]
    # Reverse winding: the visible front normal points towards -Y.
    profile("Sculpted_upper_housing", list(reversed(outline)), -10.6, 10.8, "rubber")
    face = [(-14.85, 32.3), (14.85, 32.3), (14.85, 25.3), (10.8, 25.3), (7.6, 24.25), (-7.4, 24.25), (-10.8, 25.3), (-14.85, 25.3)]
    profile("Black_sesame_control_panel", list(reversed(face)), -10.87, -10.55, "sesame")
    tube("Upper_face_highlight", (-14.7, -10.92, 32.35), (14.7, -10.92, 32.35), .045, "steel")
    slab("Cup_warming_deck", (0, 1.7, 33.23), (29.6, 18.2, .28), "edge", r=.65)
    for j in range(9): finish(h.box("Warming_deck_ribs", (6.6, -4.8+j*1.45, 33.43), (12.0, .12, .12), "black"), "sesame")
    front_label("Raised_brand_mark", (0, -10.92, 31.45), 4.8, 1.2, "brand")
    # Six metal buttons and dial; every face has a radial brushed UV texture.
    controls = [(-11.55, "power"), (-8.2, "grind"), (-4.8, "filter"), (4.8, "program"), (8.2, "cup"), (11.55, "cups")]
    for x, key in controls:
        radius = 1.12 if key == "grind" else 1.02
        cyl("Button_shadow_"+key, (x, -10.94, 29.6), radius+.18, .2, "rubber", axis="y", metal=0)
        cyl("Button_bezel_"+key, (x, -11.10, 29.6), radius+.08, .22, "chrome", axis="y")
        cyl("Button_cap_"+key, (x, -11.28, 29.6), radius-.13, .22, "steel", axis="y")
        disc("Brushed_face_"+key, (x, -11.402, 29.6), radius-.14, "button", segments=16)
        front_label("Control_label_"+key, (x, -10.95, 27.76), 2.65 if key not in ("cup", "cups") else 1.5, .73, key)
    ring("Grind_amount_outer_scale", (-8.2, -10.98, 29.6), 1.48, 1.43, .045, axis="y", color="steel", segments=24)
    tube("Grind_dial_indicator", (-8.2, -11.43, 30.13), (-8.2, -11.43, 30.43), .07, "rubber")
    for x, key in [(-5.9, "single"), (-3.8, "double"), (3.7, "clean"), (5.7, "steam")]:
        cyl("Indicator_socket", (x, -10.96, 26.45), .28, .15, "rubber", axis="y", vertices=10)
        cyl("Indicator_lens", (x, -11.06, 26.45), .16, .08, "steel", axis="y", vertices=8)
        front_label("Indicator_label_"+key, (x, -10.96, 25.65), 1.85, .68, key)
    # Deep, faceted chrome rim around the analog gauge.
    cyl("Gauge_gasket", (0, -10.98, 27.7), 2.55, .35, "rubber", axis="y", vertices=32)
    cyl("Gauge_bezel", (0, -11.23, 27.7), 2.42, .39, "steel", axis="y", vertices=32)
    ring("Gauge_chrome_rim", (0, -11.48, 27.7), 2.34, 2.10, .26, axis="y", segments=32)
    disc("Pressure_dial", (0, -11.615, 27.7), 2.10, "gauge", segments=32)
    pointer = h.mesh("Red_pressure_pointer", [(-1.42,-11.65,26.20),(-1.27,-11.65,26.18),(.57,-11.65,28.34),(.37,-11.65,28.46)], [(0,1,2,3)], "red")
    cyl("Gauge_pointer_pin", (0, -11.69, 27.7), .19, .09, "steel", axis="y", vertices=12)
    # Integrated tamper, grinder chute and cradle under the left of the fascia.
    lathe("Magnetic_tamper", (-12.5, -8.0, 21.4), [(-.4,2.1),(0,2.1),(.3,1.7),(1.4,.7),(2.3,.65)], "rubber")
    cyl("Tamper_steel_foot", (-12.5,-8.0,20.96), 2.05, .25, "chrome")
    front_label("Tamper_label", (-12.4,-10.94,24.98), 2.0, .75, "tamper")
    cyl("Grinder_chute_collar", (-6.0,-7.0,22.15), 3.0, 2.2, "steel", vertices=20)
    front_label("Grinder_push_instructions", (-6.0,-10.025,22.1), 3.8, 1.28, "grindPush")
    slab("Grinder_rear_chute", (-6.0,-5.8,19.8), (3.2,2.0,3.9), "rubber", r=.3)
    for x in [-9.1,-2.9]:
        tube("Portafilter_cradle_support", (x,-6.5,21.3), (x,-9.8,18.3), .23, "rubber")
        tube("Portafilter_cradle_fork", (x,-9.8,18.3), (x,-11.0,18.3), .24, "rubber")
    # Portafilter is parked under the grinder, as in the reference photograph.
    portafilter = h.empty("Portafilter", (-6.0,-8.7,17.25))
    lathe("Portafilter_basket", (0,0,0), [(-.9,2.4),(-.6,2.65),(.9,2.65),(1.1,2.9)], "chrome", portafilter, segments=20, metal=.3)
    ring("Basket_lip", (0,0,1.15), 2.96, 2.56, .18, parent=portafilter, segments=20)
    cyl("Coffee_dose", (0,0,1.14), 2.52, .15, "coffee", portafilter, vertices=20, metal=0)
    lathe("Ground_coffee_mound", (0,0,1.18), [(0,2.2),(.7,1.3),(1.35,.25)], "roast", portafilter, segments=10)
    tube("Portafilter_neck", (0,-1.8,-.05), (0,-4.3,-.6), .74, "chrome", portafilter)
    handle = lathe("Portafilter_black_handle", (0,-3.9,-.65), [(0,.8),(.5,.88),(6.6,1.02),(7.0,.83)], "rubber", portafilter, segments=12)
    handle.rotation_euler.x = math.radians(100)
    end = Vector(handle.location) + handle.rotation_euler.to_matrix() @ Vector((0,0,7.02))
    cap = cyl("Handle_silver_end", end, .80, .12, "steel", portafilter, vertices=12)
    cap.rotation_euler = handle.rotation_euler
    tube("Portafilter_spout", (0,0,-1), (0,-.5,-1.8), .28, "chrome", portafilter)
    # Exposed brew group on the right, including locking markings.
    cyl("Brew_group_upper", (5.2,-6.6,22.0), 4.1, 2.5, "steel", vertices=24)
    ring("Group_chrome_lower_ring", (5.2,-6.6,20.72), 3.92, 2.75, .45, segments=24)
    cyl("Shower_screen", (5.2,-6.6,20.55), 2.65, .16, "rubber", vertices=20)
    front_label("Brew_group_lock_markings", (5.2,-10.71,21.1), 6.4, .80, "lock")
    # Separate hot-water outlet and articulated right-hand steam wand.
    cyl("Hot_water_outlet", (10.8,-8.9,21.8), .52, 2.7, "chrome", vertices=12)
    cyl("Steam_ball_socket", (13.1,-9.3,23.6), .77, 1.2, "steel", vertices=12)
    wand = h.empty("Steam_wand_swivel", (13.1,-9.3,23.0))
    tube("Steam_wand_upper", (0,0,0), (.45,-.45,-3.0), .30, parent=wand)
    tube("Steam_wand_elbow", (.45,-.45,-3.0), (2.35,-.7,-4.4), .31, parent=wand)
    tube("Steam_grip", (.5,-.46,-3.1), (2.8,-.7,-4.7), .57, "rubber", wand)
    loop = ring("Steam_finger_loop", (2.2,-.7,-3.1), 1.0, .65, .33, "rubber", wand, segments=12, axis="y")
    loop.rotation_euler.y = math.radians(-20)
    tube("Steam_wand_lower", (2.6,-.7,-4.55), (5.25,-.85,-10.8), .25, parent=wand)
    tube("Steam_tip", (5.12,-.84,-10.5), (5.45,-.86,-11.3), .34, parent=wand)
    h.animate(wand, "rotation_euler", (0,math.radians(-13),math.radians(-16)), delay=8)
    # Steam selector on the right; grind selector on the left.
    for x, name, z in [(16.0,"Steam_selector",29.1),(-16.0,"Grind_size_selector",28.9)]:
        cyl(name, (x,-6.2,z), 1.45, .8, "steel", vertices=16, axis="x")
    slab("Steam_selector_lever", (16.5,-6.2,29.1), (.36,1.25,2.7), "chrome", r=.1)
    # Hopper: real faceted beans inside a lightly tinted, alpha glass shell.
    hx, hy = -6.8, 1.5
    cyl("Hopper_base", (hx,hy,33.6), 4.65, .7, "rubber", vertices=20)
    fill_mesh = lathe("Hopper_lower_beans", (hx,hy,34.1), [(0,4.4),(1.6,5.6),(3.6,6.1)], "darkRoast", segments=20)
    fill_mesh.data.materials.clear()
    fill_mesh.data.materials.append(h.material("espresso-beans"))
    uv = fill_mesh.data.uv_layers.active
    for poly in fill_mesh.data.polygons:
        indices = [fill_mesh.data.loops[l].vertex_index for l in poly.loop_indices]
        seam = any(i%20 == 0 for i in indices) and any(i%20 == 19 for i in indices)
        for l in poly.loop_indices:
            vi = fill_mesh.data.loops[l].vertex_index
            u = vi%20/20
            if seam and vi%20 == 0: u = 1.0
            uv.data[l].uv = (u*5, fill_mesh.data.vertices[vi].co.z/3.6)
    rng = random.Random(870)
    for j in range(36):
        a = rng.random()*math.tau
        rad = math.sqrt(rng.random())*5.2
        x, y = hx+rad*math.cos(a), hy+rad*math.sin(a)
        z = 37.65+rng.uniform(-.1,.35)-.035*rad
        bean = h.sphere("Faceted_coffee_bean", (x,y,z), (.65,.40,.35), "bronze", segments=8, rings=4)
        finish(bean, rng.choice(["coffee","roast","darkRoast"]))
        bean.rotation_euler = (rng.uniform(-.3,.3),rng.uniform(-.3,.3),rng.random()*math.tau)
        # Split crease is geometry rather than a costly separate texture.
        angle = bean.rotation_euler.z
        vertices = [(x+u*math.cos(angle)-v*math.sin(angle),y+u*math.sin(angle)+v*math.cos(angle),z+.33) for u,v in [(-.27,-.022),(.27,-.022),(.27,.022),(-.27,.022)]]
        finish(h.mesh("Bean_crease", vertices, [(0,1,2,3)], "black"), "darkRoast")
    shell = lathe("Smoked_hopper_shell", (hx,hy,34.0), [(0,4.65),(1.0,4.65),(2.8,6.65),(5.45,6.65)], "edge", segments=20)
    shell.data.materials.clear()
    glass = h.material("espresso-smoke", alpha=True)
    glass.node_tree.nodes.get("Principled BSDF").inputs["Roughness"].default_value = .55
    shell.data.materials.append(glass)
    h.uv_rect(shell, (0,0,32,32), (32,32))
    ring("Hopper_lower_seal", (hx,hy,34.35), 4.72, 4.5, .16, "edge", segments=20)
    lathe("Hopper_black_lid", (hx,hy,39.65), [(-.28,6.9),(0,6.95),(.25,6.55),(.40,3.3),(.43,0.1)], "sesame", segments=20)
    # Slight whole-object inspection turn; the rest pose faces the visitor.
    h.animate(h.ROOT_OBJ, "rotation_euler", (0,0,math.radians(-12)), start=(0,0,math.radians(4)))


def verify_native():
    bpy.ops.wm.open_mainfile(filepath=str(h.ART / (SLUG+".blend")), load_ui=False)
    scene = bpy.context.scene
    meshes = [o for o in scene.objects if o.type == "MESH"]
    images = {n.image for o in meshes for m in o.data.materials if m and m.use_nodes for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image}
    animated = [o for o in scene.objects if o.animation_data and o.animation_data.action]
    assert meshes and len(animated) >= 2
    assert all(o.data.uv_layers for o in meshes)
    assert all(i.packed_file for i in images)
    poses = []
    for frame in (1,25,49):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        poses.append({o.name: [round(n,6) for row in o.matrix_world for n in row] for o in animated})
    assert poses[0] != poses[1] != poses[2]
    report = {"file":SLUG+".blend", "meshes":len(meshes), "packedTextures":len(images), "allMeshesHaveUVs":True, "distinctOpeningPoses":True, "frameRange":[1,49]}
    path = h.ART / "native-validation.json"
    existing = json.loads(path.read_text()) if path.exists() else []
    path.write_text(json.dumps([r for r in existing if r["file"] != report["file"]]+[report], indent=2)+"\n")
    scene.frame_set(49)
    return report


def build():
    h.BUILDERS[SLUG] = espresso
    result = h.build(SLUG)
    # Match the website's low front three-quarter presentation.
    scene = bpy.context.scene
    camera = scene.camera
    center = Vector((0,-.8,20.0))
    direction = Vector((.72,-1.7,.65)).normalized()
    camera.location = center+direction*130
    camera.rotation_euler = (center-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.ortho_scale = 57
    scene.cycles.samples = 32
    data = bpy.data.lights.new("Front_softbox", "AREA")
    light = bpy.data.objects.new("Front_softbox", data)
    scene.collection.objects.link(light)
    light.location = Vector((0,-65,35))
    light.rotation_euler = (center-light.location).to_track_quat("-Z","Y").to_euler()
    data.energy = 24000
    data.shape = "DISK"
    data.size = 65
    # Keep an inspectable native file with all maps embedded.
    h.ROOT_OBJ["reference"] = "Owner-supplied front photograph; Breville BES870 Black Sesame"
    h.ROOT_OBJ["reveal_frames"] = "1 resting / 49 inspection turn + steam wand swivel"
    bpy.ops.wm.save_as_mainfile(filepath=str(h.ART/(SLUG+".blend")))
    bpy.ops.render.render(write_still=True)
    manifest_path = h.WEB / "manifest.json"
    entries = json.loads(manifest_path.read_text())
    manifest_path.write_text(json.dumps([e for e in entries if e["slug"] != SLUG]+[result], indent=2)+"\n")
    report = verify_native()
    (h.QA / "espresso-status.json").write_text(json.dumps({"status":"complete", "model":result, "native":report}, indent=2))
    return None


def run():
    """Yield the Console before the builder switches it to a 3D viewport."""
    def deferred():
        try:
            return build()
        except Exception:
            (h.QA / "espresso-status.json").write_text(json.dumps({"status":"error", "traceback":traceback.format_exc()}, indent=2))
            traceback.print_exc()
            return None
    bpy.app.timers.register(deferred, first_interval=.2)


if __name__ == "__main__":
    run()
