# Auditoria Legado Zoho — Frente 7: Products + Contract Items (Itens Solicitados)

**Data:** 2026-08-11
**Tipo:** Investigação forense, somente leitura. Nenhum arquivo do backup Zoho foi alterado, nenhuma linha de banco foi escrita (só `SELECT`/`\copy` de leitura).
**Escopo:** Fecha a lacuna explicitamente deixada em aberto pelo ADR-FASE3 (seção 1.7) — Products e Contract Items não foram cobertos pelas fases 1/2. Pré-requisito bloqueante do Kauã antes do dry-run de recovery.
**Fontes:**
- Zoho: `~/Downloads/Data_001/Data/{Products_001,"Itens Solicitados_001","Itens Cotados_001",Contratos_001}.csv` (utf-8-sig, parse via `csv.DictReader` — nunca `wc -l`, ver nota de método)
- CRM próprio (**homologação**, resincada com produção nesta mesma sessão, incluindo dedup de 39 contratos duplicados por Stripe): via SSH `ubuntu@34.204.200.52` → `docker exec callface-crm-homolog-postgres psql -U callface -d callface_crm`, tabelas `servicos_catalogo`, `proposta_itens`, `contratos`, `negocios`
- Schema: `app/src/lib/db/schema.ts` (linhas 409-594, 997-1104)

---

## 0. Nota de método

Todos os 4 CSVs foram parseados com `csv.DictReader` (não `wc -l` — campos de descrição têm quebra de linha dentro de valor entre aspas, o que infla contagem física). Nenhuma linha malformada em nenhum arquivo.

| Arquivo | Registros reais (parse CSV) |
|---|---|
| Products_001.csv | **274** (confirma o número já citado na fase 1) |
| Itens Solicitados_001.csv | **487** |
| Itens Cotados_001.csv | **1.876** (não reanalisado — só usado como referência cruzada, já reconciliado no relatório 04/fase 1) |
| Contratos_001.csv | **279** (confirma fase 1) |

O ambiente-alvo é **homologação**, não o Postgres local — confirmado no ADR (seção 0.1) que homolog está em paridade de schema com produção e foi resincado nesta sessão. `contratos` em homolog tem hoje **283 linhas** (279 nativos do Zoho é a contagem do CSV, não do banco — não confundir; 0 desses 283 têm `zoho_id` preenchido, mesmo achado da fase 1 seção 3 do relatório 04).

---

## 1. Resumo executivo — números-chave

| # | Achado | Número | Confiança |
|---|---|---|---|
| 1 | Produtos reais no módulo Products do Zoho | **274** | Alta (parse direto) |
| 2 | Produtos com nome duplicado (exato) dentro do próprio Zoho | **0** | Alta |
| 3 | Produtos sem descrição preenchida | **110 / 274 (40%)** | Alta |
| 4 | Produtos nunca usados em nenhum Itens Cotados/Solicitados (mortos/órfãos) | **67 / 274 (24%)** — 46 desses ainda marcados "Ativo" no Zoho | Alta |
| 5 | Linhas em Itens Solicitados (Contract Items) | **487**, cobrindo **279 / 279 (100%) dos contratos nativos** | Alta |
| 6 | Linhas de Itens Solicitados apontando para contrato-pai inexistente no export | **10 linhas (3 contratos), R$ 13.143,33** | Alta (evidência fecha exatamente: soma das 10 linhas = diferença exata entre soma de itens e soma de contratos) |
| 7 | `servicos_catalogo` hoje (homolog) | **218 linhas**, das quais só **6 `ativo=true`** | Alta |
| 8 | Match exato de nome Zoho→`servicos_catalogo` | **204 / 274 (74,5%)** | Alta |
| 9 | Gap real (produto Zoho **usado** comercialmente mas ausente do catálogo atual) | **3 produtos** — não 70 | Alta |
| 10 | Tabela relacional de itens de contrato no schema atual | **NÃO EXISTE** — `contratos.servicos` é `text[]` sem quantidade/valor/desconto por linha | Confirmado (leitura direta do schema.ts) |
| 11 | `proposta_itens` já referencia 207 das 218 linhas de `servicos_catalogo` (2.019 de 2.058 itens de proposta têm `servico_catalogo_id`) | — | Alta |

