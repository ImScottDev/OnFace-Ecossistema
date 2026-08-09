---
tags: [scott-studio, projeto-interno, decisao, callface]
---

> **Nota**: cópia de referência do vault Obsidian (fonte de contexto de produto/negócio), snapshot de 09/08/2026. Pode conter wikilinks `[[...]]` no formato Obsidian, que não resolvem fora dele — informativo, não é link quebrado.

# CRM 2.0 — Checkpoints Humanos Necessários

Resumo consolidado das decisões de NEGÓCIO que se acumularam durante a execução autônoma da reconstrução ([[plano-reconstrucao-crm-2.0]]). Reescrito 09/08 depois de recalibração explícita do Kauã: **decidir sozinho tudo que é técnico/arquitetural; só listar aqui o que depende de uma regra de negócio ainda não definida e que uma decisão errada poderia alterar dinheiro, dado histórico, permissão ou operação**. Não é "Kauã precisa ficar decidindo o sistema" — é "isso aqui especificamente é escolha de negócio, o resto eu já resolvi".

Detalhe técnico completo de cada ADR está em `docs/reconstruction/ARCHITECTURE_DECISIONS.md` no repo.

## 1. Calibrar a política de evidência de Won pro produto PBX

**O quê**: Won não está mais acoplado a Stripe — construída uma arquitetura de "Commercial Evidence Policy" completa (`won_evidence_policies`, ver ADR-EXEC-012), com um tipo de evidência `admin_approval`/`manual_contract` já existindo pra venda PBX/manual e um endpoint pra anexar (`POST /negocios/:id/evidencia-manual`, admin/gerente, sempre auditado). **Isso não é mais um problema arquitetural** — é só faltar UMA linha de configuração.

**Decisão que falta**: a política catch-all hoje só aceita `signed_contract`/`stripe_subscription`/`stripe_payment` (idêntico ao comportamento anterior, zero regressão) — `admin_approval` ainda não é aceito pra NENHUM produto. Pra habilitar PBX: decidir se uma única aprovação de admin/gerente já basta, ou se precisa de dupla aprovação (como a proposta original sugeria) — e então inserir uma linha em `won_evidence_policies` pro produto `pabx`. Trivial de aplicar depois de decidido.

## 2. 33 contratos "duplicata provável" — confirmar consolidação em lote

**O quê**: dos 58 contratos "ambíguos" (sem assinatura Stripe pra desempatar), uma classificação por evidência (valor + janela temporal, ver ADR-EXEC-014) já resolveu a maior parte: **33 duplicata provável** (mesmo valor ±5%, mesmo dia — muitos com `stripeSubscriptionId` na linha mas sem `assinaturas` vinculada, o mesmo padrão do bug de MRR já corrigido), **23 legítimo provável** (valor bem diferente ou espaçado no tempo — venda real), e só **2 revisão necessária** de verdade. MRR em excesso confirmado: R$17.449,30/mês.

**Onde ver**: `/admin/duplicidade-contratos` no CRM local, ou `npm run db:relatorio-duplicidade-contratos`.

**Decisão que falta**: os 33 "duplicata provável" são um SINAL de alta confiança, não uma ordem de merge — nenhuma correção foi aplicada. Decidir: (a) confiar no sinal e consolidar os 33 em lote (qual contrato de cada par mantém?), (b) revisar por amostragem antes de confiar no padrão, (c) só os 2 "revisão necessária" precisam mesmo de olho individual, os outros esperam. Os 4 "obsoleto_confirmado" (fora da classificação de ambíguo) têm evidência mais forte ainda (assinatura morta confirmada) — podem ser aprovados com mais confiança.

## 3. 54 leads sem responsável — atribuir à Jenifer Matos?

**O quê**: identificado com certeza o processo — os 54 leads (`origem='outbound'`, `campos_custom.fonte='apollo_whitelabel_lookalike'`) são a prospecção Apollo White Label de 05/08 (já registrada em memória: 88 leads-lixo → 55 qualificados). Não foi um import misterioso, foi uma campanha real que nasceu fora do fluxo normal da aplicação (script próprio, não pelas rotas do CRM), por isso não preencheu responsável. **Encontrada uma regra histórica 100% consistente**: os outros 24 leads com `origem='outbound'` no banco pertencem TODOS à Jenifer Matos (gerente).

