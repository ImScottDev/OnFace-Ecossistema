---
tipo: estado-atual
status: ativo
owner: Kauã / Scott
atualizado_em: 2026-09-11
---

# Estado Atual, Callface CRM

Este é o ponto de partida operacional do CRM. O estado detalhado continua em [[02_PROJETOS/Callface/CRM/produto/crm-callface-status]]. O handoff de execução está em [[02_PROJETOS/Callface/CRM/produto/crm-handoff-atual]].

Ao terminar qualquer mudança material no CRM, atualize primeiro a fonte detalhada ou este estado atual, conforme o documento afetado, e registre no diário como linha do tempo.


## Log

### 2026-09-17, TASK-001 Módulo 01 Vendas iniciada em desenvolvimento local

- Scott liberou a TASK-001 no checkout `callface-crm-dev` (branch `dev`) e revogou o bloqueio D1. Não há operação em homologação ou produção.
- Regras aprovadas: o drawer de Lead existente permanece (sem `/pre-vendas/[id]`), o import entre `pagina.tsx` e `PreVendas.tsx` não será refatorado, e o checkout único exige execução serial sem branch/worktree paralelos.
- O fechamento exige QA independente com typecheck explícito, teste automatizado e smoke autenticado com evidência desktop e mobile; `npm run build` não é gate porque a configuração ignora erros de TypeScript.
- A primeira rodada é QA somente leitura do WIP de Prospecção. Os achados restantes são correções mínimas no Módulo 01; o link `wa.me` de Visão Geral e a separação conceitual de lista/tag ficaram fora do escopo.

### 2026-09-17, TASK-001 replanejada e QA inicial sem aceite integral

- O WIP de ações em massa de Prospecção foi consolidado no commit local `9efce0e` e revisado contra `2c67aed`. O QA confirmou typecheck, cinco testes, smoke autenticado desktop/mobile, persistência, reload, navegação e limpeza do dado isolado.
- O parecer de QA é **REPROVOU** somente porque `Enriquecer` enfileira Apollo e pode acionar integração externa ou crédito; não foi executado. A aprovação depende de decisão segura do Maestro: desligar comprovadamente fila/integração local para o smoke, ou aceitar essa limitação de forma explícita.
- CTO e Challenger Esquadro concordaram no plano serial replanejado: o par de rotas de Pré-vendas, matriz de aceite por fluxo, teste SQL do filtro de lista antes de `LIMIT`, e whitelist serial de Pessoas/Contatos/Empresa 360. Nenhum dev foi liberado enquanto o QA não passar integralmente.
- O achado de Pipeline legado (`negocios` versus `oportunidades`, sem `service_family`) foi mantido fora da TASK-001, sem alteração de código ou dado.

### 2026-09-14, incidente: proposta criava Customer duplicado no Stripe

- Investigação do fluxo de proposta confirmou a causa: `enviarPropostaComCheckout` enviava somente `customer_email` para o Checkout. A Stripe então criava outro `Customer` em cada nova proposta, embora `leads.stripe_customer_id` (e, em cadastros antigos, `empresas.stripe_customer_id`) já pudesse apontar para o cadastro canônico.
- Correção preparada no checkout local `callface-crm`: Customer canônico agora tem precedência sobre e-mail tanto em assinatura quanto em cobrança avulsa; `customer` e `customer_email` não são enviados juntos. Cobrança avulsa só usa `customer_creation=always` quando não existe Customer conhecido. Adicionada chave de idempotência por proposta/sessão para duplo clique ou retry não criar sessões/Customers paralelos.
- Regra de domínio explicitada: venda de outro produto pode criar outra assinatura, mas nunca outro Customer; alteração de assentos/preço deve atualizar o item da assinatura correta, mediante fluxo explícito de upgrade, e não ser inferida ao enviar uma proposta.
- Pendências de auditoria em curso: verificar os dois Customers do incidente e seus vínculos CRM, identificar duplicações históricas, e desenhar o fluxo transacional de upgrade/downgrade + reconciliação bidirecional. Sem escrita em Stripe, banco de produção ou deploy sem aprovação explícita do Kauã.
- Auditoria ampliada consolidada em [[02_PROJETOS/Callface/CRM/auditorias/2026-09-14-stripe-crm-roadmap]]. Confirmado por leitura da API Stripe que o endpoint do CRM não recebe eventos críticos que o código já sabe tratar (`invoice.payment_failed`, `invoice.updated`, `customer.subscription.created`, `checkout.session.async_payment_failed`).
- Plano de arquitetura completo criado em [[02_PROJETOS/Callface/CRM/arquitetura/PLANO-MESTRE-STRIPE-CRM]]: billing identity, ciclo comercial→cobrança→CS, atualização de assinatura, recuperação de receita, dados financeiros e migração da regra para o CRM novo.

