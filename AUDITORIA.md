# Auditoria dos Relatórios — CRM Callface

**Data:** 2026-07-21 · **Escopo:** 5 abas de `/relatorios` (Pré-vendas SDR, Comercial, Growth, Marketing, Mídia Paga) · **Método:** leitura completa do código (rota `api-server/routes/relatorios.ts` + `lib/relatorios/*` + 6 componentes de frontend) e reprodução de cada número no banco de **produção** (queries somente leitura, 21/07). Todos os números reportados pelo Scott no período 01–21/jul foram reproduzidos com exatidão ou com drift de horas (dados novos entre o print e a auditoria).

---

## 1. Diagnóstico estrutural (a causa por trás de quase tudo)

**Não existe camada única de métricas.** Cada aba consulta o pipeline com lógica própria, espalhada em 3 gerações de código:

| Geração | Onde | Usada por |
|---|---|---|
| 1ª (legado) | queries ad-hoc dentro de `relatorios.ts` (`/equipe`, `/marketing`, `/tracking`, `/sdr-esteira`, partes do `/growth`) | Comercial (tabela vendedor), Marketing inteiro, SDR |
| 2ª | `lib/relatorios/comercial.ts` ("fonte única" do Comercial) | Comercial (KPIs), Growth, /resumo |
| 3ª | `lib/relatorios/midia-paga.ts` ("fonte única" da Mídia Paga) | Mídia Paga |

As "fontes únicas" 2 e 3 são de fato consistentes internamente — mas **as abas que consomem a geração 1 divergem de tudo**, e a aba Marketing mistura as 3 (consome `/marketing` + `/tendencias` + `/tracking` num mesmo hero).

Os três eixos de divergência que produzem as 12 inconsistências:

1. **Definições concorrentes da mesma métrica** — "qualificado" tem **6 definições** simultâneas no código (ver §4).
2. **Janelas de data diferentes** — parte das queries filtra por `created_at` do negócio (coorte), parte por `ganho_at` (evento), parte não filtra nada (snapshot all-time).
3. **Snapshot × evento misturados no mesmo funil** — o funil de vendas do Marketing mistura contagem de "quem está na etapa AGORA" (sem período) com "ganhos do período".

**Fato importante descoberto:** a tabela `status_changes` registra TODAS as transições de funil por lead/negócio com timestamp (em julho: 84 leads distintos → `reuniao_agendada`, 34 → `reuniao_realizada`, 3 → `no_show`, 22 → `ganho`, 9 → `perdido`). **Ela já é a "tabela de eventos de funil" que falta** — os relatórios simplesmente não a usam (exceto o card de reuniões agendadas da SDR). Como todos os relatórios são clampados no go-live (01/07, `lib/relatorios/periodo.ts`) e a cobertura do `status_changes` é completa desde então, dá pra medir tudo por evento sem depender de snapshot.

---

## 2. Mapa card → endpoint → query → tabela → filtro

### Aba Pré-vendas (SDR) — `GET /relatorios/sdr-esteira` (`TabSdr.tsx`)

| Card/gráfico | Fonte | Tabela | Janela | Observação |
|---|---|---|---|---|
| Novos leads | leads criados no período | `leads` | `created_at` | ok |
| Trabalhados (+% contatados) | emContato+qualificando+qualificado+**desqualificado** (board logic) | `leads`+`negocios` | `created_at` do lead | **inclui** desqualificados |
| Qualificados | board logic: lead com negócio (qualquer época) OU `sdr_status='qualified'` | `leads`+`negocios` | coorte por lead | definição nº 2 de "qualificado" |
| Desqualificados / Estagnados | `sdr_status` | `leads` | coorte por lead | ok |
| Reuniões agendadas | `status_changes → 'reuniao_agendada'`, distinct lead, **só usuários role=sdr** | `status_changes` | `created_at` do evento | única métrica por evento hoje |
| Reuniões realizadas | `reunioes.status='realizada'` no período | `reunioes` | `data` | **sempre 0** — ver item 2 |
| No-show | `negocios.status='no_show'` | `negocios` | **NENHUMA (all-time)** | snapshot |
| Funil de pré-qualificação | cumulativo do board, **excluindo desqualificados** | `leads`+`negocios` | coorte por lead | diverge do card na mesma tela — item 4 |
| Por SDR | board logic por `responsavel_id` | idem | idem | ok |

