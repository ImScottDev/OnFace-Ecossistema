# Entrega — refactor de arquitetura canônica do ONFACE

> Estado em 21/09/2026. Este documento é o que o prompt de execução pede em
> "Final delivery", e serve para uma decisão: **virar ou não virar**, e com o
> que ainda aberto.
>
> Fonte da execução: `refactor-state.md` (estado atual) e
> `refactor-execution-log.md` (histórico). Fonte do AS-IS:
> `database-as-is/`. Fonte normativa do TO-BE: `ONFACE-ARCHITECTURE-SPEC.md`.

## 1. Branch e commits

`refactor/arquitetura-canonica`, criada de `98940fe`. **62 commits** no refactor.

## 2. Migrations

Dezessete, todas EXPAND ou com inverso documentado no próprio arquivo. Nenhuma
apaga coluna ou tabela: a contração é a fase 27 e não foi executada.

| # | O que faz |
|---|---|
| 0056 | `organizacao_id` NOT NULL em 4 tabelas financeiras + 3 FKs que faltavam |
| 0057 | cria `pipeline_etapas`, `aquisicoes`, `ofertas_comerciais`, `pagamentos`, `conversas`, `domain_events`, `timeline_events`, `cs_health_snapshots` |
| 0058 | automação versionada, RBAC normalizado e arquivos |
| 0059 | corrige unicidade de inscrição em automação (bloqueava histórico legítimo) |
| 0060 | `reconciliacao_casos` e `backfill_provenance` |
| 0061 | `cargo` e `updated_at` em vínculo pessoa-empresa |
| 0062 | 10 colunas de atribuição em `pontos_contato` |
| 0063 | as 4 ofertas comerciais do SPEC §12.3 |
| 0064 | vínculo canônico de proposta e contrato |
| 0065 | vínculo de cliente e serviço canônico |
| 0066 | `tipo` e `cycle_number` em `fulfillments` (onboarding E implantação) |
| 0067 | `communications` e `conversas` canônicas |
| 0068 | remove a exclusividade que anulava a 0066 |
| 0069 | `aquisicoes.lead_legado_id` |
| 0070 | papéis, mapa papel→permissão e vínculos de usuário |
| 0071 | NEXO e Hermes, em `draft` |
| 0072 | tokens da API pública e registro de uso |

## 3. AS-IS → TO-BE

| Antes | Agora | O que mudou de fato |
|---|---|---|
| `leads` fazia sete papéis | `pessoas` + `empresas` + `aquisicoes` | 3.950 pessoas, 3.989 aquisições |
| `negocios` como oportunidade | `oportunidades` | 1.561, paridade exata; a diferença de 1 é caso registrado |
| Ganho decidido por família | Ganho decidido pela **oferta** | mesma prova, decisões opostas para PABX e AI direto |
| Conversa em 3 tabelas | `communications` | 33.005 linhas, uma fonte |
| Sem timeline | `timeline_events` + `domain_events` + outbox | 14.078 eventos, lidos pela tela |
| Fatura sem pagamento | `pagamentos` | 579, R$ 211.045,66 conciliados |
| Autorização por string de papel | RBAC normalizado | 16 permissões, paridade provada usuário por usuário |
| Dois motores de automação | um, com adapters compartilhados | regra de automação não fecha venda por fora |
| IA escrevendo no banco | IA pelos adapters de domínio | o gate do Ganho vale para ela também |
| Arquivo no disco da máquina | serviço com object storage | produção sem storage falha, não cai no disco |
| Sem API pública | `/api/v1` com 9 recursos | token com escopo, uso registrado |

## 4. Reconciliação

**1.531 casos abertos.** Cada um é uma linha que o dado não permitiu decidir, e
nenhum foi resolvido por palpite.

