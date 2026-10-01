# 01 — SYSTEM REALITY MAP (visão consolidada)

O que o ONFACE REALMENTE é hoje, em uma página. Base: todos os entregáveis. Data: 23/09/2026.

## O que é
Um CRM full-stack (Next 16 + API Hono + worker BullMQ, Postgres, Redis) que evoluiu do CRM Callface legado (origem Zoho, cutoff 10/08/2026). Vive em um monorepo pnpm com 3 gerações de código coexistindo: **CRM 1 legado (`(crm)`)**, **CRM 2.0 canônico (`(crm2)` + api-server)**, e **pele ONFACE (redesign visual)**.

## Topologia real (confirmada por captura remota read-only)
- **Produção** (`crm.callface.io`, EC2, containers up 5-6 dias): **geração INTERMEDIÁRIA** — tem servicos_canonicos/fulfillments/billing/reconciliação/ai_sdr/automacoes, mas NÃO tem a camada canônica final (oportunidades/aquisicoes/pessoas/clientes/cs_*/domain_events) nem o runner `_migracoes_aplicadas`. O refactor CP1–CP63 nunca foi implantado. Operada pelo grupo `(crm)`. É o que o time usa e é INTOCÁVEL. Contagens reais: leads 4012, empresas 2222 (limpas), negocios 1584, contratos 746, faturas 984, fulfillments 27. Último audit 21/09.
- **Dev remoto** (`crm2-dev`, rebuild de hoje) e **local**: geração canônica completa (CP63), ainda não em produção.
- **Homolog**: stack separada, congelada há semanas.
- **Redesign** (branch `redesign/onface-ux-spec-v1`): 434 commits à frente de produção, 47 só no disco local. É onde o ONFACE está sendo construído.
- **Ambiente local**: híbrido — Next :3100 (redesign) + API/worker :3001/:3002 (CP63) + Postgres/Redis. Banco `callface_crm` recriado hoje, não é espelho fiel de produção.

## Como o dado flui
3 caminhos simultâneos (partição pelo Traefik, não pelo código): (A) browser→Hono (dominante); (B) browser→server component/action→banco (bloco vendas); (C) browser→route handler Next (allowlist: auth/webhooks/financeiro/onboarding/campanhas/contratos-publicos). Eventos via outbox transacional + sweep de 60s (espinha dorsal correta, funcionando).

## O que funciona (RUNTIME/HISTÓRICO provado)
- Núcleo comercial: aquisição→pré-vendas→pipeline→proposta→won (server actions + dado histórico).
- Integração Meta (madura, ciclo completo). Stripe (com 1 falha). WhatsApp/telefonia (com perda de histórico).
- Outbox + consumidores (materialização de serviço, handoff CS, CAPI).
- Operação real: 3 pessoas, ~200 negócios/mês — **na geração anterior, não no ONFACE**.

## O que está pela metade
- 53 de 72 telas do redesign inoperantes no runtime (proxy /api morto na porta errada).
- Backend de Clientes/CS/Atendimento/Automações (19 rotas Hono) não implantado em produção.
- Camada canônica completa mas escrita primária ainda no legado (dual-write; virada não executada).
- Cliente 360, CS, onboarding: código bom, dado/API faltando.

## O que não existe / não foi comprovado
- Plataforma de IA (29 de 31 tabelas vazias, 0 execuções de agente).
- Callface AI e Documenso (infra sem dado).
- 30 de 39 packages (stubs); `apps/*`; adaptador S3.
- Assinatura de documento em runtime (signature_* NULL em 745).

## O que regrediu / se perdeu
- UI: Carteira, sequências de e-mail, contratos lista/detalhe, impersonação.
- Linhagem: ZohoSign (178 assinados→0), Lead Status, owner real, 141 oportunidades.
- Dado local: cliente_receita_mensal, fulfillments, cs_* (pendente confirmar em produção).

## Fontes de verdade REAIS (de fato)
- Código canônico: branch `redesign/onface-ux-spec-v1` (mas produção não a roda).
- Dado: banco de PRODUÇÃO (não os locais, que são recriações/ensaios).
- Métrica: `metric_catalog` declara mas o dado dá 6 respostas de MRR.
- Linhagem: `zoho_id` + export Zoho em Downloads.

## Contradições estruturais
- "Concluído" na documentação vs telas inoperantes/placeholders (ver entregável 10).
- 6 respostas de MRR, 4 de "cliente".
- correction ledger vs dado materializado (30.876 vs 434).

## Riscos maiores
P0: assinatura de contrato sem prova; possível perda de dado em produção (a confirmar). P1: regressões de UI, isolamento de tenant procedural, virada canônica inacabada, 47 commits só no disco.