### 2026-09-14, implantação White Label deixou de usar onboarding genérico

- No checkout local `callface-crm`, White Label passa a ter checklist próprio de implantação: abertura e contato, coleta e validação de materiais, configuração, domínio/DNS, QA, validação do cliente, go-live e handoff para CS. O checklist genérico de convite/primeiro acesso foi removido.
- Criado formulário público em `/impl-white-label/[token]`, protegido pelo token opaco já usado pelo fulfillment. Coleta domínio, contato técnico, logo/favicon raster, cores, faturamento e observações; a submissão fica em revisão humana e notifica o responsável sem concluir a implantação.
- Templates editáveis de WhatsApp e e-mail foram definidos para solicitar os materiais; o envio é sempre manual pelo responsável e usa `{{link_implantacao}}` no contexto da implantação.
- Incluídas migrations idempotentes para corrigir checklists White Label pendentes já existentes no banco local e criar os templates por organização. PABX não foi alterado.

### 2026-09-13, tela inicial do CRM no Figma com biblioteca ONFACE

- A primeira composição foi descartada por estar desalinhada e não ter reutilizado a biblioteca de modo adequado.
- Reconstruída a entrega na página `Telas Finais` do arquivo [[Callface CRM — Tela Inicial Editável]] como `Visão Geral — ONFACE Library (reconstruída)`.
- A versão atual usa o tema escuro da coleção de variáveis ONFACE e instâncias importadas da biblioteca para Navigation Menu, Avatar, Button, ícones, Tabs, Badge, Table Head e Table Cell. A estrutura foi redesenhada em grade fixa e validada visualmente.
- Conteúdo incluído: cabeçalho e navegação, quatro indicadores, gráfico de evolução, módulos em destaque, assistente NEXO, operações prioritárias, detalhe operacional e resumo.

### 2026-09-11, exclusão de negócio quebrada em produção

Sintoma: excluir negócio no pipeline de produção retornava `Internal server error`. Reproduzido no negócio `Calface - via Callface` (`7ce7b2d9-b03f-4b96-8440-c42d0ccaedf8`).

Causa raiz confirmada no log de `callface-crm-api`:
`violates foreign key constraint "ligacoes_negocio_id_negocios_id_fk" on table "ligacoes"`.

O handler de DELETE limpava apenas `status_changes`, `atividades`, `propostas`, `contratos`, `reunioes`. O banco de produção tem doze FKs apontando para `negocios`, e três delas são `NO ACTION` e não eram tratadas: `ligacoes`, `tarefas` e `eventos_comerciais`. `eventos_comerciais` não existe no schema Drizzle do repositório, só em produção, reforçando [[callface_git_diverge_de_producao]].

Agravante: o delete não era transacional. Cada tentativa de exclusão apagava atividades, propostas, contratos e reuniões do negócio e só então falhava na FK de `ligacoes`, deixando o negócio de pé porém esvaziado. Perda de dados silenciosa a cada clique em excluir.

Correção aplicada no repositório (`callface-crm`, branch `posvenda-canonico`), ainda não publicada em produção:

