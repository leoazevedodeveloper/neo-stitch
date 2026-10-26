import {
  Background, BackgroundVariant, ControlButton, Controls, Handle, Position, ReactFlow, ReactFlowProvider, applyNodeChanges, useReactFlow,
  type Edge, type FitViewOptions, type Node, type NodeChange, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { BadgeCheck, Bot, Box, Check, Clapperboard, Code2, Image as ImageIcon, LoaderCircle, ExternalLink, Eye, EyeOff, Flame, LayoutGrid, Maximize, Network, RotateCcw, Star } from 'lucide-react'
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, arquivoUrl, dinheiro, rotaFogo, urlModelo, type Estado, type EstadoProjeto, type No, type Trabalho } from './api'
import { CanvasCtx, type Ctx as CtxCanvas } from './ctx'
import { ESTADOS, alternarEstado } from './estados'
import { arvore, razaoDe } from './layout'
import { SpecAgentes } from './Spec'
import { Viewer } from './Viewer'
import { useProjeto } from './useProjeto'

const ORDEM: Record<string, number> = { aprovada: 0, favorita: 1, neutra: 2, descartada: 3 }
const porCodigo = (a: No, b: No) => a.id.localeCompare(b.id, undefined, { numeric: true })

/** As imagens com fogo do projeto, na ordem do código. */
function fogosDe(estado: EstadoProjeto): No[] {
  const porId = new Map(estado.nos.map((n) => [n.id, n]))
  return Object.keys(estado.avancos || {}).map((id) => porId.get(id)).filter((n): n is No => !!n?.arquivo).sort(porCodigo)
}

/** As aprovadas que ainda não viraram nada (a próxima fila do fogo). */
function aprovadasDe(estado: EstadoProjeto): No[] {
  const fogo = estado.avancos || {}
  return estado.nos.filter((n) => n.tipo === 'imagem' && n.estado === 'aprovada' && n.arquivo && !fogo[n.id]).sort(porCodigo)
}

/** A barra da esquerda: as imagens que viraram algo maior e, abaixo, as aprovadas. No canvas só aparece quando há alguma. */
export function TrilhoFogo({ slug, estado, ativo, voltar }: { slug: string; estado: EstadoProjeto; ativo?: string; voltar?: boolean }) {
  const fogos = fogosDe(estado)
  const aprovadas = aprovadasDe(estado)
  if (!voltar && !fogos.length && !aprovadas.length) return null
  return (
    <nav className="trilho" aria-label="Em desenvolvimento e aprovadas">
      {voltar && (
        <>
          <a href={`#/p/${slug}`} className="trilho-ico" title={`Voltar ao canvas de ${estado.projeto.nome}`}><Network size={17} /></a>
          <span className="trilho-sep" />
        </>
      )}
      {fogos.length > 0 && <span className="trilho-fogo" title="Em desenvolvimento: imagens que já ganharam vídeo ou HTML"><Flame size={15} /></span>}
      {fogos.map((n) => {
        const a = estado.avancos[n.id]
        return (
          <a key={n.id} href={rotaFogo(slug, n.id)} className={`trilho-item ${ativo === n.id ? 'on' : ''}`}
            title={`${n.id}${n.nome ? ` · ${n.nome}` : ''} — ${a.videos.length} vídeo(s)${a.impl.length ? ` · ${a.impl.length} HTML` : ''}`}>
            <img src={arquivoUrl(slug, n.thumb || n.arquivo)} alt="" />
            <span>{a.videos.length + a.impl.length}</span>
          </a>
        )
      })}
      {aprovadas.length > 0 && (
        <>
          {fogos.length > 0 && <span className="trilho-sep" />}
          <span className="trilho-aprovadas" title="Aprovadas: ainda sem vídeo nem HTML"><BadgeCheck size={15} /></span>
          {aprovadas.map((n) => (
            <a key={n.id} href={rotaFogo(slug, n.id)} className={`trilho-item aprovada ${ativo === n.id ? 'on' : ''}`}
              title={`${n.id}${n.nome ? ` · ${n.nome}` : ''} — aprovada`}>
              <img src={arquivoUrl(slug, n.thumb || n.arquivo)} alt="" />
            </a>
          ))}
        </>
      )}
    </nav>
  )
}

// ---------- a página de uma imagem: um canvas imagem → pedidos → vídeos e sites ----------

type Dado = { tipo: 'origem' | 'grupo' | 'video' | 'imagem' | 'modelo' | 'site'; no?: No; versao?: string; trabalho?: Trabalho; grupo?: { video: boolean; imagens?: boolean; titulo: string; codigo?: string } }
/** Um cartão e o que derivou dele (vídeo → as imagens tiradas dele e os sites feitos a partir dele). */
type Item = { d: Dado; filhos: Item[] }
type NoFogo = Node<Dado>

