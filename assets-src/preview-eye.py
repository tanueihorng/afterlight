"""Prepare the editable full-eye Blender scene and a Cycles material study.
Run after build-eye.py: blender -b assets-src/eye.blend --python assets-src/preview-eye.py
"""
from pathlib import Path
import math
import re
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
source = (ROOT/'app/src/engine/anatomy/dimensions.ts').read_text()
def dim(section, key):
    block = re.search(r'\b'+section+r':\s*\{(.*?)\n  \}',source,re.S).group(1)
    return float(re.search(r'\b'+key+r':\s*(-?[\d.]+)',block).group(1))
def top(key):
    return float(re.search(r'\b'+key+r':\s*([\d.]+)',source).group(1))
R=top('axialLength')/2
limbus=dim('limbus','diameter')/2
limbus_z=math.sqrt(R*R-limbus*limbus)
rc=dim('cornea','anteriorRadius')
q=dim('cornea','Q')
def sag(r): return r*r/(rc*(1+math.sqrt(1-(1+q)*(r/rc)**2)))
apex=limbus_z+sag(limbus)
iris_z=apex-dim('cornea','centralThickness')-dim('anteriorChamber','depth')
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.cycles.max_bounces=12;scene.cycles.transmission_bounces=8
scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(0.10,0.12,0.15,1)
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=0.35

def material(name, colour, roughness):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*colour,1)
    bsdf.inputs['Roughness'].default_value=roughness
    return mat,bsdf

def lathe(name, profile, mat):
    vertices=[];faces=[];segments=192
    for radius,z in profile:
        for i in range(segments):
            a=math.tau*i/segments
            vertices.append((radius*math.cos(a),radius*math.sin(a),z))
    for j in range(len(profile)-1):
        for i in range(segments):
            ni=(i+1)%segments
            n=j*segments
            faces.append((n+i,n+i+segments,n+ni+segments,n+ni))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for polygon in mesh.polygons: polygon.use_smooth=True
    return obj

sclera,skin=material('Sclera — moist ivory',(.62,.55,.46),.3)
skin.inputs['Subsurface Weight'].default_value=.12
skin.inputs['Subsurface Radius'].default_value=(1,.45,.25)
skin.inputs['Coat Weight'].default_value=.2
nodes=sclera.node_tree.nodes;links=sclera.node_tree.links
noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=105
bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.018
links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],skin.inputs['Normal'])
start=math.asin(limbus/R)
profile=[(R*math.sin(start+(math.pi-start)*j/128),R*math.cos(start+(math.pi-start)*j/128)) for j in range(129)]
shell=lathe('Sclera — open limbus',profile,sclera)
shell.scale.x=top('horizontalDiameter')/top('axialLength')
shell.scale.y=top('verticalDiameter')/top('axialLength')

iris=bpy.data.objects.get('Iris sculpt — neutral microstructure')
iris.location.z=iris_z
iris_mat,iris_shader=material('Iris — pigment over sculpted fibres',(.15,.07,.02),.64)
nodes=iris_mat.node_tree.nodes;links=iris_mat.node_tree.links
attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='relief'
ramp=nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position=.12;ramp.color_ramp.elements[0].color=(.022,.009,.003,1)
ramp.color_ramp.elements[1].position=.82;ramp.color_ramp.elements[1].color=(.24,.135,.052,1)
mid=ramp.color_ramp.elements.new(.52);mid.color=(.095,.055,.021,1)
links.new(attr.outputs['Color'],ramp.inputs[0]);links.new(ramp.outputs[0],iris_shader.inputs['Base Color'])
iris.data.materials.clear();iris.data.materials.append(iris_mat)

black,_=material('Pupil well',(.0004,.0003,.0002),1)
lathe('Pupil',[(0,iris_z-.06),(dim('iris','pupilMin')*1.01,iris_z-.06)],black)
cornea,glass=material('Cornea — clear refractive surface',(1,1,1),.012)
glass.inputs['Transmission Weight'].default_value=1
glass.inputs['IOR'].default_value=dim('cornea','ior')
cap=lathe('Cornea',[(limbus*j/96,apex-sag(limbus*j/96)) for j in range(97)],cornea)
solid=cap.modifiers.new('Central thickness','SOLIDIFY');solid.thickness=dim('cornea','centralThickness');solid.offset=-1

lens_mat,lens_shader=material('Lens',(1,.98,.91),.035)
lens_shader.inputs['Transmission Weight'].default_value=1
bpy.ops.mesh.primitive_uv_sphere_add(segments=96,ring_count=48,location=(0,0,iris_z-dim('lens','thickness')/2))
lens=bpy.context.object;lens.name='Lens';lens.scale=(dim('lens','diameter')/2,dim('lens','diameter')/2,dim('lens','thickness')/2)
lens.data.materials.append(lens_mat)
for poly in lens.data.polygons:poly.use_smooth=True
retina_mat,_=material('Retina — neutral lining',(.32,.085,.035),.72)
r=R-dim('sclera','thicknessPosterior')
lathe('Retina — posterior bowl',[(r*math.sin(math.pi/2+math.pi/2*j/64),r*math.cos(math.pi/2+math.pi/2*j/64)) for j in range(65)],retina_mat)

def area(name,position,power,size,colour):
    light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=size;light.color=colour
    obj=bpy.data.objects.new(name,light);bpy.context.collection.objects.link(obj);obj.location=position
    obj.rotation_euler=(Vector((0,0,3))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Large softbox',(-22,25,35),6500,18,(1,.91,.8))
area('Soft fill',(25,-6,22),2400,22,(.76,.86,1))
area('Edge light',(-15,9,-15),2200,15,(1,.91,.78))
cam_data=bpy.data.cameras.new('Eye study camera');cam=bpy.data.objects.new('Eye study camera',cam_data)
bpy.context.collection.objects.link(cam);scene.camera=cam
cam.location=(9,-3,53);cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler()
cam_data.type='ORTHO';cam_data.ortho_scale=31;cam_data.lens=70
boundary=re.search(r'export const GENERIC_MODEL_BOUNDARY =\s*"([^"]+)"',(ROOT/'app/src/engine/index.ts').read_text()).group(1)
import textwrap
text=bpy.data.curves.new('Educational boundary','FONT');text.body='\n'.join(textwrap.wrap(boundary,74));text.size=.44;text.align_x='CENTER'
label=bpy.data.objects.new('Generic model boundary',text);bpy.context.collection.objects.link(label)
label.parent=cam;label.location=(0,-13.3,-30)
label_material=bpy.data.materials.new('Boundary text');label_material.use_nodes=True
nodes=label_material.node_tree.nodes;nodes.clear();em=nodes.new('ShaderNodeEmission');em.inputs[0].default_value=(.7,.73,.78,1)
out=nodes.new('ShaderNodeOutputMaterial');label_material.node_tree.links.new(em.outputs[0],out.inputs[0]);text.materials.append(label_material)
scene.render.filepath=str(ROOT/'assets-src/eye-study.png')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-src/eye.blend'),compress=True)
bpy.ops.render.render(write_still=True)
print('Full Blender scene and eye-study.png saved',flush=True)
