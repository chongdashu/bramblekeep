"""Courtyard barracks and paving. Blender Z-up, game Y-up, metres, world pivot."""
import bpy, json, math, random
from pathlib import Path
root=Path(__file__).resolve().parents[4]
layout=json.loads((root/'game/src/scenes/courtyard-layout.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.93
 return m
stone=material('Courtyard stone',(.18,.21,.23));edge=material('Barracks trim',(.27,.30,.30));dark=material('Barracks entry',(.035,.045,.055));roof=material('Barracks blue roof',(.06,.10,.16));wood=material('Barracks timber',(.27,.18,.11));ground=material('Courtyard paving',(.32,.35,.33));pavers=material('Worn paving stones',(.345,.37,.35));banner=material('Barracks banner',(.12,.24,.34))
masonry=[material('Wall block %d'%i,c) for i,c in enumerate([(.24,.27,.28),(.27,.30,.30),(.29,.31,.30),(.25,.28,.29)])]
gold=material('Courtyard aged gold',(.48,.31,.11));cloth=material('Heraldic midnight blue',(.055,.12,.20));leaf=material('Garden ivy',(.09,.22,.09));leaf_light=material('Garden leaves',(.16,.31,.10));soil=material('Planter soil',(.13,.10,.065));flower=material('Garden blossom',(.71,.48,.50));flower_light=material('Garden pale blossom',(.70,.70,.48));metal=material('Sconce bronze',(.23,.15,.07))
# A lightly worn stone surface: tileable and subtle at game-camera scale.
img=bpy.data.images.new('Courtyard worn stone',width=128,height=128,alpha=True)
rr=random.Random(42);pixels=[]
for j in range(128):
 for i in range(128):
  u=2*math.pi*i/128;v=2*math.pi*j/128
  grain=.018*math.sin(3*u+math.sin(2*v))*math.sin(2*v-u)+rr.uniform(-.006,.006)
  pixels.extend((.345+grain,.37+grain,.35+grain,1))
img.pixels=pixels;img.pack();node=pavers.node_tree.nodes.new('ShaderNodeTexImage');node.image=img
pavers.node_tree.links.new(node.outputs['Color'],pavers.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
portal=material('Spawn portal glow',(.34,.08,.42));p=portal.node_tree.nodes['Principled BSDF'];p.inputs['Emission Color'].default_value=(.45,.08,.6,1);p.inputs['Emission Strength'].default_value=1.7
def box(name,x,z,y,sx,sz,sy,mat,rot_y=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y),rotation=(0,rot_y,0));o=bpy.context.object;o.name=name;o.scale=(sx,sz,sy);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);return o

def ico(name,x,z,y,sx,sz,sy,mat):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=(sx,sz,sy);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)

def cylinder(name,x,z,y,r,depth,mat):
 bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=depth,location=(x,-z,y));o=bpy.context.object;o.name=name;o.data.materials.append(mat)

# Narrow paved arena leaves the grassy margins and the gate passage clear.
box('Courtyard foundation',0,-29.10,.012,17.2,17.6,.024,ground)
# Small inset slabs create scale and a worn route without trip hazards.
rng=random.Random(2026)
for row in range(25):
 z=-20.7-row*.69
 for col in range(-8,9):
  x=col*.95+(row%2)*.46+rng.uniform(-.035,.035)
  if abs(x)>8.15 or rng.random()<.09:continue
  w=rng.uniform(.80,.90);d=rng.uniform(.55,.62)
  box('Paving slab',x,z,.027,w,d,.006,pavers)
