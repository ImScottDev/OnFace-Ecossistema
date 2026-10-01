# 12 — GAP REGISTER (P0 / P1 / P2 / P3)

Severidade por IMPACTO CONCRETO, não por rótulo. Regra da auditoria: cada gap é REGISTRADO, não corrigido.

## P0 — impede operação ou integridade
| # | Gap | Impacto concreto | Evidência | Ação (não executada) |
|---|---|---|---|---|
| P0-1 | **Assinatura de contrato sem prova** | 745/746 contratos, `signature_*` NULL; **em PRODUÇÃO a coluna `assinado_em` nem existe** (confirmado na captura remota); 178 ZohoSign assinados sem registro. Risco jurídico: não se prova que um contrato foi assinado | entregável 18, 09, 05 | Backfill determinístico ZohoSign (158 matches) + ligar Documenso; adicionar campos de assinatura ao schema de produção quando virar |
| ~~P0-2~~ → **P2-9** | **Perda de dado era LOCAL, não de produção** | RESOLVIDO pela captura remota: produção não tem `_migracoes_aplicadas` — roda o schema legado, nunca teve o canônico. As perdas (cliente_receita_mensal, fulfillments, cs_*) são do experimento de carga LOCAL, não de produção. Rebaixado a P2 (higiene do ambiente de ensaio) | entregável 09 (rodada 1) | Nenhuma ação em produção. Rodada 2 confirma contagens do schema legado |
| ~~P0-3~~ → **P1-10** | **`empresas` corrompida — mas SÓ no banco LOCAL** | 877 registros de texto livre criados pelo job local; **produção tem 2222 empresas limpas** (captura remota). Não afeta produção; afeta o experimento canônico que virará produção | entregável 04 §C1, 09 | Corrigir o job de normalização ANTES da virada; não tocar produção |

## P1 — impede jornada crítica ou conclusão do produto
| # | Gap | Impacto | Evidência |
|---|---|---|---|
| P1-1 | **Proxy /api do redesign morto** | 53 de 72 telas do redesign inoperantes; produto não funciona ponta a ponta no ambiente do redesign | 03 §0.1 |
| P1-2 | **Backend do redesign não implantado** | 19 rotas Hono (Clientes/CS/Atendimento/Automações) só no redesign; produção não as tem | 03 §3.7 |
| P1-3 | **Virada canônica inacabada** | dual-write vivo, escrita primária no legado; MRR 6 respostas; "cliente" 4 respostas | 02, 04 §E |
| P1-4 | **MRR inflado por duplicação** | 101 subs Stripe = 2 contratos = R$62.822 contado em dobro | 04 §E |
| P1-5 | **Regressões de UI** | Carteira, sequências e-mail, contratos lista/detalhe sem tela | 03 §2, 08-A |
| P1-6 | **Impersonação: cookie honrado sem UI** | `mcrm-view-as` residual mantém impersonação invisível/irreversível | 03 §2.4 |
| P1-7 | **5 telas /pos-venda em 500 sem auth** | crash + ausência de gate de sessão | 03 §0.2 |
| P1-8 | **47 commits só no disco local** | todo o redesign + virada dev remoto fora de qualquer remoto | baseline #2 |
| P1-9 | **Financeiro órfão na navegação** | tela funcional inalcançável pela casca | 03 §3.1 |

## P2 — inconsistência / retrabalho relevante
| # | Gap | Impacto |
|---|---|---|
| P2-1 | Isolamento de tenant procedural (127/208 escritas sem org no WHERE) | risco de vazamento se guard removido |
| P2-2 | RBAC cobre ~10/68 rotas | autorização inconsistente |
| P2-3 | Zero observabilidade de integração | falhas invisíveis (invoice 9d, lead 63d) |
| P2-4 | 4-5 motores de automação paralelos | manutenção e confusão |
| P2-5 | correction ledger 30.876 vs 434 materializados | sistema "acredita" ter corrigido dados ausentes |
| P2-6 | Lead Status/owner achatados na migração | qualificação e atribuição perdidas (recuperável) |
| P2-7 | Portfólio congelado em 16/08 | métricas defasadas 38 dias |
| P2-8 | 1 invoice.paid Stripe travado 9 dias | receita não reconciliada |

## P3 — dívida / qualidade futura
| # | Gap | Impacto |
|---|---|---|
| P3-1 | 30 packages stub + apps/* inexistente + arq:fronteiras quebrado | andaime morto |
| P3-2 | 29 tabelas ai_* vazias + rotas CRUD | infra sem uso |
| P3-3 | Filas placebo (conversion-sync, follow-up) | código morto |
| P3-4 | 4 cascas de UI + componentes em 4 gerações | 91.666 LOC de UI concorrente |
| P3-5 | worker monolítico 4.260 linhas, 1 teste | manutenção |
| P3-6 | typescript.ignoreBuildErrors, 3 lockfiles, tsconfig versionado, senha dev em claro, wuzapi:latest | higiene |
| P3-7 | prazo_meses/codigo_legado/vínculos empresa recuperáveis do CSV Zoho | dívida de lineage |

## Ordenação por evidência/impacto
P0-1 e P0-3 são acionáveis já (reparo determinístico). P0-2 e P1-1/P1-2 são bloqueadores que dependem de decisão (captura remota + estratégia de deploy). O resto é sequenciável no entregável 17.
