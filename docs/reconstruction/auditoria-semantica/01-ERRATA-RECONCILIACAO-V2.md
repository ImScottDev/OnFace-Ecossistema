# Errata Forense + Reconciliação V2 da Auditoria Semântica

> READ ONLY em toda a execução desta errata — só queries pontuais sobre artefatos já existentes (`BEGIN READ ONLY` quando tocou banco) para resolver contradições específicas. Nenhuma investigação massiva foi refeita. Os arquivos da V1 (`00-RECONCILIACAO-SEMANTICA-RELATORIO.md` e `artefatos/*.csv|md` originais) **não foram alterados** — permanecem como evidência da V1. Nenhuma correção foi implementada em PROD/HOMOLOG/Stripe.

---

## 1. O que estava errado na V1

| Afirmação V1 | Problema | Valor/categoria corrigida | Como foi validado |
|---|---|---|---|
| "175 empresas WEVY... zero em PROD e HOMOLOG" | Conflava duas categorias diferentes — a V1 já tinha as colunas certas no CSV (`status_crm_prod`/`status_crm_homolog`), mas o texto do resumo não as decompôs | **172** sem contrato em PROD (não 175 — diferença é dedup de 3 empresas WEVY que mapeiam pro mesmo `empresa_id` no CRM), das quais **76 já têm contrato em HOMOLOG** (R$160.741,22) e só **96 não têm em lugar nenhum** (R$200.298,92) | Recontagem direta de `wevy-reconciliation.csv`, deduplicado por `empresa_id_crm` |
| "R$361.040,14 de MRR PABX sem contrato" | Confundia (a) faturamento observado em maio/2026 com MRR atual, e (b) tratava tudo como PABX quando parte é `Pré-Pago` (=CALLFACE_AI por regra de negócio) | R$361.040,14 é **faturamento WEVY observado em maio/2026**, não MRR atual. Decomposto: **R$350.160,70 "Contrato" (provável PABX)** + **R$10.879,44 "Pré-Pago" (CALLFACE_AI por regra confirmada)** | Mesma recontagem, campo `tipo_contratacao_wevy` |
| "12 não existem + 5 sem contrato + 6 gaps = 20" (a soma dava 23) | Erro de síntese ao escrever o texto — o CSV subjacente já estava certo, categorias tinham 1 linha cada, sem overlap | **7** não encontradas + **7** encontradas sem contrato + **6** gap confirmado = **20**, exato, sem overlap | Releitura linha a linha de `status_crm_reflete_churn` nas 20 linhas com `churned_na_planilha=sim` |
| "Stripe MRR ativo = R$52.845,95" | Confundia billing run-rate com MRR semântico — 1 subscription chamada "SETUP BROKER IA" estava incluída como se fosse recorrência | Run-rate ativo = R$52.845,95 (correto como número bruto). **MRR semântico confirmado/provável = R$51.222,20**. **SETUP/parcela = R$1.623,75** (1 subscription) | Classificação por nome de produto nas 133 subscriptions ativas |
| "15 subscriptions órfãs = R$7.854,85 de MRR órfão" | Mesma confusão — 1 das 15 é a mesma "SETUP BROKER IA" | Órfão **MRR semântico = R$6.231,10** (14 subs). Órfão SETUP = R$1.623,75 (1 sub) | Mesma classificação, filtrada por `vinculo_crm_encontrado=não` |
| "G30: 1.439,20 órfão + 3.058,30 subscription atual + 24.450 White Label = excesso R$25.889,20" | Misturava PROD e HOMOLOG como se fosse o mesmo lugar, e tratava a subscription "real" como saudável sem checar o status Stripe atual | Ver seção 5 — excesso real em PROD hoje é **R$1.439,20** (não 25.889,20); o White Label (R$24.450) só existe em HOMOLOG, nunca chegou a PROD; a subscription "consolidada" de R$3.058,30 está **`unpaid`** no Stripe agora, não confirmada saudável | Query direta em PROD + cruzamento com `stripe-reconciliation.csv` pelos 2 `stripe_subscription_id` |
| "negocios.mrr_fechado deveria substituir contratos.mrr" | Trocava uma heurística problemática por outra sem prova de que `mrr_fechado` é sempre confiável | Rejeitado como regra geral — ver seção 9, proposta agora é por grupo/evidência, não por cópia de campo | Contraexemplo already found: VETLOG (negócio ~R$919 vs billing real ~R$1.004) |
| "Padrão 2 de duplicidade Stripe = R$7.105,20 confirmado" | O cálculo incluía, no caso G30, um contrato **já `churned`** (R$1.619,10) como se estivesse ativo, inflando o "excesso" desse lead em R$1.619,10 | Excesso real do G30 nesse padrão: R$1.439,20 (não R$3.058,30). Total do Padrão 2 **rebaixado de CONFIRMED para PROBABLE** até os outros 17 leads serem revalidados um a um pela mesma checagem de status | Query direta em PROD (`status` de cada contrato do G30) |
| "102 produtos = catálogo classificado" | Implicava catálogo completo; é só os produtos que aparecem nos 487 Itens Solicitados/Contract Items analisados | Renomeado para "produtos presentes nos contract items analisados" — Zoho tem 274 Products cadastrados, CRM tem `servicos_catalogo` próprio, Stripe tem seus Products/Prices — nenhum dos 3 foi consolidado nesta auditoria | Contagem não refeita (economia de contexto) — só a nomenclatura foi corrigida |
| Integrações (Ploomes/Bitrix/Movidesk) classificadas PABX por default | Regra de negócio confirmada diz "Integração CRM = CALLFACE_AI", mas o classificador só reconhecia a string literal "INTEGRAÇÃO CRM", não "INTEGRAÇÃO <nome de CRM>" | **4 ocorrências reclassificadas** de PABX → CALLFACE_AI: Ploomes, Bitrix, Movidesk+API (x2 variantes) | Grep direto no `product-classification.csv` original |
| "Matte/Venda na Veia/Broker IA = R$X de MRR White Label" | A própria V1 já tinha marcado o significado de MRR White Label como UNRESOLVED, mas os números apareceram como se fossem MRR confirmado em algumas tabelas | Reforçado explicitamente: esses são **valores de contrato/venda confirmados**, não MRR até prova de licenças ativas faturáveis | Nenhuma query nova — correção de enquadramento |

