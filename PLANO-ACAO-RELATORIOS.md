# Plano de Ação — Reforma dos Relatórios do CRM Callface

Base: `AUDITORIA.md` (21/07). Entrega em 3 fases: **(1) dados/backend** → **(2) redesign por aba** → **(3) polimento visual**. A Fase 1 corrige toda decisão errada de número; as Fases 2–3 são visuais e só fazem sentido em cima de dado certo.

---

## 1. Arquitetura proposta — camada única de métricas

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

## 2. Tickets (prontos pro Linear)

### FASE 1 — Dados/backend

**T1 · [P0] Receita e ganhos por vendedor errados (decisão de meta/comissão errada)**
Itens 6+7 da auditoria. `/relatorios/equipe` e tabela "Closers" do `/growth` usam janela `created_at` e (no /equipe) `valor_total`.
- Criar `getFechadoPorResponsavel(orgId, since, until)` em `comercial.ts` (janela `ganho_at`, receita = regra do fechado) e consumir nos 2 endpoints; perdidos por evento (`status_changes → perdido` na janela).
- **Aceite:** soma de "Convertidos" por vendedor = card "Negócios ganhos" (22 = 12+10 no período de referência); soma de "Receita" por vendedor = "Receita fechada" (R$ 18.177,68 = 12.961,08 + 5.216,60); nenhum vendedor > total; Comercial e Growth mostram o MESMO número por closer.
- Esforço: M (½ dia com testes).

**T2 · [P0] Regra única de atribuição à mídia paga (3 números diferentes hoje)**
Item 8+10. Adicionar `pago: boolean` em `MetricaDimensao` (= casou com Meta com gasto>0); `rankingPorRoas` e `agregarFunil` só consideram `pago`; chaves GA-style viram bucket "Orgânico/sem campanha" visível mas fora do funil pago. Hero do Marketing e "Atribuição de Receita" passam a usar a mesma regra (cliente atribuído = negócio ganho de lead com UTM casada com Meta).
- **Aceite:** "(direct)" não aparece em Top campanhas por ROAS; "vendas atribuídas à mídia" é o MESMO número na aba Mídia Paga, no hero do Marketing e na Atribuição de Receita (com a diferença all-time × período explícita no rótulo); gasto orgânico R$ 0,00 nunca entra em ROAS.
- Esforço: M–G (1 dia).

**T3 · [P0] Reuniões: fonte única por evento (`status_changes`)**
Itens 1+2+E1+E2. `funil-eventos.ts` com `getReunioesAgendadas/Realizadas/NoShow(orgId, since, until, {somenteSdr?})`. Consumir em `/sdr-esteira`, `/growth` e no funil de vendas do `/marketing`. Growth deixa de contar linhas da tabela `reunioes`; realizadas deixam de ser sempre 0; no-show passa a respeitar o período.
- **Aceite:** no mesmo período, SDR (recorte "agendadas pela SDR") e Growth (org toda) mostram números com rótulo explícito do recorte; "realizadas" > 0 (34 leads em julho); taxa de comparecimento = realizadas/agendadas da MESMA fonte; no-show muda quando muda o período.
- Esforço: M (½–1 dia).

**T4 · [P1] "Qualificado" — propagar a definição canônica (6 → 1)**
Item 3+§4. Todas as abas passam a exibir "Qualificados" via a função canônica. O funil de esteira SDR mantém a visão por estágio, mas a etapa "Qualificado" usa a mesma classificação do board (negócio OU qualified) e o rótulo diferencia "no período por coorte de lead" vs "no período por negócio criado".
- **Aceite:** o card "Qualificados" mostra o mesmo número em SDR, Comercial, Growth e Marketing (mesmo período); variações de coorte só existem DENTRO de funis, com rótulo.
- Esforço: M (½ dia).

