"""Normalize the candidate camp tent to metres and export it for the game."""
import bpy, os
from mathutils import Matrix, Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../../..'))
here=os.path.join(root,'game/art/environment-lab/tent')
out=os.path.join(root,'game/public/assets/environment-lab')
os.makedirs(out,exist_ok=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(here,'tripo-original.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert len(meshes)==1
obj=meshes[0]; bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
pts=[obj.matrix_world @ Vector(c) for c in obj.bound_box]
height=max(v.z for v in pts)-min(v.z for v in pts); assert height>0
obj.scale=(2.2/height,)*3; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
pts=[obj.matrix_world @ Vector(c) for c in obj.bound_box]
center=Vector(((min(v.x for v in pts)+max(v.x for v in pts))/2,(min(v.y for v in pts)+max(v.y for v in pts))/2,min(v.z for v in pts)))
obj.data.transform(Matrix.Translation(-center)); obj.name='camp-tent'; bpy.context.view_layer.update()
print('TENT_BOUNDS',tuple(round(max(v[i] for v in pts)-min(v[i] for v in pts),3) for i in range(3)))
bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=os.path.join(here,'tent.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(out,'tripo-tent.glb'),export_format='GLB',use_selection=True,export_extras=True)