type FogoCtx = {
  slug: string; img: No; largura: number
  copiar: (t: string) => void; abrir: (id: string) => void
  aprovarSite: (versao: string, estado: Estado) => void
  mudar: (id: string, c: Partial<No>) => void; registrar: (id: string, el: HTMLVideoElement | null) => void
}
const Ctx = createContext<FogoCtx | null>(null)
const useFogo = () => useContext(Ctx)!

/** O código de um vídeo ou site: clicar copia (para citar no chat). */
function Codigo({ id }: { id: string }) {
  const { copiar } = useFogo()
  return (
    <button type="button" className="codigo nodrag" title="Copiar código para citar no chat"
      onClick={(e) => { e.stopPropagation(); copiar(id) }} onDoubleClick={(e) => e.stopPropagation()}>{id}</button>
  )
}

/** Código do site: a pasta impl/<imagem>/<versão>. */
const codigoSite = (img: string, v: string) => `${img}/${v}`

// enquadrar sem ficar atrás do topo nem do trilho da esquerda
const ENQUADRAR: FitViewOptions = { padding: { top: '76px', left: '124px', right: '32px', bottom: '32px' }, maxZoom: 1 }
const GAP_X = 90, GAP_Y = 28, GAP_COL = 28, GAP_GRUPO = 64, COLS = 3, PONTO = 26, LEGENDA = 38

function montar(img: No, grupos: { grupo: Dado['grupo'] & { id: string }; itens: Item[] }[], largura: number) {
  const razao = img.largura && img.altura ? img.largura / img.altura : razaoDe(img.aspecto)
  const h = Math.round(largura / razao) + LEGENDA
  const lo = Math.round(largura * 1.2), ho = Math.round(lo / razao) + LEGENDA
  const xg = lo + GAP_X, xc = xg + PONTO + GAP_X
  const nodes: NoFogo[] = [], edges: Edge[] = []
  const idDe = (d: Dado) => d.no?.id || codigoSite(img.id, d.versao!)
  const altura = (it: Item): number =>
    Math.max(h, it.filhos.reduce((s, f) => s + altura(f), 0) + GAP_Y * Math.max(0, it.filhos.length - 1))
  // um item e os derivados à direita, empilhados e centrados nele
  const colocar = (it: Item, x: number, y: number) => {
    const alt = altura(it), id = idDe(it.d)
    nodes.push({ id, type: it.d.tipo, position: { x, y: y + alt / 2 - h / 2 }, data: it.d, style: { width: largura } })
    let yf = y + (alt - (it.filhos.reduce((s, f) => s + altura(f), 0) + GAP_Y * Math.max(0, it.filhos.length - 1))) / 2
    for (const f of it.filhos) {
      colocar(f, x + largura + GAP_X, yf)
      edges.push({ id: `${id}-${idDe(f.d)}`, source: id, target: idDe(f.d), className: f.d.tipo === 'imagem' || f.d.tipo === 'modelo' ? '' : it.d.tipo === 'site' ? 'deriva evolucao' : 'deriva' })
      yf += altura(f) + GAP_Y
    }
    return alt
  }
  let y = 0
  for (const { grupo, itens } of grupos) {
    // o que já virou HTML ganha uma linha própria; os demais seguem em grade
    const comFilhos = itens.filter((it) => it.filhos.length), resto = itens.filter((it) => !it.filhos.length)
    const y0 = y
    for (const it of comFilhos) {
      y += colocar(it, xc, y) + GAP_Y
      edges.push({ id: `${grupo.id}-${idDe(it.d)}`, source: grupo.id, target: idDe(it.d) })
    }
    resto.forEach((it, i) => {
      const id = idDe(it.d)
      nodes.push({ id, type: it.d.tipo, position: { x: xc + (i % COLS) * (largura + GAP_COL), y: y + Math.floor(i / COLS) * (h + GAP_Y) }, data: it.d, style: { width: largura } })
      edges.push({ id: `${grupo.id}-${id}`, source: grupo.id, target: id, className: it.d.no?.estado === 'descartada' ? 'apagada' : '' })
    })
    const linhas = Math.ceil(resto.length / COLS)
    y += linhas ? linhas * h + (linhas - 1) * GAP_Y : -GAP_Y
    nodes.push({ id: grupo.id, type: 'grupo', position: { x: xg, y: (y0 + y) / 2 - PONTO / 2 }, data: { tipo: 'grupo', grupo } })
    edges.push({ id: `o-${grupo.id}`, source: img.id, target: grupo.id })
    y += GAP_GRUPO
  }
  const total = Math.max(ho, y - GAP_GRUPO)
  nodes.unshift({ id: img.id, type: 'origem', position: { x: 0, y: Math.round(total / 2 - ho / 2) }, data: { tipo: 'origem', no: img }, style: { width: lo } })
  return { nodes, edges }
}

