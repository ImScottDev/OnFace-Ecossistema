# Reconciliação Semântica, Comercial e Financeira do Legado — Relatório

> READ ONLY em toda a execução: nenhuma escrita em PROD, HOMOLOG ou Stripe. Nenhuma correção implementada. Este documento é diagnóstico — a implementação é missão separada, após validação do Kauã.

---

## 1. Executive Summary

A carteira/MRR mostrada hoje mistura pelo menos 5 fenômenos diferentes que nunca deveriam ter sido somados na mesma conta:

1. **MRR real recorrente confirmado** (Stripe ativo, PROD): R$52.845,95/mês.
2. **MRR duplicado ativo em PROD** por causa raiz de sync não corrigida em produção (apesar de um fix existir no repo local): **R$25.544,10/mês** somados em duplicidade — 39 pares pelo padrão já conhecido (mesmo `stripe_subscription_id`) + 18 leads/38 contratos de um padrão relacionado (contrato órfão de proposta aceita nunca reconciliado com a assinatura real).
3. **MRR fantasma introduzido pelo recovery desta sessão em HOMOLOG**: R$318.974,20 em 263 contratos com `tipo='legado_zoho'`, dos quais pelo menos R$202.505 são claramente Total-Geral-do-contrato (setup/projeto/reserva de licença) sendo tratado como se fosse mensalidade — o mesmo padrão do caso G30.
4. **Receita real correndo fora do radar do CRM**: 15 subscriptions Stripe ativas (R$7.854,85/mês) sem nenhum registro em `assinaturas`/`contratos`; e ao menos 1 caso confirmado de subcontagem (Centerval, ~R$2.851/mês reais que nunca migraram e hoje aparecem como R$0).
5. **O maior número de toda a auditoria, e o mais preocupante**: cruzando as 3 planilhas de faturamento da WEVY contra o CRM, **175 empresas com contrato PABX real e ativo na WEVY (R$361.040,14/mês) têm cadastro de empresa no CRM mas ZERO contrato associado** — nem em PROD, nem em HOMOLOG. Esse valor é maior que toda a carteira PROD atual somada ao MRR real do Stripe. Não é um bug de classificação, é ausência total de dado — o PABX simplesmente nunca entrou no CRM pra essas empresas.

Nenhum desses 5 fenômenos deveria estar na mesma métrica. O número de carteira que qualquer pessoa vê hoje (R$121.270,97 em PROD, R$421.806,27 em HOMOLOG) é uma mistura de 4 deles e ainda ignora completamente o 5º — que é maior que os outros 4 juntos.

---

## 2. Current Portfolio

| Fonte | MRR mostrado | O que realmente é |
|---|---:|---|
| PROD — `contratos.mrr` WHERE status='ativo' (query real de `carteira.ts`) | R$121.270,97 (224 contratos, 145 clientes) | Mistura MRR real + duplicidade Stripe (R$25.544,10) + contratos órfãos nunca reconciliados |
| Stripe — subscriptions com status ativo/trialing (GET direto na API, fonte financeira mais confiável para o que É faturado pelo Stripe) | R$52.845,95 | O recorrente real, mas só cobre o que passa pelo Stripe — não inclui PABX/WEVY |
| HOMOLOG — mesma query pós-recovery | R$421.806,27 (448 contratos, 268 clientes) | PROD + tudo que o Batch 2 desta sessão recuperou, incluindo R$318.974,20 de contratos `legado_zoho` não reclassificados |
| HOMOLOG — só produto='ai' (exclui os 263 legado_zoho não classificados) | R$102.832,07 | Mais próximo do real de AI, mas ainda contaminado pela duplicidade Stripe não limpa em PROD (homolog já teve 39 pares limpos numa reconciliação anterior) |

**Por família de produto**: não é possível hoje dar um número confiável de "MRR PABX" separado de "MRR CALLFACE_AI" a partir do schema atual — `contratos.produto` só tem os valores `ai` ou vazio; nenhum contrato em PROD ou nos 263 `legado_zoho` de HOMOLOG está marcado `pabx`. A classificação de família precisa vir do catálogo de itens (Etapa B, ver seção 8) cruzado contrato a contrato — trabalho de reconciliação fina ainda não fechado (ver seção 11).

