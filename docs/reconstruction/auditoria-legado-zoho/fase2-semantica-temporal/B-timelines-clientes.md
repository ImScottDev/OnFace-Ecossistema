# Fase 2 — Timelines completas de clientes (Zoho ↔ CRM atual)

> Frente B da Fase 2 da auditoria forense (10/08/2026). **Zero escrita em qualquer fonte** — Zoho (`~/Downloads/Data_001/Data/*.csv`, `csv.DictReader`, utf-8-sig) e Postgres (`postgresql://callface:callface2026dev@localhost:5432/callface_crm`, só `SELECT`) foram apenas lidos. Todo cruzamento foi feito por script Python/psql, sem persistir nada além dos arquivos de trabalho no scratchpad da sessão.
>
> Este documento não substitui a síntese da Fase 1 (`00-SINTESE-CONSOLIDADA.md`) nem os relatórios `03`/`04`/`06` — ele aprofunda 2 casos já validados (LOGITHINK, Vetlog) e estende o mesmo método de reconstrução ponta a ponta pra outras 18 empresas, seguindo o critério de "maior impacto" descrito na seção 1.
>
> **Regra de leitura:** nada aqui é veredito de "está errado". Cada entrada da timeline traz uma tag — `CONFIRMED` (data explícita na fonte, citada), `INFERRED` (raciocínio explicado a partir de evidência adjacente) ou `AMBIGUOUS` (conflito de datas ou evidência insuficiente, explicado). Onde não dá pra determinar algo, isso é dito abertamente — a decisão de como reconciliar é do Kauã, não deste relatório.

---

## 1. Critério de seleção das 20 empresas

O enunciado pediu (a) top 10-12 empresas por valor histórico total somado em `Montante` de Oportunidades no Zoho, e (b) todas as empresas com cadeia de lifecycle de 2+ elos via `Oportunidade Origem.id` (upgrade/downgrade/renovação/churn/migração — excluindo `CONTRATO INICIAL`/`NOVO CALLFACE`, que são baseline, não evento), deduplicando até ~15-20 no total, incluindo LOGITHINK e Vetlog Distribuidora obrigatoriamente.

**Critério (a) — top por Montante somado** (`Oportunidades de Vendas_001.csv`, agrupado por `Empresa Nome.id`, 1.551 linhas): ordenação direta por soma de `Montante`. As 12 primeiras por valor: MARU - Maria Eugenia (R$88.437,84), FIEMT (R$83.940,00), Prefeitura Municipal de São João del Rei (R$65.904,03), São Leopoldo Mandic — Campinas (R$62.775,68, 12 opps), Mauloni Comércio de Veículos (R$58.940,00), Grupo Ri Happy (R$52.569,21, 8 opps), Venda na Veia (R$45.644,90, 4 opps), Facilita Telecom (R$30.266,60, 68 opps), G30 Educação Automotiva (R$30.026,90, 5 opps), Concessionária Rio Pax (R$28.866,70, 12 opps), Prefeitura de Caruaru (R$28.429,76), Bravo Log Uberaba (R$28.393,35, 5 opps).

**Ressalva de método, importante:** metade do top-12 por valor nominal são negócios com **1 única oportunidade em `Stage=Perdido`** (MARU, FIEMT, Prefeitura SJDR, Mauloni) — ou seja, o "maior valor histórico" do Zoho mistura clientes reais de longa duração com propostas gigantes que nunca fecharam. Isso não invalida o critério (o enunciado pediu valor histórico, não valor fechado), mas é em si um achado: **o ranking por Montante bruto sobrevaloriza negócios nunca ganhos** — todos os 4 estão incluídos abaixo justamente para deixar essa distorção visível, não escondida.

**Critério (b) — cadeia de 2+ eventos reais** (regex `CHURN|UPGRADE|DOWNGRADE|RENOVAÇÃO|MIGRAÇÃO|RENEGOCIAÇÃO` sobre `Nome Oportunidade de Venda`, contando só eventos que não são o próprio baseline, agrupado por empresa): das ~34 empresas com 2+ eventos, priorizei as que já apareciam parcialmente no critério (a) — São Leopoldo Mandic (4 eventos), Grupo Ri Happy (4), Concessionária Rio Pax (3) — e acrescentei as 5 cadeias mais ricas/variadas fora do top-12: Facilita Telecom (22 eventos, majoritariamente CHURN — é a maior cadeia do dataset inteiro), Mais Tecnologia (9 eventos), Swiss Park Office (4: 3 upgrades + 1 migração), Ammo Varejo (4: upgrade+upgrade+renovação+churn — arco de vida completo), Compucenter Informática (3: downgrade+migração+upgrade), Hospital Care | Caledonia (3 downgrades — padrão repetido), Tozzini Freire POA (3: downgrade+renovação+churn).

**Mandatórios:** LOGITHINK e Vetlog Distribuidora (já validados na Fase 1, não aparecem no top-12 por valor — são contratos pequenos, R$1.074,90 e R$919,29 — mas foram os 2 casos-piloto que o Kauã conferiu manualmente).

Total: **20 empresas**, sem duplicação (nenhuma empresa aparece nos dois critérios simultaneamente sem já estar contada uma vez).

---

## 2. Tabela-síntese

| # | Empresa | Nº de eventos na timeline | Discrepância vs. CRM atual | Confiança geral |
|---|---|---|---|---|
| 1 | **LOGITHINK** | 9 | 2 contratos nativos assinados (30% multa, 36 meses) + 2 ZohoSign + notas de qualificação: **0 presentes** no CRM (só 2 propostas soltas) | Alta |
| 2 | **Vetlog Distribuidora** | 5 | Negócio original (R$919,29) parado em `ganho` eterno; evento de CHURN com nota "sem aviso prévio" + distrato: **ausente** | Alta |
| 3 | **Ammo Varejo** | 9 | Negócio de R$150/mês continua `ganho`; churn com inadimplência de R$21.161,90 documentado **6 dias antes** desta auditoria: **ausente** | Alta |
| 4 | **Compucenter Informática** | 8 | Negócio-base (R$900) continua `ganho`; churn documentado **na mesma semana** desta auditoria (nota de hoje, 10/08): **ausente** | Alta |
| 5 | **Hospital Care \| Caledonia** | 9 | MRR original de R$16.636,31 intacto no CRM; 2 downgrades de -R$7.770,00/mês cada (1 com contrato nativo assinado): **ausentes** | Média-Alta |
| 6 | **Concessionária Rio Pax** | 12 | Contrato-base faturado (R$3.999,90, CT-096) e upsell assinado (R$2.499,90, CT-242): **ausentes**; só 5 de 12 negócios migraram | Alta |
| 7 | **São Leopoldo Mandic (Campinas)** | 15 | Base 2022 (R$19.988) fragmentada em 7 negócios distintos no CRM; renovação 48 meses em curso (trava_assinatura) | Média-Alta |
| 8 | **Grupo Ri Happy** | 10 | Base 2022 via AUTOTASK presente, mas só 3 de 8 negócios migraram; 1 proposta de mensageria em aberto (08/2026) | Alta |
| 9 | **Swiss Park Office** | 10 | Só o contrato-base 2022 (R$4.765) está no CRM; 3 upgrades assinados + migração Yeastar (R$4.039,90 assinada dez/2025): **ausentes** | Alta |
| 10 | **Tozzini Freire POA** | 7 | Empresa e lead existem no CRM; **zero negócios**, apesar de contrato nativo assinado (downgrade, CT-192, 30% multa) e churn documentado | Alta |
| 11 | **Facilita Telecom** | ~20 (agregado de 68 opps) | 15 de 68 oportunidades migraram; **nenhum dos ~18 CHURN** (jul/2025–mai/2026, uma prefeitura por vez) está no CRM | Alta |
| 12 | **Mais Tecnologia** | ~15 (agregado de 34 opps) | 7 de 34 oportunidades migraram; nenhum dos 8 CHURN (out/2025–jan/2026) está no CRM; contatos cruzados com Facilita Telecom | Alta |
| 13 | **MARU - Maria Eugenia** | 3 | Maior valor nominal do Zoho (R$88.437,84) é negócio **perdido** (México, distribuidor); CRM tem só o lead, sem negócio — condição correta dado que nunca fechou | Alta |
| 14 | **FIEMT** | 4 | 2º maior valor nominal (R$83.940,00) também perdido; proposta-fantasma de R$218.355,09 (tabela cheia) órfã no CRM, sem negócio-pai | Alta |
| 15 | **Mauloni Comércio de Veículos** | 3 | Negócio White Label perdido (R$58.940,00) — CRM representa corretamente como `perdido`; nenhum gap relevante | Alta |
| 16 | **Prefeitura Municipal de São João del Rei** | 3 | Negócio perdido (R$65.904,03) — **ausência total** no CRM (nem lead, nem negócio, nem proposta) | Alta |
| 17 | **Prefeitura de Caruaru** | 2 | Negócio aberto (R$28.429,76, proposta em curso) migrou corretamente; empresa nunca ganhou registro estruturado (`empresas`), só lead com texto livre | Média |
| 18 | **G30 Educação Automotiva** | 8 | Cadeia de upgrades bem representada, mas **1 negócio duplicado** — mesmo valor, mesmo título, criado no mesmo milissegundo com 2 `zoho_id` diferentes | Alta |
| 19 | **Venda na Veia** | 6 | Mesmo padrão de duplicação (2 negócios de R$18.186,00 no mesmo milissegundo); 3 faturas Stripe em `void` | Alta |
| 20 | **Bravo Log Uberaba** | 7 | Contrato-base (R$16.423,45) presente; 2 de 3 tentativas de upsell perdidas (2024) ausentes; "simulação de churn" (não é churn real) migrou como `perdido` | Média-Alta |