for b in layout['barracks']:
 x=b['x']; front=b['front'];back=b['back'];mid=(front+back)/2
 # Three walls and a lintel leave a real, broad dark doorway facing the arena.
 box('Barracks left wall',x-1.23,mid,1.35,.34,3.0,2.7,stone)
 box('Barracks right wall',x+1.23,mid,1.35,.34,3.0,2.7,stone)
 box('Barracks back wall',x,back+.16,1.35,2.8,.32,2.7,stone)
 box('Entry shadow',x,front+.04,1.04,2.05,.06,2.0,dark)
 box('Door lintel',x,front,2.35,2.8,.32,.7,stone)
 for dx in (-1.17,1.17):
  box('Door jamb',x+dx,front+.12,1.12,.28,.18,2.24,edge)
  for y in (.43,1.18,1.92): box('Stone joint',x+dx,front+.23,y,.31,.055,.045,stone)
 box('Door cap',x,front+.12,2.65,2.92,.22,.20,edge)
 # Broad sloped gable roof; no overhanging ridge enters the adjacent keep.
 verts=[(x-1.55,-front+.3,2.7),(x+1.55,-front+.3,2.7),(x,-front+.3,3.55),(x-1.55,-back-.3,2.7),(x+1.55,-back-.3,2.7),(x,-back-.3,3.55)]
 faces=[(0,2,1),(3,4,5),(0,3,5,2),(1,2,5,4)]
 mesh=bpy.data.meshes.new('Gable roof');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Gable roof',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(roof)
 # Matching violet sigils and threshold lights identify the two active spawners.
 box('Portal lintel light',x,front+.25,2.09,1.82,.035,.055,portal)
 for dx in (-1.01,1.01):box('Portal jamb light',x+dx,front+.25,1.08,.055,.035,1.90,portal)
 box('Banner',x,front+.21,2.39,.68,.04,.52,banner)
 box('Spawn diamond',x,front+.25,2.39,.23,.035,.23,portal)
 for dx in (-.32,.32):box('Spawn marking',x+dx,front+.25,2.39,.07,.035,.23,portal)
 # Timber posts frame the entrance without crossing its opening.
 for dx in (-.95,.95):box('Door frame',x+dx,front+.20,1.06,.11,.07,2.12,wood)
# Visible masonry courses live just in front of the solid runtime walls.
# The inner faces stay inside the existing collision boundaries.
for row in range(7):
 y=.34+row*.56
 for col in range(-11,11):
  x=col*.98+(row%2)*.49
  if abs(x)>10.65:continue
  box('Rear wall ashlar',x,-38.82,y,.94,.10,.52,rng.choice(masonry))
 for side in (-1,1):
  for col in range(19):
   z=-20.5-col*.95+(row%2)*.47
   if z < -38.8:continue
   box('Side wall ashlar',side*9.82,z,y,.10,.90,.52,rng.choice(masonry))
# A thin cornice and low sill visually unify the older engine curtain walls.
box('Rear wall sill',0,-38.72,.18,20.8,.16,.20,edge)
box('Rear wall cornice',0,-38.72,4.05,20.8,.16,.16,edge)
for side in (-1,1):
 box('Side wall sill',side*9.72,-29.5,.18,.16,18.4,.20,edge)
 box('Side wall cornice',side*9.72,-29.5,4.05,.16,18.4,.16,edge)
# Stone voussoirs turn each entry into a recognizable arch. All geometry is
# fixed to the existing doorway; no new obstacles enter its spawn corridor.
for b in layout['barracks']:
 x=b['x'];front=b['front']
 for i in range(11):
  a=math.pi*(i+.5)/11;rx=x+1.09*math.cos(a);h=1.42+1.09*math.sin(a)
  box('Portal arch stone',rx,front+.32,h,.31,.16,.28,rng.choice(masonry),math.pi/2-a)
  rx=x+.91*math.cos(a);h=1.42+.91*math.sin(a)
  box('Portal arch light',rx,front+.42,h,.28,.035,.045,portal,math.pi/2-a)
 for side in (-1,1):
  box('Portal stone footing',x+side*1.29,front+.26,.23,.35,.28,.43,edge)
  for row in range(3):box('Portal pillar block',x+side*1.25,front+.30,.66+row*.46,.29,.20,.40,rng.choice(masonry))
 # Roofline and front shield keep the portals related to the surrounding keep.
 box('Portal roof fascia',x,front+.25,2.72,3.18,.16,.16,edge)
 for side in (-1,1):
  for dx in (.38,.82,1.20):
   h=3.55-dx*.55
   box('Roof seam',x+side*dx,(front+back)/2,h,.045,3.50,.07,edge,side*.50)

