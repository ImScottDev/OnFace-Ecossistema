# Reconciliação Atividades, Notas, Histórico e Assinatura Eletrônica (Zoho) ↔ CRM novo

> Frente 6 de 6 da auditoria forense pós-migração (12/06/2026). **Escopo: notas, histórico de estágio de negócio, histórico de status/dono de lead, calls/meetings/tasks/emails e trilha de assinatura eletrônica.** Pura investigação, zero escrita: CSVs do Zoho e banco só foram lidos via `csv.DictReader` / `SELECT`.
>
> Fontes: `~/Downloads/Data_001/Data/*.csv` (utf-8-sig, IDs prefixados `zcrm_`, sempre casados pelo sufixo numérico) e banco `callface_crm` via `psql` (somente leitura). Onde relevante, os dados foram exportados para CSV local em `/private/tmp/.../scratchpad/audit/` só pra permitir join em Python — nenhuma escrita em CSV original nem no banco.
>
> **Achado transversal que muda a leitura de tudo abaixo:** o CRM novo tem **duas** tabelas candidatas a guardar "nota" — `notas` (transacional, usada pelo produto hoje) e `atividades` (linha do tempo genérica). A investigação inicial assumindo que `notas` seria o destino da migração levaria à conclusão errada de "100% perdido". `notas` de fato é 100% pós-corte (nenhuma linha antes de 01/07/2026, e o conteúdo não bate com o Zoho — ver §1.2). Mas `atividades` tem linhas com `titulo = 'Nota (Zoho)'` e datas reais de 2024/2025, ou seja: **parte da migração de notas foi feita, só que para uma tabela diferente da que o produto usa para exibir notas no dia a dia.** Isso é um achado estrutural por si só, independente do volume perdido.

---

## 0. Números-chave (resumo executivo)

| Métrica | Valor |
|---|---|
| Notes no Zoho | 4.560 |
| Notes cujo módulo-pai (Potentials/Leads) tem *algum* caminho estrutural possível até `atividades` hoje | 2.684 (58,9%) |
| Notes cujo módulo-pai (Accounts/Contacts/CustomModule1=ZohoSign/Quotes/SalesOrders/Invoices/Tasks/Events) **não tem nenhuma coluna no schema atual pra receber essa nota** | 1.876 (41,1%) |
| Linhas em `atividades` com `titulo = 'Nota (Zoho)'` (candidatas a nota realmente migrada) | 2.344 |
| Dessas, com timestamp batendo exato com uma nota do export atual do Zoho | ~1.194 (confiança média — ver ressalva de sync reverso em §1.3) |
| `notas` (tabela usada pelo produto) — linhas com conteúdo/data pré-migração | **0 de 1.515** |
| Stage History no Zoho (jornada completa de estágio) | 6.429 linhas / 1.551 negócios distintos |
| `status_changes` no CRM novo | 4.767 linhas totais |
| Dos 1.039 negócios que existem hoje e tinham Stage History no Zoho: transições Zoho vs. `status_changes` | 3.989 (Zoho) vs. 2.870 (CRM) → **72% preservado, 28% perdido**, só nos negócios que sobreviveram |
| Transições de 512 negócios que nem existem mais em `negocios` | 2.439 transições **100% inacessíveis** (o negócio-pai já não existe) |
| ZohoSign Documents | 368 (178 "Signed") |
| ZohoSign Recipients | 1.257 (752 "Signed") |
| Tabela/campo de assinatura eletrônica no CRM novo | `contratos.assinatura_status` / `assinado_em` / `assinado_nome` / `assinado_ip` — **schema existe, 0 de 319 contratos tem qualquer um desses campos preenchido** |
| `contratos.zoho_id` preenchido | **0 de 319** — não dá nem pra tentar casar contrato novo × ZohoSign antigo |
| Calls / Meetings / Tasks / Emails no Zoho | 414 / 382 / 510 / 177 |
| `ligacoes` / `reunioes` / `tarefas` / `emails` no CRM novo | 777 / 167 / 29.126 / 419 — **todas com `created_at` mínimo em 01/07/2026 ou depois, nenhuma migrada** |
| Situação de Lead Histórico + Responsabilidade Histórico no Zoho | 3.086 + 2.260 = 5.346 linhas |
| Equivalente hoje no CRM | **Nenhum.** `status_changes` tem uma "dimensão lead" (1.813 linhas com `lead_id` e `negocio_id` nulo), mas 100% delas datam de 01/07/2026 em diante e não citam Zoho — são histórico *novo*, não migrado. `audit_log` existe no schema mas tem **0 linhas** (nunca foi ligado). |

