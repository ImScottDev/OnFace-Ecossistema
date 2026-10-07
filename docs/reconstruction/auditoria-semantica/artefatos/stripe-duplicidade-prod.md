# Auditoria READ-ONLY — Duplicidade de contratos Stripe em PROD (callface_crm)

Data da auditoria: 2026-08-12. Todas as queries rodaram em `BEGIN READ ONLY; ...; COMMIT;` contra `callface-crm-postgres` em produção. Nenhum INSERT/UPDATE/DELETE/DDL foi executado.

## 0. Achado prévio decisivo: o fix "F4" NÃO está deployado em produção

```
ssh ... 'grep -n "contratoJaExistente\|F4 (09/08)" /opt/callface/crm/app/src/lib/integrations/stripe-sync.ts'
-> zero matches
ls -la /opt/callface/crm/app/src/lib/integrations/stripe-sync.ts
-> -rw-r--r-- 1 ubuntu ubuntu 19819 Aug  4 17:57 ...
```

O arquivo real em produção (`/opt/callface/crm/app/src/...`) é de **04/08**, não tem a checagem `contratoJaExistente` nem o comentário "F4 (09/08)". A versão com o fix (que eu li em `/Users/Scott/Documents/Scott Studio/callface-crm/app/src/lib/integrations/stripe-sync.ts`) só existe no repo local/dev — nunca foi implantada no servidor. Isso confirma o que o ADR de reconstrução já registrava: **produção continua gerando contrato duplicado hoje**, o "fix" só existe em homolog/dev.

## 1. Padrão 1 — mesmo `stripe_subscription_id` duplicado (causa raiz clássica)

```sql
SELECT stripe_subscription_id, count(*), array_agg(id), array_agg(mrr)
FROM contratos WHERE stripe_subscription_id IS NOT NULL
GROUP BY stripe_subscription_id HAVING count(*) > 1;
```

- **39 pares / 78 contratos** ativos, com o mesmo `stripe_subscription_id`, hoje em PROD.
- Distribuídos em **33 leads distintos** (alguns leads têm mais de um par duplicado).
- MRR duplicado (1 valor por par, já que os dois lados de cada par têm o mesmo mrr): **R$ 18.438,90/mês**.
- Esse número é **idêntico** ao "R$18.438,90/mês de MRR duplicado eliminado" que o time já reconciliou em **homologação**. Forte indício de que é o mesmo conjunto — produção nunca foi tocada, exatamente como o ADR documentava.

### Top 15 pares por valor (dos 39)

| stripe_subscription_id | mrr/par | created_at (1º / 2º contrato) |
|---|---|---|
| sub_1Tye9XEd4dqxpSBfiaIWgCcj | 2.857,80 | 29/07 20:32:37 / 20:32:52 |
| sub_1TyH38Ed4dqxpSBfpDSQEkZo | 2.248,50 | 28/07 20:41:20 / 20:41:31 |
| sub_1TxoSyEd4dqxpSBf5KgCXnTu | 1.259,30 | 27/07 14:10:44 / 14:11:00 |
| sub_1TyHjSEd4dqxpSBfKpHTAF9C | 1.169,30 | 28/07 21:41:19 / 21:41:35 |
| sub_1TyttEEd4dqxpSBfdxVQQZ9s | 809,50 | 30/07 13:20:49 / 13:21:11 |
| sub_1TydacEd4dqxpSBfuFy8LGqW | 809,50 | 29/07 21:11:37 / 21:11:53 |
| sub_1U1rztEd4dqxpSBfPteeJiRf | 629,90 | 07/08 17:56:29 / 18:44:52 |
| sub_1TyxtHEd4dqxpSBfUj66ZsUl | 629,90 | 30/07 18:11:56 / 18:12:15 |
| sub_1TyWy7Ed4dqxpSBfWgO0Y7fY | 629,90 | 29/07 12:52:21 / 12:52:40 |
| sub_1U0NL6Ed4dqxpSBf5VAi5Cdo | 539,70 | 03/08 14:59:41 / 15:00:05 |
| sub_1TycztEd4dqxpSBf0WdQTAOg | 539,70 | 29/07 20:21:40 / (heal 04/08 17:09) |
| sub_1U1VceEd4dqxpSBfLhhO2PFw | 539,70 | 06/08 18:02:50 / 18:44:34 |
| sub_1U0L2LEd4dqxpSBf5tl6EQDl | 449,70 | 03/08 13:13:18 / 13:13:36 |
| sub_1U1QkIEd4dqxpSBfgdnkAUTI | 359,80 | 06/08 12:50:22 / 13:44:29 |
| sub_1U13u4Ed4dqxpSBfCKhQ66HS | 269,90 | 05/08 12:26:38 / 12:26:57 |

**Subtotal top 15: R$ 13.742,10/mês.** Restam **24 pares** (mrr entre R$89,90 e R$359,80 cada) somando **R$ 4.696,80/mês**.

### O fix parou casos novos depois de 09/08? **NÃO.**