export function PaginaFogo({ slug, id }: { slug: string; id: string }) {
  return <ReactFlowProvider><PaginaFogoInterna slug={slug} id={id} /></ReactFlowProvider>
}

function PaginaFogoInterna({ slug, id }: { slug: string; id: string }) {
  const { estado, erro, mudar, acao } = useProjeto(slug)
  const [grande, setGrande] = useState(() => localStorage.getItem('neo:fogo-grande') === '1')
  const [esconder, setEsconder] = useState(false)
  const [foco, setFoco] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [spec, setSpec] = useState(false)
  const videosRef = useRef(new Map<string, HTMLVideoElement>())

  const porId = useMemo(() => new Map((estado?.nos || []).map((n) => [n.id, n])), [estado])
  const img = porId.get(id)
  const av = estado?.avancos?.[id]
  const largura = grande ? 520 : 340

  // HTML vivo primeiro (versão mais nova em cima); depois os vídeos, por pedido (melhores primeiro)
  const grupos = useMemo(() => {
    const out: { grupo: Dado['grupo'] & { id: string }; itens: Item[] }[] = []
    // o HTML feito a partir de um vídeo (video2html) deriva do vídeo; só o que saiu direto da imagem (img-to-html) pende dela
    const origens = av?.origens || {}
    const daImagem = [...(av?.impl || [])].reverse().filter((v) => !origens[v] && !av?.trabalhos?.[v]?.base)
    if (img && daImagem.length) {
      out.push({ grupo: { id: `${id}/html`, video: false, titulo: 'HTML direto da imagem (img-to-html)' }, itens: daImagem.map((v) => ({ d: { tipo: 'site', versao: v, trabalho: av?.trabalhos?.[v] }, filhos: [] })) })
    }
    // vídeo → os sites feitos a partir dele (impl.json/origem.json com o código do vídeo) → as evoluções de cada site
    // (v1 → v1.1 → v1.2: impl.json com `base`)
    const versoes = [...(av?.impl || [])].reverse()
    const trab = av?.trabalhos || {}
    const baseDe = (v: string) => { const b = trab[v]?.base; return b && versoes.includes(b) ? b : null }
    const site = (v: string): Item => ({
      d: { tipo: 'site', versao: v, trabalho: trab[v] },
      filhos: [...versoes].reverse().filter((x) => baseDe(x) === v && !(esconder && trab[x]?.estado === 'descartada')).map(site),
    })
    // do vídeo saem as imagens tiradas de um quadro dele (pedido com o vídeo na 1ª entrada) e os sites feitos a partir dele
    // um site com `entradas` (imagens tiradas do vídeo) pende da 1ª delas; o vídeo e as outras chegam por linhas extras
    const sitesDoVideo = (vid: string) => versoes.filter((v) => origens[v] === vid && !baseDe(v))
    const imagensDe = (vid: string): Item[] => {
      const imgs = (estado?.nos || [])
        .filter((p) => p.tipo === 'pedido' && p.entradas?.[0] === vid)
        .flatMap((p) => (p.saidas || []).map((s) => porId.get(s)).filter((n): n is No => n?.tipo === 'imagem' && !(esconder && n.estado === 'descartada')))
      // de cada imagem saem os modelos 3D gerados dela (pedido com a imagem na 1ª entrada)
      const modelosDe = (img: string) => (estado?.nos || [])
        .filter((p) => p.tipo === 'pedido' && p.entradas?.[0] === img)
        .flatMap((p) => (p.saidas || []).map((s) => porId.get(s)).filter((n): n is No => n?.tipo === 'modelo' && !(esconder && n.estado === 'descartada')))
      const ids = new Set([...imgs.map((n) => n.id), ...imgs.flatMap((n) => modelosDe(n.id).map((m) => m.id))])
      const pai = (v: string) => trab[v]?.entradas?.find((e) => ids.has(e))
      const sitesDe = (id: string) => sitesDoVideo(vid).filter((v) => pai(v) === id).map(site)
      return imgs.map((n) => ({
        d: { tipo: 'imagem', no: n },
        filhos: [...modelosDe(n.id).map((m) => ({ d: { tipo: 'modelo' as const, no: m }, filhos: sitesDe(m.id) })), ...sitesDe(n.id)],
      }))
    }
    const filhosDe = (vid: string): Item[] => {
      const imgs = imagensDe(vid)
      const todos = (it: Item): Item[] => [it, ...it.filhos.flatMap(todos)]
      const pendurados = new Set(imgs.flatMap(todos).map((it) => it.d.versao).filter(Boolean))
      return [...imgs, ...sitesDoVideo(vid).filter((v) => !pendurados.has(v)).map(site)]
    }
    // as continuações em imagem: pedidos com esta imagem na 1ª entrada (variações, ajustes); o que saiu delas e foi
    // continuado de novo pende da imagem de onde partiu
    const pedidosDeImagem = (de: string) => (estado?.nos || [])
      .filter((p) => p.tipo === 'pedido' && p.midia !== 'video' && p.entradas?.[0] === de)
      .sort(porCodigo)
    const saidasImagem = (p: No) => (p.saidas || []).map((s) => porId.get(s))
      .filter((n): n is No => n?.tipo === 'imagem' && !(esconder && n.estado === 'descartada'))
    const continuacao = (n: No, vistos: Set<string>): Item => ({
      d: { tipo: 'imagem', no: n },
      filhos: vistos.has(n.id) ? [] : pedidosDeImagem(n.id).flatMap(saidasImagem).map((f) => continuacao(f, new Set([...vistos, n.id]))),
    })
    for (const p of pedidosDeImagem(id)) {
      const imgs = saidasImagem(p)
      if (!imgs.length) continue
      out.push({
        grupo: { id: p.id, video: false, imagens: true, titulo: p.intencao || 'Variações', codigo: p.id },
        itens: imgs.sort((a, b) => ORDEM[a.estado || 'neutra'] - ORDEM[b.estado || 'neutra']).map((n) => continuacao(n, new Set([id]))),
      })
    }
    const m = new Map<string, No[]>()
    for (const v of av?.videos || []) {
      const n = porId.get(v)
      if (!n || (esconder && n.estado === 'descartada' && !filhosDe(v).length)) continue
      m.set(n.pedido || '', [...(m.get(n.pedido || '') || []), n])
    }
    for (const [p, vs] of m) {
      const ped = porId.get(p)
      out.push({
        grupo: { id: p || `${id}/videos`, video: true, titulo: ped?.intencao || 'Vídeos', codigo: ped?.id },
        itens: vs.sort((a, b) => ORDEM[a.estado || 'neutra'] - ORDEM[b.estado || 'neutra']).map((n) => ({ d: { tipo: 'video', no: n }, filhos: filhosDe(n.id) })),
      })
    }
    return out
  }, [img, av, id, porId, esconder, estado?.nos])

  // o layout é recalculado quando os dados mudam; o que foi arrastado à mão fica onde está até trocar de imagem ou de tamanho
  const montado = useMemo(() => {
    if (!img) return { nodes: [], edges: [] }
    const m = montar(img, grupos, largura)
    // as linhas extras de um site que parte de imagens do vídeo: o vídeo e as outras imagens (a 1ª já é o pai na árvore)
    const tem = new Set(m.nodes.map((n) => n.id))
    for (const [v, t] of Object.entries(av?.trabalhos || {})) {
      const alvo = codigoSite(img.id, v), vid = av?.origens?.[v]
      if (!t.entradas?.length || !tem.has(alvo)) continue
      for (const e of [...t.entradas, vid].filter((e): e is string => !!e && tem.has(e))) {
        if (!m.edges.some((x) => x.source === e && x.target === alvo)) m.edges.push({ id: `${e}-${alvo}`, source: e, target: alvo, className: e === vid ? 'deriva recebe' : 'deriva' })
      }
    }
    return m
  }, [img, grupos, largura, av])
  const [nodes, setNodes] = useState<NoFogo[]>([])
  const movidos = useRef(new Map<string, { x: number; y: number }>())
  useEffect(() => { movidos.current.clear() }, [id, largura])
  useEffect(() => {
    setNodes(montado.nodes.map((n) => (movidos.current.has(n.id) ? { ...n, position: movidos.current.get(n.id)! } : n)))
  }, [montado])
  const onNodesChange = useCallback((ch: NodeChange<NoFogo>[]) => {
    for (const c of ch) if (c.type === 'position' && c.position) movidos.current.set(c.id, c.position)
    setNodes((ns) => applyNodeChanges(ch, ns))
  }, [])

  const sincronizar = useCallback(() => {
    for (const v of videosRef.current.values()) { v.currentTime = 0; v.play().catch(() => {}) }
  }, [])
  const prontos = grupos.reduce((s, g) => s + g.itens.filter((it) => it.d.no?.arquivo).length, 0)
  useEffect(() => {
    const t = setTimeout(sincronizar, 600)  // todos começam juntos depois de carregar
    return () => clearTimeout(t)
  }, [prontos, sincronizar])
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 1600)
    return () => clearTimeout(t)
  }, [aviso])

  const ctx = useMemo<FogoCtx | null>(() => (img ? {
    slug, img, largura, mudar, abrir: setFoco,
    aprovarSite: (versao, e) => { acao(() => api.mudarImpl(slug, img.id, versao, e)) },
    copiar: (t) => { navigator.clipboard?.writeText(t); setAviso(`${t} copiado`) },
    registrar: (vid, el) => { if (el) videosRef.current.set(vid, el); else videosRef.current.delete(vid) },
  } : null), [slug, img, largura, mudar, acao])

  // o Viewer do canvas (faixa com os irmãos lado a lado, comentários, estado) roda aqui com um contexto mínimo;
  // pedir vídeo ou variações cria o pedido e volta ao canvas, onde ele é escrito e enviado (as variações voltam a aparecer aqui)
  const nosProj = estado?.nos
  const arv = useMemo(() => arvore(nosProj || []), [nosProj])
  const ctxCanvas = useMemo<CtxCanvas | null>(() => {
    if (!estado || !ctx) return null
    const nada = () => {}
    const novoPedido = async (entradas: string[], tela?: string, extra?: Partial<No>) => {
      const p = await acao(() => api.criarNo(slug, { tipo: 'pedido', entradas, tela: tela || estado.nos.find((n) => n.tipo === 'tela')?.id, ...extra }))
      if (p) location.hash = `#/p/${slug}`
      return p
    }
    return {
      slug, estado, porId, arv, mudar, acao, copiar: ctx.copiar, novoPedido,
      pedidoVideo: (img: string) => novoPedido([img], undefined, { midia: 'video' }),
      alternar: nada, apagar: async () => {}, abrir: setFoco, painel: nada, novaTela: async () => {}, enviar: async () => {},
      focar: null, pontos: true, limparFoco: nada,
    }
  }, [estado, ctx, slug, porId, arv, mudar, acao])

  if (!estado) return <div className="carregando">{erro ? <p className="erro-tela">{erro}</p> : <span className="pulso grande" />}</div>
  if (!img || !ctx) {
    return (
      <div className="canvas">
        <Topo slug={slug} estado={estado} />
        <TrilhoFogo slug={slug} estado={estado} voltar />
        <p className="mudo fogo-vazio">{id} não está neste projeto.</p>
      </div>
    )
  }
  const total = (av?.videos || []).reduce((s, v) => s + (porId.get(v)?.custo || 0), 0)

  return (
    <Ctx.Provider value={ctx}>
      <div className="canvas fogo-canvas">
          {nodes.length > 0 && (
            <ReactFlow key={`${id}-${largura}`} nodes={nodes} edges={montado.edges} nodeTypes={tiposFogo} onNodesChange={onNodesChange}
              fitView fitViewOptions={ENQUADRAR} minZoom={0.05} maxZoom={2.5} proOptions={{ hideAttribution: true }}
              nodesConnectable={false} elementsSelectable={false} deleteKeyCode={null}
              onPaneClick={() => setFoco(null)} zoomOnScroll panOnScroll={false} zoomOnDoubleClick={false}>
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} color="var(--ponto)" />
              <Controls showInteractive={false} showFitView={false} position="bottom-left">
                <EnquadrarBotao />
              </Controls>
            </ReactFlow>
          )}
          <Topo slug={slug} estado={estado}>
            <span className="topo-sep">/</span>
            <span className={`topo-fogo ${av ? '' : 'aprovada'}`} title={av ? 'Em desenvolvimento' : 'Aprovada: ainda sem vídeo nem HTML'}>
              {av ? <Flame size={15} /> : <BadgeCheck size={15} />}
            </span>
            <Codigo id={img.id} />
            {img.nome && <span className="topo-img-nome">{img.nome}</span>}
            <span className="cresce" />
            {total > 0 && <span className="custo" title="Custo dos vídeos desta imagem">{dinheiro(total)}</span>}
            <button type="button" className="ico" title="Delegar o vídeo → HTML para outros agentes (a spec)" onClick={() => setSpec(true)}><Bot size={16} /></button>
            <button type="button" className="ico" title="Recomeçar todos juntos" onClick={sincronizar}><RotateCcw size={16} /></button>
            <button type="button" className={`ico ${esconder ? 'on' : ''}`} title={esconder ? 'Mostrar descartados' : 'Esconder descartados'}
              onClick={() => setEsconder(!esconder)}>{esconder ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            <button type="button" className={`ico ${grande ? 'on' : ''}`} title="Cartões maiores"
              onClick={() => { setGrande(!grande); localStorage.setItem('neo:fogo-grande', grande ? '0' : '1') }}><LayoutGrid size={16} /></button>
          </Topo>
          <TrilhoFogo slug={slug} estado={estado} ativo={id} voltar />
          {aviso && <div className="toast">{aviso}</div>}
          {spec && (
            <SpecAgentes videos={(av?.videos || []).map((v) => porId.get(v)).filter((n): n is No => !!n?.arquivo).map((n) => ({ id: n.id, nome: n.nome || n.modelo || '' }))}
              fechar={() => setSpec(false)} copiar={(t, msg) => { navigator.clipboard?.writeText(t); setAviso(msg || `${t} copiado`) }} />
          )}
        {foco && porId.get(foco) && ctxCanvas && (
          <CanvasCtx.Provider value={ctxCanvas}><Viewer id={foco} fechar={() => setFoco(null)} navegar={setFoco} /></CanvasCtx.Provider>
        )}
      </div>
    </Ctx.Provider>
  )
}