| Tipo | Quantidade | O que é |
|---|---|---|
| `FAMILIA_NAO_RESOLVIDA` | 1.084 | oportunidade sem família de produto dedutível |
| `CONTRATO_SEM_PROCESSO_COMERCIAL` | 406 | contrato sem negócio nem oportunidade; **271 ativos** |
| `FATURA_PAGA_SEM_EMPRESA` | 28 | fatura paga sem empresa alcançável |
| `IDENTIDADE_MULTIPLA_EMPRESA` | 8 | pessoa ligada a mais de uma empresa, nenhuma principal |
| outros | 5 | agregados: fatura paga sem data, comunicação sem pessoa, e-mail duplicado, serviço ativo sem jornada, fatura sem empresa |

## 5. Caminhos legados ainda em uso

Nenhum foi removido: a contração é a fase 27.

- `leads` e `negocios` continuam recebendo escrita, com propagação para o
  canônico;
- `vendas_eventos` continua no UNION da timeline;
- `lib/crm/pos-venda.ts` continua sendo chamado por `negocios.ts`;
- leitura de **detalhe e edição** continua no legado, de propósito: ler o
  canônico e escrever no legado cria janela de inconsistência visível numa tela
  de edição. Essa leitura migra **junto com a escrita**, na fase 25.

## 6. Provenance preservada

`backfill_provenance` liga cada linha canônica à linha de origem, e um teste
exige que **toda pessoa tenha provenance** — "apareceram do nada e ninguém sabe
de onde" é uma falha de verdade, e pegou uma pessoa órfã deixada por um smoke.

Preservadas: `anexos`, `status_changes`, `vendas_eventos`, `cadencia_execucoes`,
`meta_lead_staging`.

## 7. Testes, build e validação

- `tsc --noEmit` limpo;
- **build de produção passando** (estava quebrado por quatro causas anteriores);
- **bundle do worker** (esbuild) passando;
- **264 testes, 0 falhas**;
- **22 smokes** contra o banco real com dado de produção;
- **aceite do Módulo 01: 72 passaram, 0 falharam, 3 não verificados** — os três
  dependem do catálogo oficial, que é decisão de operação (ver seção 10);
- **validação de paridade: 13 dos 14 cenários passam, 0 falham, 1 não
  verificável** — o restante é o NEXO, bloqueado por credencial de provedor de
  modelo.

### Travas permanentes

Cada uma foi verificada **falhando de propósito** antes de entrar.

| Teste | Impede |
|---|---|
| `db/drift-schema.test.ts` | coluna no banco e não no Drizzle, ou o contrário |
| `db/on-conflict.test.ts` | ON CONFLICT apontando para índice inexistente |
| `db/sql-template.test.ts` | crase em comentário de SQL |
| `db/array-postgres.test.ts` | array do Postgres projetado cru |
| `db/reconciliacao-backfill.test.ts` | linha canônica sem origem rastreável |
| `arquitetura/fronteiras.test.ts` | domínio importando ORM, SDK ou framework |
| `arquitetura/escritores-migrados.test.ts` | porta de escrita sem ligação canônica |
| `vendas/leitura-canonica.test.ts` | registro sumindo da leitura |
| `relatorios/cobertura.test.ts` | relatório perdendo receita no caminho |
| `auth/permissoes.test.ts` | cutover de autorização mudando acesso |
| `v1/api-publica.test.ts` | rota pública sem escopo; token em claro |
| `ai-platform/agentes.test.ts` | ferramenta de IA escrevendo direto |
| `api-server/webhooks-fail-closed.test.ts` | webhook sem segredo configurado |
| `api-server/rotas-configuracao-protegidas.test.ts` | rota de configuração aberta; rota de escrita sem sessão e sem declaração de qual é o gate dela |
| `arquitetura/gravacao-de-arquivo.test.ts` | rota gravando binário no disco; object storage virando dependência de deploy |
| `auth/teto-de-token.test.ts` | token de API nascendo com escopo acima de quem o cria |
| `db/array-postgres.test.ts` e os acima | (já listados) |

## 8. Procedimento de virada

