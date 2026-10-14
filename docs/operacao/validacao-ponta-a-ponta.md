# Validação ponta a ponta do fluxo comercial (13-14/10/2026)

Ambiente: **homologação** (`https://dev.crm.callface.io`, `/opt/callface/crm2-homolog`, banco `callface_crm_mz`). Versão validada: `1508bb3` (publicada com `./deploy.sh homolog`; estava em `541f8cd`). Nada em produção. Nenhuma escrita no Stripe. E-mail só `@callface.ai`. Travas intactas (`WHATSAPP_ALLOWLIST=0000000000`, `EMAIL_ALLOWED_DOMAINS=callface.ai`).

Método: as ações de domínio (criar oportunidade e proposta, enviar) rodaram no worker da homologação com o código do `1508bb3`; **o aceite foi a rota HTTP pública real**; o Documenso real criou os envelopes e mandou os webhooks reais (`DOCUMENT_OPENED`, `DOCUMENT_SIGNED`, `DOCUMENT_RECIPIENT_COMPLETED`) para a homologação. A conclusão (`DOCUMENT_COMPLETED`) foi **simulada**, postada na rota real `/api/webhooks/documenso` com o segredo real, porque ninguém assinou o lado Callface (ver "Não testado").

## Resultado

| # | Item | Resultado |
|---|---|---|
| 1 | Bug "assino em dois cantos" | **Não é duplicação. É o desenho, disparado pelo teste** (mesmo e-mail em dois papéis). Defeito vizinho achado e corrigido (item 1b) |
| 1b | Webhook apagava papel e link de assinatura | **FALHOU, corrigido** (já em `main`, ver abaixo; falta deploy para provar) |
| 2a | Proposta por e-mail | PASSOU |
| 2b | Proposta por WhatsApp | PASSOU (bloqueio explícito, mas pela sessão, não pela allowlist) |
| 2c | Aceite gera contrato e aciona o Documenso | PASSOU (8 a 21 s síncrono) |
| 2d | Lembrete de assinatura | EXISTE no Documenso; o ONFACE não tem o seu e **ignora o aviso** |
| 2e | Webhook de assinatura registra quem e quando | PASSOU (papel só depois da correção 1b) |
| 2f | Cópia final guardada | **FALHOU**: o ONFACE não guarda o PDF, busca sob demanda no Documenso |
| 2g | Aviso ao time + e-mail final | PASSOU |
| 3a | Ganho grava `mrr_fechado` e `valor_setup` | PASSOU |
| 3b | Uma entrega por venda | PASSOU |
| 3c | Serviço canônico, Cliente 360, CS | PASSOU (ressalva: health do CS no White Label) |
| 3d | Recebível separado | PASSOU |
| 3e | Upgrade | Gera o termo aditivo e fecha. **D11 continua**: soma em vez de substituir |
| 4 | Webhooks do Stripe | **Chegam. FALHAM em desempenho**: 45% dos envios estouram o prazo do Stripe |

## 1. Os dois signatários

**Esperado.** O contrato tem 3 lugares de assinatura: o cliente (`contratante`), o representante legal da Callface (`representante_legal`, âncora `cf-sig-contratada`) e a testemunha vendedor (`testemunha_vendedor`, âncora `cf-sig-testemunha-1`). Cada e-mail **diferente** vira um destinatário do Documenso com **um** campo, recebe o próprio e-mail "Assine" e assina em paralelo. O contrato só conclui quando todos assinam. Um e-mail **igual** em mais de um papel vira **um** destinatário com **vários** campos (`lib/crm/signature/documenso-provider.ts:86-93`, comentado no código).

**O que acontece, com banco do Documenso.**

| Caso | Contrato | Destinatários | Campos |
|---|---|---|---|
| 3 e-mails diferentes | `16f25ef9-fd9e-4d15-b064-a945bf903db5` (P-1577) | 13 (cliente), 14 (rep.), 15 (vendedor) | 1 cada, na página 9 |
| mesmo e-mail em cliente, vendedor e rep. | `5bce5437-19bc-417c-8496-6dddef718644` (P-1580) | **22, um só** | **3 campos de assinatura** (`y=37.9 x=51.9`, `y=37.9 x=9.8`, `y=49.0 x=8.1`) |

