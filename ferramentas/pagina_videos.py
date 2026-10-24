# /// script
# requires-python = ">=3.11"
# ///
"""Monta <pasta>/index.html: a comparação dos vídeos gerados pelo gerar_video.py (todos tocando juntos, sem som).

    uv run ferramentas/pagina_videos.py <pasta>      → abrir em http://localhost:8730/<pasta>/index.html
"""
import html
import json
import sys
from pathlib import Path

pasta = Path(sys.argv[1])
dados = json.loads((pasta / 'resultados.json').read_text(encoding='utf-8'))
res = dados['resultados']
ok = sorted([r for r in res if r['status'] == 'completed' and (pasta / r['arquivo']).exists()], key=lambda r: r['modelo'])  # os apagados (lixeira) saem
falhas = [r for r in res if r['status'] != 'completed']
total = sum(r.get('custo') or 0 for r in ok)

def cartao(r):
    fornecedor, nome = r['modelo'].split('/', 1)
    custo = f"${r['custo']:.2f}" if r.get('custo') is not None else '—'
    return f'''  <figure class="cartao" data-modelo="{html.escape(r['modelo'])}">
    <video src="{html.escape(r['arquivo'])}" poster="{html.escape(r.get('capa', ''))}" muted loop playsinline preload="auto"></video>
    <figcaption><b>{html.escape(nome)}</b><span>{html.escape(fornecedor)}</span><i>{r.get('duracao')}s · {r.get('resolucao')} · {custo} · {r['segundos']:.0f}s</i></figcaption>
  </figure>'''

linhas_falha = '\n'.join(f'<li><b>{html.escape(r["modelo"])}</b> — {html.escape((r.get("erro") or r["status"])[:180])}</li>' for r in falhas)
pagina = f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vídeos · {html.escape(pasta.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono&display=swap" rel="stylesheet">
<style>
  :root {{ --fundo: #f2f3f5; --sup: #fff; --tinta: #111318; --t2: #565c68; --t3: #9aa0ab; --linha: #e4e6eb; --acento: #3d5afe; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--fundo); color: var(--tinta); font: 14px 'Geist', system-ui, sans-serif; }}
  header {{ position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 12px; padding: 14px 24px; background: rgba(242,243,245,.9); backdrop-filter: blur(8px); border-bottom: 1px solid var(--linha); }}
  h1 {{ margin: 0; font-size: 16px; font-weight: 600; }}
  .meta {{ color: var(--t3); font-family: 'Geist Mono', monospace; font-size: 12px; }}
  .cresce {{ flex: 1; }}
  button {{ font: inherit; border: 1px solid var(--linha); background: var(--sup); border-radius: 10px; height: 34px; padding: 0 12px; cursor: pointer; }}
  button.on {{ background: var(--tinta); color: #fff; border-color: var(--tinta); }}
  main {{ padding: 20px 24px 60px; }}
  details {{ margin-bottom: 16px; color: var(--t2); }}
  details p {{ white-space: pre-wrap; font-size: 12.5px; line-height: 1.6; max-width: 900px; }}
  .grade {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--min, 380px), 1fr)); gap: 16px; }}
  .cartao {{ margin: 0; background: var(--sup); border: 1px solid var(--linha); border-radius: 14px; overflow: hidden; }}
  .cartao video, .cartao img {{ display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #ddd; cursor: zoom-in; }}
  figcaption {{ display: flex; align-items: baseline; gap: 8px; padding: 10px 12px; }}
  figcaption span {{ color: var(--t3); font-size: 12px; }}
  figcaption i {{ margin-left: auto; font-style: normal; font-family: 'Geist Mono', monospace; font-size: 11.5px; color: var(--t2); }}
  .ref figcaption b::after {{ content: ' · quadro inicial'; color: var(--t3); font-weight: 400; }}
  .falhas {{ margin-top: 28px; color: var(--t2); font-size: 13px; }}
  .zoom {{ position: fixed; inset: 0; z-index: 9; display: none; place-items: center; background: rgba(242,243,245,.85); backdrop-filter: blur(6px); }}
  .zoom.on {{ display: grid; }}
  .zoom video {{ max-width: 92vw; max-height: 86vh; border-radius: 12px; box-shadow: 0 18px 60px rgba(0,0,0,.2); }}
  .zoom p {{ margin: 10px 0 0; text-align: center; font-weight: 500; }}
</style>
</head>
<body>
<header>
  <h1>{html.escape(pasta.name)}</h1>
  <span class="meta">{len(ok)} vídeos · {len(falhas)} falhas · custo ${total:.2f}</span>
  <span class="cresce"></span>
  <button id="sync" title="Recomeça todos ao mesmo tempo">⟲ Sincronizar</button>
  <button id="tam" title="Tamanho dos cartões">▦ Maior</button>
</header>
<main>
  <details><summary>Prompt (direção)</summary><p>{html.escape(dados['prompt'])}</p></details>
  <section class="grade">
  <figure class="cartao ref"><img src="quadro-inicial.jpg" alt=""><figcaption><b>imagem</b><i>{html.escape(Path(dados.get('imagem', '')).name)}</i></figcaption></figure>
{chr(10).join(cartao(r) for r in ok)}
  </section>
  {f'<div class="falhas"><b>Não geraram</b><ul>{linhas_falha}</ul></div>' if falhas else ''}
</main>
<div class="zoom" id="zoom"><div><video id="zv" controls muted loop playsinline></video><p id="zt"></p></div></div>
<script>
  const vs = [...document.querySelectorAll('.cartao video')];
  const sync = () => vs.forEach(v => {{ v.currentTime = 0; v.play().catch(() => {{}}); }});
  Promise.all(vs.map(v => new Promise(r => v.readyState > 2 ? r() : v.addEventListener('canplay', r, {{ once: true }})))).then(sync);
  document.getElementById('sync').onclick = sync;
  const tam = document.getElementById('tam'); let grande = false;
  tam.onclick = () => {{ grande = !grande; document.documentElement.style.setProperty('--min', grande ? '640px' : '380px'); tam.classList.toggle('on', grande); }};
  const zoom = document.getElementById('zoom'), zv = document.getElementById('zv');
  vs.forEach(v => v.onclick = () => {{ zv.src = v.src; zv.currentTime = 0; zv.play(); document.getElementById('zt').textContent = v.closest('figure').dataset.modelo; zoom.classList.add('on'); }});
  zoom.onclick = e => {{ if (e.target === zoom) {{ zoom.classList.remove('on'); zv.pause(); }} }};
  document.onkeydown = e => {{ if (e.key === 'Escape') {{ zoom.classList.remove('on'); zv.pause(); }} }};
</script>
</body>
</html>
'''
(pasta / 'index.html').write_text(pagina, encoding='utf-8')
print(pasta / 'index.html')
