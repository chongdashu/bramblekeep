"""Cut a gameplay passage through the generated, non-manifold keep mesh."""
import bpy, bmesh
from pathlib import Path
root=Path(__file__).resolve().parents[4]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'game/public/assets/environment-lab/tripo-keep.glb'))
keep=next(o for o in bpy.context.scene.objects if o.type=='MESH')
# The Tripo mesh is not watertight; Boolean difference silently left the door
# intact. Remove triangles inside the passage in world space instead.
bm=bmesh.new();bm.from_mesh(keep.data)
faces=[]
for f in bm.faces:
    p=keep.matrix_world @ f.calc_center_median()
    if abs(p.x)<1.02 and -0.1<p.z<2.35 and abs(p.y)<2.2: faces.append(f)
print('Removing doorway triangles:',len(faces))
bmesh.ops.delete(bm,geom=faces,context='FACES')
bm.to_mesh(keep.data);bm.free();keep.data.update()
bpy.ops.object.select_all(action='DESELECT');keep.select_set(True);bpy.context.view_layer.objects.active=keep
bpy.ops.export_scene.gltf(filepath=str(root/'game/public/assets/environment-lab/tripo-keep-breached.glb'),export_format='GLB',use_selection=True)