**Causa do relato do dono.** A testemunha "vendedor responsável" não é removível na tela (`components/onface/proto/PropostaLiga.tsx:696`, `rem=false`) e o representante legal vem do padrão de Ajustes > Contratos. Quando o dono testa como se fosse o cliente, o mesmo e-mail ocupa cliente + vendedor (e às vezes o representante): é uma pessoa assinando em 2 ou 3 cantos. Com cliente real, o cliente vê **um** campo (comprovado em P-1577, destinatário 13) e a Callface recebe e assina à parte.

**Não é defeito de duplicação.** O que falta é aviso: a tela deveria alertar "o e-mail do cliente é o mesmo de um assinante da Callface" e o vendedor deveria poder sair da lista. Decisão de produto, **não alterei**.

**Dois pontos de atenção do desenho.** (1) A Callface assina **em paralelo** com o cliente (`signingOrder PARALLEL`), então o representante recebe o convite junto, sem esperar o cliente. (2) O contrato só vira Ganho quando **todos**, inclusive a Callface, assinaram.

### 1b. Defeito encontrado e corrigido: o webhook apagava papel e link

`app/src/app/api/webhooks/documenso/route.ts` (linhas originais 96 e 107) gravava `contratos.signatarios = recipients` do Documenso, que só traz nome, e-mail e status. Prova em P-1577 depois do primeiro `DOCUMENT_SIGNED`: `papel` vazio e `signingUrl` ausente nos 3 destinatários. Efeitos: (a) a página pública perde o botão "Assinar" (`api-server/routes/propostas.ts:559-564` lê `signingUrl`); (b) o registro final não diz quem assinou como quê (cliente, representante, testemunha); (c) `ehCliente()` passa a tratar todo mundo como cliente.

**Correção** (um arquivo): `mesclarSignatarios(contract.signatarios, recipients)` mantém papel, ordem e link nossos e sobrepõe o status do Documenso; e-mail repetido guarda `papeis: [...]`. Idempotente (conferido com amostra no esbuild). **Não provada em homologação:** a correção já está na `main` (entrou no commit `154ed05` de outra frente, que varreu o arquivo) mas a homologação roda `1508bb3`. Depois do próximo `./deploy.sh homolog`, repetir: assinar um lado e conferir `select s->>'papel', s->>'signingUrl' from contratos, jsonb_array_elements(signatarios) s`.

## 2. O ciclo do documento

**2a. E-mail da proposta.** P-1577, proposta `5cb645a7-bdbc-43d8-872e-10de0f50af58`. Linha de `emails` `2147fdaf`, `status sent`, via Resend (`Callface <no-reply@callface.ai>`), Resend `delivered` ("Entregue ao servidor do destinatário"). Antes, a tentativa pela caixa do usuário falhou (`Access token is undefined`, esperado: a homologação não tem token) e caiu no Resend com aviso na atividade. Link `https://dev.crm.callface.io/p/<id>` abre (HTTP 200).

**2b. WhatsApp.** Saída em todas as propostas: `whatsapp: "desconectada"`, atividade "WhatsApp NÃO enviado (O número "Scott Corporativo" está desconectado... Reconecte em Ajustes > WhatsApp)". Mensagem clara, registrada na linha do tempo, nada saiu. **Ressalva:** o bloqueio vem da sessão desconectada (`lib/whatsapp/enviar.ts:306-307`), não da allowlist. Tentei forçar a sessão para `connected` e exercitar `checarAllowlist` (`lib/whatsapp/client.ts:68-88`); o sistema de permissões negou, não contornei. Pelo código, com sessão conectada a mensagem é **enfileirada** (`registrarEEnfileirarEnvio`) e o envio só barra no worker (`worker/index.ts:2552` em diante), que marca a mensagem `failed`; ou seja, a tela de envio da proposta diria "enviado" e a falha apareceria só na conversa. Em produção (allowlist vazia) não se aplica.

**2c. Aceite, contrato, Documenso.** Aceite pela rota HTTP pública real (`POST /api/propostas/:id/aceitar-publico`), 200, devolvendo `proximoUrl` do Documenso. PABX 3 itens: contrato `92fafc92-da83-4154-bba1-8b88b207016c`, envelope `envelope_xvyuhrhmtvbzoasd`. White Label: `8bdd32c3-82f2-4147-8a46-05b66bea728a`. Todos com `sendStatus SENT` no Documenso. **A chamada leva 8 a 21 s** (PDF + Documenso na mesma requisição); o log do Traefik mostra a rota com 21078 ms. Sem indicador na tela, é convite a clique duplo. O aceite é idempotente (segundo clique devolveu 400 "não está mais aguardando resposta").