---

## 1. Notes (4.560) — módulo-pai, casamento de entidade e existência real de conteúdo

### 1.1 Distribuição por módulo-pai (`Parent Id.Module`)

| Módulo | Qtd. notes | Entidade correspondente no CRM novo | A tabela `atividades`/`notas` tem FK pra essa entidade? |
|---|---:|---|---|
| Potentials | 1.716 | `negocios` | Sim (`atividades.negocio_id`, `notas.negocio_id`) |
| CustomModule1 | 1.605 | **ZohoSign Documents** (confirmado por match de ID — ver §3) | **Não existe tabela de assinatura eletrônica** |
| Leads | 968 | `leads` | Sim (`atividades.lead_id`, `notas.lead_id`) |
| Quotes | 115 | `propostas` | Não (`propostas` não tem `zoho_id` nem nota vinculável) |
| Accounts | 70 | `empresas` | `notas.empresa_id` existe na tabela mas **nunca foi usado (0 linhas)**; `atividades` nem tem coluna `empresa_id` |
| Contacts | 61 | `contatos` | `contatos.zoho_id` existe mas está **0% populado** — impossível até tentar casar |
| SalesOrders | 13 | sem equivalente direto | — |
| Invoices | 10 | `faturas` | Sem `zoho_id` |
| Tasks / Events | 1 + 1 | — | irrelevante em volume |
| **Total** | **4.560** | | |

`CustomModule1` é o nome interno que o exportador do Zoho usa quando não resolve o nome de exibição do módulo — achado por conta própria: cruzando `ID do pai.id` dessas 1.605 notes contra o `ID do registro` de `ZohoSign Documents_C_001.csv`, **264 dos 264 IDs batem 100%** (264 de 368 documentos ZohoSign têm pelo menos 1 nota anexada). Ou seja, essas 1.605 notes são comentários/eventos do fluxo de assinatura, não notas de negócio.

### 1.2 `notas` (tabela usada pelo produto hoje): 0% de conteúdo pré-migração

- `SELECT min(created_at) FROM notas` → **2026-07-01**, ou seja **19 dias depois** do corte de 12/06/2026. Não existe uma única linha com data anterior.
- Distribuição por dia mostra crescimento orgânico (4, 7, 11, 38... por dia a partir de 01/07) típico de uso normal pós-lançamento, não de uma carga em lote de histórico.
- Prova por conteúdo, não só por data: pegamos 2 negócios que casam por `zoho_id` E têm nota hoje em `notas`. Em ambos os casos o conteúdo da nota no Zoho (ex.: "🎯 Interesses...", "Oportunidade o Marcus da Princi") é completamente diferente do conteúdo salvo em `notas` hoje (ex.: "CONTA DO PARCEIR PRINCI. FUP 24/07", "Aguardando retorno para retomadao com o cliente") — são notas **novas**, escritas por vendedor depois do go-live, não a nota original resgatada.
- Conclusão: **para o produto que o time usa no dia a dia, 100% das 4.560 notas do Zoho estão ausentes.** Nenhuma delas foi recuperada em `notas`, nem para os negócios/leads que ainda existem.

### 1.3 `atividades` (tabela de timeline genérica): parte da migração aconteceu aqui, com lacunas

