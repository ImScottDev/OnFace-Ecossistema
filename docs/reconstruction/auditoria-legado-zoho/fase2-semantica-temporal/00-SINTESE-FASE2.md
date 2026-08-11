# Fase 2 — Síntese: Semântica, Temporalidade e Procedência

> Consolidação das 5 frentes da segunda etapa da auditoria forense (10-11/08/2026), seguindo os 12 entregáveis (A-L) pedidos pelo Kauã. **Nada foi alterado, importado ou corrigido** — CRM, Zoho e código foram só lidos. Regra mantida em toda a síntese: nenhum achado é veredito ("está errado"), é evidência que precisa reconciliação, com confiança explícita. Onde a fonte discorda de si mesma ou de outra fonte, isso é dito abertamente, não resolvido por conta própria.
>
> Esta síntese não substitui os 5 relatórios completos (`A` a `E`, mesma pasta) nem a fase 1 (`../00-SINTESE-CONSOLIDADA.md`) — ela cruza os achados novos com o que já era sabido e organiza pelos entregáveis pedidos.

---

## 0. Antes de tudo — 3 achados que não são arqueologia, são operação viva agora

A pergunta original era "o que significa e como reconstruir o passado", mas 3 achados desta fase são sobre o presente, não sobre 2023-2025:

1. **76 contratos (38 pares) ainda duplicados por `stripe_subscription_id`** no snapshot de produção de 10/08 — um dia *depois* de um fix (commit `e14c184`, 09/08) que corrigiu a causa raiz de um bug de MRR duplicado documentado no próprio código-fonte ("36 pares, R$17.449,30/mês de excesso"). O fix impede duplicata nova; não limpou o passivo que já existia. **Se ainda não foi limpo manualmente, o financeiro pode estar contando MRR em dobro hoje.**
2. **Dois churns aconteceram na mesma semana desta auditoria** (Ammo Varejo, 20/07, R$21.161,90 de inadimplência documentada; Compucenter, 04/08, nota escrita no dia 10/08) e nenhum dos dois está refletido no CRM. O gap de churn não é resíduo da migração de 12/06 — é o sistema atual não tendo canal de entrada pra esse fato, hoje.
3. **O workflow n8n `dVd5mywo36xGfGEa` (RD Station→Zoho, mantido por Growth/Wevy) estava ativo pelo menos até 16/06/2026** — 4 dias depois do cutover — e seu dedupe verifica só contra o Zoho, nunca contra o CRM novo. Não foi possível confirmar nesta sessão se ainda está ativo hoje (10/08); se estiver, continua duplicando lead novo.

O resto deste documento é a análise semântica/temporal pedida. Estes 3 pontos ficam registrados aqui em destaque porque, diferente do resto, têm prazo — cada dia sem decisão é mais MRR duplicado, mais churn sem tratamento, mais lead duplicado.

---

## A. Mapa semântico do legado

Fonte: [`A-mapa-semantico-eventos.md`](./A-mapa-semantico-eventos.md).

Classificação das **1.551 oportunidades** do Zoho nas 13 categorias pedidas + achado de um **14º grupo residual não pedido, mas relevante** (nenhuma linha ficou sem classificar):

| Categoria | Qtd. | % | Confiança dominante |
|---|---:|---:|---|
| oportunidade comercial real | 856 | 55,2% | alta |
| aquisição | 268 | 17,3% | alta |
| alteração contratual | 99 | 6,4% | 71 dessas 99 (72%) são AMBIGUOUS |
| churn | 88 | 5,7% | alta |
| upgrade | 87 | 5,6% | alta |
| expansão | 65 | 4,2% | média |
| downgrade | 30 | 1,9% | alta |
| renovação | 26 | 1,7% | alta |
| proposta | 21 | 1,4% | média |
| atividade | 5 | 0,3% | alta (teste técnico) |
| contrato | 4 | 0,3% | média |
| documento | 2 | 0,1% | média |
| reativação | 0 | 0% | alta (confirmado ausente) |
| outro evento | 0 | 0% | — |