**2d. Lembrete de assinatura.** O ONFACE **não tem**: sem agendamento no worker (`worker/index.ts` só tem `retomar-aceites` e `follow-up-proposta`, este para proposta parada) e o webhook não trata `DOCUMENT_REMINDER_SENT` (assinado nos dois webhooks, ignorado em `route.ts`). **O Documenso tem**, nativo: `OrganisationGlobalSettings.reminderSettings = {sendAfter: 5 dias, repeatEvery: 2 dias}` e validade `3 meses`. Provado nos envelopes: `Recipient.nextReminderAt = 2026-10-19`, `reminderCount 0`, `expiresAt 2027-01-12`. Consequência: o lembrete sai **a partir do 5º dia** e ninguém no ONFACE fica sabendo (nem linha do tempo nem aviso ao vendedor); `RECIPIENT_EXPIRED` é tratado e marca o contrato inteiro como expirado. Lembrete antes de 5 dias ou aviso interno exige código novo.

**2e. Webhook e quem assinou.** Webhooks cadastrados no Documenso (leitura do banco do Documenso): `https://dev.crm.callface.io/api/webhooks/documenso` (desde 29/09) e `https://crm.callface.io/api/webhooks/documenso` (13/10), ambos com os mesmos 14 eventos. Reais recebidos na homologação para P-1577: `event_outbox` `SignerViewed` 00:09:22 (`DOCUMENT_OPENED`), `SignerSigned` 00:10:03 (`DOCUMENT_RECIPIENT_COMPLETED`) e 00:10:04 (`DOCUMENT_SIGNED`); contrato `partially_signed`, destinatário 13 `SIGNED`, `signedAt 2026-10-14T00:10:02.359Z`. Conclusão simulada em `92fafc92`: `signature_status signed`, `assinatura_status assinado`, `status ativo`, `assinado_em 00:21:54`, `assinado_nome "VALIDACAO-E2E-Contato SIM-E, Representante Teste, Vendedor Teste"`, `signatarios` com `signedAt` de cada um, `documento_final_url /api/contratos/<id>/pdf-final`. Segundo envio do mesmo `DOCUMENT_COMPLETED` devolveu `{"duplicate":true}` e não repetiu nada.

**2f. Cópia final.** **FALHOU.** `documento_final_url` e o link do e-mail apontam para uma rota que baixa **sob demanda** do Documenso (`documenso-provider.ts:204`, usado só em `api-server/routes/contratos.ts:243` e `app/api/contratos-publicos/[token]/pdf-final/route.ts:31`). Nenhum PDF assinado é gravado no ONFACE/acervo. Se o envelope sumir ou o Documenso cair, a cópia assinada some (auditorias anteriores já excluem envelopes na API). Recomendação: baixar e guardar o PDF no `DOCUMENT_COMPLETED`. **Não provei o download:** o envelope da simulação não está `COMPLETED` no Documenso.

**2g. Aviso ao time e e-mail final.** Em `92fafc92`: notificações `contrato_assinado`, `negocio_ganho` e `pagamento_pendente` (uma por usuário do time), atividades "Contrato assinado", "Negócio ganho" e "Cópia final do contrato entregue ao provedor de e-mail". E-mail final: **um** e-mail "Contrato Callface concluído" para os 3 signatários (inclusive a Callface), `email_entrega.status sent`, `emails` `fe9e098a`. Os endereços da simulação não existem, então o Resend marcou `suppressed` e a ficha mostra "NÃO CHEGOU: o endereço está bloqueado". Isso valida a detecção, não a entrega boa (já provada com a proposta, 2a).

## 3. Depois do Ganho (por assinatura de contrato)

**3a. Valores.** PABX 3 itens, negócio `3d2a826d-ade0-40ee-92fb-0bc25a918672`: `etapa ganho`, `mrr_fechado 760.00`, oportunidade `mrr 760.00`. White Label, negócio `4ea0f5b1-9edd-46ed-90df-ce85b2c1af0f`: `mrr_fechado 1000.00`, `valor_setup 500.00`, oportunidade `setup_estimado 500.00`. A soma de `mrr_fechado + valor_setup` por responsável no mês (`lib/metas.ts:27`) já inclui esses valores (Kauã: 6182.10 de MRR e 831.70 de setup no mês, dos quais 1760.00 e 500.00 são destes testes).

**3b. Uma entrega por venda.** PABX com 3 itens: **1** fulfillment `adee3728` cobrindo 3 serviços (`fulfillment_servicos`), 51 itens de checklist. White Label (licença + setup): **1** fulfillment `adac175e`, 2 serviços, 16 itens.

