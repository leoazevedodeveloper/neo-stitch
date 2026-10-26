import type { No, Pos } from './api'

export const LARG = { brief: 360, tela: 220, pedido: 300 }
const GAP_X = 90
const GAP_Y = 28

/** Largura e altura de um nó de imagem/referência no canvas (paisagem 280, retrato 190). */
export function medidaImagem(no: No): { w: number; h: number } {
  let razao = no.largura && no.altura ? no.largura / no.altura : razaoDe(no.aspecto)
  if (!isFinite(razao) || razao <= 0) razao = 16 / 9
  const w = razao >= 1 ? 280 : 190
  return { w, h: Math.round(w / razao) }
}

export function razaoDe(aspecto?: string): number {
  const [a, b] = (aspecto || '16:9').split(':').map(Number)
  return a && b ? a / b : 16 / 9
}

/** No modo "pontos", o pedido concluído vira um ponto na linha (rascunho, fila e erro continuam como card). */
export const ehPonto = (no: No) => no.tipo === 'pedido' && no.status === 'concluido'
export const PONTO = 26

export function medida(no: No, pontos = false): { w: number; h: number } {
  if (pontos && ehPonto(no)) return { w: PONTO, h: PONTO }
  if (no.tipo === 'imagem' || no.tipo === 'referencia' || no.tipo === 'video' || no.tipo === 'modelo') return medidaImagem(no)
  if (no.tipo === 'brief') return { w: LARG.brief, h: 200 }
  if (no.tipo === 'tela') return { w: LARG.tela, h: 48 }
  return { w: LARG.pedido, h: no.status === 'rascunho' ? 150 : 96 }
}

export type Arvore = {
  pai: Map<string, string>          // filho → pai na árvore
  filhos: Map<string, string[]>     // pai → filhos (em ordem de criação)
  soltos: Set<string>               // referências fora da árvore (posição livre)
  anexos: Map<string, string[]>     // pedido → referências soltas que ele usa (somem/andam com o galho do pedido)
  donoDe: Map<string, string>       // referência solta → o 1º pedido que a usa
  total: Map<string, number>        // quantos descendentes cada nó tem (calculado uma vez por árvore)
}

/**
 * A árvore de ideias: brief → telas → pedidos → imagens → pedidos → imagens…
 * O pai de um pedido é a imagem de onde ele saiu (a 1ª entrada que é imagem ou vídeo); sem imagem, a referência (que então
 * pende da tela) se ela não tiver posição própria; senão, a tela. As outras entradas viram arestas tracejadas.
 */
export function arvore(nos: No[]): Arvore {
  const porId = new Map(nos.map((n) => [n.id, n]))
  const pai = new Map<string, string>()
  const ordem = [...nos].sort((a, b) => a.id.localeCompare(b.id))
  const ligar = (filho: string, p?: string | null) => {
    if (p && porId.has(p) && !pai.has(filho)) pai.set(filho, p)
  }
  const brief = nos.find((n) => n.tipo === 'brief')
  for (const n of ordem) {
    if (n.tipo === 'tela') ligar(n.id, n.pai || brief?.id)
    if (n.tipo === 'pedido') {
      const ent = (n.entradas || []).map((e) => porId.get(e)).filter(Boolean) as No[]
      // a imagem (ou o vídeo: um pedido pode partir de um quadro dele) de onde o pedido saiu
      const img = ent.find((e) => e.tipo === 'imagem' || e.tipo === 'video')
      const ref = ent.find((e) => e.tipo === 'referencia')
      // referência com posição própria (colada/arrastada pelo usuário) fica onde está: não vira galho da árvore
      if (img) ligar(n.id, img.id)
      else if (ref && !ref.pos) {
        ligar(ref.id, n.tela || ref.tela)
        ligar(n.id, ref.id)
      } else ligar(n.id, n.tela)
    }
    if (n.tipo === 'imagem' || n.tipo === 'video' || n.tipo === 'modelo') ligar(n.id, n.pedido)
  }
  const filhos = new Map<string, string[]>()
  for (const n of ordem) {
    const p = pai.get(n.id)
    if (!p) continue
    const fs = filhos.get(p)
    if (fs) fs.push(n.id)
    else filhos.set(p, [n.id])
  }
  const soltos = new Set(nos.filter((n) => n.tipo === 'referencia' && !pai.has(n.id)).map((n) => n.id))
  const anexos = new Map<string, string[]>()
  const donoDe = new Map<string, string>()
  for (const n of ordem) {
    if (n.tipo !== 'pedido') continue
    for (const e of n.entradas || []) if (soltos.has(e) && !donoDe.has(e)) {
      donoDe.set(e, n.id)
      const as = anexos.get(n.id)
      if (as) as.push(e)
      else anexos.set(n.id, [e])
    }
  }
  const total = new Map<string, number>()
  const contar = (id: string): number => {
    const c = total.get(id)
    if (c !== undefined) return c
    const n = (filhos.get(id) || []).reduce((s, f) => s + 1 + contar(f), 0)
    total.set(id, n)
    return n
  }
  for (const id of filhos.keys()) contar(id)
  return { pai, filhos, soltos, anexos, donoDe, total }
}

