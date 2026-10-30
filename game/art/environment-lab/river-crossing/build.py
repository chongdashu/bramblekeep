"""Blender 5.2: author the river crossing in metres; export a Y-up GLB."""
import bpy, math, os, random, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../../..'))
out=os.path.join(root,'game/public/assets/environment-lab/river-crossing.glb')
art=os.path.dirname(__file__)
random.seed(42)
river_extent=80
river_segments=640
with open(os.path.join(root,'game/src/scenes/river-bank.json')) as f: bank_layout=json.load(f)
def mat(name,color,rough=.8,kind=None):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough
 if kind: m['vgd_kind']=kind
 return m
water=mat('River water',(0.30,.67,.70),.82,'liquid')
# A soft translucent surface reveals the authored bed. The high roughness avoids
# the renderer's thresholded, oversized white specular disc.
water.diffuse_color=(.30,.67,.70,.72)
water.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.72
water.surface_render_method='BLENDED'
bed=mat('Riverbed',(.18,.38,.32),.95)
stone=mat('Submerged stones',(.34,.42,.31),.98)
bank=mat('River edge earth',(.32,.20,.105),.98)
bank_rock=mat('Bank rocks',(.40,.44,.37),.98)
bank_pebble=mat('Shore pebbles',(.45,.37,.25),.98)
reeds=mat('Shore grass',(.22,.38,.12),.95)
# Packed soil texture, subtle enough to read as earth rather than a repeated stripe.
soil=bpy.data.images.new('Bank soil',width=256,height=128,alpha=True)
soil_pixels=[]
for j in range(128):
 for i in range(256):
  u=2*math.pi*i/256; v=2*math.pi*j/128
  mottled=.025*math.sin(3*u+math.sin(2*v))*math.sin(4*v-u)+.008*math.sin(17*u+9*v)*math.sin(11*u-13*v)
  soil_pixels.extend((.53+mottled*.7,.46+mottled*.5,.32+mottled*.3,1))