/** O topo do canvas de projeto: logo (projetos), nome do projeto (volta ao canvas) e o que a página acrescenta. */
function Topo({ slug, estado, children }: { slug: string; estado: EstadoProjeto; children?: React.ReactNode }) {
  return (
    <header className="topo">
      <a href="#/" className="marca-app" title="Projetos"><img src="/favicon.svg" alt="" width={22} height={22} /></a>
      <a href={`#/p/${slug}`} className="projeto-nome link" title="Voltar ao canvas do projeto">{estado.projeto.nome}</a>
      <span className="prefixo">{estado.projeto.prefixo}</span>
      {children}
    </header>
  )
}

function EnquadrarBotao() {
  const rf = useReactFlow()
  return <ControlButton title="Mostrar tudo" onClick={() => rf.fitView({ ...ENQUADRAR, duration: 300 })}><Maximize size={12} /></ControlButton>
}

const Origem = memo(function Origem({ data }: NodeProps<NoFogo>) {
  const { slug, abrir } = useFogo()
  const n = data.no!
  return (
    <figure className="fogo-cartao tipo-imagem origem" onClick={() => abrir(n.id)}>
      <div className="fogo-quadro"><img src={arquivoUrl(slug, n.arquivo)} alt={n.nome || n.id} draggable={false} /></div>
      <figcaption><ImageIcon size={12} strokeWidth={1.6} className="cartao-tipo" /><Codigo id={n.id} /><b>Imagem</b><span className="cresce" />{n.nome && <i>{n.nome}</i>}</figcaption>
      <Handle type="source" position={Position.Right} className="alca" />
    </figure>
  )
})

