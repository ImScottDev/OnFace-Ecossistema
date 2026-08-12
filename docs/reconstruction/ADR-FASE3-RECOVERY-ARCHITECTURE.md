# Fase 3 — Recovery Architecture + CRM 2.0 Compatibility (ADR complementar)

> **Status: proposta para revisão. Nada aqui foi implementado, nenhuma migration foi aplicada, nenhum ambiente foi alterado.** Este documento responde à pergunta: *"Como recuperamos corretamente TODA a história relevante do Zoho para o CRM operacional atual, testando primeiro em homologação, sem introduzir uma representação que depois conflite com o Domain Model CRM 2.0 já construído?"*
>
> Entrada: fase 1 (`docs/reconstruction/auditoria-legado-zoho/00-SINTESE-CONSOLIDADA.md` + 6 relatórios) e fase 2 (`fase2-semantica-temporal/00-SINTESE-FASE2.md` + 5 relatórios). Arquitetura CRM 2.0 existente lida integralmente antes de escrever isto: `ARCHITECTURE_DECISIONS.md`, `vault-referencia/PLANO-RECONSTRUCAO-CRM2.md`, `crm2-decisoes-pendentes.md`, `IMPLEMENTATION_PROGRESS.md`, `app/src/lib/db/schema.ts`, `app/src/lib/crm/sync-domain-model.ts`, `app/src/lib/db/backfill-domain-model.ts`. Nenhuma decisão já fechada nesses documentos foi redesenhada — este ADR só confronta os achados novos (fase 1/2) contra o que já existe.
>
> **Revisão 2 (11/08, pós-review do Kauã)**: a v1 propôs estender `mrr_movimentos` como lugar do Lifecycle Event. Corrigido — `mrr_movimentos` é ledger financeiro, não pode ser a fonte de verdade do evento comercial (eventos como Cancellation Requested/Retention Started/Renewal/Contract Change podem ter R$0 de impacto, e Upgrade/Downgrade perderiam identidade própria ficando só como `expansao`/`contracao` com o rótulo escondido em `evidencia`). Seções afetadas por esta revisão: 1.4, 1.10, 1.13, 2.2, 2.3, 3, 4, 5, 6, 7, 8, 9, 10 e "Perguntas em aberto" (agora fechadas). O resto do documento (aprovado pelo Kauã) não foi tocado.

---

## 0. Achado de guardrail que muda a forma de todo o resto deste documento

Antes de qualquer matriz, um fato técnico que precisa estar explícito porque muda onde cada peça deste plano pode fisicamente existir:

**Nenhuma tabela do Domain Model CRM 2.0 (F0-F7) está deployada em homologação ou produção hoje.** `event_outbox`, `audit_log`, `teams`, `pessoas`, `pontos_contato`, `oportunidades`, `clientes`, `comercial_evidencia`, `won_evidence_policies`, `cadence_definitions/enrollments/events`, `metricas_diarias` — todas essas tabelas existem **só no ambiente de dev local** (confirmado na sessão de sync prod→dev de 10/08, e reconfirmado agora na comparação de schema homolog×produção desta sessão: homolog só tem 3 tabelas extras — `contas_cs`/`marcos_cs`/`onboarding_checklist`, módulo CS/Onboarding, e 1 coluna extra `leads.callpilot_disparado_em` — nenhuma tabela do Domain Model V2). `IMPLEMENTATION_PROGRESS.md` confirma isso: F0-F1 estão "completos localmente... nada promovido pra homolog ou produção ainda".

**Consequência prática**: o "CRM operacional atual" que esta Fase 3 vai alterar é **exclusivamente o schema legado** (`leads`, `empresas`, `negocios`, `contratos`, `propostas`, `proposta_itens`, `faturas`, `assinaturas`, `mrr_movimentos`, `notas`, `atividades`, `status_changes`, `custom_fields`, etc.). Não é possível "confrontar com `event_outbox`/`comercial_evidencia`/`clientes`/`oportunidades` já existentes no DEV" escrevendo nessas tabelas durante a recuperação — elas não existem no ambiente-alvo (homolog→produção). O confronto pedido é **conceitual/de compatibilidade futura**, não de implementação compartilhada agora. Todo delta de schema proposto neste ADR (seção 6) é sobre tabelas legadas que já rodam em produção hoje.

Isso não invalida nada do pedido — na verdade é exatamente o tipo de achado que evita "introduzir uma representação que depois conflite com o Domain Model V2": qualquer estrutura nova precisa ser desenhada para ser **mapeável por backfill** pro V2 quando ele for promovido pra produção (mesmo padrão que `backfill-domain-model.ts` já usa hoje: ler legado, projetar pro novo schema, idempotente).

## 0.1 Guardrail de paridade homolog × produção (confirmado, não é nova auditoria)

Conforme pedido — confirmado nesta sessão, antes deste ADR: **schema de homolog e produção estão em paridade completa** para tudo que é relevante a este plano. Diferença real encontrada: as 3 tabelas + 1 coluna do módulo CS/Onboarding (WIP legítimo, código homolog referencia essas tabelas ativamente — não é resíduo morto) e nada além disso. Nenhuma tabela do Domain Model V2 em nenhum dos dois. Dados de homolog foram resincados com produção nesta mesma sessão (pg_dump fresco, contagens batendo 1:1 em `leads`/`negocios`/`contratos`/`faturas`/`propostas`/`empresas`). **Homolog está pronto para receber o dry-run desta Fase 3 sem trabalho de reconciliação adicional.**

---

## 1. Recovery Domain Map

Para cada dimensão: fato legado (Zoho) → representação correta no CRM operacional atual (schema legado, já em produção) → mudança mínima de schema, se houver → provenance obrigatória → regra de conflito → regra temporal → mapeamento futuro pro CRM 2.0.

### 1.1 Companies (Accounts)

| | |
|---|---|
| Fato legado | 1.102 contas no Zoho, `zoho_id` já existe em `empresas` (944/1.102 migradas). |
| Representação atual | `empresas` — já é a entidade correta, sem ambiguidade estrutural. |
| Mudança mínima | Nenhuma de schema. Backfill dos 158 registros ausentes/desatualizados via `empresas.zoho_id`. |
| Provenance | `zoho_id` (já existe). |
| Conflito Zoho×Prod | CNPJ duplicado (6 grupos já achados) — nunca merge automático; sinalizar, decisão humana. |
| Regra temporal | `empresas.createdAt` do registro recuperado = `Hora de Criação` do Zoho, nunca a data da recuperação. |
| Mapeamento V2 | Direto — `pessoas.empresaId`/`oportunidades.empresaId` já referenciam `empresas.id` (nenhuma tabela Company v2 nova; `empresas` é a âncora nas duas gerações). |

### 1.2 Contacts / Leads / "Pessoa"

| | |
|---|---|
| Fato legado | 2.267 Contacts + 971 Leads no Zoho. Achado da fase 1: a tabela `contatos` do CRM atual **não é** o equivalente — é canal de conversa. A pessoa real vive em `leads` (`tipo='contato'`\|`'lead'`\|`'cliente'`). |
| Representação atual | `leads` continua sendo a entidade correta hoje — não criar tabela nova, não usar `contatos`. |
| Mudança mínima | Nenhuma de schema (`leads.zoho_id` já existe). |
| Provenance | `zoho_id`. |
| Conflito Zoho×Prod | 89,5% dos "449 leads pós-cutover" da fase 1 são, na fase 2, DUPLICADO de um lead que já existe sob outro registro (sem `zoho_id`) — regra de conflito aqui não é "qual valor vale", é "não importar, é a mesma pessoa capturada 2x". Ver seção 4. |
| Regra temporal | `createdAt` = `Hora de Criação` do Zoho. `updatedAt` só avança se o dado recuperado for genuinamente mais novo que o que já existe organicamente (nunca regride um registro editado por humano depois do corte). |
| Mapeamento V2 | `pessoas.leadIdLegado` já é a bridge. `backfill-domain-model.ts` já lê `leads` inteiro sem filtrar por zoho_id — qualquer lead recuperado entra automaticamente na próxima rodada de backfill sem código novo. |

### 1.3 ConvertedLeadRecords

