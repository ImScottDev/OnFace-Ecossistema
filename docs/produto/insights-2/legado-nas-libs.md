# Legado nas libs: leituras de `leads` / `negocios` / `contatos`

Varredura de `app/src/lib/`, `app/src/api-server/`, `app/src/worker/` e `packages/`. Só leitura; nada foi alterado.
Banco consultado: `callface_crm` local (cópia de produção, dados até ~12/10/2026). "Frescor" compara a coluna legada com a canônica nesse retrato.

Universo: ~784 leituras de tabela legada (FROM/JOIN/`.from()`) em ~170 arquivos (lib 487 em 132 arquivos, api-server 282 em 37, worker 15, packages 4). A grande maioria é (A): `negocios` continua em dual-write fiel (etapa, responsável, ganho_at com 0 divergências contra `oportunidades`; valor 2 e MRR 27 de 1.645) e `leads.estagio_pre_vendas` bate 100% com `aquisicoes.etapa_id` (0 divergências). Os achados abaixo são o resíduo perigoso: leituras de colunas que o canônico passou a governar, ou que o legado nunca preencheu.

## 1. Colunas legadas mortas ou ralas (a prova)

| Coluna legada | Estado medido | Canônico equivalente |
|---|---|---|
| `leads.status` | `novo` em 4.254 de 4.254 | `aquisicoes.etapa_id` → `pipeline_etapas.codigo` (e `leads.estagio_pre_vendas`, que anda) |
| `leads.crm2_pre_vendas_stage` e `crm2_*` | 4.254 de 4.254 nulos | idem (já sem leitores: só schema/comentário) |
| `contatos.lead_id` | 26 de 2.047 (1,3%) | casamento por telefone com `pessoas`/`leads` (`leadPorTelefone`) |
| `whatsapp_mensagens.lead_id` | 1.150 de 35.045 (3,3%); só 113 das 16.143 recebidas (0,7%) | `communications.pessoa_id` (23.905 de 35.045 no WhatsApp, 68%) |
| `emails.lead_id` | 1.245 de 11.176 (11%) | `communications.pessoa_id` (2.179 de 6.933 e-mails) |
| `leads.negocio_ativo_id` | 82 preenchidos; 235 leads têm negócio aberto (faltam 153, 65%) | `oportunidades` abertas via `pessoas.lead_id_legado` |
| `leads.whatsapp_ultima_msg_at` | 19 de 4.254 | `contatos.ultima_msg_at` por telefone |
| `negocios.proxima_acao` / `proxima_acao_em` | 0 de 1.645 | `tarefas` abertas por `negocio_id` (53 hoje) |
| `negocios.previsao_fechamento` (e `oportunidades.previsao_fechamento`) | 0 de 1.645 / 0 de 1.654 | sem equivalente; coluna morta nos dois lados |
| `leads.tipo` | só 12 de 130 leads com contrato ativo estão `cliente` (117 estão `contato`); 119 `cliente` sem negócio ganho | `lib/vendas/classificacao.ts` (`classificarLeads`) |
| `leads.responsavel_id` | 70 divergem de `aquisicoes.responsavel_id` (59 com os dois preenchidos; em todos o canônico é o mais novo) | `aquisicoes.responsavel_id` |
| `leads.convertido_at`, `contrato_*`, `nps_score`, `proximo_nps`, `valor_total`, `mrr_estimado`, `valor_setup` | 0 de 4.254 (`mrr_fechado`: 1) | `negocios`/`oportunidades`, `clientes`, `contratos` |
| `leads.cliente_desde` | 137 contra 436 leads com negócio ganho | `clientes.cliente_desde` |

Observação de contexto: `contatos` aqui é a conversa de WhatsApp (uma por sessão+telefone), não a pessoa. O casamento automático para conversa nova (`lead-da-conversa.ts`) existe desde 14/10 e a medição do próprio arquivo (2.024 de 2.683 sem lead) mostra que o passivo vem do histórico; o retrato local ainda não foi religado (`scripts/religar-conversa-ao-lead.ts`).

## 2. Tabela de leituras (arquivo:linha · o que lê · classe · evidência)

### (B) Bug silencioso