**Nada disto foi executado. A virada é decisão do Kauã.**

1. **Backup.** `pg_dump` de produção, verificado com `pg_restore --list`. Existe
   `pre-refactor-20260920.dump` (17 MB) do estado anterior ao refactor.
2. **Conferir que produção aceita as migrations, ANTES de migrar:**

   ```bash
   DATABASE_URL="postgres://...prod..." pnpm --filter app check:pre-deploy
   ```

   Somente leitura, roda com a aplicação no ar. A migration 0056 aperta
   `organizacao_id` para NOT NULL em quatro tabelas financeiras e cria três
   chaves estrangeiras: uma linha nula ou uma referência órfã derruba o deploy
   no meio. O clone local é de 20/09 e não é prova sobre produção.

3. **Aplicar as migrations 0056 a 0080 em produção, em ordem.** Todas são
   EXPAND ou correção de dado: nenhuma apaga estrutura, e produção continua
   funcionando com o código antigo depois delas.
4. **Rodar os backfills**, na ordem 05 a 15. São idempotentes por
   `backfill_provenance`: rodar duas vezes não duplica.
5. **Conferir a reconciliação** de cada fase contra os números deste documento.
   Divergência aqui para a virada.
6. **Subir o código.** A leitura passa a ser canônica e a escrita continua
   legada, com propagação. É o estado atual da branch.
7. **Rodar a validação de paridade e o aceite de vendas contra produção.** 0
   falhas para seguir.
8. **Decidir sobre o catálogo oficial** (seção 10): sem ele o construtor de
   proposta abre vazio.
9. **Observar por um ciclo comercial** antes das fases 25 a 28.

## 9. Rollback

- **Antes do passo 5:** as migrations são EXPAND e o código antigo ignora as
  tabelas novas. Rollback é não subir o código.
- **Depois do passo 5:** voltar o código para o commit anterior. O dado canônico
  fica no banco sem uso, o que é inofensivo: nenhuma migration apagou coluna ou
  tabela legada.
- **Rollback de dado:** cada migration tem o inverso documentado no arquivo, e o
  dump de 20/09 é o ponto de retorno completo.
- **O que NÃO tem rollback simples:** as fases 25 a 27, que desligam escrita e
  apagam estrutura. É por isso que elas não foram executadas.

## 10. Aberto, e por quê

| O quê | Por quê |
|---|---|
| 1.084 oportunidades sem família | o dado não permite deduzir; preencher por palpite arma a regra de Ganho errada |
| 271 contratos ativos sem processo comercial | ligar por proximidade seria inventar de qual venda vieram |
| 28 faturas pagas sem empresa | receita reconhecida na fatura, invisível por cliente |
| 118 faturas pagas sem data | sem data não há fato datado; inventar corrompe receita por competência |
| Quem aprova desconto | alçada não existe hoje; ficou só com admin, que é o padrão restritivo |
| Credenciais de Meta e de object storage | código pronto, falha dizendo que é configuração ausente |
| Dono das 275 contas de CS | a capacidade está **provada** em `smoke-cs-responsavel`; distribuir a carteira é decisão de operação |
| **Catálogo oficial não importado** | `catalogo_precos` com 0 linhas faz o construtor de proposta abrir vazio. O importador existe, lê snapshot commitado em 02/09 (21 produtos, 213 preços) e não chama o Stripe. Não executado porque **grava preço comercial**: dizer que aquele snapshot é a tabela vigente é decisão do Kauã |
| Dois pools de conexão no worker | 10 dos 31 módulos que ele importa abrem a conexão da aplicação além da própria (5 + 15 = 20 por processo, limite 100). Anterior ao refactor; consolidar é refatoração própria |

## 11. Documentação

`refactor-state.md` reflete o estado atual e é o ponto de continuidade;
`refactor-execution-log.md` tem o histórico por fase, com os números medidos e
os erros cometidos. Os dois descrevem o que **foi implementado**, não o que se
pretendia implementar.
