# Contrato dos nós (projects/<slug>/nodes/<CÓDIGO>.json)

Todo nó tem: `id` (código `PRE-NNN`, dado uma vez e nunca reaproveitado), `tipo`, `criado`, `atualizado`,
`pos` ({x, y} ou `null` = o app posiciona perto da origem e grava), `comentarios` ([{id, autor: voce|claude, texto,
pin: {x, y} de 0 a 1 ou null, criado}]). `legado: true` = importado (não conta no custo do dia).

| tipo | campos próprios |
|------|-----------------|
| `brief` | `titulo`, `status` (rascunho → enviado → trabalhando → proposto), `direcoes` [{nome, tese, ativa}] — o texto longo é `brief.md` |
| `tela` | `titulo`, `pai` (o brief) |
| `pedido` | `tela`, `entradas` [códigos de imagens/referências], `intencao`, `literal`, `quantidade`, `modelo`, `aspecto`, `resolucao`, `status` (rascunho · enviado · trabalhando · concluido · erro), `variacoes` [{nome, tese?, prompt?}], `saidas` [códigos], `custo`, `erro`, `enviado_em`, `iniciado_em`, `concluido_em`, `midia` (imagem · video); se vídeo: `modelos` [ids], `duracao` (s) |
| `imagem` | `pedido`, `nome`, `prompt` (o que gerou), `modelo`, `aspecto`, `resolucao`, `estado` (neutra · favorita · aprovada · descartada), `arquivo` (images/…png), `thumb` (thumbs/…jpg), `largura`, `altura`, `custo`, `segundos`, `gerando` (placeholder), `erro` |
| `video` | `pedido`, `nome`, `prompt`, `modelo`, `duracao`, `resolucao`, `estado`, `arquivo` (videos/…mp4), `thumb` (capa jpg), `largura`, `altura`, `custo`, `segundos`, `gerando`, `erro`. Pai = o pedido; comentários podem ter `pin.t` (segundo do vídeo) |
| `referencia` | `titulo`, `tela`, `arquivo` (refs/…), `thumb`, `largura`, `altura`, `origem` |

**Reservado para a v2: `implementacao`.** `imagem` (a ✅ de origem), `abordagem` ("img-to-html puro", "fundo em shader"…),
`fase` (fidelidade · vida), `versoes` [{n, pasta: impl/<código>/vN/, criado, nota}], `sessao` (link da sessão do Claude Code),
`status`. Ainda não é criado nem desenhado pelo app.

## Quem escreve o quê

- **App (PATCH):** só `pos`, `titulo`, `estado`, `direcoes` (ligar/desligar), e — enquanto o pedido é rascunho — `intencao`, `literal`,
  `quantidade`, `modelo`, `aspecto`, `resolucao`, `entradas`, `variacoes`, `midia`, `modelos`, `duracao`. Comentários do usuário via rota própria.
- **Claude (neo.py / gerar.py / gerar_video.py):** `status`, `direcoes`, `variacoes` com prompts, imagens, custos, erros, comentários `claude`.

Toda escrita passa pela trava do projeto (`base.travado`) e por `gravar_json` (temp + rename). Apagar um nó (pelo app,
com confirmação) leva o galho inteiro dele (`base.galho`) num lote para `projects/<slug>/lixeira/<id>-<ts>/`; `POST
…/nos/<id>/restaurar` traz o lote de volta. Nada sai do disco. Descartar (estado) é só uma marcação.

## Linhagem (a árvore que o app desenha)

O canvas é uma **árvore de ideias** arranjada automaticamente (esquerda → direita, irmãos empilhados, pai centrado):
brief → telas → pedidos → imagens → pedidos → imagens…
- O pai de um pedido é a **imagem de onde ele saiu** (1ª entrada que é imagem); sem imagem, a 1ª referência (que pende da
  tela); sem entradas, a tela. Entradas extras viram arestas tracejadas (recombinação).
- `recolhido: true` em qualquer nó fecha o galho dele; `escondidos: [ids]` esconde só esses filhos (o ⌘A "ir para as aprovadas" usa isso). O app mostra "+N" na pílula.
- `desloc: {x, y}` = ajuste manual do usuário sobre a posição automática; vale para o nó e todo o galho dele (arrastar um
  nó leva os filhos junto). `null` volta ao lugar automático. Referências soltas (fora da árvore) usam `pos` absoluta;
  o `pos` dos nós da árvore é ignorado.