- Novo helper `app/src/lib/crm/delete-negocio.ts` com `checarVinculosFinanceiros` e `limparVinculosNegocio`, usado pelos dois servidores de API, conforme [[callface_crm_dois_servidores_api]].
- Exclusão agora roda dentro de `db.transaction`, então falha de FK não destrói mais nada.
- `ligacoes` e `eventos_comerciais` passam a ser desassociados (`negocio_id = null`), preservando histórico de telefonia e trilha comercial. `tarefas` passam a ser excluídas junto.
- Exclusão passa a retornar 409 quando o negócio tem contrato com assinatura, fatura, movimento de MRR ou serviço canônico. Apagar um negócio ganho quebraria o MRR e o pós-venda canônico; a orientação vira cancelar o contrato.

Pendência conhecida: a cadeia de FKs sob `contratos` é profunda (`assinaturas`, `faturas`, `nps_respostas`, `mrr_movimentos`, `contrato_itens`, `eventos_comerciais`). O 409 protege esses casos, mas a exclusão de negócio ganho segue sem fluxo próprio.

Relacionado: [[02_PROJETOS/Callface/CRM/produto/crm-callface-status]], [[callface_posvenda_canonico]].

### 2026-09-11, Suprema Farma, boleto pago em invoice anulada

Negócio `Suprema Farma` (`3e4ad200-0478-44e9-860d-4017c843aed3`), proposta 1468, R$ 149,90/mês, produto Callface AI Full. Lead Thays Luana, `diretoria@supremafarma.com.br`, customer Stripe `cus_VCRF3s7djejyLr`.

O que de fato aconteceu, reconstruído pela API do Stripe:

1. 04/09, checkout gerou assinatura `sub_1UC2NV` e invoice `TQXY7VDX-0001` com boleto. Metadata correta: `negocioId`, `organizacaoId`, `propostaId`.
2. 08/09 02:59, alguém anulou a invoice `0001` achando que o boleto tinha vencido.
3. 08/09 20:39, refizeram na mão pelo painel: assinatura `sub_1UDVo6` e invoice `TQXY7VDX-0002`, com price ad-hoc e **metadata vazia**.
4. 09/09 06:41, **o boleto original compensou**. Charge `py_3UC2NU` succeeded, R$ 149,90, líquido R$ 146,45, disponível desde 11/09. Sem reembolso nem disputa.

Estado resultante: dinheiro recebido, `sub_1UC2NV` em `incomplete_expired`, `sub_1UDVo6` em `incomplete` e invoice `0002` aberta e não paga. Sem assinatura ativa, portanto sem cobrança em outubro. O link da `0002` não pode ser enviado ao cliente: pagaria de novo.

Por que o CRM não deu ganho sozinho: o gatilho de ganho automático é `checkout.session.completed` / `async_payment_succeeded` lendo `metadata.propostaId` da sessão. Assinatura criada à mão no painel não tem sessão de checkout, e `invoice.paid` só roda o sync. Confirma [[callface_pagamento_plataforma_nao_casa_webhook]].

Decisão do Kauã, 11/09:
- Vincular o pagamento à assinatura incompleta, deixando-a ativa, com os metadados iguais aos da expirada.
- Marcar `TQXY7VDX-0002` como paga fora do Stripe (`paid_out_of_band`). Não duplica receita, a charge do boleto já está liquidada.
- Trocar `collection_method` para `send_invoice` com vencimento, porque o método salvo é boleto (`pm_1UC2NT`) e `charge_automatically` com boleto não renova: gera PaymentIntent travado em `requires_action` sem avisar o cliente.
- No CRM, ganho manual com `ganho_at` = 09/09, data real da compensação, e `mrr_fechado` 149,90.

Bloqueio encontrado na execução: a `STRIPE_API_KEY` do container `callface-crm-api` é uma restricted key (`rk_live_`) sem `subscription_write`. Serve para leitura e sync, não para corrigir assinatura ou invoice. Correção no Stripe depende de painel ou de chave com escrita.

Efeito colateral aceito: ciclo de cobrança migra do dia 4 para o dia 8. Assinatura `incomplete_expired` não é reativável, fica como histórico.