**Por billing source**: Stripe = R$52.845,95 confirmado. WEVY = seção 7 (pendente). Manual/desconhecido = resto, não quantificável com confiança hoje.

---

## 3. Principais erros encontrados (por impacto financeiro)

| # | Erro | Impacto R$/mês | Confiança | Onde |
|---|---|---:|---|---|
| 1 | Contratos `legado_zoho` do recovery desta sessão com `mrr` = Total Geral do contrato Zoho, não recorrência real | ~R$202.505 (subconjunto validável) de R$318.974,20 total | CONFIRMED | HOMOLOG, `contratos` |
| 2 | Duplicidade Stripe por mesmo `stripe_subscription_id` — causa raiz nunca deployada em produção | R$18.438,90 | CONFIRMED | PROD |
| 3 | Contratos órfãos de proposta aceita nunca reconciliados com a assinatura Stripe real (padrão G30) | R$7.105,20 (mínimo) | CONFIRMED | PROD |
| 4 | 15 subscriptions Stripe ativas sem nenhum registro no CRM | R$7.854,85 | CONFIRMED | PROD/Stripe |
| 5 | Matte Tecnologia: 3 contratos White Label simultâneos ativos, deveria ser só o último upgrade | ~R$12.990 | PROBABLE | PROD |
| 6 | Centerval: renovação real nunca migrada, carteira mostra R$0 quando deveria mostrar ~R$2.851 | R$2.851 (subcontagem, sentido contrário) | CONFIRMED | HOMOLOG/PROD |
| 7 | 88 contratos `legado_zoho` sem `negocio_id` vinculado, MRR não validável de forma nenhuma | R$71.384,13 (risco, não erro confirmado) | UNRESOLVED | HOMOLOG |

---

## 4. G30 — Conclusão completa

**Empresa**: G30 Educação Automotiva (CNPJ 55.617.458/0001-86, zoho_id empresa 5938068000030426001).

**5 Oportunidades Zoho, decompostas corretamente**:

| Oportunidade | Valor | Stage | O que é | Deve virar MRR? |
|---|---:|---|---|---|
| G30 EDUCAÇÃO AUTOMOTIVA \| CALLFACE AI \| MAYARA \| STRIPE | R$1.619,10 | Closed Won (11/03) | Venda AI original, item "Cold Call" Recorrência=Mensal | Sim — histórica, superada depois pelo upgrade |
| GRUPO G30 \| WHITE LABEL \| MAYARA \| STRIPE | R$24.450,00 | Closed Won (12/03) | Contrato CT-271, "PACOTE STARTER DE RESERVA DE LICENÇA WHITE LABEL" (300 licenças reservadas), nota Zoho explícita: "GERAR SETUP R$24.450 PARCELADO EM 4X" | **Não.** É setup/projeto parcelado, não mensalidade. 300 licenças reservadas ≠ licenças ativas cobrando |
| G30 \| CALLFACE AI UPGRADE \| MAYARA \| STRIPE | R$1.079,40 | Closed Lost (15/06) | Upgrade proposto e perdido | Não — Lost nunca vira MRR |
| G30 \| UPGRADE CALLFACE AI \| MAYARA (x2, quase idênticas) | R$1.439,20 cada | Closed Won (20/07) | Upgrade efetivado — as 2 oportunidades quase idênticas são o mesmo evento capturado 2x pelo fluxo/reverse-sync do Zoho, não 2 upgrades reais | Sim, mas contar UMA vez só |

**Hipótese do Kauã, validada com evidência real do Stripe**: 1.619,10 + 1.439,20 = **3.058,30** — e o PROD tem hoje, de fato, uma subscription Stripe real (`sub_1TvKh2Ed4dqxpSBf5kEVBeHD`) com `mrr=3058.30`, e a subscription original (`sub_1TMVocEd4dqxpSBfLRxEyy1Z`, R$1.619,10) está `churned` — ou seja, o Stripe já fez a consolidação certa: uma assinatura substituiu a outra, valor final R$3.058,30/mês. **Confirmado, não é mais hipótese.**

**O bug real**: existe um TERCEIRO contrato em PROD (`688f5bbd...`, tipo="Callface AI - Full", mrr=1.439,20, sem `stripe_subscription_id`, vinculado ao negócio do upgrade) que nunca foi conciliado com a subscription real — se a carteira somar os 3 contratos ativos (1.439,20 + 3.058,30 + o legado 24.450,00 do White Label), o excesso é de R$1.439,20 (duplicata) + R$24.450,00 (fantasma) = **R$25.889,20** de MRR errado só nesta empresa.