**Leitura agregada:** dos 20 casos, 17 mostram alguma lacuna de migração relevante (negócio/contrato/evento ausente), 2 mostram representação essencialmente correta (Mauloni, e parcialmente Caruaru) e 2 mostram um problema **novo e vivo** — não histórico — de duplicação de registro por sincronização (G30, Venda na Veia). Os 3 achados de churn mais recentes (Ammo Varejo, Compucenter, e o padrão repetido em Facilita/Mais Tecnologia) aconteceram **depois** do corte de migração de 12/06/2026 citado na Fase 1 — ou seja, não são resíduo de uma migração antiga, são o mesmo gap acontecendo agora, em tempo real, enquanto o CRM novo já é o sistema em produção.

---

## 3. LOGITHINK

**Zoho:** `Empresa Nome.id = zcrm_5938068000033006082` · CNPJ 04.158.399/0001-94 · Campinas/SP · contato Karen Loureiro Nakamura (`zcrm_5938068000033006083`).

### 2026
- **Aquisição → oportunidade criada**: opp `LOGITHINK | CALLFACE AI +YEASTAR | MAYARA` (`zcrm_5938068000033006086`), `Hora de Criação` 06/05/2026 18:05:34. `CONFIRMED` (campo `Hora de Criação`).
- **Qualificação**: nota 06/05/2026 14:53 registra troca de fornecedor (saída da 3C Plus por atraso de boleto). `CONFIRMED` (`Hora de Criação` da nota).
- **Aprovação interna**: nota 07/05/2026 18:12 "Cliente vai apresentar a proposta aos diretores". `CONFIRMED`.
- **Proposta → contrato → ganho**: Stage History mostra Proposta Enviada (06/05) → Negociação/Revisão (07/05) → Ganho (27/05) → Contrato (28/05) → Ganho de novo (28/05, R$1.074,90). `CONFIRMED` (`Hora da modificação` de cada linha de `Stage History`).
- **Contrato nativo assinado**: `CT - 288 - 05/2026` (`zcrm_5938068000034242405`), 36 meses, multa 30%, enviado 28/05. ZohoSign `zcrm_5938068000034273013` enviado 28/05, assinado por 3 de 4 destinatários entre 28-29/05, mas o documento consta `Status=Expired` (30/06). `CONFIRMED` para envio e assinaturas parciais; `AMBIGUOUS` para o motivo do "Expired" com maioria já assinada — pode ser 1 signatário pendente (Luiz Gustavo, "Waiting for Signature") que travou o fechamento formal, não dá pra confirmar pelo CSV se o contrato seguiu válido na prática.
- **Upgrade**: opp `LOGITHINK | UPGRADE 4003 | MAYARA` (`zcrm_5938068000035002111`), criada 10/06/2026, `Oportunidade Origem.id` aponta pro contrato inicial. Ganho no mesmo dia, Contrato em 12/06. `CT - 293 - 06/2026`, mesmos termos (36m/30%). ZohoSign assinado por 3 de 4 (Fernando Brolo pendente), também `Expired`. `CONFIRMED`.
- **Portabilidade**: nota 16/07/2026 "Agendado portabilidade para 21/07" em ambas as oportunidades. `CONFIRMED`.
- **Faturamento/Conclusão**: Stage History mostra Faturamento (06/08) → Concluído (10/08) em ambas as opps — datas coincidem com a janela desta própria auditoria. `CONFIRMED`.

**Estado atual conhecido (Postgres):** `empresas` tem a linha (zoho_id bate), mas `negocios`, `contratos`, `propostas`, `faturas`, `status_changes` e `notas` filtrados por essa empresa/negócio retornam **0 linhas** em todas as consultas. Os 2 contratos reais (36 meses, multa 30%, códigos CT-288/CT-293), a trilha de assinatura ZohoSign e as notas de qualificação (troca de fornecedor, aprovação de diretoria, portabilidade) não têm equivalente. Confirma exatamente o achado já registrado na Fase 1 (`00-SINTESE-CONSOLIDADA.md`, seção 12).

---

## 4. Vetlog Distribuidora

**Zoho:** `Empresa Nome.id = zcrm_5938068000002881001` · CNPJ 13.157.701/0001-80 · Viamão/RS.

### 2023 (retrodatado)
- **Fechamento original**: `Data de Fechamento` do negócio `VETLOG | CONTRATO INICIAL | CINTHIA CUNHA` (`zcrm_5938068000009596057`) é 13/01/2023, mas `Hora de Criação` do registro Zoho é 19/07/2024. `AMBIGUOUS`: o negócio foi retroalimentado no Zoho 18 meses depois de ele ter (supostamente) fechado — o valor de fechamento é real (R$919,29, Stage Closed Won), mas não há evidência documental de 2023 no CSV, só o campo de data preenchido retroativamente. Tratar "2023" como a melhor data disponível, não como certeza absoluta.

### 2024
- **Registro no Zoho**: `Hora de Criação` 19/07/2024 14:42:36. `CONFIRMED`.
- **Stage final**: Closed Won, 19/07/2024 17:11:54. `CONFIRMED`.

### 2026
- **Churn sem aviso**: opp `VETLOG | CHURN` (`zcrm_5938068000032802081`), criada 04/05/2026, `Oportunidade Origem.id` aponta pro contrato inicial. Nota do mesmo dia: "CHURN SEM AVISO PREVIO. DESLIGAR AMBIENTE". `CONFIRMED` (data da nota = data de criação da opp).
- **Detalhamento financeiro do churn**: nota 08/06/2026 lista contrato legado (`CT-14356-13-01-2023`, R$861,66 + 2 taxas adicionais) — essa referência de contrato de 13/01/2023 é a mesma data usada no campo `Data de Fechamento` da opp original, o que dá suporte a que 2023 é de fato quando o vínculo real começou (mesmo sem outro documento). `INFERRED` — a nota não afirma isso explicitamente, é dedução por coincidência de datas entre dois registros independentes.
- **Distrato**: nota 21/07/2026 "termo de distrato elaborado e encaminhado para assinaturas. Seguindo para fila de projetos desligar o ambiente." `CONFIRMED`.
- **Conclusão administrativa**: Stage History mostra Faturamento (04/05) → Contrato (04/05) → Delivery PABX (08/06) → Faturamento (21/07) → Concluído (06/08). `CONFIRMED`.

**Estado atual conhecido (Postgres):** `negocios` tem exatamente 1 linha para essa empresa — `VETLOG | CONTRATO INICIAL | CINTHIA CUNHA`, `status='ganho'`, `mrr_fechado=919.29`, `ganho_at='2023-01-12 21:00:00-03'` (o fuso/horário sugere conversão direta do campo `Data de Fechamento` do Zoho, não um evento real registrado à meia-noite). O negócio-evento de CHURN não existe em `negocios` (Stage=Concluído, pipeline legado). `status_changes` tem só as 2 transições originais de 2024, nada de 2026. `notas` vazio. Confirma o achado já publicado na Fase 1.

---

## 5. Ammo Varejo

**Zoho:** `Empresa Nome.id = zcrm_5938068000011639001` · CNPJ 03.494.776/0001-01 · São Paulo/SP · contato Ericlébio Santos.

### 2024
- **Tentativa de venda Growth**: opp `AMMO VAREJO | GROWTH | JESSICA MARQUES` (`zcrm_5938068000011642033`), criada 17/09/2024, escopo real anexado em nota (15 posições de atendimento, portabilidade de 3×0800 + 2 números). `CONFIRMED`.
- **Ajuste de escopo**: nota 05/12/2024 pede retirada dos 3×0800, manter só Callface. `CONFIRMED`.
- **Perda**: Stage final Perdido, motivo "Acompanhamentos perdidos". `CONFIRMED` (`Razão para a perda`).

### 2025
- **Novo ciclo — upgrade de minutagem**: duas opps quase idênticas criadas no mesmo dia (19/05/2025): `AMMO VAREJO - UPGRADE +800 MIN` (perdida, sem valor) e `AMMO VAREJO - UPGRADE +800MIN` (ganha, R$150), ligadas entre si via `Oportunidade Origem`. `AMBIGUOUS`: o Zoho registra as duas como pares "Origem", sugerindo que a primeira foi abandonada/substituída pela segunda no mesmo fluxo de negociação — não há nota explicando por que 2 registros foram criados para a mesma demanda.
- **Contrato assinado**: `CT - 210 - 06/2025`, 36 meses, multa 30%, assinado via ZohoSign 25→30/06/2025 (3 signatários, incl. o próprio contato Ericlébio Santos). `CONFIRMED`.
- **Renovação anual perdida**: opp `AMMO VAREJO | RENOVAÇÃO` (`zcrm_5938068000027791084`), criada 06/01/2026, Contrato→Perdido no mesmo dia, Closed Lost em 22/01/2026. `CONFIRMED`.

### 2026
- **Churn com inadimplência**: opp `CHURN | AMMO VAREJO` (`zcrm_5938068000037158001`), criada 20/07/2026. Nota do mesmo dia, título "CHURN": *"CANCELAMENTO SEM AVISO PRÉVIO. MOTIVO: SOLICITAÇÃO DA DIRETORIA, SEM USO. DESLIGAR AMBIENTE. NÃO CANCELAR O 0800... NEGOCIAR VALOR EM ABERTO EM 2 PARCELAS. 03/08 E 03/09."* `CONFIRMED` (data da nota = criação da opp).
- **Valor em atraso**: nota 21/07/2026 "INADIMPLENCIA 21.161,90". `CONFIRMED`.
- **Detalhe de faturamento paralisado**: nota 23/07/2026 lista 2 contratos com faturamento parado: `CT-2417-01-2025` (ID 2417, R$2.415,94) e `CT-210-06/2025` (ID 595, R$157,08). O código `CT-2417-01-2025` **não aparece em `Contratos_001.csv`** — é uma numeração diferente do padrão `CT - 0xx - MM/AAAA` usado nos contratos nativos do módulo SalesOrders. `AMBIGUOUS`: pode ser um contrato de um módulo/planilha que não faz parte deste export, ou um erro de digitação do vendedor — não foi possível confirmar a origem desse código dentro dos CSVs disponíveis.
- **Conclusão**: Stage Faturamento (20/07) → Concluído (23/07). `CONFIRMED`.

