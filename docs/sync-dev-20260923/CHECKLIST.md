# Checklist de validação — 23/09/2026

Três ambientes medidos no mesmo dia, direto no banco de cada um.

- **PROD** — `callface-crm-postgres` em 34.204.200.52, via SSH
- **DEV local** — `callface_crm` no Postgres do Mac, servindo http://localhost:3100
- **DEV remoto** — `callface-crm2-dev-postgres`, servindo dev.crm.callface.io

## Módulo base (legado)

| indicador | PROD | DEV local | DEV remoto |
|---|---|---|---|
| leads (total) | 4012 | **4012** | 3989 |
| leads `tipo='lead'` | 1620 | **1620** | 1597 |
| negócios (total) | 1578 | **1578** | 1562 |
| negócios abertos | 536 | **536** | — |
| negócios ganhos | 604 | **604** | — |
| empresas | 2221 | 2225 | — |
| contratos ativos | 597 | **597** | — |
| assinaturas `active` | 130 | **130** | — |
| serviços canônicos | 439 | **439** | — |

DEV local bate com produção em tudo, menos empresas. DEV remoto carrega snapshot
de alguns dias atrás (não foi recarregado nesta sessão; só o modelo canônico foi
corrigido sobre o dado que já estava lá).

### A diferença de 4 empresas

Quatro linhas chamadas "Autônomo", criadas em 23/09 às 02:02, 02:08, 02:16 e
02:24 — uma por rodada da bateria de smokes. Todas com **zero** aquisições,
pessoas, leads, clientes e serviços: órfãs puras.

Causa: `resolverEmpresa` (packages/domain/identity) deduplica por CNPJ ou
domínio, nunca por nome — de propósito, nome não é identidade. Um lead de teste
sem CNPJ e sem domínio corporativo faz o caller criar uma empresa nova a cada
execução. `checar-residuo-de-teste` não pega esse caso.

Não removidas: o DELETE foi recusado pela política de permissão (deleção
irreversível). Impacto é cosmético — nenhuma tela conta empresas órfãs — mas
convém limpar:

```sql
DELETE FROM empresas e
 WHERE e.nome = 'Autônomo' AND e.created_at::date = '2026-09-23'
   AND NOT EXISTS (SELECT 1 FROM aquisicoes a WHERE a.empresa_id = e.id)
   AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.empresa_id = e.id)
   AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.empresa_id = e.id)
   AND NOT EXISTS (SELECT 1 FROM clientes c WHERE c.empresa_id = e.id)
   AND NOT EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = e.id);
```

## Pré-vendas — legado x canônico

| etapa | legado (`sdrBoardColumn`) | DEV local | DEV remoto |
|---|---|---|---|
| novo | pending + outbound | 59 | 59 |
| em_contato | contacted | 490 | 485 |
| qualificacao | qualifying | 211 | 198 |
| qualificado | SQL sem negócio | 21 | 22 |
| oportunidade | com negócio aberto | 141 | 144 |
| nutricao | estagnados | 54 | 54 |
| desqualificado | disqualified | 644 | 635 |
| **soma** | **1620 / 1597** | **1620** | **1597** |

Cada ambiente bate com o próprio legado. A diferença entre as duas colunas de
DEV é só a idade do snapshot (1620 hoje, 1597 há alguns dias).

Resumo do board local coerente: 922 ativos + 54 nutrição + 644 desqualificados = 1620.

## Pipeline

| indicador | legado | canônico (DEV local) |
|---|---|---|
| abertos | 536 | **536** |
| ganhos | 604 | **604** |
| total | 1578 | 1577 |

O que falta é 1 negócio (`INCLUDER | YESTAR | MAYRA`, perdido) sem `empresa_id` e
sem `lead_id`. O canônico exige empresa ou pessoa (SPEC §8.1), então não é
representável. Não é falha de backfill: é registro órfão do legado, e migrá-lo
automaticamente exigiria inventar o vínculo.

## Clientes

| indicador | valor |
|---|---|
| `clientes` canônicos | 275 |
| empresas com serviço no portfólio | 272 |
| leads `tipo='cliente'` | 285 (em 199 empresas, 73 sem empresa) |

Não é divergência: `clientes` nasce **por empresa** (`GROUP BY empresa_id`,
migrations 0039/0041) e `leads.tipo='cliente'` são pessoas. A diferença 275−272
são os CHURNED que a 0041 inclui de propósito.

`clientes.lifecycle_status` está NULL em 275 de 275, mas a coluna não tem leitor
nem escritor em lugar nenhum do código — é órfã, não afeta tela.

## Carteira

| indicador | antes | depois da reconciliação |
|---|---|---|
| `billing_status = ACTIVE` | 135 | **85** |
| assinaturas `active` no legado | 130 | 130 |

**Reconciliação aplicada no DEV local: 60 serviços.** `billing_status` era um
retrato do dia do Won (`servico-canonico.ts:51`) e nenhuma rotina o atualizava;
22 serviços diziam ACTIVE sobre assinatura cancelada, 21 sobre unpaid, 8 sobre
past_due — cerca de R$ 16,5 mil de MRR fantasma.

Os 85 restantes são menos que as 130 assinaturas ativas porque nem toda
assinatura ativa tem serviço canônico vinculado (144 dos 439 serviços têm
`current_subscription_id`).

`billing_status = UNKNOWN` em 264 de 439 **não é defeito**: 253 vêm de
`LEDGER_JULHO`, 10 de MANUAL, 1 de WEVY, todos sem assinatura Stripe. Sem fonte
de cobrança, UNKNOWN é a resposta honesta.

Não aplicado em produção nem no DEV remoto.

## Verificadores

| bateria | resultado |
|---|---|
| smokes + checagens de tela + verificadores | **50 / 50** |
| `tsc --noEmit` | limpo |
| `checar-rotas-onface` | 13 rotas renderizando com dado real |

## O que continua em aberto

1. **Rebuild do app remoto.** `board-pre-vendas.ts` foi copiado para
   dev.crm.callface.io, mas a imagem ainda carrega a query antiga: o dado está
   correto (1597 no funil) e a leitura não (mostra 3989, Novo 2126). O build foi
   recusado pela política de permissão como "Interfere With Workloads", e a
   razão procede — disputa os 2 vCPU com o `callface-crm-app` de produção no
   mesmo host. Rodar fora do horário comercial.
2. **Refresh do banco do DEV remoto.** Ele tem snapshot de alguns dias atrás
   (3989 leads contra 4012). Corrigi o modelo canônico sobre o dado existente,
   não recarreguei o dump.
3. **457 empresas** sem entidade, com nome só em `leads.empresa`. A leitura já
   foi corrigida (576 → 109 cards "Empresa não informada"); criar as entidades a
   partir de texto de formulário poluiria a base, como já poluiu.
4. **4 empresas órfãs** no DEV local (SQL de limpeza acima).
5. **Carteira em produção** — a mesma divergência existe lá e é decisão do Kauã.
