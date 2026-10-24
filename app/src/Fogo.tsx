import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, Flame, LayoutGrid, Network, RotateCcw, Star, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { arquivoUrl, dinheiro, rotaFogo, type EstadoProjeto, type No } from './api'
import { ESTADOS, alternarEstado, estadoDaTecla } from './estados'
import { useProjeto } from './useProjeto'

const ORDEM: Record<string, number> = { aprovada: 0, favorita: 1, neutra: 2, descartada: 3 }

/** As imagens com fogo do projeto, na ordem do código. */
function fogosDe(estado: EstadoProjeto): No[] {
  const porId = new Map(estado.nos.map((n) => [n.id, n]))
  return Object.keys(estado.avancos || {}).map((id) => porId.get(id)).filter((n): n is No => !!n?.arquivo)
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
}

/** A barra da esquerda: as imagens que viraram algo maior. No canvas só aparece quando há alguma. */
export function TrilhoFogo({ slug, estado, ativo, pagina }: { slug: string; estado: EstadoProjeto; ativo?: string; pagina?: boolean }) {
  const fogos = fogosDe(estado)
  if (!pagina && !fogos.length) return null
  return (
    <nav className={`trilho ${pagina ? 'pagina' : ''}`} aria-label="Em desenvolvimento">
      {pagina && (
        <>
          <a href="#/" className="trilho-ico" title="Projetos"><img src="/favicon.svg" alt="" width={22} height={22} /></a>
          <a href={`#/p/${slug}`} className="trilho-ico" title={`Canvas de ${estado.projeto.nome}`}><Network size={17} /></a>
          <span className="trilho-sep" />
        </>
      )}
      <span className="trilho-fogo" title="Em desenvolvimento: imagens que já ganharam vídeo ou HTML"><Flame size={15} /></span>
      {fogos.map((n) => {
        const a = estado.avancos[n.id]
        return (
          <a key={n.id} href={rotaFogo(slug, n.id)} className={`trilho-item ${ativo === n.id ? 'on' : ''}`}
            title={`${n.id}${n.nome ? ` · ${n.nome}` : ''} — ${a.videos.length} vídeo(s)${a.impl.length ? ` · ${a.impl.length} HTML` : ''}`}>
            <img src={arquivoUrl(slug, n.thumb || n.arquivo)} alt="" />
            <span>{a.videos.length}</span>
          </a>
        )
      })}
    </nav>
  )
}