| arquivo:linha | o que lê | cl. | evidência |
|---|---|---|---|
| `lib/cadencia/cadence-engine.ts:997,1004` | `leads.status` vira a variável `status` das condições de cadência | B | 4.254/4.254 = `novo`; condição "status = X" nunca muda |
| `lib/metricas/catalogo.ts:512` | `l.status` na métrica de leads (dimensão "Status", ordenável) | B | tudo `novo`: a dimensão tem 1 só valor |
| `api-server/routes/leads.ts:279` | filtro `?status=` em `leads.status` | B | filtro devolve 4.254 ou 0 |
| `api-server/routes/leads.ts:1089` | lê `leads.status` para decidir se grava `status_changes` | B | idem |
| `api-server/routes/whatsapp.ts:381,444,471,567`, `email.ts:205` | `leadStatus` na lista de conversas/e-mails | B | sempre `novo` |
| `worker/index.ts:1899,2066`; `lib/ai-platform/contexto/builder.ts:129` | `lead.status` entregue ao contexto do agente de IA | B | o agente "vê" todo lead como `novo` |
| `lib/cadencia/cadence-engine.ts:384,395,426` | conversa do lead por `contatos.lead_id` | B | 1,3% ligadas |
| `lib/cadencia/cadence-engine.ts:389` | cria `contatos` sem `ON CONFLICT` quando não acha pelo `lead_id` | B | índice único `idx_contatos_sessao_phone`: lead cuja conversa existe sem vínculo estoura (ou duplica a thread) |
| `worker/index.ts:2533,2546,2571,2617,2627` | mensagem recebida só atualiza lead, cadência, prospecção e atividade `if (contato.leadId)`; `pessoa_id` da `communications` sai de `contato.leadId` | B | 98,7% das conversas sem lead: não registra resposta em cadência, não sobe `whatsapp_ultima_msg*`, não cria atividade, `communications.pessoa_id` nulo |
| `lib/atendimento/garantir-conversa.ts:22` | "já tem conversa?" por `contatos.lead_id` | B | conversa sem vínculo não é vista como existente (o upsert depois adota) |
| `lib/automacoes/contexto.ts:139` | contato do lead por `contatos.lead_id` | B | automação sem telefone/nome da conversa |
| `lib/ai-platform/contexto/builder.ts:276` | contexto da IA pega conversa por `c.lead_id` | B | idem |
| `api-server/routes/atendimento.ts:214,240-248` | filtro e junção do inbox por `contatos.lead_id` | B | filtro por lead acha 26 conversas; o resto só por telefone (há remendo em 266/573) |
| `api-server/routes/leads.ts:282,283,346,347` | `whatsappNaoLidas`, `whatsappUltimaMsgAt` (filtro "com WhatsApp", ordenação) | B | 19 de 4.254 populados |
| `lib/vendas/consultas.ts:716` | `ultima_interacao` do negócio: `max(whatsapp_mensagens.created_at) WHERE m.lead_id = n.lead_id` | B | 3,3% das mensagens têm `lead_id` |
| `lib/vendas/prospeccao-detalhe.ts:199` | mensagens do lead por `whatsapp_mensagens.lead_id` | B | idem |
| `api-server/routes/fulfillments.ts:488` | mensagens do cliente por `whatsappMensagens.leadId` | B | idem |
| `api-server/routes/whatsapp.ts:692` | histórico do lead por `whatsappMensagens.leadId` | B | idem |
| `api-server/routes/relatorios.ts:531` | relatório do dia do usuário: mensagens enviadas ligadas a lead | B | só 1.037 das 18.902 enviadas têm `lead_id` |
| `api-server/routes/email.ts:76-208`, `atendimento.ts:631-658` | e-mails do lead por `emails.lead_id` | B | 11% |
| `lib/analytics/command-center.ts:178,181` | "leads com negócio ativo" = `negocio_ativo_id IS NOT NULL` | B | 82 contra 235 reais |
| `api-server/routes/relatorios.ts:944,970` | qualificados por campanha: `sdr_status='qualified' OR negocio_ativo_id NOT NULL` | B | metade do OR é a coluna rala |
| `api-server/routes/whatsapp.ts:383-391,446-454,569-580,228-247`; `lib/whatsapp/enviar.ts:296`; `api-server/routes/notas.ts:92` | negócio da conversa/nota via `leads.negocio_ativo_id` | B | 65% dos leads com negócio aberto ficam sem negócio na conversa e a nota não chega ao negócio |
| `lib/relatorios/fechamento-comercial.ts:329-347` | negócio do lead no fechamento via `negocio_ativo_id` | B | idem |
| `lib/inicio/consultas.ts:777` | "sem próxima ação do closer": `NOT EXISTS negocios.proxima_acao IS NOT NULL` | B | coluna 0/1.645: o filtro nunca exclui; toda oportunidade aberta conta como "sem próxima ação", inclusive as com tarefa |
| `packages/domain/sales/queries/board-pipeline.ts:92` | filtro "sem próxima ação" do board do Pipeline, mesma coluna | B | o filtro não filtra |
| `lib/atendimento/contexto.ts:50`, `api-server/routes/pipeline-crm2.ts:63`, `lib/nexo/ferramentas.ts:220`, `api-server/routes/negocios.ts:209` | `previsao_fechamento` | B | 0 linhas preenchidas; sempre vazio |
| `lib/analytics/command-center.ts:170-181,351`, `lib/analytics/inicio.ts:349`, `api-server/routes/atendimento.ts:170,838,967`, `api-server/routes/leads.ts:258-276` | recortes por `leads.tipo` (`'lead'`, `'cliente'`) | B | 12 de 130 leads com contrato ativo estão `cliente`; viola a regra de `classificacao.ts` ("única função que decide a classe") |
| `api-server/routes/contatos-crm2.ts:19-30,142-144` | classe da pessoa montada em cima de `l.tipo` | B | idem |
| `lib/relatorios/sdr-visoes.ts:196-203` | `last_contact_at` como recência do lead | B (leve) | só 791 de 4.254 preenchidos, último 09/10; a canônica `aquisicoes.last_touch_at` cobre 4.190 |
| `lib/nexo/ferramentas.ts:203` etc., `lib/atendimento/tela.ts`, `lib/contatos/tela-contatos.ts:156` | `leads.responsavel_id` | B (leve) | 59 leads com responsável diferente do canônico |

