"""Clean GLB import, inventory and scale render; run from project root."""
import bpy, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath('game/public/assets/environment/gate-kit.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
coords=[o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
bounds=[[round(min(p[i] for p in coords),4),round(max(p[i] for p in coords),4)] for i in range(3)]
assert len(meshes)==8, len(meshes)
assert abs(bounds[2][0]) < .01 and 5.4 < bounds[2][1] < 5.7, bounds
print('GLB_IMPORT_BOUNDS',bounds)
# Review-only 1.6m scale figure; not in exported file.
mat=bpy.data.materials.new('scale reference'); mat.diffuse_color=(.8,.38,.1,1)
bpy.ops.mesh.primitive_cube_add(size=1,location=(-3.7,-1.55,.64)); o=bpy.context.object; o.dimensions=(.48,.28,1.28); o.data.materials.append(mat)
bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.16,depth=.32,location=(-3.7,-1.55,1.44)); bpy.context.object.data.materials.append(mat)
bpy.ops.mesh.primitive_plane_add(size=20,location=(0,0,-.01))
world=bpy.data.worlds.new('World'); bpy.context.scene.world=world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.70,.78,1); world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
bpy.ops.object.light_add(type='AREA',location=(-5,-8,10)); bpy.context.object.data.energy=1200; bpy.context.object.data.size=8
bpy.ops.object.camera_add(location=(9,-15,10)); cam=bpy.context.object; cam.rotation_euler=(Vector((0,0,2.4))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=10; bpy.context.scene.camera=cam
s=bpy.context.scene;s.render.engine='BLENDER_EEVEE';s.render.resolution_x=1000;s.render.resolution_y=800;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX';s.render.filepath=os.path.abspath('out/environment-kickoff/reimport-review.png');bpy.ops.render.render(write_still=True)
with open('out/environment-kickoff/reimport.json','w') as f: json.dump({'mesh_count':len(meshes),'blender_z_up_bounds_metres':bounds,'proxy_height_m':1.6,'declared_opening_width_m':2.6,'declared_arch_apex_m':3.0},f,indent=2)