**Confidence**: CONFIRMED em todos os pontos — evidência cruzada entre Zoho raw, HOMOLOG, PROD e Stripe real.

---

## 5. AUVO / VETLOG / CENTERVAL / White Label

*(Investigação completa e independente; relatório integral em `docs/reconstruction/auditoria-semantica/artefatos/regressao-auvo-centerval-vetlog-whitelabels.md`)*

**AUVO — CONFIRMED, sem MRR fantasma.** Assinatura Stripe real (~R$2.799,90–2.932,95/mês, CALLFACE_AI) com 6 faturas pagas confirmadas. A hipótese "Callface AI faturado pela WEVY em vez do Stripe" foi **invalidada com evidência**: o valor na planilha WEVY é a mesma transação Stripe vista pelo sistema do grupo (o próprio Zoho tem campo nativo "Origem Wevy (ID)" apontando pra isso), não uma cobrança duplicada. Duplicidade de identidade "Vandressa da Luz Maciel" / "Vandressa Maciel": **CONFIRMED** mesma pessoa (mesmo telefone, mesma empresa, 2 leads nunca mesclados desde a origem no Zoho) — recomendo flag manual, sem merge automático.

**CENTERVAL — CONFIRMED.** "Delivery AI" no Stage History foi erro humano de 2 minutos de workflow (Ganho→Delivery AI→Delivery PABX na mesma sessão de uso do Zoho) — família correta é **PABX** (Yeastar, ~70 ramais/46 linhas/16 canais). Achado extra e mais importante: a renovação 2026 (contrato nativo CT-285-05/2026, ~R$2.851,37/mês real) **nunca foi migrada** pra HOMOLOG nem PROD — a carteira mostra R$0 pra Centerval hoje, quando devia mostrar ~R$2.851/mês. É o erro inverso do G30 (subcontagem, não MRR fantasma).

**VETLOG — CONFIRMED churn.** Família PABX confirmada por 3 fontes independentes (nota Zoho, planilha WEVY histórica, planilha oficial de churns). Negócio original permanece "ganho" (correto — Oportunidade Won histórica não se altera), o churn está registrado como evento comercial separado, mas **só em HOMOLOG** (ausente em PROD). MRR real atual: R$0 (churnou em junho/2026).

**White Labels — misto, achado novo de alto impacto.** G30 é só um dos casos. **Matte Tecnologia** tem 3 contratos simultâneos `ativo` na carteira somando R$22.890/mês (6.495+6.495+9.900) quando o real deveria ser só o último upgrade (R$9.900/mês) — mesma classe de bug do G30, mas por duplicação de upgrade, não por setup-como-MRR (PROBABLE). Venda na Veia (R$9.093/mês) e Broker IA (R$6.495/mês) têm contrato nativo Zoho pronto que nunca foi migrado — gap CONFIRMED. Chat Envio está correto (R$2.598/mês). Há 2 duplicatas sem explicação nos dados disponíveis (Venda na Veia R$18.186×2, Revolução R$2.598×2) — AMBIGUOUS, precisa de alguém do time comercial pra decidir, não é resolvível só com dado.

**Achado estrutural mais importante da seção White Label**: nenhum valor White Label bate com Stripe ou WEVY reais — só os planos base pequenos batem. Isso sugere que o valor White Label registrado pode ser o preço de **revenda do parceiro** pro cliente final, não a receita própria da Callface. **UNRESOLVED — é decisão de modelo de negócio, não bug de dado.** Precisa de confirmação do Kauã antes de decidir o que "MRR White Label" deveria significar na carteira.

---

## 6. Stripe — qualidade do matching e principais gaps

*(100% leitura via API Stripe — GET only — e cruzamento com PROD; artefato completo em `docs/reconstruction/auditoria-semantica/artefatos/stripe-reconciliation.csv`)*