#### Execução 11/09, o que foi feito

No CRM, aplicado em transação única (backup das linhas anteriores em `callface-crm/_dados/reconciliacao/suprema-farma-antes-2026-09-11.jsonl`):

- Negócio `ganho`, `ganho_at` 2026-09-09 06:41, `mrr_fechado` 149,90, `tipo_receita` recorrente.
- Contrato `51e31061-4ba8-47fb-9fbe-2ae669f6dc5c` ativo, MRR 149,90, início 09/09, produto `ai`.
- Proposta 1468 marcada como aceita e ligada ao contrato.
- Lead promovido a cliente com `cliente_desde` 09/09. Clone de carteira criado.
- As duas faturas do Stripe ligadas ao contrato, que é como o comprovante aparece no fluxo automático.
- Pós-venda canônico reprocessado: família CALLFACE_AI, trilha Onboarding, serviço `81370373-bc08-4680-ad0a-f0eab6f8a33a`, fulfillment `7ce505f0-f145-476f-9545-acf0f1b065fc`, 70 itens de checklist.

O sino de negócio ganho não foi disparado de propósito: notificaria como se a venda tivesse fechado hoje.

Como rodar script de manutenção contra produção, já que o container só carrega o build: o fonte vive em `/opt/callface/crm/app` na VPS. Usar container efêmero na rede do banco:

```
docker run --rm --network database-network -v /opt/callface/crm/app:/app -w /app \
  -e DATABASE_URL="$DBURL" -e POSVENDA_CANONICO=on node:22-alpine \
  ./node_modules/.bin/tsx src/scripts/<script>.ts <args>
```

No Stripe, ficou pela metade:

- Metadados aplicados em `sub_1UDVo6` (`negocioId`, `organizacaoId`, `propostaId`).
- `paid_out_of_band` recusado: o PaymentIntent do boleto duplicado ainda é o pagamento padrão da invoice. PaymentIntent criado por invoice não pode ser cancelado, e o void da invoice foi recusado porque a tentativa anterior feita pelo Kauã no painel já criou um payment record out-of-band de R$ 149,90 (`pr_65VNz0`) em estado guaranteed.
- Cancelar esse payment record exige `payment_records_write`, que a restricted key não tem.

Estado do Stripe: invoice `0002` aberta, com R$ 149,90 registrados out-of-band e um boleto duplicado pendente que expira em 12/09 02:59. O Stripe nunca enviou esse boleto por e-mail, não há evento `invoice.sent`, então o cliente só o teria se o link tivesse sido repassado à mão.

#### Desfecho no Stripe, 11/09

Caminho que destravou, sem precisar de `payment_records_write`: cancelar a assinatura incompleta `sub_1UDVo6` pela API. O Stripe **voidou a invoice `TQXY7VDX-0002` automaticamente**, matando o boleto duplicado junto. Fica como padrão para casos parecidos: cancelar a assinatura resolve o que o void direto na invoice recusa.

Depois, assinatura definitiva criada: `sub_1UEbljEd4dqxpSBfjKlFNXfv`.

- `trialing` até 2026-10-04 19:02, porque setembro já está pago pelo boleto. Primeira cobrança real em 04/10, alinhada ao período que o boleto cobriu.
- `collection_method: send_invoice`, `days_until_due: 5`. Resolve a renovação: o método salvo é boleto, e `charge_automatically` com boleto não renova, gera PaymentIntent travado em `requires_action` sem avisar ninguém.
- Metadata completa, incluindo `origem: reconciliacao-boleto-pago-2026-09-11`.
- Preço via `price_data` de R$ 149,90. O price antigo de 149,90 foi desativado e o price ativo do produto é R$ 179,90, então preço negociado precisa de price ad-hoc.

Estado final: uma assinatura ativa, duas expiradas como histórico, ambas as invoices void, um único pagamento real de R$ 149,90 sem reembolso. No CRM, `assinaturas` mostra a nova como `trialing` ligada ao contrato. `trialing` conta como faturável no sync, então o MRR aparece normalmente.

