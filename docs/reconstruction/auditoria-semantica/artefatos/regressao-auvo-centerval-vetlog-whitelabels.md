# Auditoria semântica — AUVO, CENTERVAL, VETLOG, White Labels

Read-only. HOMOLOG (`callface-crm-homolog-postgres`) e PROD (`callface-crm-postgres`) via SSH+docker, `BEGIN READ ONLY`. Zoho CSV em `/Users/Scott/Downloads/Data_001/Data/`. Data da auditoria: 2026-08-12.

---

## 1. AUVO — CONFIRMED (billing real via Stripe, sem MRR fantasma)

**Empresa:** Auvo Tecnologia (homolog id `aca16a38-d12a-49f3-b3a8-da0f9f2697a8`, zoho_id `5938068000018091003`, `stripe_customer_id=cus_U0CUewd9n2A2TB`).

**Timeline comercial (4 negócios, zoho):**
1. 2025-04-14 `Auvo Tecnologia | Callface | Renato` — **Perdido**, R$1.798,50 (proposta 423, rascunho). Sem impacto.
2. 2025-05-27 `AUVO TECNOLOGIA` — **Ganho**, sem valor preenchido (registro "vazio", zoho_id ...18941142). Não infla MRR (mrr_fechado nulo).
3. 2025-09-03 → ganho 2025-09-11 `AUVO | CALLFACE AI | MAYARA` — **Ganho**, R$2.799,00 (proposta 565, aceita). Este é o negócio que originou a assinatura real.
4. 2025-10-02 `AUVO LATAM | POC - CALLFACE AI | MAYARA` — **Perdido** (expansão internacional: Equador/Chile/México/Colômbia, "outro"). Sem impacto.

**Contrato/assinatura real (idêntico em HOMOLOG e PROD):** 1 contrato `tipo=assinatura`, `produto=ai`, `mrr=2889.80`, `status=ativo`, `stripe_subscription_id=sub_1T2C5VEd4dqxpSBfZzKjsv59`. Assinatura Stripe: produto "Callface Enterprise - 7000 minutos", quantidade=2, ativa desde 2026-02-18.

**Faturas Stripe reais (idênticas em HOMOLOG/PROD, todas `origem=stripe`, formato `in_...` válido, pagas):**
| competência | valor | pago em |
|---|---|---|
| 2026-02 | R$2.799,90 | 18/02 |
| 2026-03 | R$2.799,90 | 21/03 |
| 2026-04 | R$2.799,90 | 21/04 |
| 2026-05 | R$2.799,90 | 28/05 |
| 2026-06 | R$2.932,95 | 18/06 |
| 2026-07 | R$2.835,40 | 18/07 |

**Validação da hipótese "WEVY, não Stripe":** o arquivo `PLANO 2026(FATURAMENTO).csv` (faturamento WEVY de maio/2026) tem uma linha `AUVO TECNOLOGIA S.A. | Pré-Pago | R$ 2.799,90` datada de 29/05/2026 — mesmo valor da fatura Stripe paga em 28/05/2026 (1 dia de defasagem, típico de reconciliação). **Conclusão: não é cobrança duplicada.** É a mesma transação Stripe vista por dois sistemas — a Zoho tem inclusive um campo nativo "Origem Wevy (ID)" em Propostas, confirmando que WEVY é a entidade/grupo que opera a cobrança *via* Stripe, não um canal concorrente. Achado original ("faturado pela WEVY, não pelo Stripe") está **invalidado** — é WEVY *através de* Stripe, não WEVY *em vez de* Stripe.

**MRR real atual AUVO:** ~R$2.799,90–2.932,95/mês, família **CALLFACE_AI**, billing_source **Stripe** (sob a entidade WEVY). Carteira em HOMOLOG/PROD já reflete isso corretamente (contrato ativo único, mrr≈2889.80). Sem bug tipo G30 aqui.

