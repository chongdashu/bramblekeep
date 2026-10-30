"""Friendly camp kit: editable, deterministic geometry; Blender Z-up, game Y-up in metres."""
import bpy, math, json, random
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parents[4]
layout=json.loads((root/'game/src/scenes/camp-layout.json').read_text())
terrain=json.loads((root/'game/src/scenes/terrain.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
def smooth(v):
 t=max(0,min(1,v));return t*t*(3-2*t)
def height(x,z):
 h=sum(rise*smooth(1-math.hypot((x-cx)/rx,(z-cz)/rz)) for cx,cz,rise,rx,rz in terrain['hills'])
 c=8-.8*math.sin(x*.16);half=1.7*(1+.12*math.sin(x*.32));mask=smooth((abs(x)-2.2)/2)*smooth((abs(z-c)-half-1.4)/2)
 for cx,cz,r in terrain['flatAreas']:mask*=smooth((math.hypot(x-cx,z-cz)-r)/1.2)
 return h*mask
def mat(name,color,emit=None):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.9
 if emit:p.inputs['Emission Color'].default_value=(*emit,1);p.inputs['Emission Strength'].default_value=1.2
 return m
canvas=mat('Camp warm canvas',(.66,.58,.43));blue=mat('Camp blue canvas',(.10,.23,.33));blue2=mat('Camp blue stripe',(.16,.32,.40));wood=mat('Camp oak',(.27,.15,.07));lightwood=mat('Camp cut wood',(.46,.28,.12));rope=mat('Camp rope',(.56,.43,.25));shadow=mat('Camp tent opening',(.08,.10,.09));gold=mat('Camp gold',(.68,.43,.11));lantern=mat('Camp lantern glow',(1,.60,.14),(1,.40,.05));bed=mat('Camp bedroll',(.28,.36,.29));iron=mat('Camp iron',(.12,.15,.14));grass=mat('Camp meadow grass',(.20,.35,.12));flowers=mat('Camp meadow flowers',(.82,.68,.27));flowers_pale=mat('Camp pale flowers',(.77,.74,.61))
# Fine, seamless woven variation keeps large tent surfaces from reading as
# featureless polygons; colours are baked into portable glTF textures.
def cloth_texture(material,name,color,seed):
 rng=random.Random(seed);size=128;image=bpy.data.images.new(name,width=size,height=size,alpha=True);pixels=[]
 for j in range(size):
  for i in range(size):
   u=2*math.pi*i/size;v=2*math.pi*j/size
   grain=.009*math.sin(4*u+3*v)*math.sin(3*v-u)+rng.uniform(-.004,.004)
   pixels.extend((max(0,color[0]+grain),max(0,color[1]+grain),max(0,color[2]+grain),1))
 image.pixels=pixels;image.pack();node=material.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
 material.node_tree.links.new(node.outputs['Color'],material.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
cloth_texture(canvas,'Warm woven canvas',(.66,.58,.43),7)
cloth_texture(blue,'Blue woven canvas',(.10,.23,.33),8)
def box(name,x,z,y,sx,sz,sy,m,rot=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y),rotation=(0,0,rot));o=bpy.context.object;o.name=name;o.scale=(sx,sz,sy);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
def panel(name,verts,m):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,-z,y) for x,z,y in verts],[],[tuple(range(len(verts)))]);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(m)
 uv=mesh.uv_layers.new(name='Canvas UV')
 for poly in mesh.polygons:
  for li in poly.loop_indices:
   v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v.x*.7,v.y*.7+v.z*.5)
def beam(name,a,b,r,m):
 a=Vector((a[0],-a[1],a[2]));b=Vector((b[0],-b[1],b[2]));d=b-a
 bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