**Estado atual conhecido (Postgres):** `negocios` tem 3 linhas — a tentativa Growth não existe (Stage Perdido, pipeline legado), mas as 2 opps de upgrade+800min existem (1 perdida, 1 `ganho` com `mrr_fechado=150.00`) e a renovação perdida também existe (`status='perdido'`). **O evento de CHURN de 20/07/2026 não está em `negocios`** — o registro `ganho` de R$150/mês continua ativo no CRM hoje (10/08/2026), **20 dias depois** do cancelamento documentado no Zoho, sem qualquer nota, `status_changes` ou campo refletindo a inadimplência de R$21.161,90. Esse é o gap mais recente e financeiramente mais grave dos 20 casos — não é resíduo de migração de 12/06/2026, é um evento posterior ao corte que simplesmente não tem canal de entrada no CRM novo hoje.

---

## 6. Compucenter Informática

**Zoho:** `Empresa Nome.id = zcrm_5938068000000760258` · CNPJ 86.505.419/0001-10 · Uberlândia/MG.

### 2024
- **Tentativa de integração de CRM**: opp `COMPUCENTER | INTEGRAÇÃO CRM | CINTHIA CUNHA` (`zcrm_5938068000002028086`), criada 31/01/2024, perdida em 07/02/2024. `CONFIRMED`.
- **Renegociação de preço (base)**: opp `COMPUCENTER I RENEGOCIAÇÃO (SOMENTE PREÇO)` (`zcrm_5938068000002372243`), criada 07/02/2024, Closed Won no mesmo dia, R$900,00, `Data de Fechamento` 02/01/2024 (retrodatada ~1 mês antes da criação). `CONFIRMED` para o fechamento; `INFERRED` que "renegociação" implica um contrato anterior — o nome do registro e o rótulo "SOMENTE PREÇO" sugerem que já existia uma relação anterior a este próprio CSV, mas não há um negócio-origem explícito no Zoho para confirmar isso além do texto do nome.

### 2025
- **Upgrade de linha perdido**: opp `COMPUCENTER | UP +1 LINHA | JÉSSICA`, criada 05/02/2025, perdida no mesmo dia. `CONFIRMED`.
- **Downgrade perdido**: opp `COMPUCENTER | DOWNGRADE DE 1 LINHA | JÉSSICA`, criada 05/02/2025, perdida. `CONFIRMED`.
- **Migração para Yeastar**: opp `COMPUCENTER INF | MIGRAÇÃO PARA YEASTAR | MAYARA` (`zcrm_5938068000026601087`), criada 04/12/2025, R$899,00, Ganho no mesmo dia; Faturamento só em 17/03/2026 (>3 meses depois do ganho — hiato grande entre venda e entrega/faturamento). `CONFIRMED` por Stage History; o hiato de 3 meses fica `AMBIGUOUS` sem nota explicando o motivo do atraso.

### 2026
- **Upgrade de linha**: opp `COMPUCENTER | UPGRADE LINHA | MAYARA` (`zcrm_5938068000028786001`), R$39,90, criada e ganha em 30/01/2026. `CONFIRMED`.
- **Churn**: opp `CAMPUCENTER | CHURN` (`zcrm_5938068000037929011`, note o erro de digitação no nome da empresa), criada 04/08/2026 — **6 dias antes desta auditoria**. Nota do mesmo dia, título "CHUNR": *"SEM AVISO. DESLIGAR ASSIM QUE A PORTABILIDADE FOR REALIZADA."* `CONFIRMED`.
- **Referência a contrato legado de 2021**: nota datada de **hoje, 10/08/2026 09:38** (a poucas horas desta própria auditoria), no módulo Accounts: *"4º TERMO ADITIVO - COMPUCENTER... TA 3 CT 5933-08-2021 ID 19005 R$983,66; PPA-734-01/2026 ID 959 R$39,90."* `CONFIRMED` que a nota existe com essa data e conteúdo; `INFERRED` que "CT 5933-08-2021" indica uma relação comercial real começando em agosto/2021 — 2 anos e meio antes do primeiro registro deste cliente em `Oportunidades de Vendas_001.csv` (fev/2024). Isso sugere fortemente que o histórico real do cliente é mais longo do que o que qualquer CSV consegue reconstruir; não há como confirmar o conteúdo desse contrato de 2021 nesta auditoria (não está em nenhum dos módulos exportados).

**Estado atual conhecido (Postgres):** `negocios` tem só 2 das 7 oportunidades — a integração perdida (Stage Closed Lost, migra) e a renegociação-base `ganho` (`mrr_fechado=900.00`). Nenhum dos outros 5 eventos (2 tentativas de 2025, migração Yeastar, upgrade, e principalmente o churn de 04/08) existe em `negocios`. O negócio-base continua `status='ganho'` **hoje**, na mesma semana em que o Zoho já registra cancelamento sem aviso e um histórico contratual de 2021. É, junto com Ammo Varejo, o caso mais recente e mais nítido de que o gap de churn não é só arqueologia da migração de 12/06 — é o comportamento atual do sistema.

---

## 7. Hospital Care | Caledonia

**Zoho:** `Empresa Nome.id = zcrm_5938068000000760213` · CNPJ 25.249439/0001-83 · Campinas/SP. Campo `Origem Empresa.id` aponta para `zcrm_5938068000000760214` ("HOSPITAL CARE - CASA DE SAÚDE"), uma segunda conta relacionada — não investigada em detalhe nesta frente, mas relevante pra quem for reconciliar grupos empresariais.

### 2021 (retrodatado)
- **Contrato inicial**: opp `HOSPITAL CARE CALEDONIA | CONTRATO INICIAL | CINTHIA CUNHA` (`zcrm_5938068000009734124`), `Data de Fechamento` e `Data de assinatura do contrato` = 15/12/2021, mas `Hora de Criação` do registro Zoho = 24/07/2024 (quase 3 anos depois). `AMBIGUOUS` na mesma linha do que Vetlog/Compucenter — retrodatação sem documento de origem no CSV, mas valor (R$16.636,31/mês) e Stage (Closed Won) documentados de forma consistente.

### 2023 (retrodatado)
- **Portabilidade de 165 números**: opp `8920 - HOSPITAL CARE (ALPHAVILLE) | PORTABILIDADE 165 NÚMEROS | VINICIUS PIRES` (`zcrm_5938068000003585351`), `Data de Fechamento` 31/12/2023, `Hora de Criação` 07/03/2024. Montante `-5775.00` (negativo — ajuste de linha, não venda nova). `AMBIGUOUS` pela mesma razão de retrodatação.

### 2024
- **Downgrade de 165 linhas — perdido**: opp `HOSP CARE CALEDONIA | DOWNGRADE 165L | CINTHIA` (`zcrm_5938068000003585373`), criada 07/03/2024, `Oportunidade Origem.id` aponta pro negócio de portabilidade (não pro contrato inicial). Nota do mesmo dia detalha o pedido: cancelamento de 99 ramais e 15 aparelhos IP, faixa 2300-2399. Perdido em 13/03/2024, motivo "Acompanhamentos perdidos". `CONFIRMED`.

### 2025
- **Downgrade #1 (assinado)**: opp `HOSPITAL CALEDONIA | DOWNGRADE | MAYARA` (`zcrm_5938068000022647058`), criada 25/08/2025, `Oportunidade Origem.id` aponta pro contrato inicial de 2021. Montante final `-7770.00`/mês. Contrato nativo `CT - 228 - 09/2025` criado 09/09/2025, **36 meses de prazo e 30% de multa** — termos de fidelidade completos para uma redução de MRR, não uma venda nova. `CONFIRMED` pelos campos do CSV; o fato de um downgrade ter 36 meses de lock-in novo é `AMBIGUOUS` quanto à lógica de negócio (não há nota explicando se é intencional).
- **Downgrade #2**: opp `HOSPITAL CARE | DOWNGRADE | MAYARA` (`zcrm_5938068000023456345`), criada 15/09/2025 — **20 dias depois** do downgrade #1, também com `Oportunidade Origem.id` apontando pro mesmo contrato inicial e a mesma proposta de `-7770.00`. `AMBIGUOUS`: não há como determinar pelos dados se este é (a) a mesma redução sendo renegociada uma segunda vez, (b) uma segunda redução adicional de mesmo valor, ou (c) um erro de duplicação de registro — os 2 valores são idênticos (`-7770`), o que favorece a hipótese (a)/(c) sobre (b), mas nenhuma nota resolve isso.

**Estado atual conhecido (Postgres):** `negocios` tem só as 2 oportunidades com Stage Closed Won — a portabilidade (`status='ganho'`, valor `-5775.00`) e o contrato inicial (`status='ganho'`, `mrr_fechado=16636.31`). **Nenhum dos 2 downgrades de 2025 existe em `negocios`** (Stage=Contrato, pipeline legado, 0% migração). O CRM hoje mostra o cliente com MRR fechado de R$16.636,31/mês — o mesmo valor de 2021 — sem qualquer redução, apesar de pelo menos 1 downgrade real de -R$7.770,00/mês estar formalizado em contrato nativo assinado. Se as 2 opps de downgrade forem a mesma redução (hipótese a/c acima), o MRR real seria ~R$8.866; se forem 2 reduções distintas, seria ~R$1.096 — a diferença entre essas 2 leituras é grande o suficiente para importar numa reconciliação futura, e este relatório não resolve qual delas é a correta.

