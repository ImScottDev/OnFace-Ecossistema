# Mapa Semântico dos Eventos Pós-Venda — Fase 2 (Semântica/Temporal)

> Frente de investigação nova, complementar à fase 1 (`03-reconciliacao-oportunidades.md` e síntese `00-SINTESE-CONSOLIDADA.md`, lidos antes de começar este trabalho — não redescobre o que já foi achado, refina e aprofunda). **Escopo: só leitura.** Nenhum arquivo do backup Zoho foi alterado, nenhuma linha do banco foi escrita — tudo abaixo vem de `csv.DictReader` (utf-8-sig) sobre os CSVs em `~/Downloads/Data_001/Data/`, processados em Python.
>
> Regra de reporte seguida em todo este documento (mandato do cliente): nenhum achado é apresentado como veredito fechado. Toda linha é "identificamos X registros cujo padrão indica Y, confiança Z". Onde a evidência não permite decidir, o caso é marcado **AMBIGUOUS** com a razão explícita.

---

## 0. Resumo executivo (números-chave)

| Item | Valor | Confiança |
|---|---|---|
| Oportunidades no CSV (`Oportunidades de Vendas_001.csv`) | 1.551 | fato |
| Header exato do campo usado como lógica de negócio | `Nome Oportunidade de Venda` | fato |
| Header exato do campo self-referencing | `Oportunidade Origem.id` | fato |
| Vocabulário de eventos pós-venda identificado (token explícito no nome) | **7 padrões**: CHURN, UPGRADE (+ abrev. `UPG`), DOWNGRADE (+ abrev. `DOWNG`/`DOWG`), RENOVAÇÃO, MIGRAÇÃO, RENEGOCIAÇÃO, CANCELA/SUBSTITUI | Alta |
| Total de registros com algum desses 7 tokens | **247** (refinamento do 244 da fase 1 — ver §1.3 para a reconciliação exata) | Alta |
| Tokens buscados e **NÃO encontrados** em nenhum dos 1.551 registros | CANCELAMENTO, DISTRATO, REATIVAÇÃO, SUSPENSÃO, EXPANSÃO, ADITIVO, TERMO, RETENÇÃO, ENCERRAMENTO, FINALIZAÇÃO, DEMO, PILOTO, AMPLIAÇÃO, REDUÇÃO, TROCA, AUMENTO, ATIVAÇÃO, INATIVAÇÃO, BLOQUEIO, REEMBOLSO, DEVOLUÇÃO, QUEBRA, INADIMPLÊNCIA | Alta (confirma e amplia a lista negativa da fase 1) |
| Classificação das 1.551 oportunidades em 14 categorias de negócio | ver §2 | mista (alta/média/baixa por linha, nunca "certeza absoluta") |
| Dos 247 eventos, com contrato nativo encontrado (evento OU origem) em `Contratos_001.csv` | 105/247 (42,5%) | Alta (fato de correspondência de ID) |
| Dos 247 eventos, com proposta encontrada (evento OU origem) em `Propostas_001.csv` | 179/247 (72,5%) | Alta |
| Achado novo desta fase (não estava na fase 1): **50% dos 30 registros DOWNGRADE têm o próprio Stage em Perdido/Closed Lost/Sem Retorno** — ou seja, metade dos "downgrades" nomeados no Zoho pode ser uma proposta de redução que **não foi aceita pelo cliente**, não uma redução efetivamente aplicada | Média — AMBIGUOUS, ver §4.2 |
| Achado novo: 145 oportunidades têm `Oportunidade Origem` preenchida mas **nenhum** dos 7 tokens de evento no nome — um segundo corpo de eventos pós-venda não tipados (integrações, adição de ramal/linha, troca de aparelho) que a fase 1 não tinha isolado | Média/Baixa, ver §1.4 |

---

## 1. Mapa semântico completo — taxonomia de todos os padrões

### 1.1 Metodologia

Split do campo `Nome Oportunidade de Venda` por `|` (separador de template) e por token/palavra em maiúsculas, contando frequência de cada segmento e de cada radical candidato a "tipo de evento". Testados sistematicamente ~45 radicais candidatos (a lista de tokens de negócio que uma operação de CS/retenção normalmente usaria: CANCELAMENTO, DISTRATO, RENEGOCIAÇÃO, RETENÇÃO, REATIVAÇÃO, SUSPENSÃO, EXPANSÃO, ADITIVO, TERMO, ENCERRAMENTO, FINALIZAÇÃO, TESTE, DEMO, PILOTO, TROCA, AUMENTO, REDUÇÃO, ATIVAÇÃO, INATIVAÇÃO, BLOQUEIO, REEMBOLSO, DEVOLUÇÃO, QUEBRA, INADIMPLÊNCIA, COBRANÇA, FIDELIZAÇÃO, PORTABILIDADE, INTEGRAÇÃO, ADICIONAL, EXTRA, NOVO, entre outros).

### 1.2 Vocabulário confirmado (tokens que existem, com contagem exata sobre os 1.551)

| Padrão (regex case-insensitive) | Qtd. | % de 1.551 | Observação |
|---|---:|---:|---|
| `CHURN` | 88 | 5,7% | idêntico à fase 1 |
| `UPGRADE` (inclui abrev. `UPG`) | 88 | 5,7% | fase 1 reportou 87 usando só `\bUPGRADE\b`; achamos **+1** registro com a abreviação `UPG` (`INVENT \| UPG 4R`, zcrm_...4636236) |
| `DOWNGRADE` (inclui abrev. `DOWNG`/`DOWG`) | 30 | 1,9% | fase 1 reportou 27; achamos **+3** com abreviação (`RIHAPPY \| DOWNG 37R`, `DOLP ENG \| DOWG 39R`, `G&H INTERMEDIAÇÃO \| DOWNG 01L`) |
| `RENOVAÇÃO`/`RENOVACAO` | 29 | 1,9% | idêntico à fase 1 (3 desses 29 coexistem com `CHURN` no mesmo nome — ver §1.3) |
| `MIGRAÇÃO`/`MIGRACAO` | 13 | 0,8% | idêntico à fase 1, majoritariamente "MIGRAÇÃO PARA YEASTAR" (troca de hardware) |
| `RENEGOCIAÇÃO` | 1 | 0,1% | a fase 1 já tinha achado este token na tabela de vocabulário, mas o excluiu do "total evento"; nesta fase 2 ele **entra** na classificação (`COMPUCENTER I RENEGOCIAÇÃO (SOMENTE PREÇO)`) |
| `CANCELA/SUBSTITUI` / `CANCELA/SUBST` | 2 | 0,1% | **token novo, não identificado na fase 1** — `TEKSEA \| CANCELA/SUBSTITUI` e `INTEGRA \| CANCELA/SUBST`, ambos indicando troca de plano com cancelamento formal do anterior |
| `CONTRATO INICIAL` | 81 | 5,2% | marcador de baseline (não é evento pós-venda), idêntico à fase 1 |
| `PROJETO INICIAL` | 9 | 0,6% | marcador de baseline adicional, mesma família semântica de `CONTRATO INICIAL` — não estava destacado como padrão próprio na fase 1 |
| `NOVO NEGÓCIO` | 178 | 11,5% | marcador de baseline usado em nomes do tipo `EMPRESA - NOVO NEGÓCIO` — volume alto, não filtrado explicitamente na fase 1 |
| `NOVO CALLFACE` | 8 | 0,5% | expansão de módulo em conta existente, idêntico à fase 1 |
| `LINHA ADICIONAL` / `ADICIONAL LINHA` / `MINUTOS EXTRAS` | 6 | 0,4% | **padrão novo, não isolado na fase 1** — mesma família semântica de `NOVO CALLFACE` (expansão), ex. `NUVY \| LINHA SIP ADICIONAL`, `SOLATIUM SEGUROS \| MINUTOS EXTRAS` |
| `INTEGRAÇÃO`/`INTEGRACAO` | 18 | 1,2% | **padrão novo mapeado nesta fase** — projetos técnicos de integração (Movidesk, Ploomes, CRM, Teams, lista telefônica) associados a contas já existentes, ver §1.4 |
| `PORTABILIDADE` | 3 | 0,2% | portabilidade numérica associada a alteração contratual em conta existente |
| `TESTE` | 3 | 0,2% | registros de teste técnico/interno (`Teste automação contrato`, `teste integração callface`, `CALLFACE \| 20 usuários + 0800 \| TESTE`) — **não é oportunidade comercial nem evento de lifecycle**, é ruído de ambiente de teste |

### 1.3 Reconciliação com o número "244" da fase 1

A fase 1 (`03-reconciliacao-oportunidades.md`, §1) somou CHURN(88)+UPGRADE(87)+DOWNGRADE(27)+RENOVAÇÃO(29)+MIGRAÇÃO(13) = 244 (a soma aritmética exata dos 5 valores citados dá 244 apenas se um dos overlaps abaixo já tiver sido descontado; o relatório fase 1 não detalha esse ponto). Esta fase 2 reprocessou o corpus completo e encontrou:

- **+1 UPGRADE** por abreviação (`UPG`)
- **+3 DOWNGRADE** por abreviação (`DOWNG`/`DOWG`)
- **3 registros com CHURN e RENOVAÇÃO no mesmo nome** (`... \| CHURN (NÃO RENOVAÇÃO) \|...`, `... \| CHURN NÃO RENOVAÇÃO \|...`, `CHURN \| NÃO RENOVAÇÃO \| AUDERE`) — semanticamente são CHURN (o nome diz explicitamente "não renovou"), então esta fase os conta uma única vez em `churn`, não duplicados em `renovação`
- **1 registro com RENOVAÇÃO e UPGRADE no mesmo nome** (`MEGAVIG (VASCO) \| RENOVAÇÃO COM UPGRADE`) — contado uma única vez em `renovação` (é a renovação do contrato que veio empacotada com um upgrade, o evento-mãe é a renovação)
- **+1 RENEGOCIAÇÃO** e **+2 CANCELA/SUBSTITUI** — tokens novos, fora dos 5 originais da fase 1

Resultado: **247 registros distintos** (sem duplicar nenhum ID) carregam pelo menos um dos 7 tokens de evento pós-venda. A diferença de 3 registros em relação ao "244" da fase 1 é integralmente explicada pelas 5 abreviações/tokens novos encontrados menos o efeito de deduplicação dos 4 overlaps — não há contradição, é refinamento. **Confiança: alta** (recontagem determinística, reproduzível).

### 1.4 Achado novo: um segundo corpo de eventos pós-venda sem token explícito

Além dos 247 com token de evento, **351 das 1.551 oportunidades têm `Oportunidade Origem.id` preenchida** (isto é, o próprio time do Zoho já ligou aquele registro a um negócio anterior via campo estrutural, não só por nome). Dessas 351, **145 (41%) não carregam nenhum dos 7 tokens de evento no nome** — são registros como:

- `COPAFER \| INTEGRAÇÃO MOVIDESK + API para BI` (projeto técnico em conta existente)
- `MANDIC ARCOVERDE \| 12R` (adição de 12 ramais, sem rótulo)
- `IBIS BUDGET VILA GOLF \| 1R` (sem qualquer abreviação de upgrade/downgrade, mas ligado por Origem)
- `TOZZINI \| PORTABILIDADE DE NÚMERO INTERNACIONAL`

Isso é evidência de que **a disciplina de nomenclatura "EMPRESA \| TIPO \| DETALHE" não cobria só os 5-7 tipos que o time rotulava explicitamente — o vínculo estrutural (`Oportunidade Origem`) foi usado num universo mais amplo de alterações pós-venda que nunca ganhou um rótulo de tipo no nome.** Essas 145 entram na classificação da seção 2 como `expansão` (quando Stage é de vitória e o Montante é positivo) ou `alteração contratual` — a maioria com confiança **baixa/AMBIGUOUS**, porque não há campo estruturado que diga se aquele "12R" foi um upsell, uma manutenção sem custo ou uma redução, sem inspecionar nota a nota (fora do escopo de leitura de CSV puro). **Confiança do achado em si (que esse corpo de 145 existe e está estruturalmente ligado): alta. Confiança da direção/natureza de cada um deles: baixa — ver §2.3.**

---

## 2. Classificação das 1.551 oportunidades em 14 categorias

### 2.1 Metodologia e ordem de precedência

Cada uma das 1.551 linhas foi classificada por um script determinístico com esta ordem de prioridade (primeira regra que casar decide a categoria):

