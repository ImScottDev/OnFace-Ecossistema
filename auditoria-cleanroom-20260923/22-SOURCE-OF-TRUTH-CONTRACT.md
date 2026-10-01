# 22 — SOURCE OF TRUTH CONTRACT (proposta)

Contrato objetivo de canonicidade. É uma PROPOSTA baseada na evidência; itens marcados [DECISÃO PO] precisam do product owner.

## Branch / repositório canônico
- **Canônico**: `redesign/onface-ux-spec-v1` (superset de código; contém toda a evolução).
- **Regra**: nenhuma outra branch recebe feature nova. `main`/`homolog`/`dev`/`consolidado`/`posvenda-canonico` são históricas → arquivar (tag) e parar de escrever.
- **Ação imediata**: push dos 47 commits locais para `onface` E `origin` (hoje dessincronizados) — o código canônico está em risco no disco.
- Remotos: unificar em um só [DECISÃO PO: qual, `onface` ou `origin`].

## ENQUADRAMENTO CORRIGIDO PELO PO (23/09) — é CUTOVER, não coexistência
O ONFACE é uma **nova arquitetura** que vai **SUBSTITUIR** a produção atual (não subir ao lado, não é só pele). O modelo canônico (pessoas, empresas, aquisicoes, oportunidades, clientes, cs_*) é o **desenho pretendido de destino**. Plano: migrar os dados de produção para o modelo novo e virar a chave (cutover). Implicações que corrigem a leitura da auditoria:
- **Dual model / dual-write NÃO é erro** — é a ponte de migração (legado→canônico), temporária por desenho (fases 25/26 "existe para morrer").
- **Camada canônica NÃO é overengineering órfão** — é o produto de destino. Produção não a ter é esperado (é o "de-onde").
- **A pergunta central passa a ser: o cutover está pronto?** A auditoria vira checklist de prontidão de cutover. Bloqueadores medidos: (1) o processo de migração polui a base (877 empresas de texto livre no ensaio local) e perde dado (ZohoSign 178, oportunidades 141); (2) ONFACE não roda ponta a ponta (proxy morto, backend não implantado); (3) métricas ambíguas (MRR 6 respostas).
- A parte da IA/motores/packages stub do Fitness Review CONTINUA válida como overengineering (é ortogonal ao cutover — infra que existe e não é usada).

## REGRA DO PO — produção intocável ATÉ o cutover
Enquanto o ONFACE não estiver pronto para substituir, produção segue intocável e é a fonte de verdade operacional. O cutover só acontece quando os bloqueadores acima estiverem resolvidos e a migração validada (sem perda, sem poluição).

## (Original) — produção é intocável
O que está em `crm.callface.io` rodando com o time HOJE **não se altera**. É a fonte de verdade operacional e não sofre migração destrutiva. Confirmado por runtime no servidor: produção roda o **schema legado** (não tem `_migracoes_aplicadas` — as 91 migrations canônicas nunca rodaram lá). Consequências:
- A "perda de dado" observada no banco LOCAL (cliente_receita_mensal, fulfillments, cs_*) é do experimento de carga canônica local — **NÃO é perda em produção**, porque produção nunca teve o schema canônico. P0-2 rebaixado (ver gap register).
- Toda finalização do ONFACE acontece no redesign/dev; a virada só substitui produção quando comprovadamente pronta (7 critérios abaixo), e sem tirar do time o que já usam.
- Nenhum reparo (backfill ZohoSign, dedup Stripe, etc.) toca o banco de produção sem decisão explícita do PO.

## Ambiente canônico
- **Produção real** = `crm.callface.io` (EC2), hoje rodando `prod-real-20260920`. **É a fonte de verdade de comportamento e dado até a virada.**
- **Dev remoto** = `dev.crm.callface.io` (mesma EC2, isolado).
- Regra: o redesign só vira canônico de produção após (a) proxy /api corrigido, (b) backend Hono implantado, (c) captura remota confirmar integridade de dado.

## Modelo / dados canônicos
- **Dado canônico** = banco de PRODUÇÃO. Bancos locais (`callface_crm`, `_ensaio`, `_pre_carga`) são recriações/ensaios — NÃO são verdade.
- **Modelo canônico** = camada `pessoas / aquisicoes / oportunidades / servicos_canonicos / contratos / faturas` + outbox (`domain_events`/`event_outbox`/`timeline_events`).
- **Legado a desligar** = `leads`/`negocios`/`contatos` como escrita primária; `vendas_eventos`/`eventos_comerciais`/`eventos` (mortos).
- **Métrica canônica** = `metric_catalog` — mas hoje MRR dá 6 respostas; a definição só vale depois de (a) desduplicar 101 subs Stripe, (b) atualizar portfólio congelado.

## Documentação canônica
- Nenhum doc histórico é canônico até reconciliado (ver Fase 7 / entregável 10). Enquanto isso, **esta auditoria (`auditoria-cleanroom-20260923/`) é o retrato canônico do AS-IS**.
- Regra: docs que declaram "concluído" refutados pelo baseline devem ser marcados como intenção, não estado.

## O que é legado (parar de evoluir)
Grupo `(crm)`, `components/crm/`, `lib/crm` como dono de regra, publicador best-effort, motores de automação vazios, cascas `(onface-preview)`/`onface-desenho`/`estudio`.

## O que arquivar / remover
Ver entregável 14. Núcleo: 30 packages stub, `apps/*` fantasma, filas placebo, 29 tabelas ai_* [DECISÃO PO se manter para roadmap], cascas de UI extras, branches históricas.

## Regra de promoção entre ambientes
`redesign` (local) → push remoto → dev.crm.callface.io (validação com dado de prod) → `deploy.sh` (checar-env → migrar --check → build → up worker→api→app → healthcheck) → crm.callface.io. **Nenhuma promoção sem**: migrations idempotentes aplicadas, proxy /api apontando para porta viva, smokes/aceites verdes contra banco com dado real.

## Definição objetiva de PRONTO (por capacidade)
Uma capacidade só é "pronta" quando:
1. Tela existe e renderiza com **sessão autenticada** (não 307/500).
2. Backend implantado em produção (rota Hono viva, não só no redesign).
3. Jornada ponta a ponta produz dado real verificável (nível RUNTIME, não só código).
4. Sem regressão vs a geração anterior (Functional Parity Matrix).
5. Fonte de verdade única para suas métricas (sem 6 respostas de MRR).
6. Integração com observabilidade (`integracao_sync_estado` populada).
7. Sem dado órfão/duplicado introduzido.

## Pendências de decisão do PO
[DECISÃO PO] remoto único; escopo de IA no produto; manter/remover ai_* e Callface AI; agenda rasa suficiente?; destino das 141 oportunidades e 15 contratos perdidos na migração.
