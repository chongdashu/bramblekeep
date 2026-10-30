"""Build equipped hand variants from the normalized runtime characters.

The generated rigs have no finger bones. A bounded, weight-masked rest-mesh
bend creates a gripping hand while preserving the original open-hand GLBs.
Run from the repository root with Blender 5.2:
  blender -b -t 1 --python game/assets/blender/characters/build-grip-variants.py
"""
import bpy, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[3]/'public/assets/characters'
for name, hand, amount in [('knight','R_Hand',1.6),('spellcaster','R_Hand',1.6),('scout','L_Hand',-0.4)]:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(root/f'hero-{name}.glb'))
 arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==arm)
 arm.data.pose_position='REST'; bpy.context.view_layer.update()
 bone=arm.data.bones[hand]; group=mesh.vertex_groups[hand].index
 head=arm.matrix_world @ bone.head_local
 basis=(arm.matrix_world.to_3x3() @ bone.matrix_local.to_3x3()).normalized()
 invmesh=mesh.matrix_world.inverted(); changed=0
 for vertex in mesh.data.vertices:
  weight=next((g.weight for g in vertex.groups if g.group==group),0.0)
  if weight<0.05: continue
  world=mesh.matrix_world @ vertex.co; local=basis.transposed() @ (world-head)
  # Keep wrist and palm stable, bending smoothly from the finger bases.
  t=max(0,min(1,(local.y-0.045)/0.09)); t=t*t*(3-2*t)
  theta=amount*t; y=local.y-0.045; z=local.z
  bent=Vector((local.x,0.045+math.cos(theta)*y-math.sin(theta)*z,math.sin(theta)*y+math.cos(theta)*z))
  target=head+basis@bent; vertex.co=invmesh @ (world+(target-world)*weight)
  if t>0: changed+=1
 arm.data.pose_position='POSE'; bpy.context.view_layer.update()
 out=root/f'hero-{name}-grip.glb'
 bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_yup=True)
 print('GRIP_VARIANT',name,'hand',hand,'amount',amount,'changed',changed,'path',out)
