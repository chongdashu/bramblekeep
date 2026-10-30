"""Normalize the downloaded Tripo knight and export its embedded in-place clips."""
import bpy, sys, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'tripo-original.glb'))
bpy.context.view_layer.update()
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==arm)
for ob in list(bpy.context.scene.objects):
 if ob.type=='MESH' and ob != mesh: bpy.data.objects.remove(ob,do_unlink=True)
arm.data.pose_position='REST'; bpy.context.view_layer.update()
points=[mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
minz=min(v.z for v in points); maxz=max(v.z for v in points); height=maxz-minz
factor=1.6/height
pivot=bpy.data.objects.new('hero-knight',None); bpy.context.scene.collection.objects.link(pivot)
arm.parent=pivot; pivot.scale=(factor,)*3; pivot.location.z=-minz*factor; pivot.rotation_euler.z=-math.pi/2
arm.data.pose_position='POSE'
# The provider run keeps its Hip offset despite animate_in_place. Match the
# first run hip's horizontal location to the first walk hip; preserve vertical
# and relative animation motion. Measure in armature space and transform the
# correction back through the bone's actual rest basis.
ad=arm.animation_data
for track in ad.nla_tracks: track.mute=True
scene=bpy.context.scene
def hip_at(name):
 action=bpy.data.actions[name]; ad.action=action
 scene.frame_set(round(action.frame_range[0])); bpy.context.view_layer.update()
 return arm.pose.bones['Hip'].matrix.translation.copy()
walk_hip=hip_at('walk'); run_hip=hip_at('run'); bone=arm.pose.bones['Hip']
from mathutils import Matrix
base=bone.matrix.translation.copy(); loc=bone.location.copy(); cols=[]
for i in range(3):
 bone.location=loc; bone.location[i]+=1.0; bpy.context.view_layer.update(); cols.append(bone.matrix.translation.copy()-base)
bone.location=loc; bpy.context.view_layer.update()
basis=Matrix((cols[0],cols[1],cols[2])).transposed()
delta=Vector((walk_hip.x-run_hip.x,walk_hip.y-run_hip.y,0.0))
correction=basis.inverted() @ delta
action=bpy.data.actions['run']
for layer in action.layers:
 for strip in layer.strips:
  for slot in action.slots:
   bag=strip.channelbag(slot)
   if bag:
    for curve in bag.fcurves:
     if curve.data_path=='pose.bones[\"Hip\"].location':
      for key in curve.keyframe_points:
       key.co.y += correction[curve.array_index]; key.handle_left.y += correction[curve.array_index]; key.handle_right.y += correction[curve.array_index]
print('RUN_HIP_CORRECTION',list(correction), 'armature_delta',list(delta))
ad.action=bpy.data.actions['idle']

# Replace the unusable slash (bow/crouch) with the independently inspected
# Tripo box_01 attack. Both retarget results share the original skeleton.
previous=set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=str(root/'tripo-box-original.glb'))
for obj in set(bpy.context.scene.objects)-previous: bpy.data.objects.remove(obj,do_unlink=True)
old=ad.nla_tracks.get('slash')
if old: ad.nla_tracks.remove(old)
box=bpy.data.actions['box_01']; box.name='attack'
track=ad.nla_tracks.new(); track.name='attack'; track.strips.new('attack',int(box.frame_range[0]),box); track.mute=True
if bpy.data.actions.get('slash'): bpy.data.actions.remove(bpy.data.actions['slash'])
# Parent normalisation is exported as a node so skeleton and all clips share scale.
bpy.context.scene.render.fps=24
bpy.context.view_layer.update()
out=root.parents[3]/'public/assets/characters/hero-knight.glb'
out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'hero-knight.blend'))
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_yup=True)
print('NORMALIZE', {'rest_height':height,'factor':factor,'floor':minz,'target':1.6,'file':str(out)})
