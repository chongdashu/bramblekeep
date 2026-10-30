"""Align Tripo's diagonal arrow along glTF +Z, with its point toward +Z."""
import bpy, numpy as np
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'arrow-original.glb'))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
pts=np.array([tuple(o.matrix_world @ v.co) for o in objects for v in o.data.vertices])
mean=pts.mean(axis=0); _,eigen=np.linalg.eigh(np.cov((pts-mean).T)); direction=eigen[:,-1]
projection=(pts-mean)@direction; lo,hi=projection.min(),projection.max(); span=hi-lo
# The tip is the narrower end; fletching makes the other end broader.
def radius(mask):
 p=pts[mask]-mean; return np.mean(np.linalg.norm(p-np.outer(p@direction,direction),axis=1))
if radius(projection < lo+span*.15)>radius(projection>hi-span*.15): direction=-direction
# Point is now at the negative end; rotate it to Blender -Y (glTF +Z).
tip=Vector(tuple(-direction)); rotation=tip.rotation_difference(Vector((0,-1,0)))
center=Vector(tuple(mean+direction*((lo+hi)*.5)))
pivot=bpy.data.objects.new('arrow-alignment',None);bpy.context.scene.collection.objects.link(pivot)
for o in list(bpy.context.scene.objects):
 if o!=pivot and o.parent is None:
  o.parent=pivot
pivot.rotation_mode='QUATERNION';pivot.rotation_quaternion=rotation
pivot.scale=(0.65/span,)*3
pivot.location=-(rotation @ center)*(0.65/span)
bpy.context.view_layer.update()
out=root.parents[2]/'public/assets/weapons/arrow.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True)
print('ARROW',span, 'output',out)