- **311 Customers, 286 Subscriptions** (active 133, past_due 13, canceled 99, incomplete 2, incomplete_expired 29, unpaid 10, trialing 0), **52 Products, 51 Prices ativos**.
- **MRR ativo real no Stripe: R$52.845,95.**
- **Gap crítico**: 20 subscriptions Stripe sem nenhum vínculo no CRM (nem `assinaturas` nem `contratos`), das quais **15 ativas somando R$7.854,85/mês** — receita real correndo sem rastro nenhum no CRM (produtos: Callface Copilot, Callface AI Starter, SETUP BROKER IA).
- **0 contratos "fantasma"** no CRM (nenhum `stripe_subscription_id` gravado localmente que já não exista mais no Stripe) — o sync não está deixando lixo às cegas, ao menos nesse sentido.
- **Metadata `crm_*`**: 0 de 133 subscriptions ativas têm qualquer metadata apontando pro CRM — o vínculo hoje depende 100% do `stripe_subscription_id` salvo localmente, nunca de metadata no Stripe. Gap estrutural esperado (arquitetura futura deveria usar metadata estável, mas isso é implementação, não diagnóstico).
- **Identidade por email**: 28 de 311 customers (9%) têm email que não bate com nenhum lead do CRM — reportado como gap de dado, não como conclusão de identidade (quem paga a fatura pode ser diferente de quem negociou, regra seguida à risca).
- **past_due**: 13 subscriptions, R$4.033,60/mês em risco financeiro — tratado separado de churn comercial (é problema de cobrança, não confirmação de saída do cliente).

---

## 7. WEVY

*(Cruzamento das 3 planilhas — Faturamento, Contratos, Churns — contra HOMOLOG/PROD; artefato completo em `docs/reconstruction/auditoria-semantica/artefatos/wevy-reconciliation.csv`, 359 linhas)*

**359 empresas únicas nas 3 planilhas.** 254 (71%) encontradas no CRM — 192 por CNPJ exato (alta confiança), 24 por nome exato, 38 por fuzzy calibrado com stoplist manual (matando falsos positivos como sobrenome comum ou nome de cidade). **105 empresas (R$33.232,74/mês de faturamento real na WEVY) não existem em nenhuma base do CRM** — nem PROD, nem HOMOLOG.

**Achado estrutural mais grave de toda esta auditoria, em termos de R$**: das 210 empresas com faturamento real na WEVY (maio/2026) e encontradas no CRM, a soma é **R$378.659,62/mês** — mas só R$32.666,89/mês aparece como MRR ativo em `contratos` no PROD. **175 dessas 210 empresas (83%) têm o registro de empresa no CRM mas ZERO contrato associado**, nem em PROD nem em HOMOLOG. Isso é **R$361.040,14/mês de faturamento PABX real, comprovado pela WEVY, que o CRM simplesmente não vê — nenhum contrato, nenhum MRR, nenhuma carteira**. Esse número é maior que toda a carteira PROD atual (R$121.270,97) somada com o MRR real do Stripe (R$52.845,95).

**Regra WEVY confirmada em dado real**: "Pré-Pago" = CALLFACE_AI e "Contrato" = predominantemente PABX se sustentam nos dados cruzados, sem contradição encontrada.

**Churns WEVY**: das 20 empresas com `OBS=Churn` na planilha (histórico Jan-Jun/2026 — tratado como histórico, não como estado atual de agosto sem confirmação): 12 não existem no CRM, 5 existem sem contrato associado, e **6 têm gap real confirmado** — o contrato `legado_zoho` em HOMOLOG mostra `status='ativo'` com valor quase idêntico ao último faturamento WEVY antes do churn (ex: GBPA R$1.202,00 = R$1.202,00 exato), quando devia estar `churned`. Esse gap existe só em HOMOLOG — **zero contradição direta confirmada em PROD** (porque PROD nem tem o contrato, é o mesmo "não vemos nada" do achado acima).

**Recomendação direta desta seção**: antes de promover qualquer recovery de HOMOLOG para PROD, rodar uma passada de `status=churned` nos contratos legados usando a planilha de churn WEVY como fonte — senão o gap nasce em produção no dia da promoção, não só continua em homolog.

---

## 8. Produtos

*(Artefato completo: `docs/reconstruction/auditoria-semantica/artefatos/product-classification.csv` — 102 produtos distintos, 487 ocorrências no catálogo `Itens Solicitados_001.csv`)*

