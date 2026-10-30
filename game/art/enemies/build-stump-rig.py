"""Create a simple walkable stump rig from its retained Tripo mesh."""
import bpy, math
from mathutils import Vector, Matrix
from pathlib import Path
root=Path(__file__).resolve().parent; name='stump'; height=1.35
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/name/'tripo-original.glb'))
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);bpy.context.view_layer.objects.active=mesh
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# The original face is +X in Blender; glTF +Z is Blender -Y.
# Align the mesh before assigning left/right limb weights.
mesh.rotation_mode='XYZ';mesh.rotation_euler.z=-math.pi/2;bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
points=[mesh.matrix_world@v.co for v in mesh.data.vertices]; minz=min(p.z for p in points);maxz=max(p.z for p in points);factor=height/(maxz-minz)
mesh.scale=(factor,)*3;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
points=[v.co.copy() for v in mesh.data.vertices];center=Vector(((min(p.x for p in points)+max(p.x for p in points))/2,(min(p.y for p in points)+max(p.y for p in points))/2,min(p.z for p in points)))
mesh.data.transform(Matrix.Translation(-center))
data=bpy.data.armatures.new('Stump skeleton');arm=bpy.data.objects.new('Stump rig',data);bpy.context.collection.objects.link(arm)
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
rootbone=data.edit_bones.new('Body');rootbone.head=(0,0,.30);rootbone.tail=(0,0,.85)
for side in [-1,1]:
 leg=data.edit_bones.new('L_Leg' if side<0 else 'R_Leg');leg.head=(side*.16,0,.31);leg.tail=(side*.16,0,.03);leg.parent=rootbone
 arm_bone=data.edit_bones.new('L_Upperarm' if side<0 else 'R_Upperarm');arm_bone.head=(side*.24,0,.78);arm_bone.tail=(side*.53,0,.70);arm_bone.parent=rootbone
bpy.ops.object.mode_set(mode='OBJECT')
for n in ['Body','L_Leg','R_Leg','L_Upperarm','R_Upperarm']:mesh.vertex_groups.new(name=n)
def smooth(v):
 v=max(0,min(1,v));return v*v*(3-2*v)
for v in mesh.data.vertices:
 x,y,z=v.co;leg=smooth((.35-z)/.20);hand=smooth((abs(x)-.32)/.22)*smooth((z-.3)/.25)*(1-leg)
 side='L' if x<0 else 'R';mesh.vertex_groups['Body'].add([v.index],max(.0001,1-leg-hand),'REPLACE')
 if leg>.0001:mesh.vertex_groups[side+'_Leg'].add([v.index],leg,'REPLACE')
 if hand>.0001:mesh.vertex_groups[side+'_Upperarm'].add([v.index],hand,'REPLACE')
mesh.parent=arm;mod=mesh.modifiers.new('Stump skin','ARMATURE');mod.object=arm
for bone in arm.pose.bones:bone.rotation_mode='XYZ'
def action(name, frames):
 act=bpy.data.actions.new(name);arm.animation_data_create();arm.animation_data.action=act
 for frame,phase in frames:
  for bone,amount in [('L_Leg',.40),('R_Leg',-.40),('L_Upperarm',-.26),('R_Upperarm',.26)]:
   b=arm.pose.bones[bone];b.rotation_euler.x=amount*math.sin(phase);b.keyframe_insert(data_path='rotation_euler',frame=frame,group=bone)
 track=arm.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,frames[0][0],act);track.mute=True;arm.animation_data.action=None
 for b in arm.pose.bones:b.rotation_euler=(0,0,0)
action('idle',[(1,0),(25,0)])
action('walk',[(1,0),(7,math.pi/2),(13,math.pi),(19,3*math.pi/2),(25,2*math.pi)])
action('attack',[(1,0),(8,math.pi/2),(16,math.pi)])
bpy.context.scene.render.fps=24;bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(root/name/'stump-animated.blend'))
out=root.parents[1]/'public/assets/enemies/stump-animated.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_yup=True)
print('STUMP_RIG',len(mesh.data.vertices),out)
