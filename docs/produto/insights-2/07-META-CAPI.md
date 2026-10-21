# Meta CAPI: o que está pronto, o que está parado, e o que não vai funcionar nem destravando

Medido em **21/10/2026** no banco **local `callface_crm`** (cópia de dev).
**A medição em produção (`callface_crm_mz`) não foi feita** — a leitura do servidor
foi negada nesta sessão. Os números abaixo valem como diagnóstico de forma, não
como estado de produção; reexecutar lá antes de agir.

---

## 1. A integração está construída inteira

Caminho completo, do fato ao gerenciador:

```
escrita canônica → domain_event + event_outbox (mesma transação)
  → sweep do worker (event-outbox-sweep, a cada 60s)
  → consumer.ts → entregarEventoNaMeta() → Graph API
  → meta_capi_entregas (toda tentativa, entregue ou não)
```

Peça por peça: política de 8 eventos (`packages/integrations/meta/src/politica-eventos.ts`),
adapter, caller real no consumidor, log de entrega com `ON CONFLICT`, tela de
observabilidade. Nada disso falta.

## 2. Em produção, ela NÃO está parada (medido 21/10, 18h)

**Correção do veredito.** Tudo o que eu tinha escrito aqui vinha do banco local,
onde não se roda worker. Os números de produção (`callface_crm_mz`) são outros:

| | Produção | O que eu havia dito (local) |
|---|---|---|
| `event_outbox` processados | **2.233** | 260 |
| `event_outbox` pendentes | **0** | 269 |
| `event_outbox` falhados | **0** | 0 |
| Último processamento | **21/10 18:34** | 09/10 12:38 |
| Entregas na CAPI | **270** | 6 |
| Entregas NÃO entregues | **0** | — |
| Última entrega | **21/10 18:20** | 08/10 |
| `pontos_contato.meta_lead_id` | **791** de 5.341 | 2 de 4.270 |

A fila anda, nada está preso, e a API de Conversões **entrega**: 270 eventos,
o último há minutos. Não havia incidente nenhum.

**O que isso muda nas correções de hoje:** elas deixam de ser preparação e
passam a ter efeito imediato no próximo deploy.

- O `event_id` que saía do id da LINHA DA FILA estava **ativo nessas 270
  entregas**. Republicação do mesmo fato gerava outro id, e a Meta contava a
  conversão de novo. Corrigido em `e42a1af9`.
- A jornada recém-mapeada (`MeetingHeld`, `NegotiationStarted`,
  `LeadDisqualified`, `OpportunityLost`) vai **aumentar o volume entregue**.
  É o resultado pretendido, mas é efeito real em produção: a partir do deploy,
  eventos que antes morriam em "sem_mapeamento" passam a sair.

**O que continua valendo:** `meta_lead_id` em 791 de 5.341 (15%) e
`fbclid`/`fbc`/`fbp` em zero — este último por desenho, ver §3.

## 3. O sinal: eu li a tabela errada

**Correção, 21/10 à noite.** Escrevi abaixo que `fbclid`/`fbc`/`fbp` em zero era
o gargalo. **Não é, e nunca ia ser.** As campanhas de hoje são **formulário
nativo do Meta (Lead Ads)**: a pessoa preenche dentro do app e nunca chega a um
site. Não existe clique para um domínio nosso, logo não existe `fbclid`, nem
cookie `_fbc`, nem `_fbp`. Zero ali é o esperado, não um defeito.

O sinal de Lead Ads é outro, e **ele existe**:

| Em `pontos_contato` | Preenchido |
|---|---|
| `ad_id` | **959** |
| `adset_id` | **959** |
| `campaign_id` | **967** |
| `meta_lead_id` (leadgen) | 2 |

`veioDaMeta()` aceita `adId`, então esses ~952 pontos de Mídia Paga **passam** na
regra de atribuição. O casamento na Meta se dá por e-mail/telefone hasheado mais
o anúncio — não é o ideal, mas funciona.

**O que falta é o `leadgen_id`**, que é a prova direta e o melhor casamento
possível. Ele some num ponto específico: `leads` tem coluna para
`meta_ad_id`, `meta_adset_id` e `meta_campaign_id`, e **não tem coluna para o
leadgen** — ele vive em `campos_custom.meta_leadgen_id`, preenchido em **6 de
4.262**. O backfill `06-aquisicao.ts` copia as três colunas para
`pontos_contato` e não tem de onde copiar o leadgen. Os 2 que têm vieram do
caminho novo (`processar-meta.ts`, provider `meta`, 08/10), que passa
`metaLeadId` corretamente.

Então a ordem certa é: os leads novos já nascem com o leadgen pelo webhook; o
passivo precisa de backfill a partir de `campos_custom`, onde houver.

