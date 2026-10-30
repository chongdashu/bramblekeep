"""Walkable flank routes. Blender Z-up; runtime Y-up, in metres, origin at world origin."""
import bpy, json, math
from pathlib import Path
root=Path(__file__).resolve().parents[4]
routes=json.loads((root/'game/src/scenes/assault-routes.json').read_text())
terrain=json.loads((root/'game/src/scenes/terrain.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
def smooth(v):
 t=max(0,min(1,v)); return t*t*(3-2*t)
def height(x,z):
 h=sum(rise*smooth(1-math.hypot((x-cx)/rx,(z-cz)/rz)) for cx,cz,rise,rx,rz in terrain['hills'])
 centre=8-.8*math.sin(x*.16); half=1.7*(1+.12*math.sin(x*.32))
 mask=smooth((abs(x)-2.2)/2)*smooth((abs(z-centre)-half-1.4)/2)
 for cx,cz,r in terrain['flatAreas']: mask*=smooth((math.hypot(x-cx,z-cz)-r)/1.2)
 return h*mask
def mat(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.95
 return m
# Reuse the main road's painted earth, including its transparent, feathered edges.
bpy.ops.import_scene.gltf(filepath=str(root/'game/public/assets/environment-lab/river-crossing.glb'))
soil=bpy.data.materials['Path earth']; soil['vgd_kind']='bump'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
boards=[mat('Flank bridge oak %d'%i,c) for i,c in enumerate([(.30,.16,.07),(.38,.21,.09),(.34,.18,.075)])]; trim=mat('Flank bridge rail',(.23,.12,.05))
def box(name,x,z,y,sx,sz,sy,material):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=(sx,sz,sy);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
# A continuous strip on each bank. Every vertex samples the same terrain field
# as the character. Gaps at the river are occupied by walkable timber decks.
for side in (-1,1):
 points=[(side*x,z) for x,z in routes['flank']]
 for start,end in ((0,2),(3,len(points)-1)):
  verts=[]; faces=[]
  for k in range(start,end):
   x0,z0=points[k];x1,z1=points[k+1];n=max(1,math.ceil(math.hypot(x1-x0,z1-z0)/.25))
   for j in range(n):
    t=j/n; x=x0+(x1-x0)*t; z=z0+(z1-z0)*t
    dx=x1-x0; dz=z1-z0; length=math.hypot(dx,dz); nx=-dz/length; nz=dx/length
    width=1.13+.10*math.sin(z*1.1+side)
    for sign in (-1,1):
     xx=x+sign*width*nx;zz=z+sign*width*nz
     verts.append((xx,-zz,height(xx,zz)+.035))
    if len(verts)>2:
     a=len(verts)-4;faces.append((a,a+1,a+3,a+2))
  x,z=points[end]; dx=x-points[end-1][0];dz=z-points[end-1][1];length=math.hypot(dx,dz); nx=-dz/length;nz=dx/length
  for sign in (-1,1):
   xx=x+sign*1.13*nx;zz=z+sign*1.13*nz;verts.append((xx,-zz,height(xx,zz)+.035))
  a=len(verts)-4;faces.append((a,a+1,a+3,a+2))
  mesh=bpy.data.meshes.new('Trail');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Flank trail',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(soil)
  uv=mesh.uv_layers.new(name='Trail UV')
  for poly in mesh.polygons:
   for li in poly.loop_indices:
    vi=mesh.loops[li].vertex_index; v=mesh.vertices[vi].co
    uv.data[li].uv=(0 if vi%2==0 else 1,(v.y+29)/44.7)
 # 2.5 m collision corridor within a 2.9 m wide deck. The centred bridge
 # is part of the existing crossing asset, so only create the flanks here.
 x=side*7.2; z=8-.8*math.sin(x*.16)
 for i in range(18):box('Deck plank',x,z-2.47+i*.29,.045,2.9,.275,.09,boards[i%3])
 for dx in (-1.43,1.43):
  box('Side beam',x+dx,z,.18,.16,5.3,.25,trim)
  for dz in (-2.35,-.8,.8,2.35): box('Rail post',x+dx,z+dz,.46,.16,.16,.92,boards[1])
  box('Hand rail',x+dx,z,.91,.17,5.3,.14,boards[2])
# Merge by material; retain world-space pivot.
for m in [soil,*boards,trim]:
 objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==m]
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();bpy.context.object.name='assault-'+m.name.replace(' ','-')
bpy.ops.object.select_all(action='SELECT')
art=root/'game/art/environment-lab/assault-routes';out=root/'game/public/assets/environment-lab/assault-routes.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(art/'assault-routes.blend'))
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_extras=True)
print('EXPORTED',out)
