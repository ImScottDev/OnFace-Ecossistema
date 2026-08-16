# Callface CRM 2.0 — Architecture Decision Records

Formato curto: contexto → decisão → consequência. ADRs numeradas herdadas do blueprint (`blueprint-crm2-vs-current-state.md`, vault) mantêm a numeração original quando aplicável; novas decisões tomadas durante a execução recebem `ADR-EXEC-NNN`.

---

## ADR-EXEC-022 — oportunidade_bundle: linhas comerciais independentes viram oportunidades separadas

**Contexto**: ADR-EXEC-021 modelou fulfillment por "grupo comercial" DENTRO de uma proposta/oportunidade só. O Kauã corrigiu: isso ainda deixava uma oportunidade contendo Callface AI + PABX simultaneamente, exigindo um `PARTIAL_WON` que cria ambiguidade real de pipeline — de quem é o stage? o aging? o resultado? quando família A ganha e família B perde, o card representa o quê?

**Decisão 1 — a unidade operacional do pipeline é a oportunidade que chega a um resultado SOZINHA.** Callface AI, PABX e White Label, quando têm ciclos comerciais independentes, viram oportunidades DISTINTAS — cada uma com stage/responsável/valor/probabilidade/resultado próprios. O critério de separação é `service_family` do catálogo (a mesma dimensão já usada em todo o Commercial Core, não um conceito novo).

**Decisão 2 — itens da MESMA família continuam na MESMA oportunidade.** White Label licença MRR + setup + adicional é 1 oportunidade com N `oportunidade_itens` — a separação é por LINHA, não por item. `oportunidade_itens`/`revenue_nature`/`servicos_canonicos` (ADR-EXEC-019) ficam 100% intactos.

**Decisão 3 — `oportunidade_bundle` é agregação pura, nunca status.** Liga oportunidades nascidas da mesma negociação (`negocios.bundle_id` + `oportunidades.bundle_id`, dual-write). Não tem stage, não decide won/lost, não é lido por `avaliarEvidenciaWon`. Uma visão "1 de 2 oportunidades ganhas" é só uma consulta de agregação sobre os négocios do mesmo bundle — nunca um campo de status gravado em lugar nenhum.

**Decisão 4 — Won não precisou de nova modelagem.** Como cada negócio agora é single-family, `marcarNegocioGanhoSeAindaNao` (ADR-EXEC-021, inalterado) já produz exatamente o comportamento pedido: cada oportunidade fecha (ganha/perdida) pelo seu próprio mérito. `PARTIAL_WON` nunca existiu como valor de enum em código — só como conceito de UI/agregação, corretamente descartado.

**Decisão 5 — a separação acontece na CRIAÇÃO, nunca numa edição silenciosa.** `POST /propostas` detecta composição multi-família e organiza (`organizarVendaMultiLinha`) ANTES de criar qualquer negócio — retorna `{multiLinha:true, oportunidades:[...]}` com mensagem explícita ("Esta venda foi organizada em N oportunidades..."), nunca uma duplicação invisível. `PATCH /propostas/:id` REJEITA introduzir uma família nova num negócio já estabelecido noutra — orienta criar proposta separada em vez de corromper a identidade single-family do negócio via edição.

**Consequência**: `scripts/e2e-commercial-core.ts` prova AI+PABX como 2 oportunidades relacionadas com resultados independentes (E1-E8), AI ganho + PABX perdido sem `PARTIAL_WON` em lugar nenhum (E2), todas perdidas (E3) — 44/44, idempotente. Investigação real da Stripe PROD (leitura, via SSH) confirmou a chave `rk_live_` restrita a GETs e um gap real no webhook de PROD (3 eventos que o código trata nunca chegam, porque a assinatura do endpoint não os inclui). Nenhuma alteração em PROD/HOMOLOG.

---

## ADR-EXEC-021 — Commercial Core v2: modelo comercial por item, fulfillment por grupo independente

**Contexto**: ADR-EXEC-020 fechou o Commercial Core v1, mas com uma premissa errada exposta pelo próprio Kauã: "próximo passo" era decidido pela PROPOSTA INTEIRA (se qualquer item exigisse contrato, tudo esperava contrato). Isso quebra dois casos reais: (1) a mesma família (Callface AI) pode ser vendida COM ou SEM contrato dependendo só do desconto negociado — não é propriedade fixa do produto; (2) uma venda mista (AI sem fidelidade + PABX contratual) não pode travar o AI esperando o PABX assinar.

**Decisão 1 — Commercial Model vive no ITEM, não na família/catálogo.** `servicos_catalogo.commercial_model_padrao` é só a sugestão; `proposta_itens.commercial_model` é o valor real, resolvido assim: override do vendedor > default do catálogo > `PAGAMENTO_DIRETO` (nunca inventa exigência de contrato). `PAGAMENTO_DIRETO | CONTRATO_OBRIGATORIO | CONTRATO_FIDELIDADE_OPCIONAL`.

**Decisão 2 — Grupo Comercial é a unidade real de fulfillment.** No aceite, `formarGruposComerciais` agrupa os itens da proposta por `commercial_model` distinto — cada grupo (`proposta_grupo_comercial`) tem contrato/checkout PRÓPRIOS e uma state machine independente (`aguardando_contrato → contrato_enviado_assinatura → contrato_assinado → aguardando_checkout → checkout_gerado → pago → concluido`, ou o atalho direto pra `PAGAMENTO_DIRETO`). Uma proposta mista gera N grupos; cada um avança no seu próprio ritmo.

**Decisão 3 — Won (negócio) e Fulfillment (grupo) são conceitos DESACOPLADOS.** `marcarNegocioGanhoSeAindaNao` dispara na PRIMEIRA evidência real de QUALQUER grupo (mesma Commercial Evidence Policy de sempre, ADR-EXEC-012, agora só escopada por grupo via `comercial_evidencia.grupo_comercial_id`) — não espera todos os grupos concluírem, e não perde o que já foi confirmado só porque outro componente da venda ainda está em aberto. Materialização de serviço canônico é rigorosamente por GRUPO (`materializarServicosCanonicosDoGrupo`), não pelo negócio inteiro — um grupo concluído nunca materializa item de outro grupo ainda pendente.

**Decisão 4 — Checkout deixa de ser efeito colateral de enviar proposta.** Comportamento legado real (achado nesta sessão): `enviarPropostaComCheckout` criava um Payment Link Stripe todo envio, presumindo decisão de compra que ainda não existia. Removido. Checkout agora é `checkouts` (entidade própria, com `origem`: `automatico_pos_aceite` | `manual_vendedor`), criado só: (a) automaticamente, logo após o cliente aceitar um grupo sem contrato; (b) manualmente, por ação explícita e auditada do vendedor (`POST /propostas/grupos/:grupoId/gerar-checkout`) — nunca marca Won sozinha.

**Decisão 5 — PABX/White Label também faturam via Stripe daqui pra frente.** Depois da assinatura, todo grupo (mesmo `CONTRATO_OBRIGATORIO`) tenta gerar checkout automaticamente — substitui o "sem billing automático, cobrar manualmente" do v1. Se a chamada Stripe falhar (ex: catálogo sem produto configurado, ou — como neste sandbox — sem `STRIPE_API_KEY`), o grupo fica em `aguardando_checkout` e o vendedor pode gerar manualmente depois; nunca crasha, nunca finge sucesso. Histórico/billing antigo da holding continua intocado — isso vale só pra vendas novas.