---

## 2. WEVY corrigido

Universo: 210 linhas de faturamento real (maio/2026) com empresa encontrada no CRM = **207 empresas únicas** (3 empresas WEVY mapeiam pro mesmo `empresa_id` no CRM: Centerval Industrial/Comercial/Araçatuba → 1 empresa; 2 grafias de Atrio Hotéis → 1; 2 grafias do Tabelião de Campinas → 1).

| Categoria | Empresas | Valor (faturamento maio/2026) |
|---|---:|---:|
| **A. Sem contrato em PROD** (soma de B+C) | **172** | **R$361.040,14** |
| **B. Sem PROD, mas JÁ TEM contrato em HOMOLOG** (recovery Zoho já capturou) | **76** | R$160.741,22 (WEVY) / R$151.521,54 (mrr atual em HOMOLOG — próximo, diferença ~6%) |
| **C. Sem PROD e sem HOMOLOG** (não capturado em lugar nenhum) | **96** | **R$200.298,92** |
| D. Já tem contrato em PROD (fora do escopo do "gap") | 35 | R$17.619,48 |

Decomposição do grupo A (172 empresas, R$361.040,14) por tipo de contratação WEVY:

| Tipo WEVY | Empresas | Valor | Family provável (regra confirmada) |
|---|---:|---:|---|
| "Contrato" | 153 | R$350.160,70 | PABX (provável — regra "WEVY Contrato = predominância PABX", não é automático por empresa) |
| "Pré-Pago" | 19 | R$10.879,44 | **CALLFACE_AI** (regra de negócio confirmada, não PABX) |

**Terminologia corrigida**: R$361.040,14 é **faturamento WEVY observado em maio/2026 para empresas sem contrato em PROD** — não é "MRR atual de agosto". Não temos dado de agosto/2026 da WEVY nesta auditoria; o valor de maio é a evidência mais recente disponível, tratada como histórica até confirmação.

