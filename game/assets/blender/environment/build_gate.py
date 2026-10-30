"""Build gate-kit. Run from project root with Blender --background --python this file."""
import bpy, math, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
root=scene.collection
kit=bpy.data.collections.new('gate-kit'); root.children.link(kit)
review=bpy.data.collections.new('review-only'); root.children.link(review)
def move(obj,col=kit):
 for c in list(obj.users_collection): c.objects.unlink(obj)
 col.objects.link(obj); return obj
def mat(name,color,rough=.85):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough; return m
stone=mat('Stone warm',(.49,.50,.46)); pale=mat('Stone trim',(.67,.64,.55)); dark=mat('Stone shade',(.35,.38,.37)); wood=mat('Door oak',(.31,.16,.075)); wood2=mat('Door alternate',(.38,.20,.095)); blue=mat('Roof blue',(.075,.22,.40)); metal=mat('Iron',(.12,.16,.18),.5); flag=mat('Banner blue',(.09,.28,.49)); grass=mat('Review ground',(.25,.39,.22)); player=mat('Scale proxy',(.87,.43,.13))
def cube(name,loc,dim,material,bevel=.0,col=kit):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=move(bpy.context.object,col); o.name=name; o.dimensions=dim; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(material)
 if bevel:
  mod=o.modifiers.new('soft edges','BEVEL'); mod.width=bevel; mod.segments=2
  mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
 return o
def cylinder(name,loc,radius,depth,material,vertices=8,col=kit):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc); o=move(bpy.context.object,col); o.name=name; o.data.materials.append(material); return o
# The passage opening is exactly 2.6 m wide. Its arched apex is z=3 m.
# Towers rise to 4m; roof tips to 5.35m. Forward is Blender -Y.
for side in (-1,1):
 x=side*2.17
 # Stacked courses introduce visible stone blocks without coplanar seams.
 for row in range(7):
  z=.27+row*.52
  cube(f'tower {side} course {row}',(x,0,z),(1.65,1.65,.50),stone if row%2 else pale,.035)
  for col in (-1,0,1):
   # vertical joints as dark, inset front slits, placed clear of exterior face
   jx=x+col*.40 + (.18 if row%2 else 0)
   cube(f'joint {side} {row} {col}',(jx,-.829,z),(.018,.012,.43),dark,.003)
 cube(f'tower cornice {side}',(x,0,3.82),(1.82,1.82,.35),pale,.035)
 for i in (-1,0,1):
  cube(f'crenel {side} {i}',(x+i*.58,-.74,4.14),(.40,.36,.34),pale,.025)
 # roof circular cone, atop square tower as in the generated reference
 bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=1.03,radius2=0.04,depth=1.38,location=(x,0,4.67)); roof=move(bpy.context.object); roof.name=f'blue roof {side}'; roof.data.materials.append(blue)
 cylinder(f'finial {side}',(x,0,5.45),.06,.24,metal)
