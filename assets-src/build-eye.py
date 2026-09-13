#!/usr/bin/env python3
"""Build the iris sculpt and bake its neutral surface detail with Blender Cycles.

Run: blender --background --python assets-src/build-eye.py
The iris remains an adjustable annulus in the browser. This asset contains only
neutral surface structure, never iris colour, pupil size or patient anatomy.
"""
from pathlib import Path
import hashlib
import json
import math
import re
import bpy
from mathutils import Vector, noise
import random

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'app/src/engine/assets'
OUT.mkdir(parents=True, exist_ok=True)
# Read the application's dimensions instead of maintaining another anatomy table.
source = (ROOT / 'app/src/engine/anatomy/dimensions.ts').read_text()
def measurement(section, key):
    block = re.search(r'\b' + section + r':\s*\{(.*?)\n  \}', source, re.S).group(1)
    return float(re.search(r'\b' + key + r':\s*([\d.]+)', block).group(1))
OUTER = measurement('limbus', 'diameter') / 2
iris_source = (ROOT / 'app/src/engine/anatomy/iris.ts').read_text()
INNER = float(re.search(r'pupilMm:\s*([\d.]+)', iris_source).group(1)) / 2
THICKNESS = measurement('iris', 'thickness')
TAU = math.tau
rng = random.Random(47)
CRYPTS = [(rng.random()*TAU, rng.uniform(.37,.62), rng.uniform(.008,.028), rng.uniform(.035,.11)) for _ in range(49)]

def detail(a, r):
    # Sculptural fractions of iris thickness, not new anatomical measurements.
    organic = noise.noise(Vector((math.cos(a)*12,math.sin(a)*12,r*8)))
    warp = a + 0.014 * math.sin(7*a + 9*r) + 0.009 * organic
    fibres = (0.48*math.sin(173*warp + 3*r) + 0.27*math.sin(281*warp - 5*r)
              + 0.16*math.sin(397*warp + 8*r))
    ridge_r = 0.36 + 0.035*math.sin(17*a) + 0.018*math.sin(43*a)
    ridge = math.exp(-((r-ridge_r)/0.055)**2)
    crypts = sum(math.exp(-((math.atan2(math.sin(a-ca),math.cos(a-ca))/wa)**2 + ((r-cr)/wr)**2)) for ca,cr,wa,wr in CRYPTS)
    furrows = math.sin(90*r + 2*math.sin(13*a)) * max(0, (r-0.68)/0.32)
    envelope = math.sin(math.pi*r)**0.5
    return THICKNESS*(0.10*fibres*envelope*(0.7+organic) + 0.12*ridge - 0.2*crypts + 0.035*furrows)

def annulus(name, angular, radial, sculpted):
    vertices, faces, coords, heights = [], [], [], []
    for j in range(radial+1):
        r = j/radial
        radius = INNER + (OUTER-INNER)*r
        for i in range(angular+1):
            a = TAU*i/angular
            h = detail(a, r) if sculpted else 0
            vertices.append((radius*math.cos(a), radius*math.sin(a), h))
            coords.append((i/angular, r))
            heights.append(h)
    for j in range(radial):
        for i in range(angular):
            n = j*(angular+1)+i
            faces.append((n, n+angular+1, n+angular+2, n+1))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    uv = mesh.uv_layers.new(name='polar')
    for polygon in mesh.polygons:
        polygon.use_smooth = True
        for loop in polygon.loop_indices:
            uv.data[loop].uv = coords[mesh.loops[loop].vertex_index]
    if sculpted:
        colour = mesh.color_attributes.new(name='relief', type='FLOAT_COLOR', domain='POINT')
        for index, height in enumerate(heights):
            v = max(0, min(1, 0.5 + height/THICKNESS*2))
            colour.data[index].color = (v, v, v, 1)
    return obj

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 0.001
scene.render.engine = 'CYCLES'
scene.cycles.samples = 8
scene.cycles.seed = 17
scene.render.bake.use_selected_to_active = True
scene.render.bake.cage_extrusion = THICKNESS
scene.render.bake.max_ray_distance = THICKNESS*2
scene.render.bake.margin = 4
scene.render.image_settings.color_mode = 'RGB'
scene.view_settings.view_transform = 'Standard'
high = annulus('Iris sculpt — neutral microstructure', 1024, 128, True)
low = annulus('Iris bake receiver — polar UV', 128, 32, False)

high_material = bpy.data.materials.new('Neutral relief')
high_material.use_nodes = True
nodes = high_material.node_tree.nodes
nodes.clear()
attribute = nodes.new('ShaderNodeVertexColor'); attribute.layer_name = 'relief'
emission = nodes.new('ShaderNodeEmission')
output = nodes.new('ShaderNodeOutputMaterial')
high_material.node_tree.links.new(attribute.outputs['Color'], emission.inputs['Color'])
high_material.node_tree.links.new(emission.outputs[0], output.inputs['Surface'])
high.data.materials.append(high_material)
low_material = bpy.data.materials.new('Bake target'); low_material.use_nodes = True
low.data.materials.append(low_material)
target = low_material.node_tree.nodes.new('ShaderNodeTexImage')
low_material.node_tree.nodes.active = target
for obj in bpy.context.selected_objects: obj.select_set(False)
high.select_set(True); low.select_set(True)
bpy.context.view_layer.objects.active = low
for name, bake in [('iris-normal', 'NORMAL'), ('iris-relief', 'EMIT')]:
    image = bpy.data.images.new(name, width=1024, height=256, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    target.image = image
    bpy.ops.object.bake(type=bake)
    image.filepath_raw = str(OUT / (name + '.png'))
    image.file_format = 'PNG'
    image.save()
    image.pack()
    print('BAKED', image.filepath_raw, flush=True)
# Store a useful editable sculpt, rather than only a bake receiver.
low.hide_render = True
low.hide_set(True)
scene.render.bake.use_selected_to_active = False
high.select_set(True)
bpy.context.view_layer.objects.active = high
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-src/eye.blend'), compress=True)
manifest = {}
for path in sorted(OUT.glob('*.png')):
    manifest[path.name] = {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}
(OUT/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
rows = '\n'.join(f'| {name} | Blender Cycles, build-eye.py | Afterlight project | Self-authored, project licence | {entry["sha256"]} |' for name, entry in manifest.items())
(ROOT/'assets-src/ASSETS.md').write_text('''# Asset manifest

Neutral iris surface detail, authored locally with Blender. No photographs or third-party assets.
Colour, pupil diameter, vessel patterns and condition parameters remain procedural.

Regenerate with `blender --background --python assets-src/build-eye.py` (Blender 5.2 LTS).
`eye.blend` preserves the editable high-resolution sculpt and the polar-UV bake receiver.
Run `blender --background assets-src/eye.blend --python assets-src/preview-eye.py` for the
full eye scene and the separate Cycles material study.
`iris-normal.png` is a tangent-space normal bake; `iris-relief.png` is a linear neutral relief mask.
The scene units represent millimetres. Dimensions are read from `dimensions.ts`.

| File | Origin | Author | Licence | SHA-256 |
|---|---|---|---|---|
'''+rows+'\n')
print('DONE', json.dumps(manifest), flush=True)