soil.pixels=soil_pixels; soil.pack()
soil_node=bank.node_tree.nodes.new('ShaderNodeTexImage'); soil_node.image=soil
bank.node_tree.links.new(soil_node.outputs['Color'],bank.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
land=mat('River landscape',(.24,.40,.16),.95,'bump')
# Periodic value noise yields organic grain without visible checkerboard lines.
def noise_grid(size, seed):
 rng=random.Random(seed)
 return [[rng.random() for _ in range(size)] for _ in range(size)]
def periodic_noise(grid, x, y):
 n=len(grid); u=x*n; v=y*n; ix=int(u)%n; iy=int(v)%n
 a=u-math.floor(u); b=v-math.floor(v); a=a*a*(3-2*a); b=b*b*(3-2*b)
 p=grid[iy][ix]*(1-a)+grid[iy][(ix+1)%n]*a
 q=grid[(iy+1)%n][ix]*(1-a)+grid[(iy+1)%n][(ix+1)%n]*a
 return p*(1-b)+q*b
coarse=noise_grid(8,341); middle=noise_grid(32,342); fine=noise_grid(96,343)
def soil_noise(i,j):
 x=i/256; y=j/256
 return (.055*(periodic_noise(coarse,x,y)-.5)+.065*(periodic_noise(middle,x,y)-.5)+.07*(periodic_noise(fine,x,y)-.5))
# Tileable, low-contrast texture gives the grass tonal variation at player
# scale. The lab's ground-colour control remains a multiplier on this material.
grass_image=bpy.data.images.new('Grass ground',width=256,height=256,alpha=True)
grass_pixels=[]
for j in range(256):
 for i in range(256):
  m=soil_noise(i,j)*.7
  grass_pixels.extend((.92+m*.8,.96+m,.88+m*.6,1))
grass_image.pixels=grass_pixels; grass_image.pack()
grass_node=land.node_tree.nodes.new('ShaderNodeTexImage'); grass_node.image=grass_image
land.node_tree.links.new(grass_node.outputs['Color'],land.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
path_mat=mat('Path earth',(1,1,1),.96,'bump')
path_stone=mat('Path pavers',(.61,.51,.35),.98)
# One world-space painting spans both approaches. Its alpha thins naturally at
# the camp end and along the edges, so the dirt merges into the grass.
path_start=-29.0; path_end=15.7
path_image=bpy.data.images.new('Path earth',width=256,height=1024,alpha=True)
path_pixels=[]
def smooth(v):
 t=max(0,min(1,v)); return t*t*(3-2*t)
for j in range(1024):
 y=path_start+(path_end-path_start)*j/1023
 for i in range(256):
  x=(i/255*2-1)*1.5
  # Sample in metres, not image UVs: this image covers a much longer
  # distance than it is wide, and UV-space noise becomes long stripes.
  m=(.055*(periodic_noise(coarse,x/4,y/4)-.5)
    +.065*(periodic_noise(middle,x/4,y/4)-.5)
    +.07*(periodic_noise(fine,x/4,y/4)-.5))
  # Low-frequency variation roughens the fade without revealing repeated tiles.
  edge_noise=periodic_noise(coarse,x/6,y/6)-.5
  end=smooth((y-path_start)/5.5 + edge_noise*.27)
  side=smooth((1.49-abs(x))/.30 + edge_noise*.34)
  path_pixels.extend((.68+m,.53+m*.8,.35+m*.65,end*side))
path_image.pixels=path_pixels; path_image.pack()
path_node=path_mat.node_tree.nodes.new('ShaderNodeTexImage'); path_node.image=path_image; path_node.extension='EXTEND'
path_shader=path_mat.node_tree.nodes.get('Principled BSDF')
path_mat.node_tree.links.new(path_node.outputs['Color'],path_shader.inputs['Base Color'])
path_mat.node_tree.links.new(path_node.outputs['Alpha'],path_shader.inputs['Alpha'])
path_mat.surface_render_method='BLENDED'
# One non-repeating painting covers the whole river. A darker central channel,
# soft shallow edges and broken elongated highlights describe depth and flow.
w,h=1024,256; image=bpy.data.images.new('River surface painting',width=w,height=h,alpha=True)
pixels=[]
for y in range(h):
 v=y/(h-1); edge=abs(2*v-1); shallow=max(0,(edge-.45)/.55)
 for x in range(w):
  u=x/(w-1)
  flow=math.sin(2*math.pi*(u*8+v*1.3+.10*math.sin(u*19)))
  fine=math.sin(2*math.pi*(u*23-v*2.1+0.08*math.sin(u*31)))
  shimmer=max(0,flow*.65+fine*.35-.64)**3
  variation=.018*math.sin(u*81+math.sin(v*13)*2)*math.sin(v*34+u*19)
  pixels.extend((.12+.12*shallow+.22*shimmer+variation,.39+.16*shallow+.23*shimmer+variation,.43+.10*shallow+.21*shimmer+variation,1))
image.pixels=pixels; image.pack()
nodes=water.node_tree.nodes; tex=nodes.new('ShaderNodeTexImage'); tex.image=image; tex.extension='EXTEND'
water.node_tree.links.new(tex.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
wood=[mat('Oak plank %d'%i,c) for i,c in enumerate([(.32,.16,.065),(.40,.22,.09),(.36,.19,.075),(.45,.25,.11)])]
trim=mat('Dark oak supports',(.20,.095,.037)); iron=mat('Iron nails',(.105,.11,.10),.45)
def box(name,pos,size,material,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos); o=bpy.context.object; o.name=name; o.scale=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(material)
 if bevel:
  mod=o.modifiers.new('Worn edges','BEVEL'); mod.width=bevel; mod.segments=2
  o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); bpy.context.view_layer.objects.active=o
  for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
 return o
# Blender y=-runtime z. Subdivisions allow the engine's liquid vertex motion to work.
def river_y(x): return -8+.8*math.sin(x*.16)
def river_width(x): return 3.4*(1+.12*math.sin(x*.32))
def bank_width(x, side):
 return .80 + .16*math.sin(x*.64+side*.7) + .09*math.sin(x*1.3+side*2.1)
def ribbon(name, material, width_extra, height):
 verts=[]; faces=[]
 for i in range(river_segments+1):
  x=-river_extent+2*river_extent*i/river_segments; c=river_y(x); half=river_width(x)/2+width_extra
  verts.extend([(x,c-half,height),(x,c+half,height)])
  if i:
   a=2*(i-1); faces.append((a,a+2,a+3,a+1))
 mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
 o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); o.data.materials.append(material)
# Recessed bed and water: both are below the 0 m walking surface.
# The terrain is authored around the channel, rather than hidden behind a flat floor.
ribbon('Riverbed',bed,-.22,-.90)
# The near landscape meets the bank exactly; the distant quads fill the horizon.
verts=[]; faces=[]
for i in range(river_segments+1):
 x=-river_extent+2*river_extent*i/river_segments; c=river_y(x); half=river_width(x)/2
 verts.extend([(x,-500,0),(x,c-half-bank_width(x,-1),0),(x,c+half+bank_width(x,1),0),(x,500,0)])
 if i:
  a=4*(i-1); faces.extend([(a,a+4,a+5,a+1),(a+2,a+6,a+7,a+3)])
for x0,x1 in [(-500,-river_extent),(river_extent,500)]:
 a=len(verts); verts.extend([(x0,-500,0),(x1,-500,0),(x1,500,0),(x0,500,0)]); faces.append((a,a+1,a+2,a+3))
mesh=bpy.data.meshes.new('Landscape with river cutout'); mesh.from_pydata(verts,[],faces); mesh.update()
o=bpy.data.objects.new('Landscape with river cutout',mesh); bpy.context.collection.objects.link(o); o.data.materials.append(land)
uv=mesh.uv_layers.new(name='Grass UV')
for poly in mesh.polygons:
 for li in poly.loop_indices:
  v=mesh.vertices[mesh.loops[li].vertex_index].co; uv.data[li].uv=(v.x/16,v.y/16)
# A low, textured dirt path ends at the bridge on both sides. Its slight
# variation in width breaks the ruler-straight silhouette without changing
# walkability. Pavers add small, real height changes above the dirt surface.
path_verts=[]; path_faces=[]
for start,end in [(path_start,-9.4),(-6.1,path_end)]:
 count=math.ceil((end-start)/.25); base=len(path_verts); across=12
 for i in range(count+1):
  y=start+(end-start)*i/count; width=1.4+.075*math.sin(y*.83)*math.sin(math.pi*i/count)
  for j in range(across+1):
   x=width*(2*j/across-1)
   # Shallow, smooth physical relief; keep embedded paving above the dirt.
   h=.015+.008*(periodic_noise(coarse,(x+12)/4,(y+32)/4)-.5)
   path_verts.append((x,y,h))
   if i and j:
    a=base+(i-1)*(across+1)+j-1
    path_faces.append((a,a+across+1,a+across+2,a+1))
mesh=bpy.data.meshes.new('Path surface'); mesh.from_pydata(path_verts,[],path_faces); mesh.update()
o=bpy.data.objects.new('Path surface',mesh); bpy.context.collection.objects.link(o); o.data.materials.append(path_mat)
for poly in mesh.polygons: poly.use_smooth=True
uv=mesh.uv_layers.new(name='Path UV')
for poly in mesh.polygons:
 for li in poly.loop_indices:
  v=mesh.vertices[mesh.loops[li].vertex_index].co; uv.data[li].uv=((v.x+1.5)/3,(v.y-path_start)/(path_end-path_start))
stone_rng=random.Random(721)
verts=[]; faces=[]
for start,end in [(-23.0,-10.2),(-5.3,15.1)]:
 count=int((end-start)/1.35)
 for i in range(count):
  for side in (-1,1):
   if stone_rng.random()<.38: continue
   x=side*stone_rng.uniform(.50,1.03); y=start+i*1.35+stone_rng.uniform(-.48,.48)
   rx=stone_rng.uniform(.10,.23); ry=stone_rng.uniform(.12,.28); base=len(verts)
   outline=[]
   for k in range(7):
    a=2*math.pi*k/7; scale=stone_rng.uniform(.82,1.12)
    outline.append((rx*math.cos(a)*scale,ry*math.sin(a)*scale))
   # A bevel ring gives each embedded stone real side faces and highlights.
   for radius,z in [(1,.017),(.78,.038)]:
    for dx,dy in outline: verts.append((x+dx*radius,y+dy*radius,z))
   for k in range(7): faces.append((base+k,base+(k+1)%7,base+7+(k+1)%7,base+7+k))
   faces.append(tuple(range(base+7,base+14)))
mesh=bpy.data.meshes.new('Path pavers'); mesh.from_pydata(verts,[],faces); mesh.update()
o=bpy.data.objects.new('Path pavers',mesh); bpy.context.collection.objects.link(o); o.data.materials.append(path_stone)
# Broken earth banks rise from the water edge into the grass, framing the channel.
for side in [-1,1]:
 verts=[]; faces=[]
 for i in range(river_segments+1):
  x=-river_extent+2*river_extent*i/river_segments; c=river_y(x); half=river_width(x)/2
  # The middle vertex meets the waterline; the upper slope remains visible.
  verts.extend([(x,c+side*(half-.22),-.90),(x,c+side*half,-.28),(x,c+side*(half+bank_width(x,side)),0)])
  if i:
   a=3*(i-1)
   for j in range(2):
    q=(a+j,a+j+3,a+j+4,a+j+1)
    faces.append(q if side>0 else tuple(reversed(q)))
 mesh=bpy.data.meshes.new('Bank slope'); mesh.from_pydata(verts,[],faces); mesh.update()
 o=bpy.data.objects.new('Bank slope',mesh); bpy.context.collection.objects.link(o); o.data.materials.append(bank)
 uv=mesh.uv_layers.new(name='Bank UV')
 for poly in mesh.polygons:
  for li in poly.loop_indices:
   vi=mesh.loops[li].vertex_index; i,j=divmod(vi,3)
   uv.data[li].uv=(i/river_segments*20,j/2)
# Stones remain below the lowest possible wave trough, but above the riverbed.
for i in range(90):
 x=random.uniform(-23.5,23.5); c=river_y(x); half=river_width(x)/2
 y=c+random.uniform(-.8,.8)*half
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,-.875))
 o=bpy.context.object; o.name='Submerged pebble'; o.scale=(random.uniform(.10,.28),random.uniform(.07,.16),.04)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(stone)