**3c. Serviço, Cliente 360, CS.** Serviços canônicos com produto, valor e quantidade: `PABX - BINA Inteligente 1/2/3`, valores 100/240/420, quantidades 1/2/3, `portfolio_included true`, `ACTIVE`. White Label: Licença 1000.00 (qtd 10) e Setup (MRR 0, qtd 1). `empresa360` da empresa: `relacionamento "Cliente"`, 3 serviços. `leads.tipo cliente`, `clientes.status_financeiro ativo`. `cs_marcos` 7 linhas nos dois. Ressalva: `cs_health_snapshots` 1 no PABX e **0 no White Label** na hora da leitura; provavelmente o job `cs-sweep` (de hora em hora), não provei. A materialização de serviço e entrega é **assíncrona**: ganho às 00:21:55, serviços às 00:24:03 (varredura do outbox).

**3d. Recebível separado.** `faturas.external_id`: PABX `CRM2:<grupo>:MRR` R$ 760.00; White Label `CRM2:<grupo>:MRR` R$ 1000.00 **e** `CRM2:<grupo>:SETUP` R$ 500.00, duas linhas, `aberta`, vencimento 29/10.

**3e. Upgrade** (P-1583, `9e05a538-a46f-4499-9165-4d4470e43c49`, `tipo_contratual UPGRADE`, base `92fafc92`). O contrato sai como "Termo aditivo PABX · ... · P-1583-v1" e cita a proposta base `P-1582-v1`. Fechou por assinatura (simulada). Defeitos já conhecidos, confirmados: D11 (o serviço novo entra **ao lado** dos três antigos: 4 serviços ativos, sem `SUPERSEDED`) e `contratos.produto = 'ai'` num contrato PABX. Novo: o upgrade abriu uma **segunda entrega completa** (`b034b9ee`, 51 itens, `fulfillment_anterior_id` preenchido, nenhuma etapa herdada porque a anterior não começou). A tela só emite `NOVO_CONTRATO` (`docs/produto/upgrade-e-cross-sell.md`), então este caminho só existe por script.

## 4. Stripe

**Os webhooks chegam.** Endpoint `we_1TjdWrEd4dqxpSBfkUfCj8QE`: `enabled`, 31 eventos, `https://crm.callface.io/api/webhooks/stripe`, API `2025-06-30.basil` (leitura de `GET /v1/webhook_endpoints`; os outros dois endpoints da conta são o Spedy e o SaaS). No Traefik, **93 `POST /api/webhooks/stripe` em 13/10, das 13h às 23h UTC**, IPs do Stripe, o último às 23:28 UTC (20:28 em Brasília). Assinatura válida (inválida daria 400).

**Mas 45% estouram o prazo.** 42 dos 93 terminaram em **499** (o Stripe desistiu) com 19,8 a 21,7 s; 51 respostas de 75 bytes são `duplicate` (reentrega de evento que já tinha sido processado depois do corte). Só 13 voltaram 200 com corpo de evento novo.

**Causa.** `lib/integrations/stripe-webhook-processor.ts:158` roda `deps.sync(org)` (`syncStripe`, a sincronização inteira da conta) e `:194` roda `recalcular(org)` **dentro da requisição**, para todo evento fora de `SEM_SYNC` (`:52`). No inbox copiado para a homologação (`stripe_webhook_events`, 737 eventos) o tempo de processamento desde o recebimento é de média 24 a 41 s e máximo 65 s para `invoice.*` e `customer.subscription.*`. Rajadas de 4-5 eventos no mesmo segundo rodam 4-5 sincronizações completas ao mesmo tempo. Nenhum dado se perde (`app/api/webhooks/stripe/route.ts:~88` grava o evento no inbox antes de processar; todos os 737 estão `processed`), mas cada evento aparece como **falha** no painel do Stripe e se reentrega. Risco real: o Stripe desativa endpoint com falha continuada. Correção proposta (não feita, mexe em desenho): gravar no inbox, responder 200 e processar na fila `stripe-webhook-events`, que já existe (`worker/index.ts:147`).

**Por que o dono viu "nenhum evento hoje".** Não consigo afirmar sem o banco de produção (não toquei). O que vi: eventos chegaram o dia inteiro, mas o painel do Stripe os mostra como falhos/atrasados e o ONFACE só os processa 25 a 65 s depois, às vezes só na reentrega.

## Não testado e por quê