**Duplicidade de identidade Vandressa — CONFIRMED (não merge):**
Zoho `Contacts_001.csv` tem 2 registros: "Vandressa **da Luz Maciel**" (zoho `5938068000018091010`, email pessoal `vandressaluz@gmail.com`, criado 2025-04-14) e "Vandressa **Maciel**" (zoho `5938068000018941136`, email corporativo `vandressa.luz@auvo.com.br`, criado 2025-05-27) — **mesmo telefone** `(45) 99938-3015`, **mesma empresa** (AUVO). Ambos sobrevivem como 2 `leads` separados em HOMOLOG (`865bcaa1...` e `f89656ae...`). **Confidence: CONFIRMED** (telefone + empresa + sobrenome coincidem) que é a mesma pessoa, com registro duplicado não mesclado desde a origem no Zoho — não recomendo merge automático, só flag para higienização manual.

---

## 2. CENTERVAL — CONFIRMED "Delivery AI" foi erro humano; e um GAP maior: contrato real de 2026 nunca migrado

**Empresa:** Centerval (homolog id `6e090bc5-1b75-468c-910c-40e33615e467`, zoho `5938068000005477001`, CNPJ `60.199.957/0007-26` = **Centerval Industrial LTDA**).

**3 negócios em HOMOLOG/PROD (idênticos):**
1. `CENTERVAL | CONTRATO INICIAL` — Ganho 2021-01-05 (migrado em lote 2024-07-22), R$3.492,41. **Sem contrato nativo, sem `contratos` row no CRM** — este MRR nunca entrou na carteira.
2. `CENTERVAL | 02 AP | CINTHIA` — Perdido, R$80 (locação de aparelhos). Sem impacto.
3. `CETERVAL | LOCAÇÃO 5 APARELHOS | JÉSSICA` — Perdido, R$200. Sem impacto.

**Achado crítico — recovery gap, não presente em HOMOLOG nem PROD:** existe uma 4ª oportunidade no Zoho que **não foi migrada**: `CENTERVAL | RENOVAÇÃO DE CONTRATO | MAYARA` (zoho `5938068000032602210`), criada 2026-04-29, Ganho ("Concluído") em 2026-05-14/15. Upgrade: 70 ramais, 46 linhas, 2.500 min nacional fixo/móvel, upgrade para 16 canais simultâneos, ligações internacionais liberadas (Europa/EUA, cobrança por uso). Itens da proposta (`Itens Cotados`) todos com **Recorrência=Mensal**: R$2.581 (base 8 canais) + R$270,37 (upgrade 16 canais) + R$0 (add-on internacional usage-based) = **R$2.851,37/mês real**. Existe contrato nativo Zoho `CT - 285 - 05/2026`, Total Geral R$2.851,37, prazo 24 meses, multa 30%.

**Stage History confirma a origem do erro "Delivery AI":** a oportunidade passou por `Ganho` (15:29:33) → **`Delivery AI` (15:31:47, durou 2 minutos)** → `Delivery PABX` (15:32:17) → `Faturamento` → `Concluído` (2026-08-06). Ou seja, "Delivery AI" foi um clique de workflow corrigido em 2 minutos pelo mesmo operador — **CONFIRMED erro humano de operação, não fato comercial.** A classificação correta e final do próprio Zoho já é `Delivery PABX`.

**Classificação:** `service_family = PABX` (Yeastar-like, ramais/linhas/canais SIP, não é produto CALLFACE_AI). `billing_source`: sem `stripe_customer_id` cadastrado; arquivo WEVY de maio/2026 tem 3 linhas para CNPJs do grupo Centerval — a que bate com o CNPJ da empresa no CRM (`60.199.957/0007-26`) é `CENTERVAL INDUSTRIAL LTDA | Contrato | R$ 2.521,48` (mesma competência, valor próximo — diferença provavelmente por ajuste no add-on internacional usage-based). Suporta billing via **WEVY/manual**, não Stripe.

**MRR real vs mostrado:** mostrado na carteira HOMOLOG/PROD hoje = **R$0** (nenhum `contratos` row para Centerval). MRR real estimado = **R$2.851,37/mês** (ou ~R$2.521,48 pelo valor efetivamente faturado via WEVY em maio/2026). **Gap de subcontagem, não de fantasma** — o oposto do padrão G30. Sem o bug de `mrr=total_geral` porque aqui o Total Geral já É recorrência real (todos os itens são Mensal) — mas o contrato nem chegou a ser recuperado.

