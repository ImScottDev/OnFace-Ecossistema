# Matriz da jornada comercial — homologação

Objetivo: fechar, testar e **comprovar** a jornada comercial inteira em homologação,
sem promover para produção antes do aceite do Scott.

**Regra de conclusão (dele, e vale para toda linha desta matriz):** nada é "concluído"
por ter código, commit ou typecheck verde. Só conta quando **a ação inicial produz o
resultado final correto** — valores, estados, vínculos, responsáveis, metas, eventos e
ausência de duplicação.

Referência de homologação: **JOAO PTDA**. Nenhuma mensagem, contrato ou cobrança real
para destinatário de verdade.

## Situação por cenário

| # | Cenário | Esperado | Observado | Evidência | Commit | SHA homologado | Situação |
|---|---|---|---|---|---|---|---|
| 1 | Proposta: criar, enviar, aceitar, recusar, ajustar | Estados corretos, condições persistidas, PDF e página pública coerentes | Aceite/recusa e condições validados na Fase 0 | validacao-fase-0.md | 2a4ec8d | 2a4ec8d | parcial — falta recusa e ajuste |
| 2 | Contrato e Documenso | Gera, envia, assina, volta ao ONFACE com cópia e registro | Gera e envia provado; **a assinatura em dois pontos foi achada no dado e corrigida** | 10 contratos de homologação com o mesmo e-mail em 2 ou 3 papéis, um deles já `signed` | — | — | **causa achada e corrigida; falta um envio real** |
| 3 | Estados e retomadas sem resposta falsa | Falha aparece; retomar não duplica | Retomada provada; e-mail recusado aparece | validacao-fase-0.md | 2a4ec8d | 2a4ec8d | comprovado |
| 4 | Ganho → valores → meta e faturamento | mrr_fechado e valor_setup gravados no Ganho | Corrigido; 107 ganhos antigos sem composição reconciliados em homologação (6 do JOAO + 100 do legado + 1 projeto) | `backfill-valor-negocios.ts` | 541f8cd | 541f8cd | **reconciliado em homologação, produção pendente** |
| 5 | Pós-venda: um processo por venda | **Uma jornada principal por venda**, com trilhas por família | Entregue "uma por venda **e família**" — diverge da decisão | 1508bb3 | 1508bb3 | — | **a corrigir** |
| 6 | Histórico de entregas | Entregas antigas consolidadas | Histórico consolidado em homologação: 59 → 53 entregas, 51 com `oportunidade_id`; as 41 com andamento intactas | `backfill-consolidar-entregas.ts` | — | — | **consolidado em homologação, produção pendente** |
| 7 | Serviços sem vínculo | Agrupamento sabe lidar com serviço sem venda | 445 de 508 sem oportunidade nem contrato: carga (LEDGER 258, STRIPE 144, MARCO_ZERO 36, CONTRACT 5, ZOHO 2); cada um é sua própria venda, nunca agrupa; o backfill não toca neles | `entrega-da-venda.test.ts` | — | — | **legado esperado, documentado** |
| 8 | Upgrade, downgrade, cross-sell, renovação | Upgrade/downgrade: o serviço de hoje é o novo e o anterior vira histórico (SUPERSEDED); cross-sell soma; renovação não cria serviço, entrega nem recebível; etapa já cumprida nasce cumprida | Implementado (sem coluna nova): `lib/crm/upgrade-cross-sell.ts`, `servico-canonico.ts` (`materializarLote`), `fulfillment.ts` (etapas herdadas DONE) | upgrade-e-cross-sell.md | `upgrade-cross-sell.db.test.ts` | — | **provado em banco descartável; falta tela** |
| 9 | White Label fim a fim | Implantação única, contrato, cobrança, licença por ativação | Catálogo e grupo corrigidos; licença por ativação depende de integração | — | 975db8e | 541f8cd | parcial |
| 10 | Reconciliação do legado | Família, valores, evidência, responsável, datas preservadas | Script escrito, **não executado** | 1423e0c | 1423e0c | — | **não executado** |
| 11 | Eventos no n8n | Evento real do ONFACE chega e é idempotente | Barramento provado com evento sintético; **falta evento real** | — | 77460f9 | 541f8cd | **a comprovar** |
| 12 | Sincronismos Callface AI | Parceiro, licença, fatura e retrato espelhados | Tabelas criadas e **vazias**: sync nunca rodou | — | 864ea2b | 541f8cd | **a comprovar** |
| 13 | Aviso de pagamento do Stripe não cai | Responder antes de o Stripe desistir (~20s) e processar depois, sem perder evento | **Comprovado em homologação:** HTTP 202 em **0,24s**; o trabalho real levou **16,0s** no worker e o evento terminou `processed` | medição em homologação, evento `evt_latencia_1791939237` | ee32dc8 | ee32dc8 | **comprovado em homologação** |
| 14 | Conversa de WhatsApp por papel (P0) | Número pessoal só do dono; cargo não abre caixa alheia | **Corrigido e travado**: regra única em `lib/whatsapp/acesso.ts`, 132 testes e trava de arquitetura; 20 superfícies vazavam | `conversa-so-pela-porta.test.ts`, `acesso-politica.test.ts` | a5ac16b | a5ac16b | **comprovado em teste; falta decidir a supervisão dos admins** |
| 15 | Ajustes que mudam comportamento | Salvar um ajuste muda o sistema | Varredura completa: assinatura de e-mail, organização ativa e AI SDR por estágio eram órfãos e foram ligados; 7 telas seguem como "só registro" | relatório de Ajustes neste doc | 799a00b | 799a00b | **parcial — 7 telas sem leitor, por decisão sua** |

