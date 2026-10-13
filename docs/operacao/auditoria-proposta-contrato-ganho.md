# Auditoria de proposta, contrato e ganho (JOAO PTDA)

Data: 13/10/2026. Ambiente: **homologação** (`https://dev.crm.callface.io`, pilha `/opt/callface/crm2-homolog`, banco `callface_crm_mz` no container `callface-crm2-homolog-postgres`). Nada foi tocado em `/opt/callface/crm2-dev`. Nenhum segredo neste laudo. Sem commit, sem push, sem typecheck, sem testes.

Como foi executado: o app em homologação roda a imagem do commit `ec65663`. As ações de domínio (criar oportunidade, proposta, enviar, ganho) rodaram **dentro do worker da homologação**, com um script empacotado do código local (`d64ea18`, mesmo código de `lib/` que as server actions chamam) e o `.env` real do ambiente, com as travas ligadas (`EMAIL_ALLOWED_DOMAINS=callface.ai`, `WHATSAPP_ALLOWLIST` vazia). O aceite foi feito pela **rota HTTP pública real** (`POST /api/propostas/:id/aceitar-publico`) contra o app deployado. Por isso o login da tela não foi usado (não se digita senha), e as telas do Builder não foram exercitadas no navegador.

## Resumo executivo

A venda **não fecha sozinha em nenhuma das três famílias** no estado atual. Os quatro bloqueios, em ordem:

1. **Aceite do cliente não chega ao contrato** para PABX e Callface AI sem item de setup (e para White Label, por outro motivo). O cliente diz "sim", a tela não muda, ninguém é avisado. Esse foi o defeito que o dono viu na proposta P-1566.
2. **White Label nunca fecha pelo caminho normal**: licença vai para o cartão, setup vai para o contrato, o contrato exige a licença, e pagar a licença não é evidência de Ganho para a família.
3. **Condições de pagamento do Builder nunca são gravadas** (`condicao_pagamento_tipo`, `vencimento_dias`, `condicoes_pagamento`). O contrato de White Label exige esses campos.
4. **A tela de assinatura do Documenso não carrega** na primeira abertura (HTTP 429 do Traefik nos arquivos JS). Reproduzido no desktop.

## O que o dono viu, esclarecido

- **P-1566 (PABX), 18:13:48**: o dono aceitou. Gravou `status=aceita`, `aceita_em`, grupo comercial e um registro em `contratos`, e **parou**: `ContratoIncompletoError: falta Itens de setup`. O Documenso **não foi chamado** (`signature_provider_ref` vazio). A tela dele não mudou.
- **P-1567 (PABX)**: quem aceitou fui eu, pela rota HTTP, depois de inserir por SQL uma linha de setup (contorno de teste). Foi esse aceite que disparou o e-mail "Assine: Contrato PABX · JOAO PTDA · P-1567-v1" que ele recebeu. Ou seja, **o caminho aceite -> contrato -> Documenso funciona quando o contrato é gerável**, mas o e-mail que ele recebeu não é consequência do clique dele.
- A tela de assinatura que não carregou no celular dele é o defeito 4 (reproduzido, ver abaixo).

---

## Defeitos, por gravidade

### Impedem a venda

**D1. O aceite do cliente não leva ao contrato e ninguém sabe**
- Onde aparece: página pública `/p/<id>`, botão "Aceitar proposta".
- Deveria: levar ao contrato (ou dizer "vamos enviar o contrato por e-mail em instantes"), e se o contrato falhar, avisar o cliente e o time.
- É: `status=aceita`, contrato `pendente_assinatura` sem envio, e a tela fica igual. Para o cliente é um clique sem efeito. O time recebe a notificação **"Cliente aceitou e foi direcionado para o contrato"**, que é falsa.
- Degraus (arquivo:linha):
  1. Front: `app/src/components/public/PropostaPublica.tsx:309-327`, `aceitar` chama `POST /api/propostas/:id/aceitar-publico` e, no `onSuccess`, faz `window.location.assign(proximoUrl || '/p/<id>#grupo-<id>')`. Com falha, a resposta traz `estado: proposta_aceita_aguardando_contrato` e `erro`, **sem `proximoUrl`**. O front ignora `erro` e vai para um hash da mesma página: nada acontece.
  2. Depois disso o card do grupo mostra só "Contrato sendo preparado" (`PropostaPublica.tsx:78`), para sempre.
  3. Rota: `app/src/api-server/routes/propostas.ts:633-642` repassa o resultado.
  4. Núcleo: `app/src/lib/crm/proposta-aceite.ts:278-279` chama `gerarContratoDeTemplate` e `enviarContratoParaAssinatura`; falha em `prepararContratoParaEnvio` (`contrato-template.ts:415-429`, `ContratoIncompletoError`); o `catch` em `proposta-aceite.ts:305-326` grava só um evento e uma `atividades` ("Preparação de contrato precisa de atenção"), devolve `erro` e segue.
  5. Notificação falsa: `proposta-aceite.ts:199-205` monta o texto pelo `proximoPasso`, sem olhar `erro`.
  6. Nada tenta de novo: `processarAceiteDaProposta({ retomar: true })` (`proposta-aceite.ts:84-92`) **não tem nenhum chamador** no app, no worker ou em tela.