- `atividades.lead_id` é `NOT NULL` — estruturalmente só pode receber notas de Potentials/Leads (2.684 das 4.560, 58,9%). Accounts/Contacts/ZohoSign/Quotes/SalesOrders/Invoices (1.876 notes, 41,1%) **não têm nenhuma coluna que os receba**, independente de qualquer esforço de migração.
- Dentro do universo elegível, 2.344 linhas em `atividades` têm `titulo = 'Nota (Zoho)'` com datas reais espalhadas desde 2024-01-04 — confirmado por spot-check de conteúdo (ex.: nota "Boa tarde, estou procurando uma plataforma..." criada 2024-01-17 18:22:22 no Zoho aparece idêntica e na mesma data/hora em `atividades`).
- Casamento por timestamp exato (com dedup) entre essas 2.344 linhas e o export atual de Notes (Potentials+Leads) encontra **~1.194 matches**. As ~1.150 linhas sem match exato se concentram tanto em 2024 (real, sem contaminação) quanto em maio/junho de 2026 — este segundo bloco tem confiabilidade menor porque **o Zoho continuou recebendo dados depois do corte** (existe sync reverso CRM→Zoho, rodado em 03/08/2026 — ver nota do vault "Sync CRM↔Zoho executado 03/08"), então o export usado nesta auditoria não é um "antes" congelado; ele mistura Zoho pré-corte com dados que voltaram do CRM novo depois. Isso **infla artificialmente** o número de "matches" recentes e não deve ser lido como taxa de sucesso da migração para os meses de 2026.
- Olhando só 2024 (ano limpo, sem qualquer sync reverso possível): de ~933 notes-mês distribuídas, **~698 ficaram sem match** — ou seja mesmo no recorte mais confiável, uma fração grande (na ordem de 60-75%) das notes elegíveis de 2024 não tem uma linha correspondente encontrável em `atividades` hoje.
- **Confiança:** alta que `notas` = 0% migrado (prova por conteúdo). Média que `atividades` recuperou uma fração relevante mas incompleta das notes de Potentials/Leads — o número exato de "quanto faltou" é sensível ao ruído do sync reverso e não deve ser citado como definitivo sem reprocessar com um snapshot Zoho anterior a 03/08/2026.
- **Achado de produto, não só de dado:** mesmo nas notes que *foram* migradas, elas foram para `atividades` (timeline), não para `notas` (a aba "Notas" que o vendedor abre). Se a UI do CRM novo só lê de `notas`, o usuário nunca vê essas 2.344 linhas de qualquer forma — o "sumiço" que o Kauã reportou nos 2 casos reais é consistente com isso, mesmo que o dado tecnicamente exista em outra tabela.

---

## 2. Stage History (6.429) — jornada completa do funil vs. `status_changes`

- `status_changes` tem **4.767** linhas no total, das quais **2.954 têm `negocio_id`** (jornada de negócio) e as demais 1.813 são histórico de lead (ver §5).
- O campo `motivo` confirma a origem: linhas migradas trazem o texto literal `"Zoho: <de> → <para>"` com `created_at` histórico real (voltando a 2023-12-26) — prova direta de que parte do Stage History foi migrada como registro, não recriada.
- **Recorte controlado**: dos 1.551 negócios distintos no Stage History do Zoho, **1.039 ainda existem** em `negocios` hoje (`zoho_id` bate). Os outros **512 negócios simplesmente não existem mais** no CRM novo — toda a jornada deles (2.439 transições de estágio) é hoje inacessível por construção, não por falha de sync.
- Para os 1.039 negócios que sobreviveram: Zoho tem **3.989** transições registradas para eles; `status_changes` tem **2.870** — **72% preservado, 28% perdido**, mesmo nos negócios "sortudos" que não desapareceram.
- Amostra aleatória de 20 negócios (seed fixa, reprodutível) confirma o padrão da população: em 19 de 20 casos o Zoho tem igual ou mais transições que `status_changes`; a razão da amostra (56/80 = 70%) fica muito próxima da razão da população inteira (2870/3989 = 72%), o que dá confiança alta de que não é um artefato de amostragem.
- **Confiança:** alta. Esse é o achado com evidência mais limpa da frente — datas e motivo preservam rastreabilidade direta ao Zoho, sem ambiguidade de tabela ou contaminação de sync reverso (Stage History é histórico fechado, ninguém escreve stage history novo pro passado).

---

## 3. ZohoSign — Assinatura Eletrônica: gap de dado E gap estrutural

### 3.1 O dado no Zoho

- **368** documentos distintos em `ZohoSign Documents_C_001.csv` (nenhum ID duplicado).
- Status: 178 Signed, 65 Drafted, 43 Expired, 38 em branco, 36 Recalled, 4 Declined, 4 Out for Signature.
- **1.257** destinatários em `ZohoSign Recipients_C_001.csv`, ligados a 329 dos 368 documentos (39 documentos sem nenhum destinatário rastreado). Status de destinatário: 752 Signed, 318 em branco, 181 Waiting for Signature, 4 Cancelled, 2 Approved.
- Vínculo com outros módulos: 297 documentos têm `Deal.id`, 327 têm `Account.id`, 315 têm `Contact.id`, 304 têm `Quote.id`, 0 têm `Lead.id`. Só **40 documentos não têm vínculo com nenhum módulo**.
- Cruzando `Deal.id` com `negocios.zoho_id`: dos 297 documentos vinculados a um Deal, só **84 (28,3%)** apontam para um negócio que ainda existe hoje. Dos 178 documentos "Signed", só **43 (24,2%)** têm o negócio-pai vivo em `negocios`.
- Cruzando `Account.id` com `empresas.zoho_id`: 321 de 327 (98,2%) — a empresa quase sempre sobreviveu, mesmo quando o negócio específico não.