const Grupo = memo(function Grupo({ data }: NodeProps<NoFogo>) {
  const { copiar } = useFogo()
  const g = data.grupo!
  return (
    <div className={`no pedido-ponto fogo-grupo-ponto ${g.video ? 'video' : g.imagens ? 'imagens' : 'html'}`}>
      <Handle type="target" position={Position.Left} className="alca" />
      <button type="button" className="ponto nodrag" title={g.codigo ? `${g.codigo} · ${g.titulo} (clique copia o código)` : g.titulo}
        onClick={(e) => { e.stopPropagation(); if (g.codigo) copiar(g.codigo) }}>
        {g.video ? <Clapperboard size={11} /> : g.imagens ? <ImageIcon size={11} /> : <Code2 size={11} />}
      </button>
      <Handle type="source" position={Position.Right} className="alca" />
    </div>
  )
})

const Video = memo(function Video({ data }: NodeProps<NoFogo>) {
  const { slug, abrir, mudar, registrar } = useFogo()
  const v = data.no!
  const estado = v.estado || 'neutra'
  return (
    <figure className={`fogo-cartao tipo-video es-${estado}`} onClick={() => v.arquivo && abrir(v.id)}>
      <Handle type="target" position={Position.Left} className="alca" />
      <Handle type="source" position={Position.Right} className="alca" />
      <div className="fogo-quadro">
        {v.gerando ? <div className="brilho" title="Gerando…" /> : v.erro ? <div className="falhou" title={v.erro}>erro</div> : (
          <video ref={(el) => registrar(v.id, el)} src={arquivoUrl(slug, v.arquivo)} poster={arquivoUrl(slug, v.thumb)} muted loop playsInline autoPlay preload="auto" />
        )}
        {estado === 'favorita' && <span className="marca fav"><Star size={11} fill="currentColor" /></span>}
        {estado === 'aprovada' && <span className="marca ok"><Check size={12} strokeWidth={3} /></span>}
        <div className="acoes nodrag" onClick={(e) => e.stopPropagation()}>
          {ESTADOS.map(({ e, t, I }) => (
            <button key={e} type="button" className={`ico ${estado === e ? `on ${e}` : ''}`} title={t}
              onClick={() => mudar(v.id, { estado: alternarEstado(estado, e) })}><I size={14} /></button>
          ))}
        </div>
      </div>
      <figcaption>
        <Clapperboard size={12} strokeWidth={1.6} className="cartao-tipo" /><Codigo id={v.id} /><span className="mudo nome">{v.nome || v.modelo}</span><span className="cresce" />
        <i>{v.duracao ? `${v.duracao}s · ` : ''}{v.custo != null ? dinheiro(v.custo) : ''}</i>
      </figcaption>
    </figure>
  )
})