# Small non-colliding shoreline details sit on the actual upper slope. The
# bridge approaches stay clear and the larger collidable rocks are unchanged.
for side in [-1,1]:
 for i in range(30):
  x=random.uniform(-21.5,21.5)
  if abs(x)<3.5: continue
  width=bank_width(x,side); offset=width*random.uniform(.25,.84)
  y=river_y(x)+side*(river_width(x)/2+offset)
  z=-.28+.28*offset/width
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,z+.025))
  o=bpy.context.object; o.name='Shore pebble'; o.scale=(random.uniform(.08,.20),random.uniform(.07,.13),.055)
  bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(bank_pebble)
  if i%2==0:
   # A tiny crossed pair of tapered blades keeps the shore legible at game scale.
   verts=[]; faces=[]
   for k in range(3):
    a=k*math.pi/3+random.uniform(-.2,.2); dx=.045*math.cos(a); dy=.045*math.sin(a)
    base=len(verts); verts.extend([(x-dx,y-dy,z+.01),(x+dx,y+dy,z+.01),(x+dx*.4,y+dy*.4,z+random.uniform(.22,.37))]); faces.append((base,base+1,base+2))
   mesh=bpy.data.meshes.new('Reed blades'); mesh.from_pydata(verts,[],faces); mesh.update()
   o=bpy.data.objects.new('Shore grass',mesh); bpy.context.collection.objects.link(o); o.data.materials.append(reeds)
