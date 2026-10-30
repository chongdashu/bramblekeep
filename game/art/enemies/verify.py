"""Reimport exports and report static bounds and triangle counts."""
import bpy, os
from mathutils import Vector
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
for name, target in [('bloom', 1.0), ('bramble', 1.4)]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(root, 'game/public/assets/enemies', name + '.glb'))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    assert len(meshes) == 1
    obj = meshes[0]
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = [min(v[i] for v in pts) for i in range(3)]
    hi = [max(v[i] for v in pts) for i in range(3)]
    assert abs(lo[2]) < 0.0001 and abs(hi[2] - target) < 0.0001, (name, lo, hi)
    obj.data.calc_loop_triangles()
    print('VERIFIED', name, 'bounds', lo, hi, 'triangles', len(obj.data.loop_triangles))