---

## 8. Concessionária Rio Pax S/A

**Zoho:** `Empresa Nome.id = zcrm_5938068000000760164` · CNPJ 20.513.991/0001-13 · Rio de Janeiro/RJ. Nota lateral: existem 2 outras empresas no Zoho com o mesmo CNPJ raiz ("Agência Funerária Rio Pax do Centro" e "Rio Pax do Centro") — grupo econômico com múltiplas contas, não investigado a fundo aqui.

### 2024
- **Venda nova perdida**: opp `RIO PAX | VENDA NOVA SMALL | JACQUELINE`, criada 08/04/2024, Closed Lost. `CONFIRMED`.
- **Contrato Enterprise (base)**: opp `RIO PAX | ENTERPRISE | CINTHIA` (`zcrm_5938068000005507023`), criada 17/04/2024, R$3.999,90, Stage Concluído/Closed Won, `Data de assinatura do contrato` 14/05/2024. Contrato nativo `CT - 096 - 04/2024`, 36 meses, multa 30%, enviado 26/04. Fatura real emitida (`zcrm_5938068000007720009`, Status Faturado, Total R$3.999,90). ZohoSign `zcrm_5938068000006223001` enviado 29/04, mas consta `Status=Expired` mesmo com Jacqueline Toledo assinando no mesmo dia — outro documento com múltiplos destinatários e status final "Expired" apesar de assinatura parcial registrada (mesmo padrão ambíguo visto em LOGITHINK). `CONFIRMED` para valor/contrato/fatura; `AMBIGUOUS` para o significado prático de "Expired" com assinatura parcial.
- **Nota de reorganização de conta**: nota 04/06/2024 documenta que uma oportunidade antiga (SAFFE) foi cancelada e substituída, com faturamento retroativo de 07/03 a 05/2024 — evidência de reorganização manual de conta dentro do próprio Zoho. `CONFIRMED`.
- **Controle de pausa — perdido**: opp `RIO PAX | CONTROLE DE PAUSA`, criada 22/11/2024, perdida 29/11 (nota: "cliente extrapola o pacote contratado todo mês"). `CONFIRMED`.

### 2025
- **Desenvolvimento Callface — perdido**: criada 13/01/2025, perdida 31/01. `CONFIRMED`.
- **Controle de pausa (2ª tentativa) — perdido**: criada 04/06/2025, perdida 30/06. `CONFIRMED`.
- **Novo 0800 — perdido**: criada 18/06/2025, perdida 30/06, `Oportunidade Origem.id` aponta pro contrato Enterprise. `CONFIRMED`.
- **Upgrade de gravações — ganho e assinado**: opp `zcrm_5938068000020123001`, criada 27/06/2025, R$329,90. Contrato `CT - 212 - 06/2025` assinado via ZohoSign 27→30/06/2025 (3 signatários). `CONFIRMED`.
- **Reformulação do 0800 — ganho e assinado**: opp `RIO PAX - REFORMULAÇÃO DO 0800 - MAYARA` (`zcrm_5938068000019142219`), criada 04/06/2025, R$2.499,90, `Data de assinatura do contrato` 31/10/2025. Contrato `CT - 242 - 10/2025` enviado 31/10, status "Enviado ao Cliente"; ZohoSign do mesmo documento aparece 2 vezes no export (`zcrm_5938068000025213009` Expired, `zcrm_5938068000025233001` Drafted) — 2 tentativas de envio para o mesmo contrato, com o 2º signatário (Filipe Nascimento, interno) assinando em 04/12. `CONFIRMED` para valor e reenvio; `AMBIGUOUS` se o contrato foi de fato finalizado (nenhum dos 2 registros ZohoSign consta "Signed" no nível do documento, apesar de recipients individuais terem assinado).
- **Contrato novo (grande) — perdido**: opp `RIO PAX | CONTRATO NOVO | MAYARA`, criada 03/09/2025, R$17.105,39 — maior valor de toda a conta —, perdida 30/09. `CONFIRMED`.

### 2026
- **Upgrade de linhas — assinado**: opp `zcrm_5938068000034079175`, criada 26/05/2026, R$59,80. Contrato `CT - 287 - 05/2026` assinado 28/05/2026 (mesmo dia). `CONFIRMED`.
- **Upgrade de linhas #2**: opp `zcrm_5938068000037572086`, criada 28/07/2026, R$149,50, `Oportunidade Origem.id` aponta pro upgrade de maio. Contrato `CT - 306 - 07/2026` enviado 28/07, 2 de 3 signatários assinaram no mesmo dia (Bruno Reis pendente). `CONFIRMED` para envio/assinaturas parciais.

**Estado atual conhecido (Postgres):** de 12 oportunidades no Zoho, `negocios` tem **5**: venda nova perdida, controle de pausa (x2, ambas perdidas), desenvolvimento Callface (perdido) e upgrade de gravações (`ganho`, `mrr_fechado=509.80`). **O contrato Enterprise-base (R$3.999,90, faturado e assinado em 2024) e a reformulação do 0800 (R$2.499,90, assinada out/2025) não existem em `negocios`** — o cliente aparece hoje no CRM como uma conta majoritariamente `perdido`, sem o contrato real que sustenta a relação desde 2024. Curiosidade adicional: a busca por nome (não por `zoho_id`) encontrou um negócio chamado "RIO PAX | UPGRADE DE LINHAS | MAYARA" no CRM com `zoho_id=5938068000037847015` — um ID diferente do `zoho_id=5938068000037572086` que aparece no export Zoho para o que parece ser a mesma oportunidade (mesmo nome, mesmo valor R$149,50, mesma janela de datas). `AMBIGUOUS`: não foi possível determinar se são 2 registros Zoho distintos para o mesmo evento (sync reverso CRM→Zoho criando um 2º registro) ou coincidência de nomenclatura — mas o padrão é o mesmo observado adiante em G30/Venda na Veia (seções 15 e 16).

---

## 9. São Leopoldo Mandic (Campinas)

**Zoho:** `Empresa Nome.id = zcrm_5938068000000760160` · CNPJ 04.600.555/0001-25 · Campinas/SP · Educação. 13 contatos distintos ao longo do tempo (múltiplos campi/unidades — Arcoverde, Araras, Limeira).

### 2022 (retrodatado)
- **Renovação-base**: opp `SL MANDIC | RENOVAÇÃO CALLFACE` (`zcrm_5938068000002372278`), `Data de Fechamento` e `Data de assinatura do contrato` = 29/11/2022, `Hora de Criação` do registro = 07/02/2024, R$19.988,00, Stage Closed Won. `AMBIGUOUS` por retrodatação (mesmo padrão de Vetlog/Hospital Care/Compucenter — o valor e status são consistentes, a data de origem exata não tem documento comprobatório no CSV).

### 2024
- **Upgrade de unidade (Arcoverde)**: opp `zcrm_5938068000001638190`, criada 24/01/2024, R$504,00, `Oportunidade Origem.id` aponta pra renovação-base — mesmo esta tendo sido criada 2 semanas *depois* (07/02) da opp que a referencia como origem. `AMBIGUOUS`: ordem cronológica de criação invertida entre origem e evento — possível porque a "origem" foi retrodatada (fechamento 2022) enquanto o registro dela no Zoho só foi criado depois; não é evidência de erro, é efeito colateral da retrodatação.
- **Upgrade (São Paulo)**: opp `zcrm_5938068000001638223`, criada 24/01/2024, R$84,00, contrato `CT - 019 - 01/2024` assinado, 2 faturas emitidas (R$504 e R$84). `CONFIRMED`.
- **Tentativa Fanvil V67 — perdida**: criada 08/02/2024, Closed Lost em 16/09/2024. `CONFIRMED`.
- **02L+80R — perdido**: criada 22/04/2024, perdido. `CONFIRMED`.
- **AP X3S — perdido**: criada 22/04/2024, Closed Lost. `CONFIRMED`.
- **Renovação (Fábio Rosa) — perdida**: criada 22/08/2024, Trial→Proposta→Perdido em 23/08. `CONFIRMED`.
- **Novo 4003/4004 — perdido**: criada 19/09/2024, perdido no mesmo dia (nota: aprovado desconto de 10% pelo Gustavo Santos, mas não fechou). `CONFIRMED`.
- **Discador preditivo integrado ao PABX — perdido**: criada 19/09/2024. Nota de 08/10/2024 lista issues técnicos reais do projeto (portabilidade pra detecção de caixa postal, cobrança por minuto, leads ruins do cliente, identificação de spam, limite de 14 chamadas simultâneas) — evidência de que o projeto avançou tecnicamente antes de ser perdido. `CONFIRMED`.

### 2025
- **Serviço de migração — perdido**: criada 15/07/2025, Closed Lost 22/07. `CONFIRMED`.
- **Callface Discadora — ganho e assinado**: opp `zcrm_5938068000022979182`, criada 03/09/2025, R$900,00, ciclo completo Ganho→Faturamento→Concluído→Contrato→Ganho novamente→Faturamento→Concluído→Closed Won (11 transições de estágio entre 03/09/2025 e 13/01/2026 — o ciclo mais longo/reprocessado desta conta). Contrato `CT - 238 - 10/2025`. Aditivo assinado via ZohoSign entre 14/11 e 28/12/2025 (4 signatários, todos "Signed"). `CONFIRMED`.

