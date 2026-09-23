# Runbook: publicar em dev.crm.callface.io

Preparado em 23/09. **Não executado**: o acesso SSH e a escrita em banco foram
negados pelo classifier de permissões no fim da sessão (as mesmas ações
funcionaram no início, quando o dump de produção foi puxado).

## Antes de começar, saiba disto

O domínio é **`dev.crm.callface.io`**, não `dev.callface.io`. As regras de
roteamento do Traefik estão em `_deploy-dev/docker-compose.yml`.

O ambiente dev roda **na mesma EC2 que produção** (34.204.200.52, 2 vCPU). O
cabeçalho do compose avisa, com todas as letras: *"Buildar: um servico por vez, a
EC2 tem 2 vCPU e produção roda na mesma maquina"*. Buildar imagem lá disputa CPU
com o CRM que está atendendo cliente. Vale rodar fora do horário comercial.

Isolamento já previsto no compose: prefixo `callface-crm2-dev-`, rede
`crm2dev-network` (NÃO a `database-network` de produção), volumes próprios,
wuzapi próprio com `WHATSAPP_ALLOWLIST` travado no número do Kauã.

## Passos

```bash
# 1. entrar na máquina
ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52

# 2. ver o que está de pé hoje, antes de mexer
sudo docker ps --format '{{.Names}}\t{{.Status}}' | grep crm2-dev

# 3. atualizar o código do ambiente dev
cd /opt/callface/crm2-dev   # confirme o caminho com `sudo docker inspect callface-crm2-dev-app | grep -i source`
git fetch --all
git checkout redesign/onface-ux-spec-v1
git pull

# 4. conferir ambiente e migrations ANTES de trocar container
docker compose -p crm2-dev run --rm --no-deps --entrypoint "" api \
  node --import tsx src/scripts/checar-env.ts --ambiente
docker compose -p crm2-dev run --rm --no-deps --entrypoint "" api \
  node --import tsx src/lib/db/migrar.ts --check

# 5. buildar UM SERVIÇO POR VEZ (a EC2 tem 2 vCPU e produção está do lado)
docker compose -p crm2-dev build app
docker compose -p crm2-dev build api
docker compose -p crm2-dev build worker

# 6. aplicar migrations e subir
docker compose -p crm2-dev run --rm --no-deps --entrypoint "" api \
  node --import tsx src/lib/db/migrar.ts
docker compose -p crm2-dev up -d

# 7. healthcheck
curl -s -o /dev/null -w '%{http_code}\n' https://dev.crm.callface.io/
```

## Carga de dados no dev remoto

O banco do dev remoto é outro container (`callface-crm2-dev-postgres`, exposto só
em `127.0.0.1:5433`). Para ele espelhar produção como o DEV local agora espelha,
repita a receita que já foi validada nesta sessão:

1. `scripts/ensaio-carga.sh` para provar num banco rascunho;
2. carga fase 1 → migrations até 0012 → carga fase 2 → resto das migrations;
3. `scripts/rodar-backfills.sh <URL_DO_DEV_REMOTO>` (já inclui o passo `06b`);
4. `scripts/rodar-smokes.sh` — o gate é 50/50.

### Armadilha conhecida do restore

`pg_dump`/`pg_restore` não recriam a text search configuration `pt_unaccent` na
ordem certa: ela chega depois da tabela `ai_knowledge_chunks`, que depende dela, e
a tabela falha com 8 erros ignorados. Depois de restaurar, reaplique o DDL de
`ai_knowledge_chunks` (migration `0029`) e a migration `0075`.

## O que continua pendente de decisão do Kauã

- **Carteira**: `reconciliar-billing-carteira.ts --aplicar`. São 60 serviços com
  `billing_status` parado no dia do Won — 22 ACTIVE com assinatura cancelada, 21
  unpaid, 8 past_due, cerca de R$ 16,5 mil de MRR. Rodar em DEV é seguro e
  reversível; em produção é decisão de receita.
- **457 empresas** sem entidade, com nome só em `leads.empresa`. A leitura já foi
  corrigida (576 → 109 cards "Empresa não informada"), mas criar as entidades a
  partir de texto de formulário poluiria a base, como já poluiu antes
  ("Autônomo", "Por conta própria" existem como empresa hoje).
- **`sdr_sem_retorno`** (46 leads) mapeado para `nutricao`, por ser estagnação e
  não descarte. A etapa `sem_resposta` do CRM2 não existe no canônico.