**Leitura central**: o padrão "nome como lógica de negócio" que a fase 1 descreveu é real, mas é minoritário — 55% da base é venda comercial normal, sem evento pós-venda documentado. O corpo de eventos pós-venda (churn+upgrade+downgrade+renovação+alteração contratual) é ~19% do total.

**Refinamento do "244" da fase 1 → 247 registros distintos** (5 abreviações/tokens novos encontrados — `UPG`, `DOWNG`/`DOWG`, `RENEGOCIAÇÃO`, `CANCELA/SUBSTITUI` — menos 4 sobreposições deduplicadas). Não é contradição com a fase 1, é recontagem mais fina.

**Achado novo relevante para o modelo canônico**: **351 oportunidades têm `Oportunidade Origem` preenchida** (vínculo estrutural real, não por nome) — das quais **145 (41%) não carregam nenhum token de evento no nome**. É um segundo corpo de alterações pós-venda (integração técnica, ramal adicional, portabilidade) que o time nunca rotulou explicitamente. Natureza (upsell/downgrade/neutro) não determinável só pelo CSV — ver item L.

**Achado que exige cautela ao usar o volume de downgrade/renovação em qualquer métrica**: cruzando o Stage do próprio registro-evento, **50% dos 30 downgrade** e **34,6% das 26 renovação** têm Stage = Perdido/Closed Lost/Sem Retorno — indício (confiança média, AMBIGUOUS) de que a mudança pode ter sido oferecida e nunca efetivada, não um evento concluído. Para churn o mesmo padrão é bem mais fraco (8%) — a hipótese de "não efetivado" é bem menos aplicável a churn do que a downgrade/renovação.

## E. Classificação das oportunidades/eventos mal modelados (deep-dive nos 247)

Cruzando os 247 eventos contra Contratos/Propostas/Itens Cotados nativos:

| Categoria | N | Contrato encontrado | Proposta encontrada |
|---|---:|---:|---:|
| churn | 88 | 39% | 52% |
| upgrade | 87 | 52% | 83% |
| downgrade | 30 | 33% | 90% |
| renovação | 26 | 35% | 77% |
| alteração contratual (alta) | 16 | 44% | 88% |
| **Total** | **247** | **42,5%** | **72,5%** |

A proposta é o documento mais consistentemente gerado por evento (72,5%); o contrato nativo, bem menos (42,5%) — coerente com o achado #1 da fase 1 de que o próprio módulo de Contratos do Zoho já tinha baixa disciplina de uso.

**Caso notável de campo não confiável**: dos 279 contratos nativos, só 2 têm `Status="Cancelado"` — e ambos apontam pra eventos classificados `upgrade`/`migração`, não `churn`. Não usar `Contratos.Status` como proxy de churn sem cruzar com ZohoSign/Notes.

**Decisão de nomenclatura pendente (não é fato, é escolha de produto)**: upgrade(87)+downgrade(30) somam 47% dos 247 e não estavam nas 7 categorias-alvo originais. Duas leituras válidas, ambas somando 247 — usar upgrade/downgrade como tipos próprios, ou mapear upgrade→expansão e downgrade→alteração contratual. **Decisão do Kauã**, não resolvida aqui.

---

## B. Mapa temporal da jornada do cliente

Fonte: [`B-timelines-clientes.md`](./B-timelines-clientes.md). 20 empresas (top-12 por valor histórico + 8 com cadeia de 2+ eventos de lifecycle, incluindo LOGITHINK e Vetlog obrigatórios), cada evento tagueado CONFIRMED/INFERRED/AMBIGUOUS.

**Leitura agregada dos 20 casos**: 17 mostram lacuna de migração relevante, 2 mostram representação essencialmente correta (Mauloni; parcialmente Caruaru), e 2 mostram um problema **novo e vivo**, não histórico — duplicação de negócio por sincronização (G30, Venda na Veia: 2 registros idênticos criados no mesmo milissegundo com `zoho_id` diferentes, indício de sync reverso CRM→Zoho, não do Zoho legado).

