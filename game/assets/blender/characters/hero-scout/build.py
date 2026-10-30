"""Normalize provider biped and its in-place clips to game axes and height."""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
root=Path(args[0]).resolve(); height_m=float(args[1]); name=root.name
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'tripo-original.glb'))
bpy.context.view_layer.update()
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==arm)
arm.data.pose_position='REST'; bpy.context.view_layer.update()
points=[mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
minz=min(v.z for v in points); maxz=max(v.z for v in points); scale=height_m/(maxz-minz)
pivot=bpy.data.objects.new(name,None); bpy.context.scene.collection.objects.link(pivot)
arm.parent=pivot; pivot.scale=(scale,)*3; pivot.location.z=-minz*scale; pivot.rotation_euler.z=-math.pi/2
arm.data.pose_position='POSE'; bpy.context.view_layer.update()
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
bpy.context.scene.render.fps=24
out=root.parents[3]/'public/assets/characters'/f'{name}.glb'; out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(root/f'{name}.blend'))
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_yup=True)
print('NORMALIZE',{'height_before':maxz-minz,'scale':scale,'height_after':height_m,'floor':minz,'path':str(out)})