/** Tudo o que sai junto quando um nó é apagado: os descendentes + referências soltas usadas pelos pedidos do galho. */
export function galhoCompleto(a: Arvore, id: string): string[] {
  const out: string[] = []
  const ir = (x: string) => {
    for (const r of a.anexos.get(x) || []) if (!out.includes(r)) out.push(r)
    for (const f of a.filhos.get(x) || []) { out.push(f); ir(f) }
  }
  ir(id)
  return out
}

/** O caminho até as imagens aprovadas: elas + todos os ancestrais (+ referências soltas usadas pelos pedidos do caminho). */
export function caminhoAprovadas(nos: No[], a: Arvore, fogo: Set<string> = new Set()): Set<string> {
  const out = new Set<string>()
  for (const n of nos) {
    if (n.tipo !== 'imagem' || (n.estado !== 'aprovada' && !fogo.has(n.id))) continue
    for (let cur: string | undefined = n.id; cur && !out.has(cur); cur = a.pai.get(cur)) out.add(cur)
  }
  for (const id of [...out]) for (const r of a.anexos.get(id) || []) out.add(r)
  return out
}

/** Quantos nós estão escondidos sob este (recolhido = todo o galho; escondidos = esses filhos e o que saiu deles). */
export function ocultosSob(a: Arvore, no: No): number {
  if (no.recolhido) return descendentes(a, no.id)
  return (no.escondidos || []).filter((f) => (a.filhos.get(no.id) || []).includes(f)).reduce((s, f) => s + 1 + descendentes(a, f), 0)
}

/** Quantos descendentes um nó tem (o selo "+N" quando recolhido). */
export function descendentes(a: Arvore, id: string): number {
  return a.total.get(id) || 0
}

export type ModoLayout = 'pilha' | 'grade' | 'grade3' | 'grade4' | 'grade5'
const POR_COLUNA = 3   // no modo grade: quantas folhas por coluna antes de abrir a próxima
const GAP_COL = 36

/**
 * Os nós visíveis e suas posições: árvore da esquerda para a direita, irmãos empilhados, pai centrado nos filhos.
 * Galhos recolhidos somem; `oculto` esconde folhas (ex.: descartadas sem filhos). Referências soltas ficam onde estão.
 */