## Regra esclarecida pelo Scott (13/10/2026): não existe venda mista

> "na real nem existe venda mista. Se uma oportunidade contempla apenas uma família,
> então não tem venda mista."

Com isso, **uma entrega por venda e família É uma entrega por venda**, e o que o commit
`1508bb3` entregou está correto. O board duplo que eu temia não acontece numa venda
legítima.

**Mas o dado discorda da regra, e isso vira trabalho:**

| Combinação | Propostas |
|---|---:|
| Callface AI + PABX | 40 |
| Callface AI + White Label | 6 |
| PABX + White Label | 2 |
| **Total** | **48** |

Pela regra, essas 48 são **erro de cadastro do histórico**, não venda legítima. Entram
na reconciliação do legado (cenário 10), não na mudança da regra.

**Melhoria que isso revela:** nada hoje impede uma oportunidade de receber itens de
famílias diferentes. O sistema aceita calado e só o pós-venda descobre. Vale uma trava
na criação da oportunidade — proposta, não feita.

## Cenário 13 — o aviso de pagamento do Stripe (medido, não presumido)

O defeito: 42 de 93 avisos voltavam **499** porque a requisição fazia o trabalho inteiro
dentro dela — sincronismo da conta e recebíveis — e o Stripe desiste por volta de 20s.
Aviso que cai o bastante faz o Stripe **desativar o endereço**, e aí nenhuma venda paga
chega ao CRM.

A correção (`ee32dc8`): a requisição faz só o essencial — confere a assinatura, descobre
de quem é o evento, grava no inbox de forma idempotente e enfileira. O trabalho pesado
continua **o mesmo código**, só saiu de dentro da requisição.

**Como foi comprovado** (13/10/2026, homologação, `ee32dc8`): reenvio de um
`customer.subscription.updated` real já conhecido, com id novo, assinado no próprio
servidor — o segredo nunca saiu de lá.

| Medida | Valor |
|---|---|
| Resposta ao Stripe | **HTTP 202 em 0,24s** |
| Trabalho real, agora no worker | **16,0s** |
| Estado final do evento | `processed` |

Os 16s eram exatamente o que ficava **dentro** da requisição. Em produção, com mais
dados, é a faixa de 25–65s que gerava os 499.

**Efeito colateral que o Scott precisa saber:** o pagamento confirmado passa a aparecer
**segundos depois** da cobrança, em vez de no mesmo instante. É a troca necessária para o
aviso parar de cair.

