# O que ainda é legado, o que está quebrado, e em que ordem arrumar

Varredura do sistema inteiro — `app/`, `components/`, `lib/`, `api-server/`, `worker/`, `packages/` —
em 21/10/2026. Medido no banco local `callface_crm` (cópia de dev, dados até ~12/10).
**Reexecutar em produção antes de agir sobre qualquer número.**

Detalhe por arquivo: [legado-nas-telas.md](./legado-nas-telas.md) e [legado-nas-libs.md](./legado-nas-libs.md).

---

## 1. O cutover não terminou, e isso é decisão registrada

`docs/decisoes/2026-09-22-refactor-arquitetural.md`: fases 17, 25 e 26 **concluídas**; fases **27 e 28
— desligar escrita legada e remover fallback — "não executadas, por instrução […] dependem de
aprovação do Kauã"**.

O dual-write está vivo porque alguém decidiu que ficasse. A ponte diz isso em letras maiúsculas:

> "ESTA FUNÇÃO EXISTE PARA MORRER. […] as telas ainda leem `leads` e `negocios`. Se a entrada
> passasse a escrever SÓ no modelo canônico hoje, o lead sumiria da tela de pré-vendas no mesmo
> instante."

## 2. O canônico está preenchido, e o dual-write fecha

| Legado | | Canônico | |
|---|---|---|---|
| `leads` | 4.254 | `pessoas` 4.265 · `aquisicoes` 4.190 | |
| `negocios` | 1.645 | `oportunidades` | 1.654 |
| `contatos` | 2.047 | `pessoas` | |
| | | `oportunidade_itens` | **3** ← morta |

Onde a ponte roda, ela fecha: `negocios` × `oportunidades` tem **0 divergentes em 1.645** (status,
etapa, responsável, empresa, título, `ganho_at`). `leads.estagio_pre_vendas` × `aquisicoes.etapa_id`:
**1 divergente em 4.188**.

Das ~784 leituras de legado em ~170 arquivos: **~700 são legítimas** (fallback do dual-write),
~60 são bug, ~25 são migração fácil.

**Então o problema não é ler legado.** É ler coluna que parou de ser escrita.

---

## 3. A causa raiz

**`garantirEntradaCanonica` é chamada uma única vez na rota de leads: na linha 619, dentro do POST.**
O `PATCH /leads/:id` (linha 1063) não chama nada canônico — edita `leads` e para.

Criar lead espelha. Mudar responsável, desqualificar, associar empresa: não espelha. **A divergência
nasce no uso diário**, não na migração.

Produz, hoje: 70 leads com responsável divergente e 54 com `sdr_status` incompatível com a etapa.

---

## 4. Os bugs silenciosos, por gravidade

Cada um é uma coluna que parou de andar, com alguém ainda lendo.

### B1 — A resposta do lead no WhatsApp não acha o lead
`contatos.lead_id`: **26 de 2.047 (1,3%)**. `whatsapp_mensagens.lead_id`: **113 de 16.143 recebidas
(0,7%)**.
`worker/index.ts:2533-2651` só liga cadência, atividade e `communications.pessoa_id` quando
`contato.leadId` existe. Ficam de fora `vendas/consultas.ts:716`, `prospeccao-detalhe.ts:199`,
`fulfillments.ts:488`, `whatsapp.ts:692`, `relatorios.ts:531`.
**O que se vê:** o cliente responde e o lead não reage — cadência não para, atividade não aparece,
"quem respondeu" dá 4 em vez de 678. O casamento por telefone existe desde 14/10 para conversa
nova; o passivo é o histórico não religado.

### B2 — Cadência quebra ou duplica conversa — **corrigido** (`aa28576a`)
`cadence-engine.ts` inseria em `contatos` **sem `ON CONFLICT`**, contra o índice único
`idx_contatos_sessao_phone`, e sem o prefixo 55 no telefone. Falhava quando o lead já tinha
conversa sem vínculo — **~635 leads** casam por telefone.
A varredura achou um segundo caso, pior: `agentes/autonomia.ts` usava
`onConflictDoNothing().returning()`, que devolve vazio no conflito — a agente **abandonava o lead
em silêncio**, sem erro e sem log. Os dois passam a adotar a conversa existente, como
`garantir-conversa.ts` e o worker já faziam. Trava em `atendimento/conversa-unica.test.ts`,
estrutural: varre o runtime e pega arquivo novo que insira conversa sem adoção.