def tent(t):
 x,z,s=t['x'],t['z'],t['scale'];base=height(x,z);w=1.53*s;d=1.38*s;h=2.15*s
 # Two stretched canvas panels and a dark entrance give a readable A-frame silhouette.
 for side in (-1,1):
  panel('Canvas roof',[(x,z-d,base+h),(x,z+d,base+h),(x+side*w,z+d,base+.11),(x+side*w,z-d,base+.11)],canvas)
  panel('Front canvas flap',[(x+side*.22*s,z+d+.015,base+.15),(x,z+d+.015,base+h*.82),(x+side*w,z+d+.015,base+.11)],canvas if side<0 else blue2)
  panel('Blue ridge trim',[(x,z-d,base+h+.02),(x,z+d,base+h+.02),(x+side*.22*s,z+d,base+h-.28*s),(x+side*.22*s,z-d,base+h-.28*s)],blue)
  # A sewn shield on the broad canvas face, just above the host surface.
  a=.43*s; b=.99*s; y1=base+h*(1-a/w)+.035; y2=base+h*(1-b/w)+.035
  panel('Canvas shield',[(x+side*a,z-.45*s,y1),(x+side*a,z+.45*s,y1),(x+side*b,z+.31*s,y2),(x+side*b,z-.31*s,y2)],blue2)
  a=.62*s;b=.81*s;y1=base+h*(1-a/w)+.045;y2=base+h*(1-b/w)+.045
  panel('Gold shield mark',[(x+side*a,z-.12*s,y1),(x+side*a,z+.12*s,y1),(x+side*b,z, y2)],gold)

 panel('Tent dark entrance',[(x-.47*s,z+d+.01,base+.12),(x,z+d+.01,base+h*.8),(x+.47*s,z+d+.01,base+.12)],shadow)
 panel('Tent rear',[(x-w,z-d,base+.11),(x,z-d,base+h),(x+w,z-d,base+.11)],blue)
 # Ridge and end poles are continuous wood, with taut corner ropes.
 beam('Tent ridge',(x,z-d-.08,base+h),(x,z+d+.13,base+h),.055*s,wood)
 for zz in (z-d,z+d):beam('Tent upright',(x,zz,base+.06),(x,zz,base+h+.16*s),.055*s,wood)
 for side in (-1,1):
  beam('Canvas seam',(x+side*w*.55,z-d,base+h*.46),(x+side*w*.55,z+d,base+h*.46),.018*s,rope)
  for zz in (z-d,z+d):
   sx=x+side*(w+.42*s);sz=zz+(-.30*s if zz==z-d else .30*s)
   beam('Guy rope',(x+side*w,zz,base+.22*s),(sx,sz,height(sx,sz)+.07),.018*s,rope)
   beam('Tent peg',(sx,sz,height(sx,sz)),(sx,sz,height(sx,sz)+.16),.035*s,wood)
 # Small gold camp pennant identifies this as the friendly base.
 panel('Tent pennant',[(x,z+d+.12,base+h+.06*s),(x+.42*s,z+d+.12,base+h+.01*s),(x,z+d+.12,base+h-.17*s)],gold)
for t in layout['tents']:tent(t)
# One bench faces the fire, while a work table and bundled supplies sit beyond
# the spawn grid. Their solid footprints come from the same layout.
for p in layout['solids']:
 x,z=p['x'],p['z'];h=height(x,z)
 if p['kind']=='bench':
  box('Bench seat',x,z,h+.43,1.5,.42,.12,lightwood)
  for dx in (-.54,.54):box('Bench leg',x+dx,z,h+.22,.16,.34,.44,wood)
 elif p['kind']=='log':
  beam('Seat log',(x-.55,z,h+.24),(x+.55,z,h+.24),.23,wood)
 elif p['kind']=='barrel':
  beam('Camp barrel',(x,z,h+.06),(x,z,h+.92),.37,wood)
  for y in (.18,.75):
   beam('Barrel hoop',(x,z,h+y),(x,z,h+y+.055),.385,iron)
  beam('Barrel lid',(x,z,h+.91),(x,z,h+.95),.34,lightwood)
 elif p['kind']=='supply':
  box('Supply chest',x,z,h+.39,.95,.70,.78,wood)
  for dx in (-.34,.34):box('Chest strap',x+dx,z+.36,h+.40,.075,.04,.76,iron)
  box('Chest lid',x,z,h+.82,1,.75,.12,lightwood)
 elif p['kind']=='bannerpost':
  beam('Camp pole',(x,z,h),(x,z,h+2.7),.065,wood)
  panel('Camp flag',[(x,z,h+2.55),(x+.65,z,h+2.48),(x+.50,z,h+2.08),(x,z,h+2.20)],blue2)
  box('Flag device',x+.21,z-.012,h+2.34,.08,.025,.20,gold)
