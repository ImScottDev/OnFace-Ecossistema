# Legado nas telas (`app/src/app/` e `app/src/components/`)

Atualizado: 2026-10-21. Somente leitura. Fronteira: só `app/` e `components/`; `lib/` e `api-server/` ficam com a outra varredura.

**Onde medi:** `localhost:5432/callface_crm` (cópia de desenvolvimento, não o `callface_crm_mz` de produção). Nessa cópia as etapas pararam de mudar em 12/10 e os ganhos em 09/10, então "frescor" aqui não decide nada; decidi por **valor constante** e por **divergência contra o canônico**. Reexecute em produção antes de agir.

## Achado estrutural

Dentro dessa fronteira **nenhuma tela lê `leads.status`** (4.254 de 4.254 em `novo`) nem `crm2_pre_vendas_stage` (4.254 de 4.254 nulo). O caso conhecido já não está aqui; ele vive em `lib/` e `api-server/`. O que sobrou nas telas é dual-write que ainda fecha com o canônico, mais três problemas reais listados abaixo.

Sincronia medida legado ↔ canônico (dual-write funcionando):

| Par | Divergentes | Base |
|---|---|---|
| `leads.estagio_pre_vendas` ↔ `pipeline_etapas.codigo` via `aquisicoes` | 1 | 4.188 |
| `leads.qualificado` ↔ `aquisicoes.qualificado` | 0 | 4.188 |
| `leads.empresa_id` ↔ `aquisicoes.empresa_id` | 0 | 4.188 |
| `leads.nome/email/empresa_id` ↔ `pessoas` | 0 / 0 / 0 (tel 1, cargo 3) | 4.203 |
| `negocios.status` ↔ `oportunidades.stage`; `etapa`; `responsavel_id`; `empresa_id`; `titulo` | 0 | 1.645 |
| `negocios.valor_total` ↔ `oportunidades.valor` | 2 | 1.645 |
| `negocios.mrr_estimado` ↔ `oportunidades.mrr` | 27 | 1.645 |
| `leads.responsavel_id` ↔ `aquisicoes.responsavel_id` | **70** (59 ambos preenchidos e diferentes, 11 canônico nulo) | 4.188 |
| `leads.sdr_status` ↔ etapa canônica (mapa 1:1 esperado) | **54** estritos | 4.188 |

Cobertura do canônico: `pessoas` cobre 4.203 de 4.254 leads (98,8%); `aquisicoes` 4.188 (98,4%); `oportunidades.pessoa_id` 1.581 de 1.645 (96,1%).

## 1. Tabela de achados

