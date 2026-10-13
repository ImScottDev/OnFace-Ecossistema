# Upgrade, cross-sell, aditivo e renovação: proposta de modelo

Status: PROPOSTA para revisão. Nada deste documento foi implementado. Mexer em substituição de serviço altera o MRR de cliente vivo.
Origem: defeito D11 de `docs/operacao/auditoria-proposta-contrato-ganho.md` (P-1570: 8 canais R$ 189,90 foi mantido ao lado de 16 canais R$ 379,90).

## 1. Como o sistema sabe hoje o tipo da venda

Existem DOIS vocabulários, que não se falam.

| Onde | Vocabulário | Referência |
|---|---|---|
| Oportunidade (`negocios.commercial_motion`) | `NEW_BUSINESS` / `EXPANSION` / `RENEWAL` / `REACTIVATION` | `api-server/routes/negocios.ts:41`; mapa do vendedor em `app/(produto)/clientes/[id]/actions.ts:31-36` (expansao, upgrade e crosssell caem TODOS em `EXPANSION`; renovacao em `RENEWAL`) |
| Proposta (`propostas.tipo_contratual`, `contrato_base_id`) | `NOVO_CONTRATO` / `ADITIVO` / `UPGRADE` / `DOWNGRADE` / `RENOVACAO` | `lib/db/schema.ts:1703-1704`; `lib/vendas/dominio.ts:272-276` |

Consequências verificadas:

- Upgrade e cross-sell são **indistinguíveis** na oportunidade: ambos viram `EXPANSION`. O tipo que o vendedor escolheu na modal se perde no mapa (`actions.ts:31`).
- `tipo_contratual` só decide o **documento** do contrato (`tipoDocumentoDoContratual`, `dominio.ts:283`: ADITIVO e UPGRADE usam o termo aditivo; DOWNGRADE tem texto próprio com multa, `contrato-template.ts:243`; RENOVACAO tem modelo). Modelos: `modelos-contrato.ts:24-26` (`pabx-aditivo`, `pabx-downgrade`, `pabx-renovacao`; só PABX tem, Callface AI e White Label não têm aditivo).
- `contrato_base_id` é **exigido** para ADITIVO/UPGRADE/DOWNGRADE/RENOVACAO (`vendas/propostas.ts:478-482`) e é usado só para citar o número do contrato no texto (`contrato-template.ts:84-89, 292`) e calcular a multa do downgrade.
- A UI **sempre envia `NOVO_CONTRATO`** (`PropostaProto.tsx:378`, `DetalhePropostaPagina.tsx:117`). Os outros tipos só existem por API/script. Ou seja, hoje ninguém consegue emitir um UPGRADE pela tela.
- `servicos_catalogo.supports_upgrade` / `supports_downgrade` (`schema.ts:1519-1520`) são só CRUD e clone de catálogo (`routes/servicos-catalogo.ts:41-42`, `scripts/clonar-catalogo-stripe-para-test.ts:137`). **Nenhuma regra os lê.** São capacidade declarada, sem efeito.
- No Stripe, `checkout.ts:42-51` bloqueia novo checkout de assinatura quando a oportunidade não é `NEW_BUSINESS` e manda concluir em Cliente 360 > Assinaturas.

## 2. Os quatro casos têm efeitos diferentes

| Caso | Efeito correto no MRR | Efeito hoje |
|---|---|---|
| Upgrade/downgrade do MESMO serviço (8 para 16 canais, mais licenças) | O serviço antigo SAI, o novo ENTRA. MRR sobe pela diferença | Soma: antigo continua `ACTIVE`. MRR sobe pelo valor cheio do novo (D11) |
| Cross-sell (produto diferente, mesma conta) | Soma. Está certo | Soma. Correto, e é o único dos três que já funciona |
| Aditivo de quantidade do mesmo item | Substitui a linha (qtd maior) ou soma linha nova, conforme o preço unitário seja o mesmo | Não verificado em banco; provavelmente soma (ver nota abaixo) |
| Renovação | Valor igual, prazo novo | O Ganho materializa serviço novo por item (`servico-canonico.ts:129-132`, chave `CRM2:<item>`): uma renovação ganha **duplicaria** o serviço. Não foi testado em banco; precisa ser |

Nota: aditivo de quantidade e upgrade de plano se parecem, mas o Stripe os trata diferente (`expandirAssinatura` soma quantidade no mesmo preço; `trocarPlanoDaAssinatura` troca o item, `stripe-assinatura.ts:230-310`).

