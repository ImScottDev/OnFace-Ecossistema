#!/usr/bin/env bash
# Smoke autenticado no dev LOCAL: status HTTP + sinais de tela quebrada no HTML do SSR.
# Uso: scripts/dev-smoke.sh /pipeline /clientes ...   (abre sessão se não houver)
BASE="${BASE:-http://localhost:3000}"; JAR=/tmp/onface-cookie.txt
[ -s "$JAR" ] || "$(dirname "$0")/dev-sessao.sh" >/dev/null
for r in "$@"; do
  out=$(curl -s -b "$JAR" -w "\n%{http_code} %{time_total}" "$BASE$r")
  st=$(echo "$out" | tail -1); html=$(echo "$out" | sed '$d')
  flags=""
  echo "$html" | grep -q "Não foi possível carregar esta tela" && flags="$flags ERROR-BOUNDARY"
  echo "$html" | grep -q "NEXT_NOT_FOUND\|This page could not be found" && flags="$flags 404"
  echo "$html" | grep -qi "__next_error__" && flags="$flags NEXT-ERROR"
  echo "$html" | grep -q 'href="/login"' && [ "$r" != "/login" ] && echo "$html" | grep -q "Entrar" && flags="$flags SEM-SESSAO"
  printf "%-44s %s%s\n" "$r" "$st" "$flags"
done