# Keep the guardian's arena free of circles and radial markings.
# Rear garden edges are solid planters; the same layout is used for collision.
for planter in layout['planters']:
 x=planter['x'];z=planter['z'];width=2*planter['halfWidth'];depth=2*planter['halfDepth']
 box('Planter stone',x,z,.31,width,depth,.62,stone)
 box('Planter lip',x,z,.64,width+.08,depth+.08,.08,edge)
 box('Planter soil',x,z,.69,width-.12,depth-.12,.05,soil)
 for i in range(13):
  px=x-width*.43+i*(width*.86/12);pz=z+rng.uniform(-.17,.17)
  ico('Planter foliage',px,pz,.79,rng.uniform(.20,.34),.22,rng.uniform(.15,.24),leaf_light if i%3==0 else leaf)
  if i%2==0:ico('Planter flower',px+rng.uniform(-.10,.10),pz,.94,.09,.09,.10,flower if i%4 else flower_light)
# Rear heraldic banners hang above the planting, bordered in brass.
for x in (-3.4,3.4):
 z=-38.70
 box('Banner cloth',x,z,2.65,.88,.045,1.90,cloth)
 for side in (-1,1):box('Banner gold edge',x+side*.43,z+.03,2.65,.035,.025,1.90,gold)
 box('Banner top bar',x,z+.04,3.62,1.08,.06,.07,gold)
 # Simple upright gold device remains legible at game scale.
 box('Banner device',x,z+.05,2.70,.12,.025,.66,gold)
 for side in (-1,1):box('Banner device wing',x+side*.16,z+.05,2.71,.18,.025,.12,gold,side*.4)
 box('Banner device foot',x,z+.05,2.42,.30,.025,.08,gold)
# Side-wall banners face the arena, in the same heraldry as the rear wall.
for side in (-1,1):
 for z in (-25.0,-34.0):
  x=side*9.68
  box('Side banner cloth',x,z,2.65,.045,.86,1.80,cloth)
  for dz in (-.42,.42):box('Side banner trim',side*9.64,z+dz,2.65,.025,.035,1.80,gold)
  box('Side banner device',side*9.63,z,2.70,.025,.12,.62,gold)
  for dz in (-.14,.14):box('Side banner wing',side*9.63,z+dz,2.70,.025,.16,.12,gold)
# The wall torches sit well above player height. Runtime adds moving flame and
# warm light at these same shared positions.
for x,z in layout['sconces']+layout['portalSconces']:
 box('Torch backplate',x,z,2.1,.26,.20,.47,metal)
 cylinder('Torch cup',x,z,2.37,.19,.18,metal)
# Ivy climbs from each planter against the back wall; leaf meshes have volume.
for x0 in (-7.2,-1.9,1.9,7.2):
 for k in range(8):
  y=.75+k*.38;xx=x0+.16*math.sin(k*.9+x0)
  box('Ivy stem',xx,-38.64,y,.035,.035,.38,leaf)
  for side in (-1,1):
   if (k+int(abs(x0)*10))%3==0 and side==1:continue
   ico('Ivy leaf',xx+side*.13,-38.57,y+.07,.14,.045,.09,leaf_light if k%3==0 else leaf)
for m in [stone,edge,dark,roof,wood,ground,pavers,banner,portal,*masonry,gold,cloth,leaf,leaf_light,soil,flower,flower_light,metal]:
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==m]
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name='courtyard-'+m.name.replace(' ','-')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'game/art/environment-lab/courtyard/courtyard.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'game/public/assets/environment-lab/castle-courtyard.glb'),export_format='GLB',use_selection=True,export_extras=True)