**Ganho seguinte, deliberadamente não feito:** o log do worker mostra que **cada evento
roda o sincronismo completo da conta** (`224 assinaturas, 257 faturas`) — é de onde vêm
os 16s. É caro demais para o que um evento precisa. Mexer agora arriscaria a cadeia
pagamento → ganho → faturamento que acabou de ser comprovada; fica para quando ela
estiver assentada.

## Cenário 11 — por que nenhum evento real chegou ao n8n

Não é defeito de código: é ambiente.

| Ambiente | `ONFACE_BARRAMENTO_URL` / `_TOKEN` | Consequência |
|---|---|---|
| Produção | **definidos** (conferidos por impressão digital, sem ver o valor) | publica de verdade |
| Homologação | **ausentes** | o barramento não tem para onde publicar — é impossível provar aqui |

O outbox de homologação está vivo: 810 eventos `processed`, incluindo
`ContractDeclined`, `CanonicalServiceActivated`, `PaymentStarted` e
`CheckoutCreated` gravados nas validações desta noite. Ele grava; só não entrega.

**O que falta de você:** ou as duas chaves do n8n no `.env` de homologação — e elas
estão na lista de segredos a rotacionar, então o certo é gerar a nova e já colocar
nos dois ambientes — ou autorização para eu ler as execuções do n8n de produção e
conferir o que chegou lá.

## Cenário 12 — achada a causa de as tabelas estarem vazias

Não era conexão nem permissão. O job de 6 h roda **três** passos — uso, parceiros
(White Label) e retrato do cliente. O script de operação
(`sincronizar-callface-ai.ts`) rodava **só o primeiro**. Como o job é o único
caminho que preenchia parceiro e retrato, bastava ele não ter passado para as
tabelas ficarem vazias — e a guarda das 5,5 h impedia nova tentativa.

Em homologação, `integracao_sync_estado` mostrava exatamente isso: `tenant_snapshot`
com sucesso às 21:23 (380 itens, 72s) e **nenhuma linha** para parceiros ou retrato.

Corrigido em `799a00b`: os dois caminhos passam a chamar a mesma rodada
(`lib/integrations/callface-ai/rodada.ts`). Falta rodar em homologação com o código
novo publicado e conferir as quatro tabelas.

## Cenário 2 — "assinando em dois cantos": achado no dado

O dono descreveu assim: *"na hora de assinar eu tava assinando em dois cantos, como
se eu fosse duas pessoas"*. Ficou em apuração porque o banco local não tem contrato
enviado para assinatura. O dado de homologação respondeu:

| Contrato | Estado | E-mail | Papéis |
|---|---|---|---:|
| `5bce5437` | enviado para assinatura | `kaua.araujo+e2e-dono@` | **contratante + representante_legal + testemunha_vendedor** |
| `38818a58`, `3b3696bc`, `64e424c7`, `6cbece40`, `af746805`, `b34519c1`, `ba00c252`, `d2234aa6`, `dc9664d0` | 3 assinados, 4 cancelados, 2 criados | `kaua.araujo@` | contratante + representante_legal |

Dez contratos com a mesma pessoa em dois papéis, e um com **três**. O Documenso
põe um campo de assinatura por papel, então a mesma pessoa recebia dois (ou três)
cantos para assinar. **Três desses contratos estão `signed` assim.**

**Causa:** `normalizarSignatarios` não deduplicava por e-mail, e
`montarDestinatarios` empilhava um campo por papel de propósito — o que está certo
para pessoas diferentes e errado para a mesma.

**Correção:** uma pessoa vale uma assinatura. O e-mail repetido fica no papel de
maior peso (cliente > representante > testemunhas); nos papéis da Callface que
perdem, o nome continua impresso no contrato e o e-mail é esvaziado, então a pessoa
não assina de novo. A deduplicação está na função pela qual TODO caminho passa, e
`montarDestinatarios` ignora o segundo campo do mesmo e-mail como última barreira.

**Efeito colateral que vale saber:** testar com o mesmo e-mail nos dois lados passa
a ser recusado, porque uma pessoa não assina pelos dois. A mensagem diz exatamente
isso, em vez de pedir o e-mail que acabou de ser recusado.

**Falta ver num envio real:** cada pessoa com um campo só no Documenso, e o nome da
testemunha sem e-mail ainda impresso no bloco do contrato.
