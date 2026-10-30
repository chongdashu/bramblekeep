"""Build Blender review scenes from delivered characters and weapons.

Run from the project root with Blender 5.2:
  blender -b -t 1 --python game/assets/blender/weapons/build-review.py
The character and weapon exports remain unchanged. The resulting scenes parent
weapons to the animated hand and are for grip and silhouette review.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector, Matrix
root=Path(__file__).resolve().parents[3]
out=Path(__file__).resolve().parent/'review'
out.mkdir(exist_ok=True)
evidence=root.parent/'out/weapon-blender-review';evidence.mkdir(parents=True,exist_ok=True)
specs=[('knight','hero-knight-grip','sword','R_Hand',-.055,.29,.05,.22,.95,.65,0),('spellcaster','hero-spellcaster-grip','staff','R_Hand',.015,.217,.158,.30,1.18,.65,0),('scout','hero-scout-grip','bow','L_Hand',-.005,-.09,0,.18,1.05,1,math.pi/2)]
for name, character, weapon, hand, xoffset, offset, forward, roll, scale, width, yaw in specs:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(root/'public/assets/characters'/f'{character}.glb'))
 arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 if arm.animation_data:
  for track in arm.animation_data.nla_tracks: track.mute=True
  arm.animation_data.action=bpy.data.actions.get('idle')
 bpy.context.scene.frame_set(1); bpy.context.view_layer.update()
 bone=arm.pose.bones[hand]
 head=arm.matrix_world @ bone.matrix.translation
 before=set(bpy.context.scene.objects)
 bpy.ops.import_scene.gltf(filepath=str(root/'public/assets/weapons'/f'{weapon}.glb'))
 imported=set(bpy.context.scene.objects)-before
 pivot=bpy.data.objects.new(f'{weapon}-grip',None);bpy.context.scene.collection.objects.link(pivot)
 for ob in imported:
  if ob.parent is None:
   old=ob.matrix_world.copy();ob.parent=pivot;ob.matrix_world=old
 # Runtime's idle calibration cancels the idle hand orientation. Coordinates:
 # glTF Y-up/Z-forward -> Blender Z-up/-Y-forward.
 pivot.location=head+Vector((xoffset,-forward,offset))
 pivot.rotation_mode='XYZ';pivot.rotation_euler=(0,-roll,yaw)
 pivot.scale=(scale*width,scale*width,scale)
 bpy.context.view_layer.update()
 world=pivot.matrix_world.copy(); pivot.parent=arm; pivot.parent_type='BONE';pivot.parent_bone=hand; pivot.matrix_world=world
 # Calm fixed studio, same setup for every character.
 bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-0.025)); floor=bpy.context.object; floor.name='review floor'
 mat=bpy.data.materials.new('review floor');mat.diffuse_color=(0.55,0.62,0.53,1);floor.data.materials.append(mat)
 bpy.ops.object.light_add(type='AREA',location=(2,-4,6)); light=bpy.context.object;light.data.energy=450;light.data.shape='DISK';light.data.size=5
 bpy.ops.object.camera_add(location=(3.4,-6.2,3.1));cam=bpy.context.object; direction=Vector((0,0,.85))-cam.location;cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.8;bpy.context.scene.camera=cam
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=600;scene.render.resolution_y=700;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('Studio world');scene.world.color=(0.24,0.24,0.24);scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
 bpy.ops.wm.save_as_mainfile(filepath=str(out/f'{name}-equipment.blend'))
 scene.render.filepath=str(evidence/f'{name}-idle.png');bpy.ops.render.render(write_still=True)
 print('REVIEW',name,'hand',tuple(round(v,3) for v in head),'file',str(out/f'{name}-equipment.blend'))
