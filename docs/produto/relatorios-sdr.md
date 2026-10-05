# LÓGICA-SDR.md — Fonte da verdade do relatório de Pré-vendas (SDR)

Validado com dado real de produção em 22/07/2026 (janela 01/07 → 22/07).
Complementa AUDITORIA.md (21/07). Toda mudança nas métricas da aba Pré-vendas
deve atualizar este arquivo.

## Implementado em 22/07 (mesmo dia, pedido do Kauã — sem tickets)

Novas visões em `lib/relatorios/sdr-visoes.ts` + rota `/sdr-esteira` + `TabSdr.tsx`:

1. **Qualificados com reunião × diretas** no card (origem_qualificacao com proxy
   EXISTS(reunioes) pra dado antigo). `origem_qualificacao` passou a ser gravado em
   TODOS os caminhos de criação de negócio (converter, POST /negocios Hono+Next,
   vincular-negocio, aceitar-proposta avulsa, conversão de contato, lead+negócio).
   Backfill nos nulls com origem_negocio='novo' (só carteira fica null — N/A).
2. **Tabela "Quem qualificou"** (SDR × closer × Agente IA) por quem EXECUTOU —
   primeiro evento `reuniao_agendada` do lead; sem evento → responsável do negócio.
3. **SLA em dois cards**: "leads do período" (coorte) e "fluxo do período" (evento,
   inclui leads antigos) — mediana em destaque, média no subtítulo.
4. **Inbound × Outbound**: qualificados/novos/taxa por grupo (critério canônico
   `leads.origem='outbound'`).
5. **Estagnados** = flags manuais + leads da coorte em contato/qualificando sem
   atividade há `ESTAGNADO_DIAS` (7, constante em sdr-visoes.ts) — OVERLAY: a
   classificação da esteira/funil/board NÃO muda, o lead continua contado onde está.
6. **Seção "Base parada · funil completo"** (admin/gerente): all-time sem negócio
   por estágio × idade (<7d, 7-30d, 30+d) + "antigos trabalhados no período".
7. **Card Qualificando** corrigido: mostra o estado real (`qualificandoAtual`), não
   o cumulativo do funil.
8. Hero mostra "+N closers agendaram por fora" e alerta quando closers > SDR.

## Definições canônicas (como está HOJE no código)

| Métrica | Definição atual | Fonte |
|---|---|---|
| Novos leads | leads com `created_at` na janela (coorte) | `lib/relatorios/esteira-sdr.ts` |
| Trabalhados | coorte que saiu de "Novo" (em contato + qualificando + qualificado + desqualificado) | idem |
| Qualificado | lead da coorte com QUALQUER negócio vinculado (qualquer data/criador), exceto disqualified | idem (`comNegocio`) |
| Qualificando | `sdr_status='qualifying'` na coorte — MAS o card mostra o número CUMULATIVO do funil (qualificando+qualificado) | card em `TabSdr.tsx:110` |
| Desqualificado | `sdr_status='disqualified'` na coorte | esteira-sdr |
| Estagnados | `sdr_status IN (sdr_sem_retorno, sdr_sem_interesse, sdr_retomar_depois)` na coorte — flag 100% MANUAL (botão ESTAGNAR), sem critério de tempo | esteira-sdr |
| Reuniões agendadas (Meta da SDR) | leads distintos com evento `status_changes.para_status='reuniao_agendada'` na janela movidos por usuário `role='sdr'` | `lib/relatorios/funil-eventos.ts` |
| Realizadas / No-show | eventos pós-call / no_show dos leads agendados pelas SDRs | idem |
| % dos trabalhados | qualificados ÷ trabalhados (ambos da coorte do período) | rota `/sdr-esteira` |
| Por SDR | esteira por `leads.responsavel_id`, filtrado `role='sdr'` | rota `/sdr-esteira` |
| Inbound/Outbound | `leads.origem='outbound'` → Outbound; resto → Inbound (critério canônico de metas/board/canais) | `lib/crm/pipeline.ts:191`, `lib/relatorios/canais.ts` |

## Reconciliação 80 (Qualificados) vs 33 (Reuniões agendadas · Meta da SDR)

Os dois números medem coisas DIFERENTES e a divergência é real e explicada
(números de 22/07: 84 vs 35, a tela era de horas antes):

1. **Escopo de pessoa**: a meta conta só quem foi movido por `role='sdr'`.
   Em julho, closers moveram MAIS leads pra "Reunião agendada" (53) que a SDR (35).
2. **Fluxo direto sem reunião**: 13 dos 84 qualificados não têm reunião nenhuma
   (closer qualificou direto; 9 deles nem passaram pelo converter — negócio criado
   manualmente pela closer).
3. **Coorte × evento**: Qualificados = leads CRIADOS no mês; a meta = eventos NO mês
   (inclui leads antigos agendados agora e exclui leads do mês agendados depois).

Quem qualificou os 84 (evento `→ reuniao_agendada`, primeiro da vida do lead):
Jenifer (SDR) 28 · Mayara (closer) 24 · Mayra (closer) 23 · sem registro/IA 9.
**≈56% da qualificação de julho foi feita por closers e está invisível na tabela "Por SDR".**

## O que já existe no banco (não precisa criar)

- **Quem qualificou**: `status_changes` grava `usuario_id` em TODA conversão via
  `converter-oportunidade` (motivo distingue "Qualificação direta sem reunião" de
  handover). `usuario_id IS NULL` = Agente SDR (IA). Histórico reconstruível desde o go-live.