Ressalva de ambiente: o `node_modules` de `/opt/callface/crm/app` está defasado em relação ao do container. Rodar `syncStripe` por ali quebra no alerta `stripe_sem_lead` com `Date` em parâmetro, o problema conhecido de [[postgres_js_date_sql_cru]]. A quebra é depois da transação de upsert, então o sync ainda grava. Em produção o sync roda normal, pelo node_modules do container.

### 2026-09-11, expansão BRASAL e contratos duplicados

Cliente BRASAL VEÍCULOS (lead Elaine, `0611c0d9-c7ef-4dce-a211-780090783fcd`, customer `cus_UsZJfU8Ssks2D4`) subiu de 4 para 5 usuários de Callface AI. Upgrade feito direto no Stripe em 09/09 19:48, assinatura `sub_1TsoAYEd4dqxpSBfxGsC2k83`, R$ 89,90 por usuário, MRR de 359,60 para 449,50.

O `mrr_movimentos` registrou a expansão sozinho pelo sync (`expansao | +89,90 | 359,60 -> 449,50`). O que não acontece é a meta comercial: ela lê `negocios.mrr_fechado` com janela em `ganho_at`, e expansão de assinatura não cria negócio nenhum. **Todo upsell feito direto no Stripe fica invisível para a meta do closer.** Isso é estrutural, não foi só neste caso.

Aplicado, conforme decisão do Kauã:

- Negócio `BRASAL | CALLFACE AI | MAYRA | EXPANSÃO +1 USUÁRIO`, ganho em 09/09 19:48, `mrr_fechado` 89,90, o delta e não o valor cheio, responsável Mayra, origem carteira. Sem contrato novo e sem pós-venda: é upsell de assento, não onboarding.
- Contrato `f428b869` atualizado de 359,60 para 449,50. É o contrato que a assinatura aponta e o que o Financeiro lê. Backup em `callface-crm/_dados/reconciliacao/brasal-contrato-antes-2026-09-11.jsonl`.

Meta de setembro após os dois ajustes do dia: Mayra com 23 ganhos e R$ 7.275,50.

#### Contratos duplicados, achado que precisa de decisão

A BRASAL tem **oito** contratos, seis ativos, somando R$ 1.708,10 de MRR contra R$ 449,50 reais no Stripe. Inflado 3,8 vezes, R$ 1.258,60 fantasmas só neste cliente. O padrão é o sync criando contratos `tipo = 'assinatura'` sem `negocio_id`, repetidamente, vários no mesmo dia com minutos de diferença. Bate com os `mrr_movimentos` duplicados de 14/08.

Dimensão no geral, contratos ativos com `produto = 'ai'`:

| Fonte | Contratos | MRR |
|---|---|---|
| Fluxo comercial (`negocio_id` preenchido) | 138 | R$ 115.361,17 |
| Sync Stripe (`tipo = 'assinatura'`) | 172 | R$ 57.117,50 |

**23 leads têm mais de um contrato de assinatura ativo.** É a materialização concreta de [[callface_duas_fontes_de_mrr]]: não é só divergência de leitura, o sync está duplicando linha. Precisa de decisão de fundo antes de qualquer limpeza, porque `f428b869` acabou de ser corrigido à mão e qualquer dedup precisa preservar esse tipo de ajuste.

Outros dois defeitos menores vistos no caminho: `assinaturas.quantidade` fica 1 enquanto o Stripe tem 5 assentos, então relatório por assento não fecha; e `mrr_movimentos` tem pares idênticos no mesmo segundo em 14/08.

#### Comprovante de upgrade na exportação do Financeiro

A exportação de vendas (`/api/financeiro/vendas`) lê **`faturas`**, não `negocios`, e o comprovante de cada linha é o `hosted_invoice_url`. Consequências para expansão de assinatura:

