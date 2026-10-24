# Neo Stitch

Canvas local para explorar interfaces gerando imagens de alto impacto (árvore de pedidos → imagens) e, na v2, transformá-las
em HTML vivo. Decisões e escopo: [specs.md](specs.md). Como operar o canvas (fila, prompts, geração): skill `neo-stitch`
(`.claude/skills/neo-stitch/SKILL.md`). Leia a skill antes de mexer em qualquer pedido.

## Estrutura

- `ferramentas/` — Python só com biblioteca padrão, rodado com `uv run`:
  `servidor.py` (API + arquivos + app compilado, porta 8730) · `neo.py` (o lado do Claude: fila, contexto, direções, estados, diário) ·
  `gerar.py` (OpenRouter /images, N em paralelo, várias referências) · `gerar_video.py` (OpenRouter /videos, um vídeo por
  modelo) · `openrouter.py` (cliente HTTP e a chave) · `pagina_videos.py` (página de comparação avulsa) · `ouvir.sh` (o Monitor
  da fila) · `importar_jarvis.py` (import do 20-jarvisOS) · `base.py` (caminhos, trava, nós, códigos, custos, avanços/fogo).
- `app/` — Vite + React + React Flow (`@xyflow/react`). Dev: `npm run dev` (porta 5173, repassa /api e /projects para 8730).
  Produção: `npm run build` → `app/dist`, servido pelo `servidor.py`.
- `projects/<slug>/` — os dados (um JSON por nó, imagens, vídeos, thumbs, refs, impl/, brief.md, diario.md, lixeira/). Não versionar.
- `docs/` — o que o README mostra (demo, evolução imagem → vídeo → HTML) e o guia de uso (`docs/USO.md`).
- `fila.jsonl` — fila append-only que o app escreve e o Claude ouve (`tail -F`).

## Regras

- Nunca apague imagens nem nós com linhagem: descarte (estado) ou mova para `lixeira/`.
- Toda escrita em nó passa por `base.travado(slug)` + `gravar_json` (o app e os scripts escrevem ao mesmo tempo).
- O app é tema claro e minimalista: ícones com `title`, sem texto onde um componente se explica.
- A chave `OPENROUTER_API_KEY` vem de `~/.env` (ou `.env` aqui) — nunca imprima nem commite.