## 3a. (análise anterior, mantida para o caso de voltar a existir LP)

Destravar a fila não resolve, porque falta o sinal

`veioDaMeta()` só devolve o fato que veio da Meta. Em 4.270 pontos de contato:

| Sinal | Preenchido | O que é |
|---|---|---|
| `fbclid` | **0** | o clique no anúncio |
| `fbc` | **0** | cookie derivado do clique |
| `fbp` | **0** | cookie do navegador |
| `meta_lead_id` | **2** | prova direta de Lead Ads |
| `campaign_id` | 967 | **UTM — qualquer um digita** |
| `ad_id` | 959 | idem |

Ou seja: quase toda a atribuição Meta do sistema é UTM, que é o sinal mais
fraco da escala, e **não existe um único `fbc`/`fbp`** — que é justamente o que
a Meta usa para casar a conversão com a pessoa. Mandar evento sem eles depende
de e-mail/telefone hasheado baterem, e a taxa de casamento cai.

**Quantos eventos da fila teriam sinal Meta hoje:**

| Evento de domínio | Vai como | Na fila | Com touchpoint |
|---|---|---|---|
| `AcquisitionCreated` | `Lead` | 370 | 31 |
| `MeetingScheduled` | `Schedule` | 34 | 31 |
| `ProposalSent` | `ProposalSent` | 18 | 18 |
| `AcquisitionQualified` | `QualifiedLead` | 15 | 7 |
| `OpportunityWon` / `DealWon` | `OpportunityWon` | 10 | **0** |
| `PaymentConfirmed` / `PaymentCompleted` | `Purchase` | **0** | — |

As duas últimas linhas são o problema de negócio, não de código:

- **Venda ganha nunca volta**: 0 dos 10 ganhos têm touchpoint Meta. O evento
  que mais ensina o algoritmo é exatamente o que não sai.
- **`Purchase` não existe no banco local**, e isso **não** prova que nunca
  existiu. O caminho está completo no código: `handlePaymentConfirmed` publica
  `PaymentCompleted` com `valor` em reais e `stripeSessionId`, a tradução leva a
  `Purchase` e o `event_id` dedupa pela sessão do Stripe. O webhook do Stripe
  não chega em dev — as chaves ficam vazias por decisão do `AGENTS.md` —, então
  **só a medição em produção responde** se o `Purchase` sai.

## 3b. Metade da jornada não tinha destino — agora tem (`#MAPA`)

A política cobria o avanço positivo e paravam ali. Desqualificado, perdido,
reunião realizada e entrada em negociação **morriam em "sem_mapeamento"**: o
evento entrava na fila e era descartado em silêncio.

Pior, a mudança de etapa do pipeline chegava como um evento só
(`OpportunityStageChanged`, 33 na fila) para seis etapas diferentes — devolvida
crua, ensinaria a Meta a otimizar por "mexeu no card". A etapa de destino é que
tem significado, então a tradução passa a olhar `payload.para`:

| Etapa de destino | Vai como | Por quê |
|---|---|---|
| `reuniao_realizada`, `diagnostico` | `MeetingHeld` | `Schedule` diz que marcou, não que aconteceu — e no-show é grande |
| `negociacao`, `negociacao_iniciada`, `em_fechamento` | `NegotiationStarted` | último sinal forte antes do ganho, que demora semanas |
| `proposta`, `proposta_apresentada` | **nada** | `ProposalSent` já publica o mesmo fato; duplicar infla a conversão |
| `ganho`, `perdido`, `desqualificado` | **nada** | têm evento próprio |

E as saídas da jornada passam a voltar, marcadas como `desfecho: "negativo"`:

| Evento | Vai como | Atenção |
|---|---|---|
| `AcquisitionDisqualified` | `LeadDisqualified` | **nunca** configurar como conversão a otimizar |
| `OpportunityLost` | `OpportunityLost` | idem — a Meta buscaria quem não fecha |

A marca existe porque o risco é de configuração no gerenciador, não de código:
marcar "Perdido" como objetivo de campanha faz a Meta otimizar por perda. Eles
servem para exclusão de público e leitura de qualidade.

**O que segue sem destino, de propósito:** `TagAdded`/`TagRemoved`,
`ProposalOpened`/`ProposalViewed` (abrir não é avançar), `DealCreated`,
`SignatureRequested`, `ContractRequired` e os eventos de conversa. Nenhum é
estágio comercial.

## 4. Dois defeitos de código, corrigidos (`e42a1af9`)

Nenhum muda comportamento hoje — a entrega está parada —, mas os dois produzem
erro no instante em que ela destravar.

