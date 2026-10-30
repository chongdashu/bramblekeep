"""Reimport the shipped GLB and check its size and layout against the collision contract."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[4]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'game/public/assets/environment-lab/world-props.glb'))
bpy.context.view_layer.update()
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert meshes, 'no meshes in export'
vertices=[o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
tris=sum(len(o.data.polygons) for o in meshes)
bounds=[[min(v[i] for v in vertices),max(v[i] for v in vertices)] for i in range(3)]
layout=json.loads((root/'game/src/scenes/world-props.json').read_text())['placements']
checks=[]
for item in layout:
 angle=item.get('yaw',0); c=math.cos(angle); s=math.sin(angle)
 for x,z,r in item['colliders']:
  tx=item['x']+c*x+s*z; tz=item['z']-s*x+c*z
  nearest=min(math.hypot(v.x-tx,-v.y-tz) for v in vertices)
  assert nearest <= r+0.08, f"{item['kind']} at {tx,tz}: closest geometry is {nearest:.3f}m away"
  checks.append({'kind':item['kind'],'x':tx,'z':tz,'radius':r,'nearest_mesh_m':round(nearest,3)})
assert len(meshes)<=12 and tris<=5000, (len(meshes),tris)
assert bounds[2][0]>=-0.06 and bounds[2][1]<4, bounds
assert bounds[0][0]<-8 and bounds[0][1]>12 and bounds[1][0]<-20 and bounds[1][1]>15, bounds
print('WORLD_PROPS_VERIFY',json.dumps({'meshes':len(meshes),'triangles':tris,'bounds_blender':bounds,'colliders':checks}))