```sql
sum(CASE WHEN created_at_do_par(1º e 2º) ambos > '2026-08-09' THEN 1 ELSE 0 END)
```

- **1 par foi criado inteiramente depois de 09/08**: `sub_1U2w3nEd4dqxpSBfQgGhwNJN` (mrr 179,90), contratos criados em **10/08 16:28:42** e **11/08 06:31:25** — ambos depois da data do fix.
- Isso confirma o achado do ADR ("1 par novo criado 10-11/08, depois do que se pensava ser o fix") e bate com o achado do item 0: o fix nunca chegou ao código real de produção, então o bug continua ativo a cada nova venda por checkout Stripe.

## 2. Padrão 2 (novo, tipo G30) — contrato órfão sem `stripe_subscription_id` + contrato real com `stripe_subscription_id`, mesmo lead

Query: leads com 2+ contratos `status='ativo' AND produto='ai'`, filtrando os que têm pelo menos 1 contrato sem `stripe_subscription_id` e pelo menos 1 com (excluindo os já contados no Padrão 1, que exigem MESMO subscription_id repetido).

- **18 leads** afetados, **38 contratos** envolvidos (16 leads com 2 contratos, 2 leads com 3 contratos — um deles é exatamente o caso G30 citado na missão).
- **Zero overlap** de contrato entre Padrão 1 e Padrão 2 (verificado por JOIN nos ids) — os dois totais podem ser somados sem contar a mesma linha duas vezes.
- Estimativa conservadora de excesso (soma do menor valor de cada par/grupo, ou `sum(mrr) - max(mrr)` quando há 3 contratos no mesmo lead): **R$ 7.105,20/mês**.

### Casos de maior valor

| lead_id | contratos (tipo: mrr) | excesso estimado |
|---|---|---|
| 828cc87d-...-8f2 (**G30 Educação Automotiva**, caso citado na missão) | órfão sem sub: 1.439,20 / assinatura antiga sub_1TMVoc...: 1.619,10 / assinatura real atual sub_1TvKh2...: 3.058,30 | **3.058,30** |
| 1d3db0d5-...-2a10 | 539,70 / 539,70 | 539,70 |
| 0611c0d9-...-fcd | 359,60 / 359,60 | 359,60 |
| 67528f10-...-eb11 | 359,80 / 359,80 | 359,80 |
| 9aa33379-...-9156 | 3 contratos, todos 179,80 (1 órfão + 2 subscription_ids distintos) | 359,60 |
| 38e8cdea-...-67bc | 449,70 / 449,70 | 449,70 |
| 95e8551a-...-9b252 | 269,80 / 269,80 | 269,80 |
| 25ba01e5-...-5c63c | 359,60 (órfão) / 269,70 (real) | 269,70 |
| demais 10 leads | mrr entre 89,90 e 179,90 cada | soma ~2.438,10 |

Observação: 3 dos 18 casos (`66baf432`, `72b34b79`, `993c2af6`) têm o contrato órfão com valor **muito maior** que o real (899,50 vs 179,90 / 9.093,00 vs 179,90 / 719,60 vs 179,90) — provável downgrade de plano onde o contrato antigo nunca foi encerrado, não necessariamente o mesmo padrão "upgrade fundido" do G30. Tratados com a mesma regra conservadora (soma do menor), mas vale checagem manual antes de qualquer reconciliação.

## 3. Impacto financeiro total (sem dupla contagem)

| Padrão | Pares/leads | Contratos | MRR duplicado |
|---|---|---|---|
| 1 — mesmo `stripe_subscription_id` | 39 pares / 33 leads | 78 | R$ 18.438,90/mês |
| 2 — órfão sem sub_id + real com sub_id | 18 leads | 38 | R$ 7.105,20/mês |
| **Total (sem overlap confirmado)** | — | 116 | **R$ 25.544,10/mês** |

Isso é MRR que, se a Carteira/financeiro simplesmente somar `mrr` de todo contrato `status='ativo'`, está sendo contado 2x (ou 3x, no caso do G30 e do `9aa33379`) hoje em produção.

## 4. Conclusão sobre o fix F4

- F4 (checagem `contratoJaExistente` antes de criar contrato em `syncStripe()`) existe apenas no repo local/dev (`/Users/Scott/Documents/Scott Studio/callface-crm/app/src/...`), **não no servidor de produção** (`/opt/callface/crm/app/src/...`, arquivo de 04/08, sem a checagem).
- Por isso, mesmo o Padrão 1 (que o F4 deveria eliminar) continua gerando pares novos em produção — confirmado por 1 par 100% pós-09/08 (10-11/08).
- O Padrão 2 (órfão) é uma consequência relacionada mas distinta: quando um upgrade de proposta cria um contrato novo (sem `stripe_subscription_id`) e o Stripe depois consolida num único `subscription` com valor somado, o contrato antigo nunca é marcado como substituído/encerrado — ninguém reconcilia isso hoje, com ou sem o F4.
