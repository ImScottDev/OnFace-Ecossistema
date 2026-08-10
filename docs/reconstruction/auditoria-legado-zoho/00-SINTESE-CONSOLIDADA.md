# Auditoria Forense Zoho ↔ Migração ↔ CRM Atual — Síntese Consolidada

> Consolidação das 6 frentes paralelas de investigação (10/08/2026). **Nada foi alterado em nenhum momento** — nem arquivo do backup Zoho, nem linha do banco (só `SELECT`). Todos os números abaixo vêm dos 6 relatórios-fonte, listados no fim. Onde há inferência (não é ID batendo com ID), o nível de confiança está explícito — nada aqui é apresentado como certeza absoluta sem dizer o quão certo é.
>
> Regra seguida em toda a síntese: **Zoho não é a verdade absoluta, CRM atual não é a verdade absoluta.** Cada achado foi classificado por período (antes/depois do corte de 12/06/2026) e por fonte, pra não sobrescrever os ~2 meses de dado real que o CRM já gerou sozinho.

---

## 0. Sumário executivo

| Nº | Achado | Escala | Confiança |
|---|---|---|---|
| 1 | Contratos nativos do Zoho (prazo real, multa de 30%, código do contrato) ausentes do CRM | **277 de 279 (99,3%)** | Alta |
| 2 | Negócios "ganho" no CRM que na verdade já sofreram churn/downgrade/upgrade/renovação documentado no Zoho depois do "ganho" | **121 negócios**, incl. **45 só de churn = R$64.387/mês (14,4% de todo o MRR "ganho")** | Alta |
| 3 | Pipeline PT-BR inteiro do Zoho (Concluído/Perdido/Contrato/Nutrição/Delivery/Faturamento...) migrado em 0-3% dos casos | **516 oportunidades, ~R$957 mil em valor histórico** | Média (efeito claro, mecanismo do script não inspecionado) |
| 4 | Oportunidades do Zoho sem nenhum negócio correspondente no CRM | **512 de 1.551 (33%)** | Alta |
| 5 | Histórico de interação com cliente (notas visíveis no produto, reuniões, ligações, itens de proposta) com zero linha antes de jul/2026 | **100% dessas 4 tabelas** | Alta |
| 6 | Histórico de status/dono de LEAD (Zoho) sem qualquer equivalente hoje — `audit_log` existe no schema mas nunca foi ligado | **5.346 linhas Zoho, 0 preservadas** | Alta |
| 7 | Trilha de assinatura eletrônica (ZohoSign) sem lugar pra existir no schema atual | **368 documentos, 178 assinados, 0 recuperável mesmo tentando digitar de volta** | Alta |
| 8 | Leads novos continuaram entrando no Zoho **depois** do corte de 12/06 e nunca chegaram ao CRM | **449 leads (46% do módulo), 100% criados jul/ago 2026, 436 nunca trabalhados** | Alta — **é o único achado que é bug vivo, não arqueologia** |
| 9 | Contratos/contatos no CRM: 100% sem `zoho_id`, 100% criados jul-ago/2026 — sem religação nenhuma ao histórico | 319 contratos + 1.001 "contatos" (que na verdade é tabela de canal de conversa, não pessoa) | Alta |
| 10 | Pipeline de Stage duplicado PT/EN nunca normalizado ("Closed Won" vs "Concluído/Ganho") em Oportunidades E Propostas | Anos de dado, qualquer win-rate histórico direto na coluna está errado | Alta |
| 11 | Campo `Recorrência` (base de MRR) é texto livre, 8+ grafias do mesmo valor | Setup_C + Itens Cotados, 2.440 linhas | Alta |
| 12 | Anexos e notas majoritariamente presos ao módulo ZohoSign, não direto ao Deal — explica boa parte do "por que a migração perdeu tanto" | 57,9% dos 1.980 anexos, 35% das 4.560 notas | Alta |
| 13 | LGPD: nome de arquivo com CPF em texto puro num anexo | 1 caso confirmado, não quantificado a fundo | Ponto de atenção, não investigação exaustiva |