| | |
|---|---|
| Fato legado | 481 registros — log oficial de conversão Lead→Contact/Account/Deal no Zoho. |
| Representação atual | Não existe uma tabela "log de conversão" no CRM atual — a conversão hoje é implícita (`leads.tipo` muda, `leads.convertidoAt` é preenchido). |
| Mudança mínima | Nenhuma nova. Usar `leads.convertidoAt` (já existe) preenchido com a data real do Zoho quando recuperável. |
| Provenance | Ficar registrado via `status_changes` (`motivo` = referência ao ConvertedLeadRecord de origem) — reuso, sem coluna nova. |
| Conflito Zoho×Prod | Nenhum esperado — é metadado de trilha, não dado operacional ativo. |
| Regra temporal | `convertidoAt` = data real da conversão no Zoho. |
| Mapeamento V2 | Não precisa de conceito próprio em V2 — a conversão Lead→Pessoa já é o próprio ato do backfill/sync (`syncPessoaFromLead`). |

### 1.4 Opportunities + Oportunidade Origem (o núcleo do problema)

Ver seção 2 (ADR Delta) — tratado em profundidade porque é o achado mais importante das 2 fases.

| | |
|---|---|
| Fato legado | 1.551 oportunidades, das quais 247 são eventos pós-venda (churn/upgrade/downgrade/renovação/alteração contratual) ligados via `Oportunidade Origem`, e 512 não têm negócio correspondente hoje. |
| Representação atual | Oportunidade original (aquisição real) → `negocios` (1:1, já existe). Evento pós-venda → **NÃO cria novo `negocios`** (isso reproduziria o erro do Zoho) → vai para o Lifecycle Event Ledger (seção 2). |
| Mudança mínima | Nova tabela `eventos_comerciais` (seção 2/6) — Lifecycle Event como conceito de 1ª classe, distinto do ledger financeiro. Não é extensão de `mrr_movimentos` (corrigido na revisão 2). |
| Provenance | `negocios.zohoId` (aquisição) + `eventos_comerciais.zohoId`/`negocioOrigemId` (evento) — ver seção 5. |
| Conflito Zoho×Prod | Os 121 negócios "ganho" com evento documentado depois — regra: negócio original NUNCA muda de status; o evento entra como linha nova em `eventos_comerciais`. Nunca resolver silenciosamente os 512 órfãos — cada um vira candidato a `negocios` novo só com confiança alta (tem Stage de vitória real + valor + data, não é rascunho/duplicata). |
| Regra temporal | `ganhoAt` do negócio original nunca é tocado por um evento posterior. Evento carrega `ocorridoEm` = `Data de Fechamento` do registro-evento no Zoho. |
| Mapeamento V2 | `oportunidades.negocioIdLegado` já é a bridge pra `negocios`. `eventos_comerciais` (seção 2) precisa, no futuro (fora de escopo agora), ganhar `oportunidadeId`/`clienteId` quando F1 for promovido — hoje só referencia `negocioId` (legado), que é tudo que existe no ambiente-alvo. |

### 1.5 Proposals / Proposal Items

| | |
|---|---|
| Fato legado | 1.067 Quotes, 1.876 Itens Cotados. Fase 1: 591 propostas atuais batem por valor+data (não há ID), 44% sem equivalente. |
| Representação atual | `propostas`/`proposta_itens` — entidade correta, sem ambiguidade estrutural. |
| Mudança mínima | Nenhuma coluna nova em `propostas` (revisão 2: usa `legacy_provenance`, seção 5, em vez de `zoho_id` direto) — resolve o mesmo problema (match hoje é só heurístico valor+data) sem sprawl de schema. |
| Provenance | `legacy_provenance` (`entidade_tipo='proposta'`) — ver seção 5. |
| Conflito Zoho×Prod | Proposta recuperada nunca sobrescreve proposta com atividade real pós-corte (`clienteRespondeuEm` preenchido = intocável). |
| Regra temporal | `createdAt`/`enviadaEm` = datas reais do Zoho. |
| Mapeamento V2 | Nenhuma tabela V2 de Proposal existe ainda (é escopo de F4 do plano de reconstrução, "Commercial" — `proposals`/`proposal_items` novos, ainda não construídos). Nada a mapear agora; a linha em `legacy_provenance` (`entidade_tipo='proposta'`) já fica pronta pra alimentar o backfill quando F4 chegar lá. |

### 1.6 Contracts (SalesOrders) / Contract Items

