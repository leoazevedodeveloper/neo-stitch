import { Check, EyeOff, Star } from 'lucide-react'
import type { Estado } from './api'

/** As marcas de uma imagem ou vídeo (botões e atalhos F/A/D), na mesma ordem em todo o app. */
export const ESTADOS: { e: Estado; t: string; I: typeof Star }[] = [
  { e: 'favorita', t: 'Favorita (F)', I: Star },
  { e: 'aprovada', t: 'Aprovada (A)', I: Check },
  { e: 'descartada', t: 'Descartar (D)', I: EyeOff },
]

/** F/A/D → o estado (ou undefined para outras teclas). */
export const estadoDaTecla = (tecla: string): Estado | undefined =>
  ({ f: 'favorita', a: 'aprovada', d: 'descartada' } as const)[tecla.toLowerCase() as 'f' | 'a' | 'd']

/** Clicar no estado que já está marcado volta para neutra. */
export const alternarEstado = (atual: Estado | undefined, e: Estado): Estado => (atual === e ? 'neutra' : e)