/** Uma imagem tirada de um vídeo (ex.: a separação em estática e viva): abre no Viewer, com os estados. */
const Imagem = memo(function Imagem({ data }: NodeProps<NoFogo>) {
  const { slug, abrir, mudar } = useFogo()
  const n = data.no!
  const estado = n.estado || 'neutra'
  return (
    <figure className={`fogo-cartao tipo-imagem es-${estado}`} onClick={() => n.arquivo && abrir(n.id)} title={n.nome}>
      <Handle type="target" position={Position.Left} className="alca" />
      <Handle type="source" position={Position.Right} className="alca" />
      <div className="fogo-quadro">
        {n.gerando ? <div className="brilho" title="Gerando…" /> : n.erro ? <div className="falhou" title={n.erro}>erro</div> : (
          <img src={arquivoUrl(slug, n.thumb || n.arquivo)} alt={n.nome || n.id} draggable={false} />
        )}
        {estado === 'favorita' && <span className="marca fav"><Star size={11} fill="currentColor" /></span>}
        {estado === 'aprovada' && <span className="marca ok"><Check size={12} strokeWidth={3} /></span>}
        <div className="acoes nodrag" onClick={(e) => e.stopPropagation()}>
          {ESTADOS.map(({ e, t, I }) => (
            <button key={e} type="button" className={`ico ${estado === e ? `on ${e}` : ''}`} title={t}
              onClick={() => mudar(n.id, { estado: alternarEstado(estado, e) })}><I size={14} /></button>
          ))}
        </div>
      </div>
      <figcaption><ImageIcon size={12} strokeWidth={1.6} className="cartao-tipo" /><Codigo id={n.id} /><span className="mudo nome">{n.nome}</span></figcaption>
    </figure>
  )
})

