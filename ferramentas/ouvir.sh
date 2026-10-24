#!/bin/bash
# O Claude observa a fila do canvas (Monitor). Cada linha nova da fila.jsonl vira uma notificação para ele.
# Enquanto roda, toca .ouvinte a cada 20 s: o app mostra "Claude ouvindo" (ponto verde no topo).
cd "$(dirname "$0")/.." || exit 1
touch fila.jsonl
( while true; do touch .ouvinte; sleep 20; done ) &
BATIDA=$!
trap 'kill $BATIDA 2>/dev/null; rm -f .ouvinte' EXIT INT TERM
tail -n0 -F fila.jsonl
