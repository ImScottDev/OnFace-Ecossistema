# Mapa do ONFACE: cada tela, o que ela consome

Gerado por análise estática: a partir de cada `page.tsx`, o analisador segue
import local por import local, junta tudo que aquele subgrafo toca, e só então
cruza com as tabelas que existem de verdade no banco de **produção**.
Não é leitura minha do código — é o que o código alcança.

## O tamanho do sistema

| | |
|---|---|
| Telas | **121** |
| Rotas de API | **96** |
| Server actions | **15** |
| Componentes | **316** |
| Módulos em `lib/` | **702** |
| Scripts | **163** |
| Jobs no worker | **34** |
| Tabelas no banco | **233** |
| Chaves estrangeiras | **595** |

## O diagnóstico em três números

- **54 das 121 telas** ainda tocam tabela legada.
- **11 telas usam SÓ legado**, sem nenhuma tabela canônica: quando o dual-write for desligado, elas param.
- **51 telas leem tabela vazia** — campo que nunca vai ter valor, ocupando espaço na tela.

## As 11 telas que morrem se o legado morrer

Prioridade de migração. Cada uma lê legado e nada do modelo canônico.

| Tela | Tabelas legadas | Arquivo |
|---|---|---|
| `/ajustes/ai-sdr` | `contatos` | `src/app/(produto)/ajustes/ai-sdr/page.tsx` |
| `/ajustes/email` | `leads` | `src/app/(produto)/ajustes/email/page.tsx` |
| `/ajustes/email/templates` | `leads` | `src/app/(produto)/ajustes/email/templates/page.tsx` |
| `/ajustes/membros` | `leads`, `negocios` | `src/app/(produto)/ajustes/membros/page.tsx` |
| `/ajustes/pipeline` | `negocios` | `src/app/(produto)/ajustes/pipeline/page.tsx` |
| `/ajustes/qualidade-dados/duplicidade` | `leads` | `src/app/(produto)/ajustes/qualidade-dados/duplicidade/page.tsx` |
| `/automacoes/campanhas/[id]` | `leads` | `src/app/(produto)/automacoes/campanhas/[id]/page.tsx` |
| `/automacoes/campanhas/nova` | `leads` | `src/app/(produto)/automacoes/campanhas/nova/page.tsx` |
| `/empresas/por-lead` | `leads` | `src/app/(produto)/empresas/por-lead/page.tsx` |
| `/perfil` | `leads` | `src/app/(produto)/perfil/page.tsx` |
| `/relatorios/performance` | `leads`, `negocios` | `src/app/(produto)/relatorios/performance/page.tsx` |

## Tabelas vazias que alguma tela lê

Campo que a tela mostra e que nunca terá valor. Ou preenche, ou esconde.

| Tabela | Telas que leem |
|---|---|
| `teams` | 39 |
| `whatsapp_sessao_acesso` | 38 |
| `whatsapp_supervisao` | 38 |
| `oportunidade_bundle` | 24 |
| `anexos` | 19 |
| `custom_fields` | 18 |
| `ai_provider_credentials` | 14 |
| `delegacoes_agente` | 14 |
| `nps_respostas` | 14 |
| `closer_bloqueios` | 13 |
| `ai_sdr_config` | 12 |
| `ai_contact_field_proposals` | 11 |
| `ai_memory_entries` | 11 |
| `ai_memory_pointers` | 11 |
| `ai_memory_versions` | 11 |
| `ai_skill_activations` | 11 |
| `ai_skill_pointers` | 11 |
| `ai_skill_versions` | 11 |
| `ai_usage_budgets` | 11 |
| `nexo_memoria` | 11 |
| `email_sequencia_execucoes` | 7 |
| `visoes_salvas` | 6 |
| `outreach_campanhas` | 4 |
| `eventos` | 4 |
| `lead_listas` | 4 |
| `cs_renovacoes` | 4 |
| `email_sequencia_passos` | 3 |
| `email_sequencias` | 3 |
| `buscas_salvas` | 3 |
| `outreach_campanha_destinatarios` | 3 |
| `ai_sdr_logs` | 2 |
| `eventos_comerciais` | 2 |
| `api_tokens` | 1 |
| `contato_listas` | 1 |

