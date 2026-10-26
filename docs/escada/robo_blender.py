# Robô estilizado para a demo dos degraus 9 e 10: corpo, cabeça (nó próprio, gira sozinha), visor, olhos com morph targets
# (piscar, feliz, falar) e duas animações (flutuar, acenar). Exporta robo.glb.
import bpy, math, sys
from mathutils import Vector

saida = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
cena = bpy.context.scene
cena.render.fps = 30

def material(nome, cor, rug=0.3, metal=0.0, emissao=None, forca=0.0, coat=0.0):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*cor, 1)
    p.inputs['Roughness'].default_value = rug
    p.inputs['Metallic'].default_value = metal
    if 'Coat Weight' in p.inputs: p.inputs['Coat Weight'].default_value = coat
    if emissao:
        p.inputs['Emission Color'].default_value = (*emissao, 1)
        p.inputs['Emission Strength'].default_value = forca
    return m

branco = material('casco', (0.92, 0.93, 0.95), rug=0.22, coat=0.8)
visor = material('visor', (0.01, 0.012, 0.02), rug=0.08, metal=0.2, coat=1.0)
olho = material('olho', (0.2, 0.6, 1.0), rug=0.4, emissao=(0.2, 0.6, 1.0), forca=1.5)
junta = material('junta', (0.55, 0.58, 0.63), rug=0.35, metal=0.6)

def esfera(nome, escala, pos, mat, seg=64, aneis=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=aneis, location=pos)
    o = bpy.context.active_object
    o.name = nome
    o.scale = escala
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o

# corpo: um ovo afinando para baixo
corpo = esfera('corpo', (0.62, 0.55, 0.95), (0, 0, 0), branco)
for v in corpo.data.vertices:
    if v.co.z < 0:
        k = 1 - 0.45 * (-v.co.z / 0.95)
        v.co.x *= k; v.co.y *= k
# pescoço
pesc = esfera('pescoco', (0.16, 0.16, 0.1), (0, 0, 0.98), junta, 32, 16)
# cabeça: nó próprio com o pivô no pescoço (gira sem levar o corpo)
cabeca = esfera('cabeca', (0.72, 0.66, 0.5), (0, 0, 0.0), branco)
bpy.ops.object.empty_add(location=(0, 0, 1.05))
piv = bpy.context.active_object; piv.name = 'cabeca_pivo'
cabeca.location = (0, 0, 0.42)
cabeca.parent = piv
# visor preto na frente da cabeça (-Y é a frente no glTF depois da conversão Z-up → Y-up: frente = -Y no Blender)
vis = esfera('visor', (0.6, 0.5, 0.36), (0, -0.2, 0.44), visor)
vis.parent = piv
# olhos: dois discos achatados na frente do visor, com morph targets
olhos = []
for lado in (-1, 1):
    o = esfera(f'olho_{"e" if lado < 0 else "d"}', (0.13, 0.05, 0.16), (0.2 * lado, -0.66, 0.47), olho, 32, 16)
    o.parent = piv
    o.shape_key_add(name='Basis')
    # piscar: achata na vertical
    k = o.shape_key_add(name='piscar')
    for i, v in enumerate(o.data.vertices):
        co = v.co
        k.data[i].co = Vector((co.x, co.y, 0.47 + (co.z - 0.47) * 0.08))
    # feliz: arco (^ ^): sobe o meio, achata embaixo
    k = o.shape_key_add(name='feliz')
    for i, v in enumerate(o.data.vertices):
        co = v.co; dz = co.z - 0.47
        z = 0.47 + (dz * 0.35 if dz < 0 else dz * 0.6) + 0.05 * (1 - min(1, abs(co.x - 0.2 * lado) / 0.13))
        k.data[i].co = Vector((co.x, co.y, z))
    # falar: o olho cresce e arredonda (pulsa com a voz)
    k = o.shape_key_add(name='falar')
    for i, v in enumerate(o.data.vertices):
        co = v.co
        k.data[i].co = Vector((0.2 * lado + (co.x - 0.2 * lado) * 1.25, co.y - 0.01, 0.47 + (co.z - 0.47) * 1.18))
    olhos.append(o)
# braços: duas "asas" com pivô no ombro
bracos = {}
for lado in (-1, 1):
    bpy.ops.object.empty_add(location=(0.55 * lado, 0, 0.35))
    ombro = bpy.context.active_object; ombro.name = f'ombro_{"e" if lado < 0 else "d"}'
    b = esfera(f'braco_{"e" if lado < 0 else "d"}', (0.14, 0.2, 0.55), (0, 0, 0), branco, 48, 24)
    b.location = (0.05 * lado, 0, -0.48)
    b.parent = ombro
    bracos[lado] = ombro
# raiz: tudo pendurado num nó que flutua
bpy.ops.object.empty_add(location=(0, 0, 0))
raiz = bpy.context.active_object; raiz.name = 'robo'
for o in (corpo, pesc, piv, bracos[-1], bracos[1]):
    o.parent = raiz

# animação "flutuar": a raiz sobe e desce, 2 s em loop
def chave(obj, prop, quadro, valor, idx=None):
    if idx is None: setattr(obj, prop, valor)
    else:
        v = list(getattr(obj, prop)); v[idx] = valor; setattr(obj, prop, v)
    obj.keyframe_insert(data_path=prop, frame=quadro, index=-1 if idx is None else idx)

raiz.animation_data_create()
a = bpy.data.actions.new('flutuar'); raiz.animation_data.action = a
for q, z in ((1, 0.0), (31, 0.08), (61, 0.0)):
    chave(raiz, 'location', q, z, 2)
# animação "acenar": o braço direito sobe e balança
od = bracos[1]
od.animation_data_create()
b = bpy.data.actions.new('acenar'); od.animation_data.action = b
for q, rot in ((1, 0), (10, -2.3), (18, -1.9), (26, -2.4), (34, -1.9), (42, -2.3), (55, 0)):
    chave(od, 'rotation_euler', q, rot, 1)
cena.frame_start, cena.frame_end = 1, 61

bpy.ops.export_scene.gltf(filepath=saida, export_format='GLB', export_animations=True, export_morph=True,
                          export_animation_mode='ACTIONS', export_yup=True)
print('OK', saida)