**Confidence: CONFIRMED** para a origem do "Delivery AI" (evidência direta do Stage History). **CONFIRMED** para o gap de migração (comparação direta CSV Zoho vs HOMOLOG/PROD, zero linhas).

---

## 3. VETLOG — CONFIRMED churn, sem bug de MRR fantasma (dumps antigos estavam obsoletos)

**Empresa:** Vetlog Distribuidora (homolog id `8548deef-768d-4b7f-a2f2-0b42d55d2d25`, zoho `5938068000002881001`).

**Dumps antigos (`VETLOG.txt` em `dumps/` e `pgstate/`)** só tinham a oportunidade original (`VETLOG | CONTRATO INICIAL | CINTHIA CUNHA`, ganho 2023-01-13, R$919,29) — **estavam desatualizados**: não capturavam a 2ª oportunidade `VETLOG | CHURN` (zoho `5938068000032802081`, criada 2026-05-04).

**Estado atual (pós-recovery, confirmado em HOMOLOG e PROD hoje):**
- `negocios`: só o registro original (`4b3dbc45...`), status **permanece `ganho`** (correto, conforme regra — nunca reescrever Won histórico).
- `contratos`: **0 rows** para Vetlog (nunca existiu contrato nativo formal no CRM).
- **`eventos_comerciais` em HOMOLOG tem o registro do churn** (ausente em PROD, que ainda não recebeu essa tabela/migração): `tipo=churn`, `ocorrido_em=2026-05-04`, `negocio_id=4b3dbc45...`, `evidencia={"montante":0.0,"nome_zoho":"VETLOG | CHURN","stage_zoho":"concluído"}`. **Isso é exatamente o padrão correto**: churn registrado como evento separado, sem tocar o negócio Won original.

**Evidências cruzadas do valor e motivo do churn:**
- Nota Zoho na oportunidade CHURN: "CHURN SEM AVISO PRÉVIO. DESLIGAR AMBIENTE" (2026-05-06) + itens de fatura final `CT-14356-13-01-2023`: R$861,66 + R$39,95 + R$102,72 = **R$1.004,33**.
- Arquivo WEVY `PLANO 2026(FATURAMENTO).csv`: 3 linhas para "VETLOG DISTRIBUIDORA..." tipo "Contrato", datadas 07/05/2026, valores **R$39,95 / R$102,72 / R$861,66** — soma idêntica, mesma competência. Confirma billing via WEVY/manual (não Stripe: sem `stripe_customer_id`, 0 `faturas`/`assinaturas` no CRM).
- Planilha oficial `Churns Callface - PABX(Churns).csv`: linha "VETLOG DISTRIBUIDORA DE PRODUTOS PARA ANIMAIS LTDA | **CALL FACE - CLOUD/PABX** | 962 (jan) → 1.004 (fev-mai) → **"-" (jun)** | OBS=Churn". Confirma família **PABX** e churn efetivo em junho/2026 (billing zerado), com o processo administrativo (distrato assinado, "desligar ambiente") só concluído em 2026-08-06 — defasagem de ~2 meses entre parar de cobrar e fechar formalmente o processo no Zoho.

**Classificação:** `service_family=PABX`, `billing_source=WEVY/manual`. MRR real atual = **R$0 (churned, confirmado por 3 fontes independentes)**. MRR histórico não é R$919,29 (valor congelado de 2023) e sim ~R$1.004,33/mês nos últimos meses ativos (fev-mai/2026) — o `negocios.mrr_fechado` nunca foi atualizado para refletir reajustes, mas isso não gera fantasma porque não existe `contratos` row somado na carteira.

