#!/bin/bash
# Variáveis que faltam em PRODUÇÃO para o ONFACE funcionar.
#
# Rode NO SERVIDOR, antes de subir o ONFACE na pilha de produção:
#   ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52
#   bash VIRADA-PRODUCAO.sh
#
# O que ele faz: copia do container do DEV para o compose de PRODUÇÃO só as
# variáveis que produção ainda não tem. Nenhum valor é impresso.
#
# O que ele NÃO faz: não sobrescreve nada que produção já tem. As seis críticas
# (EMAIL_ENCRYPTION_KEY, CALLFACE_WEBHOOK_SECRET, CALLFACE_INBOUND_TOKEN,
# RESEND_FROM, RESEND_API_KEY, GROQ_API_KEY) JÁ ESTÃO em produção e são as
# certas — o ONFACE as herda ao rodar lá. Por isso não entram na lista.
#
# Faz backup do compose antes e valida no fim.
set -euo pipefail

COMPOSE=/opt/callface/crm/docker-compose.yml
sudo cp "$COMPOSE" "$COMPOSE.bak-virada-$(date +%Y%m%d-%H%M)"
echo "backup: $COMPOSE.bak-virada-*"

sudo python3 - <<'PY'
import re, json, subprocess

# ── O que falta em produção ───────────────────────────────────────────────
# Copiadas do DEV (onde já estão configuradas e testadas):
DO_DEV = [
    # Meta direto: é o que faz o lead do Facebook/Instagram cair no ONFACE
    # sem passar pelo n8n.
    "META_APP_ID", "META_APP_SECRET", "META_WEBHOOK_VERIFY_TOKEN",
    "META_LEADS_ACCESS_TOKEN", "META_PAGE_ID",
    # Meta CAPI: devolve a conversão (qualificado, proposta, ganho) para a Meta
    # otimizar a campanha.
    "META_CAPI_ACCESS_TOKEN", "META_PIXEL_ID", "META_ADS_ACCESS_TOKEN",
    # WhatsApp.
    "UAZAPI_API_KEY", "UAZAPI_WEBHOOK_URL", "WHATSAPP_ALLOWLIST",
    # IA: credenciais dos agentes e o NEXO.
    "AI_CREDENTIALS_ENCRYPTION_KEY", "OPENAI_API_KEY",
    # Assinatura de contrato.
    "DOCUMENSO_API_URL", "DOCUMENSO_API_TOKEN", "DOCUMENSO_WEBHOOK_SECRET",
    # Stripe em modo teste até você virar a chave.
    "STRIPE_CHECKOUT_MODE",
    # Tokens que o n8n manda no ?token= dos webhooks de lead. O código novo
    # exige a variável e recusa sem ela: sem estas, lead do RD morre na entrada.
    "RD_WEBHOOK_SECRET", "META_LEADIDS_WEBHOOK_SECRET",
]

# Valor literal só para o que não é segredo. Os tokens de webhook do RD e da
# Meta vêm do dev, como o resto: segredo não fica escrito em arquivo versionado.
LITERAIS = {
    # Os containers rodam em UTC e o navegador em São Paulo: toda tela que
    # conta "há N dias" diverge, e depois das 21h "hoje" vira "ontem".
    "TZ": "America/Sao_Paulo",
}

env_dev = {}
saida = subprocess.run(
    ["docker", "inspect", "callface-crm2-dev-app", "--format", "{{json .Config.Env}}"],
    capture_output=True, text=True,
).stdout
for item in json.loads(saida or "[]"):
    if "=" in item:
        k, v = item.split("=", 1)
        env_dev[k] = v

p = "/opt/callface/crm/docker-compose.yml"
s = open(p).read()

inseridas, ausentes, ja_tinha = [], [], []
for svc in ["app", "api", "worker"]:
    i = s.find(f"container_name: callface-crm-{svc}")
    j = s.find("environment:", i)
    if i < 0 or j < 0:
        print(f"  !! serviço {svc} sem bloco environment — revise à mão")
        continue
    fim = s.index("\n", j) + 1
    ind = re.match(r"[ ]*", s[fim:]).group(0)
    # Só o bloco deste serviço, para não casar com variável de outro.
    prox = s.find("container_name:", fim)
    bloco = s[j: prox if prox > 0 else len(s)]

    add = ""
    for k in DO_DEV:
        if f"{k}=" in bloco:
            if svc == "app": ja_tinha.append(k)
            continue
        if k not in env_dev:
            if svc == "app": ausentes.append(k)
            continue
        add += f"{ind}- {k}={env_dev[k]}\n"
        if svc == "app": inseridas.append(k)
    for k, v in LITERAIS.items():
        if f"{k}=" in bloco:
            if svc == "app": ja_tinha.append(k)
            continue
        add += f"{ind}- {k}={v}\n"
        if svc == "app": inseridas.append(k)
    s = s[:fim] + add + s[fim:]

open(p, "w").write(s)
print("INSERIDAS:", ", ".join(inseridas) or "(nenhuma)")
print("JÁ EXISTIAM:", ", ".join(ja_tinha) or "(nenhuma)")
print("NÃO ACHEI NO DEV:", ", ".join(ausentes) or "(nenhuma)")
PY

echo "--- validando o compose..."
cd /opt/callface/crm && sudo docker compose -p callface-crm config > /dev/null \
  && echo "OK: compose de produção válido" \
  || { echo "INVÁLIDO — restaure o backup acima"; exit 1; }

echo
echo "Confira antes de subir:"
echo "  sudo grep -cE 'META_APP_SECRET|RD_WEBHOOK_SECRET|TZ=' $COMPOSE   # espera 9 (3 por serviço)"
