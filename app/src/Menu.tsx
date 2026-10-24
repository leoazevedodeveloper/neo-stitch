import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export type ItemMenu = { rotulo: string; icone: ReactNode; atalho?: string; acao: () => void; perigo?: boolean } | 'sep'

/** Menu de contexto (botão direito): abre onde o mouse está e fecha com clique fora, Esc ou rolagem. */
export function Menu({ x, y, itens, fechar }: { x: number; y: number; itens: ItemMenu[]; fechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  // não deixa o menu sair da janela
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setPos({ x: Math.min(x, window.innerWidth - r.width - 8), y: Math.min(y, window.innerHeight - r.height - 8) })
  }, [x, y])

  useEffect(() => {
    const fora = (e: Event) => { if (!ref.current?.contains(e.target as Node)) fechar() }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    window.addEventListener('pointerdown', fora, true)
    window.addEventListener('wheel', fechar, true)
    window.addEventListener('keydown', tecla)
    window.addEventListener('blur', fechar)
    return () => {
      window.removeEventListener('pointerdown', fora, true)
      window.removeEventListener('wheel', fechar, true)
      window.removeEventListener('keydown', tecla)
      window.removeEventListener('blur', fechar)
    }
  }, [fechar])

  return (
    <div ref={ref} className="menu" style={{ left: pos.x, top: pos.y }} role="menu" onContextMenu={(e) => e.preventDefault()}>
      {itens.map((it, i) => it === 'sep' ? <span key={i} className="menu-sep" /> : (
        <button key={i} type="button" role="menuitem" className={it.perigo ? 'perigo' : ''}
          onClick={() => { fechar(); it.acao() }}>
          <span className="menu-ico">{it.icone}</span>
          <span className="menu-rotulo">{it.rotulo}</span>
          {it.atalho && <kbd>{it.atalho}</kbd>}
        </button>
      ))}
    </div>
  )
}
