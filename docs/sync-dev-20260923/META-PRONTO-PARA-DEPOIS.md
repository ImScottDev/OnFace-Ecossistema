# Meta: Graph API já está disponível (verificado 23/09)

Levantamento feito a pedido, execução adiada pelo Scott ("isso é depois").
Nada foi implementado nem alterado. Este arquivo existe só para a próxima
sessão não refazer a verificação.

## Resposta: NÃO é só CAPI. A Graph API está autenticada e funcionando.

`app/src/scripts/checar-token-meta.ts` (já existia) passou inteiro:

- token **SYSTEM_USER**, app MerencIA, **sem data de expiração**
- 44 escopos, incluindo **`leads_retrieval`**, `ads_read`, `ads_management`,
  `pages_show_list`, `pages_read_engagement`
- alcança a Página Callface (170052822855677) e troca por Page Access Token
- lê Ads Insights de `act_1979606826185515` com o mesmo token
- **lê um lead real**: 7 campos retornados

A anotação antiga de que "falta token com leads_retrieval" está VENCIDA.

## Inventário disponível hoje

9 formulários na Página, 4 com lead, **877 leads no total**:

| form_id          | status | leads | nome                                          |
|------------------|--------|-------|-----------------------------------------------|
| 3373693756130107 | ACTIVE | 758   | FB Lead Form 02-copy                          |
| 1576359137835159 | ACTIVE | 100   | FORMULÁRIO NATIVO META — WHITE LABEL CALLFACE |
| 1297867799038795 | ACTIVE | 13    | FB Lead Form \| Email Corporativo             |
| 1416582457107880 | ACTIVE | 6     | ... WHITE LABEL CALLFACE- set26               |
| outros 5         | ACTIVE | 0     |                                               |

Campos do formulário: `first_name`, `last_name`, `phone_number`, `email`,
`solução_de_telefonia_atual`, `cargo`, **`empresa`**.

O campo `empresa` existir aqui é relevante para o sintoma "Empresa não
informada" na tela.

## O que já existe (não precisa ser escrito de novo)

| peça | arquivo |
|---|---|
| adapter/normalização | `packages/integrations/meta/src/lead-ads.ts` |
| busca do lead na Graph | `packages/integrations/meta/src/lead-retrieval.ts` |
| config/URL da Graph | `packages/integrations/meta/src/config.ts` |
| webhook de leadgen | `app/src/app/api/webhooks/meta-leads/route.ts` |
| porta canônica de escrita | `packages/domain/acquisition/commands/registrar-entrada.ts` |
| staging idempotente | tabela `meta_lead_staging` (575 linhas hoje) + migration 0090 |
| smokes | `smoke-meta-lead-ads.ts`, `smoke-meta-capi.ts`, `smoke-meta-staging-idempotente.ts` |

`registrar-entrada.ts` já aceita `metaLeadId`, `campaignId`, `adsetId`, `adId`,
`fbclid`, `fbc`, `fbp`, UTMs e `landingPage` — os identificadores pedidos já têm
casa no modelo canônico.

## O que falta para o pedido

Só a **importação histórica em massa**. O caminho de hoje é reativo (webhook,
lead a lead). Falta um script que varra os formulários, pagine
`/{form_id}/leads` com janela de 90 dias, e entregue cada lead à
`registrarEntrada` — que já é idempotente por identidade.

Nenhuma credencial nova é necessária.