| Arquivo:linha | O que lê/escreve | Classe | Evidência |
|---|---|---|---|
| `app/(produto)/layout.tsx:74-81` | `contatos.status/canal/nao_lidas` (badge da caixa) | A | `contatos` é a conversa, sem par canônico. 2.047 de 2.047 `open`, 0 com `closed_at`: a ação `close` existe (`api-server/routes/atendimento.ts:390`) mas nunca foi usada. Badge conta 542 não lidas. |
| `calendario/reuniao-actions.ts:67-71` | `reunioes` JOIN `leads`/`negocios` | A | `reunioes` só tem `lead_id` (324/343) e `negocio_id` (321/343); sem `pessoa_id`. |
| `calendario/reuniao-actions.ts:104-116` | oportunidades abertas via `negocios` + `leads` | A | Peça é chaveada por `negocios.id`; `status`/`resp` batem com `oportunidades` (0 divergentes). |
| `calendario/reuniao-actions.ts:127-131,144-150` | `leads.nome/sobrenome/cargo/email/empresa` (busca de contato) | C | `pessoas` tem os mesmos campos, 0 divergência de nome/email, cobertura 98,8%. |
| `pipeline/tags-actions.ts:64-86` | `negocios`/`leads` + `lead_labels`/`negocio_labels` | A | Tags chaveadas por id legado; `entity_labels` também. |
| `pipeline/actions.ts:74` | `UPDATE negocios.campos_custom` (resumo) | A | Escrita legado; leitura do desenho usa a mesma chave (`oportunidade-para-o-desenho.ts:150`). |
| `pipeline/actions.ts:193` | existência de `leads` na org | A | O id vindo do cliente é id de lead. |
| `pipeline/exportar/route.ts:69-71` | `leads.telefone/whatsapp/email` (CSV) | C | `pessoas.email/telefone/whatsapp` existem; cobertura 98,8%. |
| `ajustes/qualidade-dados/duplicidade/page.tsx:51` | `leads.nome/empresa` | C | `pessoas.nome` + empresa por `empresa_id`; 0 divergência. |
| `empresas/por-lead/page.tsx:21` | `leads.empresa_id` | C | `pessoas.empresa_id`, 0 divergência em 4.203. |
| `pre-vendas/actions.ts:241` | `UPDATE leads SET empresa_id, empresa` | **B** | Grava só no legado: não toca `pessoas.empresa_id` nem `aquisicoes.empresa_id`. Sem trigger de espelho. Hoje 0 divergência; cada uso a partir daqui abre uma. |
| `pre-vendas/actions.ts:568,595` | `leads` (editar contato) | A | Correto: `UPDATE pessoas` logo em seguida (:599). |
| `contatos/actions.ts:363,373` | busca de pessoa/oportunidade em `leads`/`negocios` | C | `pessoas` e `oportunidades.titulo` (0 divergência). |
| `contatos/actions.ts:408,562` | ficha: `leads` por id | C | `pessoas.lead_id_legado` já é lido no mesmo trecho (:408). |
| `contatos/actions.ts:545` | `DELETE FROM leads` (+ aquisicoes, pessoas) | A | Exclusão em cascata completa. |
| `contatos/actions.ts:599-602` | `UPDATE leads/pessoas SET empresa_id = NULL` | **B** | Esquece `aquisicoes.empresa_id`; empresa excluída deixa aquisição apontando para empresa inexistente. |
| `propostas/actions.ts:116-118,233-234,485-487` | `leads.nome` como "pessoa" da proposta | C | `oportunidades.pessoa_id` cobre 1.581 de 1.645 (96,1%); o comentário "negocios não tem pessoa_id" já é verdade só do legado. |
| `propostas/actions.ts:440,485,494,500,824` | `negocios.etapa/status/service_family` | A | `etapa` e `status` 0 divergentes vs `oportunidades`. |
| `propostas/nova/page.tsx:58-60` | `negocios` JOIN `leads` | A | Mesma consulta da linha acima. |
| `clientes/[id]/actions.ts:181` | `leads` → insere `pessoas` (promoção) | A | É a ponte. |
| `api/financeiro/vendas/route.ts:48,71` | `faturas JOIN leads` (inner) | A | `faturas.lead_id` 1.101 de 1.111: **10 faturas somem** da visão. `faturas.empresa_id` 1.021 de 1.111 (92%), então o canônico cobre menos. |
| `api/financeiro/inadimplencia/route.ts:71` | `assinaturas LEFT JOIN leads` | A | `assinaturas.lead_id` 310/382, `empresa_id` 340/382. |
| `api/financeiro/churn/route.ts:38` | idem | A | idem |
| `api/webhooks/meta-lead-ids/route.ts:87-118` | `leads.meta_*` | A | `aquisicoes` não tem campos `meta_*`. |
| `api/webhooks/{site-lead,meta-leads,rd-lead}` | cria `leads` com `status='novo'` | A | Entrada do dual-write. Escreve a coluna congelada, ninguém a lê nesta fronteira. |
| `api/onboarding/route.ts`, `[id]/route.ts` | `negocios.campos_custom->>'onboardingStage'` | A | Rota sem consumidor em `app/` nem `components/`; 11 ganhos com o campo. Candidata a remoção. |
| `components/crm2/qualificacao/LeadDrawerCf2.tsx:283,391` | `lead.sdrStatus` (idade na etapa, lista "mover para") | **B** | `sdr_status` não acompanha a etapa canônica: 18 `pending` já em nutrição/oportunidade (+3 sem aquisição), 31 `qualifying` já em qualificado, 1 em nutrição, 4 `contacted` em oportunidade. |
| `components/crm2/qualificacao/DesqualificarModal.tsx:90` | `PATCH /api/leads/:id {sdrStatus}` | A | Escreve o legado via API (`api-server`); confirmar lá se espelha `aquisicoes.etapa_id` (fora da fronteira). |