### (C) Fácil de migrar

| arquivo:linha | o que lê | canônico | cobertura |
|---|---|---|---|
| `lib/analytics/onface-inicio.ts:108,584`, `lib/analytics/inicio.ts` (contagem de leads) | `COUNT(*) FROM leads` por `created_at` | `aquisicoes` (`created_at`) | 4.190 de 4.254 (66 leads sem aquisição) |
| `lib/analytics/onface-inicio.ts:184` e `lib/analytics/inicio.ts:347-352` | `leads.sdr_status='pending'` + `tipo='lead'` | `aquisicoes` por etapa `novo` | 100% de concordância de etapa (0 divergências) |
| `lib/relatorios/gestao-operacional.ts:92-94`, `sdr-visoes.ts:95-225` | `EXISTS negocios WHERE lead_id=l.id` | `oportunidades` por `pessoa_id` | 1.581 de 1.654 com `pessoa_id` |
| `lib/nexo/ferramentas.ts:308-309` | busca em `leads`/`negocios` | `aquisicoes`/`oportunidades` | idem |
| `lib/automacoes/execucoes.ts:252-254`, `fluxos-servico.ts:260-263,468-471` | rótulo/nome da entidade | `pessoas`/`oportunidades` | 4.265/4.265 e 1.654/1.645 |
| `lib/relatorios/comercial.ts:265-505` | `negocios` por status/etapa | `oportunidades` (`etapa`, `ganho_at`, `perdido_at`) | 0 divergências |
| `lib/crm/notificar.ts:29-35,118,193,222-226` | nome/empresa do lead | `pessoas` | 100% |

Fora do que dá para trocar já: valores financeiros (`mrr_fechado`, `valor_setup`, `valor_total`, `tipo_receita` em `receita-fechada*.ts`, `performance.ts`, `fechamento-comercial.ts`, `midia-paga.ts`, `onface-inicio.ts`) só existem no legado (`oportunidades` tem `mrr`, `valor` e `setup_estimado` com 24). Ficam (A); 22 negócios ganhos divergem em MRR (R$ 1,5 mil).

### (A) Legítimas (resumo)

| Grupo | Arquivos | Por quê |
|---|---|---|
| Portas de venda | `lib/vendas/*` (consultas, pre-vendas, pipeline, sincronizar-aquisicao, prospeccao, eventos, sla-lead), `packages/domain/*` | dual-write é a ponte; leem `aquisicoes JOIN leads lg ON lg.id = a.lead_legado_id` |
| Relatórios de funil | `funil-leads.ts` (já tem `PONTE_CONTATO` com telefone e etapa canônica), `funil-eventos.ts`, `esteira-sdr.ts`, `canais.ts`, `qualidade-dados.ts`, `receita-fechada*.ts`, `fechamento-comercial.ts`, `midia-paga.ts`, `performance.ts` | `status_changes` segue escrito pela porta única (`registrarMudancaDeEtapa`); negócio em sincronia |
| CS, Clientes, Financeiro | `lib/cs/*`, `lib/clientes/*`, `lib/financeiro/*` | já nascem de `clientes`/`contratos`/`faturas`; o `leads` entra só como ponte de `empresa_id`/`lead_id` |
| Tabelas filhas por `lead_id` | `atividades` 14.870/14.958, `tarefas` 358/360, `notas` 4.726/5.381, `reunioes` 324/343, `propostas` 1.596/1.596, `contratos` 446/446, `faturas` 1.101/1.111 | ainda ligadas ao lead; não há coluna canônica equivalente |
| Captação e escrita | `lib/captacao/*`, `lib/crm/*` (won-evidence, converter-oportunidade), `api-server/routes/leads.ts` e `negocios.ts` | escrita no legado é o dual-write esperado |