**Padrão que se repete em 6 dos 20 casos**: retrodatação sem documento de origem (Vetlog, Hospital Care, Compucenter, São Leopoldo Mandic, Swiss Park Office, Grupo Ri Happy) — fechamento registrado anos antes da criação do registro no Zoho. Em 1 caso (Grupo Ri Happy) isso é **documentado e intencional** (nota explícita citando reconstrução a partir de um sistema anterior, AutoTask) — nos outros 5, é retrodatação silenciosa, sem prova documental de que a data é real (mas também sem evidência de que seja falsa — apenas não comprovável pelo CSV).

**Achado financeiro concreto**: em Swiss Park Office, somando os 5 eventos com contrato nativo assinado e confirmado que não migraram, o MRR real seria pelo menos **R$9.254,90** — quase o dobro do R$4.765,00 que o CRM mostra hoje.

**Contraponto que ajuda a calibrar o problema**: Mauloni (negócio perdido, representado corretamente como perdido) e Prefeitura de Caruaru mostram que a migração funciona bem quando o negócio não passa pelo Stage "Contrato"/"Concluído" do pipeline legado — o problema é concentrado exatamente ali, não generalizado a toda a base.

**Achado sobre o próprio ranking**: metade do top-12 por valor nominal (MARU, FIEMT, Prefeitura SJDR, Mauloni) são negócios de 1 oportunidade nunca fechada (Stage Perdido) — "maior valor histórico" no Zoho mistura cliente real de longa duração com proposta gigante que nunca fechou. Isso é, em si, um achado de qualidade de dado, não um erro de critério.

Tabela completa (20 linhas) e os 20 blocos de timeline detalhados estão no relatório fonte — não reproduzidos aqui por volume.

---

## C. Mapa de procedência dos dados

Fonte: [`C-procedencia-dados.md`](./C-procedencia-dados.md). Framework de 3 categorias aplicado por tabela via SQL.

**Limitação estrutural confirmada**: `propostas`, `faturas`, `notas` e `atividades` não têm coluna `zoho_id` — amplia o achado #9 da fase 1 pra mais 4 tabelas. A pergunta "isso é legado ou novo" só é responsável com certeza nas 4 tabelas que têm a coluna (`leads`, `empresas`, `negocios`, `contratos`).

| Tabela | Legado nunca tocado | Legado alterado pós-corte | Novo pós-corte |
|---|---:|---:|---:|
| leads (3.196) | 315 | 2.135* | 570 |
| empresas (1.560) | 53 | 891* | 292 |
| negocios (1.104) | 797 | 242 | 65 |
| contratos (319) | 0 | 0 | 319 (100%) |

*\*Atenção: a maior parte desses "alterados" não é edição humana gradual — é um único evento de sistema no minuto `2026-07-01 07:12`, ver seção G abaixo.*

**Achado tranquilizador sobre contaminação de teste**: irrelevante nos dados pós-cutover (4 leads de teste interno, 0 empresas, 0 negócios nativos). Todo o lixo de teste que a fase 1 achou ("Mussum Trapalhão" etc.) é 100% legado Zoho antigo (2023-2025, com `zoho_id`), não contaminação do CRM 2.0.

## G. Procedência dos 319 contratos e das faturas atuais

**Faturas (563)**: 100% `origem='stripe'`, inseridas exclusivamente pelo job/webhook `stripe-sync.ts` — sem ambiguidade, sem import manual, confiança alta.

**Contratos (319)** — 4 mecanismos de código diferentes identificados:

| Origem | Qtd. estimada | Mecanismo | Confiança |
|---|---:|---|---|
| Backfill Stripe, 1ª execução (01/07, mesmo microssegundo) | 171 | `stripe-sync.ts`, busca `status: "all"` (inclui histórico cancelado) | Alta |
| Backfill/catch-up Stripe (04/08, minutos) | 30 | Mesmo mecanismo, execução periódica | Média |
| Proposta aceita → negócio ganho (orgânico) | 78 | `aceitar-proposta.ts` + `negocios.ts` | Alta |
| Residual (lead fechado manual / criação manual UI / catch-up) | ~40 | `leads.ts` + `contratos.ts` + sobra do sync | Média |

**O achado mais importante desta frente**: **166 dos 171 contratos do dia 01/07 foram inseridos no mesmo microssegundo** (`07:12:28.640346`) — assinatura inequívoca de script de backfill, não uso orgânico. **96 desses 171 já nasceram com `status='churned'`** porque o sync busca histórico completo do Stripe, não só assinaturas ativas.

