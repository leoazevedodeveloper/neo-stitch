export type Estado = 'neutra' | 'favorita' | 'aprovada' | 'descartada'
export type Status = 'rascunho' | 'enviado' | 'trabalhando' | 'concluido' | 'erro' | 'proposto'
export type Pos = { x: number; y: number }

export type Pin = Pos & { t?: number }  // t: segundo do vídeo (comentário num vídeo)
export type Comentario = { id: string; autor: 'voce' | 'claude'; texto: string; pin: Pin | null; criado: string }
export type Direcao = { nome: string; tese: string; ativa: boolean }
export type Variacao = { nome: string; prompt?: string; tese?: string }

export type No = {
  id: string
  tipo: 'brief' | 'tela' | 'pedido' | 'imagem' | 'referencia' | 'video'
  criado: string
  atualizado?: string
  pos: Pos | null
  recolhido?: boolean
  escondidos?: string[]
  desloc?: Pos | null
  comentarios: Comentario[]
  titulo?: string
  pai?: string
  tela?: string | null
  // brief
  status?: Status
  direcoes?: Direcao[]
  // pedido
  entradas?: string[]
  intencao?: string
  literal?: boolean
  quantidade?: number
  modelo?: string
  aspecto?: string
  resolucao?: string
  saidas?: string[]
  variacoes?: Variacao[]
  custo?: number
  erro?: string
  legado?: boolean
  midia?: 'imagem' | 'video'
  modelos?: string[]
  duracao?: number
  segundos?: number
  // imagem / referência
  pedido?: string
  nome?: string
  prompt?: string
  estado?: Estado
  arquivo?: string
  thumb?: string
  largura?: number
  altura?: number
  gerando?: boolean
}

export type Projeto = {
  slug: string
  nome: string
  prefixo: string
  tipo: 'site' | 'app' | 'dashboard' | 'webapp'
  padroes: { modelo: string; aspecto: string; resolucao: string; quantidade: number }
  tetos: { imagens_por_pedido: number; diario_usd: number }
  layout?: 'pilha' | 'grade' | 'grade3' | 'grade4' | 'grade5'
}

export type EstadoProjeto = {
  rev: string
  igual?: boolean
  projeto: Projeto
  nos: No[]
  custos: { total: number; hoje: number }
  brief: string
  diario: string
  modelos: Record<string, { nome: string; preco: number }>
  modelos_video: Record<string, ModeloVideo>
  aspectos: string[]
  ouvinte: boolean
  avancos: Record<string, Avanco>
}

/** Imagem que avançou (o "fogo"): os vídeos que saíram dela e as tentativas de HTML em impl/<código>/vN/. */
export type Avanco = { videos: string[]; impl: string[] }
export type Fogo = { id: string; thumb: string; nome: string; videos: number; impl: number }

export type ModeloVideo = { nome: string; duracoes: number[]; resolucoes: string[]; custo_6s: number; preco_s: number; primeiro_ultimo: boolean; tempo_teste_s?: number; nota?: string; ranking?: string; teste?: string }

export type ResumoProjeto = {
  slug: string
  nome: string
  prefixo: string
  tipo: Projeto['tipo']
  capa: string | null
  imagens: number
  custos: { total: number; hoje: number }
  atualizado: string
  fogos: Fogo[]
}

async function req<T>(metodo: string, url: string, corpo?: unknown, cabecalhos?: Record<string, string>): Promise<T> {
  const binario = corpo instanceof Blob
  const r = await fetch(url, {
    method: metodo,
    headers: binario ? cabecalhos : corpo !== undefined ? { 'Content-Type': 'application/json', ...cabecalhos } : cabecalhos,
    body: binario ? corpo : corpo !== undefined ? JSON.stringify(corpo) : undefined,
  })
  const dados = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(dados.erro || `HTTP ${r.status}`)
  return dados as T
}

const P = (slug: string) => `/api/projetos/${slug}`

export const api = {
  projetos: () => req<ResumoProjeto[]>('GET', '/api/projetos'),
  criarProjeto: (d: { nome: string; tipo: string; descricao: string }) => req<ResumoProjeto>('POST', '/api/projetos', d),
  estado: (slug: string, rev?: string) => req<EstadoProjeto>('GET', `${P(slug)}${rev ? `?rev=${rev}` : ''}`),
  mudarProjeto: (slug: string, d: Partial<Projeto>) => req<Projeto>('PATCH', P(slug), d),
  brief: (slug: string, texto: string) => req('PUT', `${P(slug)}/brief`, { texto }),
  criarNo: (slug: string, d: Partial<No>) => req<No>('POST', `${P(slug)}/nos`, d),
  mudarNo: (slug: string, id: string, d: Partial<No>) => req<No>('PATCH', `${P(slug)}/nos/${id}`, d),
  apagarNo: (slug: string, id: string) => req('DELETE', `${P(slug)}/nos/${id}`),
  restaurarNo: (slug: string, id: string) => req<No>('POST', `${P(slug)}/nos/${id}/restaurar`),
  posicoes: (slug: string, d: Record<string, Pos>) => req('PUT', `${P(slug)}/posicoes`, d),
  enviar: (slug: string, id: string) => req<No>('POST', `${P(slug)}/nos/${id}/enviar`),
  comentar: (slug: string, id: string, texto: string, pin: Pin | null) =>
    req<Comentario>('POST', `${P(slug)}/nos/${id}/comentarios`, { texto, pin }),
  apagarComentario: (slug: string, id: string, cid: string) => req('DELETE', `${P(slug)}/nos/${id}/comentarios/${cid}`),
  subirRef: (slug: string, arquivo: File | Blob, nome: string, pos?: Pos, tela?: string) =>
    req<No>('POST', `${P(slug)}/refs`, arquivo, {
      'Content-Type': arquivo.type || 'image/png',
      'X-Nome': encodeURIComponent(nome),
      ...(pos ? { 'X-Pos': `${Math.round(pos.x)},${Math.round(pos.y)}` } : {}),
      ...(tela ? { 'X-Tela': tela } : {}),
    }),
}

export const arquivoUrl = (slug: string, caminho?: string) => (caminho ? `/projects/${slug}/${caminho}` : '')

/** Endereço da página de desenvolvimento de uma imagem com fogo. */
export const rotaFogo = (slug: string, id: string) => `#/p/${slug}/f/${id}`

export const dinheiro = (v: number) => `$${v.toFixed(2)}`