**A leitura mais importante do conjunto**: isto não é "a migração esqueceu alguns campos". É que **duas cópias inteiras da história comercial da Callface — a jornada de estágio, a trilha de assinatura, os termos contratuais, as notas de relacionamento — nunca tiveram uma casa no CRM novo**, seja porque o script de migração usou um filtro que excluiu um pipeline inteiro (achado #3), seja porque a estrutura de dado atual simplesmente não tem coluna pra guardar aquilo (achados #6 e #7). Ao mesmo tempo, boa parte do que existe hoje no CRM é dado novo, real e correto, gerado organicamente nos últimos 2 meses — **isso precisa ser preservado, não sobrescrito** por qualquer reimportação futura.

---

## 1-2. Inventário completo (Zoho / CRM atual)

Relatórios completos: [`01-inventario-zoho.md`](./01-inventario-zoho.md) (34 módulos, 1.980 anexos classificados) e [`02-inventario-crm-atual.md`](./02-inventario-crm-atual.md) (70 tabelas, separação por `zoho_id` e por `created_at`).

Pontos que merecem estar aqui na síntese:

- **28 das 70 tabelas do CRM 2.0 ainda estão vazias** — incluindo `oportunidades` e `pessoas`, que aparentam ser os substitutos pretendidos de `negocios`/`contatos` no modelo novo. A migração de dado real pra esse schema novo ainda não aconteceu.
- **`tarefas` tem 29.126 linhas, 29.082 criadas num único mês (julho/2026)** — quase certamente geração automática em massa (cadência/automação), não atividade manual. Não usar esse número como indicador de esforço comercial sem investigar a origem.
- **77 campos customizados do Zoho vivem em módulos de automação de qualificação de lead** (`Qualify Leads through Email/Call`), não em módulos de dado — essa lógica não está em nenhum CSV, só seria recuperável via API do Zoho (se ainda ativa) ou reconstrução manual pela memória do time.

---

## 3. Mapa de entidades — Zoho módulo → CRM tabela

| Módulo Zoho | Registros reais | Tabela CRM | Status da correspondência |
|---|---|---|---|
| Leads | 971 | `leads` (tipo='lead') | 565 com zoho_id; 449 (46%) nunca chegaram, todos pós-corte |
| Contacts | 2.267 | `leads` (tipo='contato') — **não é a tabela `contatos`** | 1.797 com zoho_id |
| Accounts (Empresas) | 1.102 | `empresas` | 944 com zoho_id |
| Deals (Oportunidades) | 1.551 | `negocios` | 1.039 com zoho_id; 512 (33%) sem correspondência |
| Quotes (Propostas) | 1.067 | `propostas` (sem zoho_id, match por valor+data) | 591 match forte; 44% "sem equivalente", 96% desse gap é upstream (negócio ausente) |
| SalesOrders (Contratos nativo) | 279 | `contratos` | **277 (99,3%) ausentes**, mesmo quando o negócio existe |
| Invoices | 123 (R$74k, fev/24–jun/25) | `faturas` | 0 — nenhuma fatura pré-migração em qualquer origem |
| QuotedItems | 1.876 | `proposta_itens` | Granularidade preservada onde a proposta migrou (96,6%) |
| Stage History (DealHistory) | 6.429 (1.551 deals) | `status_changes` | 72% preservado nos 1.039 negócios que sobreviveram; 2.439 transições 100% inacessíveis (negócio-pai não existe) |
| Situação de Lead Histórico + Responsabilidade Histórico | 5.346 | — | **Nenhum equivalente.** `audit_log` existe, 0 linhas |
| Notes | 4.560 | `notas` (0%) / `atividades` (parcial) | `notas`=0% confirmado por conteúdo; `atividades` recuperou parte das notes de Potentials/Leads, mas na tabela errada pra UI mostrar |
| ZohoSign Documents/Recipients/Events | 368 / 1.257 / 547 | `contratos.assinatura_status` etc (schema existe) | 0 de 319 contratos preenchidos — gap estrutural, não sync incompleto |
| Calls / Meetings / Tasks / Emails | 414 / 382 / 510 / 177 | `ligacoes` / `reunioes` / `tarefas` / `emails` | 0 linhas migradas nas 4 — tudo que existe é atividade nova pós-corte |
| ConvertedLeadRecords | 481 | (log de conversão) | Account/Contact 96,5% preservados; Potential (negócio) 77,8%, ~41 negócios residual de perda real |
| Products | 274 | `servicos_catalogo` | Não comparado nesta rodada (fora do escopo das 6 frentes) |
| Campaigns | 1 | `campanhas` | Módulo nunca adotado no Zoho, não é perda |

---

## 4-9. Comparação, perdas, dados novos, conflitos, duplicidades, órfãos

### 4-5. O que existe no Zoho e não existe no CRM (perda de migração confirmada)

Por severidade (do pior pro menos grave):

1. **Contratos nativos** (99,3% ausentes) — prazo de 36 meses (61% dos casos) e multa de 30% (92% dos casos) que hoje não constam em lugar nenhum estruturado do CRM. [`04`]
2. **Trilha de assinatura eletrônica** (ZohoSign, 368 docs/178 assinados) — gap estrutural, não existe onde guardar isso hoje mesmo que quiséssemos digitar de volta. [`06`]
3. **Histórico de status/dono de lead** (5.346 linhas) — 100% perdido, `audit_log` nunca ligado. [`06`]
4. **Jornada de estágio de negócio** (Stage History) — 72% preservado só nos negócios que sobreviveram; 2.439 transições de 512 negócios extintos são inacessíveis por construção. [`06`]
5. **Faturamento histórico pré-migração** (123 faturas, R$74k, fev/24–jun/25) — 0% presente sob qualquer origem. [`04`]
6. **Notas visíveis no produto** — 0% (a tabela que o vendedor abre no dia a dia nunca recebeu conteúdo Zoho; o que migrou foi pra `atividades`, tabela diferente). [`06`]
7. **Calls/Meetings/Tasks/Emails históricos** — 0% migrado nas 4 tabelas correspondentes. [`06`]
8. **516 oportunidades de um pipeline PT-BR inteiro** (~R$957 mil) — migradas em 0-3%. [`03`]

### 6. Dados novos no CRM (preservar, nunca sobrescrever)

- `empresas`: 292 genuinamente novas pós-corte (crescimento orgânico).
- `leads`: 570 novos pós-corte, majoritariamente Mídia Paga (356).
- `negocios`: 65 nativos (sem zoho_id).
- **Todo o conteúdo de `notas`, `reunioes`, `ligacoes`, `tarefas` reais (não as 29.082 automáticas), `emails`** — é atividade real do time nos últimos 2 meses, roda por integração própria (Callface/Asterisk, Outlook/M365), não tem nada a ver com Zoho e não deve ser tocado por qualquer reprocessamento.

### 7. Dados conflitantes (Zoho diz uma coisa, CRM diz outra)

- **121 negócios** com evento pós-venda documentado no Zoho (churn/upgrade/downgrade/renovação/migração) continuam `status='ganho'` no CRM, sem nenhum status que reflita o que aconteceu depois — 97,5% de consistência cronológica (evento é posterior ao `ganho_at`), ou seja, é causal, não ruído. [`03`]
- **52 negócios "Closed Won" no Zoho estão como `status='ativo'`** no CRM (não `ganho`) — pode ser categorização proposital de pós-venda ou o mesmo problema do item acima. Confiança média, precisa de contexto de quem fez essa categorização. [`03`]
- **Contrato "Assinado" no Zoho (27 registros) muito abaixo do ZohoSign "Signed" (178)** — o campo manual de status do contrato nunca refletiu a assinatura real. [`01`]

### 8. Duplicidades

**Dentro do próprio Zoho** (não é problema de migração, é herança):
- Empresas com CNPJ idêntico: **5 grupos, 10 linhas**, a maioria claramente a mesma empresa grafada diferente (rebranding/sigla). Confiança alta que é duplicidade real; decisão de merge é do Kauã. [`05`]
- Contatos com telefone duplicado: **85 grupos, 182 linhas** — mas é mistura de (a) dado de teste/lixo ("Mussum Trapalhão", "Pedro teste"), (b) telefone corporativo compartilhado legitimamente, (c) duplicidade real. **Não tratar como 85 duplicidades reais** sem triagem manual por grupo. [`05`]
- E-mail duplicado: **0 casos**. [`05`]
- Oportunidades duplicadas por erro operacional: **praticamente inexistente** (3-5 pares, todos explicados por revendedores multi-unidade como FACILITA/MAIS TEC fechando várias filiais). A hipótese de "duplicata por erro de digitação" **não se sustenta nos dados**. [`03`]

**No CRM atual**:
- Empresas com CNPJ duplicado: 6 grupos, 12 linhas. Nome duplicado: 3 grupos, 6 linhas.
- Leads com telefone duplicado: 91 grupos, 196 linhas (incluindo o placeholder óbvio `11000000000`, 4x — filtrar antes de qualquer dedup).
- **49,3% das empresas no CRM não têm CNPJ e 31,9% dos leads não têm telefone** — isso mascara duplicidade real que não dá pra detectar sem esse dado. [`02`]

### 9. Órfãos

- No CRM: 455 propostas (36,7%) sem `negocio_id`; 241 contratos (75,5%) sem `negocio_id`. [`02`]
- No Zoho: 437 oportunidades (28,2%) sem contato vinculado; 1.007 contatos (44,4%) sem empresa vinculada; 204 empresas (18,5%) sem nenhum contato. [`03`, `05`]

---

## 10-11. Problemas de modelagem e padrões de processo ruim herdados do Zoho

Isso é o que o Kauã pediu explicitamente pra não perpetuar no CRM 2.0:

1. **Nome do registro usado como lógica de negócio.** O time usava `Nome Oportunidade de Venda` no formato `EMPRESA | TIPO | VENDEDOR` pra tipar eventos: **CHURN (88), UPGRADE (87), DOWNGRADE (27), RENOVAÇÃO (29), MIGRAÇÃO (13)** — 244 registros no total, ligados ao negócio original via campo `Oportunidade Origem`. Funciona, mas é fragilíssimo (qualquer erro de digitação no nome quebra a lógica) e não é pesquisável/reportável sem parsing de texto. [`03`]
2. **Pipeline de Stage duplicado em português e inglês, nunca normalizado** — "Closed Won"/"Concluído"/"Ganho" convivem há anos como estágios distintos, mesmo padrão em Propostas (incluindo o typo "Propsta Perdida"). [`01`]
3. **Campo `Recorrência` (base de cálculo de MRR) é texto livre**, não picklist — 8+ grafias do mesmo valor ("A Vista"/"A VISTA"/"À VISTA"). [`01`]
4. **Dois sistemas de assinatura eletrônica coexistindo** (Zoho Sign + resquício de DocuSign, visto em nomes de `.zip`) — nenhum dos dois com cobertura completa. [`01`]
5. **Campos redundantes acumulados sem depreciar o antigo**: `Percentual Multa` + `Percentual de Multa`, `Recorrência` + `Recorrência_Old`, `Empresa Site` (nunca preenchido) + `Site`, e um trio picklist+3 booleans pra "responsabilidade" em Contatos. Padrão recorrente de campo novo criado ao lado do velho, nunca migrado. [`01`]
6. **Resultado de ligação nunca registrado** (`Resultado da ligação` vazio em 413 de 414) — numa empresa de telefonia, o outcome humano da call não vivia no CRM (provavelmente só no discador). [`01`]
7. **Um segundo pipeline de Stage inteiro** (Concluído/Perdido/Contrato/Nutrição/Negociação-Revisão/Levantamento de Escopo/Delivery AI/Delivery PABX/Faturamento/Ganho) convivendo com o pipeline "moderno" ao longo de toda a história — não é um antes/depois, os dois foram usados em paralelo. [`03`]
8. **Automação de qualificação de lead vivia inteiramente dentro do Zoho** (77 campos em módulos de orquestração `Qualify Leads through Email/Call`) — não é dado, é regra de negócio configurada, não recuperável via backup CSV. [`01`]

---

## 12. Jornadas de cliente reconstruídas

Os 2 casos que o Kauã trouxe (Karen/LOGITHINK, Vetlog) foram confirmados em detalhe ponta a ponta contra o backup real:

- **LOGITHINK**: 2 negócios reais (inicial R$1.074,90 + upgrade "LINHA 4003" R$400, ligados via Oportunidade Origem), 2 contratos nativos reais (36 meses, multa 30%, código CT-288/CT-293), notas de qualificação reais (troca de fornecedor, aprovação de diretoria, portabilidade). No CRM: 2 propostas soltas, zero negócio, zero contrato, zero nota.
- **Vetlog**: negócio inicial Closed Won 2023 (R$919,29) + oportunidade CHURN 2026 ligada via Oportunidade Origem, com nota real "CHURN SEM AVISO PRÉVIO" e depois "termo de distrato elaborado e encaminhado para assinaturas". No CRM: só o negócio inicial, eternamente "ganho".

Esses 2 casos não são exceção — são a amostra visível de um padrão que a auditoria confirmou em escala (seção 0, achados #2-4). A capacidade de reconstruir jornada completa (Lead → Qualificação → Oportunidade → Proposta → Contrato → Assinatura → Evento de lifecycle) existe no Zoho pra uma fração significativa da base, mas **não em uma tabela só** — requer juntar Oportunidade + Oportunidade Origem + Stage History + Notes + Contrato + ZohoSign, exatamente como foi feito manualmente nesses 2 exemplos.

---

## 13. Informação histórica que precisa ser preservada (não é negociável, é fato que já aconteceu)

- Termos contratuais reais (prazo, multa) dos 279 contratos nativos.
- A relação Oportunidade Origem → Oportunidade (upsell/downgrade/churn/renovação/migração) para os 244 casos identificados.
- Stage History dos 1.551 negócios (mesmo dos 512 que não existem mais no CRM — a história deles aconteceu, independente de terem um card hoje).
- As 4.560 notas (mesmo as 1.876 que hoje não têm onde morar estruturalmente).
- A trilha ZohoSign completa (quem assinou, quando, 178 documentos "Signed" reais).
- Histórico de status/responsável de lead (5.346 linhas) — quem cuidou de cada lead e quando mudou de status, ao longo do tempo.

## 14. O que é lixo / não deve ser replicado como está

- Contatos de teste óbvios ("Mussum Trapalhão", "teste1924 teste teste", "Pedro teste", "Pelé Santos").
- Telefone placeholder `11000000000`.
- Módulos Zoho nunca adotados (Cases, Solutions, Vendors, PriceBooks, Territories) — zero conteúdo, não é perda.
- Campo `Empresa Site` (nunca preenchido em 1.102 linhas) e `Recorrência_Old` — resíduo de schema, não dado.
- O modelo de "nome como lógica de negócio" em si (item 11.1) — o *fato* histórico que ele registra deve ser preservado, mas o *mecanismo* (parsing de texto) não deve ser replicado no CRM 2.0.

---

## 15. Casos ambíguos que exigem decisão do Kauã (não decidi nada, só documentei a evidência)

| Caso | Evidência | O que precisa de decisão |
|---|---|---|
| 121 negócios "ganho" com evento pós-venda documentado | Alta confiança que o evento é real | Como representar isso no CRM 2.0 sem "apagar" que a venda original foi ganha (ver framework do Kauã: Oportunidade ≠ Contrato ≠ Lifecycle) |
| 52 negócios "Closed Won"→"ativo" | Confiança média | Confirmar se "ativo" é categorização proposital de pós-venda ou sintoma do mesmo problema |
| ~41 negócios de conversão com `Potential.id` preenchido no Zoho, ausentes no CRM | Confiança média | Candidato real a perda — vale reimportar? |
| 324 empresas + ~225 leads pré-migração sem `zoho_id`/marcador de origem | Confiança baixa-média | Parte parece vínculo quebrado, parte parece placeholder interno — precisa inspeção adicional antes de classificar |
| 449 leads presos no Zoho, criados pós-corte | Alta confiança que são leads reais não trabalhados | **Decisão de negócio urgente**: importar agora? Investigar por que o Zoho ainda recebe lead novo? |
| 85 grupos de telefone duplicado em contatos | Mistura de teste/legítimo/real | Que critério usar pra separar antes de decidir merge |
| 5 grupos de CNPJ duplicado em empresas | Alta confiança de duplicidade real | Autorizar merge? |

---

## 16. Proposta inicial de modelo canônico (RASCUNHO — não é decisão fechada, é ponto de partida pra discussão)

Seguindo exatamente a separação conceitual que o Kauã já trouxe:

```
Oportunidade (comercial)          Contrato (o que foi contratado)     Lifecycle (relação com o cliente)
Aberta → Negociação → Proposta    Ativo → Suspenso → Encerrado        Prospect → Cliente → Ativo → Churn
→ Ganha

Eventos (o que aconteceu ao longo do tempo, timestamped, não é status — é fato)
Won · Upgrade · Downgrade · Renewal · Churn · Reactivation
```

Isso resolveria diretamente o problema #2 do sumário executivo: um negócio pode continuar `ganho` (foi ganho de verdade, isso não muda) e ao mesmo tempo o Lifecycle do cliente pode estar em `churn`, com um Evento datado registrando quando e por quê. Nenhuma tabela hoje no schema atual modela "Evento" como conceito de primeira classe com esse vocabulário (Won/Upgrade/Downgrade/Renewal/Churn/Reactivation) — `status_changes` é o mais próximo, mas é genérico e não distingue evento comercial de simples mudança de estágio.

Este é só um ponto de partida — decisão de schema definitivo fica pra quando o Kauã validar a direção.

## 17. Regras de negócio que precisam ser definidas

- O que conta como evidência suficiente de churn pra mudar o Lifecycle (nota + termo de distrato? contrato sem renovação após vencimento? falta de atividade por N dias?).
- Como tratar negócio "ganho" com evento de churn/downgrade documentado depois — reabrir? criar evento sem tocar o status original?
- Critério de dedup de empresa/contato (CNPJ como chave primária quando existe; fallback quando não existe).
- Se os 449 leads presos no Zoho devem ser importados e, se sim, com qual responsável/origem.
- Se vale reconstruir campos jurídicos (prazo, multa) a partir dos 279 contratos nativos mesmo sem 100% de certeza de vínculo com o negócio certo.

## 18. Plano de reconstrução proposto (fases, sem compromisso de prazo — pra validar com o Kauã)

1. **Reconciliação assistida por evidência** (não automática): gerar a "matriz de reconciliação" completa (Legacy ID × CRM ID × diagnóstico × confiança) pras entidades de maior impacto financeiro primeiro — Oportunidades/Contratos (onde mora o MRR e a multa contratual).
2. **Modelo canônico validado** (seção 16) — fechar com o Kauã antes de tocar em schema definitivo.
3. **Backfill dos fatos históricos preserváveis** (Stage History, Notes, ZohoSign, Contratos nativos) pras entidades que já sobreviveram no CRM — sem sobrescrever nada criado nos últimos 2 meses.
4. **Reconciliação dos órfãos e ambíguos** (seção 15) com decisão explícita caso a caso ou por lote, não em massa automática.
5. **Investigar e fechar o gap de sincronização vivo** (449 leads, achado #8) — esse é o único item com urgência operacional real, o resto é histórico.
6. Só depois disso, retomar o desenho de frontend do CRM 2.0 sobre uma base de dado que a gente já auditou.

---

## Relatórios-fonte (detalhe completo de cada frente)

- [`01-inventario-zoho.md`](./01-inventario-zoho.md) — inventário técnico dos 34 módulos + 1.980 anexos
- [`02-inventario-crm-atual.md`](./02-inventario-crm-atual.md) — inventário técnico das 70 tabelas do CRM
- [`03-reconciliacao-oportunidades.md`](./03-reconciliacao-oportunidades.md) — Oportunidades × Negócios (achado mais crítico)
- [`04-reconciliacao-propostas-contratos.md`](./04-reconciliacao-propostas-contratos.md) — Propostas × Contratos nativo
- [`05-reconciliacao-contatos-empresas.md`](./05-reconciliacao-contatos-empresas.md) — Contatos/Empresas/Leads + duplicidade
- [`06-reconciliacao-atividades-historico.md`](./06-reconciliacao-atividades-historico.md) — Notas/Histórico/Assinatura eletrônica