## Tabelas que NINGUÉM lê (55)

Nenhuma tela e nenhuma rota alcança estas tabelas. Candidatas a deleção —
confirmar antes se um script ou o worker as usa.

```
_bkp_ganhos_sem_empresa_20261008
_bkp_leads_enriquecimento_meta_20261008
_bkp_opps_ganhos_sem_empresa_20261008
_carga_contagem_antes
_consolidacao_email_contas_20261013
_enriquecimento_meta_20261013
_limpeza_quadros_20261013
_limpeza_quadros_20261013_leg_leads
_limpeza_quadros_20261013_leg_neg
_limpeza_quadros_20261013_leg_nl
_limpeza_testes_20261013
_migracoes_aplicadas
_mz_depara
_mz_empresa_merge
_mz_esperado
_mz_lead_estado
_mz_meta
_mz_negocio_depara
_produto_legado_20261013
_qa_removido
_relacoes_conversao_20261013
_virada_mescla_20261013
_virada_mescla_20261013_b
ai_knowledge_searches
api_token_usos
billing_audit_runs
billing_correction_ledger
billing_resolution_cases
callface_ai_equipes
callface_ai_licencas
callface_ai_org_stripe
callface_ai_parceiro_fatura_itens
callface_ai_parceiro_faturas
callface_ai_parceiro_licencas
callface_ai_parceiro_pendencias
callface_ai_parceiros
callface_ai_planos
callface_ai_receptivos
callface_ai_usage_events
callface_ai_usuarios
campanhas
conversas
correction_change_log
correction_runs
fatura_itens
ganhos_empresa_bkp_20261014174939
legacy_provenance
negocios_bkp_familia_20261014115942
portfolio_snapshots
reconciliation_changes
reconciliation_runs
servico_billing_timeline
servicos_canonicos_bkp_mz_churn_20261015090633
servicos_canonicos_bkp_produto_20261013114524
servicos_catalogo_bkp_familia_20261014175018
```

## Tela por tela

`tab` = tabelas alcançadas (pela tela e pelas rotas que ela chama).