**Risco lateral (não é bug ativo, é alerta):** se qualquer relatório futuro somar `negocios.mrr_fechado` para `status='ganho'` sem excluir por `eventos_comerciais.tipo='churn'`, Vetlog (e outros clientes só com evento de churn, sem contrato) voltariam a aparecer como R$919,29/mês fantasma. A rota atual da carteira (soma `contratos.mrr`) está imune a isso porque não há contrato — mas é uma dependência implícita que vale documentar.

**Confidence: CONFIRMED** (4 fontes concordam: nota Zoho, WEVY file, planilha de churn oficial, eventos_comerciais).

---

## 4. White Labels (Zoho `Oportunidades de Vendas_001.csv`, 14 registros "WHITE LABEL"/"WHITELABEL")

| Empresa | Valor | Setup ou Recorrente | Contrato nativo Zoho | Recuperado em HOMOLOG? | MRR no HOMOLOG hoje | MRR real estimado | Confidence |
|---|---|---|---|---|---|---|---|
| **G30 Educação Automotiva** (já conhecido) | R$24.450 | Setup (reserva de licença, Recorrência="-") | CT-271-03/2026 | Sim, `mrr=24450` (bug) | R$24.450 (fantasma) | R$0 (é setup, não MRR) | **CONFIRMED** (baseline já documentado) |
| **MAB FIBRA** | R$89,90 | Recorrente (Mensal) | — | Sim, `perdido` | R$0 | R$0 (perdido, correto) | CONFIRMED |
| **Mauloni Comércio de Veículos** | R$58.940 | Recorrente (3 itens "Mensal" com valores alternativos 11990/19980/26970 — parecem tiers de cotação, não somados) | — | Sim, `perdido` | R$0 | R$0 (perdido, correto) | PROBABLE (proposta é rascunho com opções, não fechamento) |
| **Matte Tecnologia** — deal 1 (WHITE LABEL) | R$6.495 | Recorrente (Mensal) | CT-290-05/2026 | Sim, `tipo=legado_zoho`, `mrr=6495`, `status=ativo` | R$6.495 | ver abaixo | ver abaixo |
| **Matte Tecnologia** — deal 2 (UPGRADE) | R$6.495 | Recorrente (Mensal) | CT-297-06/2026 | Sim, `tipo=legado_zoho`, `mrr=6495`, `status=ativo` | R$6.495 | ver abaixo | ver abaixo |
| **Matte Tecnologia** — deal 3 (UPGRADE) | R$9.900 | Recorrente (Mensal) | CT-301-06/2026 | Sim, `tipo=legado_zoho`, `mrr=9900`, `status=ativo` | R$9.900 | ver abaixo | ver abaixo |
| **VERIFY / Ultraqualify** | R$12.990 | Recorrente (Mensal) | — | Sim, `perdido` | R$0 | R$0 (perdido, correto) | CONFIRMED |
| **Venda na Veia** — deal (Faturamento, 9093) | R$9.093 | Recorrente (Mensal) | CT-302-07/2026 | **NÃO** — sem negócio/contrato em HOMOLOG | R$0 | R$9.093 | CONFIRMED (gap) |
| **Venda na Veia** — deal (Closed Won, 18186) ×2 | R$18.186 (duplicado 2×) | Recorrente (Mensal, item não localizado) | — (sem proposta/contrato vinculado a nenhum dos 2) | **NÃO** | R$0 | Indeterminado — possível duplicata de digitação no próprio Zoho | **AMBIGUOUS** |
| **Broker Ia Sistemas** | R$6.495 | Recorrente (Mensal) | CT-308-07/2026 | **NÃO** — sem negócio/contrato em HOMOLOG | R$0 | R$6.495 | CONFIRMED (gap) |
| **Chat Envio** | R$2.598 | Recorrente (Mensal) | CT-307-07/2026 | Sim, `tipo=legado_zoho`, `mrr=2598`, `status=ativo` | R$2.598 | R$2.598 | **CONFIRMED, sem bug** |
| **Revolução de Vendas** ×2 (2598 cada) | R$2.598 (duplicado 2×) | Recorrente (Mensal, item não localizado) | — | **NÃO** | R$0 | Indeterminado | **AMBIGUOUS** (mesma empresa também tem deal base Callface AI R$179,90 via Stripe, separado, esse sim recuperado e correto) |