- Correção proposta: (a) validar o contrato **antes de o cliente ver a proposta** (D2); (b) no `onSuccess`, se algum grupo vier com `erro`/estado de espera, mostrar tela "Recebemos o seu aceite. Em instantes você recebe o contrato por e-mail" e não redirecionar; se vier `proximoUrl`, ir direto à assinatura; (c) trocar o texto da notificação conforme `erro` e avisar o responsável com ação "tentar de novo"; (d) ligar `retomar: true` a um botão na ficha da proposta e a um retry do worker.

**D2. Contrato de PABX e de Callface AI não é gerado quando a proposta não tem item de setup**
- Onde: aceite (D1). Atinge **todo** PABX (o catálogo PABX não tem item de setup) e todo Callface AI sem setup.
- Deveria: gerar o contrato com a tabela de setup omitida.
- É: bloqueia com "falta Itens de setup: uma linha de tabela por item".
- Causa: `app/src/lib/crm/contrato-variaveis.ts:58` (`itens_setup_html` não é `opcional`), usada em `variaveisFaltando` (`contrato-variaveis.ts:101-116`) a partir de `contrato-template.ts:329`; os modelos `pabx.html`, `callface-ai.html`, `pabx-renovacao.html` e `pabx-aditivo.html` têm `{{itens_setup_html}}` fixo. Provado em P-1566 (PABX) e P-1569 (Callface AI).
- Agravante: a checagem `conferirContratoDoGrupo` só existe no envio legado (`enviar-proposta.ts:266`). O envio do produto (`acaoEnviar` -> `lib/vendas/propostas.ts:406-568`) **não confere** se o contrato é gerável. Descobre-se depois do "sim" do cliente.
- Correção proposta: marcar `itens_setup`, `itens_setup_html`, `setup_total` como opcionais e envolver a seção de setup do modelo em bloco condicional; chamar `conferirContratoDoGrupo` no `enviarProposta`.

**D3. White Label: o caminho padrão não fecha nunca**
- Proposta WL com licença + setup (P-1568). No aceite o sistema separa dois grupos por `catalogo_precos.exige_contrato`: a **licença** (`exige_contrato=false`) vai para **pagamento** (sessão Stripe live criada na hora), e o **setup** (`true`) vai para **contrato**.
- O modelo de contrato WL exige a tabela de **licenças** (`itens_licencas_html`), que está no outro grupo: contrato falha ("falta Itens com recorrência...").
- Pagar a licença não ganha: a política de WL só aceita `signed_contract`, `manual_contract`, `admin_approval`, `financial_attestation`. Provado: pagamento confirmado -> grupo `concluido`, entrega liberada, **negócio continua em Proposta**.
- Ainda: o front escolhe o `checkoutId` antes do contrato (`PropostaPublica.tsx:318-321`), então o cliente é mandado ao Stripe antes de assinar.
- Causa: `app/src/lib/crm/decisao-fechamento.ts:54` (o Price manda, "inclusive para dizer que NÃO") contra `won_evidence_policies` de WL e o modelo `white-label.html`. Dados: `catalogo_precos.exige_contrato` da licença WL.
- Correção proposta: decisão do Scott. Ou a licença WL passa a `exige_contrato=true` (um grupo, um contrato com licença e setup), ou o modelo de contrato aceita só setup e a política de WL aceita pagamento. Hoje as três peças discordam.