| Família | Produtos distintos | Ocorrências |
|---|---:|---:|
| PABX | 94 | 450 |
| CALLFACE_AI | 7 | 36 |
| WHITE_LABEL | 1 (mais 6 reclassificados por contexto) | 7 |
| UNKNOWN (família) | 0 | 0 |

Confidence: 90 CONFIRMED, 11 PROBABLE (default PABX sem token explícito no nome, ex. "MANUTENÇÃO SOLUÇÃO 3CX", "NOBREAK SLIM VIEW PRO"), 1 AMBIGUOUS.

**Achado da própria auditoria, corrigido em tempo real**: o classificador inicial usava o nome da Oportunidade (que pode empacotar PABX+AI no mesmo deal) como sinal antes da descrição do item — isso classificava errado planos PABX legado (`SMALL`, `MEDIUM + 1.500 MINUTOS`) como CALLFACE_AI só por estarem no mesmo deal que uma venda AI. Corrigido: sinal do próprio item tem prioridade; contexto do deal só é fallback quando o item não tem nenhum sinal próprio.

**Caso-regra confirmado em dado real**: `LICENÇA CALLFACE AI` com descrição "PACOTE STARTER DE RESERVA DE LICENÇA WHITE LABEL" na oportunidade "GRUPO G30 | WHITE LABEL" — exatamente a regra "contexto White Label vence o SKU", aplicada e funcionando.

Revenue nature (por ocorrência): MRR 437, UNKNOWN 25 (dado genuinamente ausente, não erro), USAGE 18, ONE_TIME 4, SETUP 2, PROJECT 1.

---

## 9. Ambiguidades

| Caso | Impacto R$/mês | Tipo |
|---|---:|---|
| Venda na Veia — 2 registros idênticos de R$18.186 | 18.186 (se for duplicata real) | AMBIGUOUS |
| Revolução — 2 registros idênticos de R$2.598 | 2.598 (se for duplicata real) | AMBIGUOUS |
| Valor White Label = preço de revenda do parceiro ou receita própria? | todo o segmento White Label | UNRESOLVED (decisão de negócio) |
| 3 pares órfão/real com valor muito diferente entre si (não G30) | não quantificado individualmente | PROBABLE, precisa checagem manual |
| 28 Stripe customers com email sem match no CRM | não quantificado em R$ | gap de dado, não identidade |

---

## 10. PROD vs HOMOLOG — por que a Carteira divergiu

Diff direto (`SUM(contratos.mrr) WHERE status='ativo'`, a mesma query que `carteira.ts` usa hoje):

| | Contratos ativos | Clientes | MRR total |
|---|---:|---:|---:|
| PROD | 224 | 145 | R$121.270,97 |
| HOMOLOG (pós-recovery) | 448 | 268 | R$421.806,27 |
| **Delta** | +224 | +123 | **+R$300.535,30** |

**Decomposição do delta**: R$318.974,20 vêm dos 263 contratos `tipo='legado_zoho'` criados pelo Batch 2 desta sessão (a maior parte é MRR fantasma — ver seção 3/4). O resto do delta é, na verdade, **negativo** — a parte "ai" de HOMOLOG (R$102.832,07) é MENOR que a de PROD (R$121.270,97, diferença ~R$18.438,90) porque HOMOLOG já teve os 39 pares duplicados por Stripe limpos numa reconciliação anterior, enquanto PROD ainda carrega essa duplicidade sem correção (confirma de forma independente o achado da seção 3, item 2 — os números batem exatamente: 143 contratos "assinatura" em PROD vs 104 em HOMOLOG = 39 a menos).

**Decomposição fina dos 263 contratos `legado_zoho` (R$318.974,20)**, cruzando com `negocios.mrr_fechado` (que o próprio recovery já calcula corretamente por negócio):

| Grupo | Qtd contratos | Soma `contratos.mrr` | Soma `negocios.mrr_fechado` | Leitura |
|---|---:|---:|---:|---|
| Com negócio vinculado, negócio diz MRR=0 (setup/reserva) | 122 | R$202.505,16 | R$0 | Fantasma confirmado — mesmo padrão do G30 |
| Sem negócio vinculado, não validável | 88 | R$71.384,13 | — | Risco não resolvido, precisa investigação caso a caso |
| Com negócio vinculado, negócio diz MRR>0 | 53 | R$45.084,91 | R$48.459,71 | Próximo (~7% de diferença) — provavelmente majoritariamente válido |

