"""Rebuild the shared compact-world props; see README for unit and collision contract."""
import bpy, math, os, json, sys
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
ART = ROOT/'game/art/environment-lab/world-props'
OUT = ROOT/'game/public/assets/environment-lab'
ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
preview = '--preview' in ARGS
look = int(ARGS[ARGS.index('--look')+1]) if '--look' in ARGS else 4
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, rgb, rough=0.85):
 m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*rgb,1); bs.inputs['Roughness'].default_value=rough
 return m
wood=material('Warm wood',(.29,.16,.07)); lightwood=material('Cut wood',(.46,.28,.12)); trim=material('Iron trim',(.16,.20,.20));
stone=material('Soft grey stone',(.40,.43,.39)); stone_light=material('Stone edges',(.53,.54,.47));
green=material('Deep foliage',(.12,.29,.07)); green_light=material('Foliage highlights',(.23,.41,.10));
blue=material('Camp blue',(.055,.22,.42)); gold=material('Lantern gold',(.91,.57,.10)); flame=material('Fire orange',(.95,.27,.025)); core=material('Fire glow',(.98,.70,.08));
gold.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(1,.48,.08,1)
gold.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=1.5
# Semantically named visible-surface clearances (metres); the front faces do not compete.
assert (-.43 + .025/2) <= (-.82/2 - .005)       # crate strips outside crate face
assert (-.458 + .018/2) <= (-.43 - .025/2 - .005) # iron bands outside strips
assert (-.096 + .018/2) <= (-.015 - .13/2 - .005) # emblem outside sign
assert (-.15 + .018/2) <= (-.26/2 - .005)       # glass outside lantern frame
# Later passes refine the first blockout's contrast, readable silhouette and brightness.
if look == 1:
 green.diffuse_color=(.27,.42,.12,1); blue.diffuse_color=(.2,.35,.52,1)
 for m in [green,blue]: m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=m.diffuse_color
if look >= 3:
 gold.diffuse_color=(.82,.48,.07,1); gold.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=gold.diffuse_color

def attach(o, anchor, mat, name):
 o.name=name; o.parent=anchor; o.data.materials.append(mat); return o

def box(anchor,name,loc,scale,mat,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc,rotation=rot);o=bpy.context.object;o.scale=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return attach(o,anchor,mat,name)

def cyl(anchor,name,loc,r,depth,mat,rot=(0,0,0),vertices=10):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc,rotation=rot);return attach(bpy.context.object,anchor,mat,name)

def ico(anchor,name,loc,scale,mat,subdiv=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv,radius=1,location=loc);o=bpy.context.object;o.scale=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return attach(o,anchor,mat,name)

def cone(anchor,name,loc,r,depth,mat,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=r,depth=depth,location=loc,rotation=rot);return attach(bpy.context.object,anchor,mat,name)

def anchor(kind,x,z,yaw=0):
 o=bpy.data.objects.new(f'{kind} anchor',None);bpy.context.collection.objects.link(o);o.location=(x,-z,0);o.rotation_euler.z=yaw;return o