### Aba Comercial — `GET /relatorios/comercial` + `/equipe` + `/fechado-mensal` (`TabComercial.tsx`)

| Card/gráfico | Fonte | Janela | Observação |
|---|---|---|---|
| Meta comercial do mês | `getMetaComercialAgregada` | mês corrente (ignora seletor — ternário no-op `periodo === "mes_atual" ? new Date() : new Date()`) | mesma função do Growth, ok hoje |
| Leads qualificados | `getLeadsQualificados`: distinct lead com **negócio criado** no período | `negocios.created_at` | definição nº 1 (canônica por decisão Scott 15/07) |
| Pipeline Total / Negócios Abertos | `getPipelineAtual` snapshot | nenhuma (decisão Scott) | ok, documentado |
| Win Rate | `getWinRate`: ganho/perdido com `created_at` no período + `origem_negocio='novo'` | `negocios.created_at` | coorte, não evento |
| Ciclo médio | `getCicloMedio` | `ganho_at` | ok |
| Motivos de perda | `getMotivosPerda` | `negocios.created_at` | perdidos por coorte |
| Mix recorrente×avulso, Receita fechada, Ticket, Negócios ganhos | `getFechadoPeriodo`: recorrente=`mrr_fechado`, avulso=`valor_total` | `ganho_at` | fonte 2ª geração, correta |
| MRR/Ganhos por semana | `/fechado-mensal` SQL cru | `ganho_at`/`contratos.inicio` | ok (endpoint tinha 500 pré-existente anotado 15/07) |
| **Desempenho por Vendedor** | `/equipe` query ad-hoc | **`negocios.created_at`** + receita = **`valor_total`** | **itens 6 e 7** |

### Aba Growth — `GET /relatorios/growth` (`TabGrowth.tsx`)

| Card | Fonte | Observação |
|---|---|---|
| Meta, MRR ativo, MRR novo, Pipeline, Receita/eficiência | mesmas funções de `comercial.ts` | consistente com aba Comercial ✓ |
| Leads por canal | `leads.origem` cru (sem normalização) | difere do donut do Marketing (normalizado) |
| Investimento (mídia) + "N leads pagos" | Meta Ads API (`fetchMetaCampaignInsights`) | **"leads pagos" = contagem da Meta**, não do CRM — item 5 |
| Funil: Qualificados | `getLeadsQualificados` | = Comercial ✓ (104) |
| Funil: Reun. agendadas | `count(*) reunioes` com `data` no período | **item 1** — 82; fonte diferente da SDR (31) |
| Funil: Reun. realizadas | `reunioes.status='realizada'` | 0 — item 2 |
| Funil: No-show | `negocios.status='no_show'` all-time | snapshot |
| Closers no período | query ad-hoc: janela `created_at`, receita=`mrr_fechado` | 3ª variação de "receita por vendedor" |

### Aba Marketing — `/marketing` + `/tendencias` + `/tracking` (`TabMarketing.tsx`)

| Card | Fonte | Observação |
|---|---|---|
| Hero (Investimento/Leads/CPL/Qualificados/Clientes/ROAS) | **`/tracking`** (não `/marketing`) | Qualificados = `sdr_status IN ('qualifying','qualified')` (definição nº 5); Clientes = lead do período com **assinatura Stripe ativa** (definição própria) → **0** — item 8 |
| Leads por Canal (donut) | `/marketing` CASE normalizado por utm_medium/origem | 210 Mídia Paga — item 5 |
| Funil Pré-vendas | `/marketing`: só `sdr_status` (sem board logic) | Qualificado = 68 (definição nº 3) — item 3 |
| Funil de Vendas | `/marketing`: **snapshot** por etapa + "Ganho (período)" | Reunião agendada=25 (snapshot), Realizada=8 (snapshot) — itens 1 e 2 |
| CPL/CPQ/CPC por campanha e criativo | `/marketing`: Meta API + qualificado = `qualified` OU `negocio_ativo_id` (definição nº 6) | mais uma variação |
| Atribuição de receita (MRR ativo) | `/tracking`: assinaturas ativas × `utm_campaign` não-vazio, **all-time** | 5/82 — item 8 |
| Tracking por Campanha/Origem/Source/Mídia | `/tracking` funilPor: leads do período; oportunidades/ganhos **all-time** via match por e-mail | janelas mistas na mesma linha |

