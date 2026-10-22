# Auditoria: quanto do ONFACE já é a arquitetura nova — 21/10/2026

Medido no banco de **produção** (`callface_crm_mz`) e no código em `main`.
Nada aqui é estimativa: cada número tem a consulta que o produziu no corpo do
texto ou no diário da sessão.

## Veredito curto

A arquitetura canônica **existe, está construída e está correta**. O que não
aconteceu é o **cutover**: o legado continua sendo onde se escreve e, em 247
arquivos de runtime, onde se lê. O refactor parou nas fases 27 e 28, que o
próprio [documento do refactor](../decisoes/2026-09-22-refactor-arquitetural.md)
declara "não executadas, por instrução", desde 22/09/2026.

O desenho do Scott — **pessoa é a entidade; contato, lead, cliente e prospect
são relacionamentos dela** — está implementado: `aquisicoes.pessoa_id` tem
chave estrangeira para `pessoas`, e **4.409 de 4.409 aquisições têm pessoa**.
Quem contradiz o desenho é a tabela `leads`, que é legado: ela não referencia
`pessoas` e duplica nome, sobrenome, e-mail, telefone, cargo, LinkedIn e
WhatsApp. É por isso que foi possível criar lead sem pessoa.

## Tamanho real do que falta

| Medida | Legado | Canônico |
|---|---|---|
| Leitores em runtime (`app`, `api-server`, `lib`, `worker`) | **143** em `leads` · **104** em `negocios` | 45 em `aquisicoes` · 75 em `oportunidades` |
| Escritores em runtime | 12 em `leads` (10 pela porta, 2 exceção nomeada) · 22 em `negocios` | — |
| Escritores em `scripts/` | 29 em `leads` · 11 em `negocios` | — |

Leitores de `leads` por área: `api-server/routes` 24 · `lib/vendas` 21 ·
`lib/crm` 15 · `app/(produto)` 11 · `lib/relatorios` 10 · `lib/integrations` 10
· `lib/cs` 7 · `lib/automacoes` 6 · `lib/ai-platform` 6 · `lib/analytics` 4 ·
`lib/agentes` 4 · `app/api` 4.

A fase 17 ("leitores") está concluída para as **telas de vendas**, e isso é
verdade; não significa que o resto do produto leia o canônico. Relatórios, CS,
automações, integrações e a plataforma de IA continuam no legado.

## Estado dos dados, e o que é defeito de verdade

O canônico foi preenchido por backfill em 22/09 e **diverge desde então**:

| Desde o backfill | Criados | No canônico | Só no legado |
|---|---|---|---|
| leads | 548 | 379 | 169 |
| negócios | 136 | 109 | 27 |

**Mas a maior parte dessa divergência é por desenho, não defeito.** Separando:

- **97 leads sem e-mail nem telefone** — prospecção outbound de lista (nomes como
  "Academia de Verdade", "Clínica Ideal"), onde a empresa entra antes do contato
  ser descoberto. A porta canônica recusa com `SEM_IDENTIFICADOR` **e recusa
  certo**: sem identificador não há como deduplicar. O SPEC prevê o caso em
  "Empresa sem Pessoa — persiste sem Pessoas, enriquecer posteriormente", e
  `lib/vendas/prospeccao.ts` tolera esse código de propósito, com o motivo
  escrito. Quem traz esses de volta é `preQualificar`, na saída do outbound.
- **45 leads com origem nula e tipo contato** — cadastro avulso de `/contatos`.
  **Todos os 45 têm pessoa.** Não têm aquisição porque não são processo
  comercial, o que é o SPEC §14 ("Criar Pessoa não cria Lead") funcionando.
- **16 leads `plataforma/cliente`** — carga dos clientes self-service, feita por
  `scripts/trazer-clientes-da-plataforma.ts` com `INSERT INTO leads` direto.
  **Esse era defeito**, corrigido em 21/10 (ver abaixo).
- **19 negócios ganhos sem oportunidade canônica** — **todos os 19 têm serviço
  canônico ativo**, então **o MRR está correto**. A perda é no histórico do
  pipeline, não na receita.

### O buraco que sobra: 130 leads duplicados

152 leads não têm pessoa ligada por `pessoas.lead_id_legado`; 71 deles têm
identificador. Investigando esses 71: **65 já têm aquisição** (logo a pessoa
existe e está ligada à aquisição), e dos que têm pessoa pelo e-mail, **34 têm
essa pessoa presa em outro lead** — porque `idx_pessoas_lead_legado` é UNIQUE.

Ou seja: **não falta criar pessoa. Faltam mesclar duplicatas.** A base tem
**118 grupos de e-mail repetido, 130 leads excedentes**. O canônico está certo
(uma pessoa, um registro); o legado é que tem a mesma pessoa duas vezes.

Empresas duplicadas:

| Critério | Grupos | Excedentes | Decisão |
|---|---|---|---|
| CNPJ idêntico | **1** | 1 | mesclagem trivial, sem ambiguidade |
| Nome normalizado | 96 | 107 | exige decisão caso a caso |