### 3.2 O que existe hoje no CRM novo

- Não existe tabela `zoho_sign_documentos`, `assinaturas_eletronicas`, `assinatura_documentos` ou qualquer nome equivalente. A única tabela chamada `assinaturas` no schema é sobre **assinatura Stripe (SaaS subscription/MRR)**, sem relação nenhuma com assinatura de contrato/documento.
- `contratos` tem 4 colunas que sugerem que alguém *planejou* guardar isso: `assinatura_status` (default `'nao_aplicavel'`), `assinado_em`, `assinado_nome`, `assinado_ip`. **Confirmado por SELECT: dos 319 contratos, 0 têm `assinado_em` preenchido e 0 têm `assinatura_status` diferente do default.** O campo existe no schema mas nunca foi escrito — nem por migração, nem por uso orgânico desde o go-live.
- `contratos.zoho_id` também está **0% preenchido** (0 de 319) — mesmo que quiséssemos reconstruir manualmente "qual contrato novo corresponde a qual documento ZohoSign antigo", não existe a chave para fazer esse join hoje. A reconciliação teria que ser feita por heurística (nome do cliente + data + valor), não por ID.
- **Conclusão: isto não é um problema de sincronização que rodou incompleta — é a ausência completa da funcionalidade "documento assinado" (quem assinou, quando, com que status, vinculado a qual negócio/contrato) na estrutura de dados atual.** 178 assinaturas "Signed" reais e ~752 confirmações de destinatário existem só no Zoho; não há hoje, no banco do CRM novo, nenhum lugar onde esse fato poderia estar registrado mesmo que alguém tentasse digitar de volta.
- **Confiança:** alta. Verificado por `\d contratos` (schema) e por `SELECT count(*)` direto nos campos relevantes — não é inferência, é ausência confirmada.

---

## 4. Calls / Meetings / Tasks / Emails — ordem de grandeza

| Módulo | Zoho (total histórico) | Tabela no CRM novo | Total CRM novo | `created_at` mínimo no CRM novo | Zoho tem `zoho_id`/coluna de link no CRM? |
|---|---:|---|---:|---|---|
| Calls | 414 | `ligacoes` | 777 | **2026-07-23** | Não (`ligacoes` só tem `callface_call_id`, do provedor de telefonia Callface/Asterisk — não é ID Zoho) |
| Meetings | 382 | `reunioes` | 167 | **2026-07-01** | Não (tem `outlook_event_id`, sync com M365/Outlook — não Zoho) |
| Tasks | 510 | `tarefas` | 29.126 | **2026-07-01** | Não |
| Emails | 177 | `emails` | 419 | **2026-07-20** | Não (`message_id`/`thread_id`, provedor de e-mail — não Zoho) |

- As 4 tabelas do CRM novo têm `created_at` mínimo **depois** do corte de 12/06/2026 — nenhuma delas tem uma única linha antiga. Confirmado buscando `'zoho'` em `ligacoes.payload_raw` (jsonb bruto do provedor): **0 ocorrências**.
- O volume de `tarefas` (29.126) não é comparável ao de Zoho Tasks (510): 29.075 das 29.126 são do tipo `follow_up`, claramente geradas em massa por automação/cadência do CRM novo (ver tabela `cadencia_execucoes`/`automacoes`), não uma tarefa por registro à mão como no Zoho. Comparar os dois números brutos seria enganoso — o que importa é que **as 510 tasks originais do Zoho (e as 414 calls, 382 meetings, 177 emails) não têm nenhuma linha correspondente**: são históricos de atividade comercial pré-corte que simplesmente não atravessaram para o banco novo. Tudo que existe hoje nessas 4 tabelas é atividade nova, gerada depois do go-live pelas integrações atuais (telefonia Callface, Outlook, automação de cadência, e-mail).
- **Confiança:** alta. `created_at` é coluna interna do banco (não editável por import), e a ausência de qualquer marcador "Zoho" no payload bruto fecha o caso.

