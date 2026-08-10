# Inventário Técnico Completo — Backup Zoho CRM (Callface)

> Frente 1 de 6 da auditoria forense pós-migração (12/06/2026). **Escopo: só inventário técnico do backup Zoho.** Reconciliação Zoho vs CRM novo é outra frente. Este documento não altera nenhum arquivo nem banco — 100% leitura.
>
> Fonte: `~/Downloads/Data_001/Data/*.csv` (34 arquivos, utf-8-sig, headers em PT-BR) + `~/Downloads/Data_001/Metadata/*.csv` (schema real do Zoho) + `~/Downloads/Attachments/` (1.980 arquivos).
>
> Convenção: todo ID do Zoho vem prefixado `zcrm_` — é só formatação de export, o identificador real é o sufixo numérico.

---

## Mapa de módulos (via `Metadata/Modules_001.csv`)

O nome do arquivo CSV nem sempre é o nome real do módulo Zoho. Tabela de tradução confirmada:

| Nome do arquivo/label PT-BR | Nome interno Zoho (Api Name) | Module Type |
|---|---|---|
| Leads | Leads | Standard |
| Empresas | Accounts | Standard |
| Contacts | Contacts | Standard |
| Oportunidades de Vendas | Deals (Potentials) | Standard |
| Propostas | Quotes | Standard |
| Contratos | Sales_Orders (SalesOrders) | Standard |
| Invoices | Invoices | Standard |
| Products | Products | Standard |
| Campaigns | Campaigns | Standard |
| Calls / Meetings / Tasks / Notes / Emails | Activities padrão | Standard |
| Stage History | DealHistory | Módulo de sistema (histórico de estágio de Deal) |
| Situação de Lead Histórico_C | LinkingModule1 (`Situa_o_de_Lead_Hist_rico`) | Módulo de sistema (histórico de picklist de Lead Status) |
| Responsabilidade Histórico_C | LinkingModule2 (`Responsabilidade_Hist_rico`) | Módulo de sistema (histórico de campo "Responsabilidade" em Contacts) |
| Setup_C | LinkingModule3 (`Setup`) | Item de linha satélite de **Propostas/Quotes** |
| Setup._C | LinkingModule4 (`Setup1`, label literal "Setup.") | Item de linha satélite de **Contratos/SalesOrders** |
| ZohoSign Documents_C | CustomModule1 (`zohosign__ZohoSign_Documents`) | App custom instalado (Zoho Sign) |
| ZohoSign Recipients_C | CustomModule2 | App custom (Zoho Sign) |
| ZohoSign Document Events_C | CustomModule3 | App custom (Zoho Sign) |
| Itens Cotados | QuotedItems (item de linha de Propostas) | Módulo de sistema |
| Itens Solicitados | OrderedItems (item de linha de Contratos) | Módulo de sistema |
| Invoiced Items | InvoicedItems (item de linha de Invoices) | Módulo de sistema |
| Oportunidade de Venda Contact Role | DealContactRole | Módulo de sistema |
| ConvertedLeadRecords | ConvertedLeadRecords | Log de conversão Lead→Deal/Account/Contact |

Os módulos "Histórico" (`_C`) e o próprio `Stage History` **não são preenchidos manualmente** — são gerados automaticamente pelo Zoho sempre que um campo de picklist monitorado muda (Field History Tracking). Ou seja, são trilhas de auditoria nativas do Zoho, não dados de negócio digitados por alguém.

---

## 1. Leads_001.csv

- **Registros:** 971
- **Colunas (94):** ID do registro, Proprietário do Lead.id, Empresa, Nome, Sobrenome, Designação, E-mail, Telefone, Fax, Celular, Site, Fonte de Lead, Lead Status, Indústria, N.º de funcionários, Receita Anual, Avaliação, Campanha Fonte.id, Criado Por.id, Modificado Por.id, Hora de Criação, Hora da modificação, Nome Completo, Rua, Cidade, Estado, Código Postal, País, Descrição, ID do Skype, Opção de Sair do E-mail, Saudação, E-mail secundário, Moeda, Taxa de câmbio, Hora da última atividade, Twitter, Layout.id, Pontuação (+variantes touch), Tag, Lead Imagem, timestamps de sistema, Data/Hora convertidas, Record Approval Status, Is Record Duplicate, Lead Tempo de conversão, Conta convertida.id, Contato convertido.id, Negócio convertido.id, Está convertido, Locked, Horário do último enriquecimento, Enriquecer status, Área de Atuação, Estado / UF, CNPJ, Razão Social, Segmento, Subsegmento, Outro Segmento, Outro Subsegmento, Cargo, Linkedin, Record Status, campos de tracking web (Visita mais recente, Primeira página visitada, Tempo Médio Gasto, Número de chats, Referenciador, Pontuação do visitante, Primeira visita, Dias Visitados), utm_source/campaign/medium/term/content, gclid, fbclid, Solução de Telefonia Atual, Conectado a.id, Connected To.Module, FB Lead ID.
- **FKs:**
  - `Campanha Fonte.id` → Campaigns
  - `Conta convertida.id` → Accounts (Empresas)
  - `Contato convertido.id` → Contacts
  - `Negócio convertido.id` → Deals (Oportunidades)
  - `Conectado a.id` (+ `Connected To.Module`) → polimórfico (FK genérica, aponta pra qualquer módulo indicado em `Connected To.Module`)
  - `Criado Por.id` / `Modificado Por.id` / `Proprietário do Lead.id` → Users
- **Preenchimento (colunas-chave):**
  - `E-mail`: 971/971 (100%)
  - `Lead Status`: 971/971 (100%)
  - `Fonte de Lead`: 971/971 (100%)
  - `Empresa`: 929/971 (95,7%)
  - `CNPJ`: 9/971 (**0,9%** — praticamente não usado em Leads, mesmo existindo o campo)
  - `Telefone`: **0/971 (0%)** — todo lead usa exclusivamente o campo `Celular`, não `Telefone`