**O que o código NÃO explica**: o mesmo minuto (`07:12` de 01/07) também bateu `updated_at` de **1.748 leads e 942 empresas**. O código explica parcialmente o toque em leads (vínculo de `stripe_customer_id`); **nada no código disponível toca `empresas`**, e o git deste repo foi resetado em 29/06 — se um script ad-hoc rodou manualmente em produção nesse dia, não é visível nesta auditoria. **Não determinável — pergunta direta pro Kauã** (item L).

---

## D. Classificação estado (STATE) vs evento (EVENT) no schema atual

Fonte: [`E-state-vs-event.md`](./E-state-vs-event.md).

| Campo/Tabela | Classificação | Por quê |
|---|---|---|
| `negocios.status`, `contratos.status`, `oportunidades.stage` | STATE | Sobrescrito a cada update, 1 valor atual |
| `clientes.statusFinanceiro` | STATE, declarado mas morto | Comentado como "cache de leitura" no schema — zero código escreve nele hoje |
| `status_changes` | EVENT genérico de transição de pipeline | Append-only, mas sem vocabulário de lifecycle; **apagado em cascata** quando o negócio/lead é excluído |
| `event_outbox` | EVENT de domínio, genérico | Formato certo (payload livre, nunca deletado), mas nenhuma rota emite Won/Upgrade/Downgrade/Renewal/Churn/Reactivation hoje |
| `comercial_evidencia` | EVENT (mais limpo do schema) | Dedup real, nunca UPDATE — mas escopo fechado em "prova de Won", não cobre pós-venda |
| `mrr_movimentos` | EVENT financeiro | Já tem vocabulário `churn`/`reativacao`/`expansao`/`contracao`, append-only — mas só alimentado pelo Stripe, desconectado de `negocios`/`oportunidades` |

**Achado que conecta direto com a fase 1**: `app/src/lib/crm/contrato-duplicidade.ts:240-252` registra renovação de contrato sobrescrevendo `status` **e concatenando texto livre em `contratos.notas`** — o mesmo anti-padrão "fato registrado como texto, não como dado estruturado" que a fase 1 flagrou no Zoho (`Nome Oportunidade de Venda`), reencarnado no próprio CRM 2.0.

**Resposta direta à pergunta "existe hoje lugar pra Evento de lifecycle datado e append-only?"**: não, para o vocabulário completo ligado de volta à Opportunity. Existem 4 peças append-only reais e funcionais (`status_changes`, `event_outbox`, `comercial_evidencia`, `mrr_movimentos`), cada uma cobrindo uma fração adjacente — nenhuma cobre Upgrade/Downgrade/Renewal/Churn/Reactivation com link de volta à origem.

**Validação da hipótese das 4 dimensões (Opportunity/Contract/Lifecycle/Event) contra os dados**:
- **Opportunity ≠ Event**: confirmado com força pelos dados — 97,5% dos 121 casos têm evento posterior ao `ganho_at`; se o schema sobrescrevesse o negócio original, a pergunta "quando foi ganho" ficaria irrespondível.
- **Opportunity ≠ Contract**: já existe na prática (tabelas diferentes), mas por acidente de arquitetura, não decisão consciente de lifecycle.
- **Contract ≠ Lifecycle**: coerente com o produto real (multi-contrato AI+PABX), mas **nenhum dos 365 casos analisados exigiu concretamente essa separação** — é antecipação de escala, não correção de um sintoma já medido.
- **Achado extra que facilita a decisão**: `negocioOrigemId` já reproduz a topologia do `Oportunidade Origem` do Zoho, com FK simbólica — mas só é escrito 1 vez, no momento do Won (`aceitar-proposta.ts:158-179`, cria um negócio-clone `status='ativo'`). Estender esse padrão já-existente para eventos pós-venda é continuar uma linha de código real, não introduzir um conceito novo.

---

## F. Investigação da origem dos 449 leads pós-cutover

Fonte: [`D-leads-449-pos-cutover.md`](./D-leads-449-pos-cutover.md). Número recalculado do zero, bate exato com a fase 1. **Os 449 completos foram processados (não amostra).**