def make(kind,x,z,yaw=0):
 a=anchor(kind,x,z,yaw)
 if kind=='campfire':
  for i in range(9):
   angle=2*math.pi*i/9;ico(a,'fire stone',(math.cos(angle)*.62,math.sin(angle)*.62,.12),(.18,.15,.11),stone_light)
  cyl(a,'fire log A',(0,0,.17),.11,1.05,wood,rot=(0,math.pi/2,0));cyl(a,'fire log B',(0,0,.19),.11,1.05,lightwood,rot=(math.pi/2,0,0))
  cone(a,'outer flame',(0,0,.55),.25,.75,flame);cone(a,'inner flame',(.03,-.03,.46),.13,.55,core)
  if look>=3:
   cone(a,'side flame',(-.15,.06,.39),.11,.42,flame,rot=(0,-.22,0))
   cone(a,'side flame',(.16,.04,.38),.10,.38,core,rot=(0,.18,0))
 elif kind=='crate':
  box(a,'crate body',(0,0,.43),(.82,.82,.86),wood)
  for xx in [-.33,.33]: box(a,'front plank',(xx,-.43,.43),(.07,.025,.85),lightwood)
  for zz in [.10,.76]: box(a,'front band',(0,-.458,zz),(.82,.018,.065),trim)
  for yy in [-.32,.32]: box(a,'top plank',(0,yy,.873),(.82,.07,.025),lightwood)
  if look>=3: box(a,'front brace',(0,-.485,.43),(.06,.018,.78),lightwood,rot=(0,math.pi/4,0))
 elif kind=='sign':
  cyl(a,'sign post',(0,0,.9),.075,1.8,wood)
  box(a,'sign board',(0,-.015,1.4),(1.3,.13,.38),lightwood)
  # A blue emblem identifies the route without suggesting a misleading direction.
  box(a,'sign emblem',(0,-.096,1.4),(.19,.018,.19),blue,rot=(0,math.pi/4,0))
 elif kind=='lantern':
  # A warm four-sided lantern with open, slender framing and a hanging bail.
  cyl(a,'lantern post',(0,0,.91),.075,1.82,wood,vertices=12)
  cyl(a,'post cap',(0,0,1.85),.11,.07,trim,vertices=12)
  box(a,'lantern arm',(.23,0,1.75),(.55,.10,.10),wood)
  cyl(a,'lantern hook',(.46,0,1.61),.026,.24,trim,vertices=10)
  box(a,'lantern bottom',(.46,0,1.22),(.35,.34,.06),trim)
  box(a,'lantern crown',(.46,0,1.57),(.35,.34,.06),trim)
  for xx in (.31,.61):
   for yy in (-.14,.14):box(a,'lantern frame', (xx,yy,1.395),(.035,.035,.31),trim)
  # Four panes sit just outside the support frame; all directions read as lit.
  for yy in (-.149,.149):box(a,'lantern glowing glass',(.46,yy,1.395),(.27,.018,.27),gold)
  for xx in (.301,.619):box(a,'lantern glowing glass',(xx,0,1.395),(.018,.25,.27),gold)
  cone(a,'lantern roof',(.46,0,1.66),.25,.18,trim)
  cyl(a,'lantern finial',(.46,0,1.78),.035,.08,trim)
 elif kind=='rock':
  ico(a,'large rock',(-.20,.04,.30),(.62,.46,.34),stone,2)
  ico(a,'small rock',(.48,-.18,.18),(.31,.28,.21),stone_light,1)
  ico(a,'small rock',(-.55,.35,.13),(.25,.22,.16),stone,1)
 elif kind=='bush':
  for xx,yy,zz,s in [(-.47,0,.40,.52),(.42,.10,.40,.48),(0,.10,.57,.58),(0,-.36,.35,.38)]:
   ico(a,'bush leaf',(xx,yy,zz),(s,s*.8,s*.75),green_light if xx<0 else green,2)
 elif kind=='ruin':
  for xx in [-1.2,1.2]:
   for j in range(4): box(a,'ruin block',(xx,0,.25+j*.50),(.57,.62,.48),stone_light if j==3 else stone)
   box(a,'ruin cap',(xx,0,2.13),(.72,.75,.20),stone_light)
  box(a,'ruin lintel',(0,0,2.28),(2.9,.68,.25),stone)
  if look>=2:
   box(a,'blue banner',(0,-.352,1.70),(.55,.025,.70),blue)
   box(a,'banner rod',(0,-.39,2.07),(.68,.045,.05),wood)
  if look>=4:
   box(a,'fallen ruin stone',(-1.8,.3,.16),(.50,.46,.32),stone_light,rot=(0,0,.35))
   box(a,'broken stone',(.85,.10,2.51),(.55,.52,.20),stone_light,rot=(0,0,-.12))
 return a

if preview:
 placements=[{'kind':k,'x':x,'z':0} for k,x in [('campfire',-6),('crate',-3.5),('sign',-1),('lantern',1.5),('rock',3.5),('bush',5.5),('ruin',8.5)]]
else:
 placements=json.loads((ROOT/'game/src/scenes/world-props.json').read_text())['placements']
for p in placements: make(p['kind'],p['x'],p['z'],p.get('yaw',0))
bpy.context.view_layer.update()

if not preview:
 # Bake world transforms so grouped materials remain independently reproducible in glTF.
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 for o in meshes:
  world=o.matrix_world.copy();o.parent=None;o.matrix_world=Matrix.Identity(4);o.data.transform(world)
 for mat in list(bpy.data.materials):
  group=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.materials) and o.data.materials[0]==mat]
  if not group: continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in group:o.select_set(True)
  bpy.context.view_layer.objects.active=group[0]
  if len(group)>1:bpy.ops.object.join()
  bpy.context.object.name='world-props-'+mat.name.replace(' ','-').lower()
 bpy.ops.object.select_all(action='DESELECT')
 for o in bpy.context.scene.objects:
  if o.type=='MESH':o.select_set(True)
 OUT.mkdir(parents=True,exist_ok=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(ART/'world-props.blend'))
 bpy.ops.export_scene.gltf(filepath=str(OUT/'world-props.glb'),export_format='GLB',use_selection=True,export_extras=True)
 print('EXPORTED',OUT/'world-props.glb')
else:
 floor=material('Review floor',(.24,.34,.20));bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.035));bpy.context.object.data.materials.append(floor)
 world=bpy.data.worlds.new('Review world');bpy.context.scene.world=world;world.color=(.25,.25,.25)
 bpy.ops.object.light_add(type='AREA',location=(0,-6,13));light=bpy.context.object;light.data.energy=1800;light.data.shape='DISK';light.data.size=10
 bpy.ops.object.camera_add(location=(7,-19,10));cam=bpy.context.object;cam.rotation_euler=(Vector((1.1,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=19.5;bpy.context.scene.camera=cam
 scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1400;scene.render.resolution_y=700;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';
 output=ROOT/'out/world-props';output.mkdir(parents=True,exist_ok=True);scene.render.filepath=str(output/f'look-{look}.png');bpy.ops.render.render(write_still=True)