- **Distribuição de `Lead Status`:** Não Trabalhado (436), Not Qualified (277), Attempted to Contact (86), Em Contato (80), Sem Retorno de Contato (49), Contacted (31), Qualificado (8), Sem Interesse no Momento (2), Not Contacted (1), Em Qualificação (1). **Achado:** picklist mistura inglês e português (herança de instalação padrão Zoho + labels PT-BR customizados por cima) — sinal de que a taxonomia de status nunca foi limpa/consolidada.
- Só 481 leads têm registro em `ConvertedLeadRecords_001.csv`, mas o campo `Está convertido` provavelmente conta mais — checar na frente de reconciliação.

---

## 2. Empresas_001.csv (Accounts)

- **Registros:** 1.102
- **Colunas (67):** ID do registro, Proprietário da Empresa.id, Avaliação, Empresa Nome, Telefone, Empresa Site, Fax, Origem Empresa.id, Site, Número do Empresa, Símbolo de Contador, Tipo Empresa, Propriedade, Indústria, Funcionários, Receita Anual, Código SIC, Criado Por.id, Modificado Por.id, timestamps, endereços de cobrança/entrega completos, Descrição, Moeda, Taxa de câmbio, Layout.id, campos de Pontuação (+touch), Tag, Empresa Imagem, timestamps de sistema, Locked, Horário do último enriquecimento, Enriquecer status, Área de Atuação, Estado/UF (cobrança e entrega), **CNPJ**, **Razão Social**, Segmento, Subsegmento, Outro Segmento, Outro Subsegmento, Bairro de cobrança/entrega, Fonte do Lead, Record Status, Conectado a.id, Connected To.Module.
- **FKs:**
  - `Origem Empresa.id` → provavelmente Users ou Campaigns (nome ambíguo — cruzar com Fields_001.csv na reconciliação)
  - `Conectado a.id` (+ `Connected To.Module`) → polimórfico
  - `Proprietário da Empresa.id` / `Criado Por.id` / `Modificado Por.id` → Users
- **Preenchimento:**
  - `CNPJ`: 806/1.102 (73,1%) — **quase 300 empresas sem CNPJ**, campo crítico pra B2B
  - `Razão Social`: 634/1.102 (57,5%)
  - `Segmento`: 323/1.102 (29,3%) — baixo, segmentação pouco usada
  - `Telefone`: 334/1.102 (30,3%)
  - `Empresa Site`: **0/1.102 (0%)** — campo nunca preenchido (time usava só `Site`? checar duplicidade de campo)
- **Achado:** existem dois campos de site (`Empresa Site` e `Site`) e dois de nome (`Empresa Nome` é o único, ok) — mas o padrão de dois campos redundantes se repete em várias entidades (ver seção de achados gerais).

---

## 3. Contacts_001.csv

- **Registros:** 2.267
- **Colunas (93):** inclui campos padrão (Nome, Sobrenome, E-mail, Telefone, Celular, endereços duplos) e customizados: Área de Atuação, Classificação do Contato, Cargo, Linkedin, **Responsável Técnico**, **Financeiro**, **Responsável Legal ou Testemunha**, **Responsabilidade** (picklist — alimenta o módulo histórico `Responsabilidade Histórico_C`), RG, CPF, e variantes com underscore (`Responsável _técnico`, `Responsavel_ financeiro`, `Responsável_legal ou testemunha` — parecem ser campos boolean/checkbox espelhando o picklist `Responsabilidade`), campos de tracking web idênticos aos de Leads/Empresas, Record Creation Source ID, Conectado a.id, Connected To.Module, FB Lead ID.
- **FKs:**
  - `Empresa Nome.id` → Accounts (Empresas)
  - `Nome Fornecedor.id` → Vendors
  - `Campanha Fonte.id` → Campaigns
  - `Reportando-se a.id` → Contacts (auto-relacionamento, hierarquia de contato)
  - `Conectado a.id` → polimórfico
- **Preenchimento:**
  - `E-mail`: 1.908/2.267 (84,2%)
  - `Telefone`: 232/2.267 (10,2%)
  - `Celular`: 985/2.267 (43,4%)
  - `CPF`: 1/2.267 (**0,05%** — campo praticamente morto)
  - `Empresa Nome.id`: 1.260/2.267 (55,6%) — **quase metade dos contatos não está linkada a nenhuma Empresa**
- **Achado importante:** o par de campos `Responsabilidade` (picklist) + 3 campos boolean redundantes (`Responsável _técnico`, `Responsavel_ financeiro`, `Responsável_legal ou testemunha`) sugere que a Callface tentou modelar "papel do contato no contrato" (responsável técnico / financeiro / legal-testemunha) de duas formas ao mesmo tempo — picklist E checkbox — provavelmente numa migração de esquema no meio do caminho que nunca foi limpa.

---

## 4. Oportunidades de Vendas_001.csv (Deals/Potentials)

- **Registros:** 1.551
- **Colunas (67):** Montante, Nome Oportunidade de Venda, Data de Fechamento, Empresa Nome.id, Stage, Tipo, Probabilidade, Próximo Passo, Fonte de Lead, Campanha Fonte.id, Nome Contato.id, Receita Esperada, campos de Pontuação, Fluxo, Categoria de previsão, Razão para a perda, País, **Categoria da Oportunidade**, **Quantidade de Ramais**, **Quantidade de Linhas**, **Quantidade Linhas 0800/400X**, **Quantidade Aparelhos/Equipamentos**, **Linha 0800/400X**, **Aparelhos/Equipamentos**, **Integração**, **Prazo de Contrato**, Código da Oportunidade, **Setup**, **Carência**, Oportunidade Origem.id, Data de entrega do projeto, Data prevista de entrega do projeto, Data de assinatura do contrato, Telefone 1, Record Creation Source ID, Conectado a.id, Hora de modificação de estágio, Lead-Created-Time.
- **FKs:**
  - `Empresa Nome.id` → Accounts
  - `Nome Contato.id` → Contacts
  - `Campanha Fonte.id` → Campaigns
  - `Oportunidade Origem.id` → Deals (auto-relacionamento — provavelmente linka upsell/renovação à oportunidade original)