for i,rock in enumerate(bank_layout['rocks']):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(rock['x'],-rock['z'],.34))
 o=bpy.context.object; o.name='Boundary bank rock'; o.rotation_euler.z=(i*1.7)%(2*math.pi)
 o.scale=(rock['radius']*1.15,rock['radius']*.9,.42); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(bank_rock)
verts=[]; faces=[]; nx=river_segments; ny=16
for i in range(nx+1):
 x=-river_extent+2*river_extent*i/nx; center=river_y(x); width=river_width(x)
 for j in range(ny+1): verts.append((x,center+width*(j/ny-.5),-.28))
for i in range(nx):
 for j in range(ny):
  a=i*(ny+1)+j; faces.append((a,a+ny+1,a+ny+2,a+1))
mesh=bpy.data.meshes.new('Subdivided river'); mesh.from_pydata(verts,[],faces); mesh.update()
o=bpy.data.objects.new('River surface',mesh); bpy.context.collection.objects.link(o); o.data.materials.append(water)
uv=mesh.uv_layers.new(name='River UV')
for p in mesh.polygons:
 for li in p.loop_indices:
  vi=mesh.loops[li].vertex_index; i,j=divmod(vi,ny+1); uv.data[li].uv=(i/nx,j/ny)
for p in mesh.polygons: p.use_smooth=True
# Walkable deck remains at the same height as the character; individual boards and rails give the crossing scale.
for i in range(16):
 y=-10.22+i*.295
 box('Deck plank %02d'%i,(0,y,.045),(2.90,.28,.09),wood[i%4],.014)
for x in [-1.43,1.43]:
 box('Long oak side beam',(x,-8,.19),(.18,4.75,.30),trim,.018)
 for y in [-10.08,-8.7,-7.3,-5.92]:
  box('Square rail post',(x,y,.48),(.18,.18,.92),wood[1],.015)
 box('Hand rail',(x,-8,.88),(.19,4.75,.14),wood[2],.02)
 for y in [-9.85,-8.9,-7.1,-6.15]:
  for xx in [-1.17,1.17]:
   bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.025,depth=.008,location=(xx,y,.094)); bpy.context.object.name='Iron peg'; bpy.context.object.data.materials.append(iron)
# Merge by material to keep the asset economical in the runtime.
for material in [water,bed,stone,bank,bank_rock,bank_pebble,reeds,land,path_mat,path_stone,*wood,trim,iron]:
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==material]
 bpy.ops.object.select_all(action='DESELECT')
 for obj in objects: obj.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
 bpy.context.object.name='crossing_'+material.name.replace(' ','_')
 bpy.context.scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(art,'river-crossing.blend'))
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_extras=True)
print('Exported',out)
