# 11–14 — O QUE ESTÁ PRONTO / PARCIAL / NÃO EXISTE / A REMOVER

Critério de "pronto" = Definição objetiva de PRONTO do entregável 22 (runtime + backend em produção + jornada gera dado + sem regressão), não "compila".

## 11 — O QUE ESTÁ REALMENTE PRONTO (RUNTIME/HISTÓRICO provado)
- **Núcleo comercial (aquisição→pré-vendas→pipeline→proposta→won)** via server actions do bloco vendas — funciona sem depender do proxy morto; dado histórico robusto.
- **Integração Meta** — ciclo completo (pacote + adapter + outbox + dado; 54 leads hoje).
- **Faturamento Stripe** — webhooks processando até 22/09 (com 1 falha pontual).
- **Outbox transacional + sweep 60s + consumidores + dead-letter** — espinha dorsal do sistema.
- **Telefonia Callface e WhatsApp** — recebendo dado até 22/09 (WhatsApp com perda de histórico).
- **Configurações (14 telas)** — migradas 1:1 (em código; API depende do proxy).
- **Financeiro (7 abas)** — backend Next vivo (só falta religar à navegação).
- Ressalva: "pronto" aqui é para a geração em produção; no ambiente do redesign muitas dessas telas não operam por causa do proxy.

## 12 — O QUE ESTÁ PARCIAL
- **Cliente 360 / CS / Onboarding / Implantação / Atendimento / Automações**: código do CRM 2.0 completo, mas (a) API morta no runtime local, (b) backend não implantado em produção, (c) dado zerado/perdido localmente. Gargalo = infra + dado, não UI.
- **Camada canônica** (pessoas/aquisicoes/oportunidades/servicos_canonicos): completa e em paridade, mas escrita primária ainda no legado (dual-write; virada não executada).
- **RBAC**: populado, cobre ~10/68 rotas.
- **Relatórios**: 7 abas, –1 (fechamento comercial), +1 (pós-venda); API morta.
- **Pipeline de IA**: gateway multi-provider real, mas 0 execuções.
- **Storage**: acervo canônico é o caminho das rotas, mas backend disco local (S3 não existe).

## 13 — O QUE NÃO EXISTE / NÃO FOI COMPROVADO
- **Plataforma de IA operando** (29/31 tabelas ai_* vazias, 0 runs, agentes em draft).
- **AI SDR ligado** (config vazia, sweeps rodam vazios).
- **Callface AI** (todas as tabelas vazias, sync roda vazio).
- **Documenso / assinatura em runtime** (signature_* NULL em 745).
- **Assinatura eletrônica de ponta a ponta** (ZohoSign perdido, Documenso não comprovado).
- **30 de 39 packages** (stubs); **`apps/*`** (não existe); **adaptador S3/R2**; **script arq:fronteiras**.
- **Sequências de e-mail, NPS, checkouts** (0 dado).
- **Carteira, contratos lista/detalhe, impersonação** (removidos/placeholder).
- **Telemetria de login/uso** (sem coluna, sem tabela).
- **Observabilidade de integração** (integracao_sync_estado vazia).

## 14 — O QUE PROVAVELMENTE DEVE SER REMOVIDO / ARQUIVADO
Remoção candidata (registrar, não executar — decisão fora da auditoria):
- **30 packages stub** + `apps/*` fantasma + `arq:fronteiras` quebrado.
- **Filas placebo** `conversion-sync` e `follow-up` (corpo = console.log).
- **Tabelas/legado morto**: `vendas_eventos`, `eventos`, `eventos_comerciais` (órfão), `aquisicoes` [se dual-write for desligado a favor de leads OU vice-versa — DECISÃO PO].
- **Cascas de UI extras**: `(onface-preview)`, `onface-desenho`, `/estudio` (design labs), grupo `(crm)` (redirects) após migrar as 5 telas /pos-venda.
- **Componentes de 2 gerações antigas**: `components/crm/` (após remover os 2 imports remanescentes em (crm2)), consolidar crm2/onface.
- **Rotas Next mortas em prod** (fora da allowlist), `/api/meta/resolve`, montagens duplicadas de rotas Hono.
- **29 tabelas ai_* + rotas CRUD** [DECISÃO PO: manter para roadmap ou remover].
- **Branches históricas** (main, homolog, dev, consolidado, posvenda-canonico): tag + arquivar.
- Higiene: `tsconfig.tsbuildinfo` versionado, lockfiles redundantes, senha dev em claro, pin de wuzapi.

**Antes de remover qualquer coisa com dado** (aquisicoes, eventos_comerciais): confirmar na captura remota que produção não depende. Regra da auditoria: nada é removido nesta fase.