- **Preenchimento:**
  - `Montante`: 1.382/1.551 (89,1%)
  - `Stage`: 1.551/1.551 (100%)
  - `Data de Fechamento`: 1.366/1.551 (88,1%)
  - `Empresa Nome.id`: 1.549/1.551 (99,9%)
  - `Nome Contato.id`: 1.114/1.551 (71,8%)
  - `Razão para a perda`: 123/1.551 (**7,9%** — de 458+278 deals fechados, só ~123 têm motivo de perda documentado. Perda de informação de churn/motivo de "por que não fechou" é grave pra growth)
- **Distribuição de `Stage` (top):** Closed Won 458, Closed Lost 278, Concluído 210, Perdido 176, Quer Negociar em Outra Data 132, Contrato 70, Proposal/Price Quote 59, Sem Retorno de Contato 50, Proposta Enviada 27, Negotiation/Review 19, Reunião Agendada 15, Reunião Realizada 12, Value Proposition 11, Nutrição 9, Negociação/Revisão 8, Levantamento de Escopo 6, Faturamento 3, Delivery AI 3, Delivery PABX 2, Ganho 2.
- **Achado grave:** o pipeline de Stage está claramente **duplicado em inglês e português** — "Closed Won" (458) vs "Concluído/Ganho" (212) e "Closed Lost" (278) vs "Perdido" (176) são semanticamente o mesmo estágio, mas nunca foram unificados. Isso quer dizer que qualquer relatório de win-rate feito direto na tabela sem normalizar esse texto está errado há anos. Também existem estágios operacionais como "Delivery AI" / "Delivery PABX" que sugerem que o funil de vendas foi remendado pra também rastrear entrega/onboarding dentro do mesmo pipeline de Deal.
- Campos como `Quantidade de Ramais`, `Quantidade de Linhas`, `Aparelhos/Equipamentos`, `Setup`, `Carência` são customizações fortes de telefonia — provavelmente eram a única forma de capturar o "tamanho" comercial do contrato antes de existir um catálogo de produto estruturado (ver Products/Setup_C abaixo).

---

## 5. Propostas_001.csv (Quotes)

- **Registros:** 1.067
- **Colunas (54):** Número do Proposta, Nome Oportunidade de Venda.id, Proposta Estágio, Válido até, Equipe, Nome Contato.id, Portador, Empresa Nome.id, Proprietário do Proposta.id, valores (Sub-total, Imposto, Ajuste, Total Geral), endereços, Detalhes do Produto (rich text/blob), Termos e condições, Desconto, Código da Proposta, **Valor Setup**, **Total Setup**, Prazo do Contrato, Prazo Contrato (em meses), **Origem Wevy (ID)**, Conectado a.id.
- **FK:** `Nome Oportunidade de Venda.id` → Deals; `Nome Contato.id` → Contacts; `Empresa Nome.id` → Accounts.
- **Preenchimento:**
  - `Nome Oportunidade de Venda.id`: 1.051/1.067 (98,5%)
  - `Proposta Estágio`: 1.067/1.067 (100%)
  - `Total Geral`: 1.067/1.067 (100%)
  - `Válido até`: 1.067/1.067 (100%)
- **Distribuição de `Proposta Estágio`:** Em Construção 266, Draft 231, Closed Won 196, Closed Lost 142, Proposta Ganha 91, Proposta Enviada 70, Negociação/Revisão 50, Propsta Perdida 19 (nota: erro de digitação no próprio picklist, "Propsta"), Negotiation 2. **Mesma duplicação idioma PT/EN** do módulo de Deals.
- **Achado:** campo `Origem Wevy (ID)` é uma referência cruzada explícita à Wevy (grupo controlador/parceiro) — indica que propostas eram (ou são) geradas/sincronizadas a partir de outro sistema da Wevy, não só digitadas manualmente no Zoho. Isso é um candidato forte a "fonte de dado que não veio junto na migração".

---

## 6. Contratos_001.csv (SalesOrders)

- **Registros:** 279
- **Colunas (62):** Número da OS, Nome Oportunidade de Venda.id, N.º do cliente., Ordem de compra, Nome Proposta.id, Vencimento, Pendentes, Nome Contato.id, Portador, ICM, Comissão de Venda, Status, Empresa Nome.id, valores, Detalhes do Produto, Termos e condições, Desconto, Código do Contrato, **Total Setup**, **Valor Setup**, **Prazo do Contrato**, **Percentual Multa**, Data de Envio do Contrato, **Prazo Contrato (em meses)**, **Percentual de Multa** (duplicado com "Percentual Multa" — outro par redundante), Contato da Negociação.id, Conectado a.id.
- **FK:** `Nome Oportunidade de Venda.id` → Deals; `Nome Proposta.id` → Quotes; `Nome Contato.id` / `Contato da Negociação.id` → Contacts; `Empresa Nome.id` → Accounts.
- **Preenchimento:**
  - `Nome Oportunidade de Venda.id`: 271/279 (97,1%)
  - `Status`: 279/279 (100%)
  - `Total Geral`: 279/279 (100%)
  - `Vencimento`: 20/279 (**7,2%** — campo de vencimento do contrato quase nunca preenchido)
  - `Data de Envio do Contrato`: 254/279 (91%)
- **Distribuição de `Status`:** Criado 234, Assinado 27, Enviado ao Cliente 16, Cancelado 2. **Achado:** só 27 dos 279 contratos (9,7%) aparecem com status "Assinado" — muito abaixo do número de documentos ZohoSign com status "Signed" (178, ver seção 12). Isso sugere fortemente que o campo `Status` do Contrato nunca foi atualizado automaticamente quando o Zoho Sign completava a assinatura — outro processo manual que ficou pra trás.

---

## 7. Invoices_001.csv