### Aba Mídia Paga — `GET /relatorios/midia-paga` (`TabMidiaPaga.tsx`)

| Card | Fonte | Observação |
|---|---|---|
| Tudo | `lib/relatorios/midia-paga.ts` — coorte por `utm_campaign`/`utm_content` (lead criado no período) × Meta API | fonte única real, mas trata **qualquer** valor de `utm_campaign` como campanha (inclusive `(direct)`, `(referral)`, `unknown`) — itens 8 e 10 |
| Ranking ROAS | `rankingPorRoas` — sem filtro de gasto | item 10 |
| Alertas | `gerarAlertas` sobre campanhas `gasto>0` | ok (alertas já filtram) |

**Agregação no frontend (risco):** o hero do Marketing soma `qualificados`/`clientes`/`mrrReal` de `porOrigem` no cliente (`TabMarketing.tsx:318-324`); ROAS/CPL/CPM de criativos também são recalculados no cliente. O resto vem pronto do backend.

---

## 3. As 12 inconsistências — causa raiz confirmada

**1. Reuniões agendadas: 31 (SDR) vs 82 (Growth) vs 25 (Marketing).** Três fontes distintas, todas reproduzidas no banco (32/82/25 em 21/07):
   - SDR: eventos `status_changes → 'reuniao_agendada'` no período, distinct lead, **filtrado a usuários role=sdr** (32). A SDR Jenifer não é quem move todos os cards — closers/admins também movem, por isso só 32 dos 84 leads que tiveram o evento contam aqui.
   - Growth: linhas da tabela `reunioes` com `data` no período (82) — inclui reuniões marcadas por qualquer pessoa e re-agendamentos (85 linhas para 84 leads).
   - Marketing: **snapshot** de negócios parados HOJE na etapa `reuniao_agendada` (25) — nem é métrica de período.
   - *Causa raiz:* nenhuma fonte canônica de evento. A correta é `status_changes` (org toda = 84 leads distintos no período; recorte SDR = 32).

**2. Reuniões realizadas: 0 (SDR/Growth) vs 8 (Marketing).** As 85 linhas de `reunioes` em julho estão TODAS com `status='agendada'` — ninguém marca reunião como realizada na UI, então a métrica por essa tabela está morta (sempre 0). O 8 do Marketing é snapshot de negócios na etapa `reuniao_realizada` hoje. **O dado real existe**: `status_changes → 'reuniao_realizada'` = 34 leads distintos em julho. É esse número que nenhuma aba mostra.

**3. Qualificados: 104 vs 77 vs 68.** Três definições (confirmadas: 105/80/70 em 21/07):
   - 104 (Comercial/Growth) = distinct lead com **negócio criado no período** (`getLeadsQualificados`) — inclui leads criados ANTES de julho que viraram negócio em julho (coorte pelo negócio).
   - 77 (SDR) = leads **criados no período** que têm negócio (qualquer época) OU `sdr_status='qualified'` (coorte pelo lead, board logic).
   - 68 (funil pré-vendas do Marketing) = leads criados no período com `sdr_status='qualified'` apenas — perde os que viraram negócio sem o campo ser atualizado.
   - *Nota:* a regra canônica já foi decidida pelo Scott em 15/07 (documentada em `midia-paga.ts`): **qualificado = criou negócio**. Só não foi propagada.

**4. SDR: "Trabalhados 277 (75,5%)" vs funil "Em contato 182 (50%)" na mesma tela.** Confirmado (281 vs 185 em 21/07): "Trabalhados" soma emContato+qualificando+qualificado+**desqualificado** (96); a barra "Em contato" do funil soma emContato+qualificando+qualificado **sem** os desqualificados. Um lead desqualificado foi contatado (senão não seria desqualificado), então o funil cumulativo subestima o estágio "Em contato". Mesma base, dois recortes, sem rótulo que explique.

