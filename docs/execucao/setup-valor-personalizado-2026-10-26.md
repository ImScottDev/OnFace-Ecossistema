# Setup de valor escolhido — 26/10/2026

Estado: publicada em homologação e produção no mesmo SHA a03567ebb02960755a76fe381b5156dfe2878273, com autorização explícita do Scott em 26/10/2026.

## Evidência

Proposta #1598, rascunho e2fdb968-b881-437e-96f4-49f54a783b71: setup
R$ 1.649,90 bloqueado por tabela R$ 0,00. Conversa “Continuação Onface”
inspecionada pelo Remote Desktop Commander; checkout em 4ded80cf.

GET Stripe em 26/10: price_1UUpN4Ed4dqxpSBfJZOOTTBQ (PABX) está ativo,
custom_unit_amount com minimum/maximum/preset nulos e unit_amount nulo.
Callface AI price_1UUpN4Ed4dqxpSBfgPFwXZDb permanece fixo zero.

O adaptador perdia custom_unit_amount; o sync recusava unit_amount nulo; o envio
e checkout limitavam o negociado ao snapshot de tabela zero.

## Correção

- Adaptador e sync conservam o modo de valor escolhido e seus limites.
- Migration 0134 adiciona três colunas; não altera valores de propostas existentes.
- Envio e checkout aceitam valor escolhido dentro dos limites, conservando preço fixo.
- Checkout monta o setup com preço negociado no produto oficial.
- Cupom fica restrito aos produtos descontados quando há setup personalizado.
- Interface identifica “Valor definido na proposta”.

43 testes direcionados de catálogo, tradução de catálogo e checkout passaram.
Incluem valor 164990 centavos, limites e preservação do setup contra cupom do plano.

## Publicação e evidências

- Commit funcional 2f4261ae; a03567eb acrescentou 0134 à tabela oficial de migrations após o portão detectar a omissão. Portão final verde.
- 174 testes de arquitetura/catálogo/checkout/adaptador passaram; revisão independente sem novo bloqueador.
- Backup antes da mudança: `/opt/callface/crm2-dev/backups/antes-setup-mz-2f4261ae.dump`, banco efetivo callface_crm_mz, 55 MB, permissão 600.
- Deploy oficial homolog e promoção producao --versao do mesmo SHA. Migration 0134 aplicada pelo runner nos dois; releases e app/API/worker saudáveis conferidos.
- Leitura completa do Stripe: 70 produtos, 129 preços. Dry-run antes da sincronização em cada ambiente; 70 produtos/127 preços atualizados, nenhum criado ou desativado pelo sync.
- Homolog não contém #1598. Na cópia, #1076-v2 recebeu setup de R$ 1.649,90, salvo como rascunho e confirmado após reload; nenhum envio.
- Em produção, #1598 aberta no navegador: setup preservado em R$ 1.649,90 e rótulo “Valor definido na proposta”. A consulta exata de problemas do envio, extraída do código, retornou zero bloqueios para a proposta.
- Nenhum envio, aceite, checkout ou cobrança real executado. Pagamento efetivo no Stripe não foi testado.
- Rollback de código: 4ded80cf8841fb4e55c33c32edddd0db0f32d997; migration é aditiva e não volta. Reversão de código exige avaliar também o catálogo personalizado sincronizado.

## Limite identificado na revisão

No fechamento contratual faturado, checkout.ts ativa só recorrentes e
pos-assinatura.ts registra recebível interno do setup. Não foi acrescentada emissão
automática de fatura nem alterada a operação financeira desse caminho.
