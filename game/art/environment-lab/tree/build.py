"""Normalize the single Tripo tree to the game asset contract. Run with Blender --background --python."""
import bpy, os, math
from mathutils import Matrix, Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../../..'))
here=os.path.join(root,'game/art/environment-lab/tree')
out=os.path.join(root,'game/public/assets/environment-lab')
os.makedirs(out,exist_ok=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(here,'tripo-original.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert len(meshes)==1
obj=meshes[0]; bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
pts=[obj.matrix_world @ Vector(c) for c in obj.bound_box]
height=max(v.z for v in pts)-min(v.z for v in pts); assert height>0
obj.scale=(3.8/height,)*3; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
pts=[obj.matrix_world @ Vector(c) for c in obj.bound_box]
center=Vector(((min(v.x for v in pts)+max(v.x for v in pts))/2,(min(v.y for v in pts)+max(v.y for v in pts))/2,min(v.z for v in pts)))
obj.data.transform(Matrix.Translation(-center)); obj.name='garden-tree'; bpy.context.view_layer.update()
bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=os.path.join(here,'tree.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(out,'tripo-tree.glb'),export_format='GLB',use_selection=True,export_extras=True)
print('NORMALIZED tree height=3.8m, base at origin')