/** Um modelo 3D tirado de uma imagem: a capa é um render; o clique abre o visualizador 3D. */
const Modelo = memo(function Modelo({ data }: NodeProps<NoFogo>) {
  const { slug, mudar } = useFogo()
  const n = data.no!
  const estado = n.estado || 'neutra'
  return (
    <figure className={`fogo-cartao tipo-modelo es-${estado}`} onClick={() => window.open(urlModelo(slug, n), '_blank', 'noreferrer')} title={`${n.nome} — abrir em 3D`}>
      <Handle type="target" position={Position.Left} className="alca" />
      <Handle type="source" position={Position.Right} className="alca" />
      <div className="fogo-quadro modelo-quadro">
        <img src={arquivoUrl(slug, n.thumb || '')} alt={n.nome || n.id} draggable={false} />
        {estado === 'aprovada' && <span className="marca ok"><Check size={12} strokeWidth={3} /></span>}
        <div className="acoes nodrag" onClick={(e) => e.stopPropagation()}>
          {ESTADOS.filter(({ e }) => e !== 'favorita').map(({ e, t, I }) => (
            <button key={e} type="button" className={`ico ${estado === e ? `on ${e}` : ''}`} title={t}
              onClick={() => mudar(n.id, { estado: alternarEstado(estado, e) })}><I size={14} /></button>
          ))}
        </div>
      </div>
      <figcaption><Box size={12} strokeWidth={1.6} className="cartao-tipo" /><Codigo id={n.id} /><span className="mudo nome">{n.nome}</span><span className="cresce" /><i>{n.custo != null ? dinheiro(n.custo) : ''}</i></figcaption>
    </figure>
  )
})

const PARADO_MS = 15 * 60 * 1000  // sem atualizar o impl.json por mais que isso, "trabalhando" vira "parado?" (docs/AGENTES.md)

