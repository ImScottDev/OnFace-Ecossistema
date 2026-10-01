#!/usr/bin/env bash
# Abre uma sessão autenticada no dev LOCAL e grava o cookie em /tmp/onface-cookie.txt.
# Uso: scripts/dev-sessao.sh && curl -s -b /tmp/onface-cookie.txt http://localhost:3000/pipeline
# Só para localhost — usa o usuário de dev do banco local.
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
JAR=/tmp/onface-cookie.txt
rm -f "$JAR"
CSRF=$(curl -s -c "$JAR" "$BASE/api/auth/csrf" | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')
curl -s -b "$JAR" -c "$JAR" -o /dev/null -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "email=dev.local@callface.ai" \
  --data-urlencode "password=devlocal2026" --data-urlencode "json=true"
code=$(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE/pipeline")
echo "sessão: GET /pipeline -> $code ($JAR)"