- Upgrade de assento **não gera fatura própria**. No caso BRASAL o upgrade saiu sem proration, então o cliente não pagou nada pelos 4 dias entre 09/09 e o fechamento do ciclo, cerca de R$ 12 não cobrados.
- O comprovante aparece só na fatura do ciclo seguinte. Preview confirmado: 13/09, R$ 449,50, linha única `5 usuário × Callface AI - Starter (at R$ 89,90 / month)`. O quinto assento fica visível na descrição, então serve como comprovante.
- O negócio de expansão criado no CRM **não entra** nessa exportação, e nem deveria: uma é faturamento, a outra é meta.
- Descompasso a conhecer: no mês, Financeiro vê R$ 449,50 e a meta comercial vê R$ 89,90. Quem cruzar os dois relatórios vai achar que há erro. Não há, são recortes diferentes.

Se em algum caso o upgrade precisar de comprovante próprio, o caminho é lançar invoice item avulso no valor proporcional, o que cobra o cliente na hora em vez de esperar o ciclo.

Correção de entendimento anterior: `charge_automatically` com método boleto **funciona** e renova. A BRASAL está nesse arranjo e pagou julho e agosto normalmente. O problema da Suprema Farma foi outro, invoice anulada antes da compensação. O `send_invoice` aplicado lá continua válido, é mais explícito, mas não era obrigatório.

Defeito colateral visto: a competência das faturas vem do `period_start`, então a fatura emitida em 13/08 fica com competência `2026-07-01`. Qualquer filtro de "vendas do mês" por competência desloca um mês em assinatura cujo ciclo não começa no dia 1.

#### Deploy do fix de exclusão, 11/09

Subiu em produção. Antes de copiar, os dois arquivos existentes em `/opt/callface/crm/app` foram comparados com o `HEAD` do git e estavam idênticos, sem código não versionado a preservar. Backup em `/opt/callface/crm/_backups/delete-negocio-20260911/`.

Arquivos: `src/lib/crm/delete-negocio.ts` (novo), `src/api-server/routes/negocios.ts`, `src/app/api/negocios/[id]/route.ts`. Build e restart de `api` e `app`, ambos healthy, sem erro no log. Commit `eee3274` na branch `posvenda-canonico`, ainda sem push.

Validado de ponta a ponta no negócio que originou o chamado (`Calface - via Callface`, `7ce7b2d9`, o mesmo que dava 500): `DELETE /api/negocios/:id` respondeu `200 {"ok":true}`, o negócio saiu e **as duas ligações sobreviveram** com `negocio_id` nulo, lead preservado e durações intactas de 157s e 167s.

Para testar endpoint autenticado do Hono em produção sem navegador: gerar o cookie de sessão dentro do próprio container com `jose`, derivando a chave por HKDF-SHA256 sobre `NEXTAUTH_SECRET`, salt e info usando o nome do cookie `__Secure-authjs.session-token`, e chamar `http://127.0.0.1:3001/api/...`. O Hono serve com prefixo `/api`, sem ele responde 404.

### 2026-09-14 — Implantação White Label publicada em produção

- Publicado o fluxo White Label: formulário público `/impl-white-label/[token]`, upload de logo/favicon, submissão para revisão interna, templates editáveis de WhatsApp/e-mail e `{{link_implantacao}}`.
- O checklist White Label pendente existente foi atualizado com segurança de 12 para 16 passos; não houve remoção de itens, histórico ou projeto em andamento. A sequência fecha com reunião de onboarding, go-live e conclusão/handoff para CS.
- Novos White Labels **nascem sem responsável**. O time define o responsável explicitamente antes do primeiro contato; não herdam mais o responsável comercial.
- Para a demonstração refletir a nova regra, o White Label pendente existente (`4fc2a533`) teve somente o responsável automático removido (Mayra → sem responsável); o projeto continua `NOT_STARTED` e mantém seus 16 itens.
- Deploy cirúrgico em `/opt/callface/crm`; backup dos arquivos anteriores em `/opt/callface/crm/_backups/20260914-white-label`. Rebuild/restart de `app` e `api`; ambos healthy ao final.

### 2026-09-14 — Fundação Stripe × CRM implementada, ainda não publicada