### B3 — "Sem próxima ação" nunca filtra
`negocios.proxima_acao`: **0 de 1.645**. Lido por `lib/inicio/consultas.ts:777` (card do closer no
Início) e `packages/domain/sales/queries/board-pipeline.ts:92` (board do Pipeline).
**O que se vê:** toda oportunidade aberta aparece como sem próxima ação — inclusive as 53 que têm
tarefa. O alerta vira ruído e ninguém olha mais.

### B4 — `leads.negocio_ativo_id` desatualizado
**82 preenchidos contra 235 leads com negócio aberto** — faltam 153 (65%). Consumido por Command
Center, `relatorios.ts:944/970` (qualificados por campanha), título do negócio na conversa de
WhatsApp, `notas.ts:92` e fechamento comercial.

### B5 — `leads.status` congelado
**`novo` em 4.254 de 4.254.** Consumido por condição de cadência (`cadence-engine.ts:997`), contexto
do agente de IA (`worker/index.ts:1899`, `builder.ts:129`), `leads.ts:279`, `catalogo.ts:512`,
`whatsapp.ts`, `email.ts`.
**Provado pela API:** `?status=novo` → 4.210; `?status=qualificado` → **0**, existindo 119
qualificados. O mesmo vale para `?setor=`, sobre `empresa_setor`, também degenerada.

### B6 — `leads.tipo` contradiz a classificação
**Só 12 de 130 leads com contrato ativo estão como `cliente`** — 117 estão como `contato`. Command
Center, Início, Atendimento e Contatos CRM2 filtram por essa coluna e contradizem o que
`lib/vendas/classificacao.ts` diz.

### B7 — Gaveta do lead em Financeiro lê `sdr_status`
`components/crm2/qualificacao/LeadDrawerCf2.tsx:283,391`. **54 leads** com `sdr_status` incompatível
com a etapa canônica (18 `pending` fora de "novo", 32 `qualifying` fora de "qualificação", 4
`contacted` já em oportunidade). Idade na etapa e lista "mover para" saem erradas.

### B8 — Associar e excluir empresa não espelham
`pre-vendas/actions.ts:241` grava `leads.empresa_id` sem tocar em `pessoas`/`aquisicoes`.
`contatos/actions.ts:599-602` zera em `leads` e `pessoas` mas deixa `aquisicoes` apontando para a
empresa apagada. Hoje 0 divergentes: a primeira associação cria a divergência.

### Exibidas e sempre vazias
`previsao_fechamento` (0 linhas dos dois lados, exibida em Atendimento, NEXO e Pipeline);
`leads.enrich_status` 100% `pending`; `leads.empresa_estado` 100% `SP`; `leads.num_filiais` 100% `1`;
`apollo_*` 0 preenchidos; `convertido_at`, `contrato_*`, `nps_*`, `valor_total`, `mrr_estimado`,
`valor_setup` em 0 de 4.254.
Pior que vazias: **parecem dado**. "Estado da empresa: SP" aparece para os 4.254.

---

## 5. Ordem de correção

Do que mata a origem e custa pouco, para o que exige backfill.

| # | O quê | Por que agora | Risco |
|---|---|---|---|
| **1** | **PATCH de lead espelha no canônico** | mata a origem de B7, B8 e das 124 divergências; sem isso todo backfill volta a divergir | escrita — exige aprovação |
| ~~2~~ | ~~`?status=` e `?setor=` pela etapa canônica~~ | **feito** (`171839a4`) | — |
| ~~3~~ | ~~"Sem próxima ação" lê `tarefas`~~ | **feito** (`171839a4`), 270 reais em vez de 278 | — |
| **4** | **Religar o histórico de WhatsApp ao lead por telefone** | B1: devolve a resposta do cliente ao funil | leitura; backfill de vínculo exige aprovação |
| ~~5~~ | ~~`ON CONFLICT` na cadência~~ | **feito** (`aa28576a`), mais o caso silencioso da agente | — |
| **6** | **`leads.tipo` e `negocio_ativo_id` derivados** | B4 e B6: parar de ler coluna e derivar do canônico | médio |
| **7** | **Backfill dos 70 + 54 já divergentes**, com trilha reversível | só depois de 1, senão volta a divergir | escrita — exige aprovação |
| **8** | **Esconder o que é sempre vazio** | campo que mostra "SP" para todos mente | baixo |
| **9** | As ~25 migrações fáceis `leads` → `pessoas` | precisa de fallback: 51 leads sem `pessoas`, 66 sem `aquisicoes` | baixo |

**Fora desta lista, de propósito:** desligar a escrita legada (fases 27/28). É destrutivo e depende
de aprovação do Kauã, como a própria decisão arquitetural registra.