`servicos_canonicos.commercial_lifecycle = 'SUPERSEDED'` existe só como comentário no schema (`schema.ts:3140`). **Ninguém grava esse valor** (busca em `app/src`: as escritas são `ACTIVE` em `servico-canonico.ts:52` e `pos-venda.ts:289`, e `CHURNED` em `cs/cancelamento.ts:197` e `stripe-sync.ts:495`). Em compensação, todas as leituras de MRR da carteira filtram `= 'ACTIVE'` (`metricas/catalogo.ts:188`, `cs/fila.ts:310`, `cs/painel.ts:68`, `cs/tela-cs.ts:92`). Isso é uma boa notícia: **marcar o antigo como `SUPERSEDED` já o tira do MRR e dos contadores de serviço ativo sem tocar em nenhuma leitura.** (O `SUPERSEDED` de `clientes-crm2.ts:879` é outra coisa: lote do ledger.)

## 3. O que falta no modelo

Falta UM fato: "este item da proposta substitui aquele serviço". Hoje nada na proposta, no item ou no serviço novo registra isso.

### Caminho mais barato (recomendado)

Reaproveitar o que existe; uma coluna e uma regra.

1. **Coluna nova**: `proposta_itens.substitui_servico_id uuid NULL REFERENCES servicos_canonicos(id)` (próxima migration livre; a 0125 já foi tomada por outra frente em andamento; aditiva, idempotente, `ADD COLUMN IF NOT EXISTS`). NULL = comportamento atual (soma). É o único dado novo.
2. **Preencher na proposta**: só quando `tipo_contratual` é UPGRADE ou DOWNGRADE (e `contrato_base_id` já está obrigatório). O editor oferece, por item recorrente, "substitui qual serviço ativo desta empresa" (lista de `servicos_canonicos` ACTIVE da empresa, mesma família). Item sem escolha continua somando. Cross-sell nunca pergunta.
3. **Aplicar no Ganho**, no mesmo ponto onde o serviço novo é materializado (`servico-canonico.ts`, hoje intocável sem alinhamento): depois de criar o novo, `UPDATE servicos_canonicos SET commercial_lifecycle='SUPERSEDED', portfolio_included=false, updated_at=updated_at ... WHERE id = substitui_servico_id AND organizacao_id = ctx`, gravando `evidence.substituido_por = <novo id>` e no novo `evidence.substitui = <antigo id>`. Na mesma transação.
4. **Cross-sell x upgrade na oportunidade**: guardar o tipo escolhido (`upgrade` / `crosssell`) em `negocios.sub_motion` ou no `evidence`, em vez de perder no mapa para `EXPANSION`. Opcional na primeira entrega; sem isso o relatório segue sem separar os dois.
5. **Renovação**: o Ganho de `RENEWAL` (ou `tipo_contratual = RENOVACAO` com `contrato_base_id`) deve **atualizar prazo do serviço existente** e não materializar outro. Menor mudança: se `tipo_contratual = RENOVACAO`, pular a materialização e apenas estender `contratos.vencimento` do base.

Custo estimado: 1 migration de uma coluna, 1 select no editor, ~25 linhas no ponto de materialização, 1 teste puro da regra (qual serviço sai) e 1 teste com banco. A parte cara não é código: é o **backfill de P-1570 e de qualquer upgrade já feito**, que é decisão de dados (ver 5).

### Alternativas descartadas

- **Marcar o antigo por heurística** (mesma família + valor menor): inventaria fato; um cross-sell do mesmo produto em outra unidade seria apagado por engano.
- **Tabela de relação serviço-serviço**: estrutura nova para um vínculo 1 para 1 que cabe numa coluna.
- **Usar `supports_upgrade`**: é capacidade do catálogo, não fato da venda. Pode servir depois para esconder a opção em produto que não faz upgrade.

## 4. Os três mundos de cobrança

Quem cobra decide se a substituição se completa sozinha.

### 4.1 Assinatura atual do Stripe (criada pelo CRM)

