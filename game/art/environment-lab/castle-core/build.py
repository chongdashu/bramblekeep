"""Build the castle's glowing, attackable crystal shrine at the origin. Metres, Z-up."""
import bpy, math
from pathlib import Path
root=Path(__file__).resolve().parents[4]
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name,color,emission=None,strength=1):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.72
 if emission:p.inputs['Emission Color'].default_value=(*emission,1);p.inputs['Emission Strength'].default_value=strength
 return m
stone=mat('Core dark stone',(.12,.15,.18)); trim=mat('Core gold fittings',(.48,.29,.08)); crystal=mat('Core amber crystal',(.95,.42,.035),(1,.24,.01),.7);facet=mat('Core light facets',(1,.70,.12),(1,.42,.025),.8); rune=mat('Core rune light',(1,.65,.12),(1,.37,.04),1.2)
def cyl(name,r,depth,z,m,vertices=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=(0,0,z));o=bpy.context.object;o.name=name;o.data.materials.append(m);return o
def box(name,loc,scale,m,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc,rotation=rot);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
cyl('Foundation',.87,.19,.095,stone);cyl('Gold plinth',.76,.10,.235,trim);cyl('Raised pedestal',.67,.27,.42,stone);cyl('Crystal socket',.59,.10,.605,trim)
# Hexagonal faceted prism with a long pointed top, instantly recognizable at a distance.
n=6;verts=[(0,0,2.65)]
for z,r in [(2.0,.40),(1.05,.50),(.73,.25)]:
 for i in range(n):
  a=2*math.pi*i/n+math.pi/6;verts.append((r*math.cos(a),r*math.sin(a),z))
verts.append((0,0,.68));faces=[]
for i in range(n):
 j=(i+1)%n;faces.append((0,1+i,1+j));faces.append((1+i,7+i,7+j,1+j));faces.append((7+i,13+i,13+j,7+j));faces.append((13+i,19,13+j))
mesh=bpy.data.meshes.new('Crystal facets');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Castle core crystal',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(crystal);o.data.materials.append(facet)
for i,p in enumerate(mesh.polygons):p.material_index=1 if i%4==0 else 0
# Low radial teeth frame the crystal without obscuring its luminous silhouette.
for i in range(6):
 a=2*math.pi*i/6;box('Socket claw',(.52*math.cos(a),.52*math.sin(a),.78),(.14,.14,.47),trim)
# A bright halo and six small glyphs make the objective legible from the gate.
bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=6,major_radius=.71,minor_radius=.028,location=(0,0,.31));bpy.context.object.name='Glowing rim';bpy.context.object.data.materials.append(rune)
for i in range(6):
 a=2*math.pi*i/6;box('Glowing mark',(.72*math.cos(a),.72*math.sin(a),.285),(.10,.10,.025),rune)
for m in [stone,trim,crystal,facet,rune]:
 objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==m]
 # Keep the crystal's two material slots intact.
 if m==crystal: continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 if len(objs)>1:bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'game/art/environment-lab/castle-core/castle-core.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'game/public/assets/environment-lab/castle-core.glb'),export_format='GLB',use_selection=True,export_extras=True)
