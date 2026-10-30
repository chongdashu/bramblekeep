"""Build a compact environment look-study kit. Run with Blender --background --python."""
import bpy, math, os
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../..'))
art=os.path.join(root,'game/art/environment-lab')
out=os.path.join(root,'game/public/assets/environment-lab')
os.makedirs(out,exist_ok=True)
omit_keep=os.environ.get('ENV_LAB_NO_KEEP')=='1'

def material(name,rgba,kind=None):
 m=bpy.data.materials.new(name); m.diffuse_color=(*rgba,1); m.use_nodes=True
 m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*rgba,1)
 m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.8
 if kind: m['vgd_kind']=kind
 return m
wood=material('wood',(.31,.19,.10)); leaf=material('tree canopy',(.16,.36,.08),'foliage'); leaf2=material('bush',(.10,.25,.045),'foliage'); leaf3=material('tree highlights',(.22,.40,.10),'foliage')
stone=material('stone',(.45,.48,.45)); castle=material('keep stone',(.46,.49,.44)); roof=material('castle blue roof',(.13,.30,.55)); meadow=material('meadow light',(.34,.48,.14)); meadowshade=material('meadow shadow',(.20,.36,.09)); ripple=material('stream light',(.32,.65,.73),'liquid'); hills=material('distant hills',(.19,.35,.12)); bank=material('river banks',(.20,.33,.13)); cloud=material('clouds',(.87,.92,.98)); flower=material('flowers',(.95,.79,.24)); canvas=material('tent canvas',(.80,.75,.57)); water=material('stream',(.21,.55,.69),'liquid'); path=material('sand path',(.67,.57,.38)); blue=material('banner blue',(.18,.39,.69))

def assign(obj,m,name): obj.name=name; obj.data.materials.append(m); return obj

def cube(name,pos,scale,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos); o=bpy.context.object; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); return assign(o,mat,name)

def ico(name,pos,scale,mat):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=pos); o=bpy.context.object; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); bpy.ops.object.shade_smooth(); return assign(o,mat,name)

def cyl(name,pos,radius,depth,mat):
 bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=radius,depth=depth,location=pos); return assign(bpy.context.object,mat,name)

def cone(name,pos,radius,depth,mat):
 bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=radius,depth=depth,location=pos); return assign(bpy.context.object,mat,name)

def tree(x,y,kind=0,sz=1):
 cyl('trunk',(x,y,.8*sz),.22*sz,1.6*sz,wood)
 if kind:
  for i in range(3): cone('pine foliage',(x,y,(1.7+i*.55)*sz),(1.1-i*.2)*sz,1.5*sz,leaf2)
 else:
  ico('tree canopy',(x,y,2.25*sz),(1.0*sz,.9*sz,.7*sz),leaf)
  for i,(dx,dy,dz) in enumerate([(-.65,.15,.03),(.63,.18,-.03),(0,-.56,.05),(-.30,-.32,.38),(.34,.30,.32),(-.44,.30,-.15),(.5,-.35,.08)]): ico('tree crown',(x+dx*sz,y+dy*sz,(2.3+dz)*sz),(.64*sz,.61*sz,.5*sz),leaf3 if i in (0,3) else leaf)
for a in [(-6,0,0,1.1),(6,1,0,.95),(-7,-7,1,1.05),(7,7,1,.85)]: tree(*a)
for x,y,s in [(-4,2,.5),(5,4,.45),(-8,4,.55),(7,-4,.4)]: ico('shrub',(x,y,s*.65),(s,s*.8,s*.65),leaf2)
for x,y,s in [(-4,-2,.6),(5,2,.8),(-7,7,.45),(8,-6,.65)]: ico('rock',(x,y,s*.4),(s,s*.75,s*.5),stone)
# Cross-world path, small bridge over a deliberately shallow decorative stream.
# Broad connected, gently bending path; unobstructed around the gate.
for x,y,w,d,angle in [(0,-6,2.8,5,0), (0,-2,2.8,4,0), (-.55,1.4,2.8,3.5,-.20), (-1.4,4.0,2.8,3.5,-.25), (-2.25,6.3,2.8,3.0,-.18)]:
 o=cube('path section',(x,y,.01),(w,d,.025),path); o.rotation_euler.z=angle
# Distant mounds provide a calm horizon while retaining plenty of navigable open ground.
for x,y,sx,sy,h in [(-26,34,19,11,3.7), (0,42,22,13,4.5), (27,36,20,12,3.9)]:
 ico('distant hill',(x,y,-.2),(sx,sy,h),hills)
# A winding water ribbon and narrow, irregular grassy banks rather than a straight stripe.
def ribbon(name,width,mat,z):
 verts=[]; faces=[]; count=24
 for i in range(count+1):
  x=-24+48*i/count; cy=-8+0.8*math.sin(x*.16); w=width*(1+.12*math.sin(x*.32))
  verts.extend([(x,cy-w/2,z),(x,cy+w/2,z)])
  if i: a=2*(i-1); faces.append((a,a+1,a+3,a+2))
 mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
 o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); assign(o,mat,name)
ribbon('riverbanks',4.7,bank,.008); ribbon('winding stream',3.4,water,.025)
# A narrower irregular lighter ribbon adds water depth, visibly distinct from the bank.
ribbon('stream reflection',1.2,ripple,.035)
# Slightly arched segmented masonry bridge with readable side parapets.
for i in range(-5,6):
 y=-8+i*.38; rise=.19+.34*(1-(i/5.5)**2)
 cube('bridge deck',(0,y,rise),(3.15,.39,.22),stone)
 for x in [-1.47,1.47]:
  cube('bridge parapet',(x,y,rise+.3),(.26,.39,.58),stone)