### 2026
- **Renovação 48 meses (em curso)**: opp `SL MANDIC | RENOVAÇÃO CALLFACE | MAYARA` (`zcrm_5938068000028129013`), criada 15/01/2026, valor evoluindo de R$19.988,00 (repetição do valor-base de 2022) para R$16.252,68, com `Prazo Contrato` chegando a 48 meses. Status em 03/08/2026 (data da última extração no CSV): `Negotiation/Review`. Contrato nativo `CT - 273 - 04/2026` criado 08/04/2026, total R$15.600,00, multa 30%. `CONFIRMED` pelas datas de Stage History; o negócio está genuinamente em aberto — não é um gap de migração, é uma negociação real ainda não fechada.

**Estado atual conhecido (Postgres):** `negocios` tem **7** das 12 oportunidades (falta principalmente as tentativas perdidas de menor valor). O negócio-base (`SL MANDIC | RENOVAÇÃO CALLFACE`, `zoho_id=...2372278`) está com `status='ganho'`, `ganho_at='2022-11-28 21:00:00-03'` — confirmando a retrodatação também no lado do CRM. A renovação de 2026 está com `status='trava_assinatura'` (mapeamento plausível pra "Negotiation/Review", mudou de `negociacao_iniciada` pra `proposta_apresentada` pra `trava_assinatura` em 3 transições nativas do próprio CRM, sem marcador "Zoho:" — ou seja, esse trecho final da jornada já é dado novo, gerado organicamente pelo CRM, não herdado). Discrepância principal: a conta aparece fragmentada em 7 negócios sem conexão visível entre eles no CRM (não há campo que amarre "upgrade de 2024" ao "contrato-base de 2022" como o Zoho faz via `Oportunidade Origem`).

---

## 10. Grupo Ri Happy

**Zoho:** `Empresa Nome.id = zcrm_5938068000000760217` · CNPJ 58.731.662/0001-11 · São Paulo/SP · Varejo.

### 2022 (retrodatado)
- **Contrato-base via migração de sistema**: opp `RI HAPPY | ORIGEM AUTOTASK | JACQUELINE` (`zcrm_5938068000007375005`), `Data de Fechamento`/`assinatura` = 06/06/2022, `Hora de Criação` = 27/05/2024 (2 anos depois). Nota de 03/06/2024 confirma explicitamente: *"Contratos anexados na oportunidade são apenas da renovação de 06/06/2022 pra frente"* — ou seja, o próprio time documentou que este registro é uma reconstrução retroativa de um histórico que já existia num sistema anterior (AutoTask), não um registro nativo desde o início. `CONFIRMED` que a reconstrução foi intencional e documentada (nota explícita) — diferente dos outros casos de retrodatação silenciosa vistos nas seções anteriores.