- **Registros:** 123
- **Colunas (55):** Número da Fatura, Contrato.id, Fatura Data, Ordem de compra, Vencimento, ICM, Comissão de Venda, Status, Empresa Nome.id, valores, Nome Contato.id, Nome Oportunidade de Venda.id, **Data de entrega do projeto**, **Data de assinatura do contrato**, **Responsavel financeiro**, **Prazo do contrato**.
- **FK:** `Contrato.id` → SalesOrders; `Nome Oportunidade de Venda.id` → Deals; `Nome Contato.id` → Contacts; `Empresa Nome.id` → Accounts.
- **Preenchimento:** `Nome Oportunidade de Venda.id` 100%, `Status` 100%, `Total Geral` 100%, `Data de assinatura do contrato` 113/123 (91,9%).
- **Achado:** só 123 invoices pra 279 contratos e 1.551 deals — módulo de faturamento claramente subutilizado dentro do Zoho (faturamento provavelmente rodava em outro sistema, ex.: ERP separado, e o Zoho só registrava manualmente uma fração).

---

## 8. Products_001.csv

- **Registros:** 274
- **Colunas (42):** Nome Produto, Código Produto, Nome Fornecedor.id, Produto Ativo, Fabricante, Produto Categoria, datas de venda/suporte, Preço Unitário, Taxa de comissão, Imposto, Unidade de Uso, Qtd. solicitada, Quantidade em estoque, Nível de Reaquisição, Operador.id, Quantidade em demanda, Recorrência.
- **FK:** `Nome Fornecedor.id` → Vendors; `Operador.id` → provavelmente Users.
- **Preenchimento:** `Nome Produto` 100%, `Preço Unitário` 247/274 (90,1%), `Produto Ativo` 100%.
- **Achado:** catálogo de produto existe e tem 274 itens, mas os campos de estoque (Quantidade em estoque, Nível de Reaquisição, Quantidade em demanda) são típicos de produto físico — não fazem sentido pra um SaaS/telefonia. Indica que o módulo Products é o template padrão do Zoho nunca customizado pro modelo de negócio real (linha, ramal, plano) — reforça por que o time preferiu usar campos livres em Deal/Contrato (Quantidade de Ramais etc.) em vez do catálogo de produto.

---

## 9. Itens Cotados_001.csv (QuotedItems), 10. Itens Solicitados_001.csv (OrderedItems), Setup_C / Setup._C

- **Itens Cotados:** 1.876 registros, 24 colunas — linha de item de Proposta. Campo extra `Recorrência_Old` + `Recorrência` (dois campos de recorrência, um "antigo" e um atual — sinal de migração interna de schema).
- **Itens Solicitados:** 487 registros, 23 colunas — linha de item de Contrato. Só `Recorrência` (sem "_Old").
- **Setup_C** (satélite de Propostas): 564 registros — `ID do pai.id` 100% preenchido (aponta pra Propostas), `Produto.id` 99,6%, `Montante` 97,5%, `Recorrência` 97,9%.
- **Setup._C** (satélite de Contratos): 200 registros — mesma estrutura, `Recorrência` só 61,5% preenchido.
- **Preenchimento `Recorrência` (valores livres, não é picklist controlado):**
  - Setup_C: "A Vista" 508, "Mensal" 16, "A VISTA" 5, "À VISTA" 4, "MENSAL" 3, "PARCELA ÚNICA" 2, "Parcelado em 4x" 2, "0" 1, "mensal" 1, "1" 1, "Á vista" 1, "1x" 1, "A vista" 1, "Parcela Unica" 1...
  - Itens Cotados: "Mensal" 1.738, "A Vista" 44, "MENSAL" 24, "A vista" 5, "A VISTA" 2, "MESES" 2, "mensal" 1, "À vista" 1, "Desconto do contrato" 1, "-" 1...
- **Achado crítico:** `Recorrência` deveria ser um picklist mas é **texto livre digitado por humano**, com pelo menos 8 variações de capitalização/acentuação pro mesmo valor ("A Vista", "A VISTA", "À VISTA", "Á vista", "A vista"...). Qualquer cálculo de MRR vs. receita não-recorrente feito direto nesse campo sem normalização vai estar sistematicamente errado. Isso é provavelmente uma das causas raiz de "MRR não bate" se alguém já reclamou disso.

---

## 11. Stage History_001.csv (DealHistory)

- **Registros:** 6.428 — histórico automático de mudança de Stage de Oportunidades (gerado pelo Zoho, não digitado).
- **Colunas (15):** Nome Oportunidade de Venda.id, Estágio, Duração da etapa (Dias do calendário / Tempo), Montante, Probabilidade, Receita Esperada, Data de Fechamento, Movido para.
- **Preenchimento:** `Nome Oportunidade de Venda.id` 100%, `Estágio` 100%, `Montante` 4.717/6.428 (73,4%).
- **Achado valioso:** este é o único lugar no backup onde dá pra reconstruir **quanto tempo cada deal passou em cada estágio** — 6.428 transições pra 1.551 deals (média de ~4,1 transições por deal). Se o CRM novo não migrou isso, perdeu toda a velocidade histórica de funil (métrica de sales cycle por estágio).

---

## 12. Situação de Lead Histórico_C_001.csv e Responsabilidade Histórico_C_001.csv

Ambos são módulos de sistema (Field History Tracking automático do Zoho), não inseridos manualmente.

- **Situação de Lead Histórico_C:** 3.085 registros — histórico de mudança do campo `Lead Status`. `Situação de Lead` 100%, `Nome Completo.id` 100% (aponta pro Lead), `Duração (dias)` 1.631/3.085 (52,9%).
- **Responsabilidade Histórico_C:** 2.259 registros — histórico de mudança do campo `Responsabilidade` em Contacts. `Responsabilidade` 100%, `Nome Completo.id` 100% (aponta pro Contact), `Duração (dias)` **0/2.259 (0%)** — campo nunca calculado/preenchido neste módulo específico (possível bug de configuração do tracking, ou o campo foi adicionado depois e nunca rodou retroativamente).

---

## 13. Calls_001.csv