**Leitura central**: ao contrário do que o ADR (seção 1.7) deixou como "a definir", o módulo Products do Zoho **já foi majoritariamente absorvido** pelo CRM atual — não por uma migração deliberada de Products, mas como efeito colateral da migração de Itens Cotados→`proposta_itens` (fase 1, achado QuotedItems), que criou uma linha em `servicos_catalogo` para cada nome de produto único encontrado nas propostas. O gap real de catálogo é pequeno (3 produtos). **O gap estrutural real e não resolvido é outro**: não existe hoje nenhuma tabela relacional para os 487 "Itens Solicitados" (Contract Items) — eles não têm onde morar mesmo que os 279 contratos nativos sejam recuperados (achado #10, seção 5).

---

## 2. Inventário do módulo Products (Zoho)

**274 produtos**, campos principais:

| Campo | Preenchido | Observação |
|---|---|---|
| `Nome Produto` | 274/274 | Nenhum duplicado exato (case-insensitive) |
| `Código Produto` (SKU) | 40/274 (14,6%) | Maioria sem SKU — nome é a chave de fato |
| `Produto Ativo` | 238 `true` / 36 `false` | Não confiável como sinal de uso real — ver seção 4 |
| `Produto Categoria` | 105 "Serviços", 72 "Produtos", 97 vazio (35%) | Categoria não é um dado confiável de segmentação |
| `Preço Unitário` | 247/274 (27 vazios) | |
| `Descrição` | 164/274 (110 vazios, 40%) | |
| `Recorrência` | 188 "Mensal", 47 "A Vista", 39 vazio | **Só 2 grafias distintas** — ao contrário do achado #11 da fase 1 (8+ grafias em Itens Cotados/Setup_C), o campo `Recorrência` dentro do próprio módulo Products está limpo |
| `Fabricante`, `Tag`, `Nome Fornecedor.id`, `Taxa de comissão`, `Taxa de câmbio`, `Data de Início/Término de Vendas` | 0/274 | Campos nunca usados — resíduo de schema padrão do Zoho, não dado real (mesmo padrão do achado #5 da fase 1, `Empresa Site`) |
| `Qtd. solicitada`, `Nível de Reaquisição` | 274/274 = "0.0" | Default nunca alterado — ruído |
| `Quantidade em estoque` | 227 = "0.0", resto valores negativos (-1 a -5) | Contagem de estoque incoerente (SaaS/telefonia não gerencia estoque real no Zoho) — **lixo, não dado**, não usar para nada |

**Duplicidade**: 0 grupos de nome exatamente duplicado, 0 grupos de nome duplicado ignorando maiúsculas/espaço. **Diferente do padrão de duplicidade encontrado em Empresas/Contatos na fase 1** — o catálogo de produto em si é limpo nesse quesito.

**Uso real** (cruzado com Itens Cotados + Itens Solicitados — as únicas 2 tabelas que efetivamente "vendem" um produto):

| | Qtd | % |
|---|---|---|
| Produtos usados em ao menos 1 linha comercial | 207 | 75,5% |
| Produtos **nunca** usados (nem cotado, nem contratado) | **67** | 24,5% |
| — desses 67, ainda marcados `Produto Ativo=true` no Zoho | 46 | — |
| — desses 67, marcados `Produto Ativo=false` | 21 | — |

Confiança: alta. Os 67 "nunca usados" incluem: SKUs regionais nunca vendidos (`ACTUALIZACIÓN A UNA LICENCIA DE 128/96/64/16 CANALES` — parecem precificação de um mercado espanhol/LATAM nunca comercializado), variações de SETUP nunca cobradas separadamente (`SETUP LARGE`, `SETUP ENTERPRISE`, `SETUP - ANNY BOTY`), acessórios pontuais (`TELEFONE FANVIL X4 - MANDIC`, `ATA 2 PORTAS`), e 1 registro literal `TESTE` (dado de teste, mesma classe do achado #14 da fase 1 — "Mussum Trapalhão" etc.).

---

## 3. Inventário de "Itens Solicitados" (Contract Items)

**487 linhas.** Estrutura por linha: produto (referência a `Nome Produto.id`), quantidade, preço de lista, desconto, total após desconto, imposto, total — **mesma forma conceitual de `proposta_itens`** (quantidade × valor unitário − desconto = subtotal), confirmando a hipótese do prompt.

| Verificação | Resultado |
|---|---|
| Linhas com `Nome Produto.id` preenchido e batendo em Products | **487/487 (100%)** — nenhuma linha com "nome solto" sem referência a produto |
| Linhas com `ID do pai.id` batendo em algum contrato de `Contratos_001.csv` | **477/487 (97,9%)** |
| Linhas com `ID do pai.id` **não** encontrado em nenhum contrato do export | **10/487 (2,1%)** — ver seção 5 (achado de contrato órfão) |
| Contratos nativos cobertos por ≥1 linha de item | **279/279 (100%)** |
| Distribuição de itens por contrato | 1 item: 144 contratos · 2 itens: 97 · 3 itens: 29 · 4 itens: 6 · 5 itens: 1 · 6 itens: 1 · 17 itens: 1 |

Confiança: **alta**, é join direto por ID, sem heurística. **Todo contrato nativo tem pelo menos 1 linha de item — os 487 "Itens Solicitados" são de fato o detalhamento comercial completo dos 279 contratos**, não uma amostra parcial.

Produtos mais frequentes em Itens Solicitados (top 10): RAMAL - FALE A VONTADE (39), LINHA SIP (39), SMALL (35), RAMAL FACILITA (32), CALLFACE AI - COLD CALLING (25), 08 CANAIS (22), LINHA SIP - NUMERO NOVO (18), MEDIUM (17), LINHA SIP - PORTABILIDADE (16), LINHA ADICIONAL (16) — consistente com o mix de produto PABX+linha SIP que já era o núcleo do negócio Callface antes do pivô pra AI.

**Validação cruzada de valor**: soma de `Total` em Itens Solicitados = R$ 339.667,42; soma de `Total Geral` em Contratos = R$ 326.524,10. Diferença = **R$ 13.143,33**, que bate exatamente (a centavo) com a soma das 10 linhas órfãs da seção 5 — ou seja, **o valor de item e o valor de contrato conciliam perfeitamente** quando o contrato-pai existe no export. Não há inconsistência de granularidade/soma além do já explicado pelos 3 contratos ausentes.

---

## 4. Comparação com o CRM atual

### 4.1 `servicos_catalogo` vs 274 produtos Zoho

`servicos_catalogo` em homolog tem **218 linhas**, campos: `nome`, `descricao`, `tipo` (recorrente/avulso/setup), `moeda`, `valor_sugerido`, `unidade`, `stripe_product_id`, `ativo`, `ordem` — **nota**: as colunas `categoria` e `requer_contrato` existem em `app/src/lib/db/schema.ts` mas **não existem ainda na tabela física de homolog** (`\d servicos_catalogo` não as lista) — indício de migration pendente de promoção, à parte deste achado, sinalizado por transparência mas fora do escopo desta auditoria.

| Comparação | Resultado |
|---|---|
| Match exato de nome (case-insensitive) Zoho↔`servicos_catalogo` | **204 / 274 (74,5%)** |
| Linhas em `servicos_catalogo` sem par exato no Zoho | 14 — mas são o catálogo real atual: Callface AI Starter/Full/Business, CallPilot, Agente IA, Pacote 500min (6 `ativo=true`, com `stripe_product_id`) + 8 inativas legadas (PABX Starter/Medium/Enterprise, Setup PABX, etc., produtos "guarda-chuva" pós-migração que nunca tiveram equivalente 1:1 no Zoho granular) |
| Produtos Zoho sem par exato em `servicos_catalogo` | 70 |
| — desses 70, **usados** de fato em Itens Cotados/Solicitados (gap real de catálogo) | **3**: `TRANSCRIÇÃO DAS LIGAÇÕES - YEASTAR`, `Disparos automáticos WhatsApp`, `CRM` |
| — desses 70, nunca usados em nada (irrelevante) | 67 (mesmo conjunto da seção 2) |

**`servicos_catalogo` NÃO é super-set nem sub-set simples do Products Zoho — é estruturalmente diferente**: 212 das 218 linhas (97,2%) estão `ativo=false` e são precisamente os nomes de produto Zoho recuperados via a migração de Itens Cotados→`proposta_itens` (fase 1) — criadas sob demanda, uma linha por nome de produto único encontrado nas propostas, não como catálogo comercial ativo. Apenas **6 linhas `ativo=true`** representam o catálogo comercial real e vendável hoje (Callface AI em 3 tiers + CallPilot + Agente IA + 1 pacote de minutos), todas com `stripe_product_id` — o catálogo funcional atual é pequeno e moderno, o resto é histórico inerte preservado só para referência de `proposta_itens`.

Confirmação de que as 212 linhas legadas não são lixo morto: **207 das 218 linhas de `servicos_catalogo` são de fato referenciadas por `proposta_itens`** (query `LEFT JOIN`, `count>0`) — de 2.058 itens de proposta, 2.019 (98,1%) têm `servico_catalogo_id` preenchido, cobrindo 207 catálogos distintos. Ou seja, quase todo o catálogo "inativo" está ativamente em uso como referência histórica em propostas reais — não é resíduo descartável.

### 4.2 Tabela relacional de itens de contrato — **CONFIRMADA A AUSÊNCIA**

Leitura direta de `app/src/lib/db/schema.ts`:

- `contratos.servicos` (linha 565): `text("servicos").array()` — **array de texto puro**, sem `id`, sem `quantidade`, sem `valor_unitario`, sem `desconto`, sem referência a `servicos_catalogo`.
- `negocios.servicosInteresse` (linha 436): também `text[]`, mesmo padrão — serve para "interesse", não para item contratado com valor.
- Nenhuma tabela `contrato_itens`/`ordem_itens`/`itens_solicitados`/equivalente existe no schema. Busca por `grep -i "itens_solicitados\|ordereditems\|contrato_itens"` em todo `app/src` retorna **zero ocorrências**.
- Nenhum script de migração/import específico do módulo Products do Zoho foi encontrado no repositório — o preenchimento de `servicos_catalogo` com nomes Zoho é efeito colateral confirmado da migração de Itens Cotados (seção 4.1), não uma importação deliberada de Products.

**Confirmado, não é hipótese**: se os 279 contratos nativos do Zoho forem recuperados no futuro (achado #1 da fase 1 e seção 1.6 do ADR), os **487 "Itens Solicitados" (linhas de produto/quantidade/valor por contrato) não têm onde morar hoje** — exatamente a mesma classe de gap estrutural do achado sobre `prazo_meses`/`multa_percentual` (ADR seção 1.6), só que para a granularidade de item, não para os termos gerais do contrato.

---

## 5. Achados de qualidade / duplicidade / órfãos

1. **Duplicidade de nome de produto no Zoho: 0 casos** (exato e case-insensitive). O catálogo de produto, ao contrário de Empresas/Contatos (fase 1), não tem duplicidade estrutural.

2. **67 produtos "mortos" (nunca cotados, nunca contratados)** — 24,5% do catálogo é ruído acumulado ao longo dos anos (SKUs de teste, precificação regional nunca usada, variações de setup nunca cobradas separadamente). 46 desses ainda estão marcados "Ativo" no Zoho — **o campo `Produto Ativo` não é um sinal confiável de uso comercial real**, não usar como critério único de "o que trazer pro catálogo novo".

3. **10 linhas de Itens Solicitados (3 grupos de `ID do pai.id`) apontam para um contrato que não existe no export `Contratos_001.csv`** — `zcrm_5938068000023490060` (4 linhas, upgrade de canais + "ATÉ 100 RAMAIS"), `zcrm_5938068000035121019` (2 linhas, "ATUALIZAÇÃO DE MAQUINA 8 vCPUs"), `zcrm_5938068000037214011` (4 linhas, upgrade de canais + "Linhas de entradas e DDR's"). Total R$ 13.143,33. Confiança **alta** de que são contratos reais que existiram no Zoho e não estão no backup exportado (não é erro de parsing — a soma bate exatamente com a diferença de totais da seção 3).

   **Atualização (busca forense pedida pelo Kauã, 12/08) — resultado não é uniforme, 1 dos 3 é recuperável:**
   - **`5938068000035121019` — RECUPERÁVEL, confiança alta.** Aparece em `ZohoSign Documents_C_001.csv`: documento `SO_CT - 292 - 06_2026 - MASCARENHAS BARBOSA ADVOGADOS.pdf`, ligado a `Deal.id=...34477030` e `Quote.id=...34477036`. Os dois existem no export e reconciliam perfeitamente: Deal = `MASCARENHAS | UPGRADE DE MAQUINA | MAYARA`, categoria "Upgrade", montante R$4.112,22, prazo de contrato 36 meses, `Oportunidade Origem` preenchida, data de assinatura 11/06/2026; Quote = `PPA-994-06/2026`, mesma empresa (MASCARENHAS BARBOSA ADVOGADOS), mesmo contato, total geral R$4.112,22 (bate exato com a soma dos 2 Itens Solicitados: R$2.920,29 + R$1.191,93). Código do contrato recuperável do nome do arquivo: **CT-292-06/2026**. Este caso deixa de ser "perda residual" — é reconstrutível quase por completo (empresa, contato, valor, prazo, data de assinatura, código, produto) via cruzamento Deal+Quote+ZohoSign+Itens Solicitados, só faltando os poucos campos que só existiam na linha nativa de `Contratos_001.csv` (ex. status interno do módulo SalesOrders).
   - **`5938068000023490060`** e **`5938068000037214011`** — busca ampliada (Setup._C, Notes, Calls, Meetings, Tasks, Emails, Attachments, ConvertedLeadRecords, e Oportunidades criadas/fechadas nas mesmas datas) só encontrou a linha-satélite em `Setup._C_001.csv` (implantação/setup, datada e valorada, confirmando que a venda foi real) — **nenhum Account/Contact/Deal identificável** em nenhum arquivo pesquisado. Sem esse vínculo, não há como saber QUEM era o cliente. Mantido como **perda residual genuína** para os fins de recriar o contrato como entidade — mas as linhas de item em si (produto, valor, data, descrição) continuam válidas como evidência órfã e não devem ser descartadas do recovery de Itens Solicitados só por isso (ficam com `contrato_id=null`, ver seção 6).

4. **Inconsistência de preço entre "Preço Unitário" cadastrado no produto e "Preço de Lista" praticado na linha de venda**: 45 produtos com diferença em Itens Solicitados, 93 em Itens Cotados (ex.: `LINHA SIP` cadastrado a R$29,90, praticado entre R$-34,88 e R$50,00 conforme a linha). **Interpretação correta, para não superestimar**: isso é o padrão comercial normal de negociação (desconto/reajuste por cliente ao longo dos anos), não um bug de sincronização — o "Preço Unitário" do módulo Products é só um preço-tabela de referência, nunca foi tratado como preço travado. Confiança de que é comportamento comercial esperado, não erro de dado: **média-alta** (o volume e a variação — inclusive valores negativos, que são desconto lançado como item — são consistentes com negociação real, não com corrupção de dado).

5. **Campos de estoque (`Qtd. solicitada`, `Quantidade em estoque`, `Nível de Reaquisição`, `Quantidade em demanda`) são ruído puro** — Zoho Products vem com módulo de inventário nativo que a Callface nunca configurou (SaaS/telefonia não tem estoque físico relevante, com pouquíssima exceção de hardware). Mesma classe do achado #5/#14 da fase 1 (`Empresa Site`, `Recorrência_Old`) — resíduo de schema, não dado a preservar.

6. **`Fabricante`, `Tag`, `Nome Fornecedor.id`, datas de início/fim de venda/suporte: 0/274 preenchidos** — módulos/campos do template padrão Zoho nunca adotados pela Callface, não é perda de migração.

---

## 6. Recomendação de schema mínima (proposta, NÃO implementada)

Seguindo o mesmo padrão de "mudança mínima aditiva" do ADR (seção 6): se o Kauã decidir recuperar os 279 contratos nativos (ADR seção 1.6) com granularidade de item, a estrutura abaixo é o necessário mínimo — nenhuma coluna `NOT NULL` nova, nada além de tabela aditiva.

**Tabela nova: `contrato_itens`** (mesmo padrão de `proposta_itens`, linha 1083 do schema):

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid, PK | |
| `contrato_id` | uuid, FK `contratos.id`, `onDelete: cascade`, not null | Mesma semântica de `proposta_itens.proposta_id` |
| `servico_catalogo_id` | uuid, FK `servicos_catalogo.id`, nullable | Preenchido quando o produto Zoho tem match de nome exato (204/274 hoje) — nullable porque nem todo item vai casar |
| `nome` | text, not null | Nome do produto no momento da venda (preserva mesmo se `servicos_catalogo` mudar depois — mesmo padrão de `proposta_itens.nome`) |
| `descricao` | text, nullable | |
| `quantidade` | decimal(10,2), default 1, not null | |
| `valor_unitario` | decimal(12,2), default 0, not null | Vem de "Preço de Lista" do Zoho — nunca sobrescreve `servicos_catalogo.valor_sugerido` (achado #4 desta seção: preço praticado ≠ preço-tabela, por design comercial) |
| `desconto` | decimal(5,2), default 0, nullable | |
| `subtotal` | decimal(12,2), default 0, not null | = "Total" do Zoho |
| `zoho_id` | text, nullable | Provenance — `UNIQUE INDEX ... WHERE zoho_id IS NOT NULL` (mesmo padrão de idempotência real exigido pelo ADR seção 2.3/6 #9-10, não só a coluna existir) |
| `created_at` | timestamptz, default now() | |

Regras que seguem o mesmo framework do ADR (seção 4):
- **Regra temporal**: não há campo de data própria em Itens Solicitados — herda `Hora de Criação`/`Hora da modificação` do contrato-pai; não inventar timestamp próprio.
- **Regra de conflito**: os 10 itens órfãos (seção 5.3) não são inseridos como `contrato_itens` sem `contrato_id` válido — ficam de fora do backfill até (se algum dia) o contrato-pai for localizado por outra via; nunca criar um contrato "fantasma" só para pendurar o item.
- **Mapeamento futuro V2**: nenhuma tabela `contract_items` V2 existe ainda (mesma observação do ADR para `contracts`, F4) — `contrato_itens.zohoId`/`servicoCatalogoId` ficam prontos para alimentar o backfill quando F4 for promovido, sem transformação adicional.
- Este item deveria ser adicionado à lista de mudanças mínimas da seção 6 do ADR (hoje itens #1-11) como um item novo, condicionado à mesma decisão de recuperar contratos nativos (seção 1.6 do ADR) — não faz sentido recuperar `contratos.prazo_meses`/`multa_percentual` sem também ter onde colocar os itens que compõem o valor daquele contrato.

**Sobre o catálogo (`servicos_catalogo`)**: não há mudança de schema recomendada — a estrutura já comporta o que existe. Recomendação de dado, não de schema: os 3 produtos com gap real (seção 4.1) podem ser adicionados como linhas `ativo=false` (mesmo padrão das outras 212 linhas legadas) só se e quando aparecerem em algum `contrato_itens` recuperado — não há urgência de adicioná-los preventivamente, já que nunca foram cotados nem contratados desde então.

---

## 7. Casos ambíguos que exigem decisão do Kauã

| Caso | Evidência | O que precisa de decisão |
|---|---|---|
| 2 dos 3 contratos ausentes (`...23490060`, `...37214011`) — busca forense concluída, sem vínculo de empresa/contato encontrado em nenhum módulo | Alta confiança de que existiram (linha de setup datada e valorada), zero rastro de identidade do cliente | Perda residual genuína — aceitar as linhas de item como evidência órfã (sem contrato/empresa) ou descartar totalmente? |
| 46 produtos marcados "Ativo" no Zoho mas nunca vendidos | Confiança alta de que nunca foram usados comercialmente | Ignorar na recuperação (não trazer pro catálogo novo) ou preservar por completude arquival? |
| 3 produtos usados comercialmente mas ausentes de `servicos_catalogo` (`TRANSCRIÇÃO DAS LIGAÇÕES - YEASTAR`, `Disparos automáticos WhatsApp`, `CRM`) | Confiança alta (uso real confirmado em Itens Cotados/Solicitados) | Criar retroativamente como linha inativa de catálogo antes ou só junto com o backfill de `contrato_itens`? |
| `servicos_catalogo.categoria`/`requer_contrato` existem no `schema.ts` mas não na tabela física de homolog | Achado colateral, não é do escopo original desta frente | Confirmar se é migration pendente de promoção (mesmo padrão de risco do achado "F0-F7 só em dev" do ADR seção 0) — sinalizar pro time de schema, fora da decisão de recovery de Products/Contract Items em si |
| Variação de preço praticado vs preço-tabela (45-93 casos por origem) | Interpretação como negociação comercial normal, confiança média-alta | Confirmar com o time comercial se algum desses casos é de fato erro de digitação isolado (não investigado caso a caso, só padrão agregado) |

---

## Nota final

Este relatório fecha a lacuna da seção 1.7 do ADR-FASE3. Recomenda-se atualizar aquela seção do ADR com a conclusão central: **Products está, na prática, majoritariamente resolvido (74,5% de match direto, gap real de só 3 produtos) — o achado que precisa entrar na lista de mudanças mínimas de schema (seção 6 do ADR) é a ausência de `contrato_itens`**, não uma reconciliação de catálogo pendente.