**D4. Condições de pagamento do Builder não são gravadas**
- Deveria: forma de pagamento do setup, vencimento e condições do passo "Contrato e pagamento" irem para a proposta e para o contrato.
- É: `condicao_pagamento_tipo`, `vencimento_dias`, `condicoes_pagamento` ficam `NULL`. `acaoCriar` não os passa (`app/src/app/(produto)/propostas/actions.ts:446-456`), `acaoAtualizarRascunho` idem (`:504-520`), e `salvarEditorDaProposta` só grava `signatarios` e `editor` (`lib/vendas/propostas.ts:950-964`). Só a rota legada (`api-server/routes/propostas.ts:787-791, 887-889`) grava.
- Efeito: contrato de White Label exige `forma_pagamento_setup` e `dia_vencimento` (`contrato-template.ts:153-154`), então falha. Provado: preenchido por SQL, o contrato sai ("À vista, boleto bancário", "vencimento em 10 dias").
- Correção proposta: gravar essas colunas em `acaoCriar` e `acaoAtualizarRascunho` a partir do passo 4.

**D5. A assinatura no Documenso não carrega (spinner eterno)**
- Onde: `https://sign.callface.io/sign/<token>`.
- Reproduzido no desktop (navegador do painel): na 1ª e 2ª abertura, **42 de 179 arquivos JS voltaram HTTP 429**; sem eles a página monta o cabeçalho e o painel esquerdo ("2 Fields Remaining", "Next Field") mas **não o PDF** e nenhuma requisição ao PDF sai. Na 3ª abertura (cache aquecido) 0 erros, PDF 200 e o documento aparece.
- O PDF em si está bom: 9 páginas, 250 KB, A4, abre e extrai texto; baixado via API do Documenso e conferido. Não é tamanho nem corrupção. O PDF vai como arquivo (multipart) na criação do envelope (`signature/documenso-provider.ts:153-156`), não por URL; `app-url.ts` não entra.
- Causa: o Traefik aplica `rate-limit@file` (`average: 100`, `burst: 50`) ao host inteiro `sign.callface.io` (`/opt/callface/infra/traefik/dynamic/sign-callface.yml`, `middlewares.yml:17-20`), inclusive arquivos estáticos. O app do Documenso carrega ~180 chunks por abertura. Em celular (rede móvel com IP compartilhado) ou atrás de proxy o limite estoura com mais facilidade. Isso explica o relato do dono.
- Correção proposta (infra, **não alterada**): tirar `rate-limit` das rotas `/assets`, `/fonts` e `/static` do router `documenso-sign`, ou subir `burst` acima de 300; conferir `ipStrategy` por causa do Cloudflare.
- Não consegui confirmar o celular em si; confirmei a causa no desktop.

### Mostram dado errado ao cliente

**D6. E-mail da proposta**
- Data de validade com um dia a menos: proposta válida até 27/10, e-mail diz 26/10. `lib/email/proposta-email.ts:97` faz `new Date('2026-10-27')` (UTC) e formata no fuso do servidor (`America/Sao_Paulo`).
- Texto errado para proposta por contrato: botão "Assinar e ativar agora" e rodapé "Pagamento seguro via Stripe" (`proposta-email.ts:118,133,138`) mesmo quando o cliente vai assinar contrato antes de pagar.
- Sem rastro: o envio pelo Resend não grava linha em `emails` nem o id do provedor (`enviar-proposta.ts:76-82`; só o caminho pela caixa do usuário grava, `enviar-como-usuario.ts:37-40`). O que prova a entrega é `GET /emails` do Resend.
- Sem retorno de rejeição: as duas propostas do dono para `scott@scottstudio.com.br` (P-1565 v1 e v2) voltaram **`bounced`** e **`suppressed`** no Resend e o app mostrou "enviado". Não há webhook do Resend tratado.

**D7. PDF da proposta**
- Mesma data com um dia a menos: "Data: 12 de outubro" (emitida 13/10) e "válidos até 26 de outubro" (DB: 27/10). `app/src/lib/propostas/proposta-pdf.ts:71-75` (`dataBR`), usado em `:231` e `:234`.
- Conteúdo de Callface AI em proposta de PABX: "1. Objetivo — Callface AI (SaaS)", "Suporte 24x7 para a solução Callface AI", "Ligações Callface AI" (`proposta-pdf.ts:242` e seções de Premissas). Vale para qualquer família.
- Contradição: "somente produzirá efeito com a formalização de pagamento... pré-pago, via cartão ou boleto" (`:342`) em proposta por contrato.
- Numeração salta de "6. Mapa de investimento" para "8. Formalização" (`:320`, `:342`).
- Desconto some: item com 10 x R$ 5,00 e desconto de R$ 5,00 aparece "10 | R$ 5,00 | R$ 45,00" sem linha de desconto (PDF `:100`).