**Decisão 6 — Contrato = domínio próprio, gerado por template.** `contrato_templates` (parametrizado, `commercial_model`-aware) + `lib/crm/contrato-template.ts::gerarContratoDeTemplate` resolve variáveis reais (pessoa/empresa/CNPJ/itens/valores/condições) e renderiza — nenhum contrato mais montado campo-a-campo na mão. `contratos.grupo_comercial_id` liga o contrato ao GRUPO, não à proposta inteira (é o que permite PABX assinar sem travar o Callface AI da mesma venda).

**Decisão 7 — Assinatura via abstração `SignatureProvider`.** Provider definitivo ainda não escolhido (Kauã avaliando). `lib/crm/signature/provider.ts` define a interface (`contract_created→sent_for_signature→opened→signed/declined/expired/canceled`); `SimpleElectronicSignatureProvider` (única implementação registrada) é o aceite eletrônico simples já existente, agora isolado atrás da interface — trocar de provider no futuro é só registrar outra classe, zero mudança no domínio de Contratos.

**Decisão 8 — Materialização resiliente via Event Outbox real, não mais best-effort inline.** `concluirGrupo` persiste `status='concluido'` + publica `FulfillmentGroupCompleted` (mesma transação). Um consumer REAL (`consumer.ts`, roda no sweep do worker) processa esse evento e materializa — se falhar (grupo órfão, DB fora do ar), o evento fica `pending`/retry (5 tentativas) e só então `failed` — nunca perde o fato comercial, nunca falha silenciosamente. O consumer FALHA explicitamente se a materialização resultar em 0 serviços (nunca "sucesso" vazio).

**Decisão 9 — checkout público via Hosted Checkout (redirect), não Embedded.** Verificado antes de codar: a integração Stripe atual é REST direto sem SDK/publishable key — não há Embedded Checkout/Elements configurado. Migrar exigiria nova infra client-side, fora de escopo. Bridge `/checkout/{id}` preserva nossa identidade visual e registra `CheckoutOpened` de verdade antes do redirect pro domínio do Stripe.

**Consequência**: `scripts/e2e-commercial-core.ts` prova os cenários A-J pedidos (AI sem/com contrato, PABX, White Label, MISTA com estados independentes provados item-a-item, ajuste sem encerrar proposta, recusa, checkout manual sem marcar Won, falha de materialização com retry/dead-letter, retry sem duplicar) — 39/39, idempotente, invariantes de portfolio/ledger histórico intocados. Nenhuma alteração em PROD/HOMOLOG.

---

## ADR-EXEC-020 — Commercial Core fechado: Oportunidade → oportunidade_itens → Won → Serviço Canônico

**Contexto**: ADR-EXEC-019 formalizou o schema de `oportunidade_itens` mas nenhum código de aplicação ainda os populava, e nenhum código escrevia em `servicos_canonicos` numa venda nova (só existia dado histórico da reconciliação). Pedido do Kauã (16/08): fechar o fluxo operacional inteiro, não só telas.

**Decisão 1 — `servicos_catalogo.service_family` como campo declarado.** Mesmo padrão de `requer_contrato` (0010): cada item do catálogo declara sua família — nunca inferida por nome/categoria em runtime. Catálogo White Label criado (não existia nenhum item ativo até então), `requer_contrato=true` por padrão (mesmo tratamento de PABX) — **decisão de negócio a confirmar**, registrada em `crm2-decisoes-pendentes.md`.

**Decisão 2 — `oportunidade_itens` é sempre a composição ATIVA, nunca uma soma histórica.** `syncOportunidadeItensFromProposta` remove, antes de inserir, qualquer item de origem `proposta_item` que não pertença à proposta sendo sincronizada — uma nova versão de proposta ou uma proposta nova substitui a composição anterior do negócio, não acumula. Fallback `garantirItemComercialManual` cobre o Won 100% manual (sem proposta nenhuma) sintetizando 1 item por natureza presente (MRR/SETUP/ONE_TIME) a partir dos campos legados do negócio.

**Decisão 3 — Serviço Canônico nasce/atualiza no momento do Won, um por item.** `materializarServicosCanonicosDoNegocio` roda nos 3 pontos reais de Won (pagamento Stripe confirmado, assinatura de contrato, gate manual em `negocios.ts`). Regras duras, codificadas (não só documentadas): `revenue_nature != MRR` nunca seta `current_recurring_value`; `commercial_lifecycle` é sempre `ACTIVE` num Won novo, nunca derivado de `billing_status`; `canonical_key` usa `STRIPE:<subscriptionId>` quando há assinatura Stripe real (mesma convenção da reconciliação, permite futura reconciliação por essa chave) ou `CRM2:<oportunidadeItemId>` caso contrário — nunca colide com prefixos legados (`ZOHO:`/`LEDGER:`/`MANUAL:`/`WEVY`).

**Decisão 4 — fluxo pós-aceite é policy, não string de produto.** Já existia (`servicosCatalogo.requerContrato` + `determinarProximoPasso`, ver `proposta-fluxo.ts`) — reaproveitado tal qual. Uma proposta mista com QUALQUER item `requerContrato=true` vai inteira pelo caminho contrato; limitação conhecida (não trata pagamento parcial dos itens que não exigem contrato numa venda mista) — não resolvida agora, fora do escopo desta rodada.

**Decisão 5 (fix de correção, não de arquitetura) — Commercial Evidence Policy tinha um furo real.** O fallback legado de `avaliarEvidenciaWon` tratava `propostas.status = 'aceita'` como equivalente a `signed_contract` — mas no fluxo condicional (caminho contrato), "aceita" significa só "cliente confirmou, aguardando assinatura" (comentário already existente em `proposta-publica.ts`: "não é Won ainda"). Achado pelo próprio E2E deste ADR (cenário 7): um negócio no caminho contrato conseguia passar no gate de Won ANTES da assinatura. Corrigido: os dois fallbacks legados (`proposta aceita` e `contrato existente`) agora ignoram contrato com `assinatura_status = 'pendente'`.

**Consequência**: eventos novos no Event Outbox (`PaymentStarted`, `PaymentCompleted`, `ContractRequired`, `ContractSigned`, `CanonicalServiceActivated`) + aggregateType `"servico"`. Página de negócio nova no App Shell (`/negocios/[id]`, substitui a rota — legado movido pra `/negocios-legado/[id]`) mostra composição comercial real. `scripts/e2e-commercial-core.ts` prova os 10 cenários pedidos + invariantes de portfolio/ledger histórico intocados (33/33, idempotente em reruns). Nenhuma alteração em PROD/HOMOLOG.

---

## ADR-EXEC-019 — Consolidação PROD→DEV: reconciliação v1.1 versionada + oportunidade_itens (item, não a oportunidade, carrega família/natureza)

**Contexto**: fechada a ponte de dados PROD consolidado (tag `prod-consolidated-2026-08-16`, commit `89460f8`) → HOMOLOG → DEV/CRM2. Antes de retomar features, era preciso formalizar em código (schema.ts + migration versionada) o que até então só existia via `db:push`/SQL manual: a reconciliação v1.1 (carteira canônica, ledger histórico, recuperação Zoho — 16 estruturas) e o backfill do Domain Model CRM2 (`pessoas`/`oportunidades`/`clientes`/`pontos_contato`).

**Decisão 1 — reconciliação v1.1 + recuperação legado formalizadas em migration única** (`0012_reconciliation_and_crm2_domain_model.sql`): `servicosCanonicos`, `serviceLedgerBatches/Entries`, `servicoBillingTimeline`, `reconciliationRuns/Changes`, `anexosLegado`, `legacyProvenance`, `billingIdentities`, `catalogoMapeamentosLegacy`, `contratoItens`, `faturaItens`, `eventosComerciais`, `portfolioSnapshots`, `correctionRuns/ChangeLog` + colunas de classificação em `contratos`/`leads`/`notas`/`atividades`/`faturas`/`statusChanges`/`assinaturas`/`propostaItens`/`empresas`/`negocios`. Escopo deliberadamente **não** inclui o módulo CS (0 linhas, revertido) nem nada do CRM2.0 ainda inacabado.

