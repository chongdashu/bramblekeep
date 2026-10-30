"""Castle service lanes and perimeter barricade. Blender Z-up, world-space metres."""
import bpy, json, math, random
from pathlib import Path
root=Path(__file__).resolve().parents[4]
layout=json.loads((root/'game/src/scenes/castle-outskirts.json').read_text())
terrain=json.loads((root/'game/src/scenes/terrain.json').read_text())
rng=random.Random(601)
bpy.ops.wm.read_factory_settings(use_empty=True)
# Use the existing road material and its soft painted edges for the service path.
bpy.ops.import_scene.gltf(filepath=str(root/'game/public/assets/environment-lab/river-crossing.glb'))
soil=bpy.data.materials['Path earth'];soil['vgd_kind']='bump'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def smooth(v):
 t=max(0,min(1,v));return t*t*(3-2*t)
def height(x,z):
 h=sum(rise*smooth(1-math.hypot((x-cx)/rx,(z-cz)/rz)) for cx,cz,rise,rx,rz in terrain['hills'])
 centre=8-.8*math.sin(x*.16);half=1.7*(1+.12*math.sin(x*.32))
 mask=smooth((abs(x)-2.2)/2)*smooth((abs(z-centre)-half-1.4)/2)
 for cx,cz,r in terrain['flatAreas']:mask*=smooth((math.hypot(x-cx,z-cz)-r)/1.2)
 return h*mask
def mat(name,color,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.9
 if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
 return m
wood=mat('Weathered oak',(.23,.12,.055));plank=mat('Oak highlights',(.34,.19,.085));dark=mat('Iron',(.075,.085,.08));canvas=mat('Stored canvas',(.54,.48,.34));green=mat('Shrub green',(.19,.30,.095));leaf=mat('Leaf tips',(.29,.42,.11));flower=mat('Wildflowers',(.85,.68,.27));glow=mat('Lantern glass',(.95,.47,.09),1.5)
stone=mat('Outer masonry',(.29,.32,.31));stone2=mat('Outer masonry variation',(.26,.29,.29));gold=mat('Old banner trim',(.66,.46,.14));blue=mat('Castle blue',(.07,.13,.23))
def box(name,x,z,y,sx,sz,sy,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=(sx,sz,sy);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);return o
def sphere(name,x,z,y,sx,sz,sy,m):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=(sx,sz,sy);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
def fence(x,z,side):
 # Two continuous rails and close uprights make the collision boundary legible.
 for i in range(7):
  off=(i-3)*.8;xx=x if side else x+off;zz=z+off if side else z;h=height(xx,zz)
  box('Barricade stake',xx,zz,h+.65,.17 if side else .18,.18 if side else .17,1.3,wood)
  box('Stake cap',xx,zz,h+1.32,.21,.21,.08,plank)
 h=height(x,z)
 for y in (.43,1.0):box('Barricade rail',x,z,h+y,.14 if side else 5.05,5.05 if side else .14,.16,plank)
for f in layout['sideFences']:fence(f['x'],f['z'],True)
for f in layout['rearFences']:fence(f['x'],f['z'],False)
for g in layout['supplyGroups']:
 x,z,side=g['x'],g['z'],g['side'];h=height(x,z)
 box('Supply crate',x,z,h+.43,.85,.85,.86,plank)
 for offset in (-.31,.31):box('Crate reinforcement',x,z+offset,h+.44,.88,.06,.9,wood)
 box('Packed canvas',x,z,h+.94,.72,.63,.18,canvas)
 # Barrel is faceted, with dark binding bands and a separate lid.
 bx=x+side*.75;bz=z+.7;bh=height(bx,bz)
 bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=.34,depth=.8,location=(bx,-bz,bh+.4));bpy.context.object.data.materials.append(plank)
 for y in (.16,.65):
  bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=.355,depth=.055,location=(bx,-bz,bh+y));bpy.context.object.data.materials.append(dark)
 for j in range(3):
  xx=x+side*(.7+j*.12);zz=z-1.0+j*.18; hh=height(xx,zz);box('Stored timber',xx,zz,hh+.15,.18,1.05,.18,wood)