### Achados-chave desta seção

**a) O bug do G30 (mrr = valor de setup não-recorrente) é isolado a G30.** Nos demais White Labels recuperados, os itens Zoho estão corretamente tagueados `Recorrência=Mensal` e o `Total Geral` do contrato nativo bate com a soma dos itens mensais — ou seja, tecnicamente **não é o mesmo bug**. G30 continua sendo o único caso confirmado desse padrão específico entre os 14.

**b) Novo bug encontrado: MRR duplicado/empilhado em upgrades sucessivos (Matte Tecnologia).** Matte tem 3 contratos `legado_zoho` simultaneamente `status='ativo'` na carteira: R$6.495 (original) + R$6.495 (1º upgrade) + R$9.900 (2º upgrade) = **R$22.890/mês somados**, quando o real deveria ser só o último tier (**R$9.900/mês**, upgrade substitui, não empilha). Isso é uma inflação de carteira de **~R$12.990/mês** só nesta empresa — mecanismo diferente do G30 mas mesmo efeito (mrr fantasma). **Confidence: PROBABLE** (a lógica de "upgrade substitui" é inferência de negócio, não está explícita no schema — mas é o padrão comercial óbvio: ninguém paga 3 mensalidades por 3 upgrades sucessivos do mesmo serviço).

**c) Achado que exige validação com o time comercial, não só dado:** nenhuma fatura Stripe ou linha WEVY bate com os valores de White Label (6495/9900/2598/9093/24450) — só batem com os planos base pequenos ("Callface Copilot"/"Callface AI", R$179,90-R$539,70) das mesmas empresas. Isso sugere que **o valor do negócio White Label pode representar o preço de revenda do parceiro para os clientes finais dele, não a receita que a Callface efetivamente reconhece** — nesse caso, colocar esses valores em `contratos.mrr` e somar na carteira estaria conceitualmente errado independente de bug técnico. **Confidence: AMBIGUOUS/UNRESOLVED** — decisão de modelagem de negócio, recomendo checkpoint com Kauã/Mayara antes de qualquer correção de dado.

**d) Gap de migração (Venda na Veia deal de R$9.093 e Broker Ia R$6.495):** ambos têm contrato nativo Zoho pronto (CT-302, CT-308) mas nunca entraram em HOMOLOG/PROD — mesma classe de problema do CENTERVAL (subcontagem, oposto do G30).

**e) Duplicatas sem explicação nos dados (Venda na Veia R$18.186 ×2, Revolução R$2.598 ×2):** registros "Closed Won" gêmeos, sem proposta nem contrato nativo vinculado a nenhum dos dois, sem data de fechamento em pelo menos um dos pares. Pode ser erro de duplicação de clique no Zoho ou pode ser 2 sub-clientes distintos do próprio parceiro white-label (contratos separados dos clientes finais do parceiro). Dado disponível não permite decidir — **AMBIGUOUS**, precisa de alguém que conheça o caso (Mayara).

---

## Resumo de confidence por investigação

| Investigação | Confidence geral | Ação sugerida (não executada) |
|---|---|---|
| AUVO | CONFIRMED — sem MRR fantasma, hipótese WEVY≠Stripe invalidada | Higienizar duplicidade Vandressa manualmente |
| CENTERVAL | CONFIRMED "Delivery AI"=erro humano; CONFIRMED gap de migração | Migrar oportunidade de renovação 2026 (zoho 5938068000032602210) para HOMOLOG |
| VETLOG | CONFIRMED churn, sem bug de MRR | Nenhuma correção de dado necessária; só propagar `eventos_comerciais` pra PROD |
| White Labels | G30 CONFIRMED (já sabido); Matte PROBABLE (bug novo de empilhamento); Venda na Veia/Broker Ia CONFIRMED (gap); duplicatas AMBIGUOUS; modelo de negócio White Label UNRESOLVED | Checkpoint de negócio antes de tocar `contratos.mrr` de qualquer White Label |
