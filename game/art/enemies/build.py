"""Normalize retained Tripo enemy models to the game's glTF asset convention.

Run: blender --background --python game/art/enemies/build.py
Provider originals are retained; no service call is needed to rebuild exports.
"""
import bpy, os, math
from mathutils import Matrix, Vector

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
base = os.path.join(root, 'game/art/enemies')
out = os.path.join(root, 'game/public/assets/enemies')
os.makedirs(out, exist_ok=True)
for name, height in [('bloom', 1.0), ('bramble', 1.4)]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    here = os.path.join(base, name)
    bpy.ops.import_scene.gltf(filepath=os.path.join(here, 'tripo-original.glb'))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    assert len(meshes) == 1, (name, len(meshes))
    obj = meshes[0]
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # Tripo's face points Blender +X; the game contract is Blender -Y.
    obj.rotation_mode = 'XYZ'
    obj.rotation_euler = (0, 0, -math.pi / 2)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    extent = max(v.z for v in pts) - min(v.z for v in pts)
    assert extent > 0
    obj.scale = (height / extent,) * 3
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    center = Vector(((min(v.x for v in pts) + max(v.x for v in pts)) / 2,
                     (min(v.y for v in pts) + max(v.y for v in pts)) / 2,
                     min(v.z for v in pts)))
    obj.data.transform(Matrix.Translation(-center))
    obj.name = 'enemy-' + name
    bpy.context.view_layer.update()
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(here, name + '.blend'))
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, name + '.glb'),
                              export_format='GLB', use_selection=True, export_extras=True)
    print('NORMALIZED', name, 'height', height, 'base at origin, front -Y')
