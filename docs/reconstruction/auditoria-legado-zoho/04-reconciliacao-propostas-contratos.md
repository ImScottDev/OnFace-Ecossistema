# Auditoria Legado Zoho — Frente 4: Reconciliação de Propostas e Contratos

**Data:** 2026-08-10
**Tipo:** Investigação forense, somente leitura (SELECT no Postgres, sem escrita em CSV ou banco)
**Fontes:**
- Zoho: `~/Downloads/Data_001/Data/{Contratos_001,Propostas_001,Itens Cotados_001,Itens Solicitados_001,Invoices_001,Invoiced Items_001}.csv` (utf-8-sig, IDs `zcrm_<sufixo numérico>`)
- CRM próprio: `postgresql://callface:callface2026dev@localhost:5432/callface_crm`, tabelas `negocios`, `contratos`, `propostas`, `proposta_itens`, `faturas`, `leads`, `empresas`

---

## 0. Nota de método — contagem de linhas do CSV é enganosa

Vários campos de descrição/produto no export Zoho contêm quebras de linha dentro de valores entre aspas (ex.: "ATÉ 80 RAMAIS\n10 LINHAS\n..."). Isso faz `wc -l` **sobreestimar** o número real de registros. Todas as contagens abaixo usam parsing CSV real (`csv.DictReader`, verificado sem linhas com número de colunas inconsistente — 0 linhas malformadas em todos os arquivos). Comparação:

| Arquivo | Linhas físicas (`wc -l`, sem header) | Registros reais (parse CSV) |
|---|---|---|
| Contratos_001.csv | 300 | **279** |
| Propostas_001.csv | 1096 | **1067** |
| Itens Cotados_001.csv | 7564 | **1876** |
| Itens Solicitados_001.csv | 1220 | **487** |
| Invoices_001.csv | 133 | **123** |
| Invoiced Items_001.csv | 429 | **226** |

Todas as análises abaixo usam a coluna "Registros reais". O enunciado da tarefa citava 301/7.565/1.221 (linhas físicas) — a diferença é só efeito de parsing, não dado novo.

Também: a tabela `contratos` no banco tem hoje **319 registros no total** (não 553 como mencionado no briefing — pode ser uma contagem de outro snapshot/momento; não investigado aqui, fora do escopo desta frente). Todos os 319 foram `created_at` entre **01/07/2026 e 10/08/2026** (255 em julho, 64 em agosto) — ou seja, 100% criados *depois* da migração (12/06/2026), consistente com a hipótese de reconstrução via planilha de faturamento, não migração direta do módulo nativo Zoho. **Nenhum dos 319 tem `zoho_id` preenchido** (`count(zoho_id) = 0`), e nenhum tem código de contrato Zoho ("CT - 0xx") em `notas`/`descricao`. Isso por si só já indica que não houve tentativa de link com o módulo nativo.

---

## 1. Contratos nativos Zoho ausentes do nosso `contratos` — achado principal

**279 contratos nativos** no Zoho (com prazo em meses, percentual de multa, código do contrato, valores reais). Matching contra `negocios.zoho_id` (via `Nome Oportunidade de Venda.id`), com fallback por empresa (`Empresa Nome.id` → `empresas.zoho_id` → negócios da empresa) para separar "gap de migração de negócio" de "gap de contrato":

| Categoria | Qtd |
|---|---|
| Sem "Nome Oportunidade de Venda.id" preenchido no Zoho | 8 |
| Com oportunidade preenchida, mas nenhum `negocios.zoho_id` corresponde | 193 |
| — desses 193+8, recuperável via fallback de empresa (empresa existe e tem ≥1 negócio no CRM) | 128 |
| — desses 193+8, empresa também não encontrada / sem negócio | 73 |
| Com negócio identificado direto (`negocios.zoho_id` bate) | **78** |
| — desses 78, tem ≥1 registro em `contratos` (via `negocio_id`) | **2** |
| — desses 78, **ZERO** registro em `contratos` | **76** |