**Decisão que falta**: atribuir os 54 à Jenifer, mesmo padrão? A evidência é forte (24/24, zero exceção), mas isso dobra a carga outbound dela (24→78) — é decisão operacional real sobre uma pessoa real, não decidi sozinho. Se confirmado, é uma query de UPDATE, nada mais.

## 4. Defasagem de até 1h no dashboard, se/quando trocar pra ler do snapshot

**O quê**: snapshot diário de analytics (`metricas_diarias`, ADR-EXEC-011) construído e validado (todos os campos batem exato com o dashboard ao vivo). O dashboard **ainda lê direto da OLTP** — a troca não foi feita porque muda comportamento real: os números passariam a ter até 1h de defasagem (o snapshot recalcula a cada 1h).

**Decisão que falta**: essa defasagem é aceitável pro dia a dia? Se sim, a troca é baixo risco (infra pronta, endpoint `GET /api/relatorios/snapshot-diario` já retorna `calculadoEm` pra qualquer UI futura mostrar "atualizado há Xmin"). Se não, o snapshot fica só de base pro Command Center (que pode conviver com defasagem, dashboard operacional não).

## 5. GROQ_API_KEY expirada — só validação, não constrói mais nada

**O quê**: o bug do endpoint errado do AI SDR foi corrigido (chamava OpenAI com nome de modelo Groq). A arquitetura do Cadence Builder também foi construída inteira sem depender da credencial (engine genérico, state machine, steps, retry, branching — ver ADR-EXEC-013, decisão explícita de não esperar a chave pra construir). **A única coisa realmente bloqueada pela credencial agora é validar uma conversa real do agente rodando de ponta a ponta.**

**Decisão que falta**: renovar a `GROQ_API_KEY` no console da Groq — não tem decisão de negócio aqui, é só uma ação (credencial).

## 6. Migrar a cadência real do AI SDR/SDR inbound pro Cadence Engine novo?

**O quê**: o motor de cadência genérico existe e foi validado (ADR-EXEC-013), mas os 2 sistemas reais de cadência (retentativa automática do AI SDR em `runAiSdrRetrySweep`, e os 13 toques manuais em `sdr-inbound.ts`) continuam rodando na lógica antiga — decisão consciente de não migrar ainda, porque isso mudaria comportamento de um fluxo de receita que já funciona.

**Decisão que falta**: vale migrar agora (o motor está pronto e testado) ou só depois que a credencial Groq for renovada e a IA puder ser validada de ponta a ponta com o motor novo por baixo? Não é bloqueio técnico, é sequenciamento de risco.

## 7. Ambiente de homolog do CRM 2.0

**O quê**: o CRM 2.0 precisa de um ambiente de homolog próprio (a branch/servidor `homolog` atual é backup pessoal do Kauã, não é target). Ainda não decidido: mesma EC2 com stack isolado vs. servidor novo.

**Decisão que falta**: não é urgente agora (nada foi promovido de F0-F7 ainda, tudo local) — decidir no primeiro checkpoint real de promoção.

---

## O que NÃO precisa mais de decisão (resolvido nesta sessão, 09/08)
- ~~3ª via de evidência de Won pra PBX~~ → arquitetura construída (item 1 acima é só a calibração fina que sobrou).
- ~~Cadence Builder — vale construir sem a Groq?~~ → construído. A pergunta virou item 6 (migrar cadência real ou não), não mais "posso construir".
- ~~58 contratos ambíguos, revisar um a um?~~ → 56/58 já resolvidos por classificação automática (item 2 acima é só os 33 + os 2 reais).
- MRR duplicado (causa raiz corrigida em `stripe-sync.ts`) e reuniões travadas (bug de escrita corrigido) — já corrigidos no código, só não testados com Stripe/prod real ainda por não ter credencial local.
- 101 rotas Next.js mortas removidas, RBAC v2, Data Governance, dual-write do Domain Model (F1 completo, incluindo os pontos de menor tráfego) — tudo já commitado e validado localmente, sem decisão pendente.

## Ver também
[[plano-reconstrucao-crm-2.0]] · [[blueprint-crm2-vs-current-state]] · [[crm-callface-status]]
