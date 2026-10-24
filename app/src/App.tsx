import { useEffect, useState } from 'react'
import { Canvas } from './Canvas'
import { PaginaFogo } from './Fogo'
import { Home } from './Home'

/** #/p/<slug> é o canvas; #/p/<slug>/f/<código> é a página de uma imagem com fogo. */
function rota() {
  const m = location.hash.match(/^#\/p\/([a-z0-9-]+)(?:\/f\/([A-Z]+-\d+))?/)
  return m ? { slug: m[1], fogo: m[2] || null } : null
}

export default function App() {
  const [r, setR] = useState(rota)
  const slug = r?.slug
  useEffect(() => {
    const mudou = () => setR(rota())
    window.addEventListener('hashchange', mudou)
    return () => window.removeEventListener('hashchange', mudou)
  }, [])
  useEffect(() => {
    document.title = r?.fogo ? `${r.fogo} · Neo Stitch` : slug ? `${slug} · Neo Stitch` : 'Neo Stitch'
  }, [slug, r?.fogo])
  if (r?.fogo) return <PaginaFogo key={`${r.slug}/${r.fogo}`} slug={r.slug} id={r.fogo} />
  return slug ? <Canvas key={slug} slug={slug} /> : <Home />
}
