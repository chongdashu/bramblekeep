"""Build a textured distant-tree LOD from the existing game tree.
The runtime shares its geometry and textures across forest placements.
"""
import bpy, sys
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
HERE=ROOT/'game/art/environment-lab/forest'
OUT=ROOT/'game/public/assets/environment-lab'
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
ratio=float(args[0]) if args else 0.2
preview='--preview' in args
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT/'tripo-tree.glb'))
trees=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert len(trees)==1
source=trees[0]
bpy.context.view_layer.objects.active=source
bpy.ops.object.select_all(action='DESELECT'); source.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
original=source.copy(); original.data=source.data.copy(); bpy.context.collection.objects.link(original)
mod=source.modifiers.new('LOD decimate','DECIMATE'); mod.ratio=ratio
bpy.context.view_layer.objects.active=source
bpy.ops.object.modifier_apply(modifier=mod.name)
print('LOD triangles',sum(len(p.vertices)-2 for p in source.data.polygons))
assert source.data.uv_layers and source.data.materials
if preview:
    source.location.x=2.8; original.location.x=-2.8
    def aim(o, point): o.rotation_euler=(Vector(point)-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(0,-15,6)); camera=bpy.context.object; aim(camera,(0,0,2)); camera.data.type='ORTHO'; camera.data.ortho_scale=11; bpy.context.scene.camera=camera
    bpy.ops.object.light_add(type='AREA', location=(-5,-8,12)); key=bpy.context.object; key.data.energy=1800; key.data.shape='DISK'; key.data.size=9; aim(key,(0,0,2))
    bpy.context.scene.world=bpy.data.worlds.new('Preview world'); bpy.context.scene.world.color=(0.18,0.18,0.18)
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=24
    scene.render.resolution_x=1000; scene.render.resolution_y=500; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(ROOT/f'out/forest-lod-{ratio:.2f}.png'); Path(scene.render.filepath).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)
else:
    bpy.data.objects.remove(original,do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT'); source.select_set(True); bpy.context.view_layer.objects.active=source
    source.name='distant-tree-lod'
    bpy.ops.export_scene.gltf(filepath=str(OUT/'tree-lod.glb'),export_format='GLB',use_selection=True)
    print('exported shared tree LOD to',OUT/'tree-lod.glb')