for x in [-1.47,1.47]:
 for y in [-10.1,-5.9]: cube('bridge end post',(x,y,.48),(.4,.38,.96),stone)
# A simple multi-towered keep behind the separately exported foreground gate.
if not omit_keep:
 cube('keep body',(0,15,3.2),(8.8,6.2,6.4),castle)
 cube('keep upper',(0,15,6.8),(5.2,5.0,2.0),castle)
 for x in [-4.2,4.2]:
  cyl('keep round tower',(x,12.8,3.8),1.1,7.6,castle)
  cone('keep tower roof',(x,12.8,8.7),1.42,2.3,roof)
  cyl('keep spire',(x,12.8,10),.08,.5,wood)
 cone('keep center roof',(0,15,8.7),3.5,2.0,roof)
# Sparse ruins add depth in the mid-ground, with their broad silhouettes uncluttered.
for x,y in [(-10,13),(10,17)]:
 for dx in [-1.2,1.2]:
  cube('ruin pier',(x+dx,y,1.1),(.55,.65,2.2),stone)
  cube('ruin cap',(x+dx,y,2.3),(.8,.8,.25),stone)
 cube('ruin lintel',(x,y,2.35),(2.7,.65,.3),stone)
# Thin organic-looking meadow patches and gentle low mounds break the flat ground.
for i,(x,y,sx,sy) in enumerate([(-8,-10,4,2.8),(7,-6,3,2),(-7,4,3,2),(8,7,4,2.5),(-3,10,2.2,1.3),(12,2,2.3,1.6),(-12,12,3,2)]):
 # Keep raised decorative ground out of the visible river channel.
 river_c=-8+.8*math.sin(x*.16); river_half=1.7*(1+.12*math.sin(x*.32))
 if abs(y-river_c) > sy + river_half + .45:
  ico('meadow patch',(x,y,.02),(sx,sy,.05),meadow if i%2 else meadowshade)
for x,y,sx,sy,h in [(-13,0,5,4,.48),(13,-2,5,3,.35),(-11,17,4,3,.35),(12,19,4,3,.42)]:
 ico('gentle meadow rise',(x,y,-.12),(sx,sy,h),meadowshade)
# Distinct canvas camp tent, poles and signpost; all individual mesh parts only.
verts=[(-4.8,5.2,0),(-2.4,5.2,0),(-3.6,5.2,1.6),(-4.8,7.1,0),(-2.4,7.1,0),(-3.6,7.1,1.6)]
faces=[(0,1,2),(3,5,4),(0,2,5,3),(2,1,4,5),(0,3,4,1)]
mesh=bpy.data.meshes.new('tent mesh'); mesh.from_pydata(verts,[],faces); mesh.update(); o=bpy.data.objects.new('tent',mesh); bpy.context.collection.objects.link(o); assign(o,canvas,'tent')
for y in [5.2,7.1]: cyl('tent pole',(-3.6,y,.82),.055,1.64,wood)
cyl('sign post',(3,5,.65),.09,1.3,wood); cube('sign board',(3,5,1.1),(1,.12,.33),wood)
# Sparse warm flowers provide scale and a little texture without clutter.
for x,y in [(-3,1),(2.8,3.4),(-5,-1.5),(4,6.5),(-2,-4.5),(5,-5),(-8,-2.5),(6,9),(4,-12),(-6,-12),(7,-10),(-7,8)]:
 for dx,dy in [(0,0),(.18,.1),(-.14,.16)]: ico('flower',(x+dx,y+dy,.065),(.09,.09,.08),flower)
# Distinct, sparse short grass tufts instead of an all-over noisy scatter.
for x,y in [(-4,-9),(6,-9),(-5,-5),(6,2),(-5,5),(8,11),(-8,12),(3,7)]:
 for dx,ang in [(-.08,-.2),(0,0),(.08,.2)]:
  o=cone('grass tuft',(x+dx,y,.16),.055,.32,leaf2); o.rotation_euler.y=ang
# Low, distant cloud puffs float in the actual sky above the far landscape.
for x,y,z,s in [(-19,65,17,1), (8,76,19,1.2), (31,88,17,.9)]:
 for dx,dz,k in [(-1.2,0,.8),(0,.45,1),(1.1,0,.75)]:
  ico('cloud',(x+dx*s,y,z+dz*s),(2.8*s*k,1.35*s,1.1*s*k),cloud)
# Merge by material to minimize draws, with origin at world 0 for foliage wind height.
for mat in [wood,leaf,leaf2,leaf3,stone,castle,roof,meadow,meadowshade,ripple,hills,bank,cloud,flower,canvas,water,path,blue]:
 objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.materials) and o.data.materials[0]==mat]
 if not objs: continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs: o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join(); o=bpy.context.object; o.name='environment_'+mat.name.replace(' ','_')
 bpy.context.scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
bpy.ops.object.select_all(action='SELECT')
variant='environment-kit-no-keep' if omit_keep else 'environment-kit'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(art,variant+'.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(out,variant+'.glb'),export_format='GLB',use_selection=True,export_extras=True)
print('Built environment kit:',out)