/** O relógio de quem mostra tempo relativo: re-renderiza a cada 30 s. */
function useAgora() {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30000); return () => clearInterval(t) }, [])
  return agora
}
const haQuanto = (iso: string | undefined, agora: number) => {
  if (!iso) return ''
  const min = Math.max(0, Math.round((agora - Date.parse(iso)) / 60000))
  return min < 1 ? 'agora' : min < 60 ? `há ${min} min` : `há ${Math.round(min / 60)} h`
}

const Site = memo(function Site({ data }: NodeProps<NoFogo>) {
  const { slug, img, aprovarSite } = useFogo()
  const agora = useAgora()
  const v = data.versao!
  const t = data.trabalho
  const url = `/projects/${slug}/impl/${img.id}/${v}/index.html`
  const pronto = !t || t.status === 'pronto'
  const parado = t?.status === 'trabalhando' && !!t.atualizado && agora - Date.parse(t.atualizado) > PARADO_MS
  const estado = t?.estado || 'neutra'
  const titulo = t ? `${t.agente} · ${t.status}${t.base ? ` · evolução da ${t.base}: ${t.pedido || ''}` : ''}${t.etapa && !pronto ? ` · ${t.etapa}` : ''}${t.nota ? ` · ${t.nota}` : ''}` : 'Abrir interativo em outra aba'
  return (
    // pronto: o HTML roda dentro do cartão (sem capturar o mouse, para o canvas navegar) e o clique abre interativo em outra aba;
    // em andamento: o agente (impl.json), a etapa e o progresso
    <figure className={`fogo-cartao tipo-site html es-${estado} ${pronto ? '' : `obra st-${t!.status}`} ${parado ? 'parado' : ''}`}
      onClick={() => pronto && window.open(url, '_blank', 'noreferrer')} title={titulo}>
      <Handle type="target" position={Position.Left} className="alca" />
      <Handle type="source" position={Position.Right} className="alca" />
      <div className="fogo-quadro">
        {pronto ? <iframe src={url} title={codigoSite(img.id, v)} loading="lazy" tabIndex={-1} /> : (
          <div className="obra-painel">
            <span className="agente-chip grande"><Bot size={14} strokeWidth={1.8} /> {t!.agente}</span>
            {t!.pedido && <p className="obra-pedido">“{t!.pedido}”</p>}
            <p className="obra-etapa">
              {t!.status === 'trabalhando' && !parado && <LoaderCircle size={13} className="gira" />}
              {t!.status === 'erro' ? (t!.erro || 'erro') : t!.status === 'abandonado' ? (t!.nota || 'abandonado') : t!.etapa || 'trabalhando'}
            </p>
            {t!.status === 'trabalhando' && <div className="obra-barra"><i style={{ width: `${Math.round((t!.progresso || 0) * 100)}%` }} /></div>}
            <span className="obra-tempo">{parado ? `parado? última notícia ${haQuanto(t!.atualizado, agora)}` : t!.status === 'trabalhando' ? `${Math.round((t!.progresso || 0) * 100)}% · ${haQuanto(t!.atualizado, agora)}` : t!.status}</span>
          </div>
        )}
        {estado === 'aprovada' && <span className="marca ok"><Check size={12} strokeWidth={3} /></span>}
        {t && pronto && (
          // a aprovação da versão (vale sobretudo para as evoluções: v1.1 aprovada = a alteração foi aceita)
          <div className="acoes nodrag" onClick={(e) => e.stopPropagation()}>
            {ESTADOS.filter(({ e }) => e !== 'favorita').map(({ e, t: rotulo, I }) => (
              <button key={e} type="button" className={`ico ${estado === e ? `on ${e}` : ''}`} title={rotulo}
                onClick={() => aprovarSite(v, alternarEstado(estado, e))}><I size={14} /></button>
            ))}
          </div>
        )}
      </div>
      <figcaption>
        <Code2 size={12} strokeWidth={1.6} className="cartao-tipo" /><Codigo id={codigoSite(img.id, v)} />
        {t ? <span className="agente-chip" title={`Feito por ${t.agente}`}><Bot size={11} strokeWidth={1.8} /> {t.agente}</span> : <span className="mudo nome">HTML vivo</span>}
        <span className="cresce" />
        {pronto && <a href={url} target="_blank" rel="noreferrer" className="nodrag" title="Abrir em tela cheia (interativo)" onClick={(e) => e.stopPropagation()}><ExternalLink size={14} /></a>}
      </figcaption>
    </figure>
  )
})

const tiposFogo = { origem: Origem, grupo: Grupo, video: Video, imagem: Imagem, modelo: Modelo, site: Site }