Artefato: `artefatos/wevy-reconciliation-v2.csv` (207 linhas, uma por empresa única, com categoria A/B/C/D).

---

## 3. Churn WEVY corrigido

Universo: 20 linhas com `churned_na_planilha=sim`. Distribuição fecha exatamente, sem overlap (cada linha tem exatamente 1 categoria em `status_crm_reflete_churn`):

| Categoria | Qtd | Empresas |
|---|---:|---|
| Empresa não encontrada em nenhuma base do CRM | **7** | Transportadora Capivari, AL Empreendimentos, Souza Distribuidora, Natural Pharma, ID Company Tecnologia, Civitas Complexo Sul, J.A. Biazotti |
| Empresa encontrada, mas sem contrato em PROD nem HOMOLOG (não dá pra confirmar/negar) | **7** | DBA Online, Hotéis Vila Rica, Vetlog, Aguapei Agroenergia, Maquinagro, Mr Jacky, Equicontrol |
| **Gap confirmado**: contrato `ativo` em HOMOLOG (só lá, recovery não promovido) apesar do churn na WEVY | **6** | Tozzini Freire, RI Happy (fuzzy, confiança média), Tabelião de Campinas, GBPA, S2B Software, Tudor Campinas |
| **Total** | **20** | ✓ fecha exato |

Nenhum caso de contrato `ativo` em PROD contradizendo diretamente um churn — o gap está inteiramente contido em HOMOLOG.

---

## 4. Stripe semantic billing

| Camada | R$/mês | Qtd subscriptions |
|---|---:|---:|
| **A. Active billing run-rate** (bruto, todas subscriptions active/trialing) | R$52.845,95 | 133 |
| **B. Setup/parcela identificado** (nome de produto contém "SETUP") | R$1.623,75 | 1 (`SETUP BROKER IA`) |
| **C. MRR semântico confirmado/provável** (A − B) | **R$51.222,20** | 132 |
| **D. Unknown** (não classificável por nome) | R$0 | 0 |

Órfãos (subscriptions ativas sem nenhum vínculo no CRM), mesma decomposição:

| Camada | R$/mês | Qtd |
|---|---:|---:|
| Billing ativo órfão (bruto) | R$7.854,85 | 15 |
| — dos quais SETUP/parcela | R$1.623,75 | 1 (mesma `SETUP BROKER IA`) |
| — **MRR recorrente órfão real** | **R$6.231,10** | 14 |

**Limitação declarada**: a classificação MRR vs SETUP foi feita só por nome do produto (não há campo de `revenue_nature` nativo no Stripe nem metadata consultada além do nome/price). Não há mais nenhum outro nome no catálogo ativo que sugira setup/parcela/uso — os outros 132 são nomes de planos recorrentes reconhecíveis (Callface AI Starter/Full, Callface Copilot, Agente IA, Cold Calling, Performance Call). Classificação PROBABLE, não CONFIRMED, para todos — nenhum teve corroboração cruzada com contrato/proposta nesta rodada pontual.

Artefato: `artefatos/stripe-semantic-reconciliation-v2.csv` (133 linhas, active/trialing, com `revenue_nature_v2`).

---

## 5. G30 final

Query direta em PROD (`BEGIN READ ONLY`), 3 contratos, e cruzamento com o status real de cada `stripe_subscription_id` (via `stripe-reconciliation.csv`, sem nova chamada à API):

| contrato_id | tipo | mrr | status local | stripe_subscription_id | **status Stripe real** | lifecycle correto |
|---|---|---:|---|---|---|---|
| `688f5bbd...` | Callface AI - Full | 1.439,20 | ativo | — (nunca teve) | n/a | **POSSIBLE_DUPLICATE** — órfão da aceitação da proposta de upgrade, nunca conciliado |
| `d5008d8a...` | assinatura | 3.058,30 | ativo | `sub_1TvKh2...` | **`unpaid`** | Nominal correto (1.619,10+1.439,20 consolidado), mas **billing não confirmado saudável hoje** |
| `1a44f099...` | assinatura | 1.619,10 | **churned** | `sub_1TMVoc...` | `canceled` | **SUPERSEDED_CONTRACT** — já está correto, não conta na carteira |