for x,z in layout['lights']:
 h=height(x,z);box('Lantern post',x,z,h+.73,.14,.14,1.46,wood)
 box('Lantern frame',x,z,h+1.46,.38,.38,.43,dark);box('Lantern warm panes',x,z,h+1.47,.32,.40,.30,glow)
 box('Lantern roof',x,z,h+1.70,.45,.45,.10,wood)
# Exposed stone courses make the outside face of the existing curtain wall
# read as a built structure. A small offset prevents competing surfaces.
for side in (-1,1):
 for row in range(6):
  for col in range(18):
   z=-20.5-col*1.0-(.5 if row%2 else 0)
   if z < -39:continue
   box('Outer wall ashlar',side*12.125,z,.33+row*.61,.055,.94,.54,stone if (row+col)%4 else stone2)
for row in range(6):
 for col in range(20):
  x=-9.5+col+(0.5 if row%2 else 0)
  box('Rear wall ashlar',x,-41.125,.33+row*.61,.94,.055,.54,stone if (row+col)%4 else stone2)
# Hanging heraldry and ivy give the back wall a focal point without narrowing
# the short walkable passage between the wall and the fence.
for x in (-5,0,5):
 box('Rear banner',x,-41.18,2.65,.70,.06,1.25,blue)
 box('Banner edging',x,-41.225,2.04,.70,.04,.07,gold)
 box('Banner emblem',x,-41.23,2.62,.12,.04,.48,gold)
for x in (-9,-6.5,-2.5,2.5,6.5,9):
 for j in range(7):
  xx=x+.22*math.sin(j*.9+x);y=.35+j*.35
  sphere('Rear ivy',xx,-41.20,y,.20,.10,.16,leaf if j%3==0 else green)
# Worn earth follows the ground heights and tells players where the service
# corridor leads. It stays below props and outside the courtyard.
def path(points,width):
 verts=[];faces=[];uvs=[];travel=0
 for i in range(len(points)-1):
  x0,z0=points[i];x1,z1=points[i+1];steps=max(1,math.ceil(math.hypot(x1-x0,z1-z0)/.35));dx=x1-x0;dz=z1-z0;length=math.hypot(dx,dz);nx=-dz/length;nz=dx/length
  for j in range(steps+1):
   t=j/steps;x=x0+dx*t;z=z0+dz*t;w=width*(.92+.08*math.sin(t*9+i))
   for s in (-1,1):
    xx=x+nx*w*s;zz=z+nz*w*s;verts.append((xx,-zz,height(xx,zz)+.035));uvs.append((0 if s<0 else 1,(travel+length*t)/44.7))
   if j:
    a=len(verts)-4;faces.append((a,a+1,a+3,a+2))
  travel+=length
 mesh=bpy.data.meshes.new('Service path');mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new('Service path',mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(soil)
 uv=mesh.uv_layers.new(name='Path UV')
 for poly in mesh.polygons:
  for li in poly.loop_indices:uv.data[li].uv=uvs[mesh.loops[li].vertex_index]
for side in (-1,1):path([(side*17,-18),(side*17.3,-29),(side*17,-40),(side*14,-42.4)],.62)
path([(-14,-42.4),(0,-42.4),(14,-42.4)],.48)
# Plant clusters hug walls and barricades instead of filling the walking lane.
for side in (-1,1):
 for i in range(17):
  x=side*(12.9+rng.uniform(0,.85));z=-20.5-i*1.05;h=height(x,z)
  sphere('Wall shrubs',x,z,h+.20,.30+rng.random()*.22,.25+rng.random()*.2,.22,green)
  if i%3==0:sphere('Leaf tips',x+side*.12,z,h+.29,.20,.22,.16,leaf)
 for i in range(38):
  x=side*(19.1+rng.random()*1.4);z=-20-rng.random()*22;h=height(x,z)
  sphere('Grass clump',x,z,h+.12,.10,.10,.18,leaf)
  if i%5==0:sphere('Flower',x,z,h+.33,.09,.09,.08,flower)
for m in [wood,plank,dark,canvas,green,leaf,flower,glow,stone,stone2,soil,gold,blue]:
 objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==m]
 if not objs:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();bpy.context.object.name='outskirts-'+m.name.replace(' ','-')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'game/art/environment-lab/castle-outskirts/castle-outskirts.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'game/public/assets/environment-lab/castle-outskirts.glb'),export_format='GLB',use_selection=True,export_extras=True)
