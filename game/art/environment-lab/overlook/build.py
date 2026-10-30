"""Create a small raised lookout and supporting props from the shared layout."""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[4]; ART=ROOT/'game/art/environment-lab/overlook'; OUT=ROOT/'game/public/assets/environment-lab'
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
preview='--preview' in args
look=int(args[args.index('--look')+1]) if '--look' in args else 4
layout=json.loads((ROOT/'game/src/scenes/overlook-layout.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name,color,rough=.9):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;return m
stone=mat('Lookout stone',(.39,.43,.38)); pale=mat('Lookout stone top',(.53,.55,.46)); shadow=mat('Stone joints',(.28,.33,.29)); wood=mat('Lookout wood',(.31,.18,.075)); woodlight=mat('Cut planks',(.45,.28,.12)); blue=mat('Banner blue',(.055,.22,.45)); metal=mat('Iron bands',(.14,.18,.19)); gold=mat('Lamp gold',(.95,.63,.16)); moss=mat('Moss green',(.23,.34,.12)); sack=mat('Canvas',(.55,.47,.32))
def box(name,loc,size,material,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc,rotation=rot);o=bpy.context.object;o.name=name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material);return o
def cyl(name,loc,r,depth,material,vertices=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(material);return o
def ico(name,loc,scale,material,subdiv=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material);return o
def pos(entry):return entry['x'],-entry['z']
p=layout['platform'];x,y=pos(p);w=p['width'];d=p['depth'];h=p['height'];rw=p['rampWidth'];rl=p['rampLength']
box('Lookout base',(x,y,h/2),(w,d,h),stone)
# Stone facing breaks the flat base into chunky, readable blocks.
for side in [-1,1]:
 for j in range(4):
  box('Side facing',(x+side*(w/2+.012),y-d/2+(j+.5)*d/4,.44),(.024,d/4-.04,.80),pale if j%2 else stone)
for i in range(5):
 for j in range(4):
  box('Deck flagstone',(x-w/2+(i+.5)*w/5,y-d/2+(j+.5)*d/4,h+.008),(w/5-.035,d/4-.035,.016),pale if (i+j)%3 else stone)
# A solid wedge, with its lower edge facing camp. Its visual top follows the
# same equation as the game's height function.
y0=y-d/2-rl;y1=y-d/2
verts=[(x-rw/2,y0,0),(x+rw/2,y0,0),(x+rw/2,y1,0),(x-rw/2,y1,0),(x-rw/2,y1,h),(x+rw/2,y1,h)]
faces=[(0,1,5,4),(0,4,3),(1,2,5),(3,4,5,2),(0,3,2,1)]
mesh=bpy.data.meshes.new('Ramp wedge');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Ramp wedge',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(pale)
if look>=2:
 for side in [-1,1]:
  for j in [-1,1]:
   box('Lookout corner stone',(x+side*(w/2-.16),y+j*(d/2-.16),h+.20),(.32,.32,.40),stone)
  box('Lookout side edge',(x+side*(w/2-.08),y,h+.08),(.16,d-.35,.16),stone)
 box('Back edge',(x,y+d/2-.08,h+.08),(w-.35,.16,.16),stone)
if look>=3:
 for i in range(1,5):
  yy=y0+rl*i/5;zz=h*i/5+.008
  box('Ramp joint',(x,yy,zz),(rw-.10,.035,.018),shadow)
 for i in range(4):
  box('Moss patch',(x-w/2+.5+i*1.2,y+d/2-.3,h+.018),(.28,.09,.018),moss)
if look>=4:
 for side in [-1,1]:
  box('Blue lookout band',(x+side*(w/2-.16),y+d/2-.17,h+.18),(.34,.34,.10),blue)
# Roofed camp well, with an open dark centre and wooden crossbeam.
x,y=pos(layout['well'])
cyl('Well stone body',(x,y,.45),.75,.90,stone,16)
cyl('Well water',(x,y,.911),.53,.025,shadow,16)
for i in range(12):
 a=2*math.pi*i/12;box('Well cap stone',(x+.66*math.cos(a),y+.66*math.sin(a),.99),(.32,.22,.15),pale,rot=(0,0,a))
for dx in [-.67,.67]:box('Well upright',(x+dx,y,1.55),(.12,.14,2.2),wood)
box('Well roof beam',(x,y,2.55),(1.7,.12,.12),wood)
for side in [-1,1]:box('Well blue roof',(x,y+side*.35,2.45),(1.72,.80,.11),blue,rot=(side*.28,0,0))
box('Well axle',(x,y,1.73),(1.6,.09,.09),woodlight)
# Barrel and sack make the camp feel occupied without closing its clearing.
x,y=pos(layout['supplies']);cyl('Barrel',(x,y,.43),.38,.86,woodlight,14)
for zz in [.18,.67]:cyl('Barrel iron hoop',(x,y,zz),.395,.07,metal,14)
ico('Canvas sack',(x+.64,y+.07,.26),(.32,.27,.30),sack,2);cyl('Sack neck',(x+.64,y+.07,.53),.12,.10,sack)
# A stone waymarker holds a small amber lantern; illumination is separate.
x,y=pos(layout['waymarker']);box('Marker base',(x,y,.17),(.75,.75,.34),stone);box('Marker stone',(x,y,.82),(.38,.38,1.25),pale);box('Marker blue band',(x,y,1.22),(.40,.40,.10),blue)
box('Marker bracket',(x+.30,y,1.43),(.52,.08,.08),wood);box('Marker lantern',(x+.52,y,1.18),(.24,.24,.33),metal);box('Marker lamp',(x+.52,y-.13,1.18),(.16,.02,.22),gold)
# Static objects are grouped by material to bound draw calls.
for material in list(bpy.data.materials):
 group=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==material]
 if not group:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0]
 if len(group)>1:bpy.ops.object.join()
 bpy.context.object.name='overlook-'+material.name.replace(' ','-').lower()
 bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
if not preview:
 bpy.ops.object.select_all(action='SELECT'); OUT.mkdir(parents=True,exist_ok=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(ART/'overlook.blend'))
 bpy.ops.export_scene.gltf(filepath=str(OUT/'overlook-kit.glb'),export_format='GLB',use_selection=True,export_extras=True)
 print('EXPORTED',OUT/'overlook-kit.glb')
else:
 # Wide overview chosen before modeling; sees platform, ramp and the props.
 bpy.ops.mesh.primitive_plane_add(size=100,location=(0,0,-.04));bpy.context.object.data.materials.append(mat('Preview floor',(.28,.38,.23)))
 world=bpy.data.worlds.new('Preview world');bpy.context.scene.world=world;world.color=(.22,.22,.22)
 bpy.ops.object.light_add(type='AREA',location=(3,-3,18));light=bpy.context.object;light.data.energy=2300;light.data.size=14
 bpy.ops.object.camera_add(location=(17,-6,18));cam=bpy.context.object;cam.rotation_euler=(Vector((2,4,.5))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=36;bpy.context.scene.camera=cam
 scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';out=ROOT/'out/overlook';out.mkdir(parents=True,exist_ok=True);scene.render.filepath=str(out/f'look-{look}.png');bpy.ops.render.render(write_still=True)