**`event_id` seguia a linha da fila, não o fato.** `idDeterministicoDoEvento`
documenta receber o id do evento de DOMÍNIO e recebia o id da linha do outbox.
Para `Lead`, `QualifiedLead`, `Schedule` e `ProposalSent` isso significa que
republicar o mesmo fato — reprocessamento, replay, nova publicação da entrada
canônica — gera outro `event_id` e **a Meta conta a conversão de novo**. Agora a
chave é `payload.domain_event_id`, presente em 446 de 446 eventos canônicos.
Venda ganha continua deduplicando pelo negócio, porque `DealWon` e
`OpportunityWon` são dois eventos de domínio para o mesmo fato.

**`event_time` era o da fila.** Hoje coincide com o fato (publicação na mesma
transação; medido: 0 eventos com dia diferente). Em replay, importação ou
backfill o `created_at` passa a ser a data da carga e a conversão escorrega de
dia na atribuição. Passa a usar `payload.ocorrido_em`, com a fila como fallback.

## 5. Ordem para fazer funcionar de verdade

| # | O quê | Por que nesta ordem | Risco |
|---|---|---|---|
| 1 | **Confirmar em produção** se o sweep da outbox roda e desde quando | se estiver parado, o problema é muito maior que o CAPI | leitura |
| ~~2~~ | ~~Capturar o clique na landing~~ | **feito**, nas duas pontas (ver §6) | — |
| 3 | **Confirmar se o `Purchase` sai em produção** | o código publica; dev não recebe webhook do Stripe | leitura |
| 3b | ~~Mapear desqualificado, perdido, reunião realizada e negociação~~ | **feito** | — |
| 4 | **Ligar o touchpoint Meta à oportunidade ganha** | 0 de 10 ganhos têm atribuição: o melhor evento não sai | médio |
| 5 | **Destravar a fila dos 269** | **dispara conversão REAL em produção** | **exige autorização** |
| 6 | Decidir se UTM sozinha autoriza devolver conversão | hoje autoriza, e é o sinal mais fraco | decisão do Scott |

O passo 5 é o único irreversível: enviado, o evento está no gerenciador. E não
há `test_event_code` configurado, então não existe ensaio — o primeiro disparo é
o real.

---

## 6. O clique na landing (feito, mas não é o caminho de hoje)

**Ressalva primeiro:** o Scott confirmou que **todas** as campanhas de hoje são
formulário nativo. As 5 LPs existem e têm Pixel, mas não recebem tráfego pago
agora. O que está abaixo vale para quando voltar a existir campanha com LP, e
não muda nada no fluxo atual.

Era o gargalo que eu supus: evento mapeado e entregue não vale nada se a Meta não tem
com quem casar. Estava quebrado em **três** pontos do caminho, e cada um
sozinho zerava o resultado.

**Na LP** (`Callface - LP/callface-lp/`, repositório separado, não versionado):
o `traffic_source` montado à mão levava só os `utm_*`. O `fbclid` vinha na URL
o tempo todo e era descartado na origem. Agora existe `root/rastreio.js`, fonte
única para as 5 LPs que o Dockerfile publica, carregado antes de cada `app.js`.
Ele lê, por ordem de confiança: cookie `_fbc`/`_fbp` do Pixel (o valor REAL —
as 5 LPs já têm Pixel instalado), depois o `fbclid` da URL, depois o que ficou
de uma visita anterior. Guarda em `localStorage` por 90 dias porque o clique
chega numa página e o formulário é enviado em outra. O horário do clique é
estável — ele entra no `fbc`, e dois valores para o mesmo clique viram duas
identidades do lado da Meta.

**No parser do RD**: `ParsedRdLead` declarava `fbclid` desde que a interface
existe e **nada o preenchia** — campo fantasma. Pior, a sessão só era lida
quando continha `"utm_"`, então anúncio sem UTM caía fora inteiro. Agora o
clique sai da sessão atual (com a primeira de rede) ou da URL do formulário, e
o `fbc`/`fbp` do cookie vence o derivado.

**No consumidor**: a rota `POST /leads`, maior porta de escrita de lead do
sistema, aceitava `fbclid`, `fbc`, `fbp` e `gclid` no corpo e os descartava ao
montar a atribuição canônica. Passa junto com o `meta_lead_id`, que o
processamento do RD já conhecia e jogava fora (prova direta de Lead Ads, e
estava em 2 de 4.270).

**Provado no navegador**, com o Pixel real da LP: a página devolveu
`fbc = fb.3.1792608247173.<fbclid>` (cookie do Pixel, não o derivado), o
`traffic_source` do submit levou os três campos, e o parser real do CRM os
recebeu com `veioDaMeta` verdadeiro. O `fetch` foi interceptado: **nenhum lead
foi criado no RD**.

**Falta publicar a LP.** Ela não é repositório git e o deploy é build do
container `callface-lp`; as mudanças estão no disco, prontas. Até a LP subir, o
lado do CRM recebe o clique só de quem já mandava.