# A grouped stack of blankets and packs, kept low and decorative.
for x,z in [(-5.5,24.8),(8.1,19.8)]:
 h=height(x,z);beam('Rolled bedroll',(x-.38,z,h+.22),(x+.38,z,h+.22),.22,bed);box('Bedroll strap',x,z,h+.43,.10,.42,.025,rope)
# Lantern posts at camp edges illuminate tents and show an inviting base.
for x,z in layout['lights']:
 h=height(x,z);beam('Lantern post',(x,z,h),(x,z,h+1.55),.055,wood)
 box('Lantern base',x,z,h+1.32,.25,.25,.05,iron);box('Lantern glass',x,z,h+1.48,.20,.20,.28,lantern);box('Lantern roof',x,z,h+1.65,.28,.28,.06,iron)
# One bunting line hugs the outer camp instead of crossing the central route.
for a,b in [((-9.8,20.5),(-11.2,17.8)),((10.1,18.3),(8.4,23.5))]:
 ax,az=a;bx,bz=b;ay=height(ax,az)+2.5;by=height(bx,bz)+2.1
 beam('Bunting cord',(ax,az,ay),(bx,bz,by),.014,rope)
 for i in range(1,7):
  q=i/7;x=ax+(bx-ax)*q;z=az+(bz-az)*q;y=ay+(by-ay)*q
  panel('Bunting pennant',[(x,z,y),(x+.20,z+.04,y-.02),(x+.10,z+.02,y-.23)],blue2 if i%2 else gold)
# Sparse flowers and three-blade grass clusters soften camp edges. Their
# deterministic scatter never defines a route, spawn or collision.
rng=random.Random(483)
for side in (-1,1):
 for i in range(160):
  x=side*rng.uniform(5.3,13.5);z=rng.uniform(15.5,25.5)
  if any(abs(x-t['x'])<t['halfWidth']+.45 and abs(z-t['z'])<t['halfDepth']+.45 for t in layout['tents']):continue
  if any(math.hypot(x-p['x'],z-p['z'])<p['radius']+.35 for p in layout['solids']):continue
  if any(math.hypot(x-lx,z-lz)<.5 for lx,lz in layout['lights']):continue
  y=height(x,z)
  for j in range(3):
   a=j*math.pi/3+rng.uniform(-.15,.15);dx=.048*math.cos(a);dz=.048*math.sin(a)
   panel('Camp grass blade',[(x-dx,z-dz,y+.01),(x+dx,z+dz,y+.01),(x+dx*.4,z+dz*.4,y+rng.uniform(.23,.40))],grass)
  if i%2==0:
   bx=x+rng.uniform(-.06,.06);bz=z+rng.uniform(-.06,.06);top=y+rng.uniform(.11,.2)
   bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.07,location=(bx,-bz,top));o=bpy.context.object;o.name='Camp flower';o.data.materials.append(flowers if i%4 else flowers_pale)
# Merge by material to limit game draw calls. Bake world transforms first.
from mathutils import Matrix
for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:
 world=o.matrix_world.copy();o.matrix_world=Matrix.Identity(4);o.data.transform(world)
for m in [canvas,blue,blue2,wood,lightwood,rope,shadow,gold,lantern,bed,iron,grass,flowers,flowers_pale]:
 objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==m]
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 if not objs:continue
 bpy.context.view_layer.objects.active=objs[0]
 if len(objs)>1:bpy.ops.object.join()
 bpy.context.object.name='camp-'+m.name.replace(' ','-')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'game/art/environment-lab/camp/camp.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'game/public/assets/environment-lab/camp-kit.glb'),export_format='GLB',use_selection=True,export_extras=True)
