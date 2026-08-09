# Data Quality Layer — Relatório F6, gerado 09/08/2026 (banco LOCAL, mirror de produção)

Gerado por `npm run db:relatorio-data-quality` (`app/src/lib/crm/data-quality.ts`).
SÓ LEITURA. "CRM Data Health" é score simples (% checks com zero problema) — o objetivo real não é o número, é ONDE está o problema.

```
=== Data Quality Layer — Relatório (F6, só leitura) ===
--- Organização: Callface ---
CRM Data Health: 20%
⚠ Duplicate: 36 — Contratos ativos duplicados pela mesma assinatura Stripe (stripe_subscription_id repetido)
   amostra: {"stripe_subscription_id":"sub_1Tye9XEd4dqxpSBfiaIWgCcj","qtd":"2","mrr_total":"5715.60"}
⚠ Missing Owner: 54 — Leads (tipo='lead', ativos/qualificando) sem responsável — mesmo padrão do bug real de 03/08, este check monitora recorrência
   amostra: {"id":"8995dbc3-1890-4066-a8ec-c454123cb274","nome":"Helena","origem":"outbound","created_at":"2026-08-05 18:53:54.647357-03"}
⚠ Missing Source: 346 — Leads sem origem nem UTM (atribuição impossível de reconstruir)
   amostra: {"id":"af4b55ab-9af9-42b9-a585-1ee1d39d5544","nome":"Felipe","created_at":"2026-06-30 18:23:57-03"}
⚠ Invalid Contact: 3 — Leads tipo=cliente sem e-mail nem telefone (impossível contatar um cliente ativo)
   amostra: {"id":"efcb3b73-3746-4d4d-898c-f137b4a55d72","nome":"Contato — RIO PAX DO CENTRO","empresa":"RIO PAX DO CENTRO"}
⚠ Invalid Company: 25 — Empresas com contrato ativo mas sem CNPJ cadastrado (bloqueia nota fiscal)
   amostra: {"id":"0c296586-57de-4a45-8bcd-fdd2b3e058f1","nome":"Consignado"}
⚠ Inconsistent Stage: 251 — Negócios com status fora da config formal do pipeline (schema não tem enum/CHECK — pode ser status operacional real nunca formalizado, não necessariamente erro de dado)
   amostra: {"id":"2643ef37-aecb-403b-93f7-33c7bd0aa830","titulo":"Consignado - Novo negócio","status":"ativo"}
⚠ Invalid Amount: 2 — Contratos ativos com MRR zero ou negativo
   amostra: {"id":"bb4fa025-ede1-4ca7-8f51-8a8afdfbdea0","tipo":"servico","mrr":"0.00","valor_setup":null,"created_at":"2026-07-06 11:46:37.403866-03"}
✅ Orphan Deal: 0 — Negócios com negocio_origem_id apontando pra um negócio que não existe (campo sem FK real no schema)
✅ Missing Product: 0 — Contratos ativos com produto NULL (somem do filtro 'Callface AI' na aba Financeiro — achado real já documentado)
⚠ Financial mismatch: 1 — MRR em excesso (soma das linhas duplicadas por assinatura Stripe) — mesmo critério do achado original
   amostra: {"mrr_excesso":"R$17449.30"}
```

## Achados que merecem atenção
- **Missing Owner (54)**: mesmo padrão do bug real de 03/08 (18 leads sem responsável, corrigido na época) — voltou a acontecer e cresceu. Vale investigar se o fix daquela vez cobriu todos os pontos de criação de lead.
- **Inconsistent Stage (251)**: NÃO é necessariamente erro — são status reais (ativo, outra_data, sem_retorno, trava_negociacao, trava_assinatura) usados na operação mas nunca formalizados na config do pipeline. Decisão de formalizar ou não é operacional, não técnica.
- **Financial mismatch confirmado**: R$17.449,30, mesmo número do relatório de F4 — duas implementações independentes bateram no mesmo valor, boa validação cruzada.