**D8. Página pública da proposta**
- CNPJ da empresa não aparece: `empresaCnpj` sai de `leads.empresa_cnpj` (`api-server/routes/propostas.ts:520,621`), que `criarLead` nunca preenche (`vendas/pre-vendas.ts:~250`). O CNPJ está em `empresas.cnpj`. Provado: `empresaCnpj: null` com `empresas.cnpj = 2343242334`.
- O nome mostrado é `leads.empresa` (fantasia), não a razão social.
- Desconto escondido: "10 × R$ 5,00" ao lado de "R$ 45,00" (`PropostaPublica.tsx:173-174`).

**D9. Contrato (documento enviado para assinatura)**
- **Endereço do contratante sem número nem complemento**: "Rua das Palmeiras, Centro, Campinas - SP, CEP 13015-200" quando o cadastro tem "Rua das Palmeiras, 120, sala 3". Os modelos usam `{{empresa_logradouro}}` em vez de `{{empresa_endereco}}`: `templates-contrato/pabx.html:17`, `callface-ai.html:17`, `white-label.html:18`, `pabx-renovacao.html:17`. A variável correta (`empresa_endereco`) existe e está certa.
- **CNPJ sem formatação**: "2343242334" (o cadastro tem 10 dígitos, CNPJ inválido, e nada valida nem formata). `contrato-template.ts:263`.
- **Objeto genérico**: o contrato de PABX e o de Callface AI são o **mesmo arquivo**, `pabx.html` e `callface-ai.html` idênticos (`cmp` sem diferença); cláusula 1.1: "especificamente CALLFACE,com modelo de negócio SaaS" (falta espaço; não diz PABX). Decisão jurídica do dono.
- **Aditivo**: texto quebrado "Contrato de Prestação d e Serviços", "registrado s o b o nº" (`pabx-aditivo.html:19`) e sem endereço do contratante.
- **Aditivo/upgrade lista o item novo com preço cheio** ("PABX - Canais 16 Canais R$ 379,90") sem dizer que substitui o de 8 canais.
- **`contratos.produto = 'ai'` em contrato de PABX** (`proposta-fluxo.ts:48-58` só devolve "pabx" se a categoria do catálogo for "pabx"; o catálogo PABX não usa essa categoria).
- Metadado do PDF: título "about:blank".
- `inicio` do contrato é a data da geração, não da assinatura (`contrato-template.ts:375`).

### Incômodo ou dado interno

**D10. Cada tentativa falha de contrato deixa um contrato órfão.** `gerarContratoDeTemplate` cria a linha em `contratos` e só depois `vincularContratoAoGrupo` (`proposta-aceite.ts:278-280`); se o envio falha, o grupo fica sem `contrato_id` e a próxima tentativa cria outro. Provado: P-1568 e P-1569 têm dois contratos pendentes cada.

**D11. Upgrade soma em vez de substituir.** Upgrade de 8 para 16 canais (P-1570) criou o serviço "16 Canais" (R$ 379,90) e **manteve** "8 Canais" (R$ 189,90): MRR da empresa subiu para R$ 3.182,80 (devia descontar R$ 189,90). O aditivo com item recorrente não gera checkout (certo: `checkout.ts:42-51` manda concluir em Cliente 360 > Assinaturas), mas nada marca o serviço antigo como substituído.

**D12. Ganho manual perde produto e valor.** Callface AI fechado por `financial_attestation` (P-1569) cria serviço sem nome, natureza `UNKNOWN`, valor 0, fora da carteira (`pos-venda.ts:274-292`, deliberado no código). A ficha mostra um serviço vazio e o MRR de R$ 489,70 vendido some.

**D13. Recebível junta mensalidade e setup.** Pendência financeira do PABX: R$ 305,90 (R$ 304,90 mensal + R$ 1,00 setup), `vencimento` nulo (`vencimentoIndefinido`), amarrada ao serviço de setup (`pendencia-financeira.ts`).

**D14. Responsável da carteira diferente do da oportunidade.** Cliente criado com responsável "Jenifer Matos"; a oportunidade era do Kauã. Pode ser regra de distribuição; confirmar.

