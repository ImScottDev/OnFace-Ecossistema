# Propostas: correção ponta a ponta (análise do Scott, 13/10/2026)

Diretrizes: não reconstruir o módulo nem criar arquitetura paralela. Reaproveitar o catálogo e os serviços existentes e centralizar as regras comerciais numa camada única (API Hono, Server Actions e serviços usam a mesma validação). Aceite não é ganho: o fechamento depende de evidência (contrato assinado ou pagamento). Proposta enviada não se edita, revisão preserva histórico. Stripe é a autoridade financeira. Para cada item: arquivo, função, causa; classificar como bug, risco ou melhoria; menor mudança segura; teste automatizado.

## P0
1. **Envio sem e-mail.** `PropostaProto.tsx` (~296–322) manda `para: null` quando o e-mail não está marcado, e `avisarClienteDaPropostaEnviada` usa `opts.para || lead?.email` (actions.ts ~574–600). Confirmado: dispara e-mail mesmo quando o vendedor escolheu só o link. Separar `enviarEmail: boolean` de `destinatarioEmail` e mostrar o resultado real na tela.
2. **Subtotal negativo.** `calcSubtotal` (proposta-criacao.ts ~65–68; routes/propostas.ts) não limita o desconto. Validar desconto e quantidade no servidor, nunca aceitar subtotal negativo e testar os limites.
3. **Escrita não atômica.** `criarPropostaComItens` (proposta-criacao.ts ~124–280) e a edição fazem várias escritas sem transação. Envolver proposta e itens em uma transação, com sincronização confiável dos efeitos.
4. **Numeração.** `MAX(numero)+1` (proposta-criacao.ts ~163–168) quebra com concorrência. Usar sequência atômica por organização e unicidade no banco (migration nova e idempotente).

## P1
5. **Família comercial.** A action lê `negocios.service_family`; o núcleo usa `COALESCE(negocios.service_family, oportunidades.service_family)`. Fazer uma única resolução.
6. **Price oficial.** `inserirItensDaProposta` aceita nome, tipo e valor do chamador e faz fallback quando o `catalogoPrecoId` não existe. Exigir Price válido, ativo (com produto pai ativo), da organização e compatível com família, moeda, periodicidade e tipo, com limites de preço e desconto e permissão para exceção.
7. **Revisão.** `criarRevisao` (vendas/propostas.ts ~609–683) marca a anterior como substituída antes de a nova estar completa (PropostaProto ~276–288). Tornar atômico: substituir só quando a nova for válida.
8. **Versões concorrentes.** `versao+1` sem trava. Bloquear concorrência, trabalhar sempre sobre a versão vigente e garantir unicidade.
9. **Regras divergentes entre caminhos:**
   - validade: o módulo Vendas aceita 7/14/22/30 dias, o outro serviço usa 10 por padrão;
   - moeda: a API aceita BRL/USD/EUR/CAD, a action fixa BRL;
   - catálogo: `catalogoDaFamilia` não exige produto pai ativo.

   Padronizar numa política única.
10. **Contato.** Sem lead, a criação escolhe o primeiro lead da empresa pela data. O destinatário deve ser escolhido explicitamente.
11. **Rascunho.** Os updates via COALESCE impedem limpar campos opcionais. Permitir limpar de forma controlada.
12. **Dados jurídicos, página pública, checkout e permissões.** Validar:
    - dados jurídicos: empresa, contato e contrato consistentes;
    - página pública: expiração, versão substituída, aceite e recusa concorrentes, link e autorização de assinatura;
    - checkout: idempotência por tentativa, expiração de sessões antigas e reconciliação;
    - permissões: por operação (desconto, edição, envio, revisão, aceite interno e exclusão).
13. **Contrato e pagamento decididos no backend** a partir do modelo comercial dos itens, inclusive em negócios com várias linhas (Callface AI + PABX + White Label).

## P2
- `registrarVisualizacao`: trocar leitura+1 por incremento atômico.
- Lista: paginação real (hoje carrega até 5.000).
- Auditoria estruturada de alterações comerciais: antes, depois, usuário, horário e motivo.

## A proposta guarda o retrato da negociação
Price original, preço de tabela, preço negociado, desconto, quantidade, periodicidade, natureza da receita e família. Esse retrato não muda quando o catálogo muda depois.

## Critério de aceite
Uma proposta pode ser criada, salva, editada enquanto rascunho, revisada, enviada, visualizada, aceita, recusada ou devolvida para ajuste, sem inconsistência de valores, versões ou estados. O fechamento gera os contratos e cobranças certos, atualiza os módulos e nunca duplica nada financeiro. Não declarar pronto sem evidência.