1. Token `TESTE` no nome → **atividade** (registro de teste, não comercial)
2. Token `CHURN` → **churn**
3. Token `RENOVAÇÃO` → **renovação**
4. Token `UPGRADE`/`UPG` → **upgrade**
5. Token `DOWNGRADE`/`DOWNG`/`DOWG` → **downgrade**
6. Token `MIGRAÇÃO` → **alteração contratual**
7. Token `RENEGOCIAÇÃO` ou `CANCELA/SUBSTITUI` → **alteração contratual**
8. Token `CONTRATO INICIAL`/`PROJETO INICIAL`/`NOVO NEGÓCIO` → **aquisição**
9. Token `NOVO CALLFACE`/`LINHA ADICIONAL`/`MINUTOS EXTRAS` → **expansão**
10. `Oportunidade Origem` preenchida + token `INTEGRAÇÃO`/`PORTABILIDADE` → **alteração contratual** (média confiança)
11. `Oportunidade Origem` preenchida, sem nenhum token → **expansão** (se Stage=Closed Won/Concluído e Montante>0, média confiança) ou **alteração contratual** (demais casos, confiança baixa/AMBIGUOUS — ver §1.4)
12. Sem Origem, sem token, Stage em pipeline de backoffice legado (`Contrato`/`Proposta Enviada`/`Faturamento`/`Delivery AI`/`Delivery PABX`) → **contrato**/**proposta**/**documento**/**atividade** respectivamente (média confiança — o registro de Oportunidade está sendo usado para rastrear outra coisa, não uma venda em andamento)
13. Todo o resto → **oportunidade comercial real** (alta confiança se Stage é do pipeline moderno; média confiança se Stage é do pipeline legado, dado o histórico de baixa taxa de migração/consistência documentado na fase 1 §2.1)

Nenhuma linha ficou sem categoria.

### 2.2 Contagem por categoria

| Categoria | Qtd. | % de 1.551 | Confiança dominante |
|---|---:|---:|---|
| oportunidade comercial real | 856 | 55,2% | alta: 646 · média: 210 |
| aquisição | 268 | 17,3% | alta: 268 |
| alteração contratual | 99 | 6,4% | alta: 16 · média: 12 · **baixa/AMBIGUOUS: 71** |
| churn | 88 | 5,7% | alta: 88 |
| upgrade | 87 | 5,6% | alta: 87 |
| expansão | 65 | 4,2% | alta: 13 · média: 52 |
| downgrade | 30 | 1,9% | alta: 30 |
| renovação | 26 | 1,7% | alta: 26 |
| proposta | 21 | 1,4% | média: 21 |
| atividade | 5 | 0,3% | alta: 3 (teste) · média: 2 (delivery) |
| contrato | 4 | 0,3% | média: 4 |
| documento | 2 | 0,1% | média: 2 |
| **reativação** | **0** | 0% | alta (nenhum token, nenhum registro — confirmado) |
| **outro evento** | 0 | 0% | não houve resíduo não classificável fora das 13 categorias acima |
| **Total** | **1.551** | 100% | |

Leitura: **mais da metade da base (55,2%) é oportunidade comercial normal** (venda perseguida, ganha ou perdida, sem evento pós-venda documentado) — o padrão "nome como lógica de negócio" descrito no achado #10.1 da síntese fase 1 é real, mas é um recorte minoritário (15,9% = churn+upgrade+downgrade+renovação, mais 6,4% de alteração contratual) sobre o total do módulo, não a maioria dos registros.

A categoria **alteração contratual** concentra o maior volume de incerteza: dos 99, **71 (72%) são AMBIGUOUS** — são os registros do achado §1.4 que ficaram sem Stage de vitória clara ou Montante positivo, e portanto sem sinal suficiente para decidir se representam upsell, downsell ou simples manutenção sem impacto de receita. **Isto não deve ser lido como "71 negócios com problema" — é honestamente "71 negócios cuja natureza exige inspeção manual (nota, contrato) que este método de CSV puro não resolve".**

### 2.3 Nota sobre `reativação`

Buscados sistematicamente os radicais `REATIV`, `INATIV`, `ATIVAÇÃO` em todo o corpus de 1.551 nomes — **zero ocorrências**. Não há evidência textual de que o time tenha usado a nomenclatura de Oportunidade para marcar reativação de cliente que já tinha churnado. Isso não significa que reativação nunca aconteceu no negócio real — apenas que, **se aconteceu, não foi registrada com esse vocabulário no campo `Nome Oportunidade de Venda`** (poderia estar, por exemplo, dentro de um registro classificado aqui como `aquisição` — mesmo nome de empresa, novo `CONTRATO INICIAL`, sem nenhum link explícito ao histórico de churn anterior). **Confiança alta de que o campo não contém o rótulo; confiança baixa/indeterminada sobre se o evento de negócio em si nunca ocorreu.**

---

## 3. Deep-dive nos 247 registros de evento pós-venda

### 3.1 Metodologia de cruzamento

Para cada um dos 247 registros classificados em `churn`/`upgrade`/`downgrade`/`renovação`/`alteração contratual` (alta confiança), buscado:

1. **Oportunidade de origem**: resolvida via `Oportunidade Origem.id` diretamente no próprio CSV de Oportunidades (não contra a tabela `negocios` do CRM — essa comparação já foi feita pela fase 1, ver `03-reconciliacao-oportunidades.md` §1.1 e §1.3; esta fase reaproveita aquele achado e não o repete).
2. **Contrato relacionado**: busca em `Contratos_001.csv` pelo campo `Nome Oportunidade de Venda.id`, tentando primeiro o **ID do próprio registro de evento** (ex.: existe um contrato formal gerado especificamente para o churn/upgrade/downgrade) e, se não encontrado, o **ID da oportunidade de origem** (o contrato do negócio original, anterior ao evento). Quando nenhum dos dois casa, marcado "não encontrado".
3. **Proposta relacionada**: mesma lógica de busca (ID do evento, depois ID da origem) em `Propostas_001.csv`.
4. **Produto(s)**: via `Itens Cotados_001.csv` (ligado à proposta encontrada pelo campo `ID do pai.id` — confirmado que 1.869 dos 1.876 itens cotados batem com ID de Proposta, 0 com ID de Contrato) e resolvido o nome em `Products_001.csv`.
5. **Valor e data**: `Montante` e `Data de Fechamento` do próprio registro de evento (não da origem).

### 3.2 Estatísticas de cruzamento

| Categoria | N | Com Origem preenchida | Contrato encontrado (evento OU origem) | Proposta encontrada (evento OU origem) | Com produto identificado |
|---|---:|---:|---:|---:|---:|
| churn | 88 | 85 | 34 (39%) | 46 (52%) | 46 |
| upgrade | 87 | 62 | 45 (52%) | 72 (83%) | 72 |
| downgrade | 30 | 30 | 10 (33%) | 27 (90%) | 27 |
| renovação | 26 | 22 | 9 (35%) | 20 (77%) | 20 |
| alteração contratual (alta) | 16 | 13 | 7 (44%) | 14 (88%) | 14 |
| **Total** | **247** | 212 (86%) | **105 (42,5%)** | **179 (72,5%)** | 179 |

- Contrato achado via ID do próprio evento: 57. Via ID da origem: 48. (Em 57 casos o time gerou um contrato formal específico para o evento — ex. um novo CT para a linha adicional do upgrade — em 48 casos o único contrato existente é o da venda original, sem contrato próprio para o evento.)
- Proposta achada via ID do próprio evento: 138. Via ID da origem: 41. (A proposta é o documento mais consistentemente gerado por evento — 72,5% no total — bem mais que o contrato nativo, 42,5%, coerente com o achado #1 da síntese fase 1: 99,3% dos contratos nativos nunca migraram e o próprio módulo de Contratos do Zoho já tinha baixa disciplina de uso internamente.)
- Soma de `Montante` (do evento, não da origem) por categoria: CHURN R$ -17.715,68 (idêntico à fase 1, confirma consistência entre as duas frentes) · UPGRADE R$ 50.651,52 · DOWNGRADE R$ -33.637,59 · RENOVAÇÃO R$ 115.983,15 · ALTERAÇÃO CONTRATUAL R$ 44.593,32.
- Produtos mais citados nos 247 eventos: `RAMAL - FALE A VONTADE` (32), `LINHA SIP` (32), `CALLFACE AI - COLD CALLING` (18), `08 CANAIS` (15), `RAMAL FACILITA` (14), `LINHA ADICIONAL` (13), `TELEFONE FANVIL X3` (12) — majoritariamente infraestrutura de telefonia (ramal/linha/aparelho), não módulos de IA. O Callpilot praticamente não aparece nesta amostra de eventos pós-venda porque a maioria é de 2024, antes do pivot da Callface para IA.

### 3.3 Caso notável AMBIGUOUS: contrato "Cancelado" ligado a evento não-CHURN

Em todo o módulo `Contratos_001.csv` (279 registros), **só existem 2 contratos com `Status = "Cancelado"`** — e ambos apontam para o mesmo código de contrato (`CT-224-08/2025`), ligado a **um evento classificado como `upgrade`** (`PEREZ \| UPGRADE 02 RAMAIS`) e **um evento classificado como `alteração contratual`/migração** (`PEREZ MATERIAIS \| MIGRAÇÃO PARA YEASTAR`) — nenhum dos dois é um registro `CHURN`. Isso é evidência de que o contrato do cliente PEREZ foi cancelado e reemitido (upgrade + migração de hardware no mesmo período), não de churn. **Confiança média** de que é reemissão de contrato, não cancelamento definitivo — o campo `Status` no Zoho é conhecidamente pouco confiável (fase 1, achado #7: contrato "Assinado" no Zoho, 27 registros, muito abaixo do ZohoSign "Signed" real, 178).

### 3.4 Tabela completa dos 247 registros (ID Zoho sem o prefixo `zcrm_`)

Ordenada por tipo (churn → upgrade → downgrade → renovação → alteração contratual), depois por ID. Colunas: ID Zoho | Nome | Tipo | Confiança do tipo | ID Origem | Origem existe no CSV? | Contrato relacionado | Proposta relacionada | Produto(s) | Valor (Montante do evento) | Data de Fechamento | Stage do próprio registro de evento.

| ID Zoho | Nome | Tipo | Confiança tipo | ID Origem | Origem existe? | Contrato relacionado | Proposta relacionada | Produto(s) | Valor | Data Fech. | Stage evento |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 5938068000002306001 | BIOMED LOG \| CHURN \| CINTHIA CUNHA | churn | alta | 5938068000002297034 | sim | não encontrado | não encontrada | - | R$ -277,32 | 2023-11-07 | Concluído |
| 5938068000003240050 | BEGHIM \| CHURN \| CINTHIA | churn | alta | 5938068000003240016 | sim | não encontrado | PPA - 147 -04/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL - FALE A VONTADE | R$ -1.975,00 | 2024-04-30 | Concluído |
| 5938068000003567195 | ILUMI l CHURN l RAFAEL RAMPAZO | churn | alta | 5938068000003567148 | sim | não encontrado | não encontrada | - | R$ -4.526,00 | 2024-04-30 | Concluído |
| 5938068000004636265 | CTP \| CHURN \| CINTHIA | churn | alta | 5938068000004636246 | sim | CT - 081 - 04/2024 (ligado ao ID do EVENTO (direto)) | PPA - 151 -04/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL - FALE A VONTADE | R$ -2.400,00 | 2024-04-30 | Concluído |
| 5938068000006046187 | DONUM \| CHURN \| CINTHIA | churn | alta | 5938068000006046177 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2024-04-30 | Concluído |
| 5938068000006046213 | DIPAGRO \| CHURN \| CINTHIA | churn | alta | 5938068000006046203 | sim | não encontrado | PPA - 306 -09/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL - FALE A VONTADE; REAJUSTES ANUAIS | R$ -1.730,52 | 2024-04-26 | Concluído |
| 5938068000006745038 | COBI \| CHURN \| JACQUELINE | churn | alta | 5938068000001815117 | sim | CT - 028 - 01/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 205 -05/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL - FALE A VONTADE | R$ -235,00 | 2024-05-31 | Concluído |
| 5938068000008243173 | MEDIALINK \| CHURN \| CINTHIA | churn | alta | 5938068000008243160 | sim | não encontrado | não encontrada | - | R$ -1.514,07 | 2024-12-31 | Concluído |
| 5938068000008318059 | FUNIL 5.0 \| CHURN (NÃO RENOVAÇÃO) \| CINTHIA | churn | alta | 5938068000008318042 | sim | não encontrado | PPA - 329 -09/2024 (ligada ao ID do EVENTO (direto)) | INTEGRAÇÃO CRM; LINHA SIP; RAMAL - FALE A VONTADE; REAJUS... | R$ -1.099,89 | 2024-09-24 | Contrato |
| 5938068000008564151 | MEIO E MENSAGEM \| CHURN | churn | alta | 5938068000008564141 | sim | não encontrado | PPA - 243 -06/2024 (ligada ao ID do EVENTO (direto)) | ADITIVOS CONTRATUAIS; LINHA SIP; RAMAL - FALE A VONTADE | R$ -502,70 | 2024-06-27 | Concluído |
| 5938068000008617145 | DR OLHO \| SIMULAÇÃO DE CHURN \| CINTHIA | churn | alta | 5938068000006425169 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2024-12-31 | Closed Lost |
| 5938068000008617189 | APP SISTEMAS \| CHURN | churn | alta | 5938068000008243112 | sim | não encontrado | não encontrada | - | R$ -920,00 | 2024-09-27 | Concluído |
| 5938068000008617209 | MERCATUS \| CHURN | churn | alta | 5938068000008617199 | sim | não encontrado | PPA - 323 -09/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL - FALE A VONTADE; REAJUSTES ANUAIS | R$ -507,24 | 2024-07-31 | Concluído |
| 5938068000008639015 | SERVITEC \| CHURN \| JAB | churn | alta | 5938068000008639005 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2024-06-27 | Contrato |
| 5938068000008718322 | FORNO RIO \| CHURN NÃO RENOVAÇÃO \| CINTHIA | churn | alta | 5938068000008718241 | sim | não encontrado | PPA - 320 -09/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL - FALE A VONTADE; REAJUSTES ANUAIS; TELE... | R$ -687,63 | 2024-09-13 | Concluído |
| 5938068000009250011 | DOLP ENG \| CHURN \| CINTHIA | churn | alta | 5938068000003567224 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2024-07-31 | Closed Lost |
| 5938068000011333049 | CHURN \| RDC | churn | alta | 5938068000011333006 | sim | não encontrado | não encontrada | - | R$ -455,00 | 2024-09-05 | Contrato |
| 5938068000011542002 | CHURN \| NÃO RENOVAÇÃO \| AUDERE | churn | alta | 5938068000007051028 | sim | não encontrado | não encontrada | - | R$ -625,00 | 2024-09-30 | Concluído |
| 5938068000011833001 | SIMULAÇÃO DE CHURN \| BRAVO LOG UBERABA | churn | alta | 5938068000005149113 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2024-09-20 | Closed Lost |
| 5938068000011833018 | SIMULAÇÃO DE CHURN \| BRAVO LOG ARMAZEM PAULINIA | churn | alta | 5938068000009303284 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2024-09-20 | Closed Lost |
| 5938068000011833030 | SIMULAÇÃO DE CHURN \| BRAVO LOG ARMAZEM CUIABA | churn | alta | 5938068000009303165 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2024-09-20 | Closed Lost |
| 5938068000012780055 | JOTABANK(PAGGO) \| CHURN | churn | alta | 5938068000012576008 | sim | não encontrado | PPA - 349 -10/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL CALLFACE; REAJUSTES ANUAIS | R$ -260,31 | 2024-10-31 | Contrato |
| 5938068000013954068 | AP PONTO \| CHURN | churn | alta | 5938068000013954056 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2024-11-30 | Concluído |
| 5938068000013954092 | CONSTRUART \| CHURN | churn | alta | 5938068000013954080 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2024-11-30 | Contrato |
| 5938068000014596001 | C3 GASTRONOMIA \| CHURN | churn | alta | 5938068000003567016 | sim | CT - 062 - 03/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 112 -03/2024 (ligada ao ID da ORIGEM (direto)) | SMALL | R$ 0,00 | 2024-11-25 | Contrato |
| 5938068000014596033 | SOCIAL BANK \| CHURN | churn | alta | 5938068000014596012 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2024-11-25 | Contrato |
| 5938068000015253012 | MATERA \| CHURN | churn | alta | 5938068000015253001 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2024-12-09 | Concluído |
| 5938068000015253038 | H&CO \| CHURN | churn | alta | 5938068000006046027 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2024-12-10 | Contrato |
| 5938068000019295163 | DBA \| ORIGEM WEVY - CHURN | churn | alta | 5938068000019295163 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2026-01-20 | Contrato |
| 5938068000019973003 | NUBBI \| CHURN \| MAYARA | churn | alta | 5938068000004729022 | sim | CT - 094 - 04/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 152 -04/2024 (ligada ao ID da ORIGEM (direto)) | + 800 MIN - STARTER; 08 CANAIS; SMALL; WEB API + CONTROLE... | R$ 0,00 | 2025-06-25 | Closed Lost |
| 5938068000020157033 | CHURN \| IBIS NOVA SERRANA \| MAYARA | churn | alta | 5938068000000971305 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2025-06-27 | Contrato |
| 5938068000020475053 | TOZZINI \| CHURN | churn | alta | 5938068000003792091 | sim | CT - 091 - 04/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 125 -03/2024 (ligada ao ID da ORIGEM (direto)) | RENOVAÇÃO TOZZINI PORTO ALEGRE | R$ 0,00 | 2025-07-08 | Concluído |
| 5938068000020519135 | CHURN \| DATAOCEAN \| MAYARA | churn | alta | 5938068000020519112 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2025-07-11 | Contrato |
| 5938068000021015149 | IGREJA BATISTA AGAPE \| CHURN | churn | alta | 5938068000021015126 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2025-07-21 | Contrato |
| 5938068000021015180 | PREF DE CHACARA \| CHURN | churn | alta | 5938068000012576258 | sim | CT - 164 - 10/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 344 -10/2024 (ligada ao ID da ORIGEM (direto)) | 08 CANAIS; MEDIUM - FACILITA | R$ 0,00 | 2025-07-21 | Contrato |
| 5938068000021015191 | PREF CAPELA NOVA \| CHURN | churn | alta | 5938068000008564023 | sim | CT - 123 - 06/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 242 -06/2024 (ligada ao ID da ORIGEM (direto)) | RAMAL FACILITA; SMALL | R$ 0,00 | 2025-07-21 | Contrato |
| 5938068000021015205 | PREF TABULEIRO \| CHURN | churn | alta | 5938068000005337346 | sim | CT - 089 - 04/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 170 -04/2024 (ligada ao ID da ORIGEM (direto)) | 08 CANAIS; RAMAL FACILITA; SMALL | R$ 0,00 | 2025-07-21 | Contrato |
| 5938068000021015219 | TDP SISTEMAS \| CHURN | churn | alta | 5938068000009811220 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2025-07-21 | Contrato |
| 5938068000021322007 | FACILITA \| PREF ARAPONGA \| CHURN | churn | alta | 5938068000003585220 | sim | CT - 067 - 03/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 117 -03/2024 (ligada ao ID da ORIGEM (direto)) | MEDIUM | R$ 0,00 | 2025-07-24 | Contrato |
| 5938068000021322028 | FACILITA \| TAKSU VARGINHA \| CHURN | churn | alta | 5938068000006128041 | sim | CT - 098 - 04/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 192 -04/2024 (ligada ao ID da ORIGEM (direto)) | LINHA ADICIONAL; RAMAL FACILITA; SMALL | R$ 0,00 | 2025-07-24 | Contrato |
| 5938068000021322044 | FACILITA \| PREF CAJURI \| CHURN | churn | alta | 5938068000002866097 | sim | CT - 046 - 02/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 092 -02/2024 (ligada ao ID da ORIGEM (direto)) | MEDIUM - FACILITA | R$ 0,00 | 2025-07-24 | Contrato |
| 5938068000021322060 | FACILITA \| PREF SANTA CRUZ \| CHURN | churn | alta | 5938068000002530013 | sim | CT - 039 - 02/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 079 -02/2024 (ligada ao ID da ORIGEM (direto)) | MEDIUM | R$ 0,00 | 2025-07-24 | Contrato |
| 5938068000021322076 | FACILITA \| PREF DORES DE CAMPOS\| CHURN | churn | alta | 5938068000012576020 | sim | CT - 162 - 10/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 342 -10/2024 (ligada ao ID da ORIGEM (direto)) | RAMAL FACILITA; SMALL - FACILITA | R$ 0,00 | 2025-07-24 | Contrato |
| 5938068000021728009 | 90TI \| CHURN | churn | alta | 5938068000009640020 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2025-08-05 | Contrato |
| 5938068000022480043 | CHURN \| MAIS TEC \| PREF DE PAIVA | churn | alta | 5938068000013431150 | sim | CT - 176 - 10/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 361 -10/2024 (ligada ao ID da ORIGEM (direto)) | RAMAL FACILITA; SMALL - FACILITA | R$ 0,00 | 2025-08-20 | Contrato |
| 5938068000022480087 | CHURN \| IRMÃOS DAVOLI | churn | alta | 5938068000022480069 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2025-08-13 | Contrato |
| 5938068000022480118 | CHURN \| IRMÃOS DAVOLI | churn | alta | 5938068000022480069 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2025-08-12 | Contrato |
| 5938068000022647109 | CHURN \| FACILITA \| PREF DE PIRAUBA | churn | alta | 5938068000013655001 | sim | CT - 181 - 10/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 364 -10/2024 (ligada ao ID da ORIGEM (direto)) | MEDIUM - FACILITA | R$ 0,00 | 2025-08-30 | Contrato |
| 5938068000022647120 | CHURN \| FACILITA \| PREF DE CORONEL | churn | alta | 5938068000009742058 | sim | CT - 129 - 07/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 262 -07/2024 (ligada ao ID da ORIGEM (direto)) | 08 CANAIS; RAMAL FACILITA; SMALL | R$ 0,00 | 2025-08-30 | Contrato |
| 5938068000022647167 | ANGELINA CERNES \| CHURN | churn | alta | 5938068000012858001 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2025-08-30 | Contrato |
| 5938068000022647196 | PRIME & LLONK \| CHURN | churn | alta | 5938068000022647178 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2025-08-25 | Closed Lost |
| 5938068000022726142 | ODYBLUE \| CHURN | churn | alta | 5938068000018065003 | sim | não encontrado | PPA - 445 -04/2025 (ligada ao ID da ORIGEM (direto)) | HEADSET USB | R$ 0,00 | 2025-08-28 | Contrato |
| 5938068000023064631 | PREF DE LIBERDADE \| CHURN | churn | alta | 5938068000009954001 | sim | CT - 131 - 07/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 269 -07/2024 (ligada ao ID da ORIGEM (direto)) | 08 CANAIS; RAMAL FACILITA; SMALL | R$ 0,00 | 2025-09-04 | Contrato |
| 5938068000023340002 | FUTEBOL INTERATIVO \| CHURN | churn | alta | 5938068000004636092 | sim | CT - 085 - 04/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 150 -04/2024 (ligada ao ID da ORIGEM (direto)) | BINA INTELIGENTE 3000 MINUTOS; SMALL | R$ 0,00 | 2025-09-10 | Contrato |
| 5938068000024194115 | A10 INVESTIMENTOS \| CHURN | churn | alta | 5938068000010585047 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2025-10-02 | Contrato |
| 5938068000024563021 | CHURN \| PREF DE CARVALHOS | churn | alta | 5938068000013431254 | sim | CT - 177 - 10/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 362 -10/2024 (ligada ao ID da ORIGEM (direto)) | RAMAL FACILITA; SMALL - FACILITA | R$ 0,00 | 2025-09-04 | Contrato |
| 5938068000024563055 | CHURN \| PREF DE CISLAV | churn | alta | 5938068000014167031 | sim | CT - 185 - 11/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 373 -11/2024 (ligada ao ID da ORIGEM (direto)) | SMALL - FACILITA | R$ 0,00 | 2025-10-09 | Contrato |
| 5938068000024563076 | CHURN \| PREF DE NAZARENO | churn | alta | 5938068000013431048 | sim | CT - 175 - 10/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 360 -10/2024 (ligada ao ID da ORIGEM (direto)) | MEDIUM - FACILITA | R$ 0,00 | 2025-10-09 | Contrato |
| 5938068000024563121 | CHURN \| PREF DE ITUTINGA | churn | alta | 5938068000003585019 | sim | CT - 064 - 03/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 113 -03/2024 (ligada ao ID da ORIGEM (direto)) | MEDIUM | R$ 0,00 | 2025-10-09 | Contrato |
| 5938068000024563142 | CHURN \| PREF DE IJACI | churn | alta | 5938068000008338110 | sim | CT - 122 - 06/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 234 -06/2024 (ligada ao ID da ORIGEM (direto)) | 08 CANAIS; RAMAL FACILITA; SMALL | R$ 0,00 | 2025-10-09 | Contrato |
| 5938068000025164079 | 26.TABELIAO \| CHURN | churn | alta | 5938068000010140103 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2025-10-22 | Contrato |
| 5938068000025164106 | CYSTAC \| CHURN | churn | alta | 5938068000016893016 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2025-10-30 | Contrato |
| 5938068000025639067 | PREF CAMPANHA \| CHURN | churn | alta | 5938068000013655103 | sim | CT - 182 - 10/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 365 -10/2024 (ligada ao ID da ORIGEM (direto)) | 08 CANAIS; LARGE - FACILITA | R$ 0,00 | 2025-11-12 | Contrato |
| 5938068000025639088 | CHURN \| CEREALISTA PEREIRA | churn | alta | 5938068000015648001 | sim | não encontrado | PPA - 395 -12/2024 (ligada ao ID da ORIGEM (direto)) | MEDIUM - FACILITA | R$ 0,00 | 2025-10-31 | Contrato |
| 5938068000027791108 | FACILITA \| CHURN \| CLINICA NLM | churn | alta | 5938068000010717003 | sim | CT - 143 - 08/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 291 -08/2024 (ligada ao ID da ORIGEM (direto)) | SMALL | R$ 0,00 | 2025-11-18 | Contrato |
| 5938068000027791152 | FACILITA \| CHURN \| PLAN MINAS | churn | alta | 5938068000009742179 | sim | CT - 147 - 08/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 263 -07/2024 (ligada ao ID da ORIGEM (direto)) | 08 CANAIS; SMALL | R$ 0,00 | 2025-11-18 | Contrato |
| 5938068000027791188 | MAIS TECNOLOGIA \| CHURN \| PREF SÃO JOÃO DEL REI | churn | alta | 5938068000013954104 | sim | CT - 188 - 11/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 371 -11/2024 (ligada ao ID da ORIGEM (direto)) | 16 CANAIS; ENTERPRISE - FACILITA | R$ 0,00 | 2025-11-18 | Contrato |
| 5938068000027791222 | FACILITA \| CHURN \| PREF CATAS ALTAS DA NORUEGA | churn | alta | 5938068000010907001 | sim | CT - 145 - 08/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 294 -08/2024 (ligada ao ID da ORIGEM (direto)) | 08 CANAIS; RAMAL FACILITA; SMALL - FACILITA | R$ 0,00 | 2025-11-18 | Contrato |
| 5938068000027791256 | FACILITA \| CHURN \| PREF CATAS ALTAS | churn | alta | 5938068000012576136 | sim | CT - 163 - 10/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 343 -10/2024 (ligada ao ID da ORIGEM (direto)) | 08 CANAIS; MEDIUM - FACILITA; RAMAL FACILITA | R$ 0,00 | 2025-11-18 | Contrato |
| 5938068000027791337 | MAIS TECNOLOGIA \| CHURN \| DROGARIA DO BAIRRO | churn | alta | 5938068000005337241 | sim | CT - 088 - 04/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 169 -04/2024 (ligada ao ID da ORIGEM (direto)) | LINHA ADICIONAL; RAMAL FACILITA; SMALL | R$ 0,00 | 2025-12-01 | Contrato |
| 5938068000029928133 | CHURN \| PREF SERRA DO SALITRE | churn | alta | 5938068000029928117 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2026-02-18 | Contrato |
| 5938068000030257256 | CHURN \| ALE EMPREENDIMENTOS | churn | alta | 5938068000030257256 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2026-01-12 | Concluído |
| 5938068000030530047 | CHURN \| IDOMESTICA | churn | alta | 5938068000030530047 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2026-02-03 | Contrato |
| 5938068000030707388 | TRANSCAPIVARI \| CHURN | churn | alta | - | - | não encontrado | não encontrada | - | R$ 0,00 | 2026-02-11 | Closed Won |
| 5938068000030796074 | MR JACKY \| CHURN | churn | alta | 5938068000030796074 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2026-03-03 | Concluído |
| 5938068000031109193 | CHURN \| PREF DE SIMONESIA | churn | alta | 5938068000002980037 | sim | CT - 050 - 02/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 094 -02/2024 (ligada ao ID da ORIGEM (direto)) | 08 CANAIS; MEDIUM; RAMAL FACILITA | R$ 0,00 | 2026-03-06 | Concluído |
| 5938068000031490320 | TUDOR BATERIAS \| CHURN | churn | alta | 5938068000001638329 | sim | CT - 021 - 01/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 032 -01/2024 (ligada ao ID da ORIGEM (direto)) | LINHA SIP; RAMAL FALE A VONTADE - QUANTIDADE DE 5 ATE 10 | R$ 0,00 | 2026-03-25 | Concluído |
| 5938068000031630001 | MAQUINAGRO \| CHURN | churn | alta | 5938068000017953022 | sim | não encontrado | PPA - 442 -04/2025 (ligada ao ID da ORIGEM (direto)) | MEDIA GATEWAY GSM; STARTER | R$ 0,00 | 2026-03-10 | Concluído |
| 5938068000031869278 | PREF IBATIBA \| CHURN | churn | alta | 5938068000010451002 | sim | CT - 137 - 08/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 284 -08/2024 (ligada ao ID da ORIGEM (direto)) | 16 CANAIS; LARGE | R$ 0,00 | 2026-04-09 | Concluído |
| 5938068000031929024 | BIAZOTTI \| CHURN | churn | alta | 5938068000023748110 | sim | não encontrado | PPA - 645 -10/2025 (ligada ao ID da ORIGEM (direto)) | CALLFACE AI - STARTER BUSINESS | R$ 0,00 | 2026-01-06 | Concluído |
| 5938068000032802081 | VETLOG \| CHURN | churn | alta | 5938068000009596057 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2026-05-04 | Concluído |
| 5938068000033638081 | CHURN \| ASSA ABLOY | churn | alta | 5938068000027791001 | sim | CT - 258 - 01/2026 (ligado ao ID da ORIGEM (direto)) | PPA - 711 -01/2026 (ligada ao ID da ORIGEM (direto)) | LINHA SIP | R$ 0,00 | 2026-05-18 | Concluído |
| 5938068000034416002 | S2B SOFTWARE \| CHURN | churn | alta | 5938068000013050003 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2026-05-15 | Contrato |
| 5938068000034598001 | CUBES SOLUÇOES \| CHURN | churn | alta | 5938068000034598001 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2026-06-05 | Contrato |
| 5938068000036003667 | PROCESSA SISTEMAS \| CHURN | churn | alta | 5938068000010319067 | sim | não encontrado | PPA - 280 -08/2024 (ligada ao ID da ORIGEM (direto)) | 08 CANAIS; CARÊNCIA; LARGE | R$ 0,00 | 2026-05-25 | Contrato |
| 5938068000037158001 | CHURN \| AMMO VAREJO | churn | alta | 5938068000027791084 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2026-07-17 | Concluído |
| 5938068000037929001 | RENOVA SEGUROS \| CHURN | churn | alta | - | - | não encontrado | não encontrada | - | R$ 0,00 | 2026-08-04 | Concluído |
| 5938068000037929011 | CAMPUCENTER \| CHURN | churn | alta | - | - | não encontrado | não encontrada | - | R$ 0,00 | 2026-07-31 | Concluído |
| 5938068000001073008 | ALM SEGURADORA - UPGRADE 8 RAMAIS | upgrade | alta | 5938068000001073008 | sim | não encontrado | PPA - 029 -01/2024 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE | R$ 320,00 | 2024-01-04 | Concluído |
| 5938068000001638223 | MANDIC SÃO PAULO \| Upgrade 02R \| CINTHIA CUNHA | upgrade | alta | 5938068000002372278 | sim | CT - 019 - 01/2024 (ligado ao ID do EVENTO (direto)) | PPA - 031 -01/2024 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE - MANDIC | R$ 84,00 | 2024-02-29 | Concluído |
| 5938068000001689026 | INVENT \| UPGRADE 3 RAMAIS \| CINTHIA | upgrade | alta | 5938068000006985020 | sim | CT - 026 - 01/2024 (ligado ao ID do EVENTO (direto)) | PPA - 033 -01/2024 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE | R$ 75,00 | 2024-01-31 | Concluído |
| 5938068000002790045 | CMO l UPGRADE + 10 LINHAS l CINTHIA | upgrade | alta | 5938068000001815016 | sim | CT - 042 - 02/2024 (ligado ao ID do EVENTO (direto)) | PPA - 088 -02/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP - PORTABILIDADE | R$ 350,00 | 2024-02-29 | Concluído |
| 5938068000004182001 | ACQUALIMP \| UPGRADE 2 LINHAS \| JACQUELINE WEVY | upgrade | alta | 5938068000002238031 | sim | não encontrado | PPA - 137 -03/2024 (ligada ao ID do EVENTO (direto)) | LINHA ADICIONAL | R$ 30,00 | 2024-03-29 | Perdido |
| 5938068000004636236 | INVENT \| UPG 4R \| CINTHIA | upgrade | alta | 5938068000006985020 | sim | CT - 083 - 04/2024 (ligado ao ID do EVENTO (direto)) | PPA - 154 -04/2024 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE | R$ 100,00 | 2024-04-30 | Concluído |
| 5938068000005060213 | SWISS PARK OFFICE \| UPGRADE 02R \| CINTHIA | upgrade | alta | 5938068000005060197 | sim | CT - 087 - 04/2024 (ligado ao ID do EVENTO (direto)) | PPA - 161 -04/2024 (ligada ao ID do EVENTO (direto)) | RAMAL INTERNO | R$ 30,00 | 2024-04-30 | Concluído |
| 5938068000005201011 | INVENT \| UPGRADE 3 RAMAIS | upgrade | alta | 5938068000006985020 | sim | CT - 066 - 03/2024 (ligado ao ID do EVENTO (direto)) | não encontrada | - | R$ 75,00 | 2024-04-11 | Concluído |
| 5938068000007172001 | NUBBI \| UPGRADE MEDIUM \| CINTHIA | upgrade | alta | 5938068000004729022 | sim | CT - 108 - 05/2024 (ligado ao ID do EVENTO (direto)) | PPA - 211 -05/2024 (ligada ao ID do EVENTO (direto)) | + 800 MIN - STARTER; MEDIUM; SMALL | R$ 350,00 | 2024-05-31 | Closed Won |
| 5938068000007810001 | SWISS PARK OFFICE \| UPGRADE 02R \| CINTHIA CUNHA | upgrade | alta | 5938068000005060197 | sim | CT - 115 - 06/2024 (ligado ao ID do EVENTO (direto)) | PPA - 224 -06/2024 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE | R$ 60,00 | 2024-06-28 | Concluído |
| 5938068000011600153 | JARVIS DO BRASIL \| UPGRADE - 30L \| FABIO ROSA WEVY | upgrade | alta | 5938068000010560010 | sim | não encontrado | PPA - 313 -09/2024 (ligada ao ID do EVENTO (direto)) | LINHA ADICIONAL | R$ 450,00 | 2024-09-24 | Concluído |
| 5938068000016037003 | ATRIO \| UPGRADE \| LETÍCIA - ID 3496 | upgrade | alta | 5938068000014039027 | sim | CT - 184 - 11/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 401 -01/2025 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL - FALE A VONTADE - IBIS; RAMAL - INTERNO... | R$ 1.350,00 | 2025-01-31 | Perdido |
| 5938068000018746001 | AMMO VAREJO - UPGRADE +800 MIN | upgrade | alta | 5938068000018746019 | sim | CT - 210 - 06/2025 (ligado ao ID da ORIGEM (direto)) | PPA - 458 -05/2025 (ligada ao ID da ORIGEM (direto)) | + 800 MIN - STARTER | R$ 0,00 | 2025-06-19 | Closed Lost |
| 5938068000018746019 | AMMO VAREJO - UPGRADE +800MIN | upgrade | alta | 5938068000018746001 | sim | CT - 210 - 06/2025 (ligado ao ID do EVENTO (direto)) | PPA - 458 -05/2025 (ligada ao ID do EVENTO (direto)) | + 800 MIN - STARTER | R$ 150,00 | 2025-06-26 | Closed Won |
| 5938068000019591210 | ALM SEGURADORA - UPGRADE 09 RAMAIS - MAYARA | upgrade | alta | 5938068000009811361 | sim | CT - 204 - 06/2025 (ligado ao ID do EVENTO (direto)) | PPA - 491 -06/2025 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE | R$ 360,00 | 2025-06-24 | Concluído |
| 5938068000020123001 | RIO PAX \| UPGRADE GRAVAÇÕES \| MAYARA | upgrade | alta | 5938068000005507023 | sim | CT - 212 - 06/2025 (ligado ao ID do EVENTO (direto)) | PPA - 504 -06/2025 (ligada ao ID do EVENTO (direto)) | UPGRADE DISCO - 256GB | R$ 329,90 | 2025-06-30 | Closed Won |
| 5938068000020380213 | DPASCHOAL \| UPGRADE GRAVAÇÕES \| | upgrade | alta | 5938068000009297056 | sim | CT - 133 - 08/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 512 -07/2025 (ligada ao ID do EVENTO (direto)) | UPGRADE DISCO - 128GB; UPGRADE DISCO - 256GB | R$ 509,80 | 2025-07-31 | Closed Lost |
| 5938068000020475001 | ATRIO JOINVILLE \| UPGRADE LINHAS \| MAYARA | upgrade | alta | 5938068000019784159 | sim | CT - 214 - 07/2025 (ligado ao ID do EVENTO (direto)) | PPA - 513 -07/2025 (ligada ao ID do EVENTO (direto)) | LINHA SIP - PORTABILIDADE | R$ 490,00 | 2025-07-28 | Concluído |
| 5938068000020475219 | HORUS BATERIAIS \| UPGRADE 01 LINHA \| MAYARA | upgrade | alta | 5938068000019918204 | sim | CT - 213 - 07/2025 (ligado ao ID do EVENTO (direto)) | PPA - 514 -07/2025 (ligada ao ID do EVENTO (direto)) | LINHA SIP - PORTABILIDADE | R$ 30,00 | 2025-06-30 | Concluído |
| 5938068000020644015 | BAITZ \| UPGRADE RAMAL \| MAYARA | upgrade | alta | - | - | não encontrado | PPA - 520 -07/2025 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE | R$ 156,00 | 2025-07-31 | Perdido |
| 5938068000020724087 | UPGRADE TI \| CALLFACE AI \| MAYARA | upgrade | alta | - | - | não encontrado | PPA - 530 -07/2025 (ligada ao ID do EVENTO (direto)) | CALLFACE AI | R$ 119,90 | 2025-07-31 | Closed Lost |
| 5938068000021728112 | BAITZ \| UPGRADE RAMAL \| MAYARA | upgrade | alta | 5938068000020644015 | sim | CT - 219 - 08/2025 (ligado ao ID do EVENTO (direto)) | PPA - 550 -08/2025 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE | R$ 40,00 | 2025-08-07 | Concluído |
| 5938068000022334025 | RIO PAX - UPGRADE DE LINHAS \| MAYARA | upgrade | alta | 5938068000005507001 | sim | CT - 221 - 08/2025 (ligado ao ID do EVENTO (direto)) | PPA - 559 -08/2025 (ligada ao ID do EVENTO (direto)) | LINHA SIP | R$ 199,50 | 2025-08-18 | Concluído |
| 5938068000022685483 | PEREZ \| UPGRADE 02 RAMAIS \| MAYARA | upgrade | alta | 5938068000016350019 | sim | CT - 224 - 08/2025 (ligado ao ID do EVENTO (direto)) | PPA - 574 -08/2025 (ligada ao ID do EVENTO (direto)) | RAMAL CALLFACE | R$ 80,00 | 2025-09-25 | Perdido |
| 5938068000022726581 | MESTIERI \| UPGRADE RAMAL \| MAYARA | upgrade | alta | - | - | não encontrado | PPA - 579 -08/2025 (ligada ao ID do EVENTO (direto)) | RAMAL CALLFACE | R$ 40,00 | 2025-08-30 | Nutrição |
| 5938068000022968001 | IPSILON \| UPGRADE USUARIO \| MAYARA | upgrade | alta | 5938068000022726191 | sim | não encontrado | PPA - 588 -09/2025 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 119,90 | 2025-09-03 | Closed Won |
| 5938068000022979031 | GRUPO RI HAPPY \| UPGRADE APARELHOS \| MAYARA | upgrade | alta | 5938068000007375005 | sim | CT - 227 - 09/2025 (ligado ao ID do EVENTO (direto)) | PPA - 589 -09/2025 (ligada ao ID do EVENTO (direto)) | APARELHO IP X3SG | R$ 400,00 | 2025-09-08 | Closed Won |
| 5938068000023373122 | NUVY \| UPGRADE 02 RAMAIS \| MAYARA | upgrade | alta | 5938068000022647273 | sim | CT - 229 - 09/2025 (ligado ao ID do EVENTO (direto)) | PPA - 609 -09/2025 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE | R$ 50,00 | 2025-09-11 | Concluído |
| 5938068000023456237 | CARGA CHEIA \| UPGRADE 01 RAMAL \| MAYARA | upgrade | alta | 5938068000001035019 | sim | não encontrado | PPA - 614 -09/2025 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE | R$ 45,00 | 2025-09-17 | Perdido |
| 5938068000023456488 | IPSILON \| UPGRADE LINHA SIP \| MAYARA | upgrade | alta | 5938068000022726191 | sim | não encontrado | PPA - 618 -09/2025 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - LINHA RECEPTIVA ADICIONAL | R$ 70,00 | 2025-09-15 | Closed Won |
| 5938068000023640001 | BAITZ \| UPGRADE RAMAL \| MAYARA | upgrade | alta | 5938068000021728112 | sim | CT - 232 - 09/2025 (ligado ao ID do EVENTO (direto)) | PPA - 620 -09/2025 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE | R$ 40,00 | 2025-09-19 | Concluído |
| 5938068000024194159 | SIGMA \| UPGRADE \| MAYARA | upgrade | alta | 5938068000014521006 | sim | CT - 236 - 10/2025 (ligado ao ID do EVENTO (direto)) | PPA - 638 -10/2025 (ligada ao ID do EVENTO (direto)) | APARELHO IP X3SG; LINHA 0800 - PORTABILIDADE | R$ 530,00 | 2025-10-03 | Concluído |
| 5938068000024794046 | FACILITA \| UPGRADE LINHAS \| PREF STA GERTRUDES \| MAYARA | upgrade | alta | 5938068000001796303 | sim | CT - 239 - 10/2025 (ligado ao ID do EVENTO (direto)) | PPA - 649 -10/2025 (ligada ao ID do EVENTO (direto)) | LINHA ADICIONAL | R$ 285,00 | 2025-10-16 | Concluído |
| 5938068000024794200 | ONR \| UPGRADE DE LINHAS \| MAYARA | upgrade | alta | 5938068000007403089 | sim | CT - 240 - 10/2025 (ligado ao ID do EVENTO (direto)) | PPA - 650 -10/2025 (ligada ao ID do EVENTO (direto)) | LINHA SIP | R$ 175,00 | 2025-10-17 | Contrato |
| 5938068000025016001 | ACELERA TECH \| UPGRADE CALLFACE AI \| MAYARA | upgrade | alta | 5938068000020873079 | sim | não encontrado | PPA - 652 -10/2025 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 90,00 | 2025-10-21 | Closed Won |
| 5938068000025108033 | SWISS PARK \| UPGRADE 02 RAMAIS \| MAYARA | upgrade | alta | 5938068000005060197 | sim | CT - 241 - 10/2025 (ligado ao ID do EVENTO (direto)) | PPA - 654 -10/2025 (ligada ao ID do EVENTO (direto)) | RAMAL CALLFACE | R$ 60,00 | 2025-10-29 | Concluído |
| 5938068000025659150 | ATRIO RECIFE \| UPGRADE DE LINHA \| MAYARA | upgrade | alta | 5938068000003098006 | sim | CT - 244 - 11/2025 (ligado ao ID do EVENTO (direto)) | PPA - 663 -11/2025 (ligada ao ID do EVENTO (direto)) | LINHA ADICIONAL | R$ 39,90 | 2025-11-14 | Concluído |
| 5938068000026237066 | GRUPO RIHAPPY \| UPGRADE DE LINHAS \| MAYARA | upgrade | alta | 5938068000001607028 | sim | não encontrado | PPA - 685 -11/2025 (ligada ao ID do EVENTO (direto)) | LINHA SIP - PORTABILIDADE | R$ 79,80 | 2026-02-27 | Perdido |
| 5938068000026528115 | FACILITA \| PREF ITATIAIUÇU \| UPGRADE 04 L \| MAYARA | upgrade | alta | - | - | não encontrado | PPA - 695 -12/2025 (ligada ao ID do EVENTO (direto)) | LINHA ADICIONAL | R$ 60,00 | 2025-12-05 | Perdido |
| 5938068000026528286 | ATRIO \| IBIS PELOTAS \| UPGRADE 41 R \| MAYARA | upgrade | alta | 5938068000020775054 | sim | CT - 248 - 12/2025 (ligado ao ID do EVENTO (direto)) | PPA - 696 -12/2025 (ligada ao ID do EVENTO (direto)) | RAMAL INTERNO | R$ 410,00 | 2025-12-03 | Concluído |
| 5938068000026601046 | ACELERAR TECH \| UPGRADE LINHA CALLFACE AI \| MAYARA | upgrade | alta | 5938068000020873079 | sim | não encontrado | PPA - 698 -12/2025 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - LINHA RECEPTIVA ADICIONAL | R$ 585,00 | 2026-01-16 | Closed Lost |
| 5938068000028365003 | TCI CONSTRUTORA \| UPGRADE APARELHO IP \| MAYARA | upgrade | alta | 5938068000009999019 | sim | CT - 257 - 01/2026 (ligado ao ID do EVENTO (direto)) | PPA - 725 -01/2026 (ligada ao ID do EVENTO (direto)) | TELEFONE FANVIL X4 | R$ 0,00 | 2026-01-30 | Closed Won |
| 5938068000028786001 | COMPUCENTER \| UPGRADE LINHA \| MAYARA | upgrade | alta | 5938068000002372243 | sim | não encontrado | PPA - 734 -01/2026 (ligada ao ID do EVENTO (direto)) | LINHA SIP | R$ 39,90 | 2026-02-02 | Concluído |
| 5938068000028818093 | TOCCATO \| UPGRADE TARIFAS INT \| MAYARA | upgrade | alta | 5938068000026127001 | sim | CT - 255 - 01/2026 (ligado ao ID da ORIGEM (direto)) | PPA - 737 -01/2026 (ligada ao ID do EVENTO (direto)) | LIGAÇÕES INTERNACIONAIS | R$ 0,00 | 2026-03-04 | Closed Won |
| 5938068000029090160 | NUVY \| UPGRADE CALLFACE \| MAYARA | upgrade | alta | 5938068000026528029 | sim | CT - 260 - 02/2026 (ligado ao ID do EVENTO (direto)) | PPA - 743 -02/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 239,80 | 2026-02-06 | Closed Won |
| 5938068000029864092 | SUSTENPACK \| UPGRADE CALLFACE AI \| MAYARA | upgrade | alta | 5938068000028659678 | sim | não encontrado | PPA - 773 -02/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 1.079,40 | 2026-02-24 | Closed Won |
| 5938068000030707449 | MOVVI \| UPGRADE LINHA \| MAYARA | upgrade | alta | 5938068000002372029 | sim | não encontrado | PPA - 791 -03/2026 (ligada ao ID do EVENTO (direto)) | LINHA SIP - NUMERO NOVO | R$ 29,90 | 2026-03-31 | Perdido |
| 5938068000030988302 | TCI \| UPGRADE DE APARELHOS \| MAYARA | upgrade | alta | - | - | não encontrado | PPA - 803 -03/2026 (ligada ao ID do EVENTO (direto)) | TELEFONE IP | R$ 125,00 | 2026-03-31 | Closed Lost |
| 5938068000031038003 | SUITABLE \| UPGRADE CALLFACE AI \| MAYARA \| STRIPE | upgrade | alta | 5938068000028985010 | sim | não encontrado | PPA - 805 -03/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 537,00 | 2026-03-25 | Closed Won |
| 5938068000031181144 | INTEGRA CSC \| UPGRADE OPENBOX \| MAYARA | upgrade | alta | 5938068000015591029 | sim | CT - 268 - 03/2026 (ligado ao ID da ORIGEM (direto)) | PPA - 819 -04/2026 (ligada ao ID do EVENTO (direto)) | OPENBOX - WHATSAPP | R$ 1.199,00 | 2026-06-25 | Closed Won |
| 5938068000032110155 | DOUTOR OLHO \| UPGRADE YEASTAR \| MAYARA | upgrade | alta | 5938068000009521001 | sim | CT - 279 - 04/2026 (ligado ao ID do EVENTO (direto)) | PPA - 841 -04/2026 (ligada ao ID do EVENTO (direto)) | STARTER - YEASTAR | R$ 449,90 | 2026-04-30 | Concluído |
| 5938068000032518596 | FACILITA \| SANTA GERTRUDES \| UPGRADE LINHAS | upgrade | alta | 5938068000001796303 | sim | CT - 029 - 01/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 872 -04/2026 (ligada ao ID do EVENTO (direto)) | LINHA SIP | R$ 2.481,70 | 2026-05-22 | Concluído |
| 5938068000033173002 | CONSORCIOCRED\| UPGRADE CALLFACE AI \| MAYARA | upgrade | alta | 5938068000032602168 | sim | CT - 278 - 04/2026 (ligado ao ID da ORIGEM (direto)) | PPA - 906 -05/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 179,90 | 2026-05-11 | Closed Won |
| 5938068000033967263 | ETC SOLUÇÕES \| UPGRADE CALLFACE AI \| MAYARA \| STRIPE | upgrade | alta | 5938068000032028937 | sim | não encontrado | PPA - 955 -05/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - STARTER | R$ 89,90 | 2026-05-25 | Closed Won |
| 5938068000033967718 | ONR \| UPGRADE LINHAS \| MAYARA | upgrade | alta | - | - | não encontrado | não encontrada | - | R$ 0,00 | 2026-05-29 | Levantamento de Escopo |
| 5938068000034079175 | RIO PAX \| UPGRADE LINHAS \| MAYARA | upgrade | alta | 5938068000005507023 | sim | CT - 287 - 05/2026 (ligado ao ID do EVENTO (direto)) | PPA - 961 -05/2026 (ligada ao ID do EVENTO (direto)) | LINHA SIP - NUMERO NOVO | R$ 59,80 | 2026-05-26 | Concluído |
| 5938068000034242180 | NEXXT SOLUÇÕES \| UPGRADE CALLFACE AI \| MAYARA \| STRIPE | upgrade | alta | 5938068000034150037 | sim | não encontrado | PPA - 972 -05/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 179,90 | 2026-05-28 | Closed Won |
| 5938068000034242525 | FOUR SOLLUTION \| UPGRADE CALLFACE AI \| MAYARA \| STRIPE | upgrade | alta | 5938068000031267010 | sim | não encontrado | PPA - 977 -05/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 359,80 | 2026-05-28 | Closed Won |
| 5938068000034328003 | SOLATIUM \| UPGRADE MINUTOS EXTRAS \| MAYARA \| STRIPE | upgrade | alta | 5938068000023748420 | sim | CT - 235 - 09/2025 (ligado ao ID da ORIGEM (direto)) | PPA - 979 -05/2026 (ligada ao ID do EVENTO (direto)) | UPGRADE DE MINUTOS | R$ 100,00 | 2026-05-29 | Closed Won |
| 5938068000034328034 | SOLATIUM \| UPGRADE CALLFACE AI \| MAYARA \| STRIPE | upgrade | alta | - | - | não encontrado | PPA - 980 -05/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 319,80 | 2026-05-29 | Closed Won |
| 5938068000034328061 | ANTECIPA FACIL \| UPGRADE CALLFACE AI \| MAYARA | upgrade | alta | 5938068000029027013 | sim | não encontrado | PPA - 981 -05/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 539,70 | 2026-05-29 | Closed Won |
| 5938068000034477030 | MASCARENHAS \| UPGRADE DE MAQUINA \| MAYARA | upgrade | alta | 5938068000003243062 | sim | CT - 057 - 03/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 994 -06/2026 (ligada ao ID do EVENTO (direto)) | MANUTENÇÃO SOLUÇÃO 3CX | R$ 4.112,22 | 2026-06-11 | Proposal/Price Quote |
| 5938068000034847085 | AGENZI \| UPGRADE CALLFACE AI \| MAYARA \| STRIPE | upgrade | alta | 5938068000034449258 | sim | não encontrado | PPA - 1008 -06/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 179,90 | 2026-06-09 | Closed Won |
| 5938068000035002111 | LOGITHINK \| UPGRADE 4003 \| MAYARA | upgrade | alta | 5938068000033006086 | sim | CT - 293 - 06/2026 (ligado ao ID do EVENTO (direto)) | PPA - 1012 -06/2026 (ligada ao ID do EVENTO (direto)) | LINHA 4003 | R$ 400,00 | 2026-06-12 | Concluído |
| 5938068000035428001 | G30 \| CALLFACE AI UPGRADE \| MAYARA \| STRIPE | upgrade | alta | 5938068000030426036 | sim | não encontrado | PPA - 1019 -06/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 1.079,40 | 2026-06-15 | Closed Lost |
| 5938068000035491001 | CONSORCIO CRED \| UPGRADE CALLFACE AI \| MAYARA | upgrade | alta | 5938068000033173002 | sim | não encontrado | PPA - 1027 -06/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 359,80 | 2026-06-16 | Closed Won |
| 5938068000035491041 | TRADS CORRETORA \| UPGRADE CALLFACE AI \| MAYARA \| STRIPE | upgrade | alta | - | - | não encontrado | PPA - 1028 -06/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - STARTER | R$ 269,70 | 2026-06-16 | Closed Won |
| 5938068000035725644 | TRADS CORRETORA \| UPGRADE CALLFACE AI \| MAYARA \| STRIPE | upgrade | alta | - | - | CT - 296 - 06/2026 (ligado ao ID do EVENTO (direto)) | PPA - 1049 -06/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 3.000,00 | 2026-06-22 | Closed Won |
| 5938068000036113004 | MATTE TECNOLOGIA \| UPGRADE WHITE LABEL \| MAYARA \| STRIPE | upgrade | alta | - | - | CT - 297 - 06/2026 (ligado ao ID do EVENTO (direto)) | PPA - 1071 -06/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 6.495,00 | 2026-06-26 | Closed Won |
| 5938068000036173604 | MATTE TECNOLOGIA \| UPGRADE WHITELABEL \| MAYARA \| STRIPE | upgrade | alta | 5938068000034328186 | sim | CT - 301 - 06/2026 (ligado ao ID do EVENTO (direto)) | PPA - 1076 -06/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 9.900,00 | 2026-06-30 | Contrato |
| 5938068000036173951 | PONTUA \| UPGRADE CALLFACE \| MAYARA | upgrade | alta | 5938068000030596034 | sim | CT - 300 - 06/2026 (ligado ao ID do EVENTO (direto)) | PPA - 1078 -06/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING | R$ 147,50 | 2026-06-30 | Closed Won |
| 5938068000037214033 | ELGIN \| UPGRADE RAMAIS E LINHAS \| MAYARA | upgrade | alta | - | - | não encontrado | PPA - 1084 -07/2026 (ligada ao ID do EVENTO (direto)) | LINHA SIP - PORTABILIDADE | R$ 418,60 | 2026-07-31 | Delivery PABX |
| 5938068000037572086 | RIO PAX \| UPGRADE DE LINHAS \| MAYARA | upgrade | alta | 5938068000034079175 | sim | CT - 306 - 07/2026 (ligado ao ID do EVENTO (direto)) | PPA - 1088 -07/2026 (ligada ao ID do EVENTO (direto)) | LINHA SIP - NUMERO NOVO | R$ 149,50 | 2026-07-08 | Contrato |
| 5938068000037773430 | TWO SOLUTION \| UPGRADE CALLFACE AI \| MAYARA | upgrade | alta | - | - | não encontrado | não encontrada | - | R$ 1.259,30 | 2026-07-27 | Closed Won |
| 5938068000037773470 | BUCCO \| UPGRADE CALLFACE AI | upgrade | alta | - | - | CT - 311 - 08/2026 (ligado ao ID do EVENTO (direto)) | PPA - 1095 -08/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - STARTER; LINHA SIP - PORTABILIDADE | R$ 124,90 | 2026-08-07 | Delivery AI |
| 5938068000037823048 | MONARCA \| UPGRADE CALLFACE AI | upgrade | alta | - | - | não encontrado | não encontrada | - | R$ 359,80 | 2026-07-28 | Closed Won |
| 5938068000037825136 | TWO SOLUTION \| UPGRADE CALLPILOT | upgrade | alta | - | - | não encontrado | não encontrada | - | R$ 100,00 | 2026-07-27 | Closed Won |
| 5938068000037828227 | MONARCA \| UPGRADE CALLFACE AI | upgrade | alta | - | - | não encontrado | não encontrada | - | R$ 359,80 | - | Closed Won |
| 5938068000037830099 | G30 \| UPGRADE CALLFACE AI \| MAYARA | upgrade | alta | - | - | não encontrado | não encontrada | - | R$ 1.439,20 | 2026-07-20 | Closed Won |
| 5938068000037830221 | TWO SOLUTION \| UPGRADE CALLPILOT | upgrade | alta | - | - | não encontrado | não encontrada | - | R$ 100,00 | - | Closed Won |
| 5938068000037830238 | G30 \| UPGRADE CALLFACE AI \| MAYARA | upgrade | alta | - | - | não encontrado | não encontrada | - | R$ 1.439,20 | - | Closed Won |
| 5938068000037830245 | JUSBRASIL \| UPGRADE \| CALLFACE AI | upgrade | alta | - | - | não encontrado | não encontrada | - | R$ 359,80 | - | Closed Lost |
| 5938068000037839120 | CONCILIADOR CONTABIL \| UPGRADE CALLFACE AI \| MAYARA \| STRIPE | upgrade | alta | - | - | não encontrado | não encontrada | - | R$ 180,00 | - | Closed Won |
| 5938068000037841005 | CONCILIADOR CONTABIL \| UPGRADE CALLFACE AI \| MAYARA \| STRIPE | upgrade | alta | - | - | não encontrado | não encontrada | - | R$ 180,00 | 2026-07-03 | Closed Won |
| 5938068000037844083 | ELGIN \| UPGRADE RAMAIS E LINHAS \| CALLFACE | upgrade | alta | - | - | não encontrado | não encontrada | - | R$ 0,00 | - | Negotiation/Review |
| 5938068000037847015 | RIO PAX \| UPGRADE DE LINHAS \| MAYARA | upgrade | alta | - | - | não encontrado | não encontrada | - | R$ 149,50 | 2026-07-14 | Closed Won |
| 5938068000037850076 | TWO SOLUTION \| UPGRADE CALLFACE AI \| MAYARA | upgrade | alta | - | - | não encontrado | não encontrada | - | R$ 1.259,30 | - | Closed Won |
| 5938068000001607028 | RIHAPPY \| DOWNG 37R \| CINTHIA | downgrade | alta | 5938068000007375005 | sim | não encontrado | PPA - 024 -01/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL - FALE A VONTADE; TELEFONE FANVIL X3; TE... | R$ 0,00 | 2024-06-30 | Perdido |
| 5938068000003240093 | REDE OBA \| DOWNGRADE \| CINTHIA | downgrade | alta | 5938068000003240083 | sim | CT - 101 - 04/2024 (ligado ao ID do EVENTO (direto)) | PPA - 102 -02/2024 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE; TELEFONE FANVIL X7 | R$ -8.102,10 | 2024-04-24 | Concluído |
| 5938068000003427019 | TOZZINI PAULISTA \| DOWNGRADE 268R \| CINTHIA CUNHA | downgrade | alta | 5938068000003427001 | sim | não encontrado | não encontrada | - | R$ -6.978,72 | 2023-10-25 | Closed Won |
| 5938068000003526115 | EUROCAR l DOWNGRADE l RAFAEL RAMPAZO | downgrade | alta | 5938068000003526100 | sim | não encontrado | PPA - 111 -03/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL - FALE A VONTADE | R$ -405,00 | 2024-02-28 | Perdido |
| 5938068000003567135 | SH l DOWNGRADE NPS l RAFAEL RAMPAZO | downgrade | alta | 5938068000003567111 | sim | não encontrado | PPA - 153 -04/2024 (ligada ao ID do EVENTO (direto)) | PESQUISA DE SATISFAÇÃO | R$ -300,00 | 2024-03-30 | Closed Lost |
| 5938068000003567242 | DOLP ENG \| DOWG 39R \| CINTHIA | downgrade | alta | 5938068000003567224 | sim | não encontrado | PPA - 122 -03/2024 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE | R$ -1.365,00 | 2024-04-30 | Perdido |
| 5938068000003567268 | INTEGRA \| DOWNGRADE DE INTEG l CINTHIA | downgrade | alta | 5938068000008191001 | sim | não encontrado | PPA - 146 -03/2024 (ligada ao ID do EVENTO (direto)) | INTEGRAÇÃO BITRIX | R$ -737,98 | 2024-04-30 | Closed Lost |
| 5938068000003585373 | HOSP CARE CALEDONIA \| DOWNGRADE 165L \| CINTHIA | downgrade | alta | 5938068000009734124 | sim | não encontrado | PPA - 119 -03/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP HOSPITAL CARE | R$ -5.775,00 | 2024-08-31 | Perdido |
| 5938068000004636212 | RAMO BH \| DOWNGRADE 11R \| CINTHIA | downgrade | alta | 5938068000004636199 | sim | CT - 090 - 04/2024 (ligado ao ID do EVENTO (direto)) | PPA - 171 -04/2024 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE | R$ -110,00 | 2024-04-15 | Concluído |
| 5938068000006745062 | EUROCAR \| DOWNGRADE 07L \| RAFAEL | downgrade | alta | 5938068000003526100 | sim | não encontrado | PPA - 206 -05/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP | R$ -245,00 | 2024-02-28 | Concluído |
| 5938068000007646057 | H&CO \| DOWNGRADE LINHA \| JACQUELINE | downgrade | alta | 5938068000006046027 | sim | não encontrado | PPA - 221 -06/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP | R$ -35,00 | 2024-06-30 | Concluído |
| 5938068000009297028 | G&H INTERMEDIAÇÃO \| DOWNG 01L \| CINTHIA | downgrade | alta | 5938068000009297018 | sim | não encontrado | PPA - 253 -07/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP | R$ -25,00 | 2024-07-31 | Perdido |
| 5938068000011218001 | TOZZINI FREIRE POA \| DOWNGRADE | downgrade | alta | 5938068000003792091 | sim | CT - 192 - 12/2024 (ligado ao ID do EVENTO (direto)) | PPA - 305 -09/2024 (ligada ao ID do EVENTO (direto)) | Ramal + Ligações Ilimitadas Fixo e Movel \| TOZZINI; Tele... | R$ -2.852,19 | 2024-09-30 | Perdido |
| 5938068000014304015 | SLMANDIC \| DOWNGRADE CALLFACE TV CONECTA \| FABIO ROSA | downgrade | alta | 5938068000001473012 | sim | CT - 022 - 01/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 376 -11/2024 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE; TELEFONE FANVIL X3 | R$ -276,50 | 2024-11-29 | Perdido |
| 5938068000015253060 | SHX \| -9 APARELHOS - DOWNGRADE | downgrade | alta | 5938068000015253049 | sim | CT - 205 - 06/2025 (ligado ao ID do EVENTO (direto)) | PPA - 493 -06/2025 (ligada ao ID do EVENTO (direto)) | RENOVAÇÃO DOWNGRADE | R$ 0,00 | 2024-12-10 | Closed Won |
| 5938068000016350001 | PEREZ MATERIAIS \| ID 3672 \| DOWNGRADE TÉCNICO \| JÉSSICA | downgrade | alta | 5938068000016350019 | sim | não encontrado | PPA - 413 -02/2025 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE; RAMAL INTERNO | R$ -161,00 | 2025-02-14 | Perdido |
| 5938068000016504069 | COMPUCENTER \| DOWNGRADE DE 1 LINHA \| JÉSSICA | downgrade | alta | 5938068000002372243 | sim | não encontrado | PPA - 410 -02/2025 (ligada ao ID do EVENTO (direto)) | LINHA SIP | R$ 0,00 | 2025-02-28 | Perdido |
| 5938068000016785001 | LAMPEJOS \| DOWNGRADE 1 RAMAL \| JÉSSICA | downgrade | alta | 5938068000009811449 | sim | não encontrado | PPA - 417 -02/2025 (ligada ao ID do EVENTO (direto)) | RAMAL - FALE A VONTADE | R$ -45,00 | 2025-02-19 | Perdido |
| 5938068000017556001 | ACA ADVOGADOS \| DOWNGRADE RAMAL E APAREL. \| JÉSSICA | downgrade | alta | 5938068000011404036 | sim | não encontrado | PPA - 434 -03/2025 (ligada ao ID do EVENTO (direto)) | RAMAL CALLFACE; TELEFONE FANVIL X3 | R$ -50,00 | 2025-03-31 | Perdido |
| 5938068000022480151 | DOWNGRADE \| PASSARELLI \| MAYARA | downgrade | alta | 5938068000007078001 | sim | CT - 222 - 08/2025 (ligado ao ID do EVENTO (direto)) | PPA - 564 -08/2025 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL - FALE A VONTADE | R$ 175,00 | 2025-08-20 | Concluído |
| 5938068000022495001 | HOSPITAL CARE CASA DE SAUDE \| DOWNGRADE \| MAYARA | downgrade | alta | 5938068000009679001 | sim | não encontrado | PPA - 565 -08/2025 (ligada ao ID do EVENTO (direto)) | LINHA SIP; Ramal + Ligações Ilimitadas Fixo e Movel; TELE... | R$ 0,00 | 2026-01-31 | Contrato |
| 5938068000022647058 | HOSPITAL CALEDONIA \| DOWNGRADE \| MAYARA | downgrade | alta | 5938068000009734124 | sim | CT - 228 - 09/2025 (ligado ao ID do EVENTO (direto)) | PPA - 570 -08/2025 (ligada ao ID do EVENTO (direto)) | Ramal + Ligações Ilimitadas Fixo e Movel | R$ -7.770,00 | 2025-08-30 | Contrato |
| 5938068000023456345 | HOSPITAL CARE \| DOWNGRADE \| MAYARA | downgrade | alta | 5938068000009734124 | sim | não encontrado | PPA - 616 -09/2025 (ligada ao ID do EVENTO (direto)) | LINHA SIP; Ramal + Ligações Ilimitadas Fixo e Movel | R$ 0,00 | 2026-01-01 | Contrato |
| 5938068000024283016 | DOWNGRADE \| KOUZINA | downgrade | alta | 5938068000003148019 | sim | CT - 070 - 03/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 126 -03/2024 (ligada ao ID da ORIGEM (direto)) | MEDIUM; TELEFONE FANVIL X3 - KOUZINA | R$ 0,00 | 2025-10-06 | Sem Retorno de Contato |
| 5938068000024702182 | PRIME & LLONK \| DOWNGRADE \| MAYARA | downgrade | alta | 5938068000022647178 | sim | não encontrado | não encontrada | - | R$ 39,90 | 2025-06-03 | Closed Won |
| 5938068000024926002 | DOWNGRADE \| ATRIO JOINVILLE \| MAYARA | downgrade | alta | 5938068000020475001 | sim | CT - 214 - 07/2025 (ligado ao ID da ORIGEM (direto)) | PPA - 513 -07/2025 (ligada ao ID da ORIGEM (direto)) | LINHA SIP - PORTABILIDADE | R$ 0,00 | 2025-10-21 | Sem Retorno de Contato |
| 5938068000025570299 | DOWNGRADE \| STARSOFT \| MAYARA | downgrade | alta | 5938068000009811068 | sim | não encontrado | PPA - 697 -12/2025 (ligada ao ID do EVENTO (direto)) | Ramal + Ligações Ilimitadas Fixo e Movel | R$ 17,00 | 2025-11-05 | Contrato |
| 5938068000027791374 | FACILITA \| DOWNGRADE \| MAYARA | downgrade | alta | 5938068000012576373 | sim | CT - 165 - 10/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 712 -01/2026 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL FACILITA | R$ 64,00 | 2025-12-04 | Contrato |
| 5938068000033253008 | ROYAL FIC \| DOWNGRADE | downgrade | alta | 5938068000018498005 | sim | não encontrado | PPA - 922 -05/2026 (ligada ao ID do EVENTO (direto)) | LINHA 3003; LINHA 4003 | R$ 1.300,00 | 2026-04-30 | Concluído |
| 5938068000034863001 | ELGIN \| DOWNGRADE \| MAYARA | downgrade | alta | 5938068000034863001 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2026-06-09 | Contrato |
| 5938068000002372029 | MOVVI \| Renovação \| CINTHIA CUNHA | renovação | alta | - | - | não encontrado | não encontrada | - | R$ 7.385,00 | 2023-11-29 | Closed Won |
| 5938068000002372086 | MEGAVIG (VASCO) \| RENOVAÇÃO COM UPGRADE \| JOÃO RAMOS | renovação | alta | - | - | não encontrado | não encontrada | - | R$ 1.574,00 | 2023-06-14 | Closed Won |
| 5938068000002372278 | SL MANDIC \| RENOVAÇÃO CALLFACE | renovação | alta | - | - | não encontrado | não encontrada | - | R$ 19.988,00 | 2022-11-29 | Closed Won |
| 5938068000003792091 | TOZZINI \| RENOVAÇÃO PORTO ALEGRE \| CINTHIA | renovação | alta | 5938068000003792058 | sim | CT - 091 - 04/2024 (ligado ao ID do EVENTO (direto)) | PPA - 125 -03/2024 (ligada ao ID do EVENTO (direto)) | RENOVAÇÃO TOZZINI PORTO ALEGRE | R$ 0,00 | 2024-04-22 | Closed Won |
| 5938068000004214025 | 90TI \| RENOVAÇÃO \| CINTHIA | renovação | alta | - | - | não encontrado | não encontrada | - | R$ 1.500,00 | 2023-09-04 | Closed Won |
| 5938068000008388013 | GRUPO RI HAPPY \| RENOVAÇÃO \| CINTHIA CUNHA | renovação | alta | 5938068000007375005 | sim | não encontrado | PPA - 235 -06/2024 (ligada ao ID do EVENTO (direto)) | 96 CANAIS; ENTERPRISE; LINHA ADICIONAL; TELEFONE FANVIL X... | R$ 12.864,90 | 2024-09-30 | Perdido |
| 5938068000008412030 | FIBERTEX \| NÃO RENOVAÇÃO AUTOMÁTICA \| CINTHIA | renovação | alta | 5938068000008412020 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2024-07-31 | Concluído |
| 5938068000008811006 | AUDERE \| RENOVAÇÃO \| CINTHIA | renovação | alta | 5938068000007051028 | sim | não encontrado | PPA - 248 -07/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL - FALE A VONTADE | R$ 0,00 | 2024-09-30 | Perdido |
| 5938068000008895094 | 1 TABELIAO CAMPINAS \| NÃO RENOVAÇÃO | renovação | alta | 5938068000008895084 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2024-07-20 | Closed Won |
| 5938068000010276174 | BRAVO LOG UBERARABA \| RENOVAÇÃO POR PACOTE ENTERPRISE \| CINTHIA CUNHA | renovação | alta | 5938068000005149113 | sim | não encontrado | PPA - 277 -08/2024 (ligada ao ID do EVENTO (direto)) | 32 CANAIS; ATA DIGISTAR XIP-270; ENTERPRISE; LINHA ADICIO... | R$ 6.569,90 | 2024-12-31 | Perdido |
| 5938068000010276266 | BRAVO LOG ARMAZEM CUIABA \| RENOVAÇÃO POR PACOTE ENTERPRISE \| CINTHIA CUNHA | renovação | alta | 5938068000009303165 | sim | não encontrado | PPA - 276 -08/2024 (ligada ao ID do EVENTO (direto)) | ENTERPRISE; LINHA ADICIONAL; TELEFONE FANVIL X3 | R$ 4.469,90 | 2024-12-31 | Perdido |
| 5938068000010718001 | SLMANDIC \| RENOVAÇÃO CALLFACE \| FABIO ROSA | renovação | alta | 5938068000002372278 | sim | não encontrado | PPA - 290 -08/2024 (ligada ao ID do EVENTO (direto)) | DASHBOARD + RELATORIO PERSONALIZADO; DESCONTO EXECUTIVO -... | R$ 14.700,00 | 2024-08-30 | Perdido |
| 5938068000014338020 | SLMANDIC \| RENOVAÇÃO CALLFACE \| FABIO ROSA | renovação | alta | 5938068000014304015 | sim | não encontrado | PPA - 377 -11/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL - FALE A VONTADE; TELEFONE FANVIL X3; TE... | R$ 226,50 | 2024-11-29 | Perdido |
| 5938068000017052083 | TOZZINI \| RENOVAÇÃO CALLFACE POA \| RENATO | renovação | alta | 5938068000011218001 | sim | CT - 192 - 12/2024 (ligado ao ID da ORIGEM (direto)) | PPA - 422 -03/2025 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL - FALE A VONTADE; TELEFONE FANVIL X3 | R$ 4.946,36 | 2025-03-31 | Perdido |
| 5938068000018156003 | AGRO UNIONE \| RENOVAÇÃO CALLFACE \| RENATO | renovação | alta | 5938068000011518099 | sim | não encontrado | PPA - 448 -04/2025 (ligada ao ID do EVENTO (direto)) | 08 CANAIS; STARTER | R$ 649,90 | 2025-04-16 | Perdido |
| 5938068000018187099 | GRUPO RI HAPPY \| CALLFACE RENOVAÇÃO \| LETICIA | renovação | alta | 5938068000007375005 | sim | não encontrado | PPA - 451 -04/2025 (ligada ao ID do EVENTO (direto)) | 96 CANAIS; LINHA ADICIONAL; TELEFONE FANVIL X3; TELEFONE ... | R$ 8.199,90 | 2025-05-30 | Proposta Enviada |
| 5938068000022495178 | FIBERTEX \| RENOVAÇÃO \| MAYARA | renovação | alta | 5938068000008412040 | sim | não encontrado | PPA - 568 -08/2025 (ligada ao ID do EVENTO (direto)) | 08 CANAIS; LARGE; LINHA ADICIONAL | R$ 2.290,60 | 2025-08-21 | Concluído |
| 5938068000023211866 | AGRO UNIONE \| RENOVAÇÃO \| MAYARA | renovação | alta | 5938068000011518099 | sim | CT - 230 - 09/2025 (ligado ao ID do EVENTO (direto)) | PPA - 602 -09/2025 (ligada ao ID do EVENTO (direto)) | STARTER | R$ 499,90 | 2025-09-11 | Closed Won |
| 5938068000026873015 | ORTHOMUNDI \| RENOVAÇÃO \| MAYARA | renovação | alta | 5938068000010056156 | sim | CT - 280 - 04/2026 (ligado ao ID do EVENTO (direto)) | PPA - 706 -12/2025 (ligada ao ID do EVENTO (direto)) | LINHA SIP - PORTABILIDADE; PABX EM NUVEM | R$ 4.752,55 | 2026-04-30 | Delivery PABX |
| 5938068000027791084 | AMMO VAREJO \| RENOVAÇÃO | renovação | alta | 5938068000011642033 | sim | não encontrado | PPA - 317 -09/2024 (ligada ao ID da ORIGEM (direto)) | 16 CANAIS; ENTERPRISE; LINHA 0800 - PORTABILIDADE | R$ 0,00 | 2026-01-30 | Closed Lost |
| 5938068000028129013 | SL MANDIC \| RENOVAÇÃO CALLFACE \| MAYARA | renovação | alta | 5938068000002372278 | sim | CT - 273 - 04/2026 (ligado ao ID do EVENTO (direto)) | PPA - 716 -01/2026 (ligada ao ID do EVENTO (direto)) | CALLFACE AI - COLD CALLING; PABX EM NUVEM | R$ 16.252,68 | 2026-07-31 | Negotiation/Review |
| 5938068000028233093 | LAMPEJOS \| RENOVAÇÃO \| MAYARA | renovação | alta | 5938068000009811449 | sim | CT - 256 - 01/2026 (ligado ao ID do EVENTO (direto)) | PPA - 719 -01/2026 (ligada ao ID do EVENTO (direto)) | LINHA SIP; Ramal + Ligações Ilimitadas Fixo e Movel | R$ 119,90 | 2026-01-30 | Concluído |
| 5938068000029537098 | CELLERA FARMA \| RENOVAÇÃO YEASTAR \| MAYARA | renovação | alta | 5938068000002404001 | sim | CT - 262 - 02/2026 (ligado ao ID do EVENTO (direto)) | PPA - 766 -02/2026 (ligada ao ID do EVENTO (direto)) | LINHA 0800 - PORTABILIDADE; STARTER - YEASTAR | R$ 1.419,00 | 2026-05-20 | Concluído |
| 5938068000032602210 | CENTERVAL \| RENOVAÇÃO DE CONTRATO \| MAYARA | renovação | alta | 5938068000009636173 | sim | CT - 285 - 05/2026 (ligado ao ID do EVENTO (direto)) | PPA - 885 -04/2026 (ligada ao ID do EVENTO (direto)) | 16 CANAIS; LIGAÇÕES INTERNACIONAIS; YEASTAR - ENTERPRISE | R$ 2.851,37 | 2026-05-14 | Concluído |
| 5938068000033133010 | AUTOLOG \| RENOVAÇÃO YEASTAR \| MAYARA | renovação | alta | 5938068000010988011 | sim | não encontrado | PPA - 905 -05/2026 (ligada ao ID do EVENTO (direto)) | STARTER - YEASTAR | R$ 2.547,89 | 2026-06-02 | Negociação/Revisão |
| 5938068000035725489 | FIBERTEX \| 3CX RENOVAÇÃO \| MAYARA | renovação | alta | 5938068000008412040 | sim | CT - 295 - 06/2026 (ligado ao ID do EVENTO (direto)) | PPA - 1048 -06/2026 (ligada ao ID do EVENTO (direto)) | 08 CANAIS; LARGE; LINHA ADICIONAL | R$ 2.174,90 | 2026-06-22 | Concluído |
| 5938068000002372243 | COMPUCENTER I RENEGOCIAÇÃO (SOMENTE PREÇO) | alteração contratual | alta | - | - | não encontrado | não encontrada | - | R$ 900,00 | 2024-01-02 | Closed Won |
| 5938068000005850016 | TEKSEA \| CANCELA/SUBSTITUI \| CINTHIA | alteração contratual | alta | 5938068000005850006 | sim | CT - 109 - 05/2024 (ligado ao ID do EVENTO (direto)) | PPA - 184 -04/2024 (ligada ao ID do EVENTO (direto)) | LINHA SIP; RAMAL - FALE A VONTADE | R$ -2,00 | 2024-05-31 | Concluído |
| 5938068000010128011 | INTEGRA \| CANCELA/SUBST \| DASHBOARD | alteração contratual | alta | 5938068000008191001 | sim | CT - 134 - 08/2024 (ligado ao ID do EVENTO (direto)) | PPA - 274 -08/2024 (ligada ao ID do EVENTO (direto)) | INTEGRAÇÃO BITRIX; WEB API + CONTROLE DE PAUSA + PESQUISA... | R$ 0,00 | 2024-08-30 | Closed Won |
| 5938068000016591039 | TOP INTERNCAIONAL \| ID 3632 \| MIGRAÇÃO 0800 \| LETÍCIA | alteração contratual | alta | - | - | não encontrado | PPA - 412 -02/2025 (ligada ao ID do EVENTO (direto)) | LINHA 0800 - NUMERO NOVO | R$ 18.000,00 | 2025-02-28 | Perdido |
| 5938068000020775198 | MANDIC \| SERVIÇO DE MIGRAÇÃO\| MAYARA | alteração contratual | alta | 5938068000005060146 | sim | não encontrado | PPA - 525 -07/2025 (ligada ao ID do EVENTO (direto)) | Serviço de Instalação e Configuração | R$ 4.500,00 | 2025-07-31 | Closed Lost |
| 5938068000025164004 | SWISS PARK \| MIGRAÇÃO PARA YEASTAR \| MAYARA | alteração contratual | alta | 5938068000005060197 | sim | CT - 246 - 12/2025 (ligado ao ID do EVENTO (direto)) | PPA - 655 -10/2025 (ligada ao ID do EVENTO (direto)) | Locação de aparelho IP com fio; YEASTAR - ENTERPRISE | R$ 4.039,90 | 2025-11-18 | Concluído |
| 5938068000025294001 | COPPI \| MIGRAÇÃO PARA YEASTAR \| MAYARA | alteração contratual | alta | 5938068000011329013 | sim | não encontrado | PPA - 658 -11/2025 (ligada ao ID do EVENTO (direto)) | YEASTAR - ENTERPRISE | R$ 850,00 | 2026-01-20 | Contrato |
| 5938068000026467001 | ACQUALIMP \| MIGRAÇÃO YEASTAR \| MAYARA | alteração contratual | alta | 5938068000002238031 | sim | não encontrado | PPA - 691 -12/2025 (ligada ao ID do EVENTO (direto)) | 0800 - 1 canal; MEDIUM | R$ 1.360,00 | 2026-02-27 | Concluído |
| 5938068000026601087 | COMPUCENTER INF \| MIGRAÇÃO PARA YEASTAR \| MAYARA | alteração contratual | alta | 5938068000002372243 | sim | não encontrado | PPA - 699 -12/2025 (ligada ao ID do EVENTO (direto)) | STARTER - YEASTAR | R$ 899,00 | 2025-12-31 | Concluído |
| 5938068000026601160 | PEREZ MATERIAIS \| MIGRAÇÃO PARA YEASTAR \| MAYARA | alteração contratual | alta | 5938068000022685483 | sim | CT - 224 - 08/2025 (ligado ao ID da ORIGEM (direto)) | PPA - 700 -12/2025 (ligada ao ID do EVENTO (direto)) | STARTER - YEASTAR | R$ 1.200,00 | 2025-12-05 | Concluído |
| 5938068000026601245 | STARSOFT \| MIGRAÇÃO PARA YEASTAR \| MAYARA | alteração contratual | alta | 5938068000009811068 | sim | CT - 251 - 01/2026 (ligado ao ID do EVENTO (direto)) | PPA - 701 -12/2025 (ligada ao ID do EVENTO (direto)) | STARTER - YEASTAR | R$ 1.100,00 | 2026-01-19 | Concluído |
| 5938068000026601391 | FULLTIME \| MIGRAÇÃO PARA YEASTAR \| MAYARA | alteração contratual | alta | 5938068000026601391 | sim | não encontrado | não encontrada | - | R$ 0,00 | 2026-02-27 | Concluído |
| 5938068000026858001 | TEXEL \| MIGRAÇÃO PARA YEASTAR \| MAYARA | alteração contratual | alta | - | - | não encontrado | PPA - 705 -12/2025 (ligada ao ID do EVENTO (direto)) | STARTER - YEASTAR | R$ 779,00 | 2026-02-27 | Proposta Enviada |
| 5938068000027018001 | UNIFEOB \| MIGRAÇÃO PARA YEASTAR \| MAYARA | alteração contratual | alta | 5938068000010821006 | sim | não encontrado | PPA - 707 -12/2025 (ligada ao ID do EVENTO (direto)) | LINHA SIP - PORTABILIDADE; YEASTAR - ENTERPRISE | R$ 5.089,90 | 2026-07-31 | Negociação/Revisão |
| 5938068000028303105 | AWALTECH \| MIGRAÇÃO PARA YEASTAR \| MAYARA | alteração contratual | alta | 5938068000006985341 | sim | CT - 254 - 01/2026 (ligado ao ID do EVENTO (direto)) | PPA - 720 -01/2026 (ligada ao ID do EVENTO (direto)) | STARTER - YEASTAR | R$ 650,00 | 2026-01-20 | Contrato |
| 5938068000028724246 | ALPHAVILLE \| MIGRAÇÃO YEASTAR \| MAYARA | alteração contratual | alta | 5938068000028724223 | sim | CT - 261 - 02/2026 (ligado ao ID do EVENTO (direto)) | PPA - 745 -02/2026 (ligada ao ID do EVENTO (direto)) | YEASTAR - ENTERPRISE | R$ 5.227,52 | 2026-02-03 | Concluído |
---

## 4. Resposta explícita: dos 247, quantos representam cada evento real

O pedido original listou 7 categorias-alvo: *oportunidade comercial real / expansão / alteração contratual / renovação / churn / reativação / outro evento*. Como os 247 registros desta seção foram selecionados **exatamente porque carregam um token explícito de evento no nome**, a resposta direta é:

| Categoria solicitada | Qtd. dentro dos 247 | Confiança | Nota |
|---|---:|---|---|
| **churn** | 88 | Alta | keyword inequívoca + 85/88 com Origem preenchida + (fase 1) 97,5% de ordem cronológica correta evento-após-`ganho_at` |
| **renovação** | 26 | Alta | keyword inequívoca |
| **alteração contratual** | 16 (explícito: migração/renegociação/cancela-substitui) — **ou 46 se downgrade for lido como uma forma de alteração contratual** (ver nota abaixo) | Alta para os 16; média para a leitura ampliada | migração de hardware, renegociação de preço e cancela/substitui são, por natureza, mudança de termos contratuais sem necessariamente reduzir ou aumentar receita |
| **expansão** | 0 explícitos dentro deste recorte — **ou 87 se upgrade for lido como uma forma de expansão** (ver nota abaixo) | Média para a leitura ampliada | upgrade é economicamente uma expansão (aumento de receita em conta existente); o time optou por um rótulo próprio (`UPGRADE`) em vez de usar o mesmo vocabulário de `NOVO CALLFACE`/`LINHA ADICIONAL` que esta fase classificou como `expansão` na seção 2 — mantivemos os rótulos que o próprio time escolheu por serem a evidência primária |
| **oportunidade comercial real** | 0 | Alta | nenhum dos 247 tem nome de venda "normal" sem marcador de evento — são por construção o subconjunto marcado |
| **reativação** | 0 | Alta | nenhum token de reativação em nenhum dos 1.551 registros (não só os 247) — ver §2.3 |
| **outro evento** | 0 | Alta | nenhum resíduo — todo registro deste recorte caiu em um dos 5 tipos acima |

**Nota sobre a dupla leitura de upgrade/downgrade**: o pedido original não incluiu `upgrade`/`downgrade` na lista das 7 categorias-alvo, mas eles somam 117 dos 247 registros (47%) — a maior parte do corpo de eventos. Duas leituras possíveis, ambas com evidência:
- **Leitura literal** (a que este relatório usa como padrão): upgrade e downgrade são tipos próprios, com vocabulário e volume grande demais para serem apenas "expansão"/"alteração contratual" genéricas — churn(88) + upgrade(87) + downgrade(30) + renovação(26) + alteração contratual(16) = **247**.
- **Leitura mapeada nas 7 categorias solicitadas**: upgrade → expansão (87), downgrade → alteração contratual (30) → alteração contratual total sobe para 46 (16+30), expansão total = 87, resultando em churn(88) + expansão(87) + alteração contratual(46) + renovação(26) = 247. Ambas as leituras somam 247; a escolha entre elas é de nomenclatura de produto, não de fato — **decisão do Kauã**, incluída em §5.

### 4.1 "Realmente representam" — completude vs efetivação

Além de "qual rótulo", vale a pergunta mais dura: **o evento nomeado de fato aconteceu, ou é só uma proposta que não foi aceita?** Cruzando o Stage do próprio registro de evento com o que esse Stage normalmente significa no restante do corpus (`Perdido`/`Closed Lost`/`Sem Retorno de Contato` = proposta rejeitada em todo o resto do pipeline moderno):

| Categoria | N | Stage do evento é Perdido/Closed Lost/Sem Retorno | % | Leitura possível |
|---|---:|---:|---:|---|
| downgrade | 30 | **15** | **50,0%** | Possível que metade das "reduções" nomeadas nunca foi de fato aplicada — o cliente pode ter sido oferecido um downgrade e recusado, preferindo manter o plano ou cancelar |
| renovação | 26 | 9 | 34,6% | Possível que ~1/3 das "renovações" tentadas na verdade não foram assinadas — o que, ironicamente, é funcionalmente um churn não rotulado como tal |
| upgrade | 87 | 15 | 17,2% | ~1/6 dos upgrades oferecidos não foi aceito |
| alteração contratual | 16 | 2 | 12,5% | Baixo volume, pouco impacto no total |
| churn | 88 | 7 | 8,0% | O Stage aqui é majoritariamente `Contrato` (52/88) e `Concluído` (28/88), não `Perdido` — para CHURN, `Closed Lost`/`Perdido` provavelmente só significa "processo de cancelamento formalmente encerrado no funil", não "o churn não aconteceu"; a leitura de "não efetivado" é MENOS aplicável aqui que para upgrade/downgrade/renovação |

**Isto é apresentado como AMBIGUOUS, não como fato**: o Stage picklist do Zoho é compartilhado entre múltiplos pipelines (achado #10 da síntese fase 1 — dois pipelines PT/EN nunca normalizados) e o mesmo valor `Perdido`/`Closed Lost` pode significar coisas diferentes dependendo do tipo de registro. A hipótese de que "Perdido/Closed Lost em downgrade/upgrade/renovação = evento não efetivado" é plausível e seria o comportamento mais comum de um funil comercial padrão, mas **confirmar exige ler a Nota associada a cada um desses 15+15+9 registros** (fora do escopo desta leitura de CSV estruturado) ou perguntar ao time comercial. **Confiança: média** de que a hipótese está correta; **confiança baixa** de que dá pra aplicar sem revisão humana registro a registro.

Se a hipótese "Perdido/Closed Lost = não efetivado" for aceita, os números "realmente efetivados" caem para: churn ~81 (ajuste pequeno), upgrade ~72, downgrade ~15, renovação ~17, alteração contratual ~14 — uma diferença material principalmente em downgrade (30 nomeados → possivelmente só 15 de fato aplicados) e secundariamente em renovação (26 → possivelmente 17).

---

## 5. Casos ambíguos que exigem decisão do Kauã (documentados, não decididos)

| Caso | Evidência | O que precisa de decisão |
|---|---|---|
| Upgrade/downgrade como tipos próprios vs subtipos de expansão/alteração contratual (§4) | 117 dos 247 registros (47%) dependem dessa escolha de nomenclatura | Qual vocabulário usar no modelo de Evento do CRM 2.0 — 5 tipos (churn/upgrade/downgrade/renovação/alteração contratual) ou 4 (churn/expansão/alteração contratual/renovação)? |
| 15/30 downgrade e 9/26 renovação com Stage Perdido/Closed Lost/Sem Retorno (§4.1) | Stage sugere "não efetivado", mas o mesmo Stage é reciclado em pipelines diferentes | Confirmar nota a nota se a mudança de fato ocorreu antes de usar esse volume em qualquer métrica de churn/retenção |
| 145 oportunidades com `Oportunidade Origem` preenchida e nenhum token de evento no nome (§1.4) | Vínculo estrutural real, natureza (upsell/downsell/neutro) não determinável só pelo CSV | Vale investbr notas/contratos individualmente, ou aceitar como "alteração contratual não classificada" permanentemente? |
| Contrato `Status=Cancelado` (só 2 no módulo inteiro) ligado a evento `upgrade`+`migração`, não a `churn` (§3.3) | Campo `Status` já é conhecidamente pouco confiável (fase 1) | Não tratar `Status=Cancelado` como proxy de churn sem cruzar com ZohoSign/Notes |
| `reativação`: zero evidência textual em 1.551 registros | Ausência de token não prova ausência de evento de negócio | Se houve reativação de cliente churnado, ela está disfarçada de `CONTRATO INICIAL`/`NOVO NEGÓCIO` — só identificável cruzando CNPJ/nome de empresa entre um negócio antigo com CHURN e um negócio novo posterior, fora do escopo desta leitura |

---

## 6. Notas metodológicas e reprodutibilidade

- Fonte única: `~/Downloads/Data_001/Data/Oportunidades de Vendas_001.csv` (1.551 linhas), `Contratos_001.csv` (279 linhas, 271 com Oportunidade linkada), `Propostas_001.csv` (1.067 linhas, 1.051 com Oportunidade linkada), `Itens Cotados_001.csv` (1.876 linhas, 1.869 ligados a Proposta via `ID do pai.id`, 0 ligados a Contrato), `Products_001.csv` (274 linhas).
- Todo parsing em Python `csv.DictReader` com `encoding="utf-8-sig"` — nunca `wc -l` (há newlines dentro de campos de texto longo, como observado no briefing).
- Nenhuma escrita em nenhum arquivo de origem. Nenhuma conexão ao banco Postgres do CRM foi aberta nesta fase — a comparação Origem×`negocios` (CRM) já está coberta pela fase 1 (`03-reconciliacao-oportunidades.md` §1.1/§1.3) e foi deliberadamente reaproveitada, não reexecutada, para não arriscar inconsistência entre os dois relatórios.
- A classificação completa das 1.551 linhas (id, nome, categoria, confiança, base da decisão) foi gerada por script determinístico e é 100% reprodutível a partir do CSV fonte com a mesma ordem de precedência descrita em §2.1; não foi persistida como CSV no repositório por não ser artefato de produto — qualquer necessidade de auditoria linha a linha completa pode reprocessar o CSV fonte com o mesmo método.

---

## Relatórios relacionados

- [`00-SINTESE-CONSOLIDADA.md`](../00-SINTESE-CONSOLIDADA.md) — síntese da fase 1
- [`03-reconciliacao-oportunidades.md`](../03-reconciliacao-oportunidades.md) — achado original dos 244, cruzamento Origem×`negocios` (CRM), validação cronológica e impacto financeiro do CHURN
- [`04-reconciliacao-propostas-contratos.md`](../04-reconciliacao-propostas-contratos.md) — reconciliação agregada Propostas×Contratos (esta fase 2 aprofunda especificamente para o subconjunto dos 247 eventos)