**T5 · [P1] Funil de vendas do Marketing: snapshot → evento**
Item E6. Reconstruir com `status_changes` (leads que atingiram cada etapa na janela) — % de conversão passa a ter significado. Mesmo padrão pro funil interno da SDR (resolve item 4: "Em contato" cumulativo passa a incluir quem foi contatado e depois desqualificado).
- **Aceite:** funil monotônico decrescente; card "Trabalhados" e barra "Em contato" da aba SDR não divergem mais na mesma tela (mesma base, rótulos coerentes).
- Esforço: M (1 dia).

**T6 · [P1] Meta comercial: honrar o período selecionado**
Item 12. Remover o ternário no-op; meta do mês do `since` do período (ou rótulo explícito "mês corrente" quando o período cruza meses). Já é função única — sem duplicação a remover.
- **Aceite:** selecionar junho mostra meta/realizado de junho.
- Esforço: P (1-2h).

**T7 · [P1] Testes de invariantes (`scripts/checar-invariantes-relatorios.ts`)**
Script `tsx` (padrão do repo) que roda contra `DATABASE_URL` e falha se: (a) Σ vendedor ≠ total fechado; (b) receita vendedor > total; (c) funis não-monotônicos; (d) "qualificados" divergente entre funções; (e) item de ranking ROAS com gasto=0. Rodar em homolog após cada deploy de relatórios.
- **Aceite:** script vermelho no código atual (pega itens 6/7/10), verde após T1–T5.
- Esforço: M (½ dia).

**T8 · [P2] Fix do 500 em `/fechado-mensal`** (E4 — Date JS vs string). Esforço: P.

**T9 · [P2] `/tracking`: alinhar janelas** (E3 — oportunidades/ganhos da coorte, não all-time). Esforço: M.

### FASE 2 — Redesign por aba (1 ticket por aba, cada um com validação em homolog ANTES de prod)

**T10 · SDR (operação):** funil por evento no topo, conversão por etapa, agendadas×realizadas×no-show lado a lado com taxa real, tabela por SDR. Remove redundância card/funil.
**T11 · Comercial (operação+gestão):** meta → pipeline → win rate/ciclo → motivos de perda → vendedor (dados do T1) → mix.
**T12 · Growth (gestão, "bata o olho"):** meta + MRR + funil completo (números canônicos) + esfriando + alertas acionáveis (gargalo da semana, meta em risco, pipeline parado) no topo.
**T13 · Marketing (coordenação+tráfego):** hero com fonte única (T2), CPL/CAC/atribuição coerentes, canais com UMA normalização.
**T14 · Mídia Paga (gestor de tráfego):** ROAS limpo (T2), CPL/CPQL/CPA por campanha e criativo, alertas de gasto sem conversão — estrutura atual já é boa, ajustar pós-T2.
Esforço: M por aba (½–1 dia cada). **Gate: aprovação visual do Scott/Kauã em homolog por aba.**

### FASE 3 — Polimento

**T15 ·** Fix overlap `HeroKpi` (item 9: `min-w-0` + fonte adaptativa/truncate) — pode ser adiantado pra Fase 1 por ser 1 linha. **T16 ·** Extrair `HeroKpi`/`SectionTitle`/tabelas pra componentes compartilhados (E5). **T17 ·** Padrão de alertas acionáveis replicado (Growth/Comercial/SDR), no molde da aba Mídia Paga.

---

## 3. Ordem de execução e riscos

1. **T1, T2, T3 primeiro** (decisão errada de dinheiro: comissão/meta, verba de tráfego, cobrança de SDR).
2. T4–T7 na sequência (coerência + rede de proteção).
3. Fase 2 aba a aba, homolog → aprovação → prod. **Nada de redesenhar as 5 de uma vez** (lição do módulo CS, 16/07).

**Risco principal:** os números VÃO mudar depois do fix (ex.: receita da Mayara "cai" de R$ 21,8k pra R$ 13,0k na tabela — não é perda real, é correção de régua). Comunicar ao time comercial ANTES do deploy pra não parecer que venda sumiu. Mesma coisa pro ROAS da mídia (vai "piorar" ao tirar o orgânico — é o número honesto).