### 2024
- **Downgrade de 37 ramais — perdido após retomada**: opp `zcrm_5938068000001607028`, criada 23/01/2024, ciclo longo (Proposta→Trial→Proposta→Contrato→Perdido) até 26/06/2024. `CONFIRMED`.
- **Fluxo de assinatura documentado**: nota 19/06/2024 no nível da Account lista uma cadeia de aprovação formal em 4 etapas (validador → testemunha → 2 representantes legais → cópia) — evidência de processo de compliance corporativo do cliente. `CONFIRMED`.
- **Renovação — perdida**: opp `zcrm_5938068000008388013`, criada 21/06/2024, negociada até setembro, perdida. Nota 01/07/2024 pede atualização de fluxo de assinatura pra reenvio via DocuSign — segundo sistema de assinatura mencionado (ver achado #4 da Fase 1, `01-inventario-zoho.md`). `CONFIRMED`.

### 2025
- **Renovação (Letícia) — enviada, sem fechamento registrado**: opp `zcrm_5938068000018187099`, criada 17/04/2025, Stage final "Proposta Enviada" sem transição de perda ou ganho subsequente registrada no CSV. `AMBIGUOUS`: não há como saber pelo dado se ela foi abandonada silenciosamente, se ainda está em negociação passiva, ou se um sync perdeu o desfecho.
- **Upgrade de aparelhos — ganho e assinado**: opp `zcrm_5938068000022979031`, criada 03/09/2025, R$400,00, ciclo completo até Closed Won em 08/10/2025. Contrato `CT - 227 - 09/2025`. `CONFIRMED`.
- **Locação de nobreak — ganho**: opp `zcrm_5938068000024504001`, criada 09/10/2025, R$7.400,00 (à vista), Contrato `CT - 237 - 10/2025`. Nota de 12/03/2026 corrige uma cobrança duplicada indevida ("REALIZAMOS A ENTREGA DO SERVIÇO... POR GENTILEZA NÃO COBRAR NOVAMENTE"). `CONFIRMED`.
- **Upgrade de linhas — perdido**: opp `zcrm_5938068000026237066`, criada 26/11/2025, negociado até 06/05/2026, perdido (motivo "Outro"). `CONFIRMED`.

### 2026
- **Mensageria em massa (proposta em aberto)**: opp `RIHAPPY | MENSAGERIA | MAYARA` (`zcrm_5938068000037862001`), criada 03/08/2026 — **uma semana antes desta auditoria**, R$7.850,00, `Oportunidade Origem.id` aponta pro upgrade de aparelhos. Ainda em Proposta Enviada no snapshot de 10/08. `CONFIRMED` — é um negócio genuinamente em aberto, não um gap.

**Estado atual conhecido (Postgres):** `negocios` tem **3 das 8** oportunidades: o contrato-base AutoTask (`status='ganho'`, `mrr_fechado=15774.61`), o upgrade de aparelhos (`ganho`, R$400) e a locação de nobreak (`ganho`, R$7.400, mas `mrr_fechado=0.00` — condizente com ser venda à vista, não recorrente). As 2 tentativas de downgrade/renovação perdidas de 2024, a proposta sem desfecho de 2025 e o upgrade de linhas perdido de 2025 não aparecem. A proposta de mensageria de agosto/2026 (aberta há 1 semana) também ainda não tem negócio correspondente — o que é esperado, dado o tempo curto, mas vale monitorar se ela vai migrar quando (se) fechar.

---

## 11. Swiss Park Office

**Zoho:** `Empresa Nome.id = zcrm_5938068000000760256` · CNPJ 16.881.910/0001-60 · Campinas/SP.

### 2022 (retrodatado)
- **Contrato inicial**: opp `SWISS PARK OFFICE | CONTRATO INICIAL | CINTHIA` (`zcrm_5938068000005060197`), `Data de Fechamento`/`assinatura` = 31/05/2022, `Hora de Criação` = 10/04/2024, R$4.765,00, Closed Won. `AMBIGUOUS` (mesmo padrão de retrodatação sem documento de origem).

### 2024
- **Upgrade 02R (Cinthia)**: opp `zcrm_5938068000005060213`, criada 10/04/2024, R$30,00, `Oportunidade Origem.id` = contrato inicial. Contrato `CT - 087 - 04/2024` assinado via ZohoSign 15→16/04 (3 signatários). `CONFIRMED`.
- **Upgrade 02R (Cinthia Cunha, 2ª rodada)**: opp `zcrm_5938068000007810001`, criada 07/06/2024, R$60,00. Contrato `CT - 115 - 06/2024` assinado 10→12/06. Fatura emitida (R$60,00). `CONFIRMED`.
- **10 ramais**: opp `zcrm_5938068000009636089`, criada 22/07/2024, R$300,00. Contrato `CT - 128 - 07/2024` assinado 22→24/07. Fatura emitida. `CONFIRMED`.

### 2025
- **Upgrade 02 ramais (Mayara)**: opp `zcrm_5938068000025108033`, criada 29/10/2025, R$60,00, `Oportunidade Origem.id` = contrato inicial de 2022. Contrato aditivo `CT - 241 - 10/2025` assinado no mesmo dia (29/10). `CONFIRMED`.
- **Migração para Yeastar**: opp `SWISS PARK | MIGRAÇÃO PARA YEASTAR | MAYARA` (`zcrm_5938068000025164004`), criada 30/10/2025, R$4.039,90 — quase igual ao valor do contrato-base original. Ciclo até Concluído em 21/01/2026. Contrato novo `CT - 246 - 12/2025` assinado 02→03/12/2025 (4 signatários, incl. "Tomaz"/AGV Empreendimentos — possível terceiro administrador do condomínio, não visto nos contatos anteriores). `CONFIRMED`.

**Estado atual conhecido (Postgres):** `negocios` tem **apenas 1 das 6** oportunidades — o contrato inicial de 2022 (`status='ganho'`, `mrr_fechado=4765.00`). Todos os 3 upgrades assinados de 2024 (Stage final "Concluído", não "Closed Won" — mesmo tendo o mesmo grau de formalização contratual, com ZohoSign e fatura reais) e a migração de hardware assinada em dezembro de 2025 (R$4.039,90, quase dobrando o MRR real da conta) estão ausentes. O CRM hoje mostra este cliente com MRR fechado de R$4.765,00; somando os 5 eventos com contrato nativo assinado e confirmado (R$4.765,00 + R$30,00 + R$60,00 + R$300,00 + R$60,00 + R$4.039,90), o MRR real seria pelo menos **R$9.254,90** — quase o dobro do valor visível.

---

## 12. Tozzini Freire POA

**Zoho:** `Empresa Nome.id = zcrm_5938068000011190001` · CNPJ 48.109.110/0003-84 · Porto Alegre/RS · Jurídico (escritório de advocacia, filial de Porto Alegre — existem outras 2 contas relacionadas no Zoho: "Tozzini Advogados" e "Tozzini e Freire Borges Lagoa", grupo com múltiplas unidades, não investigadas em detalhe aqui).

### 2024
- **Downgrade solicitado**: opp `TOZZINI FREIRE POA | DOWNGRADE` (`zcrm_5938068000011218001`), criada 04/09/2024. Nota do mesmo dia detalha o pedido: cancelamento de 99 ramais e 15 aparelhos IP, faixa 2300-2399. `CONFIRMED`.
- **Ajuste de valor**: nota 09/09/2024 registra ajuste pra R$28,81/ramal após confronto com valor informado pelo cliente. `CONFIRMED`.
- **Contrato de downgrade assinado**: `CT - 192 - 12/2024`, criado 04/12/2024, multa 30%, valor final -R$2.852,19 (redução de MRR formalizada em contrato). `CONFIRMED` — apesar do Stage final da opp ser "Perdido" (16/09/2024, antes até do contrato ser gerado em dezembro), o que é `AMBIGUOUS`: o contrato nativo tem data de envio posterior à data em que a oportunidade já constava como "Perdido" no Stage History. Duas leituras possíveis: (a) a oportunidade foi reaberta informalmente e o contrato saiu depois, sem atualizar o Stage; ou (b) o contrato se refere a uma negociação that continuou por fora do fluxo de oportunidade formal. Não é possível decidir entre as duas com os dados disponíveis.

### 2025
- **Renovação — perdida por falta de acompanhamento**: opp `TOZZINI | RENOVAÇÃO CALLFACE POA | RENATO` (`zcrm_5938068000017052083`), criada 05/03/2025, R$4.946,36, `Oportunidade Origem.id` = downgrade de 2024. Perdida no mesmo dia, motivo "Acompanhamentos perdidos". `CONFIRMED`.
- **Churn**: opp `TOZZINI | CHURN` (`zcrm_5938068000020475053`), criada 07/07/2025, `Oportunidade Origem.id` também aponta pro downgrade de 2024 (não pra renovação perdida — a cadeia bifurca em vez de ser linear). Stage Concluído em 04/09/2025. Sem nota associada. `CONFIRMED` a existência e datas; `INFERRED` que representa churn efetivo — sem nota de conteúdo, a classificação vem só do nome do registro (mesma limitação estrutural documentada na Fase 1, achado #1 do `03-reconciliacao-oportunidades.md`).

**Estado atual conhecido (Postgres):** a empresa **existe** em `empresas` (zoho_id bate) e há 1 lead associado ("Contato — Tozzini Freire POA"). Mas `negocios` filtrado por `zoho_id` das 3 oportunidades retorna **0 linhas** — nenhuma das 3 (downgrade com contrato assinado, renovação perdida, churn) tem equivalente. É o único caso dos 20 onde a empresa tem presença estrutural no CRM (CNPJ, lead) mas a camada comercial inteira (negócio, contrato, proposta) está zerada, apesar de haver 1 contrato nativo real assinado com multa de 30%.

---

## 13. Facilita Telecom (agregado — revenda multi-unidade)

**Zoho:** `Empresa Nome.id = zcrm_5938068000001431001` · CNPJ 13.045.960/0001-10 · Ubá/MG · 68 oportunidades, a maior cadeia do dataset inteiro (33 elos via `Oportunidade Origem`, 22 deles marcados CHURN/UPGRADE/DOWNGRADE).

**Padrão confirmado (consistente com `03-reconciliacao-oportunidades.md`, seção 3):** Facilita Telecom é uma revenda que fecha contratos Callface em nome de dezenas de prefeituras municipais mineiras (Prefeitura de Ituranga, Cajuri, Astolfo Dutra, Prados, Casa Grande, Capela Nova, Cel Pacheco, Plan Minas, Liberdade, Catas Altas da Noruega, Vieiras, Ilicínea, Antônio Prado de Minas, Rosário da Limeira, Dores de Campos, Catas Altas, Chácara, Itatiaiuçu, Antônio Carlos, e outras) — cada prefeitura é uma oportunidade separada sob a mesma conta-empresa, exatamente como a Fase 1 já havia identificado pra Facilita/Mais Tec/Mandic Araras.

### 2024 (rampa de aquisição)
- **~26 oportunidades ganhas** entre 18/01/2024 e 11/10/2024, a maioria Stage "Concluído" (valores de R$0 a R$1.819,90), cada uma nomeada `FACILITA | [PORTE] | PREF [MUNICÍPIO]`. `CONFIRMED` por `Hora de Criação` e `Data de Fechamento` de cada registro individual (não listado linha a linha aqui por volume — ver `dumps/FACILITA_TELECOM.txt` gerado nesta sessão pra lista completa).

### 2025 (início da onda de churn)
- **Pesquisa de satisfação — perdida**: 03/02/2025.
- **Onda de CHURN por prefeitura, uma a uma**: entre 21/07/2025 e 20/05/2026, pelo menos **18 oportunidades distintas** nomeadas `[PREFEITURA] | CHURN` ou `CHURN | FACILITA | [PREFEITURA]`, cada uma com `Oportunidade Origem.id` apontando pro contrato original daquela prefeitura específica — Chácara (21/07/2025), Capela Nova (21/07/2025), Tabuleiro (21/07/2025), Araponga (24/07/2025), Taksu Varginha (24/07/2025), Cajuri (24/07/2025), Santa Cruz (24/07/2025), Dores de Campos (24/07/2025), Prefeitura de Paiva (20/08/2025), Coronel (25/08/2025), Liberdade (04/09/2025), Cerealista Pereira (13/11/2025), Clínica NLM (06/01/2026), Plan Minas (06/01/2026), Catas Altas da Noruega (06/01/2026), Catas Altas (06/01/2026), Serra do Salitre (26/02/2026), Simonésia (26/03/2026), Ibatiba (09/04/2026), Assa Abloy (18/05/2026). `CONFIRMED` por `Hora de Criação` de cada registro — todos ficam em `Stage=Contrato`, o valor da pipeline legado com 2,9% de migração (achado #3 da Fase 1).

### 2026
- **Upgrade real e faturado**: opp `FACILITA | SANTA GERTRUDES | UPGRADE LINHAS`, criada 24/04/2026, R$2.481,70, assinada no mesmo dia. `CONFIRMED` — mostra que a conta continua ativa e crescendo em paralelo à onda de churns de unidades específicas (é uma revenda com múltiplas unidades: algumas prefeituras saem, outras crescem, simultaneamente).

**Estado atual conhecido (Postgres):** de 68 oportunidades, `negocios` tem **15**, quase todas do lote de aquisição de 2024 com Stage Closed Won/Won. **Nenhum dos ~18-20 eventos de CHURN por prefeitura está em `negocios`.** Isso significa que, hoje, o CRM mostra várias prefeituras específicas (ex.: Prefeitura de Chácara, Prefeitura de Antônio Carlos, Prefeitura de Nazareno via Mais Tecnologia — ver seção 14) como `status='ganho'`, quando o próprio Zoho documenta que elas churnaram entre julho/2025 e maio/2026. Este é o caso de maior volume de eventos de churn não refletidos entre os 20 selecionados.

---

## 14. Mais Tecnologia (agregado — mesmo padrão de revenda)

**Zoho:** `Empresa Nome.id = zcrm_5938068000002980022` · 34 oportunidades, 9 eventos de lifecycle (13 elos totais via Origem).

**Achado lateral relevante**: várias oportunidades desta conta usam `ContatoID` que pertence aos contatos da **Facilita Telecom** (`zcrm_5938068000001431006` "Rodrigo Carvalho", `zcrm_5938068000004806001` "Alyson Valverde - Facilita Telecom") — e pelo menos 1 oportunidade desta conta se chama literalmente `FACILITA | MEDIUM CEREALISTA PEREIRA | JESSICA MARQUES`, apesar de `Empresa Nome.id` apontar pra Mais Tecnologia, não pra Facilita. `CONFIRMED` por inspeção direta dos IDs — `INFERRED` que Facilita Telecom e Mais Tecnologia são operacionalmente relacionadas (mesmo grupo de revenda, ou pelo menos o mesmo vendedor tratando as duas contas de forma intercambiável) — não há confirmação documental explícita dessa relação, é dedução a partir do cruzamento de contatos e nomenclatura.

### 2024
- **~15 oportunidades ganhas** entre 23/02/2024 e 25/12/2024, mesmo padrão de "1 prefeitura/cliente por oportunidade" (Simonésia, Drogaria do Bairro, Pref Tabuleiro, Consórcio 8 de Abril, Toksu, Pref Antônio Carlos, Nazareno, Paiva, Carvalhos, Piraúba, Campanha, Assa Abloy, São João del Rei, Cislave, Campos Gerais, São Sebastião da Vargem Alegre, Policlínica de Barbacena, Canaã, "Mais Tecnologia Large"). `CONFIRMED` por `Hora de Criação` individual.

### 2025-2026 (onda de churn nº 2)
- **8 oportunidades de CHURN** entre 25/08/2025 e 06/01/2026: Piraúba, Carvalhos, Cislave, Ituranga, Ijaci, Campanha, São João del Rei, Drogaria do Bairro — todas em `Stage=Contrato`, todas com `Oportunidade Origem.id` apontando pro ganho original de 2024. `CONFIRMED` por data de criação de cada uma.
- **Upgrade real em paralelo**: `FACILITA | UPGRADE LINHAS | PREF STA GERTRUDES | MAYARA`, 16/10/2025, R$285,00 — mesma lógica de crescimento simultâneo ao churn observada em Facilita Telecom. `CONFIRMED`.

**Estado atual conhecido (Postgres):** de 34 oportunidades, `negocios` tem **7** — só as ganhas de 2024 com Stage explicitamente Closed Won (Nazareno, Piraúba, Cislave, Policlínica de Barbacena, +2 perdidas). **Nenhum dos 8 CHURN de 2025-2026 está presente.** Municípios como Piraúba, Cislave e Nazareno aparecem hoje no CRM como `status='ganho'` apesar do próprio Zoho documentar o cancelamento de cada um deles entre agosto/2025 e janeiro/2026.

---

## 15. MARU - Maria Eugenia

**Zoho:** `Empresa Nome.id = zcrm_5938068000017513001` · documento fiscal mexicano (formato RFC, não CNPJ) · sem cidade/UF preenchida — negócio internacional.

### 2025
- **Oportunidade única**: `MX- CallFace Telefonia - MARU Distribuidor Eleazar` (`zcrm_5938068000017513023`), criada 21/03/2025, R$88.437,84 — **o maior valor nominal de Montante de toda a base Zoho**. Fonte de Lead "Account Executive". `CONFIRMED`.
- **Proposta enviada e negócio perdido em 10 dias**: Stage History mostra Trial (21/03) → Proposta Enviada (21/03) → Perdido (31/03). Motivo "Acompanhamentos perdidos". `CONFIRMED`.

**Estado atual conhecido (Postgres):** `empresas` e o lead existem (contato "Maria Eugenia", status `novo`). `negocios` retorna **0 linhas**. **Isso não é necessariamente um gap grave**: o negócio nunca fechou (Perdido em 10 dias, sem contrato, sem proposta local, sem nota), então a ausência de um `negocio` correspondente é consistente com "nunca foi ganho" — o CRM não precisa ter um negócio pra cada oportunidade perdida do Zoho pra estar "certo". O achado real aqui é de **leitura**: o "maior cliente" do Zoho por valor nominal nunca foi cliente — é um alerta pra qualquer análise futura que usar `Montante` bruto como proxy de receita histórica sem filtrar por Stage.

---

## 16. FIEMT

**Zoho:** `Empresa Nome.id = zcrm_5938068000002721151` · CNPJ 03.750.189/0001-28 · Federação da Indústria do Estado do Mato Grosso.

### 2023 (retrodatado) / 2024
- **Oportunidade única**: `FIEMT | 1500R | CINTHIA CUNHA` (`zcrm_5938068000002721156`), `Hora de Criação` 19/02/2024, `Data de Fechamento` 31/12/2023 (retrodatada ~7 semanas antes da criação), R$83.940,00 — 2º maior valor nominal da base. `CONFIRMED` pros campos, `AMBIGUOUS` pro motivo da retrodatação curta.
- **Nota de instrução de proposta**: 19/02/2024, pedindo geração de proposta "conforme está no AutoTask Opportunity - ID 18894 - SFIEMT... com os valores de tabela cheia conforme antigo modelo de vendas" — confirma que esta conta também vem de uma migração de sistema anterior (AutoTask), como Grupo Ri Happy. `CONFIRMED`.
- **Proposta gerada em tabela cheia**: proposta `PPA - 085 - 02/2024` (`zcrm_5938068000002740155`), Total **R$218.355,09** — mais que o dobro do valor final da oportunidade (R$83.940,00) —, itens incluindo 1.500 licenças de call center a R$67.500,00/mês. `CONFIRMED` por leitura direta do CSV.
- **Perda**: Trial → Perdido em 22/02/2024, motivo "Cliente não qualificado". `CONFIRMED`.

**Estado atual conhecido (Postgres):** `empresas` e o lead existem. `negocios` = 0. Mas **a proposta órfã sobreviveu**: existe 1 linha em `propostas` com `status='rascunho'`, `total_geral=218355.09`, sem `negocio_id` — ou seja, a proposta "tabela cheia" (não o valor real negociado de R$83.940,00) é o único vestígio deste negócio de R$84 mil no CRM hoje, flutuando sem contexto comercial nenhum. Isso confirma diretamente o achado #3 da Fase 1 (`04-reconciliacao-propostas-contratos.md`): propostas sobrevivem melhor que negócios, mas sem o negócio-pai elas ficam sem sentido pra quem for ler o CRM hoje.

---

## 17. Mauloni Comércio de Veículos

**Zoho:** `Empresa Nome.id = zcrm_5938068000031809001` · CNPJ 07.962.394/0002-99.

### 2026
- **Proposta White Label recusada**: opp `MAULONI COMERCIO | CALLFACE AI WHITE LABEL | MAYARA` (`zcrm_5938068000031809010`), criada 09/04/2026, R$58.940,00 — 5º maior valor nominal. Reunião registrada 02/04/2026 ("Mauloni Veiculos", 16:30-17:30). Closed Lost no mesmo dia da criação da proposta (09/04). `CONFIRMED`.

**Estado atual conhecido (Postgres):** `negocios` tem exatamente 1 linha, `status='perdido'`, `valor_total=58940.00`, batendo perfeitamente com o Zoho. **Este é o caso de melhor fidelidade de migração dos 20 selecionados** — negócio perdido, sem contrato, sem assinatura, representado de forma idêntica nas duas fontes. Incluído na amostra propositalmente como contraponto: nem todo negócio do Zoho tem gap — quando o negócio nunca avançou além de proposta perdida, a migração tende a funcionar bem (reforça a leitura da Fase 1 de que o problema é concentrado em Stage="Contrato"/"Concluído"/eventos pós-venda, não em perdas simples).

---

## 18. Prefeitura Municipal de São João del Rei

**Zoho:** `Empresa Nome.id = zcrm_5938068000013942001` · sem CNPJ preenchido (campo "0").

### 2024
- **Oportunidade única**: `PREF SÃO JOÃO DEL REI` (`zcrm_5938068000013925001`), criada 04/11/2024, R$65.904,03 — 3º maior valor nominal. Proposta enviada mesmo dia (`PPA - 369`, Estágio "Propsta Perdida" — note o typo herdado, já documentado na Fase 1 achado #10), com 11 itens de linha detalhados (300 ramais, licenças, etc). `CONFIRMED`.
- **Perda rápida**: Perdido em 05/11/2024 (1 dia depois). `CONFIRMED`.
- **Notas de processo interno**: 04-05/11/2024 mostram o fluxo real de geração de proposta pra órgão público (exigência de itens no formato exato do edital) e uma reclamação de acesso ("Precisa passar para meu nome para eu acessar"). `CONFIRMED`.

**Estado atual conhecido (Postgres):** **ausência total** — `empresas`, `negocios`, `leads`, `propostas` retornam 0 linhas todas as consultas, mesmo por `zoho_id` direto. Diferente de MARU/FIEMT (que ao menos têm lead/proposta órfã), este negócio de R$65.904,03 não deixou rastro nenhum no CRM novo, apesar de ter avançado até proposta formal com 11 itens detalhados e discussão de acesso ao registro.

---

## 19. Prefeitura de Caruaru

**Zoho:** `Empresa Nome.id = zcrm_5938068000033458086` · CNPJ 10.091.536/0001-13 · origem "Parceiro".

### 2026
- **Oportunidade aberta em curso**: `PREF DE CARUARU | 3CX | MAYARA` (`zcrm_5938068000033458091`), criada 14/05/2026, R$28.429,76. Stage evoluiu de Proposta Enviada pra "Proposal/Price Quote" no mesmo dia (13:10). No snapshot de 03/08/2026, ainda está neste estágio — negócio genuinamente em aberto, sem desfecho registrado. `CONFIRMED`.

**Estado atual conhecido (Postgres):** diferente do que uma busca inicial por nome de empresa sugeriu (0 resultados), uma busca direta por `zoho_id` do negócio confirma que ele **existe** em `negocios`, com `status='proposta_apresentada'` — mapeamento correto pro Stage "Proposal/Price Quote" do Zoho, e `status_changes` com as 2 transições esperadas. **O gap real aqui não é o negócio — é a empresa**: não existe nenhuma linha em `empresas` pra esta prefeitura (nem por nome nem por `zoho_id`), e o `negocio_id` está associado a um `lead` cujo campo `empresa_id` também está vazio (só o campo de texto livre `empresa='PREFEITURA DE CARUAU'` existe). Ou seja, o CNPJ e os metadados estruturados de empresa (que existem no Zoho) nunca ganharam uma linha própria no CRM novo — o negócio "flutua" ligado só a um lead com texto livre. Incluído como contraponto explícito: mostra que negócio pode migrar corretamente enquanto o registro de empresa (dado estruturado, CNPJ) fica de fora.

---

## 20. G30 Educação Automotiva

**Zoho:** `Empresa Nome.id = zcrm_5938068000030426001` · CNPJ 55.617.458/0001-86 · Barueri/SP.

### 2026
- **Aquisição Callface AI**: opp `zcrm_5938068000030426036`, criada 11/03/2026, R$1.619,10, ganha e faturada via Stripe (nota confirma: "PAGAMENTO VIA STRIPE - TODO DIA 21"). `CONFIRMED`.
- **White Label (grande)**: opp `GRUPO G30 | WHITE LABEL | MAYARA | STRIPE` (`zcrm_5938068000030539051`), criada 12/03/2026, R$24.450,00. Contrato `CT - 271 - 03/2026` assinado via ZohoSign 25→27/03/2026 (4 signatários, todos "Signed"). Nota de faturamento explica cobrança parcelada em 4x via boleto/DDA. `CONFIRMED`.
- **Upgrade perdido**: opp `zcrm_5938068000035428001`, criada 15/06/2026, R$1.079,40, Closed Lost 22/06. `CONFIRMED`.
- **Upgrade duplicado**: 2 oportunidades **idênticas** — mesmo nome (`G30 | UPGRADE CALLFACE AI | MAYARA`), mesmo valor (R$1.439,20), Closed Won — criadas em 03/08/2026, com apenas 19 minutos de diferença entre elas (10:26:05 e 10:45:00) e `zoho_id` diferentes (`zcrm_5938068000037830099` e `zcrm_5938068000037830238`). `CONFIRMED` que os 2 registros existem e são visualmente idênticos; `AMBIGUOUS` a causa raiz — não é possível confirmar pelos CSVs se foi 1 clique duplo do vendedor, um reenvio manual, ou o sync reverso CRM→Zoho criando 2 cópias do mesmo evento.

**Estado atual conhecido (Postgres):** `negocios` tem **5** linhas, espelhando as 5 oportunidades do Zoho **incluindo a duplicata** — os 2 negócios de R$1.439,20 existem em `negocios` com `zoho_id` diferentes e foram criados no **mesmo milissegundo exato** (`2026-07-20 14:08:57.429` e `...447834`), um com `status='ganho'` e outro `status='ativo'`. Isso confirma que a duplicação **se originou no lado do CRM** (criação simultânea de 2 registros pro mesmo evento comercial) e propagou pro Zoho via sincronização, não o contrário. Achado adicional: as faturas Stripe desta conta mostram 3 lançamentos de R$179,90 e 1 de R$1.799,00 com `status='void'` — inconsistência de cobrança coerente com a nota de 07/08/2026 que descreve o cliente pagando parte via link avulso feito manualmente porque "não estava conseguindo pagar por dentro da plataforma". Este é um problema **operacional atual**, não histórico de migração.

---

## 21. Venda na Veia

**Zoho:** `Empresa Nome.id = zcrm_5938068000032802152` · CNPJ 64.809.618/0001-80 · Rio de Janeiro/RJ · origem Mídia Paga.

### 2026
- **Aquisição Callface AI (Stripe)**: opp `zcrm_5938068000032802155`, criada 04/05/2026, R$179,90, ganha e faturada. Nota de qualificação (30/04/2026) documenta ferramenta anterior (Native IP), CRM anterior (Pipedrive), decisor único. `CONFIRMED`.
- **White Label**: opp `VENDA NA VEIA | CALLFACE WHITE LABEL | MAYARA` (`zcrm_5938068000036859001`), criada 14/07/2026, R$9.093,00. Contrato `CT - 302 - 07/2026` criado no mesmo dia. Nota 06/08/2026 relata dificuldade de configuração de DNS ("tentei 05/08 e 06/08... sem sucesso"). `CONFIRMED`.
- **Duplicação White Label**: 2 oportunidades adicionais, ambas nomeadas `VENDA NA VEIA | WHITE LABEL | CALLFACE | MAYARA`, ambas R$18.186,00 (exatamente o dobro dos R$9.093,00 do contrato original — sugerindo que possa ser o valor recalculado do mesmo contrato, não um novo negócio), criadas em 03/08/2026 com 23 minutos de diferença (10:25:47 e 10:48:10). Nota associada à 1ª: "Contrato gerado. Valor total: R$ 18.186" (título indica origem no CRM: "proposta_enviada (CRM, por Mayara Anjos, 2026-07-14)"). `CONFIRMED` a existência e o texto da nota; `AMBIGUOUS` se R$18.186 é uma renegociação real do contrato de R$9.093 ou um artefato de duplicação — o título da nota sugere que o sistema mesmo rotula isso como originado em 14/07, mas foi criado só em 03/08, quase 3 semanas depois.

**Estado atual conhecido (Postgres):** `negocios` tem **3** linhas — a venda inicial (`ganho`), e as 2 duplicatas de R$18.186,00 (uma `status='ganho'` com `mrr_fechado=9093.00` apesar do `valor_total=18186.00`, outra `status='ativo'` com os mesmos valores). Ambas criadas no **mesmo milissegundo** (`2026-07-14 15:52:30.418` / `...441695`), confirmando de novo que a origem da duplicação é o próprio CRM, replicada pro Zoho. `contratos` mostra 2 registros de assinatura — 1 tipo `assinatura` (R$179,90) e 1 tipo "CALLFACE AI - WHITE LABEL" (R$9.093,00, vinculado só a 1 dos 2 negócios duplicados) — ou seja, o sistema de contrato interno já trata isso como 1 relação comercial, mesmo com 2 negócios abertos representando o mesmo contrato. Terceiro caso consecutivo (junto com G30 e o "upgrade de linhas" da Rio Pax) do mesmo padrão de duplicação viva.

---

## 22. Bravo Log Uberaba

**Zoho:** `Empresa Nome.id = zcrm_5938068000000760265` · CNPJ 00.950.001/0001-05 · Uberaba/MG · Logística.

### 2021 (retrodatado)
- **Contrato inicial**: opp `BRAVO LOG UBERABA | CONTRATO INICIAL | CINTHIA` (`zcrm_5938068000005149113`), `Data de Fechamento`/`assinatura` = 27/12/2021, `Hora de Criação` = 11/04/2024, R$16.423,45, Closed Won. `AMBIGUOUS` pelo mesmo padrão de retrodatação já visto em 6 dos 20 casos desta amostra.

### 2024
- **Tentativa de integração de lista telefônica — perdida**: opp `zcrm_5938068000005149123`, criada 11/04/2024, `Oportunidade Origem.id` = contrato inicial, perdida em 16/04/2024. `CONFIRMED`.
- **Upsell Paulínia (100L+100R) — perdido**: opp `BRAVO PAULINIA | 100L + 100R | CINTHIA` (`zcrm_5938068000007126141`), criada 22/05/2024, negociado (R$7.500 → R$5.400 na proposta final), perdido em 23/05/2024. Nota confirma que esta empresa está expandindo pra outras unidades: "levantamento referente à BRAVO SERVICOS LOGISTICOS LTDA(UBERABA)... serão criados 2 novas empresas... BRAVO ARMAZENS GERAIS LTDA(CUIABÁ)... BRAVO ARMAZENS GERAIS LTDA(UBERABA)" (15/07/2024) — confirma que Bravo Log é um grupo com múltiplas contas Zoho relacionadas (Uberaba, Cuiabá, Paulínia), coerente com "Bravo Log Armazém Paulínia" e "Bravo Log Armazém Cuiabá" aparecerem separadamente na lista de empresas com 2+ eventos (seção 1). `CONFIRMED`.
- **Renovação por pacote Enterprise — perdida**: opp `zcrm_5938068000010276174`, criada 08/08/2024, R$6.569,90, perdida em 20/08/2024. `CONFIRMED`.
- **"Simulação de churn"**: opp `SIMULAÇÃO DE CHURN | BRAVO LOG UBERABA` (`zcrm_5938068000011833001`), criada 20/09/2024. Nota do mesmo dia: *"cliente solicitou simulação de cancelamento de todos os contratos existentes e a data de vencimento de cada... apresentado em reunião dia 24.09"*. Nota de 24/09 confirma os cálculos foram entregues, "considerar as duas simulações, pois se tratam de contratos diferentes". `CONFIRMED` que é uma **simulação solicitada pelo cliente**, não um churn efetivo — o cliente pediu pra saber o custo de cancelar tudo, o que é um sinal de risco real, mas não confirma que o cancelamento aconteceu de fato. `AMBIGUOUS` quanto ao desfecho: o Stage final da opp é "Closed Lost" (17/10/2024 e novamente 04/09/2025), o que pode significar tanto "a simulação foi descartada, cliente ficou" quanto "o cliente de fato saiu depois" — não há nota posterior confirmando qual das duas.

**Estado atual conhecido (Postgres):** `negocios` tem **3 das 5** oportunidades — o contrato inicial (`ganho`, `mrr_fechado=16423.45`), a integração de lista (perdida) e, notavelmente, **a "simulação de churn" também migrou**, com `status='perdido'`. Isso é um pequeno problema de tradução semântica pré-existente no próprio Zoho, não da migração: um pedido de simulação de cancelamento (que é um sinal de risco, não um fato de cancelamento) fica registrado com o mesmo rótulo genérico "Perdido" que qualquer venda que não fechou — o CRM novo herdou essa ambiguidade tal como estava, não criou uma nova. As 2 tentativas de upsell perdidas (Paulínia e renovação Enterprise) não têm negócio correspondente.

---

## 23. Notas finais de método

- Todas as datas retrodatadas (`Data de Fechamento` ou `Data de assinatura do contrato` significativamente anterior à `Hora de Criação` do registro Zoho) foram marcadas `AMBIGUOUS` de forma consistente — são 6 dos 20 casos (Vetlog, Hospital Care, São Leopoldo Mandic, Grupo Ri Happy, Swiss Park Office, Bravo Log Uberaba). O padrão em si (retrodatação sem documento comprobatório no CSV) é sistemático o suficiente pra sugerir que uma parcela relevante da base de clientes "antigos" da Callface no Zoho foi reconstruída manualmente a partir de outro sistema (AutoTask, citado explicitamente em Grupo Ri Happy e FIEMT) ou de contratos em papel — não é evidência de erro, é evidência de que o próprio Zoho já era uma segunda reconstrução, não a fonte original.
- O padrão de duplicação por sincronização simultânea (G30, Venda na Veia, e possivelmente Rio Pax) apareceu em **3 dos 20 casos**, todos com `created_at` no mesmo milissegundo entre 2 registros de mesmo negócio — isso é uma amostra pequena, mas suficiente pra levantar a pergunta de se é um padrão mais amplo no fluxo de sincronização CRM↔Zoho vigente hoje. Não foi investigado o mecanismo exato (código do sync) nesta frente — só o efeito observado nos dados, como já registrado na metodologia da Fase 1 pro achado do pipeline PT-BR (`03-reconciliacao-oportunidades.md`, seção 2.1).
- Os 2 casos de churn mais recentes (Ammo Varejo, 20/07/2026; Compucenter, 04/08/2026) aconteceram bem depois do corte de 12/06/2026 e ainda não têm reflexo no CRM no momento desta auditoria (10/08/2026) — o gap de "evento pós-venda não visível" documentado em escala pela Fase 1 (achado #2, 121 negócios) continua se repetindo em tempo real, não é só arqueologia de uma migração já fechada.
