"""Build meadow terrain from the river crossing's existing grass material.

Run from the repository root:
  blender -b -t 2 --python game/art/environment-lab/terrain/build.py
The existing crossing export supplies the grass material and river-edge profile;
terrain.json supplies the height field also sampled by the browser.
"""
import bpy, json, math
from pathlib import Path
root=Path(__file__).resolve().parents[4]
layout=json.loads((root/'game/src/scenes/terrain.json').read_text())
def smooth(v):
 t=max(0,min(1,v)); return t*t*(3-2*t)
def height(x,z):
 h=sum(rise*smooth(1-math.hypot((x-cx)/rx,(z-cz)/rz)) for cx,cz,rise,rx,rz in layout['hills'])
 centre=8-.8*math.sin(x*.16); half=1.7*(1+.12*math.sin(x*.32))
 mask=smooth((abs(x)-2.2)/2)*smooth((abs(z-centre)-half-1.4)/2)
 for cx,cz,radius in layout['flatAreas']: mask*=smooth((math.hypot(x-cx,z-cz)-radius)/1.2)
 return h*mask
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'game/public/assets/environment-lab/river-crossing.glb'))
material=bpy.data.materials['River landscape']; material['vgd_kind']='bump'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
verts=[]; faces=[]; n=640; rows=64
for side in (-1,1):
 base=len(verts)
 for i in range(n+1):
  x=-80+160*i/n; center=-8+.8*math.sin(x*.16); half=1.7*(1+.12*math.sin(x*.32))
  bank=.80+.16*math.sin(x*.64+side*.7)+.09*math.sin(x*1.3+side*2.1)
  edge=center+side*(half+bank)
  for j in range(rows+1):
   y=edge+side*((60-abs(edge))*j/rows)
   verts.append((x,y,height(x,-y)))
   if i and j:
    a=base+(i-1)*(rows+1)+j-1; q=(a,a+rows+1,a+rows+2,a+1)
    faces.append(q if side>0 else tuple(reversed(q)))
 # Far outside terrain is flat; attach the horizon to the near grid.
 for i in range(n):
  a=base+i*(rows+1)+rows; b=a+rows+1; c=len(verts)
  verts.extend([(-80+160*i/n,side*500,0),(-80+160*(i+1)/n,side*500,0)])
  q=(a,b,c+1,c);faces.append(q if side>0 else tuple(reversed(q)))
for x0,x1 in [(-500,-80),(80,500)]:
 a=len(verts); verts.extend([(x0,-500,0),(x1,-500,0),(x1,500,0),(x0,500,0)]);faces.append((a,a+1,a+2,a+3))
mesh=bpy.data.meshes.new('Rolling meadow');mesh.from_pydata(verts,[],faces);mesh.update()
obj=bpy.data.objects.new('Rolling meadow',mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(material)
uv=mesh.uv_layers.new(name='Grass UV')
for poly in mesh.polygons:
 poly.use_smooth=True
 for li in poly.loop_indices:
  v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v.x/16,v.y/16)
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
out=root/'game/public/assets/environment-lab/rolling-meadow.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=False,export_yup=True,export_extras=True)
print('TERRAIN',len(verts),'vertices',len(faces),'faces',out)