**A conclusão muda substancialmente a leitura da fase 1**: não são 449 leads comerciais represados.

| Categoria | Qtd | % |
|---|---:|---:|
| DUPLICADO | 402 | 89,5% |
| CLIENTE_EXISTENTE (27/32 com `stripe_customer_id` confirmado) | 32 | 7,1% |
| LEAD_COMERCIAL_REAL | 12 | 2,7% |
| SPAM_LIXO | 3 | 0,7% |
| USUARIO_DA_PLATAFORMA / AUTOMACAO (categoria final) / AMBIGUO | 0 | 0% |

**Causa raiz, confiança alta**: o workflow n8n `dVd5mywo36xGfGEa` (RD Station→Zoho, `Criado Por = growth@wevy.cloud` em 100% dos 447 pós-corte) continuou ativo depois do cutover — confirmado por evidência independente do vault (registrada por outra sessão, sem relação com esta auditoria): reconstruído deliberadamente 3 dias antes do corte, editado de novo em 15-16/06 (4 dias depois). A nota da própria edição de 16/06 confirma: **o dedupe do workflow verifica só contra Contacts do Zoho, nunca contra o CRM novo** — é exatamente o buraco que produz os 402 duplicados. 397 dos 402 nasceram no CRM dentro de 1 hora (maioria em segundos) da mesma submissão indo pro Zoho — mesma requisição, dois destinos.

**O que continua real da fase 1**: 12 leads (2,7%) sem qualquer correspondência no CRM, sem sinal de teste — únicos candidatos legítimos a decisão de importar.

**Limitação declarada**: sem acesso ao n8n da Wevy nem ao painel do Zoho nesta sessão — não foi possível confirmar se o workflow **ainda está ativo hoje** (10-11/08), só que estava até 16/06.

---

## H. Entidades que precisam existir no modelo canônico

Com base no que os dados exigiram nas 5 frentes (não teoria):

1. **Opportunity** — venda, congelada no momento do Won/Lost (já existe como `negocios`/`oportunidades`, funciona bem para isso).
2. **Contract** — termos contratuais (prazo, multa, produto) — hoje existe (`contratos`) mas 100% desconectado do legado (`zoho_id` nunca preenchido) e majoritariamente desconectado do negócio (75% sem `negocio_id`).
3. **Lifecycle Event** — fato datado, append-only, vocabulário Won/Upgrade/Downgrade/Renewal/Churn/Reactivation, com link de volta à Opportunity de origem (equivalente ao `Oportunidade Origem` do Zoho). **Não existe hoje** — é o gap mais bem-suportado pelos dados (244+145 casos reais).
4. **Customer Lifecycle State** — candidato natural: `clientes.statusFinanceiro`, já declarado no schema, sem nenhum código escrevendo nele.
5. **Segundo corpo de alteração pós-venda sem token de evento** (145 casos, achado A) — precisa de algum lugar, mesmo que seja "alteração contratual não classificada" até investigação manual.

## I. Informações históricas que obrigatoriamente precisam ser preservadas

- Os 247 registros de evento pós-venda do Zoho e seus links via `Oportunidade Origem` — são fato histórico, independente de qual vocabulário final o CRM 2.0 adotar.
- As datas de fechamento/assinatura originais, mesmo quando retrodatadas sem documento comprobatório (6 dos 20 casos da timeline) — são a melhor evidência disponível, não devem ser descartadas por não serem 100% verificáveis.
- Os 76 contratos duplicados por `stripe_subscription_id` — precisam ser reconciliados (não simplesmente deletados um dos dois sem checar qual tem os pagamentos/faturas reais vinculados).
- A distinção entre negócio "ganho" original e negócio-clone `ativo` que já existe em `negocios.negocioOrigemId` — é o único lugar do CRM 2.0 que já pratica a separação Opportunity/Lifecycle na prática.

## J. Informações que devem ser preservadas só como histórico/legado, não como operação atual