---

## 5. Situação de Lead Histórico + Responsabilidade Histórico (5.346 linhas) — dimensão "lead" do histórico

- **Situação de Lead Histórico** (3.086 linhas): cada linha é uma transição de status de um Lead (`Movido para`), com `Hora da modificação` e `Duração`. Ex.: lead zcrm_...553001 foi de "Não Trabalhado" pra "Qualificado" em 2023-10-24, ficou 5 minutos no estado anterior.
- **Responsabilidade Histórico** (2.260 linhas): mesma estrutura, mas rastreando troca de dono/responsável do lead (`Responsabilidade`, `Movido para`).
- No CRM novo, `status_changes` tem uma sub-população de 1.813 linhas com `lead_id` preenchido e `negocio_id` nulo — à primeira vista parece a mesma "dimensão lead". **Mas**: 100% dessas 1.813 linhas têm `created_at >= 2026-07-01` e `motivo` vazio (sem o marcador `"Zoho: ..."` que aparece nas linhas de negócio migradas). São transições novas do funil de qualificação do CRM atual (`novo → qualifying → contacted → disqualified`), geradas organicamente desde o go-live — **não são as 3.086 linhas do Zoho reaproveitadas**.
- Não existe hoje nenhuma coluna em `leads` (ex.: `responsavel_id`) que guarde histórico — só o valor atual. Trocou de dono, o valor anterior se perde, ponto.
- `audit_log` é a tabela do schema mais próxima do conceito "log de mudança genérico" (`before`/`after` em jsonb, `entity_type`, `actor_id`) — parece desenhada exatamente pra isso. **Mas está com 0 linhas** — existe na estrutura, nunca foi ligada a nenhum fluxo de escrita.
- **Conclusão: as 5.346 linhas de histórico de lead (status + responsável) do Zoho não têm nenhum equivalente hoje, nem coincidência acidental.** É uma dimensão de dado 100% perdida — pior que o caso de Stage History de negócio (§2), onde pelo menos parte sobreviveu.
- **Confiança:** alta. Verificado por ausência de marcador `"Zoho:"` no `motivo`, por `created_at` 100% pós-corte, e por contagem direta de `audit_log` (0 linhas).

---

## 6. Síntese por nível de confiança

| Achado | Confiança | Por quê |
|---|---|---|
| `notas` (tabela do produto) = 0% de conteúdo Zoho migrado | **Alta** | Data mínima pós-corte + comparação de conteúdo real, não só contagem |
| `atividades` tem parte das notes de Potentials/Leads (~2.344 linhas candidatas, ~1.194 com match exato de timestamp) | **Média** | Confirmado por conteúdo em amostra, mas taxa exata contaminada por sync reverso Zoho←CRM de 03/08/2026 |
| Notes de Accounts/Contacts/ZohoSign/Quotes/SalesOrders/Invoices (1.876 de 4.560) não têm NENHUM caminho estrutural pra existir hoje | **Alta** | Ausência de coluna no schema, não depende de nenhum dado, é fato de DDL |
| Stage History: 72% preservado nos 1.039 negócios que sobreviveram; 512 negócios com jornada 100% inacessível | **Alta** | Motivo com marcador "Zoho:" + datas históricas reais, população inteira batida, não só amostra |
| ZohoSign: 0 contratos com campo de assinatura preenchido; 0 com `zoho_id`; não existe tabela dedicada | **Alta** | Confirmado por schema + SELECT direto, é ausência binária |
| Calls/Meetings/Tasks/Emails: 0 linhas migradas nas 4 tabelas | **Alta** | `created_at` mínimo pós-corte em todas + zero marcador Zoho no payload bruto |
| Histórico de status/responsável de LEAD: 100% perdido, `audit_log` desenhado mas nunca ligado (0 linhas) | **Alta** | Ausência de marcador + tabela candidata vazia, verificável objetivamente |

**Não** estamos concluindo aqui quantas notas/registros "precisam ser recriados" — isso é decisão de produto/priorização do Kauã. O que este documento fecha é a escala real: **a perda não é um caso isolado dos 2 exemplos que ele já viu manualmente — é sistêmica em 5 das 6 dimensões investigadas**, e em pelo menos 2 casos (ZohoSign, histórico de lead) o problema é estrutural (não existe onde guardar o dado hoje), não só um sync que ficou incompleto.