- O upgrade é feito em Cliente 360 > Assinaturas (`stripe-assinatura-acoes.ts`, ação `trocar_price`; `trocarPlanoDaAssinatura` exige o `si_...` do item justamente para trocar em vez de somar, `stripe-assinatura.ts:273-285`). O Stripe passa a cobrar só o preço novo, com proração.
- O sync (`stripe-sync.ts:480-483`) vê o MRR da assinatura mudar e grava movimento `expansao` ou `contracao`. **A receita do Stripe já está certa.**
- O que quebra: o serviço canônico. Nesse caminho **não encontrei** nada que troque o `canonical_key`/valor do serviço antigo; o Ganho do upgrade cria o novo e o antigo fica `ACTIVE`. O MRR por `servicos_canonicos` (carteira, CS, catálogo de métricas) soma os dois; o MRR por assinatura/fechamento (`mrr-oficial.ts`) não. Daí os números divergirem, como na auditoria (R$ 3.182,80).
- Com o caminho recomendado: o `SUPERSEDED` fecha a divergência. A chave `STRIPE:<assinatura>` (`regras-pos-ganho.ts:51-56`) é a mesma antes e depois da troca; atenção para o upgrade não colidir com a chave do serviço antigo no upsert (`servico-canonico.ts:73-76`): se a assinatura é a mesma e só há um item recorrente, o upsert **atualizaria** o antigo em vez de criar outro. Precisa de teste para fixar qual comportamento vale.

### 4.2 Assinatura antiga do Stripe (anterior ao CRM, sem `crm_negocio_id`)

- Alteração feita no Dashboard do Stripe chega ao sync "sem dono" (`stripe-sync.ts:481-482`). A receita muda; não há proposta nem oportunidade, logo **nenhum** `substitui_servico_id`.
- Nesses casos a regra não pode depender da proposta. Proposta: o sync, ao ver troca de `price` em item da assinatura que tem `servicos_canonicos.current_subscription_id = sub.id`, atualiza o valor/produto do serviço existente em vez de deixar o antigo e esperar um novo. Isso é correção **por assinatura**, independente de venda. Maior risco da proposta: toca o sync que alimenta o MRR inteiro. Só com teste contra banco e dry-run.
- Conta compartilhada com o SaaS: manter o filtro `doCrm`/`assinaturaDoCrm` (`financeiro/espelho-crm.ts`) em qualquer leitura nova de `assinaturas`/`faturas`.

### 4.3 Cliente do legado Zoho (não faturado pelo Stripe)

- O serviço vem de ledger/marco zero/WeVy/Zoho (`ehOrigemLegada`, `catalogo/rotulos.ts:79`), com `billing_source` próprio e sem `current_subscription_id`. O dinheiro entra pela planilha/fechamento (`cliente_receita_mensal`), não por fatura de assinatura.
- Não há assinatura a trocar. O upgrade acontece só no papel: aditivo assinado, e o legado passa a faturar o valor novo. **O CRM não tem como saber** o que o legado cobra de fato; o `UPDATE` de `SUPERSEDED` seria um ato de cadastro, sem confirmação financeira.
- O que quebra: (a) o MRR oficial prefere o fechamento da última competência à assinatura (`mrr-oficial.ts`), então enquanto o fechamento não trouxer o valor novo, o número não muda; (b) se o `SUPERSEDED` é marcado antes de o legado faturar, a carteira mostra menos que o fechamento.
- Proposta para este mundo: o `SUPERSEDED` é marcado **na vigência do aditivo** (não no Ganho), por ação explícita de Financeiro/CS em Cliente 360, com data. Sem automação. É o único mundo onde a substituição não deve ser automática.

## 5. Backfill (proposta; NÃO executar)

- P-1570 e qualquer proposta `UPGRADE`/`DOWNGRADE` já ganha: listar `propostas` com `tipo_contratual IN ('UPGRADE','DOWNGRADE')` e `contrato_base_id` preenchido, juntar com os serviços da mesma empresa e família criados depois da base, e **apresentar o par candidato para decisão humana**. Nunca marcar por heurística.
- Hoje a UI só emite `NOVO_CONTRATO`; é provável que quase não existam casos além do teste P-1570. Medir antes de desenhar o backfill.

## 6. Decisões que preciso do dono

1. Aprovar a coluna `proposta_itens.substitui_servico_id` como o único dado novo.
2. Cross-sell x upgrade: gravar a distinção na oportunidade agora ou depois?
3. Renovação: confirmar que ganho de renovação NÃO cria serviço novo (hoje criaria, a verificar em banco).
4. Legado Zoho: confirmar que a substituição é manual, na vigência do aditivo.
5. Sync do Stripe: autorizar a correção de troca de price (4.2) como entrega separada, com dry-run.

## 7. Ordem sugerida

1. Teste com banco que reproduz D11 (upgrade deixa dois ACTIVE) e a renovação duplicando serviço. Define o comportamento atual.
2. Migration + editor + regra no Ganho (mundo 4.1).
3. Ação manual de Cliente 360 para o legado (4.3).
4. Correção do sync (4.2), por último, por ser a de maior alcance.