| Tela | tab | legado | vazias | endpoints |
|---|---|---|---|---|
| `/atendimento` | 105 | 4 | 20 | 24 |
| `/automacoes/campanhas` | 44 | 4 | 6 | 2 |
| `/clientes/[id]` | 71 | 4 | 7 | 7 |
| `/contatos` | 55 | 4 | 7 | 5 |
| `/empresas/[id]` | 58 | 4 | 8 | 14 |
| `/inicio` | 108 | 4 | 19 | 6 |
| `/pessoas/[id]` | 60 | 4 | 7 | 4 |
| `/pipeline` | 82 | 4 | 7 | 10 |
| `/pipeline/[id]` | 82 | 4 | 7 | 14 |
| `/pre-vendas` | 58 | 4 | 7 | 2 |
| `/pre-vendas/[id]` | 59 | 4 | 7 | 7 |
| `/propostas` | 65 | 4 | 6 | 4 |
| `/propostas/[id]` | 76 | 4 | 7 | 7 |
| `/propostas/nova` | 65 | 4 | 6 | 4 |
| `/prospeccao` | 111 | 4 | 24 | 6 |
| `/relatorios` | 37 | 4 | 4 | 24 |
| `/relatorios/biblioteca` | 37 | 4 | 4 | 1 |
| `/relatorios/biblioteca/[id]` | 37 | 4 | 4 | 19 |
| `/tarefas` | 101 | 4 | 19 | 12 |
| `/ajustes/contratos` | 46 | 3 | 3 | 9 |
| `/ajustes/integracoes` | 32 | 3 | 4 | 8 |
| `/ajustes/leads` | 60 | 3 | 5 | 14 |
| `/ajustes/whatsapp` | 23 | 3 | 3 | 2 |
| `/automacoes/agentes/[id]` | 95 | 3 | 17 | 21 |
| `/automacoes/cadencias` | 96 | 3 | 17 | 11 |
| `/automacoes/execucoes` | 27 | 3 | 1 | 9 |
| `/automacoes/roteamento` | 105 | 3 | 21 | 2 |
| `/calendario` | 33 | 3 | 4 | 5 |
| `/checkout/[id]` | 46 | 3 | 3 | 1 |
| `/clientes` | 107 | 3 | 19 | 6 |
| `/clientes/cs` | 102 | 3 | 19 | 8 |
| `/clientes/cs/[empresaId]` | 62 | 3 | 5 | 17 |
| `/clientes/risco` | 51 | 3 | 5 | 1 |
| `/contatos/pessoas/[id]` | 34 | 3 | 2 | 1 |
| `/financeiro/[[...resto]]` | 136 | 3 | 23 | 32 |
| `/negocios/novo` | 117 | 3 | 22 | 5 |
| `/p/[id]` | 65 | 3 | 4 | 6 |
| `/projetos/[id]` | 57 | 3 | 3 | 4 |
| `/prospeccao/apollo` | 29 | 3 | 4 | 3 |
| `/vendas` | 36 | 3 | 2 | 1 |
| `/ajustes/membros` | 9 | 2 | 0 | 5 |
| `/ajustes/qualidade-dados` | 10 | 2 | 0 | 0 |
| `/ajustes/tracking` | 9 | 2 | 0 | 1 |
| `/relatorios/performance` | 9 | 2 | 0 | 0 |
| `/ajustes/ai-sdr` | 11 | 1 | 5 | 4 |
| `/ajustes/email` | 9 | 1 | 3 | 11 |
| `/ajustes/email/templates` | 9 | 1 | 3 | 3 |
| `/ajustes/pipeline` | 4 | 1 | 0 | 3 |
| `/ajustes/qualidade-dados/duplicidade` | 5 | 1 | 0 | 0 |
| `/automacoes/campanhas/[id]` | 11 | 1 | 2 | 1 |
| `/automacoes/campanhas/nova` | 11 | 1 | 2 | 1 |
| `/empresas/por-lead` | 3 | 1 | 0 | 0 |
| `/perfil` | 15 | 1 | 5 | 4 |
| `/pos-vendas` | 13 | 1 | 0 | 0 |
| `/.` | 0 | 0 | 0 | 0 |
| `/admin/[[...resto]]` | 0 | 0 | 0 | 0 |
| `/agenda/[[...resto]]` | 0 | 0 | 0 | 0 |
| `/ajustes` | 9 | 0 | 2 | 0 |
| `/ajustes/api-tokens` | 2 | 0 | 0 | 2 |
| `/ajustes/campos-custom` | 1 | 0 | 1 | 2 |
| `/ajustes/catalogo` | 5 | 0 | 0 | 2 |
| `/ajustes/enriquecimento` | 2 | 0 | 0 | 2 |
| `/ajustes/geral` | 2 | 0 | 0 | 0 |
| `/ajustes/handover` | 2 | 0 | 0 | 1 |
| `/ajustes/icp` | 2 | 0 | 0 | 1 |
| `/ajustes/notificacoes` | 2 | 0 | 0 | 1 |
| `/ajustes/organizacoes` | 8 | 0 | 0 | 1 |
| `/ajustes/organizacoes/[id]` | 8 | 0 | 0 | 3 |
| `/ajustes/permissoes` | 7 | 0 | 0 | 0 |
| `/ajustes/servicos` | 3 | 0 | 0 | 3 |
| `/automacoes` | 16 | 0 | 2 | 0 |
| `/automacoes/agente-ia` | 0 | 0 | 0 | 0 |
| `/automacoes/agentes` | 15 | 0 | 1 | 7 |
| `/automacoes/ai/[module]` | 0 | 0 | 0 | 0 |
| `/automacoes/fluxos` | 8 | 0 | 0 | 1 |
| `/automacoes/fluxos/[id]` | 5 | 0 | 0 | 1 |
| `/calendario/configuracoes` | 6 | 0 | 1 | 3 |
| `/campanhas/[[...resto]]` | 0 | 0 | 0 | 0 |
| `/carteira/[[...resto]]` | 0 | 0 | 0 | 0 |
| `/chamados` | 2 | 0 | 0 | 0 |
| `/clientes/360` | 0 | 0 | 0 | 0 |
| `/clientes/carteira` | 0 | 0 | 0 | 0 |
| `/clientes/entrega/[fulfillmentId]` | 0 | 0 | 0 | 0 |
| `/clientes/expansao` | 0 | 0 | 0 | 0 |
| `/clientes/financeiro` | 0 | 0 | 0 | 0 |
| `/clientes/implantacao` | 0 | 0 | 0 | 0 |
| `/clientes/implantacao/callface-ai` | 0 | 0 | 0 | 0 |
| `/clientes/implantacao/pabx` | 0 | 0 | 0 | 0 |
| `/clientes/implantacao/white-label` | 0 | 0 | 0 | 0 |
| `/clientes/onboarding` | 0 | 0 | 0 | 0 |
| `/clientes/onboarding/[fulfillmentId]` | 0 | 0 | 0 | 0 |
| `/clientes/sucesso` | 0 | 0 | 0 | 0 |
| `/clientes/uso` | 14 | 0 | 0 | 0 |
| `/configuracoes/[[...resto]]` | 0 | 0 | 0 | 0 |
| `/contatos/[id]` | 0 | 0 | 0 | 0 |
| `/contatos/empresas/[id]` | 0 | 0 | 0 | 0 |
| `/contratos/[[...resto]]` | 0 | 0 | 0 | 0 |
| `/dashboard/[[...resto]]` | 0 | 0 | 0 | 0 |
| `/definir-senha` | 0 | 0 | 0 | 2 |
| `/design/[[...secao]]` | 13 | 0 | 0 | 0 |
| `/email/[[...resto]]` | 0 | 0 | 0 | 0 |
| `/empresas` | 0 | 0 | 0 | 0 |
| `/esqueci-senha` | 0 | 0 | 0 | 1 |
| `/impl-pabx/[token]` | 0 | 0 | 0 | 2 |
| `/impl-white-label/[token]` | 0 | 0 | 0 | 2 |
| `/inbox/[[...resto]]` | 0 | 0 | 0 | 0 |
| `/leads/[[...resto]]` | 0 | 0 | 0 | 0 |
| `/login` | 0 | 0 | 0 | 0 |
| `/negocios` | 0 | 0 | 0 | 0 |
| `/negocios/[id]` | 0 | 0 | 0 | 0 |
| `/onboarding/[[...resto]]` | 0 | 0 | 0 | 0 |
| `/operacao/onboarding` | 0 | 0 | 0 | 0 |
| `/operacao/projeto` | 0 | 0 | 0 | 0 |
| `/pos-venda` | 0 | 0 | 0 | 0 |
| `/pos-venda/entrega/[fulfillmentId]` | 0 | 0 | 0 | 0 |
| `/pos-venda/implantacao` | 0 | 0 | 0 | 0 |
| `/pos-venda/onboarding` | 0 | 0 | 0 | 0 |
| `/pos-venda/onboarding/[fulfillmentId]` | 0 | 0 | 0 | 0 |
| `/pos-venda/white-label` | 0 | 0 | 0 | 0 |
| `/propostas/novo` | 0 | 0 | 0 | 0 |
| `/whatsapp/[[...resto]]` | 0 | 0 | 0 | 0 |

## Limites deste mapa

- Segue **import estático**. `await import()` dinâmico dentro de função é seguido só quando o caminho é literal.
- Uma tela que chama rota por URL montada em variável não tem essa rota contada.
- Tabela citada só em string de SQL montada em pedaços pode escapar.
- Por isso os números são **piso**, não teto: o acoplamento real é igual ou maior.