**Decisão 2 — correção arquitetural: `service_family`/`revenue_nature` NÃO são propriedade de `oportunidades`.** Uma oportunidade é o container comercial da negociação; pode conter múltiplos produtos/naturezas simultâneos numa venda mista (ex.: Callface AI licença MRR + Callface AI consumo USAGE + PABX plano MRR + PABX instalação SETUP + White Label licença MRR + White Label implantação SETUP, tudo na mesma proposta). Modelar 1 oportunidade = 1 família = 1 natureza quebra assim que a venda é mista — não existe resposta certa pra "qual família vai em `oportunidades.service_family`" numa venda AI+PABX.

Estrutura correta, criada agora (`oportunidade_itens`, nova):
```
OPORTUNIDADE (container: pessoa/empresa, responsável, pipeline/stage, valor estimado, origem)
   └── OPORTUNIDADE_ITEM (produto, service_family, revenue_nature, quantidade, preço, desconto, recorrência) × N
```
Depois do fechamento, cada item dá origem a um `servicoCanonico` correspondente (`oportunidadeItens.servicoCanonicoId`). Isso já conversa com o desenho de Propostas existente (fluxo comercial condicional: composição decide o caminho — AI vai proposta→aceite→pagamento, PABX/White Label podem exigir proposta→contrato→pagamento, uma proposta mista precisa representar os dois).

A classificação do **negócio legado** (que era 1:1 família/natureza, dado real da reconciliação) continua 100% preservada — não em `oportunidades`, mas no próprio `negocios` (legado, colunas `serviceFamily`/`revenueNature`/`semantic*` já existiam), acessível via `oportunidades.negocioIdLegado → negocios`. Zero duplicação, zero contaminação do Domain Model novo com uma limitação que só existe pro dado histórico.

**Decisão 3 — fluxo de normalização evento→domínio, fechado (não é mais decisão pendente):**
```
eventos_comerciais  (fato/evidência histórica bruta, recuperada/consolidada)
      │
      ▼
comercial_evidencia (representação normalizada dentro do domínio comercial CRM2 — SEMPRE gerada)
      │
      ▼ (só quando financeiramente determinístico)
mrr_movimentos      (representação financeira normalizada — NUNCA cópia cega)
```
`mrr_movimentos.eventoComercialId` (nova, unique) é a chave de idempotência dessa ponte. Na prática (backfill real, 2026-08-16): dos 169 eventos elegíveis (excluído `alteracao_contratual` e `renovacao` sem delta), só 3 resolveram família+empresa sem ambiguidade e viraram `mrr_movimentos`; os outros 166 ficam representados em `comercial_evidencia` (fato preservado) sem heurística forçada — ausência de movimento normalizado **não é perda do evento**.

**Decisão 4 — identidade: dedup só por chave canônica, nunca por PII.** `pessoas` faz backfill 1:1 lead legado→pessoa; dedup real só via `canonicalLeadId` explícito (0 casos no dataset atual — nenhum lead foi marcado alias de outro). E-mail/telefone/nome nunca geram merge automático — no máximo, no futuro, uma sugestão de possível duplicidade pra revisão humana.

**Decisão 5 — `clientes.statusFinanceiro` é cache/projeção, nunca fonte de verdade.** Current MRR continua exclusivamente `servicosCanonicos.currentRecurringValue`. Quando não há serviço canônico vinculado à empresa do cliente, o status fica `"indefinido"` — não é inferido artificialmente (172/249 casos reais no backfill, por falta de `empresa_id` ou de serviço vinculado).

**Consequência**: schema.ts, migration e script de backfill (`app/scripts/backfill-crm2-domain-model.sql`, idempotente, versionado) ficam coerentes entre si e reproduzíveis do zero (validado rodando a migration + o backfill contra uma base `dev` recém-materializada via `drizzle-kit push`, sem depender de nenhum estado manual de sessão). Typecheck limpo. Nenhuma alteração adicional em PROD/HOMOLOG.

---

## ADR-EXEC-018 — App Shell V1 (tema claro) + Command Center — fundação do frontend do CRM 2.0

**Contexto**: Kauã trouxe a 1ª tela oficial do Figma (`crm-command-center-light`, node 42:6718) como contrato visual/UX da V2, com um conjunto de decisões explícitas: (1) tema claro é o padrão da V1, mas a arquitetura precisa suportar dark depois sem reconstruir componente; (2) a navegação do Figma é a direção oficial — itens do sistema atual que não couberem entram numa seção "Legado", sem forçar encaixe; (3) todo número do mockup é placeholder — implementar com dado real, e se não existir fonte confiável, mostrar indisponível/N-A, nunca inventar; (4) taxa de abertura de e-mail fica indisponível (sem tracking, e-mail não é canal principal agora); (5) "Callface AI Insights" usa heurística real (meta-realizado), desacoplado por trás de uma interface que aceita IA depois sem mudar a UI; (6) o card de ranking reflete a organização/time do contexto RBAC atual (org-switch de super_admin já existente); (7) Figma define COMO mostrar, CRM 2.0 define O QUE mostrar — divergência resolve a favor do backend; (8) métricas com fonte confiável entram calculadas com regra clara e registrada, métricas ambíguas ficam indisponíveis; (9) Command Center é o Home consolidado, não uma página por bloco; (10) esta tela estabelece o padrão de componente/tema pro resto do CRM 2.0; (11) critério de pronto é o pipeline completo Figma→componente→API→dado real→estado→interação→navegação, não só semelhança visual.

**Decisão — Theme System**: achado real ao investigar o app atual pra não repetir o erro — o CRM 1.0 quase não usa as CSS vars que já existiam em `globals.css`; a esmagadora maioria dos componentes tem cor hardcoded direto no JSX (`bg-white/[0.03]`, `text-white/50` etc). Pra não repetir isso na V2: todo componente novo usa exclusivamente variáveis `--cf2-*` (namespace próprio, não colide com as `--bg-*`/`--text-*` antigas), escopadas em `[data-cf2-theme="light"]` (`app/globals.css`). Adicionar dark depois é só um bloco `[data-cf2-theme="dark"] { ...mesmas variáveis... }` — zero componente muda. Tipografia própria da V2 (Manrope/Geist/Inter, extraída do Figma via `get_design_context`) via `next/font/google`, variáveis novas (`--font-cf2-*`) que não tocam `--font-body`/`--font-heading` do tema antigo.

**Decisão — coexistência com o legado (strangler pattern no frontend)**: mesmo princípio já usado o projeto inteiro no backend (dual-write, coexistência, cutover gradual). App Shell novo vive em `app/(crm2)/`, layout próprio (`Cf2Sidebar`+`Providers` reusado), **sem tocar** `app/(crm)/layout.tsx` nem `CrmSidebar`/`CrmTopbar` — zero risco de regressão nas telas existentes. Nav items do Figma que ainda não têm tela nova linkam pra rota legada real (ex.: "Atendimento"→`/whatsapp`, "Pipeline"→`/pipeline`) — salto visual dark↔light ao navegar é esperado e temporário, não é bug. Seção "Legado" (Carteira/Financeiro/Contratos/Prospecção/Campanhas/Admin) fica colapsada por padrão.

**Decisão — escopo de acesso**: `(crm2)/layout.tsx` restringe a `isAdminView` (admin/gerente/super_admin/director/coordinator/operations) — closer/sdr continuam no dashboard pessoal legado intocado. "Derivar" a experiência pros outros papéis é trabalho futuro explícito, não decidido agora.

