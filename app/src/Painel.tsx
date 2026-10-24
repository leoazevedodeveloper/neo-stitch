import { marked } from 'marked'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { useCanvas } from './ctx'

/** Gaveta da direita: o brief (editável) e o diário de decisões (o Claude escreve). */
export function Painel({ aba, setAba }: { aba: 'brief' | 'diario'; setAba: (a: 'brief' | 'diario' | null) => void }) {
  const { estado, slug, acao } = useCanvas()
  const [texto, setTexto] = useState(estado.brief)
  const editando = useRef(false)

  useEffect(() => { if (!editando.current) setTexto(estado.brief) }, [estado.brief])

  const diario = useMemo(() => marked.parse(estado.diario.replace(/^# .*\n/, ''), { async: false }) as string, [estado.diario])

  return (
    <aside className="painel">
      <div className="painel-topo">
        <div className="abas">
          <button type="button" className={aba === 'brief' ? 'on' : ''} onClick={() => setAba('brief')}>Brief</button>
          <button type="button" className={aba === 'diario' ? 'on' : ''} onClick={() => setAba('diario')}>Diário</button>
        </div>
        <button type="button" className="ico" title="Fechar" onClick={() => setAba(null)}><X size={18} /></button>
      </div>
      {aba === 'brief' ? (
        <textarea className="brief-editor" value={texto} spellCheck={false}
          placeholder="Para quem é, o que a tela precisa mostrar, referências, o clima…"
          onFocus={() => { editando.current = true }}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => { editando.current = false; if (texto !== estado.brief) acao(() => api.brief(slug, texto)) }} />
      ) : estado.diario.replace(/^# .*\n/, '').trim() ? (
        <div className="markdown" dangerouslySetInnerHTML={{ __html: diario }} />
      ) : (
        <p className="vazio-painel">As decisões do projeto aparecem aqui.</p>
      )}
    </aside>
  )
}