- **Assinatura real do lado Callface e a conclusão real.** O lado do cliente foi assinado de verdade por alguém durante a minha execução (P-1577, 1578, 1579, 00:10 a 00:14); os lados Callface ficaram sem assinar. Assinar os convites eu mesmo exigiria agir como destinatário no Documenso compartilhado; não tentei. Por isso `DOCUMENT_COMPLETED` foi simulado e **o PDF final, o download e o e-mail final com endereço real não foram provados**. P-1577 a P-1580 estão prontos para o dono concluir pela caixa de `kaua.araujo+e2e-*@callface.ai`.
- **Allowlist do WhatsApp** com sessão conectada (negado pelo ambiente de permissões, ver 2b).
- **Telas do Builder e da ficha** (exigem login). **Celular.**
- **Confirmação do Stripe do lado do Stripe** (lista de eventos e tentativas): a leitura via chave do `.env` foi negada; usei só a lista de endpoints e o log do Traefik.
- **Correção 1b em homologação** (precisa de deploy).
- **Banco de produção** (intocado por regra): a contagem de eventos Stripe em produção sai só do Traefik.
- **Três sinais de ação humana paralela** apareceram no log: GET/POST do IP do dono (aceite de P-1577 e P-1578 que não foram meus) e navegação em `sign.callface.io`. Não interferi.

## Registros de teste deixados (prefixo `VALIDACAO-E2E-`)

Propostas/negócios/contratos na homologação (cópia do banco; some no próximo `recarregar-banco`):

| P | Proposta | Negócio | Contrato | Envelope Documenso |
|---|---|---|---|---|
| 1577 | `5cb645a7-bdbc-43d8-872e-10de0f50af58` | `3ef206ad-c493-4849-a8f3-b3e9e0b57754` | `16f25ef9-fd9e-4d15-b064-a945bf903db5` | `envelope_blcrtbziskcofuzv` **pendente (cliente já assinou)** |
| 1578 | `d9ca9b75-92b1-4f29-a27c-44434d81d3a4` | `3b0d1dd9-9222-430b-a5b1-0080a7e7696a` | `ac908114-bef5-45bf-a65f-7b2c8fcf4030` | `envelope_wfvmcavhvyyyxrez` **pendente** |
| 1579 | `aac14ee5-809c-44f2-8570-5d4c7d345d53` | `d8d12ece-ed1e-447f-b1ae-b3686efa5596` | `be033b7b-7d72-4b93-85b1-5ebf46768f50` | `envelope_wraybduldfymhorn` **pendente** |
| 1580 | `014f4319-e29a-455c-b69b-3a1db1dbcce0` | `04a008bd-246d-4414-b4ff-a448b1965690` | `5bce5437-19bc-417c-8496-6dddef718644` | `envelope_xfsirnhdohszabon` **pendente (caso "mesmo e-mail")** |
| 1581 | `c771c232-3465-45d7-af76-2f40654050fa` | `4ea0f5b1-9edd-46ed-90df-ce85b2c1af0f` | `8bdd32c3-82f2-4147-8a46-05b66bea728a` | excluído |
| 1582 | `dd2355d0-40e2-4f44-b932-5b84153c6105` | `3d2a826d-ade0-40ee-92fb-0bc25a918672` | `92fafc92-da83-4154-bba1-8b88b207016c` | excluído |
| 1583 | `9e05a538-a46f-4499-9165-4d4470e43c49` | `11e21818-af23-4fc5-a272-b12580fd4c66` | `90290ff7-ad84-4ddb-8d34-e39182dc0cd1` | excluído |

- Os 4 envelopes **pendentes** vão disparar lembrete do Documenso em 19/10 para `kaua.araujo+e2e-*@callface.ai` (que cai na caixa do Kauã). Concluir a assinatura ou excluir pela API do Documenso.
- Empresas `VALIDACAO-E2E-*` (7, uma delas de uma execução que falhou antes de criar proposta). Os rótulos `---itens` das propostas 1578, 1579 e 1581 vêm de um erro meu de argumento no script; os dados estão corretos.
- Os envelopes excluídos e os 4 pendentes geraram eventos (`CREATED`, `SENT`...) também para o webhook de produção (`crm.callface.io`), que responde 202 "unresolved" para envelope desconhecido.
- E-mails enviados: 6 e-mails de proposta e 4 envelopes reais (3 convites cada) para `kaua.araujo+e2e-*@callface.ai`; os cenários simulados (P-1581 a P-1583) foram para `validacao-e2e-sim-*@callface.ai`, que não existem (ficaram `suppressed`).
- Script de teste fora do repositório; removido do worker da homologação.