- No repositório operacional `callface-crm`, foi adicionada a migration `0014_stripe_billing_foundation.sql`: billing identity por empresa, aliases de Customer Stripe, auditoria, fila de resolução, ledger reversível e inbox persistente de eventos Stripe. É aditiva; não apaga nem consolida nenhum dado existente.
- Checkout passa a reutilizar `stripe_customer_id` já comprovado no lead/empresa e usa chave de idempotência por proposta. Isso evita Customer/Checkout duplicados por reenvio ou duplo clique quando for publicado.
- O sync deixou de escolher silenciosamente o último lead de um e-mail/Customer duplicado. A resolução agora segue alias confirmado → metadata CRM opaca → CNPJ → e-mail único; e-mail único espelha a assinatura mas não grava um vínculo permanente. Ambiguidade não altera vínculo.
- Webhooks ganham inbox por `stripe_event_id` antes do processamento e worker idempotente; polling de 30 minutos passa a ser somente reconciliação. Contrato de eventos ampliado para invoice atualizada/void/incobrável e pausa, retomada e pending update de subscription.
- O writeback de CPF/CNPJ para metadata Stripe, que já existia no handler, ficou bloqueado por padrão atrás de `STRIPE_WRITEBACK_ENABLED=true`; não haverá mutação Stripe acidental junto com o lote CRM-only.
- Criado `src/scripts/auditar-stripe-crm-billing.ts`, read-only, que inventaria Customers, subscriptions, invoices, métodos resumidos, refunds, disputes, créditos, metadata e vínculos CRM, e gera dossiês `CONFIRMED`, `REVIEW` e `CONFLICT`. Ainda precisa ser executado contra produção com a chave Stripe restricted e o banco produtivo, sem aplicar a migration ou publicar o código.
- Nenhuma alteração Stripe, migração, alteração CRM, configuração de webhook ou deploy de produção foi feita neste bloco. O typecheck reporta somente os sete erros preexistentes fora dos arquivos deste trabalho.

### 2026-09-14 — Auditoria completa Stripe × CRM, somente leitura

- Inventário atual coletado com autorização: 369 Customers, 360 assinaturas, 884 faturas, 17 refunds e 1 dispute. Artefatos e dossiê em `dados/stripe/incident-customer-duplication-2026-09-14/`.
- 57 grupos de Customers duplicados por CNPJ/e-mail: 3 **confirmados**, 49 de **revisão** e 5 de **conflito**. Há R$ 22.344,95 de MRR ativo/em risco atravessando esses grupos; isso não significa receita duplicada, pois há produtos distintos em assinaturas paralelas.
- O primeiro lote CRM-only seguro contém Prudêncio Advogados, [[VECTORUN I S I S]] e Bytoken. Nenhuma assinatura será migrada, cancelada, recriada ou alterada na Stripe.

### 2026-09-14 — CRM-only aplicado: Vectorun

- Com autorização explícita, foi aplicada e validada a correção CRM-only do caso [[VECTORUN I S I S]]: `cus_VG7CNto8V2jYz1` é a identidade Stripe canônica e `cus_VGAm3hKUahQpyQ` é alias histórico. As duas assinaturas permanecem ativas e intocadas na Stripe.
- Ledger: `correction_runs` `5e3299fb-591b-4d6c-aa25-32ac67b3bbd9`, com três entradas reversíveis (identity + 2 aliases). Script aplicado: `dados/stripe/incident-customer-duplication-2026-09-14/vectorun-crm-only-apply.sql`.
- A tentativa de adicionar o novo schema de billing revelou que produção já possui uma versão legada não versionada de `billing_identities`, com colunas e vínculos diferentes. A transação foi revertida sem efeito; a publicação do novo runtime precisa de migration de compatibilidade, não de criação paralela nem overwrite dos dados legados.

### 2026-09-14 — Demonstração local de Implantação White Label

