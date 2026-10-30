"""Verify the exported GLB, including water extent and shared bank-rock centres."""
import bpy, json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'game/public/assets/environment-lab/river-crossing.glb'))
water=bpy.data.objects['crossing_River_water']; rocks=bpy.data.objects['crossing_Bank_rocks']
water_points=[water.matrix_world @ v.co for v in water.data.vertices]
assert min(v.x for v in water_points) <= -79.99 and max(v.x for v in water_points) >= 79.99
for x in [-65,-22,0,22,65]:
 pts=[v for v in water_points if abs(v.x-x)<0.001]
 assert len(pts)>=2, (x,len(pts))
 actual=(-max(v.y for v in pts),-min(v.y for v in pts))
 centre=8-.8*math.sin(x*.16); half=1.7*(1+.12*math.sin(x*.32))
 assert abs(actual[0]-(centre-half))<0.01 and abs(actual[1]-(centre+half))<0.01,(x,actual)
points=[rocks.matrix_world @ v.co for v in rocks.data.vertices]
layout=json.loads((ROOT/'game/src/scenes/river-bank.json').read_text())
assert len(layout['rocks']) == 8
for rock in layout['rocks']:
 assert min(math.hypot(p.x-rock['x'],p.y+rock['z']) for p in points)<rock['radius']*1.3,rock
ground=bpy.data.objects['crossing_River_landscape']; path=bpy.data.objects['crossing_Path_earth']; paving=bpy.data.objects['crossing_Path_pavers']
assert ground.data.uv_layers and path.data.uv_layers
path_points=[path.matrix_world @ v.co for v in path.data.vertices]
assert min(v.y for v in path_points)<=-28.99 and max(v.y for v in path_points)>=15.69
assert all(not (-9.39 < v.y < -6.11) for v in path_points), 'path must leave the bridge span open'
assert len(paving.data.polygons)>30
assert min((paving.matrix_world @ v.co).y for v in paving.data.vertices) > -24, 'pavers should not make a straight row at the soft path end'
path_mat=bpy.data.materials['Path earth']
image=next(n.image for n in path_mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image)
width,height=image.size
def alpha(x,y): return image.pixels[(y*width+x)*4+3]
assert alpha(width//2,0) < .04 and alpha(width//2,200) > .9, 'path end must fade from transparent to opaque'
assert alpha(0,400) < .1 and alpha(width//2,400) > .9, 'path edges must blend into the meadow'
# Measure texture changes at the same physical distance along each axis. UV
# sampling stretched the old noise into obvious lengthwise streaks.
pixels=list(image.pixels)
def dirt(x,y):
 i=max(0,min(width-1,round((x+1.5)/3*(width-1))))
 j=max(0,min(height-1,round((y+29)/44.7*(height-1))))
 return pixels[(j*width+i)*4]
across=along=0
for i in range(-10,10):
 for j in range(-100,0):
  x=i*.1; y=j*.1-10; value=dirt(x,y)
  across+=abs(dirt(x+.2,y)-value); along+=abs(dirt(x,y+.2)-value)
assert along > 0 and .5 < across/along < 2, 'path texture must have comparable detail in both world axes'
print('PASS water spans -80..80 m; five cross sections match collision; rock centres, textured ground and bridge-clear path verified')