- **Com/sem reunião**: `negocios.origem_qualificacao` ('reuniao'|'direta') existe
  desde ~21/07 (só 2 registros preenchidos). Retroativo: usar proxy
  `EXISTS (reunioes WHERE negocio_id=...)` — validado (71 com / 13 sem nos 84).
- **Timestamps de SLA**: `leads.created_at` + `min(status_changes.created_at)` do
  evento `reuniao_agendada`. Conferido manualmente em 5 casos (ex.: Joel 13,01h ✓,
  Rogério 34,88h ✓).
- **Origem**: `leads.origem` já classifica Inbound/Outbound (nenhum campo novo).

## Buracos confirmados (dado real 22/07)

1. **Base invisível**: 2.651 leads pré go-live importados; 1.953 leads all-time
   parados em pending/contacted/qualifying sem negócio. 181 leads antigos foram
   TRABALHADOS em julho e não aparecem em lugar nenhum do relatório (coorte é só
   quem foi criado no mês).
2. **Estagnados = 0 é mentira operacional**: só 1 lead em toda a base tem flag
   (ARIEL, criado 19/06 → fora da coorte). Não existe critério temporal. Na coorte
   de julho há 92 leads sem atividade há 7+ dias (88 pending outbound de 09/07 +
   4 contacted). Definição de negócio (X dias, quais estágios) precisa ser
   decidida com o time antes de implementar.
3. **Card "Qualificando" mostra funil cumulativo** (127 = 46 qualificando reais +
   84 qualificados + drift), com subtítulo de contagem de estado. Confunde.
4. **Outbound tem 0% de qualificação** (111 novos, 0 qualificados, 23 desq) vs
   Inbound ~31% (268 novos, 84 qual). O relatório soma tudo e esconde isso.
5. **Caminhos de criação de negócio fora do converter** (POST /negocios manual,
   aceitar-proposta) não gravam `origem_qualificacao` nem evento de qualificação —
   são os 9 "sem registro".
6. Dado de teste em prod: negócio "teste scott" (02/07, Mayra) conta como qualificado.

## SLA de qualificação (medido 22/07, ainda não exposto na UI)

- Coorte julho (75 dos 84 com evento): média 31,4h, mediana 13,1h.
- Por evento em julho (88 qualificações, qualquer coorte): média 115,1h (puxada
  pelos leads antigos), mediana 15,7h. → As duas leituras divergem MUITO; expor
  as duas separadas, nunca uma média única.

## Decisões pendentes de negócio (bloqueiam implementação)

- Definição de "estagnado": quantos dias sem atividade, em quais estágios, e se
  lead `pending` (nunca tocado) conta como estagnado ou como "não trabalhado".
- Se a meta da SDR deve continuar contando só `role='sdr'` (closers cobrindo SDR
  já têm tratamento à parte no round-robin — decisão de manter ou somar).
- O que fazer com os 1.953 parados all-time (retrabalhar, arquivar, desqualificar em massa).

---

## Regras canônicas da camada de métricas

Extensão do padrão que já existe (`lib/relatorios/comercial.ts` já é "fonte única" do Comercial — o problema é que só 2 das 5 abas usam):

```
lib/relatorios/
  periodo.ts        (existe — janela + go-live, mantém)
  comercial.ts      (existe — ganha getFechadoPorResponsavel)
  midia-paga.ts     (existe — ganha flag `pago` + filtro no ranking/funil)
  funil-eventos.ts  (NOVO — métricas por EVENTO sobre status_changes:
                     reuniõesAgendadas, reuniõesRealizadas, noShow,
                     perdidosNoPeríodo, funil cumulativo por lead)
  qualificados.ts   (NOVO ou dentro de comercial.ts — UMA função, usada por
                     TODAS as abas: qualificado = lead distinto que criou
                     negócio [decisão Scott 15/07], com variantes de recorte
                     explícitas: por período do negócio, por coorte de lead,
                     por responsável)
```

**Definições canônicas (regra de ouro — qualquer card novo usa daqui):**

| Métrica | Definição | Fonte |
|---|---|---|
| Qualificado | lead distinto com negócio criado na janela | `negocios.created_at` |
| Reunião agendada | evento `→ reuniao_agendada`, distinct lead, na janela | `status_changes` |
| Reunião realizada | lead que atingiu QUALQUER etapa pós-entrada (`reuniao_realizada`, `trial`, `proposta`, `negociação`, `ganho`) na janela — closers pulam a etapa literal (decisão Kauã 21/07). Fora: `no_show`, `sem_retorno`, `outra_data`, `perdido` | `status_changes` |
| No-show | evento `→ no_show`, distinct lead, na janela | `status_changes` |
| Ganho / receita | `ganho_at` na janela; recorrente=`mrr_fechado`, avulso=`valor_total` | `negocios` |
| Receita por vendedor | MESMA regra acima, agrupada por `responsavel_id` | `negocios` |
| Atribuição a mídia paga | lead cuja `utm_campaign`/`utm_content` casa com campanha/anúncio da Meta (gasto>0). `(direct)`, `(referral)`, `unknown`, `leadform` etc. = orgânico, NUNCA entra em ROAS/CPA/funil pago | coorte do lead × Meta API |
| Pipeline | snapshot sem período (decisão Scott 30/06 — mantém) | `negocios` |

Invariantes que o sistema deve garantir (e testar): soma por vendedor = total do período; receita de vendedor ≤ receita total; funil monotônico decrescente; mesmo rótulo → mesmo número em qualquer aba.

---
