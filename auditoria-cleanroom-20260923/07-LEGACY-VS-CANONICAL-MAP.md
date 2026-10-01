# 07 — LEGACY vs CANONICAL MAP

Objetivo: separar, por camada, o que é legado (a substituir/remover) do que é canônico (a manter e concluir). Base: entregáveis 02, 04.

## Modelo de dados
| Conceito | LEGADO | CANÔNICO | Escrita primária hoje | Situação |
|---|---|---|---|---|
| Pessoa | `leads` (usada pela UI) + `contatos` (inbox) | `pessoas` + `pontos_contato` | **legado** (`leads`) | dual-write vivo; canônico só leitura |
| Aquisição | `leads` | `aquisicoes` (espelho 1:1 estéril) | legado | canônico não agrega valor |
| Oportunidade | `negocios` (status lido por legado/financeiro/relatórios) | `oportunidades` | **legado** (`negocios`) | dual-write com deriva de valor |
| Empresa | `empresas` (mesma tabela; campo texto `leads.empresa` legado) | `empresas` | — | corrompida por normalização (877 lixo) |
| Serviço | `servicos_catalogo` (oferta) | `servicos_canonicos` (carteira) | ambos | conceitos distintos, ok |
| Evento | `vendas_eventos` (0), `eventos_comerciais` (247, órfão), `eventos` (0) | `domain_events` + `event_outbox` + `timeline_events` | canônico | legado morto no UNION |
| Anexo | `anexos_legado` (1.980 Zoho) | `file_objects`/`file_links` | canônico (disco) | legado read-only |

## Camada de aplicação
| LEGADO | CANÔNICO | Nota |
|---|---|---|
| `lib/crm/*` (serve Hono, 49 imports) | `lib/vendas/*` + packages @onface (serve Next) | ambos ativos; canônico é destino |
| grupo de rotas `(crm)` (22 redirects + 5 pos-venda) | `(crm2)` (82 páginas) | (crm) quase todo morto |
| `components/crm/` (40 arq., 44 importadores) | `components/crm2/` + `components/onface/` | crm ainda importado por (crm2)/layout |
| publicador `lib/events/outbox.ts` (best-effort) | `@onface/platform-events` (transacional) | dois coexistem |
| `isAdminView`/papel-string | RBAC `temPermissao` | RBAC cobre só ~10/68 |

## Motores de automação
- LEGADO ATIVO: cadência SDR inbound (`cadencia_execucoes` 1.306) — único com dado.
- CANÔNICO (vazio): cadence_definitions, automacoes (F5), email_sequencias.
- A unificação declarada não aconteceu.

## Cascas de UI
- CANÔNICA: `(crm2)` + casca `components/onface`.
- LEGADO/DESCARTÁVEL: `(crm)` redirects, `(onface-preview)`, `onface-desenho`, `estudio`.

## Linhagem de origem
- ÚNICA fonte legada real = **Zoho** (+ Stripe). Pipedrive não existe (colunas vazias). `zoho_id` é a chave de rastreio.

## Regra de canonicidade (para o Source of Truth Contract)
Canônico = camada `pessoas/aquisicoes/oportunidades/servicos_canonicos` + outbox + `(crm2)` + `lib/vendas`+packages. Legado a desligar = `leads/negocios/contatos` como escrita primária, `lib/crm` como dono de regra, `(crm)` inteiro, publicador best-effort, motores duplicados vazios. A virada (fases 25/26 declaradas no código) não foi executada.
