# 08 — REGRESSION / LOST FEATURES MAP

Definição: funcionalidade que existiu (em produção/CRM legado/histórico do banco) e sumiu ou regrediu na versão ONFACE atual. Base: entregáveis 03, 18, 04.

## A. Regressões de CÓDIGO/UI (redesign perdeu tela que produção tem)
| Feature | Evidência produção | Estado no redesign | Gravidade |
|---|---|---|---|
| **Carteira por responsável** | `(crm)/carteira/page.tsx` 311 l. → `/api/carteira` | `/clientes/carteira` = ModuloPendente; endpoint sem consumidor | P1 |
| **Sequências de e-mail** | `(crm)/email/sequencias/page.tsx` 345 l. | nenhuma tela; tabelas email_sequencia* órfãs | P1 |
| **Contratos: lista + detalhe** | `(crm)/contratos/page.tsx` 260 + `[id]` 429 l. | redirect para TEMPLATES (outro objeto); nenhuma tela lista/abre contrato | P1 |
| **Impersonação (view-as) + troca de organização** | `CrmSidebar`+`ViewAsBanner` | UI removida; **cookie `mcrm-view-as` ainda honrado no backend** — impersonação residual invisível | P1 + risco de segurança |
| **Relatório Fechamento Comercial** | aba própria → `/api/relatorios/fechamento-comercial` | endpoint sem consumidor; substituto é recorte diferente | P2 |
| **WhatsApp: 5 capacidades** | conversations, status, mark-all-read, avatar, unread-count/badge | não migradas para `/atendimento` | P2 |
| **Agenda (profundidade)** | agenda 499 l. | calendário 153 l. | P2 (verificar) |
| **Enriquecimento de empresas em lote** | `POST /api/empresas/enrich-batch` | sem consumidor | P3 |

## B. Regressões de DADO (existia no banco em 20/09, sumiu no local de hoje) — PENDENTE confirmar em produção
| Dado | 20/09 (pre_carga) | Hoje (local) | Nota |
|---|---|---|---|
| `cliente_receita_mensal` | 12.917 (R$49mi) | **0** | base do número de faturamento de julho |
| `fulfillments` | 416 | 26 | implantações |
| `fulfillment_itens` | 24.797 | 1.729 | |
| `cs_marcos` | 2.114 | 0 | |
| `cs_riscos` | 396 | 0 | |
| `whatsapp_mensagens` | +12.739 | perdidas | re-sync com janela diferente |
| `event_outbox` (eventos reais) | 597 | 0 | trilha comercial 01-19/09 |
| `audit_log` | 762 | 22 reais | |
| `catalogo_precos` | 213 | 55 | |
⚠️ NÍVEL 2 (histórico): prova que o dado existiu em 20/09. **Se ocorreu em produção = P0**; se só na carga local = P2 operacional. **Só a captura remota (09) decide.**

## C. Regressões de LINHAGEM (perdido na migração Zoho→CRM)
| Feature | Perda | Gravidade |
|---|---|---|
| **Assinatura eletrônica** | 178 ZohoSign assinados → 0 no banco; signature_* NULL em 745 | **P0** (contrato sem prova de assinatura) |
| Lead Status | 100% achatado em 'novo' (2.677) | P2 (recuperável de campos_custom parcial) |
| Owner real | 38→16 usuários, fallback growth@ em 1.680 | P2 (recuperável de campos_custom) |
| Oportunidades | 141 perdidas na migração original (R$243.388) | P2 (decisão PO) |
| prazo_meses/codigo_legado contratos | 0/270 | P3 (recuperável do CSV) |
| Vínculo empresa↔negócio/proposta | 16-28% sem empresa_id | P2 (reparável por join) |

## D. NÃO são regressão (esclarecimentos)
- `inbox` de produção já era placeholder ("Inbox Lemlist") — não perdeu nada.
- Configurações: 14 telas migradas 1:1 — paridade, não perda.
- Deleções git prod→redesign (154): substituições arquiteturais (Next API→Hono, (crm)→(crm2)) — não perda de código.

## Regressão mais grave
**Assinatura de documento (C)** — P0 estrutural e reparável; e **as perdas de dado (B)** se confirmadas em produção seriam P0 de integridade. Ambas dependem de ação: backfill ZohoSign e captura remota.
