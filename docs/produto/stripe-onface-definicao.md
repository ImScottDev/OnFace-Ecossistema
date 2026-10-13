# ONFACE ↔ Stripe: o que está definido

> Definição do Scott, consolidada em 13/10/2026. Fonte única para qualquer
> trabalho de catálogo, proposta, cobrança, assinatura e financeiro.
> **Stripe é o motor financeiro. ONFACE é o cockpit.**

## Regra central
- Stripe é a fonte oficial de catálogo, cobrança, assinatura, invoice e pagamento.
- ONFACE é a camada onde Comercial, Financeiro e CS trabalham. A operação normal não exige abrir o Stripe.
- Integração profunda, bidirecional, idempotente e quase invisível para o usuário.

## 1. Catálogo
- O catálogo oficial está no Stripe: Callface AI, PABX, White Label, Setup, Licenças, recorrências, avulsos e adicionais, com vários Prices (variações) por Product.
- O ONFACE espelha e enriquece o catálogo e o usa em Proposta → Negócio → Cliente → Contrato → Financeiro.
- **Proposta: o usuário escolhe o PRODUTO e, dentro dele, a VARIAÇÃO (Price):** mensal/anual, pacote, quantidade, modelo de cobrança. Não pode haver uma linha por Price misturada na lista nem nome técnico (lookup_key) exposto como título.
- Metadata do catálogo: `familia`, `categoria_crm`, `sku_interno`, `tipo_receita`, `modelo_cobranca`, `destino_pos_venda`, `exige_contrato`.
- Entidades criadas pelo CRM carregam `organizacaoId`, `negocioId` e `propostaId`.
- O ONFACE pode criar e alterar produtos e preços e refletir no Stripe, mantendo essa governança.

## 2. Customer único
- Uma empresa do ONFACE tem **um** Customer canônico no Stripe.
- Nova venda, adição de produto, upgrade, cross-sell, renovação e nova assinatura reutilizam o Customer existente.
- A identificação usa IDs internos e metadata, não só nome ou e-mail.

## 3. Assinaturas
- Estrutura: 1 Customer → N Subscriptions → N Subscription Items.
- Expansão altera a assinatura existente quando fizer sentido.
- Operações: criar, adicionar e remover produto, alterar quantidade, alterar Price/plano, alterar ciclo, upgrade, downgrade, cross-sell, cancelar e reativar.
- Upgrade é imediato, com pró-rata. Downgrade vale no próximo ciclo. Um usuário autorizado (CS) pode sobrescrever.

## 4. White Label
- Setup White Label é one-time. Licença White Label é recorrente.
- A diferença afeta contrato, proposta, faturamento, receita, MRR e onboarding.

## 5. Venda não é pagamento
- **Venda/Booking:** o que foi vendido.
- **Faturamento:** invoice emitida.
- **Recebimento:** dinheiro efetivamente pago.
- **Recorrência/MRR:** só receita realmente recorrente.
- Setup, venda avulsa, uso e adicional temporário não são MRR por padrão. Licença recorrente é recorrência.
- O PABX tem histórico de planilha/holding que coexiste com o Stripe no mesmo Financeiro.

## 6. Fluxo comercial
Organização/Cliente → Negócio → Proposta → Produtos → Contrato → Stripe Customer → Subscription/Quote/Checkout → Invoice → Payment → volta ao ONFACE. A proposta consome o catálogo real (Prices e metadata). Nada de preço manual sem vínculo.

## 7. Checkout e cobrança
O ONFACE inicia a cobrança por Stripe Checkout hospedado (ou Payment Link quando fizer sentido). A ação começa no ONFACE.

## 8. Portal do cliente
Usar o Stripe Customer Portal: cobranças, invoices, meio de pagamento, histórico e ações permitidas da assinatura. O ONFACE gera o acesso e mostra o essencial, sem reconstruir o portal.

## 9. Cliente 360: financeiro
- Mostra: Customer associado, produtos, assinaturas, itens, quantidades, valores, ciclo, próxima cobrança, status, invoices, pagamentos, falhas, inadimplência, MRR, setup/one-time separado e histórico.
- Ações: cobrar, abrir Checkout, abrir Portal, upgrade, downgrade, adicionar produto, alterar quantidade e cancelar.

## 10. Stripe → ONFACE (webhooks)
Eventos a tratar: checkout concluído; pagamento realizado e falho; invoice criada, paga e vencida; assinatura criada, alterada e cancelada; quantidade e produto alterados; período renovado; método de pagamento; cliente atualizado; inadimplência; recuperação.

## 11. Timeline
Eventos financeiros relevantes entram na timeline do cliente e do negócio. Exemplos: assinatura criada, invoice emitida, pagamento recebido, pagamento falhou, inadimplente, upgrade, White Label adicionado, cancelamento agendado.

## 12. Inadimplência e recuperação
Usar o nativo do Stripe: retries, e-mails, Revenue Recovery e Portal. O ONFACE recebe o evento e o transforma em contexto operacional: status financeiro, timeline e ação de CS/NEXO/automação.

## 13. Metadata é arquitetura
Customer, Subscription, Checkout e Invoice carregam os IDs internos. É preciso conseguir ir do Stripe ao ONFACE e voltar.

## 14. Idempotência
Clique duplo, reenvio, webhook repetido ou job reexecutado nunca geram dois Customers, duas assinaturas, dois pagamentos ou duas invoices.

## 15. Webhook + reconciliação
- O webhook é o fluxo principal.
- Uma reconciliação periódica Stripe ↔ ONFACE detecta e corrige divergências.
- O Stripe é a autoridade para pagamento, invoice e assinatura.

## 16. Não copiar o Stripe
Nada de um dashboard do Stripe piorado. Mostrar e operar só o que importa ao negócio.

## 17. Financeiro central
Stripe, PABX, planilhas e fontes futuras convergem para um modelo financeiro canônico: Stripe → adapter → normalização → regras ONFACE → banco → Financeiro/Cliente/Timeline/NEXO. Nada de código do Stripe escrevendo em qualquer tabela.

## 18. NEXO e agentes
Leem o modelo oficial do ONFACE, nunca chamam o Stripe direto. Precisam saber: o que comprou, o que está ativo, quanto paga, desde quando, próxima cobrança, inadimplência, upgrades, expansão, cancelamento e histórico.

## Auditoria pedida
Para cada item, comparar o que existe no repositório e na conta Stripe real e registrar as lacunas:
- catálogo e metadata;
- Customer canônico;
- operações de assinatura;
- Checkout ligado à proposta;
- Portal;
- invoices e pagamentos;
- webhooks (cobertura, idempotência e auditoria);
- metadata;
- separação booking/faturamento/recebimento/MRR;
- Cliente 360;
- timeline;
- reconciliação;
- permissões;
- logs e reprocessamento.
