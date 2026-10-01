# 20 — OPERATIONAL REALITY (uso real, 7/30 dias)

Fonte: `callface_crm`, campos de tempo de negócio (não `created_at` reescrito pela carga). Fronteira: dado ≤22/09 ~22h = produção; 23/09 = máquina. Detalhamento completo em 04-DOMAIN-DATA-MODEL-AS-IS §F.

## Quem opera de verdade
**A operação real são 3 pessoas** (atividades/30d): Mayra Schincariol (closer, 1.730), Mayara Anjos (closer, 426), Jenifer Matos (gerente, 167). **9 de 16 usuários têm ZERO atividade histórica.** `Growth (backup)` = bucket de fallback (1.347 históricas, 0 recentes).

## Volume operacional real (mês)
~3.000 ligações, ~11.200 mensagens WhatsApp, 118 propostas criadas, 196 negócios criados, 58 ganhos, 18 contratos, 52 faturas emitidas. Movimentação de funil 30d: 262 novo, 103 reunião agendada, 89 desqualificado, 61 ganho.

## Existe no código × é usado na operação
| Capacidade | Código | Uso real |
|---|---|---|
| Pipeline, pré-vendas, propostas, contatos, ligação, WhatsApp, email | sim | **SIM** — é o dia a dia dos 3 operadores |
| Faturamento Stripe | sim | **SIM** — webhooks até 22/09 |
| Onboarding | sim | uso baixo (8 fulfillments/30d, todos ONBOARDING) |
| CS (risco/renovação/marcos) | sim | **NÃO** — cs_riscos/marcos/renovacoes = 0 local |
| Automações (4-5 motores) | sim | **quase nenhum** — só cadência SDR inbound (1.306), o resto 0 |
| IA/Agentes (ai-platform, AI SDR) | sim | **NÃO** — 0 runs, config desligada |
| Callface AI, Documenso, sequências e-mail, NPS, checkouts | sim | **NÃO** — 0 dado |
| Expansão, carteira, chamados, relatórios/biblioteca | placeholder | **NÃO** |

## Caminho pelo qual o time opera hoje
Produção roda o código de `prod-real-20260920` (grupo `(crm)` rico) — **não o redesign**. O redesign (:3100) é validado pelo dono, mas com proxy de API morto e sem sessão exercida. **Ou seja: a operação real acontece na geração anterior; o ONFACE ainda não é o produto em uso.**

## Telemetria ausente
Sem coluna `ultimo_login`, sem tabela de sessão. `auth_tokens` último uso 15/09. **Não há como medir login/engajamento pelo dado.**

## Sinais de saúde operacional (registrados, não corrigidos)
- 1 invoice.paid Stripe travado 9 dias.
- 1 lead Meta preso em staging 63 dias.
- Portfólio de serviços congelado em 16/08 (38 dias).
- Dias 12 e 19/09: só e-mail em lote, zero CRM.