export function layoutArvore(nos: No[], a: Arvore, medidas: Map<string, { w: number; h: number }>, oculto: (n: No) => boolean,
  modo: ModoLayout = 'pilha', pontos = false) {
  const porId = new Map(nos.map((n) => [n.id, n]))
  // o ponto tem tamanho fixo (a medida guardada pode ser a do card, de antes de virar ponto)
  const m = (id: string) => {
    const n = porId.get(id)!
    return pontos && ehPonto(n) ? medida(n, true) : medidas.get(id) || medida(n)
  }
  // recolhido: o galho inteiro fecha · escondidos: só esses filhos somem (o "só aprovados" usa isso)
  const visiveisDe = (id: string) => {
    const no = porId.get(id)
    if (no?.recolhido) return []
    const fora = new Set(no?.escondidos || [])
    return (a.filhos.get(id) || []).filter((f) => !fora.has(f) && (!oculto(porId.get(f)!) || (a.filhos.get(f) || []).length))
  }

  // modo grade: as folhas (filhos sem galho visível) viram uma grade de colunas de 3 ao lado do pai;
  // os filhos que têm galho continuam empilhados abaixo dela, abrindo a árvore para a direita
  const separar = (id: string) => {
    const fs = visiveisDe(id)
    if (modo !== 'grade') return { folhas: [] as string[], galhos: fs }
    const folhas = fs.filter((f) => !visiveisDe(f).length)
    if (folhas.length < 2) return { folhas: [] as string[], galhos: fs }
    const ehFolha = new Set(folhas)
    return { folhas, galhos: fs.filter((f) => !ehFolha.has(f)) }
  }
  const grade = (folhas: string[]) => {
    const cw = Math.max(...folhas.map((f) => m(f).w))
    const ch = Math.max(...folhas.map((f) => m(f).h))
    const linhas = Math.min(POR_COLUNA, folhas.length)
    const cols = Math.ceil(folhas.length / POR_COLUNA)
    return { cw, ch, linhas, cols, h: linhas * ch + (linhas - 1) * GAP_Y }
  }

  // modos grade N×N (3, 4, 5): em TODO nível os filhos — com ou sem galho — vão em colunas de N; cada um ocupa o bloco do
  // próprio galho (largura e altura da subárvore), e as colunas ficam lado a lado
  const larguras = new Map<string, number>()
  const porCol = modo === 'grade5' ? 5 : modo === 'grade4' ? 4 : 3   // grade N×N: N filhos por coluna
  const emGradeN = modo === 'grade3' || modo === 'grade4' || modo === 'grade5'
  const colunas = (id: string) => {
    const fs = visiveisDe(id)
    const cols: string[][] = []
    for (let i = 0; i < fs.length; i += porCol) cols.push(fs.slice(i, i + porCol))
    return cols
  }
  const medir3 = (id: string): { w: number; h: number } => {
    const cols = colunas(id)
    let cw = 0
    let ch = 0
    for (const c of cols) {
      const tams = c.map((f) => medir3(f))
      cw += Math.max(...tams.map((t) => t.w))
      ch = Math.max(ch, tams.reduce((s, t) => s + t.h, 0) + GAP_Y * (c.length - 1))
    }
    if (cols.length) cw += GAP_COL * 2 * (cols.length - 1)
    const w = m(id).w + (cols.length ? GAP_X + cw : 0)
    const h = Math.max(m(id).h, ch)
    larguras.set(id, w)
    alturas.set(id, h)
    return { w, h }
  }
  const colocar3 = (id: string, x: number, topo: number) => {
    const cols = colunas(id)
    const { w, h } = m(id)
    const H = alturas.get(id)!
    let cx = x + w + GAP_X
    const centros: number[] = []
    for (const c of cols) {
      const altCol = c.reduce((s, f) => s + alturas.get(f)!, 0) + GAP_Y * (c.length - 1)
      let y = topo + (H - altCol) / 2
      for (const f of c) {
        colocar3(f, cx, y)
        centros.push(pos[f].y + m(f).h / 2)
        y += alturas.get(f)! + GAP_Y
      }
      cx += Math.max(...c.map((f) => larguras.get(f)!)) + GAP_COL * 2
    }
    const centro = centros.length ? (Math.min(...centros) + Math.max(...centros)) / 2 : topo + H / 2
    pos[id] = { x: Math.round(x), y: Math.round(centro - h / 2) }
  }

  const alturas = new Map<string, number>()
  const altura = (id: string): number => {
    if (emGradeN) return medir3(id).h
    const { folhas, galhos } = separar(id)
    const partes = [...(folhas.length ? [grade(folhas).h] : []), ...galhos.map((f) => altura(f))]
    const h = Math.max(m(id).h, partes.reduce((s, x) => s + x, 0) + GAP_Y * Math.max(0, partes.length - 1))
    alturas.set(id, h)
    return h
  }
  const pos: Record<string, Pos> = {}
  const colocar = (id: string, x: number, topo: number) => {
    if (emGradeN) return colocar3(id, x, topo)
    const { folhas, galhos } = separar(id)
    const { w, h } = m(id)
    const H = alturas.get(id)!
    const g = folhas.length ? grade(folhas) : null
    const partes = [...(g ? [g.h] : []), ...galhos.map((f) => alturas.get(f)!)]
    const total = partes.reduce((s, v) => s + v, 0) + GAP_Y * Math.max(0, partes.length - 1)
    let y = topo + (H - total) / 2
    const centros: number[] = []
    const xf = x + w + GAP_X
    if (g) {
      folhas.forEach((f, i) => {
        const col = Math.floor(i / POR_COLUNA)
        const lin = i % POR_COLUNA
        pos[f] = { x: Math.round(xf + col * (g.cw + GAP_COL)), y: Math.round(y + lin * (g.ch + GAP_Y)) }
      })
      centros.push(y + g.ch / 2, y + g.h - g.ch / 2)
      y += g.h + GAP_Y
    }
    for (const f of galhos) {
      colocar(f, xf, y)
      centros.push(pos[f].y + m(f).h / 2)
      y += alturas.get(f)! + GAP_Y
    }
    const centro = centros.length ? (Math.min(...centros) + Math.max(...centros)) / 2 : topo + H / 2
    pos[id] = { x: Math.round(x), y: Math.round(centro - h / 2) }
  }
  // raízes: o brief (e, por segurança, qualquer nó órfão que não seja referência solta)
  const raizes = nos
    .filter((n) => !a.pai.has(n.id) && !a.soltos.has(n.id))
    .sort((x, y) => (x.tipo === 'brief' ? -1 : y.tipo === 'brief' ? 1 : x.id.localeCompare(y.id)))
  let topo = 0
  for (const r of raizes) {
    altura(r.id)
    colocar(r.id, 0, topo)
    topo += alturas.get(r.id)! + 80
  }
  let ys = 0
  for (const id of a.soltos) {
    const n = porId.get(id)!
    // usada num pedido: faz parte daquele fluxo — some quando o galho do pedido está recolhido
    const dono = a.donoDe.get(id)
    if (dono && !pos[dono]) continue
    if (n.pos) pos[id] = n.pos
    else { pos[id] = { x: -360, y: ys }; ys += m(id).h + GAP_Y }
  }
  return pos
}

/** As arestas: a árvore (sólidas) + as entradas extras de cada pedido (tracejadas). */
export function arestas(nos: No[], a: Arvore): { de: string; para: string; tipo: 'linha' | 'entrada' }[] {
  const ids = new Set(nos.map((n) => n.id))
  const out: { de: string; para: string; tipo: 'linha' | 'entrada' }[] = []
  for (const [filho, p] of a.pai) if (ids.has(filho) && ids.has(p)) out.push({ de: p, para: filho, tipo: 'linha' })
  for (const n of nos) {
    if (n.tipo !== 'pedido') continue
    for (const e of n.entradas || []) if (ids.has(e) && a.pai.get(n.id) !== e) out.push({ de: e, para: n.id, tipo: 'entrada' })
  }
  return out
}
