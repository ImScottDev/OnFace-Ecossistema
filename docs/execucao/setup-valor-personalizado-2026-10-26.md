# Setup de valor escolhido — 26/10/2026

Estado: correção local em revisão; sem migration, sync, envio ou deploy executado.

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

## Publicação pendente

Aplicar migration por runner oficial no ambiente autorizado, simular sincronização
completa do catálogo e revisar antes de aplicar. Não sincronizar snapshot parcial:
o sincronizador também desativa preços que não vieram na leitura.
Depois validar #1598 em homologação, sem enviar comunicação ou criar cobrança live.
Só promover o mesmo SHA após autorização do Scott.

## Limite identificado na revisão

No fechamento contratual faturado, checkout.ts ativa só recorrentes e
pos-assinatura.ts registra recebível interno do setup. Não foi acrescentada emissão
automática de fatura nem alterada a operação financeira desse caminho.