**Decisão — Insight Engine desacoplado**: `lib/insights/` — `InsightProvider` interface + `HeuristicInsightProvider` (regra matemática: meta − realizado = restante; quem já bateu a meta é destacado). Ponto único de troca (`lib/insights/index.ts`) pra um provider de IA substituir depois sem tocar em nenhum componente de UI. Zero dependência de Groq.

**Decisão — cálculos novos, cada um com regra registrada** (`lib/analytics/command-center.ts`):
- MRR comparativo (mês atual × anterior): reusa `getFechadoPeriodo` (já validada/corrigida nesta reconstrução), delta% null se mês anterior for zero.
- Série diária acumulada (gráfico): calculada direto de `negocios.ganhoAt`/`mrrFechado` pro mês pedido — **não depende de `metricas_diarias` acumular histórico** (a tabela só existe desde 09/08, não tem mês anterior ainda; receita fechada por dia é fato imutável, sempre reconstruível de qualquer mês passado).
- Funil de Leads: mesma categorização real do board de Pré-vendas (sdr_status + negócio ativo vinculado + status no_show), snapshot atual, não filtrado por período.
- Comunicações: SÓ contagem real por canal no mês (sem fórmula). Deliberadamente sem taxa de atendida/resposta/abertura — e-mail não tem tracking de abertura no schema, ligação/WhatsApp não têm regra formal do que conta como "sucesso". UI mostra "Indisponível" (`Cf2UnavailableMetric`), nunca fabrica o número — princípio explícito do Kauã: "se o CRM não consegue provar o número, não apresenta como verdade".
- Atividade em Tempo Real: feed real cross-canal (ligações/whatsapp/e-mail), só ordenação por data, sem cálculo.

**Achado real durante a validação, corrigido antes de entregar**: a 1ª versão de "Pipeline Comercial" calculava conversão como razão simples entre contagens de estágios adjacentes AGORA. Com dado real, deu **"Conv. 231%"** (Proposta tinha mais negócios acumulados que Reunião no momento do snapshot) — prova concreta de que a métrica não é válida: conversão de verdade precisa de coorte (mesmo negócio acompanhado no tempo), não uma razão entre contagens de momentos diferentes. Removido — `convPct` fica sempre indisponível até existir funil-eventos com granularidade de coorte. Exatamente o tipo de gap que devia ser sinalizado, não mascarado.

**Validado ponta a ponta com dado real via Playwright + requisição HTTP autenticada direta**: `/inicio` renderizando todo dado real (MRR R$4.816, delta -91,6% vs mês anterior, meta 9%, pipeline 107 negócios, ranking Mayra/Mayara reais, funil de leads 63/312/138/26, insight heurístico "Mayra Schincariol precisa de R$22.222" — conta bate exato), abas Visão Geral/Pipeline/Pendências (24 reais) navegáveis por URL real (`?tab=`), seção Legado expansível, navegação pra rota legada sem erro. Nenhum dado inventado — cards sem fonte confiável mostram "Indisponível" de verdade.

**O que isto NÃO faz** (consciente, fora de escopo desta entrega): não migra Carteira/Financeiro/Contratos/Prospecção/Campanhas/Admin pra dentro da nova IA (ficam em Legado até decisão futura); não implementa dark theme (só a arquitetura que permite); não constrói o resto dos domínios (Atendimento/Pessoas&Empresas/Qualificação/etc. como telas próprias) — essa tela é a fundação, o resto evolui em cima do mesmo sistema.

---

## ADR-EXEC-001 — Event bus: outbox Postgres + BullMQ existente, sem broker novo

**Contexto**: blueprint pede arquitetura orientada a eventos (ADR003 original). Time de 6 pessoas, já opera BullMQ/Redis.

**Decisão**: implementar Event Outbox como tabela Postgres (`event_outbox`) escrita na mesma transação da mudança de domínio, consumida por worker BullMQ. Não introduzir Kafka/RabbitMQ/EventBridge.

**Consequência**: desacoplamento real sem nova peça de infra pra operar. Se volume/latência exigir mais no futuro, é decisão a revisitar — não hoje.

---

## ADR-EXEC-002 — Terceira via de evidência de "Won" para PBX — arquitetura RESOLVIDA (09/08), calibração de política ainda pendente

**Contexto**: guardrail "Won só com contrato assinado ou pagamento confirmado" (blueprint bloco 15/99) assume evidência via Stripe/assinatura. PBX fatura pela Holding/Wive, fora do Stripe.

**Atualização 09/08 (revisão do Kauã)**: o gap arquitetural está resolvido — ver ADR-EXEC-012 (Commercial Evidence Policy). O que falta agora é só CALIBRAÇÃO de negócio (quais tipos de evidência valem pra produto='pabx' — ver `won_evidence_policies`), não construção. Registrado em `crm2-decisoes-pendentes.md`.

**Decisão original (mantida como contexto histórico)**: atestação manual financeira com dupla aprovação + audit_log obrigatório (nunca silenciosa), como terceiro caminho de evidência só pra `produto='pabx'` — a "dupla aprovação" é exatamente o tipo de calibração fina que ainda não foi decidida (o default construído usa aprovação única de admin/gerente, reversível).

**Dado real pra informar a decisão (09/08, gate já implementado em `negocios.ts`)**:
dos 425 negócios `status='ganho'` no banco local, 158 (37%) não têm nenhuma
evidência (nem proposta aceita, nem contrato). 143 desses 158 (90%) têm
`zoho_id` — são legado importado, não atividade recente. Só ~15 são de fato
recentes/sem zoho_id, distribuídos esparsamente (2-5/mês nos últimos meses)
— provavelmente os casos reais de PABX/venda manual. **O gate implementado
não afeta dado histórico** (só bloqueia transição NOVA sem evidência) —
esses ~15/mês são o tamanho real do problema que a terceira via de
evidência (ADR pendente) precisa resolver, não é volume alto.

**Bloqueia**: fechamento pleno de F4 (Commercial). Não bloqueia F0-F3.

---

## ADR-EXEC-003 — Schema V2 em paralelo, não refatoração do schema legado

**Contexto**: já era a recomendação que surgiu na conversa original (ChatGPT) quando o risco de "refatorar banco vivo" foi pesado contra "criar schema novo ao lado". Bate com o princípio de strangler pattern do blueprint (bloco 65).

**Decisão**: tabelas novas do Domain Model (Contact/Company/Deal v2/Attribution/Customer) nascem como tabelas novas, convivendo com `leads`/`negocios` legado via dual-write até corte controlado na F8.

**Consequência**: mais tabelas temporariamente, mas zero downtime e zero corrida contra o tempo pra migrar tudo de uma vez.

---

## ADR-EXEC-004 — Verificação de achados técnicos: dado real de produção via `refresh-dev-db.sh`, não suposição

**Contexto**: 2 achados técnicos vieram de uma auditoria feita pelo ChatGPT lendo o repositório (não validado independentemente). Hierarquia definida pelo Kauã: conversa > blueprint > código real > análises.

**Decisão**: todo achado técnico é verificado por query direta no banco local (espelho real de produção via `refresh-dev-db.sh`) antes de entrar em qualquer plano de correção.

**Resultado da verificação (08/08/2026)**:
- MRR duplicado: CONFIRMADO, 36 pares ativos, R$17.449,30/mês de excesso (cresceu de R$12.092,70/16 pares em 30/07 — bug segue ativo).
- Reuniões travadas em "agendada": CONFIRMADO, 53 reuniões de julho.
- Assinaturas fora do espelho (~47, ~R$15,9k): NÃO reproduzido — descartado como achado atual.
- `organizacao_id` nullable em tabela financeira: schema permite, mas 0 violação real — constraint `NOT NULL` aplicável sem backfill.

