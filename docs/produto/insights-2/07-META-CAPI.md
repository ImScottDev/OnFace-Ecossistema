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

## 2. E está parada

| | |
|---|---|
| Eventos entregues em toda a história | **6** |
| Última entrega | **08/10/2026** |
| Linhas pendentes na outbox | **269** (toda a fila, não só CAPI) |
| Tentativas na mais tentada delas | **0** |
| Último `processed_at` da outbox | **09/10 12:38** |

**`attempts = 0` em 269 linhas é o diagnóstico.** Não é a Meta recusando, não é
credencial, não é a regra de atribuição barrando: **ninguém tentou**. O que
parou não é o CAPI — é o consumidor da outbox inteiro, e com ele a projeção de
timeline, as automações do construtor, o barramento n8n, a materialização de
serviço canônico e o handoff de CS.

No banco local isso é esperado: não se roda worker aqui. **Em produção seria
incidente**, e é a primeira coisa a confirmar.

## 3. Destravar a fila não resolve, porque falta o sinal

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
- **`Purchase` nunca existiu**: nenhum pagamento entrou na outbox, em nenhum
  momento. Sem ele a Meta não recebe valor, e otimizar por valor é o modo mais
  eficaz de otimização que ela oferece.

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
| 2 | **Capturar `fbclid` na landing** e derivar `fbc`/`fbp` | sem isto o evento chega e não casa; é o gargalo real | baixo |
| 3 | **Publicar `PaymentConfirmed`** quando o pagamento é confirmado | é o `Purchase` com valor, e hoje não existe | baixo |
| 4 | **Ligar o touchpoint Meta à oportunidade ganha** | 0 de 10 ganhos têm atribuição: o melhor evento não sai | médio |
| 5 | **Destravar a fila dos 269** | **dispara conversão REAL em produção** | **exige autorização** |
| 6 | Decidir se UTM sozinha autoriza devolver conversão | hoje autoriza, e é o sinal mais fraco | decisão do Scott |

O passo 5 é o único irreversível: enviado, o evento está no gerenciador. E não
há `test_event_code` configurado, então não existe ensaio — o primeiro disparo é
o real.