## 3. Bugs silenciosos (só os B, ordenados por gravidade)

1. **A resposta do cliente no WhatsApp não encontra o lead.** `contatos.lead_id` preenchido em 26 de 2.047 (1,3%); `whatsapp_mensagens.lead_id` em 113 das 16.143 recebidas (0,7%).
   - Consumidores: `worker/index.ts:2533-2651`, `cadence-engine.ts`, `vendas/consultas.ts:716`, `prospeccao-detalhe.ts:199`, `fulfillments.ts:488`, `whatsapp.ts:692`, `relatorios.ts:531`, `atendimento.ts`.
   - O usuário vê: "quem respondeu" quase vazio; cadência que não reconhece a resposta e continua cobrando; ficha do lead sem a conversa; "última interação" do negócio ignorando o WhatsApp; atividade "Troca de mensagens" não criada; `communications.pessoa_id` nulo nas mensagens novas (o worker deriva a pessoa de `contato.leadId`).
2. **Cadência que cria conversa duplicada ou quebra.** `cadence-engine.ts:389` insere em `contatos` sem `ON CONFLICT` quando não acha conversa pelo `lead_id`; com o índice único (sessão, telefone), o passo falha para lead cuja conversa já existe sem vínculo (a maioria, ~635 leads casam por telefone). `garantir-conversa.ts` já trata com upsert; este ponto ficou de fora.
3. **`leads.negocio_ativo_id`: 82 contra 235 leads com negócio aberto.** Consumidores: Command Center (funil de leads), relatório de mídia paga por campanha, conversa do WhatsApp (título do negócio), nota (`notas.ts:92` não atualiza o negócio), fechamento comercial. O usuário vê leads "sem negócio" que têm negócio e métricas de qualificação por campanha 65% menores nessa metade.
4. **`leads.status` congelado em `novo`** (4.254/4.254). Consumidores: variável `status` das condições de cadência, contexto do agente de IA, lista de conversas e e-mails, filtro `?status=` da API, dimensão "Status" do catálogo de métricas. O usuário vê toda conversa marcada "novo", filtro por status inútil, e regras de cadência por status que nunca disparam.
5. **"Sem próxima ação" nunca exclui ninguém** (`negocios.proxima_acao` 0/1.645): `lib/inicio/consultas.ts:777` (card do closer no Início) e `packages/domain/sales/queries/board-pipeline.ts:92` (filtro do board). O usuário vê toda oportunidade aberta como sem próxima ação, mesmo com tarefa aberta (53 negócios têm).
6. **`leads.tipo` desatualizado como classificador.** Só 12 de 130 leads com contrato ativo constam como `cliente`; 117 estão `contato`. Command Center, Início, Atendimento e Contatos CRM2 filtram por `tipo` e contradizem a classificação oficial.
7. **`previsao_fechamento`**: coluna vazia nos dois lados, exibida em atendimento, NEXO e Pipeline como se existisse.
8. **`leads.responsavel_id`**: 59 leads com responsável diferente do canônico (todos com `aquisicoes` mais nova): quem reatribuiu pelo canônico não aparece na ficha e nas listas do NEXO.

Ressalva: a causa do 1 e do 2 é histórico sem religar (o casamento por telefone de conversa nova já existe); o retrato local não foi religado, então confirme o número em produção antes de priorizar o backfill.

## 4. Migração fácil (C)

Ver tabela da seção 2. Em todas o canônico tem a mesma cobertura medida (aquisições 4.190/4.254 leads; oportunidades 1.654/1.645 negócios; pessoas 4.265/4.254). Ganho pequeno de risco; o benefício maior vem de corrigir os B acima.

Correção de maior retorno por causa compartilhada (padrão único): uma resolução de "conversa -> pessoa/lead" por telefone numa função só, usada pelo worker, cadência, atendimento e relatórios; e `negocio_ativo_id` substituído por consulta à oportunidade aberta da pessoa.

## 5. Resumo

| Classe | Leituras (aprox.) |
|---|---|
| A (legítima) | ~700 |
| B (bug silencioso) | ~60 em 25 arquivos (8 problemas distintos) |
| C (fácil de migrar) | ~25 |

(Contagem por linha de código; os B estão listados inteiros na seção 2.)
