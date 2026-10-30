"""Clean re-import check for the environment lab kit."""
import bpy, json, os
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../..'))
path=os.path.join(root,'game/public/assets/environment-lab/environment-kit.glb')
bpy.ops.import_scene.gltf(filepath=path)
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
points=[o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
assert objects and points
low=[min(p[i] for p in points) for i in range(3)]; high=[max(p[i] for p in points) for i in range(3)]
assert -5.0 <= low[2] <= 0.05 and high[2] > 2.5  # distant hills intentionally sink below the ground
print('ENV_KIT_REIMPORT',json.dumps({'objects':len(objects),'bounds_m':{'min':low,'max':high},'materials':[m.name for m in bpy.data.materials]}))
