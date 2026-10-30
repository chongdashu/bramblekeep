"""Normalize Tripo rigged enemies, keeping their in-place animations.

Run from the repository root: blender -b -t 2 --python game/art/enemies/build-animated.py
"""
import bpy, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent
for name,height in [('bloom',1.0),('bramble',1.4),('mushroom',1.0)]:
 source=root/name/'tripo-animated.glb'
 if not source.exists(): continue
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(source)); bpy.context.view_layer.update()
 arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==arm]
 assert len(meshes)==1,(name,len(meshes)); mesh=meshes[0]
 arm.data.pose_position='REST';bpy.context.view_layer.update()
 pts=[mesh.matrix_world@Vector(c) for c in mesh.bound_box]
 minz=min(v.z for v in pts);maxz=max(v.z for v in pts);extent=maxz-minz
 factor=height/extent; pivot=bpy.data.objects.new('enemy-'+name,None);bpy.context.scene.collection.objects.link(pivot)
 arm.parent=pivot;pivot.scale=(factor,)*3;pivot.location.z=-minz*factor;pivot.rotation_euler.z=-math.pi/2
 # Import the separate punch from the same rig, replacing the failed kick.
 previous=set(bpy.context.scene.objects)
 bpy.ops.import_scene.gltf(filepath=str(root/name/'tripo-attack.glb'))
 for obj in set(bpy.context.scene.objects)-previous: bpy.data.objects.remove(obj,do_unlink=True)
 ad=arm.animation_data
 old=ad.nla_tracks.get('front_kick_01')
 if old: ad.nla_tracks.remove(old)
 punch=bpy.data.actions['box_01']; punch.name='attack'
 track=ad.nla_tracks.new(); track.name='attack'; track.strips.new('attack',int(punch.frame_range[0]),punch); track.mute=True
 if bpy.data.actions.get('front_kick_01'): bpy.data.actions.remove(bpy.data.actions['front_kick_01'])
 arm.data.pose_position='POSE'; bpy.context.view_layer.update()
 bpy.ops.wm.save_as_mainfile(filepath=str(root/name/(name+'-animated.blend')))
 out=root.parents[1]/'public/assets/enemies'/f'{name}-animated.glb'
 bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_yup=True)
 print('ENEMY_ANIMATED',name,'height',height,'source_height',extent,'factor',factor,'actions',list(bpy.data.actions.keys()))