**Resultado consolidado: 277 de 279 contratos nativos do Zoho (99,3%) não têm nenhum equivalente em `contratos` no nosso banco**, seja qual for o caminho de match usado (direto por negócio ou fallback generoso por empresa. Mesmo entre os 78 casos onde o negócio foi migrado com sucesso (link `zoho_id` intacto), **apenas 2 têm um contrato correspondente** — 76 negócios existentes no CRM não têm nenhum contrato vinculado, apesar do Zoho registrar um contrato nativo real e assinado para eles.

Confiança: **alta**. O teste é direto (join por ID), a contagem de "zero contrato local" foi verificada tanto por `negocio_id` direto quanto por fallback de empresa, e o padrão (LOGITHINK, e agora COPAFER, FACILITA TELECOM, IBIS JABOTICABAL, NERIAH, DPASCHOAL, etc. — ver amostra abaixo) se repete de forma consistente, não é ruído isolado.

Amostra de contratos nativos com termos jurídicos reais e zero registro local (negócio existe no CRM, contrato não):

| Código Zoho | Cliente | Prazo (meses) | Multa | Total Geral |
|---|---|---|---|---|
| CT - 016 - 01/2024 | COPAFER | 36 | 30% | R$ 200,00 |
| CT - 017 - 01/2024 | IBIS JABOTICABAL | 36 | 30% | R$ 175,00 |
| CT - 037/039/044/045/046 - 02/2024 | FACILITA TELECOM (5 contratos) | 36 | 30% | R$ 700–799,90 |
| CT - 047 - 02/2024 | EXACT SOLUTION - CONSULT | 12 | 30% | R$ 299,90 |
| CT - 049 - 02/2024 | NERIAH | 36 | 30% | R$ 299,90 |
| CT - 051 - 02/2024 | DPASCHOAL | 12 | 30% | R$ 100,00 |
| CT - 055 - 02/2024 | TABELIAO DE NOTAS ITATIBA | 24 | 30% | R$ 499,90 |
| CT - 056 - 03/2024 | SKA AUTOMAÇÃO | 12 | 30% | R$ 100,00 |
| CT - 060 - 03/2024 | Astra S/A Indústria e Comércio | 12 | 30% | R$ 799,90 |

---

## 2. Distribuição de Prazo Contrato e Percentual de Multa (279 contratos nativos)

Campo preenchido em 278/279 linhas (prazo) e 262/279 (multa). Os campos legados equivalentes ("Prazo do Contrato", "Percentual Multa") estão praticamente vazios (1 e 2 linhas, respectivamente) — o dado real está nos campos "(em meses)"/"de Multa".

**Prazo Contrato (em meses):**

| Meses | Qtd |
|---|---|
| 0 (sem prazo definido / avulso) | 40 |
| 1 | 3 |
| 12 | 37 |
| 24 | 26 |
| **36** | **171** |
| 48 | 1 |

Média 26,2 meses, mediana 36 meses. **171 de 279 contratos (61%) têm fidelidade contratual de 36 meses** — é o padrão dominante da Callface, e é justamente esse tipo de vínculo de longo prazo com multa que hoje não existe em lugar nenhum do CRM para a esmagadora maioria dos clientes (achado da seção 1).

**Percentual de Multa:**

| Multa | Qtd |
|---|---|
| 10% | 6 |
| **30%** | **256** |
| (vazio) | 17 |

Média 29,5%, mediana 30%. Ou seja: **quase todo contrato Callface tem multa de 30% por rescisão antecipada** — informação jurídica/financeira relevante em qualquer disputa de cancelamento, e que hoje não está em `contratos.notas` nem em nenhum outro campo estruturado do CRM.

Confiança: **alta** — dado direto do CSV nativo, sem necessidade de matching/inferência.

---

## 3. Propostas — Zoho vs `propostas` local

**1.067 propostas reais no Zoho.** Matching por negócio (`Nome Oportunidade de Venda.id` → `negocios.zoho_id`) e, quando o negócio existe, comparação de "Total Geral" (tolerância R$1) e data de criação (tolerância 45 dias) contra as propostas locais daquele mesmo negócio:

| Categoria | Qtd | % |
|---|---|---|
| Sem oportunidade vinculada no Zoho | 16 | 1,5% |
| Oportunidade vinculada, mas negócio não existe no nosso banco (`zoho_id` não bate) | 454 | 42,5% |
| Negócio existe, **match forte** (valor + data batem) | **591** | 55,4% |
| Negócio existe, match parcial (só valor OU só data) | 4 | 0,4% |
| Negócio existe, mas nenhuma proposta local corresponde | 2 | 0,2% |

**Sem equivalente aparente: 472 de 1.067 (44,2%).**

Ponto importante para não superestimar o problema: a maior parte do "sem equivalente" (454 de 472, 96%) é porque o **negócio/oportunidade em si** não tem `zoho_id` reconhecido no nosso banco — não é evidência de que a proposta especificamente tenha sido perdida no processo de propostas; é upstream, no nível de negócio/oportunidade (provavelmente overlap com a frente de auditoria de negócios/pipeline, fora do escopo desta frente). Quando o negócio **existe** e está corretamente linkado (613 casos), a taxa de match de proposta é de **591/613 = 96,4%** — ou seja, ao contrário dos contratos nativos (seção 1), aqui a reconstrução de propostas parece ter capturado a grande maioria dos casos onde havia uma referência de negócio confiável para ancorar.

Confiança: **média-alta**. O critério de match (valor + data aproximada) é heurístico — não há `zoho_id` em `propostas`, então "match forte" é uma inferência razoável, não uma prova de que é literalmente o mesmo registro. Mas a consistência do padrão (96% de acerto onde o negócio existe) é forte demais para ser coincidência.

---

## 4. Itens Cotados (Zoho) vs `proposta_itens` (local) — granularidade

Confirmado: "Itens Cotados" é filho de **Propostas** (1.869 de 1.876 têm `ID do pai.id` batendo com um `ID do registro` de Propostas_001.csv — não de Contratos). "Itens Solicitados" é filho de **Contratos** (477 de 487 batem com Contratos, não Propostas) — é a linha de produtos efetivamente contratada, não da proposta.

Comparação agregada:

| | Zoho (Itens Cotados) | Local (`proposta_itens`) |
|---|---|---|
| Total de itens | 1.876 | 2.048 |
| Total de propostas-pai | 1.067 | 1.240 |
| Média itens/proposta | 1,76 | 1,65 |

Números agregados **não sugerem perda de granularidade** — pelo contrário, o total local (2.048) é maior que o nativo Zoho (1.876), e a média por proposta é próxima. Isso contradiz a hipótese inicial de que a proporção indicaria itens perdidos em massa.

Comparação pareada (mais rigorosa) — para os 591 pares proposta Zoho↔local com match forte (seção 3):

- Total de itens Zoho nesses 591 pares: **824**
- Total de itens locais nesses mesmos 591 pares: **805**
- Pares com contagem de itens **idêntica**: 571 de 591 (**96,6%**)
- Pares com contagem diferente: 20 de 591 — 19 desses são casos onde Zoho tem 1 item cotado e o local tem 0 (majoritariamente propostas de código "PPA - 10xx" de junho/2026, ou seja, criadas perto/depois da virada — parecem ser propostas novas no CRM próprio sem item cadastrado, não itens Zoho perdidos)

**Conclusão da seção 4: ao nível de item de proposta, a granularidade foi preservada bem** nos casos em que a proposta em si foi migrada/reconstruída com sucesso. O gap real de "Itens Cotados" está a montante — nas 454 propostas cujo negócio não tem `zoho_id` (seção 3) — e não numa perda item-a-item dentro das propostas migradas.

Confiança: **alta** para o achado de que a granularidade dentro de propostas migradas está preservada; **média** para extrapolar isso às propostas não migradas (não há como comparar itens de algo que não tem par local).

---

## 5. Faturas — Zoho vs `faturas` local

**123 faturas reais no Zoho** (`Invoices_001.csv`), status `Faturado` (118) / `Cancelado` (5), somando **R$ 74.285,33**, com `Hora de Criação` entre **16/02/2024 e 04/06/2025** — ou seja, é histórico de faturamento pré-migração (12/06/2026), gerado enquanto a operação ainda rodava no Zoho.

**`faturas` no banco local: 563 registros, 100% com `origem = 'stripe'`.** Nenhum registro com `origem = 'pabx'` e nenhum com `origem = 'zoho'` (essa origem nem existe como valor usado). Todos os 563 têm `created_at` a partir de **01/07/2026** (501 em julho, 62 em agosto) — mesma janela de criação em massa observada em `contratos` (seção 0), e `competencia` cobrindo só **novembro/2025 a agosto/2026**.

**Não há sobreposição temporal nem de origem entre os dois conjuntos.** As 123 faturas Zoho (fev/2024–jun/2025, receita real de R$ 74k) simplesmente não existem em `faturas` — nem como registros com origem 'zoho', nem reconstruídas por outra via. O texto do briefing mencionava que `origem` suportaria valores tipo 'stripe'/'pabx' — na prática, **nenhuma fatura com origem 'pabx' foi carregada ainda**, e a hipótese de um histórico 'zoho' também não se confirma: esse histórico de fatura pré-migração não existe em lugar nenhum do CRM atual.

Confiança: **alta** — é uma comparação direta de presença/ausência por origem e por janela de data, sem necessidade de matching heurístico.

---

## Resumo executivo (para leitura rápida)

1. **Contratos nativos (jurídico/financeiro real — prazo, multa) estão 99,3% ausentes do CRM** (277 de 279), inclusive quando o negócio correspondente foi migrado com sucesso (76 de 78 desses casos também não têm contrato). Confiança alta.
2. 61% dos contratos nativos tinham prazo de 36 meses e ~92% tinham multa de 30% — informação jurídica sistematicamente perdida, não é caso isolado tipo LOGITHINK.
3. Propostas tiveram reconstrução melhor: 44% "sem equivalente" no total, mas 96% desse gap vem de negócios/oportunidades não linkados (upstream), não de propostas especificamente perdidas — onde o negócio existe, 96,4% das propostas casam.
4. Granularidade de item de proposta (Itens Cotados) está preservada nos casos migrados (96,6% de contagem idêntica) — a hipótese de perda maciça de granularidade não se confirma nos dados.
5. Faturamento histórico pré-migração do Zoho (123 faturas, R$ 74k, fev/2024–jun/2025) não existe em `faturas` sob nenhuma origem — só há dados Stripe pós-migração (563 registros, todos criados a partir de jul/2026).
6. Nota lateral: `contratos` tem 319 registros no total hoje (não 553 mencionados no briefing), todos criados em jul–ago/2026, nenhum com `zoho_id` — não investigado a fundo, fora do escopo, mas relevante para quem for cruzar números entre frentes.