**D15. Destinatário e e-mail do contato do dono.** O contato "Scott" do JOAO PTDA tem `scott@scottstudio.com.br`: fora da trava de homologação (envio barrado, comportamento esperado) e, em produção, **bounced**. O pré-preenchimento do destinatário funciona (lead como reserva: e-mail e telefone `+5511969044205`), mas o lead da oportunidade e a pessoa "Scott" têm ids de lead diferentes (`pessoas.lead_id_legado` aponta outro lead), então a busca pela pessoa volta vazia e só o lead cobre.

**D16. Catálogo.** Preços avulsos de cliente específico no catálogo genérico de White Label ("Parcelamento Matte - 02/02", "Clientes Ref. Junho/Julho/Agosto"); variação com `|` no texto ("Linha 4003 | Até 800min") que colide com o separador ` | ` usado em `itens_recorrentes`.

---

## O que passou (conferido em banco)

- Cálculo de valores: PABX 189,90 + 10 x 5,00 com desconto R$ 5,00 + 2 x 35,00 = **R$ 304,90**; WL 20 x 129,90 com desconto R$ 100,00 = **R$ 2.498,00** + setup 129,90; Callface AI 3 x 179,90 com desconto R$ 50,00 + pacote 99,90 = **R$ 489,70 + R$ 99,90**. `composicaoDaProposta`, tabela da proposta, e-mail, PDF, página pública e contrato batem no total. TCV 12 meses = R$ 3.658,80.
- Validade: `data_validade = envio + 14 dias` gravada no envio (27/10).
- Família: oportunidade, proposta, grupo, evidência, serviço canônico e `negocios`/`oportunidades` chegam com a família certa nos três casos (PABX, WHITE_LABEL, CALLFACE_AI). O Ganho grava a família (`gravar-familia.ts`).
- Destinatário do e-mail vem preenchido (e-mail e telefone), e a trava de domínio barra o que não é `@callface.ai`.
- E-mail da proposta: **saiu pelo Resend** (usuário sem caixa conectada), `delivered` no Resend, link `https://dev.crm.callface.io/p/<id>` correto, remetente `Callface <no-reply@callface.ai>`, `reply_to` do usuário que enviou. O caminho pela caixa do usuário **não foi testável** (homologação sem tokens, por saneamento).
- Aceite público: grava `aceita`, `aceita_em`, auditoria, grupos, evento `ProposalAccepted`.
- Documenso: envelope criado com 1 destinatário (mesmo e-mail em dois papéis vira um destinatário com dois campos), campos de assinatura nos blocos certos do PDF, e-mail do Documenso recebido pelo dono.
- Contrato assinado (simulado no banco) -> `signed_contract`, grupo avança, **Ganho**, família, cliente (`leads.tipo=cliente`, linha em `clientes`), carteira, pendência financeira, serviço canônico por item com nome e valor corretos, `empresa360` muda para "Cliente ativo" e lista os serviços. PABX e WHITE_LABEL.
- Pagamento confirmado (simulado) em Callface AI pré-pago -> `stripe_subscription`, **Ganho**, serviço "Callface AI - Full" R$ 489,70 + pacote de minutos corretos.
- Aceite não é Ganho: sem evidência, `tentarGanhar` recusa ("nenhuma combinação de evidências...").
- Aditivo/upgrade: exige contrato base (`contrato_base_obrigatorio`), gera "Termo aditivo" com número do contrato base e da proposta; checkout novo é bloqueado para movimento de expansão com mensagem e link para Cliente 360.

## Variáveis de documentos

Nenhum `{{...}}`, `undefined`, `null` ou `NaN` restou nos corpos renderizados (PABX, WL, Callface AI, Aditivo). As variáveis problemáticas são de **valor**, não de marcador:

| Variável | Problema | Onde |
|---|---|---|
| `itens_setup_html` | vazia sem setup e bloqueia o contrato | D2 |
| `forma_pagamento_setup`, `dia_vencimento`, `condicoes_pagamento` | sempre vazias (nunca gravadas) | D4 |
| `itens_licencas_html` | vazia no grupo errado (WL) | D3 |
| `empresa_cnpj` | sem máscara, aceita CNPJ inválido | D9 |
| Endereço (modelo) | usa `empresa_logradouro`, perde número e complemento | D9 |
| `empresa_nome` (modelo genérico) | vazio sem razão social, sem fallback ao fantasia | `contrato-template.ts:260` |
| `testemunha_*` | em branco por desenho (opcional) | ok |
| `data_inicio_vigencia` | data de geração, não de assinatura | D9 |