| | |
|---|---|
| Fato legado | 279 contratos nativos, 99,3% ausentes hoje (achado #1 da fase 1). Prazo (61% = 36 meses) e multa (92% = 30%) são o dado financeiro/jurídico mais crítico de toda a auditoria. |
| Representação atual | `contratos` — entidade correta. |
| Mudança mínima | **`contratos.prazo_meses` (integer, nullable)**, **`contratos.multa_percentual` (decimal(5,2), nullable)**, **`contratos.codigo_legado` (text, nullable — ex. `CT-288-05/2026`, distinto do `zoho_id` interno)**. Nenhuma dessas colunas existe hoje. |
| Provenance | `contratos.zoho_id` (já existe, 0% populado hoje — recuperação passa a preencher). |
| Conflito Zoho×Prod | 76 contratos (38 pares) já duplicados por `stripe_subscription_id` (achado vivo da fase 2, não é do Zoho) — resolver ANTES do backfill de contrato legado, senão a reconciliação por `negocio_id` fica ambígua contra qual dos 2 duplicados. |
| Regra temporal | `inicio`/`vencimento` = datas reais do contrato Zoho. `finalizadoAt` só preenchido quando há evento de encerramento real (não confundir com Stage `Cancelado`, achado #7 fase 1: campo pouco confiável). |
| Mapeamento V2 | Nenhuma tabela `contracts` V2 existe ainda (também F4). `contratos.zohoId`/`codigoLegado` ficam prontos pra alimentar o backfill quando F4 chegar. |

### 1.7 Products

| | |
|---|---|
| Fato legado | 274 produtos no Zoho. |
| Representação atual | `servicos_catalogo` (já existe, não investigado a fundo nas fases 1/2 — fora do escopo declarado). |
| Mudança mínima | Nenhuma proposta aqui — precisa de 1 rodada de reconciliação dedicada antes de decidir (não coberta pelas fases 1/2). |
| Provenance | A definir na rodada dedicada. |
| Conflito Zoho×Prod | A definir. |
| Regra temporal | A definir. |
| Mapeamento V2 | Produto V2 (`products`) é F4 — mesma observação de Proposals/Contracts. |

### 1.8 Invoices / Invoice Items

| | |
|---|---|
| Fato legado | 123 faturas históricas (fev/24–jun/25, R$74k), 0% presentes em qualquer origem hoje. |
| Representação atual | `faturas` — já existe, hoje 100% Stripe (`origem='stripe'`). |
| Mudança mínima | Nenhuma de schema — `origem` já é texto livre, não constraint de enum. Convenção nova: `origem='zoho_legado'` pras 123 recuperadas. |
| Provenance | `faturas.externalId` guarda o ID Zoho sob o namespace `zoho_legado` — o índice único já existente `(origem, external_id)` garante idempotência de graça. |
| Conflito Zoho×Prod | Nenhum esperado (nenhuma fatura Stripe cobre esse período). |
| Regra temporal | `emitidaEm`/`pagaEm` = datas reais do Zoho. |
| Mapeamento V2 | Nenhuma tabela V2 de Invoice existe ainda — mesmo padrão de Proposals/Contracts. |

### 1.9 Notes

| | |
|---|---|
| Fato legado | 4.560 notas, 0% presentes em `notas` (achado #6 fase 1 — foram pra `atividades`, tabela errada pra UI mostrar). |
| Representação atual | `notas` — é a tabela certa pra nota visível no produto hoje. |
| Mudança mínima | Nenhuma coluna nova em `notas` (revisão 2: usa `legacy_provenance`, seção 5). |
| Provenance | `legacy_provenance` (`entidade_tipo='nota'`) — ver seção 5. |
| Conflito Zoho×Prod | Nenhum esperado (não há nota nova concorrente no mesmo registro). |
| Regra temporal | `createdAt` = data real da nota no Zoho — **crítico**: preservar a data original, não a data da recuperação, porque a fase 2 usou justamente `createdAt` de nota pra reconstruir jornada com confiança CONFIRMED. |
| Mapeamento V2 | Nenhuma entidade Note V2 dedicada existe — permanece em `notas` até decisão futura de Communication/Timeline (F2, já parcialmente construída). |

### 1.10 Stage History (DealHistory) / Lead Status/Owner History

| | |
|---|---|
| Fato legado | 6.429 transições de estágio de negócio + 5.346 linhas de histórico de status/dono de lead. Achado #6 da fase 1: 100% perdido, `audit_log` nunca ligado — e agora sabemos que `audit_log` nem existe em produção (seção 0). |
| Representação atual | `status_changes` — já existe em produção, já é append-only por design, é a estrutura certa pra Stage History de negócio. Para lead, mesma tabela (tem `leadId`). |
| Mudança mínima | Nenhuma de schema — só passar a popular via recovery. |
| Provenance | **`status_changes.zoho_id`/`confianca`/`evidencia` (novos, colunas diretas — decisão fechada pelo Kauã na revisão 2/3)**: rastreabilidade exata por linha, não escondida dentro de `motivo`, mesmo padrão de confiança/evidência de `eventos_comerciais` (seção 5/6). |
| Conflito Zoho×Prod | Nenhum — é aditivo puro, histórico nunca é sobrescrito. |
| Regra temporal | `createdAt` = `Hora da modificação` real do Zoho. |
| Mapeamento V2 | Nenhuma tabela de histórico V2 existe (F1 dual-write ainda não cobre isso). Quando existir, é leitura direta de `status_changes`, sem transformação. |
| **Ressalva explícita** | `status_changes` é apagado em cascata quando o negócio/lead é excluído (achado da fase 2, `negocios.ts:749`/`leads.ts:1103,1124`) — mesmo risco que já existe hoje pra dado orgânico; recovery não introduz risco novo, só herda o existente. Não é bloqueante, é observação de paridade. |

### 1.11 Calls / Meetings / Tasks / Emails

| | |
|---|---|
| Fato legado | 414/382/510/177 registros, 0% migrados (tudo que existe hoje é atividade nova pós-corte). |
| Representação atual | `atividades` (genérica, `tipo`+`dados` jsonb) — ligações reais hoje também espelham em `ligacoes`; reunião real em `reunioes`. Recovery histórico não deveria criar `ligacoes`/`reunioes` retroativas com metadados de integração que nunca existiram — só `atividades`. |
| Mudança mínima | Nenhuma coluna nova em `atividades` (revisão 2: usa `legacy_provenance`, seção 5). |
| Provenance | `legacy_provenance` (`entidade_tipo='atividade'`) + `dados` (jsonb, já existe) guarda o payload cru do registro Zoho. |
| Conflito Zoho×Prod | Nenhum esperado. |
| Regra temporal | `createdAt` = data real do Zoho. |
| Mapeamento V2 | `communications`/`ai_analysis` (F2) já parcialmente construídos, mas ainda não substituem `atividades` como fonte — recovery fica em `atividades`, migração futura (quando F2 assumir de fato) é decisão separada. |

### 1.12 ZohoSign Documents / Recipients / Events

| | |
|---|---|
| Fato legado | 368 documentos, 1.257 destinatários, 547 eventos. Achado #7 fase 1: gap estrutural — não existe onde isso morar mesmo tentando. |
| Representação atual | Não cabe em `contratos.assinaturaStatus`/`assinadoEm`/`assinadoNome`/`assinadoIp` — esses 4 campos são o fluxo **ativo** de aceite eletrônico simples (decisão pendente #2 do `crm2-decisoes-pendentes.md`), misturar dado recuperado ali contaminaria o fluxo novo. |
| Mudança mínima | **`contratos.assinatura_legado_zoho` (jsonb, nullable)** — guarda o documento+destinatários+eventos recuperados na íntegra, separado do fluxo de aceite ativo. |
| Provenance | Embutido no próprio jsonb (IDs Zoho de documento/destinatário). |
| Conflito Zoho×Prod | Nenhum — campo novo, exclusivamente histórico. |
| Regra temporal | Datas dentro do jsonb são as reais do ZohoSign — nunca usadas para preencher `assinadoEm` (que é do fluxo ativo). |
| Mapeamento V2 | Quando existir um `SignatureProvider` abstrato de verdade (decisão pendente #3 do plano de reconstrução, ainda sem bloqueio de fase), este jsonb é a fonte de dado histórico pra popular o equivalente V2 — não perde nada por estar em jsonb agora. |

### 1.13 Attachments

| | |
|---|---|
| Fato legado | 1.980 arquivos, 831MB, majoritariamente ligados a ZohoSign (achado #12 fase 1). |
| Representação atual | Não existe tabela de anexo genérica hoje. |
| Mudança mínima | **Decisão fechada pelo Kauã (revisão 2): recuperar metadado E os binários** — legado não é considerado 100% recuperado até os 1.980 arquivos estarem preservados e verificáveis, não só indexados. Tabela nova leve `anexos_legado` (id, entidade_tipo, entidade_id, zoho_id, nome_arquivo, tamanho_bytes, criado_em_original, storage_url/path) + rotina de upload físico. Pode rodar como lote separado (não bloqueia o resto do dry-run — Companies/Leads/Opportunities/Eventos/Contratos seguem em paralelo), mas entra no critério de "recovery completo" antes de declarar a Fase 3 encerrada. |
| Provenance | `zoho_id` do anexo. |
| Conflito Zoho×Prod | Nenhum esperado. |
| Regra temporal | `criado_em_original` = data real do Zoho. |
| Mapeamento V2 | Nenhuma entidade de anexo V2 existe — decisão futura. |

### 1.14 Campos customizados

| | |
|---|---|
| Fato legado | Dezenas de campos customizados por módulo (fase 1, `01-inventario-zoho.md`), incluindo os 77 campos de automação de qualificação de lead que não são dado, são regra de negócio configurada (não recuperável de CSV). |
| Representação atual | `custom_fields` (definições) + `camposCustom` jsonb (em `leads`/`negocios`/`empresas`) já existem e já são a estrutura certa. |
| Mudança mínima | Nenhuma. |
| Provenance | Chave dentro do jsonb identifica origem Zoho (`zoho:<nome_do_campo>`), convenção, não coluna nova. |
| Conflito Zoho×Prod | Campo customizado novo criado organicamente pós-corte nunca é sobrescrito por chave Zoho de mesmo nome — merge de jsonb, não replace. |
| Regra temporal | N/A (não é dado datado por si). |
| Mapeamento V2 | Nenhuma tabela V2 dedicada — permanece jsonb indefinidamente, é o padrão certo pra esse tipo de dado semiestruturado. |

### 1.15 Attribution / Source / UTMs

| | |
|---|---|
| Fato legado | `Fonte de Lead`, campanha, etc. — Zoho não tem estrutura de Attribution real (é campo picklist simples). |
| Representação atual | `leads.origem`/`utmSource`/`utmMedium`/`utmCampaign`/`utmTerm`/`utmContent`/`metaAdId`/`metaAdsetId`/`metaCampaignId` já existem e já são o lugar certo. |
| Mudança mínima | Nenhuma. |
| Provenance | Preenchido a partir do campo Zoho equivalente quando existir; null quando não existir (nunca inventar UTM). |
| Conflito Zoho×Prod | Nenhum. |
| Regra temporal | N/A. |
| Mapeamento V2 | `pontosContato` (F1, Attribution Layer própria) já é abastecida a partir de `leads.utm*`/`origem` via `syncPessoaFromLead`/backfill — recovery de UTM em `leads` já flui pra lá automaticamente, sem trabalho novo. |

### 1.16 IDs, owners e provenance (transversal)

Tratado integralmente na seção 5 (Estratégia de Provenance) — não repetido aqui por dimensão porque a regra é a mesma em todas: toda entidade recuperada carrega `zoho_id` (ou equivalente novo, listado seção 6) + fica marcada com nível de confiança (CONFIRMED/INFERRED/AMBIGUOUS, vocabulário já validado nas fases 1/2) em algum campo de auditoria (ver seção 5) + `owner`/`responsavelId` recuperado do Zoho quando mapeável para um `usuarios.id` real (Cinthia/Mayara/Jaqueline etc. já identificadas nominalmente nas fases 1/2), nunca inventado.

---

## 2. ADR Delta — achados semânticos da Fase 2 vs. arquitetura V2 existente

### 2.1 As 6 afirmações da Fase 2, confrontadas uma a uma

**Opportunity ≠ Lifecycle Event.** Confirmado pelos dados (97,5% dos 121 casos: evento posterior ao `ganho_at`) e já é o desenho real do `negocios`/`oportunidades` atual — `ganhoAt` é um campo de estado, escrito 1x, nunca reescrito. **Nada muda na representação de Opportunity. O delta é só criar onde o Evento mora** (seção 2.3).

**Contract ≠ Customer Lifecycle.** A fase 2 (relatório E) já concluiu isto com honestidade: é "antecipação de escala" (produto real Callface tem AI+PABX simultâneos por cliente), não correção de um sintoma medido nos 365 casos analisados. **Decisão deste ADR: não criar separação nova agora.** `contratos.status` continua sendo o único lugar que expressa "está ativo hoje" — o candidato a Customer Lifecycle (`clientes.statusFinanceiro`) é uma tabela V2 que nem existe no ambiente-alvo (seção 0). Fica registrado como decisão pendente pra quando F1 for promovido, não resolvido aqui.

**Financial State ≠ Customer Lifecycle.** Mesma lógica — `faturas.status`/aging já é o estado financeiro (pago/aberto/falhou), e não precisa ser confundido com "o cliente está ativo". Nenhuma mudança de schema pedida por esta distinção hoje; é orientação de **uso**, não de estrutura: recovery nunca deve inferir `contratos.status='churned'` só porque existe fatura em atraso — precisa de evidência de encerramento real (nota, Stage do Zoho, ou o evento de churn recuperado).

**Cancellation Requested ≠ Churn.** Achado direto da fase 2 (seção A/4.1): 50% dos "downgrade" e 34,6% das "renovação" nomeadas no Zoho têm Stage=Perdido/Closed Lost — indício de que foram *propostas*, não *efetivadas*. **Regra de recovery**: um evento só entra em `eventos_comerciais` (seção 2.3) com `confianca='confirmado'` quando há evidência de efetivação (nota confirmando, contrato assinado, ou Stage de vitória real) — Stage isolado nunca é suficiente. Quando só existe o registro nomeado sem confirmação de efetivação, entra como `confianca='ambiguo'`, nunca como fato consumado.

**Churn de contrato ≠ churn completo do Customer.** Coerente com "Contract ≠ Customer Lifecycle" acima — `eventos_comerciais` (2.3) é escopado por **negócio/contrato**, nunca dispara automaticamente uma mudança de "cliente inteiro churnou" (que nem tem onde morar hoje, seção 2.2). Se um cliente tem 2 contratos (AI+PABX) e só 1 sofre churn, só aquele evento entra — nenhuma inferência sobre o outro.

**Upgrade e Downgrade preservam semântica própria.** A fase 2 (seção A/4) já identificou que colapsar os dois em "expansão"/"alteração contratual" genéricas é uma leitura possível mas não obrigatória, e a leitura literal preserva mais informação. **Decisão fechada (revisão 2)**: upgrade/downgrade são tipos próprios de primeira classe no Lifecycle Event (`eventos_comerciais.tipo`, seção 2.3) — nunca colapsados nem escondidos em `evidencia`. Quando há impacto de MRR, o evento *projeta* uma linha em `mrr_movimentos` com `tipo='expansao'`/`'contracao'` (vocabulário financeiro já existente) — mas essa projeção é uma consequência do evento, não o evento em si.

### 2.2 A pergunta central: onde mora o Lifecycle Event

**Correção de rumo (revisão 2, pós-review do Kauã)**: a v1 deste ADR propunha estender `mrr_movimentos`. Está errado, e o motivo é conceitual, não de detalhe de schema: `mrr_movimentos` é — e deve continuar sendo — o **ledger financeiro** (fato: "o MRR mudou de X pra Y, nesta data, por este motivo"). Lifecycle Event é um conceito mais amplo — o **fato comercial em si** (Won, Upgrade, Downgrade, Renewal, Churn, Reactivation, Cancellation Requested, Retention Started, Contract Change). Vários desses eventos legitimamente **não têm impacto de MRR** (Cancellation Requested pode não ter se efetivado ainda; Retention Started é uma ação, não um valor; Renewal pode manter o mesmo preço; Contract Change pode ser só troca de hardware/plano sem alterar receita — casos reais confirmados nos 247 registros da fase 2, ex.: migração pra Yeastar com delta R$0). Se o evento só existe quando gera uma linha financeira, todo evento sem impacto de MRR simplesmente não teria onde ser registrado — o gap que a fase 2 identificou continuaria aberto pra metade dos casos.

Confrontando os 4 candidatos que já existem (só em dev, seção 0) mais os que já existem em produção — análise mantida da v1, ainda válida:

| Candidato | Onde existe hoje | Por que não serve puro |
|---|---|---|
| `event_outbox` | Só dev | Função é orquestração assíncrona (fan-out), não histórico consultável — a própria diretriz do Kauã confirma que deve continuar assim. Também não existe em produção. |
| `status_changes` | **Produção** (legado) | Vocabulário rígido (`de_status`→`para_status` de `negocios.status`/`leads.status`), sem tipo de evento comercial (Won/Upgrade/Downgrade/Renewal/Churn/Reactivation), apagado em cascata. Correto pra Stage History (seção 1.10), não pra Lifecycle Event. |
| `comercial_evidencia` | Só dev | Escopo fechado em "prova de Won" (5 tipos fixos de evidência) — não é lifecycle, é evidência de UM evento específico (o Won). |
| `mrr_movimentos` | **Produção** (legado, alimentado por `stripe-sync.ts`, já ativo) | Já tem vocabulário de evento financeiro (`novo`\|`expansao`\|`contracao`\|`churn`\|`reativacao`), já é append-only, já é datado — mas é **escopado a impacto de MRR por definição**. Esticar seu propósito pra caber evento sem impacto financeiro (delta=0 forçado) é o erro que a v1 cometeu — mistura duas perguntas diferentes ("o que aconteceu comercialmente" vs. "quanto isso mudou a receita"). Continua sendo o ledger financeiro, papel que já desempenha hoje, intocado. |
| `clientes.statusFinanceiro` | Só dev | Não existe no ambiente-alvo. Fora de jogo pra esta fase por definição (seção 0). |

**Decisão corrigida**: nenhum candidato existente deve ser esticado. O Lifecycle Event ganha uma tabela própria, mínima, append-only, **no schema atual** (mesma restrição de ambiente da seção 0 — não é tabela V2/dev): `eventos_comerciais`. `mrr_movimentos` permanece exclusivamente o ledger financeiro. A relação entre as duas é de **projeção, não de substituição**: `Lifecycle Event → (quando houver impacto financeiro) → mrr_movimentos`.

### 2.3 O delta proposto (detalhe — implementação NÃO aplicada, só especificada)

**Tabela nova: `eventos_comerciais`** (schema atual, produção/homologação — não V2):

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid, PK | |
| `organizacao_id` | uuid, FK `organizacoes.id`, not null | Mesmo padrão multi-tenant do resto do schema. |
| `negocio_id` | uuid, FK `negocios.id`, nullable | A Oportunidade que este evento afeta. |
| `negocio_origem_id` | uuid, nullable | Mesma semântica de `negocios.negocioOrigemId` (já existente, já usado 1x em `aceitar-proposta.ts` pro clone Won→ativo — fase 2/E seção 3.3) — propaga a cadeia `Oportunidade Origem` sem vocabulário novo. |
| `contrato_id` | uuid, FK `contratos.id`, nullable | Quando o evento envolve um contrato específico. |
| `tipo` | text, not null | **Vocabulário de 1ª classe, não financeiro** — revisado (ver "Vocabulário revisado" abaixo): `ganho`\|`upgrade`\|`downgrade`\|`renovacao`\|`churn`\|`reativacao`\|`cancelamento_solicitado`\|`retencao_iniciada`\|`retido`\|`alteracao_contratual`\|`outro`. Upgrade e downgrade ficam aqui como tipos próprios — nunca reduzidos a `expansao`/`contracao` (isso só acontece na projeção financeira, ver "Cardinalidade" abaixo). |
| `zoho_id` | text, nullable | ID do registro-evento no Zoho (ex.: a Oportunidade "VETLOG \| CHURN"). |
| `confianca` | text, not null, default `'confirmado'` | `confirmado`\|`inferido`\|`ambiguo` — vocabulário já validado nas 2 fases da auditoria. Coluna direta, não depende de log externo (ver seção 5, corrigida). |
| `evidencia` | jsonb, nullable | Nota/contrato/proposta/Stage que sustenta a classificação — evidência DO evento, não um lugar pra escapar o rótulo real quando o campo `tipo` "não cabe". |
| `responsavel_id` | uuid, FK `usuarios.id`, nullable | Owner recuperado do Zoho quando mapeável a um usuário real. |
| `ocorrido_em` | timestamptz, not null | Data real do evento (regra temporal, seção 4). |
| `origem` | text, not null | `zoho_recovery` (esta fase) \| `producao_organica` (futuro, quando/se algum fluxo passar a escrever evento organicamente). |
| `created_at` | timestamptz, default now() | Momento da execução do recovery — **nunca confundido com `ocorrido_em`**. |

**Cardinalidade `eventos_comerciais` → `mrr_movimentos` (fechado nesta revisão, patch 3)**: **1:N** — um evento comercial pode gerar zero, uma ou mais linhas financeiras (ex.: um upgrade que altera 2 itens de assinatura ao mesmo tempo gera 2 linhas de `mrr_movimentos`, cada uma um delta separado do `stripe-sync.ts`/recovery). O inverso não é verdadeiro: uma linha de `mrr_movimentos` tem no máximo 1 evento comercial causador. Por isso a FK fica no lado "N" (`mrr_movimentos`), não em `eventos_comerciais` — **removida** a coluna `mrr_movimento_id` que a v1 desta seção propunha em `eventos_comerciais` (cardinalidade errada: capava o evento em 1 única projeção financeira). Em vez disso:

- `mrr_movimentos` ganha `+ evento_comercial_id uuid, FK eventos_comerciais(id), nullable` (índice simples, não único — várias linhas de `mrr_movimentos` podem apontar pro mesmo evento).
- `eventos_comerciais` não referencia `mrr_movimentos` diretamente — a consulta "quais movimentos financeiros este evento gerou" é `SELECT * FROM mrr_movimentos WHERE evento_comercial_id = :id` (zero ou mais linhas, nunca ambíguo).
- Isso **não reabre a arquitetura de `mrr_movimentos`** — é a mesma adição pontual (1 FK nullable, papel do `mrr_movimentos` continua 100% financeiro) só que corrigida de lado.

**Vocabulário revisado (patch 4)**: dois ajustes pedidos.
- **`retido` como tipo próprio, distinto de `retencao_iniciada`**: fecha o ciclo que faltava — `cancelamento_solicitado` (cliente pediu pra cancelar) → `retencao_iniciada` (time tentou reter) → resultado é **ou** `churn` (retenção falhou) **ou** `retido` (retenção funcionou, cliente ficou). Sem `retido`, o desfecho positivo da tentativa de retenção não tinha onde ser registrado como fato de primeira classe — ficaria implícito só pela ausência de um `churn` depois, o que é fraco (não é evidência positiva, é ausência de evidência negativa).
- **`reativacao` continua distinto de `ganho`, confirmado**: são semanticamente diferentes (aquisição nova vs. cliente que já tinha churnado voltando) e essa distinção já existe hoje em produção — `mrr_movimentos.tipo` já trata `novo` e `reativacao` como valores separados (schema atual, seção 0), então manter a mesma separação em `eventos_comerciais` é consistência com o que já roda, não uma decisão nova.

Vocabulário final de `eventos_comerciais.tipo`: `ganho`\|`upgrade`\|`downgrade`\|`renovacao`\|`churn`\|`reativacao`\|`cancelamento_solicitado`\|`retencao_iniciada`\|`retido`\|`alteracao_contratual`\|`outro`.

**Idempotência real** (corrige o ponto técnico #1 do Kauã): `UNIQUE INDEX ... ON eventos_comerciais (zoho_id) WHERE zoho_id IS NOT NULL` — índice único parcial (Postgres suporta nativamente), não apenas a coluna existir. Sem esse índice, `ON CONFLICT (zoho_id) DO NOTHING` não tem o que fazer conflito contra, e a operação deixa de ser idempotente de fato. O mesmo padrão de índice único parcial se aplica a toda coluna `zoho_id` nova ou pré-existente usada como chave de upsert — ver seção 6, que agora inclui isso explicitamente também para `empresas`/`leads`/`negocios`/`contratos` (nenhum dos 4 tem hoje qualquer índice em `zoho_id`, único ou não — achado adicional, mesma classe de risco que o Kauã apontou, só que já presente no schema atual, não introduzido por este ADR).

**Upgrade/Downgrade → projeção financeira** (fecha a decisão #5 do Kauã): quando um evento `tipo='upgrade'` ou `tipo='downgrade'` tem valor de MRR associado e recuperável, o recovery cria a(s) linha(s) correspondente(s) em `mrr_movimentos` (`tipo='expansao'`/`'contracao'`, vocabulário financeiro já existente, sem mudança de schema em `mrr_movimentos` além do `evento_comercial_id` da cardinalidade acima) com `evento_comercial_id` apontando de volta pro evento. O evento comercial (`eventos_comerciais`) é sempre escrito primeiro e é sempre a fonte de verdade do que aconteceu — a linha financeira é derivada dele, nunca o contrário. Eventos sem valor de MRR recuperável (a maioria dos `cancelamento_solicitado`/`retencao_iniciada`/`retido`/`renovacao`/`alteracao_contratual`, achado real da fase 2: migração pra Yeastar com delta R$0) simplesmente não geram nenhuma linha em `mrr_movimentos` — zero linhas associadas é o comportamento correto, não uma lacuna.

**O que este delta explicitamente NÃO faz** (por design, não por esquecimento): não cria uma nova Opportunity por evento pós-venda (regra explícita do Kauã, seção 2.1); não toca `negocios.status` do negócio original nunca; não introduz vocabulário de "Customer Lifecycle" (permanece decisão futura, seção 2.1); não migra `event_outbox` de função; não faz `mrr_movimentos` carregar evento sem impacto financeiro (erro corrigido nesta revisão).

---

## 3. Matriz de compatibilidade Forward Migration (Zoho → CRM atual → CRM 2.0)

| Conceito recuperado (produção) | Entidade/campo CRM 2.0 correspondente | Transformação necessária | Conflito possível com V2 |
|---|---|---|---|
| `empresas` (recuperada) | `empresas` (mesma tabela, V2 não recria Company) | Nenhuma — já é a mesma tabela nas 2 gerações. | Nenhum. |
| `leads` (recuperado, tipo=lead/contato/cliente) | `pessoas` + `clientes` (quando tipo=cliente) | `backfill-domain-model.ts`/`syncPessoaFromLead` já fazem isso, sem código novo — dedupe por e-mail já implementado. | Dedup por e-mail pode juntar 2 leads recuperados que a fase 2 já sinalizou como "mesma pessoa, 2 submissões" — **desejável**, não é bug. |
| `negocios` (aquisição recuperada) | `oportunidades` (Deal v2) | `syncOportunidadeFromNegocio`/backfill já fazem isso — nenhuma transformação nova necessária. | Nenhum — `oportunidades.stage` já espelha `negocios.status` 1:1 hoje. |
| `eventos_comerciais` (novo, seção 2.3) | **Não existe ainda em V2** | Quando F1/F4 chegar a formalizar Lifecycle Event em V2 (fora de escopo agora): projetar `eventos_comerciais.negocioId`→`oportunidades.negocioIdLegado`, `negocioOrigemId`→mesma bridge, mantendo `zohoId`/`confianca`/`evidencia`/`tipo` intactos (vocabulário próprio, não financeiro — preservado como está). Padrão idêntico ao já usado por `syncOportunidadeFromNegocio`. | Se V2 decidir por um vocabulário de `tipo` diferente do usado aqui, a transformação precisa de um mapa de tradução — registrado como risco conhecido, não bloqueante hoje. |
| `mrr_movimentos.evento_comercial_id` (novo, FK 1:N pra `eventos_comerciais`, seção 2.3) | **Não existe ainda em V2** | `mrr_movimentos` continua sendo só o ledger financeiro — projeção V2 dele é decisão independente da projeção de `eventos_comerciais`, e não precisa acontecer no mesmo momento. | Nenhum novo — mesmo papel que já desempenha hoje, só com 1 FK de rastreabilidade adicional. |
| `contratos.prazoMeses`/`multaPercentual`/`codigoLegado` (novos, seção 6) | **Não existe ainda em V2** (`contracts` é F4, não construído) | Direta quando F4 nascer — são campos escalares simples, sem ambiguidade de mapeamento. | Nenhum antecipável. |
| `contratos.assinaturaLegadoZoho` (jsonb, novo) | **Não existe ainda em V2** (`SignatureProvider`, decisão pendente #3) | Fonte de dado histórico pra popular o provider quando ele existir — sem transformação, é leitura do jsonb. | Nenhum antecipável. |
| `legacy_provenance` (`entidade_tipo='proposta'`) | **Não existe ainda em V2** (`proposals` é F4) | Direta — join por `entidade_id` no momento do backfill. | Nenhum antecipável. |
| `legacy_provenance` (`entidade_tipo='nota'`\|`'atividade'`) | `communications`/`ai_analysis` (F2, parcialmente construído) ou permanência em `notas`/`atividades` | Decisão futura de qual vence — não decidida agora, nem precisa ser. | Nenhum bloqueante — ambos os caminhos leem o mesmo dado-fonte via `legacy_provenance.entidade_id`. |
| `status_changes` (Stage History recuperado) | Nenhuma tabela V2 dedicada ainda | Leitura direta quando existir. | Nenhum. |
| `leads.utm*`/`origem` (recuperado) | `pontosContato` (Attribution V2, já construída) | Já automática via `syncPessoaFromLead`. | Nenhum — já validado em produção local do dual-write. |

**Leitura de conjunto**: a maioria das entidades recuperadas (Companies/Leads/Opportunities/Attribution) já tem caminho de projeção pro V2 **funcionando hoje**, sem nenhum código novo — só passam a carregar dado mais completo. As entidades sem correspondente V2 ainda (Contract/Proposal/Invoice/Signature/Lifecycle Event formal) são todas de fases futuras do próprio plano de reconstrução (F4 principalmente) — a recuperação de hoje não cria nada que precise ser desfeito quando essas fases chegarem, só schema aditivo esperando ser lido.

---

## 4. Regras de precedência e temporalidade (gerais, aplicam a toda dimensão da seção 1)

1. **Zoho nunca é verdade absoluta; produção nunca é verdade absoluta** (princípio já fixado desde a fase 1, reafirmado aqui).
2. **Precedência por ausência**: se o dado só existe no Zoho (gap de migração confirmado), Zoho preenche.
3. **Precedência por atividade orgânica**: se o registro tem `zoho_id` mas foi genuinamente editado depois do corte (12/06/2026) por um fluxo real da aplicação (não pelo próprio script de recovery de uma rodada anterior), a edição orgânica **nunca** é sobrescrita pelo valor Zoho — mesmo que o valor Zoho pareça "mais completo".
4. **Conflito de valores (mesmo fato, 2 respostas diferentes)**: nunca resolvido automaticamente por heurística sozinha. Fica marcado (`confianca='ambiguo'` + os 2 valores registrados em `evidencia`) para decisão humana — nunca um `UPDATE` silencioso.
5. **Regra temporal universal**: toda coluna `criado_em`/`ocorrido_em` recuperada usa a **data real do evento no Zoho**, nunca a data em que o script de recovery rodou. A data da execução do recovery fica só em log/auditoria de execução (fora das tabelas de domínio).
6. **Regra de efetivação** (direta da seção 2.1, "Cancellation Requested ≠ Churn"): nenhum evento entra como fato confirmado só com Stage nomeado — precisa de 2º sinal (nota, contrato, ou Stage de vitória real do próprio registro-evento).
7. **Regra de não-duplicação de Opportunity**: evento pós-venda nunca cria negócio novo — sempre entra em `eventos_comerciais` referenciando o negócio existente, com projeção pra `mrr_movimentos` só quando há impacto financeiro (seção 2.3).
8. **Idempotência como regra, não como QA posterior, e sustentada por constraint de banco, não só por convenção de código**: toda operação de recovery é `INSERT ... ON CONFLICT (zoho_id) DO NOTHING` (ou `UPDATE` explícito e auditado), e isso só funciona de verdade se existir um índice único (parcial, `WHERE zoho_id IS NOT NULL`) por trás — ver seção 6. Rodar o script 2x nunca duplica porque o banco impede, não porque o script promete não duplicar.

---

## 5. Estratégia de provenance

**Correção (revisão 2, ponto técnico #2 do Kauã)**: a v1 deixava confiança/evidência de várias entidades só no log de execução do recovery. Corrigido — provenance histórica não pode depender de um artefato externo ao banco (o log pode se perder, não é consultável em query, não sobrevive a quem não tem acesso ao arquivo). Toda entidade recuperada tem confiança/evidência **no banco**, via coluna direta (quando já existe um lugar natural) ou via a tabela genérica nova abaixo.

**Tabela nova: `legacy_provenance`** (schema atual) — cobre as entidades que não ganham coluna própria de confiança/evidência (empresas/leads/negocios/contratos já têm `zoho_id` nativo mas não tinham onde guardar confiança — agora ganham aqui também; propostas/notas/atividades usam esta tabela **em vez de** ganhar uma coluna `zoho_id` própria cada, simplificando o delta de schema da seção 6):

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid, PK | |
| `organizacao_id` | uuid, FK, not null | |
| `entidade_tipo` | text, not null | `empresa`\|`lead`\|`negocio`\|`contrato`\|`proposta`\|`nota`\|`atividade`\|`evento_comercial`\|... |
| `entidade_id` | uuid, not null | Aponta pra linha recuperada na tabela de domínio correspondente. |
| `zoho_id` | text, not null | Chave de idempotência do recovery — ver índice único abaixo. |
| `confianca` | text, not null, default `'confirmado'` | `confirmado`\|`inferido`\|`ambiguo`. |
| `evidencia` | jsonb, nullable | Nota/contrato/proposta/Stage que sustenta a classificação. |
| `recovered_at` | timestamptz, default now() | Momento da execução — distinto de `ocorrido_em`/`created_at` do dado de domínio. |

`UNIQUE INDEX ... ON legacy_provenance (entidade_tipo, zoho_id)` — idempotência real (mesmo padrão da seção 2.3): antes de inserir uma `notas`/`atividades`/`propostas` nova a partir de um registro Zoho, o script consulta esta tabela por `(entidade_tipo, zoho_id)`; se já existe, é update ou no-op, nunca duplicata.

Resumo do padrão por tipo de entidade:

- **Empresas/Leads/Negócios/Contratos** (já têm `zoho_id` nativo): mantêm o `zoho_id` da própria tabela pra dedupe básico (comportamento pré-existente, inalterado) **e** ganham linha em `legacy_provenance` pra confiança/evidência — resolve o gap que o Kauã apontou (essas 4 tabelas também não tinham onde guardar confiança antes desta correção).
- **Propostas/Notas/Atividades** (sem `zoho_id` nativo): usam só `legacy_provenance` — dedupe, confiança e evidência todos ali, sem precisar de coluna nova em cada tabela (simplificação em relação à v1, que pedia `zoho_id` direto nas 3).
- **`eventos_comerciais`/`status_changes`** (seção 2.3/1.10): ganham `zoho_id`/`confianca`/`evidencia` como colunas diretas mesmo assim — volume alto (milhares de linhas) e consulta frequente por evento individual justificam não depender de join com uma tabela genérica pra essas duas.
- **Owner**: `responsavelId` recuperado só quando mapeável a um `usuarios.id` real e ativo — nunca inventado, nunca atribuído a um usuário genérico "sistema" como default silencioso.

---

## 6. Lista de mudanças mínimas necessárias no CRM atual (produção/homologação)

Todas aditivas (colunas nullable, sem `NOT NULL` novo, sem alterar comportamento de nenhum código existente). Nenhuma aplicada ainda.

| # | Tabela | Mudança | Motivo |
|---|---|---|---|
| 1 | `contratos` | `+ prazo_meses integer` | Recuperar prazo contratual (61% dos contratos nativos = 36 meses). |
| 2 | `contratos` | `+ multa_percentual decimal(5,2)` | Recuperar multa (92% = 30%). |
| 3 | `contratos` | `+ codigo_legado text` | Código humano do contrato Zoho (`CT-288-05/2026`), distinto do `zoho_id` interno. |
| 4 | `contratos` | `+ assinatura_legado_zoho jsonb` | Trilha ZohoSign recuperada, separada do fluxo de aceite simples ativo. |
| 5 | (**nova tabela**) | `eventos_comerciais` (schema completo na seção 2.3) | Lifecycle Event como conceito de 1ª classe — a correção central da revisão 2. Substitui os itens #5-9 da v1 (extensão de `mrr_movimentos`, descartada). |
| 6 | (**nova tabela**) | `legacy_provenance` (schema completo na seção 5) | Confiança/evidência em coluna de banco pra toda entidade recuperada, nunca só em log. Substitui os itens #10-12 da v1 (`zoho_id` direto em `propostas`/`notas`/`atividades`). |
| 7 | `status_changes` | `+ zoho_id text`, `+ confianca text` (default `'confirmado'`), `+ evidencia jsonb` | Rastreabilidade exata de Stage History por linha (decisão fechada pelo Kauã — não esconder o ID dentro de `motivo`), com o mesmo padrão de confiança/evidência de `eventos_comerciais` — volume alto (milhares de linhas) justifica coluna direta em vez de depender de `legacy_provenance`. |
| 8 | (**nova tabela, leve**) | `anexos_legado` | Metadado de Attachments (decisão fechada: recuperar metadado **e** binário, seção 1.13). |
| 9 | Índices únicos (**retroativos**, não é feature nova) | `UNIQUE ... WHERE zoho_id IS NOT NULL` em `empresas.zoho_id`, `leads.zoho_id`, `negocios.zoho_id`, `contratos.zoho_id` | Achado ao corrigir o ponto técnico #1 do Kauã: nenhuma das 4 colunas `zoho_id` pré-existentes tem hoje qualquer índice (nem único, nem simples) — mesma classe de risco de idempotência que ele apontou nas colunas novas, só que já presente no schema atual. Pré-requisito de fato pra `ON CONFLICT (zoho_id)` funcionar em qualquer uma das 4. |
| 10 | Índices únicos (**nas tabelas novas**) | `eventos_comerciais(zoho_id) WHERE zoho_id IS NOT NULL`, `legacy_provenance(entidade_tipo, zoho_id)`, `status_changes(zoho_id) WHERE zoho_id IS NOT NULL` | Idempotência real, não assumida (seções 2.3/5). |
| 11 | `mrr_movimentos` | `+ evento_comercial_id uuid REFERENCES eventos_comerciais(id)` (nullable, índice simples — não único) | Cardinalidade 1:N `eventos_comerciais`→`mrr_movimentos` (patch 3, seção 2.3) — a única mudança de schema em `mrr_movimentos` nesta revisão, e é uma FK de rastreabilidade pontual, não uma reabertura do papel financeiro puro da tabela. |

**Convenções, não schema** (documentar, sem migration): `mrr_movimentos.origem` ganha `zoho_recovery` só para as linhas geradas por projeção de evento (seção 2.3); `faturas.origem` ganha `zoho_legado`. `mrr_movimentos.tipo` **não muda** — continua só `novo`\|`expansao`\|`contracao`\|`churn`\|`reativacao`, papel financeiro puro (correção desta revisão).

---

## 7. O que NÃO deve ser remodelado agora (preservar como está até a transformação V2)

- **Os 145 casos de "Oportunidade Origem sem token de evento"** (fase 2/A, 1.4) — natureza (upsell/downsell/neutro) não determinável por CSV puro. Ficam fora do backfill de evento até revisão manual dedicada; não promover a `alteracao_contratual` só por terem o link estrutural.
- **Downgrade/renovação com Stage=Perdido** (50%/34,6% dos casos, fase 2/A) — não promover a evento `confirmado` sem 2º sinal (regra 6, seção 4).
- **Retrodatações sem documento de origem** (Vetlog, Hospital Care, Compucenter, São Leopoldo Mandic, Swiss Park Office — 6 dos 20 casos da fase 2/B) — preservar a data como melhor estimativa disponível, marcada `inferido`, nunca reescrita como `confirmado` retroativamente.
- **`contratos.status='Cancelado'` como proxy de churn** — achado #7 fase 1: campo pouco confiável (só 2 casos em todo o módulo Zoho, e nenhum bate com um evento de churn real). Nunca usar isoladamente pra decidir `mrr_movimentos.tipo='churn'`.
- **Os 402 leads "DUPLICADO" e os 32 "CLIENTE_EXISTENTE"** dos 449 investigados na fase 2/D — não importar, ponto (regra de negócio já fechada na fase 2, reafirmada aqui).
- **`event_outbox`** — continua sendo infraestrutura de orquestração, não histórico consultável (diretriz explícita do Kauã, seção 2.2 confirma que não há razão arquitetural forte pra mudar isso agora).
- **`clientes.statusFinanceiro`/separação Contract≠Lifecycle** — fica como decisão futura, não resolvida por esta recuperação (seção 2.1).
- **`mrr_movimentos` não ganha vocabulário de evento comercial** (correção desta revisão) — permanece só ledger financeiro; o vocabulário de 1ª classe (upgrade/downgrade/churn/etc.) mora exclusivamente em `eventos_comerciais.tipo`.
- **Qualquer contrato/negócio já duplicado por `stripe_subscription_id` (os 76/38 pares)** — decisão fechada pelo Kauã: **considerar pendente até confirmação explícita**, mesmo que possa ter sido resolvido manualmente desde a fase 2. Não misturar a resolução desse bug vivo com o backfill de contrato legado; reconciliar primeiro em homologação (seção 8, agora pré-requisito bloqueante, não só recomendação).
- **Products/Contract Items** — decisão fechada pelo Kauã: auditoria dedicada é pré-requisito do dry-run (seção 8), não opcional/paralela.

---

## 8. Plano de dry-run em Homologação

**Pré-condição já satisfeita** (seção 0.1): schema homolog×produção em paridade, dados resincados nesta sessão.

**Pré-requisitos bloqueantes, antes do passo 1** (decisões fechadas pelo Kauã nesta revisão — não são mais "nice to have"):

- **Confirmar o estado real dos 76/38 pares de contrato duplicado por `stripe_subscription_id`** — tratado como pendente até prova em contrário. Se ainda existirem, reconciliar em homologação primeiro; o backfill de contrato legado não pode rodar contra um estado ambíguo (2 contratos concorrentes pro mesmo `negocio_id`).
- **Auditoria dedicada de Products/Contract Items** (seção 1.7) — não coberta pelas fases 1/2, e mexe direto com Proposta/Contrato/futuro F4. Roda como investigação própria (mesmo formato das fases 1/2) antes do dry-run, não em paralelo torcendo pra não conflitar.

Só depois dos 2 pré-requisitos resolvidos:

1. **Aplicar as mudanças de schema da seção 6 em homologação** (migration aditiva, `drizzle-kit push` ou SQL direto — reversível, colunas/tabelas nullable, zero dado existente afetado). Inclui `eventos_comerciais`, `legacy_provenance`, `status_changes.zoho_id`, `anexos_legado`, e os índices únicos retroativos nas 4 colunas `zoho_id` pré-existentes.
2. **Rodar recovery por prioridade financeira** (mesma ordem já validada nas fases 1/2): (a) Companies/Leads/Opportunities de maior valor histórico primeiro; (b) Contratos nativos + Lifecycle Events em `eventos_comerciais` com projeção pra `mrr_movimentos` quando aplicável (seção 2.3); (c) Propostas/Invoices; (d) Notes/Activities/ZohoSign; (e) Attachments — metadado + binário (seção 1.13), pode rodar como lote separado sem bloquear os demais.
3. **Cada lote roda como script direto no banco (SQL/Drizzle), nunca através das rotas de API da aplicação** — ponto crítico de segurança operacional: `PATCH /negocios/:id`, `POST /contratos`, etc. disparam `dispararAutomacoes`/notificações/webhooks. Popular histórico de 2023-2026 através desses endpoints reativaria automação (e-mail, WhatsApp, notificação de SLA) para eventos que já aconteceram há anos — repetiria em escala o próprio tipo de bug que o `ADR-EXEC-017` já corrigiu (167.582 notificações duplicadas). Recovery é sempre escrita direta, transacional, com provenance gravada no banco (seção 5) — nunca via side-effects de rota.
4. **Validar cada lote antes do próximo**: contagem esperada vs. real, spot-check manual dos casos já conhecidos (LOGITHINK, Vetlog, Ammo Varejo, Compucenter — os 20 casos da fase 2/B já têm o resultado esperado documentado, servem de teste de regressão).
5. **Testar idempotência de verdade, contra a constraint, não contra a promessa do script**: rodar o mesmo lote 2x, confirmar 0 linha nova na 2ª execução — e confirmar que o índice único (seção 6, itens 9-10) é o que está impedindo a duplicata, não só o código do script.
6. **Só com validação completa em homologação, aprovação explícita do Kauã antes de repetir em produção.**

---

## 9. Critérios objetivos de QA / Go-No-Go para produção

Só promove pra produção se **todos** os itens abaixo forem verdadeiros em homologação:

- [ ] Contagem de cada entidade recuperada bate com o esperado (documentado nas fases 1/2) — nenhuma discrepância sem explicação.
- [ ] Zero negócio com `status='ganho'` teve `status`/`ganhoAt` alterado pelo recovery (Won permanece Won, sempre).
- [ ] Zero novo negócio/contrato duplicado criado pelo processo de recovery (checar pelos índices únicos da seção 6, itens 9-10 — não por convenção, por constraint).
- [ ] 100% dos registros recuperados carregam provenance **em coluna de banco** (`eventos_comerciais`/`status_changes` direto, `legacy_provenance` pras demais — nunca só em log de execução, seção 5 corrigida).
- [ ] **Reconciliação em 2 camadas, separadas** (correção desta revisão — antes era 1 checagem só): (a) contagem de eventos por `tipo` em `eventos_comerciais` bate com o classificado nas fases 1/2 (ex.: 88 `churn`, 87 `upgrade`, 30 `downgrade`, 26 `renovacao`); (b) soma de `delta` das linhas de `mrr_movimentos` geradas por projeção bate com os totais financeiros já publicados (ex.: churn = R$ -17.715,68, confirmado 2x independentemente nas fases 1 e 2). As duas precisam bater — bater só a financeira sem bater a contagem de evento indicaria que algum evento sem impacto de MRR foi perdido no meio do caminho.
- [ ] Rodada dupla do mesmo lote não gera linha nova, **e a causa confirmada é o índice único fazendo o `ON CONFLICT` funcionar** — não só a ausência observada de duplicata.
- [ ] Nenhuma automação/notificação/webhook disparou durante o recovery (checado via ausência de linha nova em `notificacoes`/log de envio de WhatsApp/e-mail correlacionada à janela do script).
- [ ] Os 76/38 pares de contrato duplicado por Stripe confirmados resolvidos (não assumidos) **antes** de rodar o backfill de contrato legado.
- [ ] Auditoria dedicada de Products/Contract Items concluída **antes** do dry-run (pré-requisito, seção 8).
- [ ] Revisão humana explícita de cada caso listado na seção 7 ("o que NÃO deve ser remodelado") — confirmando que nenhum foi promovido a fato automaticamente.
- [ ] Kauã revisou e aprovou explicitamente o relatório de homologação antes de qualquer escrita em produção.

---

## 10. Impacto em `refresh-dev-db` + backfill do Domain Model CRM 2.0

Sequência completa do Kauã (fora de escopo desta fase, documentado aqui só pelo impacto):

```
produção consolidada (pós-recovery)
  → refresh do banco DEV (refresh-dev-db.sh, pg_dump prod → restore dev)
  → reaplicação do schema CRM 2.0 (drizzle-kit push, tabelas F0-F7 por cima)
  → backfills/sync do Domain Model V2 (backfill-domain-model.ts)
  → validação
  → continuação da reconstrução CRM 2.0
```

**O que já funciona sem mudança nenhuma**: `refresh-dev-db.sh` pega qualquer coisa que exista em produção — as mudanças de schema da seção 6 chegam em dev automaticamente no próximo refresh, sem script novo. `backfill-domain-model.ts` já lê `leads`/`negocios` por completo (não filtra por `zoho_id`) — qualquer Company/Lead/Opportunity recuperada entra na próxima rodada de backfill sem alteração de código.

**O que vai precisar de trabalho novo, fora de escopo agora, mas identificado**: nenhum backfill hoje projeta `eventos_comerciais` (seção 2.3) para dentro do Domain Model V2, porque V2 ainda não tem um conceito de Lifecycle Event pra receber essa projeção (seção 2.2 — é decisão de F1/F4, não desta fase). Quando esse conceito V2 existir, `backfill-domain-model.ts` ganha uma nova função (mesmo padrão de `syncOportunidadeFromNegocio`) que lê `eventos_comerciais.negocioId`/`negocioOrigemId` e projeta pro schema V2 via as bridges que já existem (`oportunidades.negocioIdLegado`) — preservando `tipo` como vocabulário próprio, não financeiro. A projeção pra `mrr_movimentos` (quando existir equivalente V2) é um backfill independente, no seu próprio ritmo. **Efeito colateral positivo já garantido, sem trabalho extra**: como o recovery de Stage History (seção 1.10) popula `status_changes` com dados reais, a lógica já existente de `perdidoAt` em `backfill-domain-model.ts`/`sync-domain-model.ts` (que busca a transição mais recente pra "perdido" em `status_changes`) fica automaticamente mais precisa pra negócios históricos perdidos, sem qualquer alteração de código.

---

## Decisões fechadas pelo Kauã (11/08, revisão 2) — não são mais perguntas abertas

1. **Attachments** (seção 1.13/6): metadado **e** upload físico dos binários. Pode rodar em lote separado, mas o legado só é considerado 100% recuperado com os 1.980 arquivos preservados e verificáveis.
2. **Products/Contract Items** (seção 1.7): auditoria dedicada **antes** do dry-run — vira pré-requisito bloqueante (seção 8), não investigação em paralelo.
3. **76/38 pares de contrato duplicado por Stripe**: tratados como **pendentes** até confirmação explícita — pré-requisito bloqueante do dry-run (seção 8), reconciliar primeiro em homologação.
4. **`status_changes.zoho_id`**: sim, coluna direta — rastreabilidade exata por linha, não escondida em `motivo` (aplicado seção 1.10/6).
5. **Upgrade/Downgrade**: tipos próprios de 1ª classe em `eventos_comerciais.tipo` — nunca perdem identidade. Financeiramente, projetam pra `expansao`/`contracao` em `mrr_movimentos` só quando há impacto de MRR recuperável, sem substituir o evento original (seção 2.3).

---

## Fontes

- Fase 1: `docs/reconstruction/auditoria-legado-zoho/00-SINTESE-CONSOLIDADA.md` + 6 relatórios.
- Fase 2: `docs/reconstruction/auditoria-legado-zoho/fase2-semantica-temporal/00-SINTESE-FASE2.md` + 5 relatórios (A-E).
- Arquitetura CRM 2.0: `ARCHITECTURE_DECISIONS.md`, `vault-referencia/PLANO-RECONSTRUCAO-CRM2.md`, `crm2-decisoes-pendentes.md`, `IMPLEMENTATION_PROGRESS.md`.
- Código lido integralmente: `app/src/lib/db/schema.ts` (tabelas `empresas`, `leads`, `negocios`, `contratos`, `assinaturas`, `faturas`, `mrrMovimentos`, `propostas`, `propostaItens`, `notas`, `atividades`, `statusChanges`, `auditLog`, `pessoas`, `pontosContato`, `oportunidades`, `clientes`, `comercialEvidencia`, `wonEvidencePolicies`, `eventOutbox`, `customFields`), `app/src/lib/crm/sync-domain-model.ts`, `app/src/lib/db/backfill-domain-model.ts`.
- Guardrail de paridade homolog×produção: verificado nesta sessão (comparação de schema + resync de dados, 11/08/2026).