- **Registros:** 414
- **Colunas (35):** Proprietário da chamada.id, Tipo de ligação, Finalidade da ligação, Nome do Contato.id, Relacionado A.id, Horário de início, Duração da ligação (+ em segundos), Resultado da ligação, Status de chamada de saída, Agendar no CRM, Agenda da chamada, **ID de chamadas**, **Número discado**, **Número do cliente**, **Gravador de voz**, **Número do remetente**, **Número do destinatário**.
- **FK:** `Nome do Contato.id` → Contacts; `Relacionado A.id` (polimórfico, sem coluna `.Module` companion visível no header — checar se existe implícito).
- **Preenchimento:**
  - `Nome do Contato.id`: 82/414 (**19,8%** — só 1 em 5 chamadas linkada a um contato)
  - `Relacionado A.id`: 376/414 (90,8%)
  - `Resultado da ligação`: 1/414 (**0,2%** — praticamente nunca preenchido)
  - `Duração da ligação (em segundos)`: 412/414 (99,5%)
- **Achado crítico pra empresa de telefonia:** o campo que deveria dizer "o que aconteceu na ligação" (`Resultado da ligação`) está vazio em 413 de 414 registros. Isso é uma perda de dado histórico de qualificação/atendimento gigante — o log técnico da chamada (duração, número discado) existe, mas o outcome humano não foi registrado quase nunca dentro do Zoho. Vale confirmar com a frente de reconciliação se esse dado existia em outro lugar (provável: no próprio Asterisk/discador, não no Zoho).

---

## 14. Meetings_001.csv, Tasks_001.csv

- **Meetings:** 382 registros, 43 colunas — inclui campos de check-in geográfico (Latitude, Longitude, Cidade de acesso, Sublocalidade) que sugerem tentativa de rastrear reuniões presenciais/visitas. `Nome do Contato.id` 74,1%, `Relacionado A.id` 86,6%, `Status do check-in` 100%.
- **Tasks:** 510 registros, 28 colunas. `Status` 100%, `Vencimento` 99,8%, `Relacionado A.id` 99,8% — módulo bem preenchido, sem achados de qualidade.

---

## 15. Emails_001.csv

- **Registros:** 177
- **Colunas (44):** inclui `Sentimento do e-mail`, `Intenção de e-mail`, `Palavra-chave de e-mail` — campos de análise de sentimento/intenção, preenchidos 100% (177/177). Isso indica que havia algum add-on ou automação de IA/NLP rodando sobre os emails do Zoho (SalesIQ, Zia, ou integração externa) — vale investigar se essa camada de "IA em cima do email" ainda existe em algum lugar ou também foi perdida.
- **Distribuição de `Módulo` (a qual entidade o email pertence):** Potentials 85, CustomModule1 (ZohoSign Documents) 52, Contacts 33, SalesOrders 6, Invoices 1.

---

## 16. Notes_001.csv

- **Registros:** 4.560 (o maior módulo de "conteúdo humano" do backup)
- **Colunas (12):** Título da nota, Conteúdo da Nota, ID do pai.id, Parent Id.Module, Associated_Id.
- **Distribuição de `Parent Id.Module`:** Potentials 1.716, CustomModule1 (ZohoSign Documents) 1.605, Leads 968, Quotes 115, Accounts 70, Contacts 61, SalesOrders 13, Invoices 10, Tasks 1, Events 1.
- **Achado grave (ver seção de achados gerais):** 1.605 das 4.560 notas (35%) estão anexadas a registros do módulo `CustomModule1` = **ZohoSign Documents**, não diretamente ao Deal/Empresa/Contato. Se a migração só copiou notas linkadas direto a Deal/Lead/Account/Contact, mais de um terço do conteúdo textual (comentários, observações, negociação) ficou órfão.

---

## 17. Attachments_001.csv

- **Registros:** 1.980 (bate exatamente com o total de arquivos físicos em `~/Downloads/Attachments/`)
- **Colunas (15):** Old Attachment Id, Attachment Owner.id, ID do pai.id, Parent Id.Module, Nome do Arquivo, Tamanho, Record Status, Documents, Link URL, Field.id.
- **Distribuição de `Parent Id.Module`:** **CustomModule1 (ZohoSign Documents) 1.146 (57,9%)**, Potentials 602 (30,4%), Notes 123, Accounts 44, Invoices 19, SalesOrders 18, Emails 14, Quotes 13, Contacts 1.
- **Achado crítico #1 do inventário inteiro:** mais da metade dos anexos (1.146 de 1.980) está tecnicamente linkada ao módulo **ZohoSign Documents**, um app custom de assinatura eletrônica — não direto a Deal/Contrato/Empresa. Isso é uma cadeia de indireção: Attachment → ZohoSign Document → (Deal.id / Account.id / Contact.id / Quote.id, ver seção 18). Se a migração pro CRM novo seguiu só a FK direta "Parent Id.Module = Potentials/Accounts", ela **ignorou por completo o caminho via ZohoSign** e perdeu a maioria dos contratos assinados e certificados de assinatura como anexos rastreáveis dentro do CRM.

---

## 18. ZohoSign Documents_C_001.csv, ZohoSign Recipients_C_001.csv, ZohoSign Document Events_C_001.csv

Estes três formam o app custom de assinatura eletrônica (Zoho Sign integrado ao CRM via módulos customizados 4).

- **ZohoSign Documents_C:** 368 registros, 43 colunas. Campos-chave: `Account.id`, `Contact.id`, `Deal.id`, `Lead.id`, `Quote.id`, `Date Completed`, `Date Declined`, `Date Sent`, `Declined Reason`, `Document Deadline`, `Document Status`, `Time to complete`, `ZohoSign Document ID`, `Module Name`, `Module Record ID`.
  - Preenchimento: `Account.id` 327/368 (88,9%), `Contact.id` 315/368 (85,6%), `Deal.id` 297/368 (80,7%), `Lead.id` **0/368 (0%)**, `Quote.id` 304/368 (82,6%).
  - 40 de 368 (10,9%) documentos não têm NENHUM link a Account/Contact/Deal/Quote — órfãos completos.
  - Distribuição de `Document Status`: Signed 178, Drafted 65, Expired 43, (vazio) 38, Recalled 36, Declined 4, Out for Signature 4.
