"""Run in Blender's Console via Computer Use. Simplify Apple's public AR model.

The resulting mesh data is a local, editable low-poly derivative, with palette
UVs added by build_models.py. The original USDZ URL is recorded in references.
"""
import bpy,json,math
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[3]
REF=ROOT/'scripts/asset-tools/hardware/references'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.wm.usd_import(filepath=str(REF/'airpods-pro.usdz'))
parts=[]
groups={'BLvfImZvTRtJYtd':'Earbud_L','bqtvQbjelRVbbzz':'Earbud_R','kpaqGvvhsGowTJD':'Case_lid_hinge'}
for o in list(bpy.context.scene.objects):
 if o.type!='MESH':continue
 group='Case';p=o.parent
 while p:
  if p.name in groups:group=groups[p.name];break
  p=p.parent
 mat=o.data.materials[0]
 # Duplicate black clear-coat shells intersect after independent reduction.
 # Their opaque white counterparts carry the product surface.
 if mat.name.startswith('FesGv'):continue
 bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 v=bsdf.inputs['Base Color'].default_value[0]
 color='whiteBright' if v>.9 else 'ivory' if v>.7 else 'steel' if v>.4 else 'gray' if v>.2 else 'black'
 # The stock vent meshes use photographic black mesh textures.
 if mat.name.startswith('vdKon'):color='black'
 if o.name=='DkuOUpinUveIrMm':color='green'
 if mat.name.startswith('Hsvh'):color='white'
 world=Matrix.Scale(100,4)@o.matrix_world
 o.parent=None;o.matrix_world=Matrix.Identity(4);o.data.transform(world)
 bpy.context.view_layer.objects.active=o
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True)
 count=sum(len(p.vertices)-2 for p in o.data.polygons)
 dec=o.modifiers.new('PS2 silhouette reduction','DECIMATE');dec.ratio=min(1,max(24/count,.115));dec.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=dec.name)
 verts=[list(v.co) for v in o.data.vertices];faces=[list(p.vertices) for p in o.data.polygons]
 parts.append({'source':o.name,'assembly':group,'color':color,'vertices':verts,'faces':faces})
(REF/'airpods-low-poly.json').write_text(json.dumps(parts,separators=(',',':')))
print('AIRPODS_SIMPLIFIED',sum(len(p['faces']) for p in parts),'faces')