---

## 11. Correções propostas (SEM IMPLEMENTAR)

1. **Carteira não deve somar `contratos.mrr` cegamente.** Para os 263 contratos `legado_zoho`, usar `negocios.mrr_fechado` como fonte prioritária quando disponível (já calculado corretamente na maioria dos casos observados), e marcar como `revenue_nature` explícito (MRR/SETUP/PROJECT) em vez de um único campo `mrr` genérico — a raiz do bug é ter um único número fazendo o papel de "valor total" e "MRR" ao mesmo tempo.
2. **Deployar o fix de duplicidade Stripe em produção.** O fix existe no repositório local mas o arquivo real do servidor de produção nunca foi atualizado — é o item de maior confiança e maior impacto imediato (R$18.438,90/mês) de toda esta auditoria.
3. **Reconciliar o padrão "contrato órfão de proposta + assinatura Stripe real"** (G30, Matte Tecnologia e outros) — precisa de uma rotina que, ao detectar 2+ contratos ativos do mesmo lead/produto, prefira o que tem `stripe_subscription_id` real e aposente/marque como superado o órfão, preservando o histórico (não deletar, marcar como substituído).
4. **Vincular as 15 subscriptions Stripe órfãs** (R$7.854,85/mês) a um lead/empresa real — hoje é receita sem nenhuma amarração ao CRM.
5. **Migrar a renovação da Centerval e os contratos White Label prontos no Zoho mas nunca migrados** (Venda na Veia, Broker IA) — gap de subcontagem, oposto do bug G30, mas mesma causa raiz (recovery incompleto).
6. **Decidir o significado de "MRR White Label"** antes de qualquer correção de carteira nesse segmento — depende de uma decisão de negócio (preço de revenda vs receita própria), não é resolvível só com dado.
7. **Adaptar os scripts de recovery para idempotência** antes de qualquer reexecução (gap já registrado no relatório de go/no-go anterior, `08-RECOVERY-HOMOLOGACAO-RELATORIO-FINAL.md`).

---

## 12. Blockers restantes antes de PROD

- Fix de duplicidade Stripe nunca deployado em produção (item mais crítico, ver seção 11.2).
- 852 Quotes Zoho ainda não reconciliadas com propostas (herdado do recovery anterior).
- Idempotência dos scripts de recovery/migrations.
- Notes com tokens `crm[user#...]crm` sem resolução final.
- HTML bruto em notas (`<span>`, `<br>`).
- Autores exibidos como "Sistema"/"Growth backup" em vez de pessoa real.
- Página de contato com erro `Cannot read properties of null (reading 'replace')` (caso MegaVig/Reginaldo).
- Identidade de pessoas com múltiplos pontos de contato (Vandressa AUVO confirmado; outros casos prováveis não mapeados).
- Oportunidades perdidas sem proposta/contexto visível.
- Timeline com estados históricos duplicados/misturados.
- QA completo da Carteira antes de expor o número pra qualquer decisão de negócio.
- Backup do diretório de anexos legados (`public/uploads/legado-zoho/`, 1,1GB, sem rotina de backup hoje).
- Decisão de negócio sobre o significado de MRR White Label (seção 5/9).

---

## 13. Próxima ação recomendada

Uma única sequência, na ordem:

1. **Deployar o fix de duplicidade Stripe em produção** — maior impacto, menor risco, já está escrito e testado no repo, só falta chegar ao servidor real.
2. **Corrigir em HOMOLOG (não em PROD ainda)** os 263 contratos `legado_zoho`: recalcular `mrr` usando `negocios.mrr_fechado` como fonte prioritária, preencher `produto` (ai/pabx) usando a matriz de classificação da seção 8, e renomear `tipo='legado_zoho'` para o `service_family` real — mantendo `zoho_id`/proveniência em campo separado, nunca como substituto de tipo.
3. **Validar os casos de regressão corrigidos** (G30, Matte Tecnologia, Centerval, Venda na Veia, Broker IA) manualmente antes de considerar a correção geral aprovada.
4. Só depois disso, repetir a reconciliação de carteira PROD vs HOMOLOG vs Stripe e confirmar que o número converge.
5. Então, e só então, replanejar o mesmo tipo de correção para produção, com aprovação explícita a cada passo.