## Stripe (live) e Documenso: ids criados

Tudo com `crm_origin = TESTE-AUDITORIA` na metadata. Nenhum objeto que não fosse meu foi alterado.

- Customer `cus_VR2Sby6Ne1xcwk` (criado 18:25, descrição `TESTE-AUDITORIA-...`). **Excluído**. Referência limpa em `empresas` e `leads` da homologação.
- Checkout Sessions (todas `expired`, nenhuma paga): `cs_live_a1XKW497Io2LS16Cuucs7Qj7XfU46TxihbyacZf480vEXDdI8zWm6ljewH`, `cs_live_b19NzWAE37lHQ5t3t6pOWpLQ9clUqQ0iKAjQQbgqtOrlvv7Qokvp0aXSgr`, `cs_live_b1FC45qcKgCSEsSjpqdtANf44miWgEJb9ztpmTpb775Uvg0DLZPua9XxrS`. Sem assinatura, sem fatura, sem cobrança.
- Cupons **excluídos**: `cPgL95rA`, `eAOw1u2Y`, `oVfyKSdG`.
- "Pago" foi **simulado no banco** (função `handlePaymentConfirmed` com a sessão real e `payment_status=paid`); nenhuma cobrança real.
- Documenso (instância compartilhada): envelopes `envelope_lrozwlifdlwzrual` (P-1567) e `envelope_vktaznhozwnecera` (aditivo P-1570), ambos **excluídos** pela API depois do teste. Os links de assinatura que o dono recebeu deixaram de existir.
- Resend: 6 e-mails de proposta para `kaua.araujo@callface.ai` (P-1566 a P-1571) e 2 e-mails do Documenso. Nenhum fora de `@callface.ai`.
- Sem escrita de assinatura Stripe (`stripe-assinatura-acoes`): não executei troca de plano.

## Registros de teste na homologação (para limpar se quiser)

Oportunidades `TESTE-AUDITORIA-*` (negócios): `a7b4309f-1df6-4c98-949e-b89089211ca8` (P-1566, parada em aceite, **mantida de propósito como evidência de D1**), `bd8f55b9-49fe-4179-b44d-83bd6f7fd15b` (P-1567), `79237a4c-2b3c-489e-aae7-a831fba0a8d0` (P-1568), `8b460672-67be-4a4d-a1fd-60be0e899481` (P-1569), `b5be57de-7348-4f55-a246-73f88c78ce8a` (P-1570), `4d21bbcf-92c5-4a0f-af04-3370087f5451` (P-1571). Lead de teste `487321eb-2b34-40a4-82f8-d1d555a3d90d` (`kaua.araujo@callface.ai`, usa a pessoa já existente com esse e-mail). A empresa JOAO PTDA existia na cópia; ganhou razão social "TESTE-AUDITORIA JOAO PTDA LTDA" e endereço de teste, e o CNPJ original foi mantido. Contornos feitos **por SQL**, só em teste: linha de setup R$ 1,00 em P-1567, P-1569 e P-1570; condições de pagamento em P-1568; licenças movidas de grupo em P-1568.

## O que NÃO consegui verificar

- **Assinatura real no Documenso**: o clique que assinaria o documento foi negado pelo sistema de permissões e eu não contornei. A assinatura foi simulada no banco (mesmo motor `processarContratoAssinado` do webhook). O webhook `DOCUMENT_COMPLETED` e o PDF assinado (`pdf-final`) não foram exercitados.
- **Telas do Builder (5 passos) e a pré-visualização**: exigem login; conferi o equivalente nas funções de servidor e nas colunas gravadas.
- **E-mail pela caixa do usuário (Outlook)**: homologação sem tokens.
- **WhatsApp**: sessões desconectadas na homologação (`desconectada`); nada saiu, como esperado.
- **Celular**: reproduzi o defeito de assinatura no desktop; não abri no aparelho.
- **Troca de plano na assinatura existente (upgrade no Stripe)**: o caminho existe (Cliente 360 > Assinaturas) mas não criei assinatura de teste para alterar.
- **Conteúdo do e-mail recebido na caixa**: li o HTML entregue pela API do Resend, não a caixa.
- **Renovação e downgrade**: modelos lidos (variáveis válidas), não gerados de ponta a ponta.
- Webhook do Stripe não chega em homologação (documentado): o status de pagamento só muda pela simulação.