- **ZohoSign Recipients_C:** 1.257 registros, 34 colunas. `ZohoSign Document.id` 1.251/1.257 (99,5%), `Recipient Status`: Signed 752, (vazio) 318, Waiting for Signature 181, Cancelled 4, Approved 2.
- **ZohoSign Document Events_C:** 547 registros, 28 colunas — log de eventos (Date, Description) por documento. `ZohoSign Document.id` 545/547 (99,6%).
- **Achado:** só 178 documentos com status "Signed" no módulo ZohoSign, mas o Status do módulo Contratos só mostra 27 "Assinado" (seção 6) — confirma que a sincronização Contrato↔ZohoSign nunca foi automática/confiável dentro do próprio Zoho. Esse módulo é provavelmente a fonte de verdade real sobre "o que foi de fato assinado", mais confiável que o campo Status manual do Contrato.

---

## 19. Oportunidade de Venda Contact Role_001.csv (DealContactRole)

- **Registros:** 1.118, 4 colunas: Função, Contact Name.id, Potential Name.id.
- Tabela de junção N:N entre Contacts e Deals com um papel (`Função`) — modela múltiplos contatos por negociação (decisor, influenciador, etc.). Não tem achado de qualidade digno de nota; é só uma junção simples.

---

## 20. ConvertedLeadRecords_001.csv

- **Registros:** 481, 8 colunas: Lead.id, Account.id, Contact.id, Potential.id, Lead Created Time, Converted Time, Converted By.id.
- **Preenchimento:** `Lead.id` 100%, `Account.id` 469/481 (97,5%), `Contact.id` 471/481 (97,9%), `Potential.id` 415/481 (86,3%) — 66 conversões de Lead não geraram Deal (conversão só até Contact/Account, sem oportunidade).
- Este é o log oficial e mais confiável de "quais Leads viraram o quê" — importante como cross-check contra o campo `Está convertido` em Leads_001.csv.

---

## 21. Campaigns_001.csv e CampaignContactMember_001.csv

- **Campaigns:** só **1 registro** — a Callface praticamente não usou o módulo de Campanhas do Zoho como ferramenta de marketing (rastreamento de campanha ficava em outro lugar — provavelmente RD Station/Meta Ads via `Fonte de Lead` e UTMs direto em Leads).
- **CampaignContactMember:** só 8 registros — reforça o mesmo achado.

---

## 22. StickyNotes_001.csv

- **Registros:** 34, 8 colunas (Content, Created Time, Instance.id, Login Notify). São os "post-its" da tela inicial do Zoho (recados internos do time, não dados de cliente) — baixo volume, baixo risco de perda relevante.

---

## 23. Users_001.csv

- **Registros:** 38 usuários cadastrados no Zoho.
- **Status:** de 38, só **15 estão `ACTIVE`**; os demais estão `DISABLED` (maioria), 1 `CLOSED`, 1 `DELETED`.
- Usuários incluem contas genéricas/funcionais (`one.callface@gmail.com`, `crm.users2023@gmail.com`, `telefonia@callface.com.br`, `faturamento@callface.io`, `juridico@callface.io`) e domínios que mudaram ao longo do tempo (`@callface.com.br` → `@callface.io` → `@callface.ai`), incluindo contas da Wevy (`growth@wevy.cloud`, `aline.zagui@wevy.cloud`) e de parceiros (`jose.meloni@ativy.digital`).
- **Achado pra reconciliação:** qualquer FK `Proprietário.id` / `Criado Por.id` / `Modificado Por.id` no restante do backup pode apontar pra um usuário `DISABLED`/`DELETED` — ao migrar "quem é o owner", não dá pra assumir que o usuário ainda existe ou está ativo no CRM novo. Histórico de domínio de email da empresa (com.br → io → ai) também é relevante achado de contexto de negócio.

---

## 24. Metadata: Fields_001.csv, Modules_001.csv, Layout_001.csv, PickListFieldProperties_001.csv, FieldDependencyRelation_001.csv, LayoutFieldProperties_001.csv

- **Fields_001.csv:** dicionário de TODOS os campos de TODOS os módulos (inclusive os não exportados como dados, como Cases/Solutions/Vendors/PriceBooks — módulos que existem no schema mas parecem não ter tido dados exportados, ou tinham zero registros).
- **Contagem de campos customizados (`Is Custom = true`) por módulo, via cruzamento Fields×Modules:**

| Módulo | Nº de campos customizados |
|---|---|
| Qualify Leads through Email (orquestração) | 40 |
| Qualify Leads through Call (orquestração) | 37 |
| Leads | 20 |
| Oportunidades de Vendas | 18 |
| ZohoSign Documents | 18 |
| Contacts | 15 |
| Empresas | 12 |
| Contratos | 10 |
| Setup (satélite de Propostas) | 10 |
| ZohoSign Recipients | 9 |
| Setup. (satélite de Contratos) | 8 |
| Propostas | 7 |
| Sales Journey (Default Path Finder) | 5 |
| Campaigns | 5 |
| Invoices | 4 |
| ZohoSign Document Events | 3 |
| Itens Cotados / Itens Solicitados / Products | 1–2 |

