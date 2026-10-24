import { AppWindow, ArrowUp, Flame, Globe, LayoutDashboard, Plus, Smartphone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, dinheiro, rotaFogo, type ResumoProjeto } from './api'

const TIPOS = [
  { v: 'site', r: 'Site', I: Globe },
  { v: 'webapp', r: 'Webapp', I: AppWindow },
  { v: 'dashboard', r: 'Dashboard', I: LayoutDashboard },
  { v: 'app', r: 'App', I: Smartphone },
] as const

export function Home() {
  const [lista, setLista] = useState<ResumoProjeto[] | null>(null)
  const [novo, setNovo] = useState(false)

  useEffect(() => {
    api.projetos().then(setLista).catch(() => setLista([]))
  }, [])

  const fogos = (lista || []).flatMap((p) => (p.fogos || []).map((f) => ({ ...f, slug: p.slug, projeto: p.nome })))

  return (
    <main className="home">
      <header className="home-topo">
        <img src="/favicon.svg" alt="" width={28} height={28} />
        <h1>Neo Stitch</h1>
      </header>
      {fogos.length > 0 && (
        <>
          <h2 className="home-secao fogo" title="Imagens que já ganharam vídeo ou HTML"><Flame size={15} /> Em desenvolvimento</h2>
          <section className="grade fogos">
            {fogos.map((f) => (
              <a key={`${f.slug}/${f.id}`} className="cartao" href={rotaFogo(f.slug, f.id)}>
                <div className="capa"><img src={f.thumb} alt="" /><span className="selo-fogo"><Flame size={12} /></span></div>
                <div className="cartao-info">
                  <span className="cartao-nome">{f.id}</span>
                  <span className="mudo">{f.projeto}</span>
                  <span className="cresce" />
                  <span className="mudo" title={`${f.videos} vídeo(s)${f.impl ? ` · ${f.impl} HTML` : ''}`}>▶ {f.videos}</span>
                </div>
              </a>
            ))}
          </section>
          <h2 className="home-secao">Projetos</h2>
        </>
      )}
      <section className="grade">
        <button type="button" className="cartao novo" onClick={() => setNovo(true)} title="Novo projeto">
          <Plus size={28} strokeWidth={1.5} />
        </button>
        {lista?.map((p) => {
          const Tipo = TIPOS.find((t) => t.v === p.tipo)?.I || AppWindow
          return (
            <a key={p.slug} className="cartao" href={`#/p/${p.slug}`}>
              <div className="capa">{p.capa ? <img src={p.capa} alt="" /> : <Tipo size={28} strokeWidth={1.3} />}</div>
              <div className="cartao-info">
                <span className="cartao-nome">{p.nome}</span>
                <span className="prefixo">{p.prefixo}</span>
                <span className="cresce" />
                <span className="mudo" title={`${p.imagens} imagens · ${dinheiro(p.custos.total)}`}>{p.imagens}</span>
              </div>
            </a>
          )
        })}
      </section>
      {novo && <NovoProjeto fechar={() => setNovo(false)} />}
    </main>
  )
}

function NovoProjeto({ fechar }: { fechar: () => void }) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<string>('webapp')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)

  const criar = async () => {
    if (!nome.trim()) return
    setIndo(true)
    try {
      const p = await api.criarProjeto({ nome: nome.trim(), tipo, descricao })
      location.hash = `#/p/${p.slug}`
    } catch (e) {
      setErro((e as Error).message)
      setIndo(false)
    }
  }

  return (
    <div className="modal-fundo" onClick={fechar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); criar() }}>
        <button type="button" className="ico fechar" title="Fechar" onClick={fechar}><X size={18} /></button>
        <input className="campo-nome" autoFocus placeholder="Nome do projeto" value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="tipos" role="radiogroup">
          {TIPOS.map(({ v, r, I }) => (
            <button key={v} type="button" role="radio" aria-checked={tipo === v} className={tipo === v ? 'on' : ''} onClick={() => setTipo(v)}>
              <I size={20} strokeWidth={1.6} />
              <span>{r}</span>
            </button>
          ))}
        </div>
        <textarea rows={6} placeholder="Descreva o projeto: para quem é, o que a tela precisa mostrar, o clima, referências…"
          value={descricao} onChange={(e) => setDescricao(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) criar() }} />
        {erro && <p className="erro-texto">{erro}</p>}
        <div className="modal-acoes">
          <span className="mudo">{descricao.trim() ? 'O Claude propõe direções de estilo ao criar' : ''}</span>
          <button type="submit" className="enviar" disabled={!nome.trim() || indo} title="Criar (⌘↵)"><ArrowUp size={18} /></button>
        </div>
      </form>
    </div>
  )
}