- Os 145 casos de "Oportunidade Origem preenchida sem token de evento" cuja natureza (upsell/downsell/neutro) não é determinável — registrar como histórico, não promover automaticamente a evento operacional sem revisão.
- Os 50%/34,6% de downgrade/renovação com Stage=Perdido — histórico de que a mudança foi *proposta*, não necessariamente de que foi *efetivada*. Não usar como base de métrica de retenção sem revisão nota-a-nota.
- Retrodatações sem documento de origem (Vetlog, Hospital Care, Compucenter, São Leopoldo Mandic, Swiss Park Office) — preservar a data como melhor estimativa disponível, mas sem tratá-la como fato 100% verificado.

## K. Informações que são lixo e não devem ser carregadas

- Os 3 SPAM_LIXO dos 449 leads (testes internos do próprio time).
- Os 4 leads de teste pós-cutover já identificados no CRM atual (`kaua.araujo+1@...`, `scott@scottstudio.com.br`, etc.) — volume irrelevante, mas não devem contaminar nenhuma migração futura.
- O lixo de teste legado do Zoho ("Mussum Trapalhão" etc., já identificado na fase 1) — confirmado aqui como 100% legado antigo, não deve ser replicado.
- Os 402 leads DUPLICADO do Zoho — importá-los criaria duplicidade nova, não recuperaria nada real.
- Os 32 CLIENTE_EXISTENTE do Zoho — importar seria pior que inútil (risco de acionamento indevido de cliente pagante).

## L. Decisões de negócio que ainda dependem do Kauã

Compiladas das 5 frentes, sem ordem de prioridade além do que já foi destacado na seção 0:

1. **Os 76 contratos duplicados (38 pares) já foram limpos manualmente, ou ainda estão contando MRR em dobro hoje?** (seção 0, item 1 — o mais urgente).
2. **O que rodou em produção às 07:12 de 01/07/2026?** É a primeira varredura completa do `stripe-sync.ts`, ou rodou junto algum script de correção de `empresas` que não sobrou no histórico do git? Vale perguntar a quem fez esse deploy.
3. **O workflow n8n `dVd5mywo36xGfGEa` ainda está ativo hoje?** Se sim, decidir entre desligar ou adaptar o dedupe pra checar o CRM novo antes de escrever no Zoho.
4. **Os 12 leads LEAD_COMERCIAL_REAL** ainda fazem sentido comercialmente dado o tempo passado (mais antigo de 22/06)?
5. **Vocabulário de Evento**: upgrade/downgrade como tipos próprios ou subtipos de expansão/alteração contratual? (47% dos 247 eventos dependem dessa escolha).
6. **Os 145 casos de "Origem sem token de evento"**: vale investigar nota a nota, ou aceitar como "alteração contratual não classificada" permanentemente?
7. **Separação Contract≠Lifecycle**: compensa criar agora (sem caso medido que exija) ou nasce quando o primeiro conflito real aparecer (ex: contrato ativo + cliente inadimplente sem estar formalmente churned)?
8. **`clientes.statusFinanceiro` vira a state machine formal de Lifecycle**, ou Lifecycle deveria ser tabela própria?
9. **Estender `negocioOrigemId` para pós-venda** (upgrade/downgrade/renovação/churn), continuando o padrão já existente em `aceitar-proposta.ts`, é a direção certa?
10. **~40 contratos residuais sem rajada e sem `negocio_id`** — vale auditar 1 a 1 (são poucos) pra confirmar se são "lead fechado manualmente" legítimo?
11. Os casos AMBIGUOUS de Hospital Care (2 downgrades de -R$7.770,00 no mesmo mês — é a mesma redução renegociada, uma segunda redução real, ou duplicação de registro?) e G30/Venda na Veia (negócio duplicado por sync reverso) — decidir se vale investigar a fundo antes de qualquer reconciliação financeira.

---

## Fontes

- [`A-mapa-semantico-eventos.md`](./A-mapa-semantico-eventos.md)
- [`B-timelines-clientes.md`](./B-timelines-clientes.md)
- [`C-procedencia-dados.md`](./C-procedencia-dados.md)
- [`D-leads-449-pos-cutover.md`](./D-leads-449-pos-cutover.md)
- [`E-state-vs-event.md`](./E-state-vs-event.md)
- [`../00-SINTESE-CONSOLIDADA.md`](../00-SINTESE-CONSOLIDADA.md) — fase 1