**5. Leads por canal: 206 vs 210 vs total 367.** Dois efeitos sobrepostos:
   - O "Mídia Paga = 206" do Growth é o KPI **"leads pagos" reportado pela API da Meta** (contagem da plataforma de anúncio); o "210" do Marketing/Por Origem é a contagem de **leads do CRM** com `origem='Mídia Paga'`. Fontes diferentes por natureza (a Meta atribui pelo clique; o CRM pela origem do cadastro) — hoje 210 no CRM nos dois agrupamentos.
   - Nenhuma soma "bate com o total" porque cada visão agrupa diferente: Growth agrupa `origem` crua (aparecem `meta_ads`, `website`, `organico` soltos), Marketing normaliza por CASE de `utm_medium`+`origem`. As somas fecham em 371 (total atual) dentro de cada visão — o que confunde é comparar rótulos entre visões.

**6. Negócios ganhos 22 vs tabela de vendedor 19 (10+9).** Confirmado exato. `/equipe` filtra negócios com **`created_at` no período** e status `ganho`; o card usa **`ganho_at` no período**. Existem **3 negócios criados antes de 01/07 e ganhos em julho** (F5=3) que aparecem no total e somem da tabela por vendedor. Não há negócio sem responsável (0 órfãos). Por `ganho_at`: Mayara 12 + Mayra 10 = 22 ✓.

**7. Receita da Mayara (R$ 21.874,09) > receita total (R$ 18.177,68).** Confirmado exato — dois bugs compostos em `/equipe`:
   - **Métrica errada:** soma `valor_total` (valor cheio do contrato, ex. anual/setup) em vez da regra do total (recorrente = `mrr_fechado`; avulso = `valor_total`). Julho é 100% recorrente, então o total = R$ 18.177,68 de MRR, enquanto a linha da Mayara soma valor de contrato.
   - **Janela errada:** `created_at` em vez de `ganho_at` (item 6).
   - Números certos por vendedor (regra do total, `ganho_at`): Mayara **R$ 12.961,08**, Mayra **R$ 5.216,60** → soma = R$ 18.177,68 ✓. Obs.: a tabela "Closers no período" do **Growth** ainda mostra um TERCEIRO número (`mrr_fechado` com janela `created_at` → Mayara R$ 12.781,09). São 3 receitas diferentes pra mesma vendedora em 2 abas.

**8. Atribuição de cliente à mídia paga: 3 vs 0 vs 5.** Confirmado exato — três regras:
   - **3 vendas** (aba Mídia Paga) = negócios ganhos de leads criados no período com `utm_campaign` não-vazio. **Mas 2 das 3 são `utm_campaign='(direct)'`** (tráfego direto, não campanha) — só 1 venda é de campanha paga real (`TRT - CALL FACE [2026]`).
   - **0 clientes** (hero do Marketing) = leads criados no período com **assinatura Stripe ativa** vinculada — os que fecharam em julho ainda não têm assinatura ativa vinculada ao lead, então dá 0.
   - **5 de 82** (Atribuição de Receita) = assinaturas ativas **all-time** cujo lead tem `utm_campaign` não-vazio (qualquer valor, inclusive orgânico).
   - *Causa raiz:* não existe regra de atribuição definida. Cada ponto inventou uma (negócio-ganho × assinatura-ativa; período × all-time; qualquer-utm × sem filtro de pago).

**9. Sobreposição visual Investimento × Leads (aba Marketing).** `HeroKpi` (`TabMarketing.tsx:222`) renderiza o valor em `text-3xl/4xl` dentro de um grid `lg:grid-cols-6` sem `min-w-0`/`truncate`/`overflow-hidden` — "R$ 3.546,40" não cabe em 1/6 da largura e vaza sobre o card vizinho. Mesmo componente duplicado em `TabMidiaPaga.tsx` (lá o grid é de 4, por isso não estourou ainda).