**Contrato White Label (`a6aa15fd...`, mrr=24.450) existe SOMENTE em HOMOLOG — não existe em PROD.** A V1 errou ao somar os R$24.450 junto com os números de PROD como se fosse o mesmo ambiente.

**Explicação da inconsistência V1**: o cálculo do padrão-2 de duplicidade Stripe (`stripe-duplicidade-prod.md`) incluiu o contrato `1a44f099` (R$1.619,10) no "excesso estimado" do G30 como se estivesse `ativo` — mas ele já está `churned`. A fórmula usada (`sum(mrr) - max(mrr)` sobre os 3 contratos do lead, sem filtrar por status) produziu R$3.058,30 de excesso; a fórmula correta, filtrando só contratos com `status='ativo'`, dá **R$1.439,20**.

**Números corretos para G30**:
- MRR nominal mostrado na carteira hoje (soma dos 2 contratos `ativo`): **R$4.497,50**.
- MRR real confirmado saudável (Stripe `active`, não `unpaid`/`canceled`): **R$0** — a única subscription não-cancelada está `unpaid`.
- Excesso por duplicidade (órfão sem subscription): **R$1.439,20**.
- MRR fantasma White Label (HOMOLOG apenas, não afeta PROD): **R$24.450,00** (isolado, ambiente diferente).

Artefato: `artefatos/portfolio-reconciliation-v2.csv` (4 linhas, G30 completo).

---

## 6. White Label

Continua **UNRESOLVED** o significado financeiro dos valores White Label — nenhuma mudança de conclusão, reforçando o que a V1 já tinha marcado corretamente nesse ponto específico:

- Matte Tecnologia (3 contratos, R$6.495+R$6.495+R$9.900), Venda na Veia (R$9.093), Broker IA (R$6.495): são **fatos comerciais confirmados** (venda existiu, contrato existe) — mas **nenhum desses valores entra em MRR/carteira** sem evidência de licenças ativas faturáveis (regra de negócio: licenças contratadas ≠ licenças ativas; valor setup ≠ MRR).
- Nenhuma dessas 3 empresas teve evidência de billing recorrente real (Stripe/WEVY) batendo com o valor do contrato White Label nesta auditoria.
- Ação correta até nova evidência: preservar o contrato como fato histórico, **marcar `mrr=0` ou `revenue_nature=UNKNOWN`** para o segmento White Label inteiro, não assumir nenhum valor como recorrente.

---

## 7. Produtos

- **102 produtos** = produtos distintos presentes nos **487 Itens Solicitados/contract items** analisados (não é o catálogo completo).
- Zoho backup tem **274 Products** cadastrados — a maioria nunca usada em contract item real, não consolidado nesta auditoria.
- CRM atual tem seu próprio `servicos_catalogo` — não consolidado.
- Stripe tem **52 Products / 51 Prices** ativos — não consolidado com os 102 nem com os 274.
- **Correção aplicada**: 4 ocorrências reclassificadas de PABX (default) para **CALLFACE_AI**, por conterem "Integração CRM" com nome de plataforma (Ploomes, Bitrix, Movidesk×2) — regra de negócio confirmada "Integração CRM = CALLFACE_AI" tem prioridade sobre o default PABX quando o item nomeia uma integração de CRM, mesmo sem a string literal "INTEGRAÇÃO CRM".
- Os 3 catálogos (Zoho 274 / CRM `servicos_catalogo` / Stripe 52+51) continuam **não consolidados** — pendência explícita para uma futura rodada, não resolvida aqui por economia de contexto.

---

## 8. PROD × HOMOLOG

Três classes separadas, sem misturar:

| Classe | Descrição | Valor | Confiança |
|---|---|---:|---|
| **Supercontagem confirmada** | 263 contratos `legado_zoho` em HOMOLOG com mrr = Total Geral do contrato (não recorrência) | R$318.974,20 bruto (decomposição fina já feita na V1, seção 10) | CONFIRMED (padrão) / PROBABLE (valor exato por contrato, pendente reclassificação item a item) |
| **Subcontagem confirmada** | Centerval (renovação real nunca migrada) + Venda na Veia/Broker IA (contrato Zoho pronto nunca migrado) + 96 empresas WEVY categoria C (nenhum contrato em lugar nenhum) | R$2.851 (Centerval) + R$15.588 (Venda na Veia+Broker IA) + R$200.298,92 (WEVY categoria C, histórico maio/2026) | CONFIRMED |
| **Duplicidade semântica (não é PROD vs HOMOLOG, é dentro do mesmo PROD)** | 39 pares mesmo `stripe_subscription_id` + padrão órfão (G30 e outros, valor total a revalidar) | R$18.438,90 (CONFIRMED) + até R$7.105,20 rebaixado a PROBABLE (seção 1) | CONFIRMED / PROBABLE |

---

## 9. O que está CONFIRMED para implementação futura

Fatos realmente seguros, prontos para virar tarefa de correção (ainda sem implementar):

1. Fix de duplicidade Stripe (Padrão 1, mesmo `stripe_subscription_id`) nunca chegou ao código real de produção — **CONFIRMED**, R$18.438,90/mês.
2. G30: contrato órfão `688f5bbd` (R$1.439,20) nunca conciliado com a subscription real — **CONFIRMED**.
3. 76 empresas WEVY (categoria B) já têm alguma representação em HOMOLOG — recovery capturou parte do gap, não é ausência total — **CONFIRMED**.
4. Churn WEVY: 6 empresas com contrato `ativo` em HOMOLOG contradizendo churn documentado — **CONFIRMED**, isolado em HOMOLOG, não afeta PROD hoje.
5. 4 produtos de integração de CRM mal classificados como PABX — **CONFIRMED**, correção pontual e mecânica.
6. White Label: nenhum valor deve entrar em MRR sem evidência de licença ativa — **CONFIRMED** como regra a aplicar.

## 10. O que ainda exige reconciliação antes de qualquer write

1. **Padrão 2 de duplicidade Stripe** (18 leads, valor original R$7.105,20) — rebaixado a PROBABLE; precisa da mesma checagem de status feita no G30 aplicada aos outros 17 leads antes de aceitar qualquer valor agregado.
2. **Reclassificação dos 263 contratos `legado_zoho`** — a proposta de usar `negocios.mrr_fechado` como substituto direto foi **rejeitada** (ver seção 1); a reclassificação correta precisa ser por grupo/evidência (item + recorrência + contrato + evento + billing), não cópia de campo — trabalho ainda não feito.
3. **96 empresas WEVY sem contrato em lugar nenhum** (R$200.298,92, maio/2026) — não sabemos se ainda faturam em agosto; não inventar MRR atual sem confirmação mais recente da WEVY.
4. **A subscription "real" do G30 está `unpaid`** — antes de considerar R$3.058,30 como MRR saudável, confirmar se o pagamento foi recuperado ou se isso deveria contar como risco de churn financeiro.
5. **3 catálogos não consolidados** (Zoho 274 / CRM `servicos_catalogo` / Stripe 52+51 Products/Prices).
6. **Significado financeiro do White Label** — decisão de negócio, não dado.

---

## 11. Plano operacional corrigido (SEM EXECUTAR)

1. Aplicar a correção mecânica dos 4 produtos de integração CRM (Ploomes/Bitrix/Movidesk) na matriz de classificação.
2. Revalidar, um a um, os outros 17 leads do Padrão 2 de duplicidade Stripe com a mesma checagem de status que resolveu o G30 (churned vs ativo, Stripe real vs órfão) — só depois disso o número agregado pode voltar a CONFIRMED.
3. Separar explicitamente, em qualquer dashboard futuro de carteira: (A) conter novas duplicidades (deploy do fix — missão própria, fora desta) de (B) reconciliar o passivo já existente (os 39+18 pares/leads) — não tratar como a mesma ação.
4. Para os 263 `legado_zoho`, montar a reclassificação por grupo de evidência (item/recorrência/contrato/evento/billing) em vez de qualquer substituição automática de campo.
5. Decidir com o time comercial o significado de MRR White Label antes de tocar nesse segmento.
6. Só depois de 1-5, repetir a reconciliação de carteira e confirmar convergência antes de qualquer proposta de write em HOMOLOG ou PROD.