- **Achado:** os dois maiores "módulos" com campos customizados não são entidades de dado — são **automações de qualificação de lead** (`Qualify Leads through Email`/`Call`, tipo `Orchestration`). Isso mostra que existia uma camada de automação de qualificação bem robusta (77 campos customizados combinados) dentro do próprio Zoho que não aparece em nenhum CSV de dado — porque são regras/fluxos, não registros. Essa lógica de automação **certamente não foi migrada** pro CRM novo (que não tem como importar "regras" de um CSV de dados) e precisa ser reconstruída do zero ou recuperada via API do Zoho (não via backup CSV) se ainda estiver acessível.
- **Layout_001.csv:** confirma módulos "fantasmas" que existem no schema mas não geraram export de dado relevante aqui: `Cases`, `Solutions`, `Vendors`, `PriceBooks`, `PurchaseOrders`, `Territories`, `CalendarBookings`, `MultiCurrency`, `Automation_Cadences`/`Cadences_Followups`/`Entity_Cadences` (mais automação de cadência de follow-up, sem dado exportado — mesmo padrão do achado acima), `TeamSelling`, `Global Fileupload`.
- **PickListFieldProperties_001.csv:** 558 KB — contém TODOS os valores possíveis de cada picklist, incluindo valores legados/desativados. Útil pra reconciliação decodificar exatamente o que cada opção antiga de picklist queria dizer, mesmo que não apareça mais nos dados atuais.
- **Company_Details_001.csv:** confirma organização única "Callface", moeda BRL, timezone America/Sao_Paulo — nada relevante alem de metadado de conta.
- **Roles/Profiles:** hierarquia simples (Visão Geral → Gerente → Vendedores) e perfis incluindo um `ClientPortal` (indica que em algum momento existiu portal de cliente exposto no Zoho) e `MKT GrowthTeam`.
- **Tags_001.csv:** só 5 tags cadastradas no total (baixo uso de tags como ferramenta de organização) — inclui "ImportacaoZohoWevy", confirmando que houve uma importação de dados vinda da Wevy dentro do próprio histórico do Zoho (dado já migrado uma vez antes desta migração).

---

## 25. Attachments físicos (`~/Downloads/Attachments/`) — classificação por padrão de nome

Total: **1.980 arquivos**, todos com nome no formato `<hash>_<nome original>`.

### Por extensão

| Extensão | Qtde | % |
|---|---|---|
| `.pdf` | 1.753 | 88,5% |
| `.xlsx` | 99 | 5,0% |
| `.eml` | 48 | 2,4% |
| `.zip` | 29 | 1,5% |
| `.png` | 21 | 1,1% |
| `.msg` | 15 | 0,8% |
| `.docx` | 11 | 0,6% |
| `.jpg` | 3 | 0,2% |
| `.ogg` | 1 | 0,05% |

### Por padrão de conteúdo (categorias não são mutuamente exclusivas — um PDF pode ser "signed" E "SalesOrder" ao mesmo tempo)

| Categoria | Qtde aprox. | Exemplo |
|---|---|---|
| Contém "SalesOrder" (contrato gerado no fluxo de Sales Order) | 582 | `SalesOrder_5938068000002006026.pdf` |
| Contém "signed" / "assinado" (versão assinada de qualquer doc) | 518 | `2º TERMO ADITIVO - ONR - ID 14085 - assinado.pdf` |
| Contém "-completion_certificate" (certificado ZohoSign de conclusão de assinatura) | 178 | `...pdf-completion_certificate.pdf` |
| Contém "CONTRATO" no nome | 258 | `CONTRATO ID 254 - 01_2026 - AWALTECH.pdf` |
| Contém "_QT_" (proposta/quote gerada) | 366 | `QT_PPA - 224 -06_2024 - SWISS PARK OFFICE.pdf` |
| Contém "PPA-"/"PPZ-" (numeração antiga de proposta, formato pré-"QT_") | 249 | `PPA-14356-12-2022-CALLFACE-VETLOG_V2.pdf` |
| Contém "_SO_CT" (ordem de serviço/contrato, nomenclatura mais recente) | 99 | `SO_CT - 307 - 07_2026 - Chat Envio.pdf` |
| `.xlsx`/`.xls` (planilhas — faturamento, cotação, escopo) | 99 | `AUTOLOG - Detalhamento_faturamento.xlsx` |
| `.eml` (email exportado — cancelamento, negociação, portabilidade) | 48 | `RE_ BIOMED LOG _ Lembrete CALLFACE...eml` |
| `.msg` (email formato Outlook) | 15 | `Re RES Proposta Callface.msg` |
| `.zip` (pacotes — geralmente cotações grandes ou "concluído docusign" empacotado) | 29 | `3212010 QT DPASCHOAL ADITIVO Callface vFinal.zip` |
| `.png`/`.jpg` (prints de escopo, dashboards, comprovantes) | 24 | `Escopo Eurofins.png`, `Exemplo de Dashboard Awaltech.jpg` |
| `.docx`/`.doc` (fichas cadastrais, surveys, demandas) | 11 | `Ficha Cadastral CALLFACE (6).docx` |
| `.ogg` (áudio — nota de voz de WhatsApp) | 1 | `WhatsApp Ptt 2026-05-08 at 10.38.34.ogg` |

**Observações sobre os arquivos:**
- Numeração de proposta evoluiu com o tempo: `PPA-NNNNN` (2022–2023) → `PPA - NNN` mais curto (2024) → `QT_PPA - NNN` (2024, já com prefixo QT do Zoho) → `SO_CT - NNN` (2025–2026, quando a Sales Order passou a ser nomeada junto). Isso é uma pista de que os processos internos de numeração de contrato mudaram pelo menos 3 vezes.
- Nomes de arquivo contêm CNPJ/CPF em texto puro em pelo menos um caso visto (`...63.638.421 Anne Camille Beatriz de Almeida.pdf`) — dado sensível exposto no nome do arquivo, não só no conteúdo. Vale considerar no LGPD/segurança da futura estrutura de storage do CRM 2.0.
- Os `.zip` frequentemente empacotam o "pacote de assinatura completo" (ex.: `Concluído_ Complete com o Docusign_ CT - ...zip`) — nome sugere DocuSign, não Zoho Sign, em pelo menos alguns contratos. Ou seja, **a Callface usou DocuSign para alguns contratos e Zoho Sign para outros** — dois sistemas de assinatura eletrônica coexistindo, o que reforça que o módulo ZohoSign_C do CRM só cobre uma fração da realidade de assinaturas.

---

## ACHADOS QUE MERECEM ATENÇÃO