# Lintel above apex, with small battlements
cube('bridge parapet',(0,0,3.38),(2.95,1.2,.72),stone,.035)
for i in range(5): cube(f'central crenel {i}',(-1.2+i*.60,-.45,3.89),(.37,.36,.38),pale,.025)
# Arch ring: many separated stone wedges, radially distributed around an arch opening.
# Semi-circular arch center at z=1.7, inner radius 1.3, outer 1.57; front is -Y.
for i in range(9):
 a0=math.pi*i/9+.012; a1=math.pi*(i+1)/9-.012
 pts=[(1.3*math.cos(a0),1.7+1.3*math.sin(a0)),(1.57*math.cos(a0),1.7+1.57*math.sin(a0)),(1.57*math.cos(a1),1.7+1.57*math.sin(a1)),(1.3*math.cos(a1),1.7+1.3*math.sin(a1))]
 verts=[(x,y,z) for y in (-.72,-.47) for x,z in pts]; faces=[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
 mesh=bpy.data.meshes.new(f'arch block {i}'); mesh.from_pydata(verts,[],faces); mesh.materials.append(pale); ob=bpy.data.objects.new(f'arch block {i}',mesh); kit.objects.link(ob)
for side in (-1,1):
 for row in range(4): cube(f'arch jamb {side} {row}',(side*1.435,-.595,.2125+row*.425),(.27,.25,.405),pale,.012)
# Door shaped to fit beneath arch. Panel face slightly behind arch; no z-fighting.
def door():
 outline=[(-1.3,0),(1.3,0),(1.3,1.7)] + [(1.3*math.cos(i*math.pi/12),1.7+1.3*math.sin(i*math.pi/12)) for i in range(1,13)]
 verts=[(x,y,z) for y in (-.43,-.24) for x,z in outline]; n=len(outline); faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))] + [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh=bpy.data.meshes.new('door'); mesh.from_pydata(verts,[],faces); mesh.materials.append(wood); ob=bpy.data.objects.new('gate door',mesh); kit.objects.link(ob)
door()
for x in (-.9,-.6,-.3,0,.3,.6,.9): cube('plank seam',(x,-.438,1.12),(.012,.012,2.20),wood2)
for z in (.75,1.48): cube('iron strap',(0,-.458,z),(2.45,.03,.095),metal,.01)
for x in (-.16,.16):
 cylinder('door boss',(x,-.48,1.1),.075,.04,metal,12).rotation_euler[0]=math.pi/2
# Sparse readable blue banners on towers: geometry offset from wall.
for side in (-1,1):
 x=side*2.17
 cube(f'banner {side}',(x,-.855,2.2),(.46,.035,.90),flag,.01)
 cube(f'banner top {side}',(x,-.881,2.68),(.55,.035,.06),metal,.01)
# Merge independent pieces by material after applying bevels, reducing draw submissions.
# Geometry remains reversible via this generator and there are no texture dependencies.
for material in (stone,pale,dark,wood,wood2,blue,metal,flag):
 objects=[o for o in kit.objects if o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0]==material]
 for ob in objects:
  bpy.context.view_layer.objects.active=ob
  for mod in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
 if len(objects)>1:
  bpy.ops.object.select_all(action='DESELECT')
  for ob in objects: ob.select_set(True)
  bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join(); objects[0].name='gate-kit '+material.name
# review only: scale proxy exactly 1.6m high and simple ground
cube('1.6m scale proxy body',(-3.7,-1.55,.64),(.48,.28,1.28),player,.05,review)
cylinder('1.6m scale proxy head',(-3.7,-1.55,1.44),.16,.32,player,12,review)
cube('review ground',(0,0,-.10),(13,8,.2),grass,.0,review)
# camera and lighting, not exported
world=bpy.data.worlds.new('Studio'); scene.world=world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.70,.78,1); world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
bpy.ops.object.light_add(type='AREA',location=(-5,-8,10)); light=move(bpy.context.object,review); light.name='Key'; light.data.energy=1200; light.data.shape='DISK'; light.data.size=8
bpy.ops.object.camera_add(location=(9,-15,10)); cam=move(bpy.context.object,review); cam.name='Review camera'; direction=Vector((0,0,2.4))-cam.location; cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=10; scene.camera=cam
scene.render.engine='BLENDER_EEVEE'; scene.render.resolution_x=1000; scene.render.resolution_y=800; scene.render.resolution_percentage=100; scene.render.image_settings.file_format='PNG'; scene.view_settings.view_transform='AgX'; scene.render.film_transparent=False
# Save editable source with review helper, then export kit only.
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath('game/assets/blender/environment/gate-kit.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in kit.objects: ob.select_set(True)
bpy.context.view_layer.objects.active=next(iter(kit.objects))
bpy.ops.export_scene.gltf(filepath=os.path.abspath('game/public/assets/environment/gate-kit.glb'),export_format='GLB',use_selection=True,export_apply=True)
scene.render.filepath=os.path.abspath('out/environment-kickoff/gate-review.png'); bpy.ops.render.render(write_still=True)
print('CONTRACT: opening width 2.6m; apex 3.0m; proxy height 1.6m; tower cornice top 3.995m')