---

## ADR-EXEC-006 — Rewrite de paridade dev/produção no roteamento Next↔Hono

**Contexto**: a auditoria original caracterizou as rotas Next.js duplicadas
(`app/src/app/api/*`) como "código morto em produção" porque o Traefik
roteia `/api/*` (exceto `auth`/`webhooks`/`financeiro`/`onboarding`/
`campanhas`) direto pro container Hono. **Isso é verdade só em produção.**
Em `next dev` local não existe Traefik — o frontend chama `fetch("/api/...")`
relativo, que cai na porta 3000 (Next), executando exatamente as rotas
"mortas". Verificado empiricamente: `/api/tarefas` (só existe no Hono) via
`:3000` sem este fix daria 404; com o fix, responde igual ao Hono direto.

**Decisão**: `next.config.ts` ganha um `rewrite` condicional a
`NODE_ENV === "development"` que espelha EXATAMENTE a regra do Traefik
(`docker-compose.yml`, routers `callface-crm`/`callface-crm-api`),
proxyando `/api/*` (com a mesma lista de exceções) pra
`http://localhost:${HONO_API_PORT || 3001}`. Em produção o rewrite nem
entra em jogo pra esses paths — Traefik já intercepta antes da request
chegar no processo Next.

**Consequência**: dev local passa a testar exatamente o caminho que
produção executa (Hono como autoridade real). Isso destravou a remoção seg­
ura das 101 rotas Next.js duplicadas (antes disso, deletá-las teria
quebrado o dev local, mesmo sendo seguro em produção).

---

## ADR-EXEC-008 — Branch `homolog` atual é backup do Kauã, NÃO é target de deploy do CRM 2.0

**Contexto**: investigando como sincronizar F0 pro ambiente de homolog,
descobri que a branch git `homolog` (origin/homolog, commit `2bcca3d`
"freeze do estado real de homolog 07/08") não é simplesmente "main
atrasado" — é uma bifurcação deliberada que captura o estado real do
servidor de homolog em 07/08, incluindo WIP nunca decidido: módulo CS/
Onboarding completo (revertido em prod, mas nunca saiu do filesystem de
homolog), `callpilot-trigger.ts` pausado, e — achado valioso — **o fix de
MRR duplicado completo e FUNCIONAL** (`lib/crm/contratos.ts`:
`avaliarContratosAtivosDoLead`/`marcarContratoRenovado`, wired de verdade em
`lib/crm/aceitar-proposta.ts` e `api-server/routes/contratos.ts` — não só
existindo solto como no `wip/local-pre-sync`). O próprio commit de freeze
avisa um risco real: `LossReasonModal.tsx` (feature ATIVA em produção) não
existe nessa branch.

**Decisão (confirmada pelo Kauã, 09/08)**: essa branch/ambiente é backup
intencional dele — ele vai revisar com calma depois e decidir o que
aproveitar. **Não integrar, não fazer merge, não tocar.** O CRM 2.0 precisa
de um ambiente de homolog PRÓPRIO, novo, separado desse.

**Valor pra depois**: quando chegar a Fase 4 (Won gate + fix de MRR), a
implementação de referência de `avaliarContratosAtivosDoLead` já existe
pronta e testada nessa branch — vale revisar como ponto de partida quando
o Kauã autorizar, em vez de reprojetar do zero.

---

## ADR-EXEC-009 — Fix do endpoint AI SDR (OpenAI→Groq) + achado de credencial inválida

**Contexto**: achado confirmado na auditoria original — `lib/ai/sdr.ts` chamava
`api.openai.com` com nome de modelo Groq (`llama-3.3-70b-versatile`), sem
`OPENAI_API_KEY` documentada em nenhum lugar do projeto.

**Decisão/fix**: `callAiSdr` agora chama `api.groq.com/openai/v1/chat/completions`
de verdade, lê `GROQ_API_KEY` (não mais fallback pra `OPENAI_API_KEY`), e
ganhou fallback em cascata de 3 modelos Groq (mesmo padrão já validado em
`worker/index.ts` no job `site-lead-qualify` — rate limit independente por
modelo).

**Achado real, não resolvido por mim (precisa do Kauã)**: testei a chamada
de ponta a ponta com a `GROQ_API_KEY` real do `.env` local — o request agora
chega corretamente no Groq (confirmado: a resposta de erro vem do próprio
Groq, `invalid_api_key`, não mais um 404 genérico do OpenAI), mas **a chave
armazenada está inválida/expirada**. Confirmado via `curl` direto, isolado
do código (mesmo resultado). Isso não é bug de código — é credencial que
precisa ser renovada no console da Groq e atualizada no `.env` (local e,
quando chegar a hora, homolog/produção). **Bloqueia validar o AI SDR de
ponta a ponta de verdade até isso ser resolvido.**

**Consequência**: o código está corrigido e verificável estruturalmente
(endpoint/modelo/formato certos), mas não posso confirmar que a Natália
"funciona" de ponta a ponta sem uma chave válida — ficaria sendo suposição.

---

## ADR-EXEC-010 — Investigação da causa raiz do "Missing Owner" recorrente (F6)

**Contexto**: o Data Quality Layer (F6) achou 54 leads `tipo='lead'` sem
`responsavel_id` — inicialmente li isso como "o bug de 03/08 (18 leads)
recorrendo e crescendo", o que seria preocupante (fix quebrado).

**Investigação (09/08)**: os 54 leads têm **origem='outbound'**,
**sdr_status='pending'** (nunca avançou), e — o dado decisivo — **o EXATO
MESMO `created_at`** até o microssegundo (`2026-08-05 18:53:54.647357-03`).
Isso não é criação orgânica um a um pela aplicação — é um **INSERT em lote
único**, de um script/import externo, 4 dias antes desta sessão. Confirmado
que nenhum ponto do código atual (`grep` completo por `"outbound"`) cria
lead com essa origem — os 3 lugares que usam essa string só a CONSOMEM
(filtro de relatório/meta), nunca a escrevem. "outbound" é valor
reconhecido pelo sistema de relatórios, mas não é produzido por nenhuma
rota/webhook/worker existente hoje.

**Conclusão real**: **não é o mesmo bug de 03/08 recorrendo** — aquele fix
(fallback reativo, dispara quando `sdr_status` muda) continua funcionando
pra qualquer lead que passe pelo fluxo normal da aplicação. Este é um
evento distinto: alguém (Kauã ou outro processo) rodou um import em lote
de prospecção fora do código da aplicação, sem preencher responsável.
Mesmo SINTOMA (Missing Owner), causa raiz DIFERENTE — não precisa de fix
de código, precisa de decisão humana de reconciliação (atribuir os 54 a
alguém, mesmo padrão do backfill de 03/08). **Não fiz essa reconciliação
sozinho** — fica registrada aqui pra decisão do Kauã, mesmo critério de

**Atualização 09/08 (investigação mais a fundo, a pedido do Kauã)**:
identificado o processo exato — `campos_custom->>'fonte'` = `apollo_whitelabel_lookalike`
em 100% dos 54 (`origem='outbound'`), batendo exatamente com a prospecção
"Apollo White Label" de 05/08 já registrada em memória (88 leads-lixo →
55 qualificados, mesma data). Não foi um import misterioso — foi uma
campanha real de prospecção outbound que nasceu fora do fluxo normal da
aplicação (script/processo próprio, não pelas rotas `leads.ts`/`apollo.ts`),
por isso não preencheu `responsavel_id`.