**10. "(direct)" no ranking de ROAS.** Confirmado: 5 leads com `utm_campaign='(direct)'` no período, 2 vendas, gasto 0. `rankingPorRoas` ordena por ROAS e preenche com itens sem ROAS (gasto=0) até completar 10 — sem filtro "é campanha paga". `utm_campaign` no banco tem valores GA-style que não são campanha: `(direct)`, `(referral)`, `unknown`, `leadform`. Isso infla a leitura de performance da mídia e contamina também o funil agregado e as "vendas atribuídas" (item 8).

**11. Ticket médio × ganhos = receita.** Consistente por construção dentro de `comercial.ts` (`ticket = receita/ganhos` da mesma query). Ficará divergente APENAS onde a receita exibida vier de outra fonte (tabela de vendedor — item 7). Corrigido o item 7, fecha em todas as abas.

**12. Meta comercial duplicada (Comercial × Growth).** Ambas chamam a MESMA função `getMetaComercialAgregada` — não divergem hoje. Dois poréns: (a) em `/comercial` o argumento tem um ternário no-op (`periodo === "mes_atual" ? new Date() : new Date()`) — a meta ignora o seletor de período silenciosamente (se o usuário escolher junho, vê meta de julho com rótulo "do mês"); (b) o realizado usa `mrr_fechado` por `ganho_at` — correto e igual ao card Receita fechada ✓.

---

## 4. Inventário de definições concorrentes (pra fixar a fonte única)

**"Qualificado" — 6 definições no código:**
1. `getLeadsQualificados` (Comercial/Growth): distinct lead com negócio criado no período ← **canônica (decisão Scott 15/07)**
2. `/sdr-esteira` board: lead criado no período com negócio (qualquer época) OU `sdr_status='qualified'`
3. `/marketing` funil pré-vendas: `sdr_status='qualified'` puro
4. `/equipe` qualificados: `sdr_status='qualified'` por responsável
5. `/tracking`: `sdr_status IN ('qualifying','qualified')`
6. `/marketing` CPQ: `sdr_status='qualified'` OR `negocio_ativo_id IS NOT NULL`

**"Reunião" — 3 fontes:** `status_changes` (evento, correta) · tabela `reunioes` (nunca atualizada pós-agendamento) · snapshot de etapa do pipeline.

**"Receita do vendedor" — 3 fórmulas:** `valor_total`+`created_at` (/equipe) · `mrr_fechado`+`created_at` (/growth closers) · `mrr_fechado`/`avulso`+`ganho_at` (getFechadoPeriodo ← correta).

**Janela de período — 3 comportamentos:** evento no período (`ganho_at`, `status_changes`) · coorte por `created_at` · snapshot sem período (pipeline — intencional e documentado; no-show e funil de vendas do Marketing — NÃO intencional).

## 5. Achados extras (fora da lista inicial)

- **E1.** No-show em SDR e Growth é snapshot all-time de `negocios.status='no_show'` (não reage ao período). Evento existe: `status_changes → 'no_show'` (3 em julho).
- **E2.** "Taxa de comparecimento" da SDR divide realizadas (tabela `reunioes`, sempre 0) por agendadas (`status_changes`) — sempre 0%, mistura de fontes.
- **E3.** `/tracking` mistura janelas na mesma linha: leads do período, mas oportunidades/ganhos all-time (join por e-mail sem filtro de data no negócio).
- **E4.** `/relatorios/fechado-mensal` com 500 pré-existente já anotado em 15/07 (Date JS onde Postgres espera string) — a aba Comercial degrada os 2 gráficos semanais quando ocorre.
- **E5.** `HeroKpi` e `SectionTitle` duplicados byte a byte entre `TabMarketing` e `TabMidiaPaga` (candidatos a componente compartilhado).
- **E6.** O funil de vendas do Marketing rotula "Reunião agendada → ... → Ganho (período)" misturando 5 barras de snapshot com 1 barra de período — o % de conversão exibido entre etapas não tem significado.

## 6. Conclusão

Nenhuma inconsistência é "dado sujo" — o banco está íntegro e `status_changes` dá cobertura completa de eventos desde o go-live. Todos os problemas são de **camada de agregação**: definições não unificadas, janelas trocadas e snapshot no lugar de evento. A correção estrutural é uma camada única de métricas canônicas (extensão de `lib/relatorios/`) consumida pelas 5 abas — plano em `PLANO-ACAO-RELATORIOS.md`.