/** A página de uma imagem com fogo: a imagem e, por enquanto, os vídeos que saíram dela. */
export function PaginaFogo({ slug, id }: { slug: string; id: string }) {
  const { estado, erro, mudar } = useProjeto(slug)
  const [grande, setGrande] = useState(() => localStorage.getItem('neo:fogo-grande') === '1')
  const [esconder, setEsconder] = useState(false)
  const [foco, setFoco] = useState<string | null>(null)
  const videosRef = useRef(new Map<string, HTMLVideoElement>())

  const porId = useMemo(() => new Map((estado?.nos || []).map((n) => [n.id, n])), [estado])
  const img = porId.get(id)
  const av = estado?.avancos?.[id]

  // os vídeos agrupados pelo pedido de onde saíram (melhores primeiro dentro de cada um)
  const grupos = useMemo(() => {
    const m = new Map<string, No[]>()
    for (const v of av?.videos || []) {
      const n = porId.get(v)
      if (!n || (esconder && n.estado === 'descartada')) continue
      m.set(n.pedido || '', [...(m.get(n.pedido || '') || []), n])
    }
    return [...m].map(([p, vs]) => ({ pedido: porId.get(p), videos: vs.sort((a, b) => ORDEM[a.estado || 'neutra'] - ORDEM[b.estado || 'neutra']) }))
  }, [av, porId, esconder])
  const sequencia = useMemo(() => [id, ...grupos.flatMap((g) => g.videos.map((v) => v.id))], [id, grupos])

  const sincronizar = useCallback(() => {
    for (const v of videosRef.current.values()) { v.currentTime = 0; v.play().catch(() => {}) }
  }, [])
  const prontos = grupos.reduce((s, g) => s + g.videos.filter((v) => v.arquivo).length, 0)
  useEffect(() => {
    const t = setTimeout(sincronizar, 600)  // todos começam juntos depois de carregar
    return () => clearTimeout(t)
  }, [prontos, sincronizar])

  if (!estado) return <div className="carregando">{erro ? <p className="erro-tela">{erro}</p> : <span className="pulso grande" />}</div>
  if (!img || !av) {
    return (
      <div className="fogo-tela">
        <TrilhoFogo slug={slug} estado={estado} pagina />
        <main className="fogo-main"><p className="mudo">{id} ainda não tem vídeos nem HTML.</p></main>
      </div>
    )
  }
  const proporcao = img.largura && img.altura ? `${img.largura} / ${img.altura}` : '16 / 9'
  const total = (av.videos || []).reduce((s, v) => s + (porId.get(v)?.custo || 0), 0)

  const cartaoImagem = (
    <figure className="fogo-cartao origem" onClick={() => setFoco(img.id)}>
      <div className="fogo-quadro"><img src={arquivoUrl(slug, img.arquivo)} alt={img.nome || img.id} /></div>
      <figcaption><b>Imagem</b><span className="cresce" /><i>{img.id}</i></figcaption>
    </figure>
  )

  return (
    <div className="fogo-tela">
      <TrilhoFogo slug={slug} estado={estado} ativo={id} pagina />
      <main className="fogo-main" style={{ ['--min' as string]: grande ? '560px' : '340px', ['--proporcao' as string]: proporcao }}>
        <header className="fogo-topo">
          <Flame size={18} className="chama" />
          <span className="codigo">{img.id}</span>
          {img.nome && <h1>{img.nome}</h1>}
          <span className="mudo">{estado.projeto.nome}</span>
          <span className="cresce" />
          <span className="custo" title="Custo dos vídeos desta imagem">{dinheiro(total)}</span>
          <button type="button" className="ico" title="Recomeçar todos juntos" onClick={sincronizar}><RotateCcw size={16} /></button>
          <button type="button" className={`ico ${esconder ? 'on' : ''}`} title={esconder ? 'Mostrar descartados' : 'Esconder descartados'}
            onClick={() => setEsconder(!esconder)}>{esconder ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          <button type="button" className={`ico ${grande ? 'on' : ''}`} title="Cartões maiores"
            onClick={() => { setGrande(!grande); localStorage.setItem('neo:fogo-grande', grande ? '0' : '1') }}><LayoutGrid size={16} /></button>
        </header>

        {!grupos.length && <section className="fogo-grade">{cartaoImagem}</section>}

        {grupos.map(({ pedido, videos }, gi) => (
          <section key={pedido?.id || '-'} className="fogo-grupo">
            {grupos.length > 1 && pedido && <h2 title={pedido.intencao}><span className="codigo">{pedido.id}</span> {pedido.intencao}</h2>}
            <div className="fogo-grade">
              {gi === 0 && cartaoImagem}
              {videos.map((v) => (
                <CartaoVideo key={v.id} slug={slug} v={v} abrir={() => setFoco(v.id)} mudar={mudar}
                  registrar={(el) => { if (el) videosRef.current.set(v.id, el); else videosRef.current.delete(v.id) }} />
              ))}
            </div>
          </section>
        ))}
      </main>
      {foco && <Foco slug={slug} ids={sequencia} id={foco} porId={porId} ir={setFoco} mudar={mudar} />}
    </div>
  )
}

function CartaoVideo({ slug, v, abrir, mudar, registrar }: {
  slug: string; v: No; abrir: () => void; mudar: (id: string, c: Partial<No>) => void; registrar: (el: HTMLVideoElement | null) => void
}) {
  const estado = v.estado || 'neutra'
  return (
    <figure className={`fogo-cartao es-${estado}`} onClick={() => v.arquivo && abrir()}>
      <div className="fogo-quadro">
        {v.gerando ? <div className="brilho" title="Gerando…" /> : v.erro ? <div className="falhou" title={v.erro}>erro</div> : (
          <video ref={registrar} src={arquivoUrl(slug, v.arquivo)} poster={arquivoUrl(slug, v.thumb)} muted loop playsInline autoPlay preload="auto" />
        )}
        {estado === 'favorita' && <span className="marca fav"><Star size={11} fill="currentColor" /></span>}
        {estado === 'aprovada' && <span className="marca ok"><Check size={12} strokeWidth={3} /></span>}
        <div className="acoes" onClick={(e) => e.stopPropagation()}>
          {ESTADOS.map(({ e, t, I }) => (
            <button key={e} type="button" className={`ico ${estado === e ? `on ${e}` : ''}`} title={t}
              onClick={() => mudar(v.id, { estado: alternarEstado(estado, e) })}><I size={14} /></button>
          ))}
        </div>
      </div>
      <figcaption>
        <b>{v.nome || v.modelo}</b><span className="cresce" />
        <i>{v.duracao ? `${v.duracao}s · ` : ''}{v.custo != null ? dinheiro(v.custo) : ''}</i>
      </figcaption>
    </figure>
  )
}

/** Um item em destaque (a imagem ou um vídeo): ←/→ passam, F/A/D marcam, Esc ou clique fora fecha. */
function Foco({ slug, ids, id, porId, ir, mudar }: {
  slug: string; ids: string[]; id: string; porId: Map<string, No>; ir: (id: string | null) => void; mudar: (id: string, c: Partial<No>) => void
}) {
  const n = porId.get(id)!
  const i = ids.indexOf(id)
  const passo = useCallback((d: number) => ids.length && ir(ids[(i + d + ids.length) % ids.length]), [ids, i, ir])
  const estado = n.estado || 'neutra'
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ir(null)
      else if (e.key === 'ArrowRight') passo(1)
      else if (e.key === 'ArrowLeft') passo(-1)
      else if (n.tipo === 'video' && !e.metaKey && !e.ctrlKey) {
        const alvo = estadoDaTecla(e.key)
        if (alvo) mudar(n.id, { estado: alternarEstado(estado, alvo) })
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [ir, passo, n, estado, mudar])

  return (
    <div className="fogo-foco" onClick={() => ir(null)}>
      <button type="button" className="ico seta esq" title="Anterior (←)" onClick={(e) => { e.stopPropagation(); passo(-1) }}><ChevronLeft size={22} /></button>
      <figure onClick={(e) => e.stopPropagation()}>
        {n.tipo === 'video'
          ? <video key={n.id} src={arquivoUrl(slug, n.arquivo)} controls autoPlay muted loop playsInline />
          : <img src={arquivoUrl(slug, n.arquivo)} alt={n.nome || n.id} />}
        <figcaption>
          <span className="codigo">{n.id}</span>
          <b>{n.tipo === 'video' ? n.nome || n.modelo : 'Imagem'}</b>
          <span className="mudo">{i + 1}/{ids.length}</span>
          <span className="cresce" />
          {n.tipo === 'video' && ESTADOS.map(({ e, t, I }) => (
            <button key={e} type="button" className={`ico ${estado === e ? `on ${e}` : ''}`} title={t}
              onClick={() => mudar(n.id, { estado: alternarEstado(estado, e) })}><I size={16} /></button>
          ))}
          <button type="button" className="ico" title="Fechar (Esc)" onClick={() => ir(null)}><X size={18} /></button>
        </figcaption>
      </figure>
      <button type="button" className="ico seta dir" title="Próximo (→)" onClick={(e) => { e.stopPropagation(); passo(1) }}><ChevronRight size={22} /></button>
    </div>
  )
}