## Corrigido nesta sessão

**O corredor de `scripts/`.** A trava `escritores-migrados` exige que todo
criador de lead passe pela porta canônica, mas varria só `app`, `api-server`,
`lib` e `worker`. `scripts/` ficava fora — e por ali passa carga **real** de
produção. Foi assim que a carga dos clientes self-service criou 16 leads sem
pessoa, sem nenhuma trava acusar, e o upgrade do cliente travou porque quem
vende lê `pessoas`.

Agora `scripts/` é varrido, com a dívida conhecida declarada nome por nome (26
fixtures de teste em leads, 11 em negócios) e não por padrão de prefixo — o
"padrão frouxo" que o próprio arquivo registra como a causa de sete criadores de
lead terem passado escondidos. **Provado quebrando:** um script com
`INSERT INTO leads` sem a porta faz a trava falhar e nomear o arquivo; removido,
volta a 15/15 verde.

## O que NÃO foi feito, e por quê

- **Backfill dos órfãos e mesclagem de duplicatas** — exigem escrita no servidor
  de produção, bloqueada nesta sessão por permissão (`Remote Shell Writes` e
  `Credential Materialization`). Os comandos estão no fim do diário da sessão.
- **Rodar `scripts/backfill/05-identidade.ts`** — **não recomendado como está**.
  Ele roda (verificado, exit 0), mas o relatório mostra "sem e-mail e sem
  telefone: 110 (viraram pessoa própria)": ele criaria "pessoa" chamada
  *Academia de Verdade* para empresa-alvo de prospecção. É o mesmo defeito de
  natureza que criou 36 empresas com nome de pessoa em 21/10. O backfill é mais
  permissivo que a porta, e aqui a porta está certa.
- **Rodar `scripts/backfill/06-aquisicao.ts`** — criaria aquisição para os 97
  casos que são por desenho, enchendo o board de prospecção. Mudança visível de
  comportamento: exige OK do Scott.
- **Fases 27 e 28** — 247 arquivos de runtime. Não é trabalho de uma sessão, e
  desligar a escrita legada sem ninguém para reverter, com o time entrando no
  dia seguinte, é risco que não se justifica.

---

# Adendo 22/10/2026 — diagnóstico de duplicados rodado em PRODUÇÃO

A mescla de pessoas foi executada em **13/10 somente em homologação**
(`docs/operacao/mesclas-homologacao-20261013.md`: "Produção não foi tocada"),
com 71 pares e 0 falhas. A pendência "**levar vínculo e mescla para produção**"
está aberta desde então.

`scripts/diagnostico-contatos-duplicados.sql` rodado contra produção
(org `320a9052-dd43-4edb-9b74-34be53c5c419`):

## Pessoas — 254 pares

| Prova | Pares | Executa? |
|---|---|---|
| e-mail + telefone + mescla de leads | **78** | sim (prova forte) |
| e-mail + telefone | **19** | sim (prova forte) |
| mescla de leads + telefone | **4** | sim (prova forte) |
| e-mail + mescla de leads | **4** | sim (prova forte) |
| só telefone | 141 | **não** — decisão humana |
| só e-mail | 8 | **não** — decisão humana |

**105 pares com prova forte.** `scripts/mesclar-pessoas-duplicadas.ts` executa
exatamente esses e deixa os 149 restantes listados; tem backup por linha,
`--desfazer` validado por canário, e trava `ALVO_PERMITIDO`.

## Empresas — 76 pares

| Prova | Pares | Veredito |
|---|---|---|
| CNPJ idêntico | **1** | mesclar (ver abaixo) |
| domínio | 9 | **não** — são filiais com CNPJ diferente (Atrio, Bravo Log, Hospital Care) |
| só nome | 66 | **não** — decisão humana |

### O par de CNPJ é dívida da carga de 21/10

| Empresa | CNPJ | Criada | Serviços |
|---|---|---|---|
| `FERREIRA NETO & SOUZA` | 42.463.043/0001-53 | 30/09 | 0 |
| `Camila Soares` | 42463043000153 | **21/10** | 1 |

A segunda nasceu da carga dos clientes self-service **com nome de pessoa** — o
defeito registrado em `fallback-inventa-dado`. Na ocasião 6 duplicatas foram
mescladas e 10 nomes corrigidos; **esta escapou**. O nome correto é o da
primeira; o serviço está na segunda.

Mesclagem de empresa **não deve ser feita à mão**: 37 tabelas referenciam
`empresas`, e existe `empresas.canonical_empresa_id` com ferramenta própria
(`scripts/resolver-duplicadas-callface-ai.ts`).

## Não executado, e por quê

Backup de produção feito: `/opt/callface/crm2-dev/backups/prod-antes-mesclas-20261022-1444.dump`
(53 MB, exit 0). A execução em si foi barrada: levar os scripts ao container
(`Remote Shell Writes`), obter a credencial (`Credential Materialization`) e
abrir túnel para o banco (`Credential Exploration`). Comandos no relatório da
sessão.
