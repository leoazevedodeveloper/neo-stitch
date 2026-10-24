"""Cliente mínimo do OpenRouter (só biblioteca padrão), usado pelo gerar.py (imagens) e pelo gerar_video.py (vídeos).

A chave OPENROUTER_API_KEY vem do ambiente, de .env na raiz ou de ~/.env — nunca é impressa.
"""
from __future__ import annotations

import base64
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = 'https://openrouter.ai/api/v1'
RAIZ = Path(__file__).resolve().parent.parent


def chave() -> str:
    if os.environ.get('OPENROUTER_API_KEY'):
        return os.environ['OPENROUTER_API_KEY']
    for env in (RAIZ / '.env', Path.home() / '.env'):
        if env.exists():
            for linha in env.read_text(encoding='utf-8').splitlines():
                if linha.strip().startswith('OPENROUTER_API_KEY='):
                    return linha.split('=', 1)[1].strip().strip('"').strip("'")
    sys.exit('ERRO: defina OPENROUTER_API_KEY (no ambiente, em .env ou ~/.env).')


def data_url(arq: Path) -> str:
    mime = mimetypes.guess_type(arq.name)[0] or 'image/png'
    return f'data:{mime};base64,{base64.b64encode(arq.read_bytes()).decode()}'


def pedir(metodo: str, caminho: str, key: str, corpo: dict | None = None, bruto: bool = False, timeout: int = 300):
    """Chama {API}{caminho}; devolve o JSON (ou os bytes, com bruto=True). Erro HTTP vira RuntimeError com o corpo."""
    req = urllib.request.Request(f'{API}{caminho}', method=metodo, data=json.dumps(corpo).encode() if corpo is not None else None,
                                 headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json',
                                          'HTTP-Referer': 'https://github.com/rtadewald/neo-stitch', 'X-Title': 'Neo Stitch'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            dados = r.read()
            return dados if bruto else json.loads(dados)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'OpenRouter HTTP {e.code}: {e.read().decode(errors="replace")[:600]}') from None