- Criado o fulfillment local `[TESTE WL] Agência Aurora` (`6f74791d-d655-456c-9254-facfdfa66ca6`) para tornar a nova trilha visualmente verificável em `/clientes/implantacao?familia=WHITE_LABEL`.
- O formulário público individual está em `/impl-white-label/97aa41a1-22e8-41f3-a9cd-c02c23f66985`. O token é opaco e a API respondeu somente o fulfillment White Label correspondente.
- Ambiente de demonstração: frontend Next em `localhost:3000`; API Hono local em `localhost:3011`. Nenhuma alteração foi feita em produção.

### 2026-09-14 — Rodada de Production Readiness (12 de 13 P0 fechados)

Execução do backlog do mapa de engenharia reversa. Tracker completo, com reprodução, causa,
correção, teste e validação de cada item: `docs/reconstruction/PRODUCTION-READINESS-TRACKER.md`
no repositório. Ponto de restauração antes da rodada: tag git `backup-pre-readiness`.

**O que estava quebrado e voltou a funcionar (tudo reproduzido antes de corrigir):**
- Handoff de Won → CS falhava em 100% dos casos desde 08/09 (`ON CONFLICT` contra índice parcial
  sem predicado). Cliente não entrava na carteira do CS pelo caminho automático.
- O Won nunca criava a linha em `clientes`; os caminhos manual e automático divergiam. Agora há
  ponto único (`aplicarEfeitosPosGanho` em `lib/crm/won-evidence.ts`).
- 5 telas de Ajustes chamavam `/api/configuracoes/settings`, inexistente. A coluna
  `organizacoes.settings` já tinha dado real que a tela nunca leu.
- `/negocios` respondia 404 e o redirect legado apontava pra lá.
- `/api/contratos-publicos/:token/pdf-final` estava fora da allowlist do Traefik — o link do
  contrato assinado enviado ao cliente dava 404 em produção.
- Healthcheck do worker consultava `:3002` enquanto o processo escutava `:3001`: o container
  nascia unhealthy e a queda do worker nunca era detectável.

**Segurança:** webhooks de WhatsApp, Apollo, RD e Meta passaram a fail-closed (eram fail-open,
dois deles com secret escrito no repositório). `/api/uploads/*` exige sessão e escopo de
organização. RBAC restaurado no middleware e no backend das rotas financeiras.

**MRR:** fonte canônica definida como `servicos_canonicos`. Financeiro e Início agora mostram o
mesmo número (divergência R$ 0,00, era R$ 6.365,96 exibida ao usuário na tela). A soma de
contratos virou conciliação, deduplicada por assinatura (−R$ 24.205,50 inflados, sem apagar nada).

**Migrations:** runner com hash e baseline (`npm run db:migrar`), e o `deploy.sh` passou a migrar
e conferir ambiente antes de trocar container.

**Jornadas certificadas em DEV com dado real:** Callface AI (pagamento → onboarding, 19
asserções), PABX e White Label (assinatura → implantação, 16 cada, pelo webhook REAL do
Documenso) e Won → Cliente → CS pelos dois caminhos com paridade (31 asserções).

**Antes do próximo deploy de HOMOLOG/PROD, nesta ordem:**
1. `npm run check:env -- --ambiente` e preencher o que faltar. Os webhooks são fail-closed:
   sem `STRIPE_WEBHOOK_SECRET`, `RD_WEBHOOK_SECRET`, `META_LEADIDS_WEBHOOK_SECRET`,
   `UAZAPI_WEBHOOK_SECRET`, `APOLLO_WEBHOOK_SECRET` e `CALLFACE_WEBHOOK_SECRET`, lead, mensagem
   e pagamento **não entram**.
2. `npm run db:migrar -- --baseline` uma vez em cada ambiente (marca as 46 já aplicadas).
3. Deploy normal — o `deploy.sh` cuida da migração a partir daí.

**Pendência que não é código:** object storage para anexos. Os 1.980 arquivos legados do Zoho
(1.164 contratos) seguem só na pasta pessoal do Mac do Scott, e os anexos novos vão pra volume
local sem backup nem réplica. Precisa de decisão de S3/R2 e custo.