**Regra de atribuição histórica encontrada**: TODOS os outros 24 leads com
`origem='outbound'` no banco pertencem à mesma pessoa — Jenifer Matos
(gerente, ativa). 100% de consistência, zero exceção. **Proposta (não
aplicada)**: atribuir os 54 leads à Jenifer Matos, mesmo padrão. Não
executei essa atribuição sozinho — atribuir 54 leads de uma vez muda a
carga de trabalho real de uma pessoa (dobra o volume outbound dela, de 24
pra 78), é o tipo de decisão operacional que merece confirmação antes de
aplicar, mesmo com a evidência sendo forte. Pronta pra rodar num comando
só quando confirmado.
"correção em massa exige checkpoint humano" já aplicado o resto da sessão.

---

## ADR-EXEC-011 — Analytics separado da OLTP: snapshot pré-computado, não reimplementação de agregação (F6)

**Contexto**: F6 pedia "Analytics separado do OLTP" — o dashboard hoje
recomputa ~10 blocos de query síncrona a cada page load. Ao ler o código
real (`dashboard/page.tsx`, 780 linhas), achei um risco maior do que o
escopo sugeria: os números agregados de empresa não são um cálculo simples
— têm comentário explícito documentando um bug real já corrigido em 22/07
("card somava mrr + valor_projeto e dava R$27.270 quando a meta mostrava
R$18.177, o projeto de um híbrido entrava dobrado"). Existem fontes
CANÔNICAS já estabelecidas pra evitar recorrência (`getFechadoPeriodo`,
`getPipelineAtual`, MRR = espelho do Stripe, nunca soma de contratos do
CRM).

**Decisão**: em vez de reimplementar a agregação numa tabela de projeção
(risco real de reintroduzir o mesmo tipo de bug de contagem duplicada que
já causou dor nesse projeto — MRR duplicado, card de meta errado), o
módulo novo (`lib/analytics/snapshot-diario.ts`) **chama as mesmas funções
canônicas** já usadas pelo dashboard e só cacheia o resultado em
`metricas_diarias` (job agendado, 1h). Escopo desta rodada: só o agregado
de EMPRESA (visão admin, `soMeu=false`) — os números pessoais/por-usuário
do dashboard são naturalmente baratos e já ficam de fora.

**Consequência**: infraestrutura de projeção real, construída e validada
(todos os 7 campos do snapshot bateram exatamente com os números já
confirmados visualmente no dashboard em F7 — meta, pipeline, fechado do
mês, MRR Stripe, MRR em risco). O dashboard **ainda lê direto da OLTP**
— não foi trocado pra ler do snapshot nesta rodada (strangler pattern,
mesmo critério do resto do projeto: construir em paralelo, só trocar
depois de rodar de verdade por um tempo e o Kauã validar). Endpoint de
leitura novo: `GET /api/relatorios/snapshot-diario` (calcula on-demand se
ainda não rodou hoje pra aquela org, não fica vazio esperando o cron).

**Pendência registrada**: trocar o dashboard pra ler do snapshot em vez de
recomputar — decisão futura separada, não decidida agora.

---

## ADR-EXEC-012 — Commercial Evidence Policy: Won desacoplado de Stripe (F4)

**Contexto**: revisão do Kauã (09/08) sobre o relatório de duplicidade de contratos identificou o achado mais importante da sessão — Stripe não pode ser tratado como fonte universal de receita da Callface. É fonte da verdade do que é faturado *pelo Stripe*; PBX/venda manual fatura fora dele. O gate de Won anterior (ADR original, "proposta aceita OU contrato existente") já não acoplava a Stripe diretamente, mas também não tinha um caminho extensível pra registrar QUALQUER tipo de evidência futura — só sabia checar 2 tabelas específicas.

**Decisão**: Won não é mais `if (evidência específica) won = true` — é uma pergunta genérica: "esse negócio tem evidência comercial válida conforme a política do produto dele?". Arquitetura:
- `comercial_evidencia` (tabela nova): registro tipado de evidência por negócio — `tipo` (`stripe_payment` | `stripe_subscription` | `signed_contract` | `manual_contract` | `admin_approval`), `sourceRef`, `metadata`, `verificadoPor` (null = automático).
- `won_evidence_policies` (tabela nova): por org × produto (produto=null = catch-all), define quais tipos de evidência valem. Sem política configurada, cai num default idêntico ao comportamento anterior (nunca regride).
- `lib/crm/won-evidence.ts`: `avaliarEvidenciaWon()` (usado pelo gate), `registrarEvidencia()` (chamado nos pontos reais de origem — hoje: `aceitar-proposta.ts` registra `signed_contract`), `registrarEvidenciaManual()` (endpoint novo `POST /negocios/:id/evidencia-manual`, admin/gerente, sempre audit-logado — a via PBX/manual).
- Fallback lazy: se um negócio nunca passou por um ponto que registra evidência (dado histórico, ou caminho ainda não coberto como `stripe-sync.ts`), o gate cai no critério legado (proposta aceita OU contrato existente) e AUTO-REGISTRA a evidência retroativamente — sem precisar de script de backfill em massa.

**O que NÃO foi decidido (calibração de negócio, registrada em `crm2-decisoes-pendentes.md`)**: quais tipos de evidência valem pra `produto='pabx'` — a política catch-all seedada hoje é idêntica ao comportamento anterior (`signed_contract`/`stripe_subscription`/`stripe_payment`), então PBX ainda não consegue fechar via `admin_approval` até alguém inserir uma linha em `won_evidence_policies` pra `produto='pabx'` incluindo esse tipo. Validado com dado real (script descartável): evidência manual registrada e auditada corretamente, mas o gate CONTINUA bloqueando até a política aceitar aquele tipo — prova que a política é real, não um carimbo.

**Escopo não coberto nesta rodada**: `stripe-sync.ts` (contrato criado direto de assinatura Stripe, fora do fluxo de proposta) não registra evidência explicitamente — os contratos criados ali frequentemente não têm `negocioId` (não passam por negócio), e a MRR-fix já validada nesse arquivo é sensível o suficiente pra não arriscar tocar sem necessidade real agora. O fallback lazy já cobre os casos onde o contrato tem `negocioId`.

---

## ADR-EXEC-013 — Cadence Engine: arquitetura construída sem esperar credencial de IA (F5)

**Contexto**: instrução explícita do Kauã (09/08) — "não espere a Groq para construir a arquitetura [do Cadence Builder]... a validação real do agente fica bloqueada pela credencial, mas a arquitetura não". A cadência real hoje existe de 2 formas independentes, cada uma reimplementando sua própria noção de "quando é a próxima tentativa": (1) `cadencia/sdr-inbound.ts` — 13 toques hardcoded, disparo manual pelo SDR; (2) `runAiSdrRetrySweep` no worker — 2 tiers de retry (24h/40h) com lógica de `if` embutida direto na função que também chama a IA e envia WhatsApp, tudo junto.

**Decisão**: construir um motor de cadência genérico (`lib/cadencia/cadence-engine.ts`) — state machine com steps tipados (`wait` | `action`), branching por condição (reusa `avaliarCondicao`, extraído de `automacao-engine.ts` pra um módulo compartilhado `lib/crm/condicao.ts` — mesma gramática, uma implementação só), retry com backoff configurável por step, cancelamento auditável, e um registry de **adapters** (`registrarAdapter(nome, fn)`) — "chamar a IA" é só mais um adapter possível, o engine não sabe nem precisa saber que existe Groq/OpenAI/WhatsApp/email. Schema novo: `cadence_definitions` (steps como grafo jsonb) + `cadence_enrollments` (instância rodando, por entidade) + `cadence_enrollment_events` (audit trail). Sweep periódico no worker (`cadence-sweep`, 5min) já rodando de verdade.

**Validado com dado real** (2 scripts descartáveis, removidos): grafo de 3 steps com branch condicional (pulou um step com base em `vars` atualizado pelo step anterior), retry com 2 falhas simuladas + backoff + sucesso na 3ª tentativa, audit trail completo e correto, cancelamento com motivo, idempotência de enrollment (não duplica), e o sweep pegando exatamente o enrollment vencido e ignorando o que estava agendado pro futuro.

**O que NÃO foi feito (decisão consciente, não corte de escopo por pressa)**: migrar a cadência real do AI SDR ou do SDR inbound pra rodar em cima deste motor. Isso mudaria comportamento de um fluxo de receita que já funciona em produção (mesmo que localmente) — é o tipo de corte que merece ser feito com cuidado e validação (idealmente com a credencial Groq renovada pra testar E2E de verdade), não decisão unilateral só porque a arquitetura ficou pronta. O motor existe, testado, sem nenhum enrollment real usando-o ainda — zero risco de regressão nos 2 sistemas que já funcionam.

---

## ADR-EXEC-014 — 58 contratos ambíguos: classificação por evidência, não tarefa manual (F4)

**Contexto**: instrução do Kauã — não gastar tempo revisando 58 contratos um a um; construir uma classificação automática por evidência (alta confiança duplicata / alta confiança legítimo / ambíguo de verdade) primeiro, e só escalar pra humano o que sobrar.

**Decisão**: `classificarAmbiguosPorEvidencia()` (`lib/crm/contrato-duplicidade.ts`) compara cada contrato "ambiguo" (sem assinatura Stripe vinculada) com o vizinho MAIS PRÓXIMO NO TEMPO dentro do mesmo grupo lead+produto — e o vizinho pode ser QUALQUER contrato do grupo, não só outro ambíguo (achado real ao construir: comparar só ambíguo-com-ambíguo deixava 43/58 sem nenhum vizinho pra comparar, porque a maioria dos grupos só tem 1 ambíguo ao lado de contratos JÁ confirmados). Limiares calibrados com dado real (13 pares analisados antes do fix de escopo): diferença de valor ≤5% E diferença de tempo ≤1 dia → `duplicata_provavel`; diferença de valor ≥40% OU diferença de tempo ≥5 dias → `legitimo_provavel`; o resto → `revisao_necessaria`.

**Resultado real**: dos 58 ambíguos, 33 `duplicata_provavel`, 23 `legitimo_provavel`, só **2 `revisao_necessaria`** (o que de fato precisa de olho humano). Muitos dos 33 `duplicata_provavel` têm `stripeSubscriptionId` preenchido na própria linha do contrato mas SEM registro correspondente em `assinaturas` — consistente com serem mais instâncias do mesmo bug já diagnosticado (dois contratos quase simultâneos pra mesma venda, um deles nunca teve a assinatura vinculada). Não é um achado avulso, é o mesmo padrão em escala maior.

**O que isso NÃO faz**: nenhuma correção automática. `duplicata_provavel` é um SINAL de alta confiança pra entrar numa fila de consolidação, não uma ordem de merge. A decisão de consolidar (e como — qual contrato mantém, qual arquiva) continua humana, só que agora com 33 casos endereçáveis em lote (revisão rápida, confirma o padrão) em vez de 58 individuais.

---

## ADR-EXEC-007 — Data Governance: quem escreve o quê

**Contexto**: guardrail 35 do blueprint ("Data Governance & Source of
Truth") — não é só "de onde vem o dado pra leitura" (isso já existia no
bloco 46), é **quem tem autoridade de ESCREVER**. Sem essa regra explícita,
o legado acumulou campos manuais de receita (`leads.mrrEstimado`,
`negocios.valorSetup` etc.) que nunca deveriam ter existido como fonte
paralela.

**Decisão** — tabela de autoridade de escrita por domínio:

| Domínio | Quem escreve | Quem só lê |
|---|---|---|
| Identidade (usuarios/organizacoes/teams) | Admin/Operations via `/admin/*` | Todo o resto |
| Lead/Contact/Company/Deal (comercial) | CRM (rotas Hono `api-server/routes/*`) | Analytics, Business Hub (futuro) |
| Attribution/Touchpoints | Lead Intake Layer (F1), nunca UI direta | CRM, Analytics |
| Comunicação (Call/WhatsApp/Email) | Integrações (`lib/integrations/*`) + worker | CRM, AI |
| MRR/Assinatura/Fatura/Contrato (valor) | **Só** `stripe-sync.ts`/webhook Stripe + fluxo de aceite de proposta. **Nunca** campo manual editável em tela. | CRM (exibe), Financeiro, Business Hub |
| Won/Lost (`negocios.status`) | Endpoint de ação explícito (`PATCH /negocios/:id`, F4 evolui pra `/deals/:id/win` dedicado) validando evidência (contrato/pagamento) | Analytics |
| Audit Log / Event Outbox | Escrito pelo próprio código de domínio na mesma transação, nunca editado depois | Observability, compliance |
| CS/Onboarding/Finance/Business Hub (futuro) | Cada sistema é dono do próprio domínio; CRM só publica evento, nunca escreve direto lá | — |

**Consequência prática imediata**: os campos legacy de valor manual em
`leads`/`negocios` (`mrrEstimado`, `valorSetup`, `valorProjeto`,
`mrrFechado`, já marcados "legacy" no schema desde a auditoria original)
**não devem receber nova escrita** a partir de F1 — ficam congelados como
histórico até serem removidos na migração de F8. Nenhuma tela nova deve
escrever neles.

**Enforcement hoje**: convenção documentada + code review, não constraint de
banco (não dá pra impedir INSERT/UPDATE num campo texto/decimal via schema
sem trigger). Se isso continuar sendo violado na prática, uma trigger de
banco ou uma camada de write-guard fica como candidato de F1+.

---

## ADR-EXEC-015 — Bug crítico corrigido: chave de sessão do api-server fixa na variante HTTPS

**Contexto**: Kauã reportou ao vivo, em tempo real, "login funciona mas qualquer tela me desloga de volta pro login" — bloqueava totalmente o uso do CRM local. Investigação inicial (senha desatualizada, middleware `/admin/*` restrito a super_admin) resolveu problemas reais mas MENORES — o bug de verdade só apareceu ao reproduzir "navegar por qualquer tela".

**Causa raiz**: `api-server/auth.ts` (rotas Hono — perfil, notificações, contadores do sidebar, admin) deriva a chave de decriptação da sessão via HKDF usando o NOME DO COOKIE como salt (é assim que o NextAuth v5 funciona). O nome do cookie tinha ficado **hardcoded** na variante HTTPS (`__Secure-authjs.session-token`), mas em dev local (HTTP puro) o cookie real é `authjs.session-token` (sem prefixo). Resultado: chave sempre errada, decode sempre falha, 401 em 100% dos requests pra qualquer endpoint Hono — determinístico, não uma corrida. Como `Providers.tsx` tem um handler global que redireciona pra `/login` em QUALQUER 401 próprio, isso se manifestava como "qualquer navegação desloga". As páginas Next.js (dashboard, admin) nunca eram afetadas porque usam `auth()` do próprio NextAuth (caminho diferente).

**Por que passou despercebido até agora**: eu tinha detectado a rajada de 401 na F7 (revival do CrmTopbar) e **diagnostiquei errado** — registrei como "recupera sozinho, corrida de hidratação de sessão, não bloqueia". Estava errado nas duas partes: não recupera (é permanente por request), e não é corrida (é determinístico). O erro só ficou visível de verdade quando o Kauã testou navegação real entre telas — meus testes anteriores via curl focavam em páginas Next.js (sempre corretas) ou testavam a mesma página repetidamente sem cruzar pelos endpoints Hono afetados.

**Fix**: `getKey`/`decodeSession` agora recebem o nome do cookie encontrado e derivam (cacheando) uma chave por nome — tentam as 2 variantes, igual a leitura do cookie já fazia.

**Achado colateral**: o processo do `api-server` (`tsx watch`) estava rodando sem reiniciar há 2 dias — nenhuma mudança de código desta sessão em rotas Hono tinha sido realmente testada contra o servidor real (só via chamada direta de função em scripts). Reiniciado manualmente. Vale considerar monitorar isso (`tsx watch` não é 100% confiável pra restart automático em todo ambiente).

**Validado**: 9 endpoints que davam 401 (perfil/notificações/leads/whatsapp/propostas/negocios/carteira/admin×2) voltaram 200, checado 5x consecutivas.

---

## ADR-EXEC-017 — Bug crítico de produção corrigido: notificações duplicadas sem fim (SLA + 2 casos menores)

**Contexto**: durante a auditoria de "Atividades/Tarefas", achado real ao investigar a tabela `notificacoes` — o job `check-sla` (worker, roda a cada 30min desde sempre) usa `.onConflictDoNothing()` pra evitar duplicar alerta de SLA estourado, mas **`notificacoes` nunca teve nenhuma unique constraint** — o `onConflictDoNothing()` não tinha nenhum conflito real pra detectar, então era um no-op silencioso desde que o job existe.

**Impacto real medido**: **167.582 notificações duplicadas** no banco (mirror de produção), alguns negócios com **mais de 2.224 cópias idênticas** de "SLA estourado" cada, acumulando desde 25/06 (46 dias × 48 execuções/dia). Como é o MESMO código do worker que roda em produção, o sininho de notificação de qualquer admin real provavelmente está (ou estava) afogado no mesmo volume de spam.

**Fix**: aplicado o mesmo padrão de dedupe que `follow-up-proposta` já usava corretamente (checa se existe notificação NÃO LIDA do mesmo tipo+link antes de criar) — `check-sla` agora dedupa por negócio (link mudou de `/pipeline` genérico pra `/negocios/:id`, também corrige a UX de "pra onde o clique leva").

**Achado colateral, mesmo padrão root-cause, escala bem menor**: 2 outros `onConflictDoNothing()` na mesma situação (constraint inexistente) — `lead_labels` (auto-tag "No-show" em `negocios.ts`, achada 1 duplicata real) e `lead_listas` (add em lote pra lista, achado 0 duplicatas, mas o próximo double-click criaria). Corrigido adicionando `uniqueIndex` real em ambos (`(leadId, labelId)` e `(leadId, listaId)`), aplicado via `drizzle-kit push --force` depois de deduplicar a 1 linha existente. `comercialEvidencia` (F4, Won Evidence) foi checado e está correto — tem uniqueIndex real desde que foi criado.

**Limpeza**: as 167.582 linhas de spam foram removidas do banco de dev LOCAL (mirror, não produção — zero valor informativo, só ruído). **Produção provavelmente tem o mesmo acúmulo e não foi tocada** — fica registrado aqui pra o Kauã decidir quando/como limpar lá (é um `DELETE FROM notificacoes WHERE tipo = 'sla_alerta'` direto, sem risco, mas é ação em produção real então não decidi isso sozinho).

**Por que não foi achado antes**: o worker sempre reportou "N negócios breached" no log sem erro — o bug é 100% silencioso do ponto de vista operacional, só aparece investigando o volume real da tabela.

---

## ADR-EXEC-016 — Event Outbox: de tabela morta a barramento real (Eventos/Event-Driven)

**Contexto**: achado da revisão arquitetural externa de 09/08 — `event_outbox` existia desde F0 (schema completo: idempotência, status, retry, dead-letter), mas **nada nunca escreveu nela e nada nunca leu dela**. Todo o sistema (automação, cadência) sempre disparou por chamada direta de função no ponto exato da mudança de domínio (`dispararAutomacoes(gatilho, ctx)`), nunca por evento publicado/consumido. Marcado como o gap arquitetural 🔴 de maior prioridade antes de qualquer congelamento.

**Decisão**: dois módulos novos, decoplados entre si —
- `lib/events/outbox.ts` — `publicarEvento()`, insert best-effort em `event_outbox` (mesmo precedente de dual-write: nunca bloqueia o fluxo real).
- `lib/events/consumer.ts` — `registrarConsumidorEvento(eventType, handler)` (registry local, mesmo padrão do registry de adapters do Cadence Engine) + `processarEventosPendentes()`, chamado pelo worker via novo job agendado `event-outbox-sweep` (1min). Retry com dead-letter em 5 tentativas (`status: failed`, `lastError` preenchido).

**Eventos ligados nesta entrega** (núcleo real do domínio, não é migração de tudo): `LeadCreated` (leads.ts, criação de lead), `DealCreated` (negocios.ts POST + criação de negócio junto do lead), `StageChanged` (negocios.ts PATCH, toda transição de status), `DealLost` (status=perdido), `DealWon` + `CustomerCreated` (dentro do gate de evidência de Won já existente — ADR-EXEC-012 — payload rico com `contratoId`, `produto`, `evidencias`, `mrr`). Todos publicados no MESMO call site onde `dispararAutomacoes` já dispara (F5) — zero pontos novos de descoberta, os 7 gatilhos reais já estavam mapeados.

**Consumidor real #1** (prova de que é barramento, não só tabela): jornal de auditoria de domínio — todo evento processado grava em `audit_log` (`action: event.<Tipo>`, `source: worker`), decoplado do código que publicou. Não substitui nenhuma notificação/automação existente — é um artefato novo (histórico durável e consultável de "quando esta transição de domínio aconteceu", independente de updatedAt mutável).

**Validado com dado real, ponta a ponta, via API real (não script direto)**: login real (cookie de sessão, mesmo fluxo do bug de ADR-EXEC-015) → `POST /leads` real → `LeadCreated`+`DealCreated` publicados, sweep automático (job agendado, não chamada manual) processou os 2 em <70s, `audit_log` recebeu os 2 registros com payload correto → `PATCH /negocios/:id` status=ganho (gate de evidência real, fallback legado via contrato existente) → `StageChanged`+`DealWon`+`CustomerCreated` publicados com payload correto (`contratoId` reaproveitando o contrato existente, sem duplicar; `evidencias: ["signed_contract"]`). Dado de teste removido depois da validação.

**O que isto NÃO faz**: não migra `whatsapp_recebido`/`contrato_vencendo`/`lead_inativo`/`nps_recebido` pra publicar evento ainda (automação já cobre esses 4 via chamada direta, menor prioridade/valor pra CS/Finance/Analytics que ainda não têm nenhum consumidor real do lado de fora do CRM); não cria nenhum consumidor de negócio real além do jornal de auditoria (CS/Onboarding, Financeiro, Business Hub continuam sem existir como sistemas — quando existirem, assinam `DealWon`/`CustomerCreated` sem tocar em `negocios.ts`). O barramento existe de verdade agora; o que falta é gente do outro lado assinando.

---

## ADR-EXEC-005 — Documentação da reconstrução vive no repo, não só no vault

**Contexto**: instrução do Kauã — outro agente/sessão precisa retomar sem reconstruir raciocínio, mesmo sem acesso ao vault Obsidian.

**Decisão**: `docs/reconstruction/{RECONSTRUCTION_STATE,ARCHITECTURE_DECISIONS,IMPLEMENTATION_PROGRESS}.md` no repo `callface-crm`, branch de trabalho. Vault (`blueprint-crm2-vs-current-state.md`, `plano-reconstrucao-crm-2.0.md`, `crm-callface-status.md`) continua sendo a fonte de contexto de produto/negócio — o repo é a fonte de execução técnica.