1. **Attachments e Notes majoritariamente indiretos ao Deal.** 57,9% dos 1.980 anexos e 35% das 4.560 notas estão linkados ao módulo `ZohoSign Documents` (custom), não direto a Oportunidade/Empresa/Contrato. Qualquer migração que seguiu só a relação direta "anexo → Deal/Account" perdeu a maior parte dos contratos assinados e comentários de negociação. Esse é provavelmente o achado nº1 de "por que a migração perdeu tanta informação".

2. **Pipeline de Stage duplicado PT/EN, nunca normalizado.** "Closed Won"/"Concluído"/"Ganho" e "Closed Lost"/"Perdido" convivem como estágios distintos há anos em Oportunidades E em Propostas (com o mesmo padrão, incluindo o typo "Propsta Perdida"). Qualquer métrica de win-rate histórica calculada sem normalizar esse texto está errada.

3. **Campo `Recorrência` (base de cálculo de MRR) é texto livre, não picklist.** Pelo menos 8 grafias diferentes do mesmo valor ("A Vista"/"A VISTA"/"À VISTA"/"Á vista"/"A vista") em `Setup_C` e `Itens Cotados`. Se alguém já calculou MRR histórico direto dessa coluna, o número está inflado ou reduzido por erro de agrupamento de texto.

4. **`Resultado da ligação` (outcome de chamada) vazio em 413 de 414 registros.** Numa empresa de telefonia/discador, o Zoho não capturava o resultado humano da ligação — só metadado técnico (duração, número). Se esse dado existir, está em outro sistema (Asterisk/discador), não no Zoho.

5. **Contrato "assinado" no Zoho (27) muito abaixo do ZohoSign "Signed" (178).** O campo Status manual do módulo Contratos nunca foi sincronizado com o resultado real da assinatura eletrônica — o dado confiável de "o que foi assinado de fato" está no módulo ZohoSign, não no status do Contrato.

6. **Dois sistemas de assinatura eletrônica coexistindo.** Nomes de arquivo `.zip` mencionando "Complete com o Docusign" ao lado de centenas de `-completion_certificate.pdf` do Zoho Sign confirmam que parte dos contratos foi assinada via DocuSign fora do módulo ZohoSign_C do CRM — provavelmente 100% invisível pra qualquer reconciliação que só olhe o módulo ZohoSign_C.

7. **77 campos customizados "vivem" em módulos de automação/orquestração (`Qualify Leads through Email/Call`), não em módulos de dado.** Essa lógica de qualificação automática de lead não aparece em nenhum CSV de registro — é regra de negócio armazenada como configuração, não dado. Não é recuperável via backup CSV; só via API do Zoho (se ainda ativa) ou reconstrução manual pela memória do time.

8. **CNPJ pouco usado em Leads (0,9%) mas relativamente bem usado em Empresas (73,1%)** — sugere que a captura de CNPJ só acontecia depois da qualificação (na conversão pra Empresa), nunca na entrada do Lead. Prospecção/formulário de entrada não pedia CNPJ.

9. **Quase metade dos Contatos (44,4%) não está linkada a nenhuma Empresa.** Para uma base B2B, isso é um volume alto de contato "solto" — pode ser efeito de import de leads pessoais/pontuais, ou de vínculo perdido em alguma limpeza anterior.

10. **Campos redundantes em pelo menos 3 entidades:** `Percentual Multa` + `Percentual de Multa` (Contratos), `Recorrência` + `Recorrência_Old` (Itens Cotados), `Empresa Site` (nunca preenchido) + `Site` (Empresas), e o trio picklist+3 booleans de responsabilidade em Contacts. Padrão recorrente de campo novo criado ao lado do antigo sem nunca migrar/depreciar o velho — sintoma de dívida de schema acumulada por anos sem faxina.

11. **Domínio de email da empresa mudou pelo menos 2 vezes** (`@callface.com.br` → `@callface.io` → `@callface.ai`), visível em Users_001.csv com o mesmo nome de pessoa aparecendo com domínios diferentes (ex.: "Leonardo Almeida", "Gustavo Santos", "Filipe Nascimento" cada um com 2 contas de domínios diferentes). Isso é ruído de duplicidade de usuário que qualquer reconciliação de "quem é o owner" precisa tratar.

12. **Só 1 registro em Campaigns e 8 em CampaignContactMember.** O módulo nativo de campanha do Zoho foi essencialmente não-usado — o rastreamento real de origem de lead vivia nos campos `utm_*`, `gclid`, `fbclid`, `Fonte de Lead` dentro do próprio Lead, não no módulo de Campanha. Não é "dado perdido", é "módulo nunca adotado".

13. **Emails com análise de sentimento/intenção 100% preenchida (177/177).** Contradiz a expectativa de "campo pouco usado" — na verdade sugere uma automação/IA rodando sobre 100% dos emails registrados. Vale investigar se essa era uma integração da Zia (IA nativa do Zoho) ou de terceiro, e se essa capacidade de "ler sentimento do email" precisa ser recriada no CRM novo.

14. **CPF em Contacts praticamente morto (0,05%, 1 registro)**, mas existe um campo dedicado — sugere que em algum momento tentaram capturar CPF de responsável/testemunha e desistiram rapidamente, ou que o dado ficava só no anexo (contrato PDF) e nunca era digitado no campo estruturado.

15. **Nome de arquivo com CNPJ/CPF em texto puro** em pelo menos um attachment (`...63.638.421 Anne Camille Beatriz de Almeida.pdf`). Ponto de atenção de exposição de dado pessoal identificável já no nome do arquivo, independente do conteúdo — relevante para a arquitetura de storage/permissão do CRM 2.0.

16. **Zero registros de venda "Cases"/"Solutions"/"Vendors"/"PriceBooks"/"Territories" apesar de existirem no schema (Layout_001.csv).** Confirma que vários módulos padrão do Zoho foram simplesmente nunca adotados pela operação — não é perda de migração, é módulo que nunca teve conteúdo.