## 2. Bugs silenciosos (B)

1. **Gaveta do lead em Financeiro lê `sdr_status`** (`LeadDrawerCf2.tsx:283,391`, aberto por `onface/financeiro/Financeiro.tsx:118`). Pelo menos **54 de 4.188** leads têm `sdr_status` incompatível com a etapa canônica (18 `pending` que já saíram de "novo", 32 `qualifying` fora de "qualificação", 4 `contacted` em oportunidade). Se `qualified` (289) contra nutrição (117) e oportunidade (84) também contar, são 255. O usuário vê "idade na etapa" e a lista "mover para" calculadas sobre a etapa errada, e o Quadro de Pré-vendas diz outra coisa. É a mesma família do `leads.status`, só que a coluna ainda muda, então ninguém percebe.
2. **`acaoAssociarEmpresa`** (`pre-vendas/actions.ts:241`) grava `leads.empresa_id` e não espelha em `pessoas` nem `aquisicoes`. 0 divergência hoje; a primeira associação cria divergência, e as telas que já migraram (`Cliente 360`, `empresas/[id]`) deixam de ver a empresa.
3. **Exclusão de empresa** (`contatos/actions.ts:599-602`) zera `empresa_id` em `leads` e `pessoas` mas não em `aquisicoes`. A aquisição fica apontando para a empresa apagada.

Não é B nesta fronteira, mas o número fica registrado para a outra varredura: `leads.responsavel_id` diverge de `aquisicoes.responsavel_id` em **70 de 4.188** (59 com responsáveis diferentes, 11 com canônico nulo), sempre com o legado preenchido; nenhuma tela de `app/`/`components/` lê `leads.responsavel_id` direto. Também `leads.crm2_pre_vendas_stage` e `crm2_*_em` são 4.254 de 4.254 vazios.

## 3. Migração fácil (C)

| Onde | Trocar por | Cobertura do canônico |
|---|---|---|
| `calendario/reuniao-actions.ts:127-150` (nome, cargo, email) | `pessoas` (+ `pessoas.empresa_id`) | 4.203 de 4.254 (98,8%) |
| `pipeline/exportar/route.ts:69` | `pessoas.email/telefone/whatsapp` | 98,8% (tel: 1 divergente) |
| `ajustes/qualidade-dados/duplicidade/page.tsx:51` | `pessoas.nome` | 98,8% |
| `empresas/por-lead/page.tsx:21` | `pessoas.empresa_id` via `lead_id_legado` | 98,8%, 0 divergência |
| `contatos/actions.ts:363,373,408,562` | `pessoas`, `oportunidades.titulo` | 98,8% / 0 divergência de título em 1.645 |
| `propostas/actions.ts:116-118,233-234,485-487` | `oportunidades.pessoa_id` → `pessoas` | 1.581 de 1.645 (96,1%); os 64 restantes são `negocios.lead_id` nulo |

Ressalva comum: os 51 leads sem `pessoas` (e os 66 sem `aquisicoes`) precisam de fallback ou backfill antes de cortar.

## 4. Contagem

| Classe | Achados |
|---|---|
| A (legítima) | 17 |
| B (bug silencioso / escrita sem espelho) | 3 |
| C (migração fácil) | 7 |
| Total | 27 |
