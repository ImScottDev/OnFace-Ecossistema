# Contatos e empresas duplicados: diagnóstico e proposta de mescla

Estado: **PROPOSTA. Nada foi executado.** Este documento e o diagnóstico
`scripts/diagnostico-contatos-duplicados.sql` (somente leitura) são o insumo
para o Scott decidir. Os números "~87 pares, ~361 LID, ~106 pseudo-e-mails" são
da estimativa anterior; o diagnóstico os mede de verdade.

## 1. O que está acontecendo

Três coisas diferentes se chamam "contato" no ONFACE:

| O quê | Tabela | Para que serve |
|---|---|---|
| Pessoa | `pessoas` | identidade. **É o que a tela Contatos & Empresas lista.** |
| Registro de lead | `leads` (`tipo = 'contato'`/`lead`/`cliente`) | ficha, atividades, notas, aquisição. Ligado à pessoa por `pessoas.lead_id_legado` (único). |
| Conversa de canal | `contatos` | uma conversa de WhatsApp/e-mail **por sessão** (`idx_contatos_sessao_phone`). É de onde o Atendimento lista. |

A mescla de 13/10 (`scripts/mesclar-duplicados-meta-rd.sh`) mexeu só em `leads`:
o lead que sai ganha `canonical_lead_id`, a aquisição dele fecha como
"duplicada: mesclada no lead X", o estado anterior fica em
`_virada_mescla_20261013`. A **pessoa** do lead que saiu continuou viva, e a
empresa que ele criou também.

### Por que a lista continua mostrando em dobro (causa imediata)

`linhasDeContato` (`app/src/lib/contatos/tela-contatos.ts`) lista toda pessoa e
todo lead sem pessoa, **sem olhar `canonical_lead_id`**. As outras consultas do
diretório já olham: `diretorioPessoas` em `app/src/lib/vendas/consultas.ts:1454`,
`:1580` e a contagem de pessoas por empresa em `:1290`, todas com
`NOT EXISTS (SELECT 1 FROM leads l2 WHERE l2.id = p.lead_id_legado AND l2.canonical_lead_id IS NOT NULL)`.
A tela de Contatos ficou de fora. Pontos a corrigir, **na mesma causa**:

- `tela-contatos.ts:125` (ramo `pessoas` do `ident`) e `:132-134` (ramo `leads`)
- `tela-contatos.ts:199-204` (contagem por relacionamento) e `:220-221` (total de pessoas)
- `tela-contatos.ts:242-245` (empresas sem pessoa)

Corrigir isso esconde das telas as 62 pessoas já decididas **sem tocar em
dado**, e é pré-requisito da mescla de pessoas (seção 6): se a pessoa perdedora
for apagada com o lead dela ainda vivo e sem filtro, o lead reaparece na lista
pelo ramo 2 do `ident`. Eu **não** alterei o código (o pedido era só
diagnóstico); é um commit pequeno e à parte.

## 2. De onde os duplicados nascem (causa de origem)

Corrigir a origem vale mais que limpar o acúmulo. Achados, do mais para o menos
importante:

1. **Três resolvedores de pessoa com normalização diferente**, então uma porta
   não enxerga o que a outra criou:
   - `app/src/lib/vendas/identidade.ts:279` compara `lower(email)` **sem `trim`**
     (e-mail com espaço no fim não casa); o telefone usa `telefoneChaveSql`.
   - `app/src/lib/crm/sync-domain-model.ts:103-122` usa `lower(trim(email))` e
     `chaveTelefone`. O casamento por telefone só existe desde 386e99f
     (13/10 00:33); antes era só e-mail, e Meta e RD chegam com e-mail
     diferente ou vazio.
   - `packages/domain/identity/commands/resolver-identidade.ts:94-110` mais
     `packages/platform/database/src/repositorio-aquisicao.ts:40-52`: outro
     `normalizarTelefone` (últimos 10 dígitos) e **só a coluna `telefone`**,
     nunca `whatsapp`.
   O webhook Meta passa pelos dois primeiros no mesmo evento
   (`app/src/app/api/webhooks/meta-leads/route.ts:211` e `ponte-canonica.ts:147`).
2. **Ler-e-inserir sem trava nem índice único.**
   `sync-domain-model.ts:124-139` e `identidade.ts:273-310` fazem SELECT e depois
   INSERT; `schema.ts:3825` só tem `idx_pessoas_email` **não único**
   (`idx_pessoas_lead_legado` é o único índice único). Duas entradas
   simultâneas criam duas pessoas. A trava por chave
   (`ponte-canonica.ts:182`, `pg_advisory_xact_lock`) cobre só a entrada
   Meta/RD, não o cadastro manual, a importação nem o Apollo.
3. **Carga do Zoho.** `app/src/scripts/backfill/05-identidade.ts:63-79` agrupa
   por e-mail **ou, na falta dele,** por telefone: o mesmo telefone com dois
   e-mails vira duas pessoas. O `normalizarTelefone` local (`:36-40`) é o legado
   (10 dígitos sem 55). O importador que gerou os pseudo-e-mails não está no
   repositório; o padrão exato precisa ser confirmado na seção 6b do diagnóstico.
4. **LID do WhatsApp gravado como telefone.** `app/src/worker/index.ts:634` e
   `:636` caem para `rawChat.replace(/@.*$/, "")` quando o evento só traz o
   `@lid`; a guarda de `:641` (8 a 15 dígitos) deixa o LID passar (14 a 15
   dígitos). Depois `findOrCreateContato` (`:191`) procura por `%últimos 8` do
   LID, que nunca casa com o número real: nasce uma segunda conversa para a mesma
   pessoa. O comentário de `:295-297` mostra que o LID já não vira *pessoa*, mas
   continua virando *conversa* (`contatos`).
5. **Empresa.** `app/src/lib/crm/resolver-empresa.ts:35-59` casa por CNPJ ou,
   sem CNPJ, por `ilike(nome)` **exato**: "ACME Ltda" e "Acme Ltda." criam duas
   empresas, e informar um CNPJ novo para um nome que já existe cria outra
   (o `where` troca de critério). Os 37 grupos por nome sem CNPJ de
   `app/src/lib/db/carga/6-limpeza/01_marcar_lixo_zoho.sql` são o resultado.

### Correções de origem propostas (código, à parte da limpeza)

- Uma função só de chave: e-mail `lower(btrim(x))` e telefone `chaveTelefone`
  sobre **`telefone` e `whatsapp`**, usada por `identidade.ts`,
  `sync-domain-model.ts`, o repositório de `packages/platform/database` e o
  backfill. Hoje há quatro implementações.
- `worker/index.ts:634-636`: se o evento só tem `@lid`, **não** usar os dígitos
  como telefone; guardar o LID em campo próprio (seção 5) e resolver pelo
  `SenderAlt`/`RecipientAlt` ou deixar a conversa sem telefone.
- `resolverEmpresaId`: comparar CNPJ **e** nome normalizado (sem acento,
  pontuação e sufixo societário) antes de criar.
- Índice único depois da limpeza (seção 7).

## 3. Tudo que aponta para `pessoas`, `contatos` e `empresas`

Levantado de `schema.ts` e das migrations (a coluna existe no banco quando a
migration a cria, mesmo que o `schema.ts` omita o `.references`: é o caso de
`propostas`, `contratos` e `communications.empresa_id`, que as migrations 0064
e 0067 criam **com** FK). Ação: **repontar** = `UPDATE ... SET col = vencedor`;
**somar** = juntar sem duplicar; **recalcular** = derivar de novo depois.

### 3.1 `pessoas` (perdedora → vencedora)

| Tabela.coluna | FK / ao apagar | Ação |
|---|---|---|
| `pessoa_empresa_vinculos.pessoa_id` | cascade; único `(pessoa, empresa)` ativo | repontar. Se a vencedora já tem vínculo ativo com a mesma empresa: copiar o vínculo da perdedora ao backup e descartá-lo (redundante). Mantém só um `principal`. |
| `pontos_contato.pessoa_id` | sem ação | repontar e **recalcular** `is_first_touch`/`is_last_touch` (só o mais antigo e o mais recente por pessoa). |
| `oportunidades.pessoa_id` | sem ação | repontar. Duas oportunidades abertas da mesma pessoa não se fundem: listar para revisão. |
| `clientes.pessoa_principal_id` | sem ação | repontar. |
| `aquisicoes.pessoa_id` | set null | repontar (se não, vira NULL em silêncio). Aquisição aberta duplicada: fechar a da perdedora como "duplicada" (convenção do script de 13/10). |
| `communications.pessoa_id` | sem ação | repontar. |
| `conversas.pessoa_id` | set null | repontar. |
| `vendas_eventos.pessoa_id` | **cascade** | repontar **antes** de apagar, senão o histórico some. |
| `timeline_events.pessoa_id` | **cascade** | repontar **antes** de apagar. |
| `pessoas.lead_id_legado` (a pessoa → lead, único) | n/a | a vencedora fica com o dela. O lead da perdedora **tem de** ganhar `canonical_lead_id` (e a aquisição fechar como "duplicada"), senão reaparece na lista como "lead sem pessoa". |
| `backfill_provenance` (`entidade_canonica='pessoa'`, `id_canonico`) | sem FK | repontar para a vencedora; sem isso, reexecutar o backfill 05 recria a pessoa. |
| `entity_labels`, `file_links`, `audit_log`, `domain_events` (id polimórfico) | sem FK | `entity_labels`/`file_links` com tipo pessoa: repontar (respeitando `uq_entity_labels_entity_label`). `audit_log`/`domain_events`: **ignorar**, são histórico imutável. |

Dependências **via lead** (não apontam para a pessoa, e é aí que mora o
histórico): `atividades`, `notas`, `reunioes`, `negocios`, `propostas`,
`contratos`, `whatsapp_mensagens`, `emails`, `tarefas`, `lead_labels`,
`aquisicoes.lead_legado_id`, etc. — mais de 35 tabelas com `lead_id`. **Não se mexe**:
o lead perdedor continua existindo, apontando para o canônico. Quem junta isso na
tela é `ficha-extras.ts` via `canonical_lead_id`. O diagnóstico conta esse
histórico dos dois lados (colunas `msgs_*`, `ativ_*`, `neg_*`).

### 3.2 `contatos` (conversa de canal)

| Tabela.coluna | FK / ao apagar | Ação |
|---|---|---|
| `whatsapp_mensagens.contato_id` | **sem FK** | repontar. Se esquecer, a mensagem fica órfã sem erro nenhum. |
| `emails.contato_id` | **sem FK** | repontar. |
| `ai_sdr_logs.contato_id` | **sem FK** | repontar. |
| `contato_labels.contato_id` | cascade; único `(contato, label)` | repontar as etiquetas que a vencedora não tem; as demais ao backup. |
| `ai_cases.contato_id` | cascade | repontar. |
| `ai_agent_atribuicoes.contato_id` | cascade | repontar; uma atribuição viva por contato: ficar com a da vencedora, a outra ao backup. |
| `ai_agent_compromissos.contato_id` | cascade | repontar. |
| `ai_memoria_fatos.contato_id` | cascade | repontar. |
| `ai_contact_field_proposals.contato_id` | cascade; único pendente `(org, contato, campo)` | repontar; conflito: ficar com a da vencedora. |
| `ai_sdr_contato_state.contato_id` | cascade; **único** por contato | ficar com o estado da vencedora; o da perdedora ao backup. |
| `ai_agent_runs.contato_id` | sem ação; único "uma live por contato" | repontar só as terminadas; run `running` deve ser esperado. |
| `ai_router_decisions.contato_id` | set null | repontar. |
| `contatos.lead_id` (único com `responsavel_id`) | n/a | a vencedora fica com o dela. |

**Quando mesclar `contatos`:** só dentro da **mesma sessão** (LID da conversa
contra o telefone real da mesma pessoa, ou mesmo número em formato diferente).
A mesma pessoa em sessões diferentes é duas conversas legítimas e **não se
mescla**.

### 3.3 `empresas`

36 colunas com chave estrangeira (todas reais no banco). Para todas: **repontar**, exceto
as marcadas.

`leads`, `negocios`, `atividades`, `tarefas`, `notas`, `nps_respostas`,
`assinaturas`, `faturas`, `servicos_canonicos`, `servico_billing_timeline`,
`contratos`, `propostas`, `communications`, `pessoas`, `pontos_contato`,
`oportunidades`, `oportunidade_bundle`, `aquisicoes`, `conversas`,
`pagamentos`, `cliente_receita_mensal`, `billing_identities`
(`empresa_id` **e** `canonical_empresa_id`), `callface_ai_reconciliation_candidates`,
`cs_marcos`, `cs_riscos`, `cs_renovacoes`, `cs_cancelamentos`,
`cs_health_snapshots`, `vendas_eventos`, `timeline_events`,
`ai_agent_atribuicoes`, `ai_memoria_fatos`, e a auto-referência
`empresas.canonical_empresa_id`.

Casos que pedem tratamento próprio:

| Tabela | Por quê |
|---|---|
| `clientes` | índice único parcial `(organizacao_id, empresa_id)`: duas empresas com cliente viram conflito. Fica o `clientes` da vencedora; o outro vai ao backup e seus filhos (`pessoa_principal_id`, `oportunidade_origem_id`) são revistos à mão. |
| `pessoa_empresa_vinculos` | único `(pessoa, empresa)` ativo, mesmo tratamento da seção 3.1. |
| `assinaturas`, `faturas`, `servicos_canonicos`, `billing_identities` | **dinheiro**. Repontar sim, mas a decisão de quem vence (seção 4) olha estes primeiro, e o Stripe não é tocado (o `stripe_customer_id` da empresa perdedora é copiado para a vencedora só se ela não tiver). |
| `cs_*`, `cliente_receita_mensal` | repontar; pode haver duas linhas no mesmo mês: **somar** receita, ficar com a mais recente no health. |
| `entity_labels`, `file_links` (polimórfico) | repontar. |
| texto livre `leads.empresa` / `pessoas` | não é FK; o nome da empresa perdedora vai para `campos_custom.nomes_anteriores` da vencedora (como a carga de 05/10 fez com `nome_fantasia`). |

O script `app/src/lib/db/carga/3-faturamento/01_mesclar_empresas_duplicadas.sql`
já gera os UPDATEs de `pg_constraint` (o que pega FKs novas sozinho). Ele serve
de base, mas **apaga sem backup** e descarta conflito `UNIQUE` de forma
agregada. Para esta mescla: gerar do catálogo igual, gravar o log (seção 6) e
tratar `clientes`/vínculos explicitamente.

## 4. Regra de desempate (objetiva, em ordem)

Vale para os três tipos. O diagnóstico já calcula `sugestao` e `porque` com a
regra 1 a 4 para pessoas.

**Pessoa**
1. A pessoa do **lead canônico** da mescla de 13/10 (consistência com o que já
   foi decidido). Só se aplica ao motivo `mescla_de_leads`.
2. A que é **cliente** (`clientes.pessoa_principal_id` ou `leads.tipo='cliente'`).
3. A com **mais histórico pendurado** (mensagens + atividades + notas + reuniões
   + negócios + propostas + contratos + oportunidades + comunicações), contando
   os leads que apontam para o dela. Menos linhas para mover, menos risco.
4. A **mais antiga** (`created_at`), depois o menor `id`.

O vencedor **fica com o próprio id** (links, Stripe e URLs continuam valendo).
Os campos vazios dele são completados com os da perdedora
(`COALESCE`, como `completarPessoa` em `identidade.ts`); campo preenchido nos
dois **não é sobrescrito**, e o valor da perdedora fica no backup. Quando o
telefone de um lado é LID e o do outro é real, o real vence o campo, não a
linha.

**Empresa**
1. A com **receita**: assinatura/serviço ativo, depois fatura.
2. A com **CNPJ** (e, empatando, a razão social que consta no faturamento, como
   decidido em 05/10).
3. A com mais dependentes (coluna `pendurado_*` do diagnóstico).
4. A mais antiga.

**Só automático com prova forte:** mesmo CNPJ, ou mesmo domínio corporativo.
Par que casa **só por nome** (`nome_sem_cnpj`) é decisão humana: o próprio
`01_marcar_lixo_zoho.sql` mostra grupos ("Autônomo", "Imóveis", "Cobrança") que
nem são empresa.

**Conversa de canal (`contatos`)**
1. A com **telefone brasileiro real** (55 + DDD + número) contra a de LID.
2. A com mais mensagens.
3. A mais antiga.
O LID da perdedora não se perde: ver seção 5.

**O que NÃO é par** (o diagnóstico separa): telefone ou e-mail compartilhado por
5 ou mais pessoas (central, e-mail genérico: seção 2 do diagnóstico), telefone de
preenchimento (`11111111111`, `1000000000`), e nome diferente com mesmo telefone
sem confirmação: `mesma-pessoa.ts` já decidiu que telefone sozinho não basta.
Esses pares aparecem com `motivos = {telefone}` e primeiro nome diferente, e
vão para revisão, não para a fila automática.

## 5. LID e pseudo-e-mails (não são duplicata, mas alimentam duplicata)

**LID (~361 conversas).** Heurística: telefone só com dígitos, 14 ou mais, que
não é `55` + DDD + número. A seção 4 do diagnóstico lista cada uma com número de
mensagens e, quando há, o `par_real_na_sessao` (mesma sessão, mesmo nome, número
real).
- Com par real: mesclar para o real (seção 3.2). **Antes**, guardar o LID, senão a
  próxima mensagem que chegar só com `@lid` recria a conversa
  (`worker/index.ts:191`). Proposta: tabela nova de identificadores do contato
  (`contato_identificadores`: `organizacao_id`, `contato_id`, `tipo = 'lid'`,
  `valor`, único `(organizacao_id, tipo, valor)`), consultada por
  `findOrCreateContato` antes do `%últimos 8`. Migration nova, aditiva.
- Sem par: **não apagar.** É conversa viva (a classificação de 01_marcar_lixo_zoho
  já a tratou como `revisar_`, não `lixo_`). Fica como está até o número real
  aparecer.

**Pseudo-e-mails (~106).** O importador não está no repositório, então a regex do
diagnóstico (`zoho`, `.invalid`, `.local`, parte local de 6+ dígitos) é
**hipótese**: a seção 6b mostra os domínios dos leads com `zoho_id` para o Scott
confirmar o padrão. Ação proposta depois de confirmar: gravar o valor original
no backup e **pôr o e-mail em NULL** na pessoa e no lead. Motivos: ele não é um
e-mail (envio falha), cria par falso quando dois registros herdam o mesmo, e
impede o índice único da seção 7.

## 6. Como executar (quando o Scott aprovar)

**Ordem. Cada passo só começa com o anterior conferido.**

0. **Corrigir a lista** (seção 1): filtro `canonical_lead_id` em
   `tela-contatos.ts`. Resolve as 62 pessoas já decididas na tela sem tocar em
   dado. Homologar e promover.
1. **Ensaio em homologação** (`./deploy.sh homolog`; banco é cópia de produção,
   WhatsApp e e-mail travados — `docs/operacao/homologacao.md`). Rodar o
   diagnóstico lá, mesclar lá, conferir, só então produção. Mesmo sha.
2. **Fila revisada.** Exportar a seção 1 e a seção 7 do diagnóstico; o Scott
   marca `ok`/`não é par` por linha. O script de mescla recebe a lista de
   `(fica, sai)` aprovada, **nunca** recalcula pares sozinho (o script de 13/10
   também descartava correntes para revisão manual: manter).
3. **Backup, na mesma transação, antes de qualquer UPDATE** (convenção
   `_virada_mescla_*`):
   - `_virada_mescla_pessoas_<AAAAMMDD>` (`fica`, `sai`, `pessoa_sai jsonb`,
     `pessoa_fica_antes jsonb`, `lead_sai jsonb`, `aquisicoes_sai jsonb`, `motivos`, `feito_em`);
   - `_virada_mescla_pessoas_<AAAAMMDD>_refs` (`fica`, `sai`, `tabela`, `coluna`,
     `linha_id`), **uma linha por linha repontada**, preenchida com
     `INSERT ... SELECT id FROM <tabela> WHERE <coluna> = <sai>` gerado do
     `pg_constraint` (como o script de empresas) **mais** as três colunas sem FK
     (`whatsapp_mensagens`, `emails`, `ai_sdr_logs`) e os registros polimórficos;
   - o mesmo par de tabelas para `empresas` e para `contatos`.
   Além disso, `pg_dump -Fc` das tabelas envolvidas fora do banco (ponto de
   retorno completo), como o dump de 20/09 da virada.
4. **Pessoa:** (a) o lead da perdedora ganha `canonical_lead_id` e a aquisição
   aberta fecha como `duplicada: mesclada no lead <fica>` (mesma convenção do
   script de 13/10; se o par já foi tratado por ele, não repete); (b) repontar
   conforme a seção 3.1; (c) completar campos vazios da vencedora; (d) recalcular
   `pontos_contato`; (e) apagar a pessoa perdedora (já no backup).
5. **Empresa:** repontar (seção 3.3), nomes anteriores para a vencedora, apagar a
   perdedora. `UPDATE empresas SET canonical_empresa_id = fica WHERE
   canonical_empresa_id = sai` antes do `DELETE`.
6. **Conversa de canal:** só pares da mesma sessão, seção 3.2, LID guardado.
7. **Pseudo-e-mails:** depois das mesclas (assim eles não geram par).
8. **Conferir** (todas devem fechar em zero ou no número esperado):
   - o diagnóstico (seções 1, 1b, 5a, 7) volta vazio ou só com o que o Scott
     marcou "não é par";
   - nenhuma FK aponta para id inexistente: o `UPDATE`s por catálogo não deixam
     órfão, mas as três colunas sem FK precisam de `SELECT count(*) FROM
     whatsapp_mensagens m WHERE contato_id IS NOT NULL AND NOT EXISTS (SELECT 1
     FROM contatos c WHERE c.id = m.contato_id)` = 0 (idem `emails`, `ai_sdr_logs`);
   - contagem total de `whatsapp_mensagens`, `atividades`, `negocios`,
     `oportunidades`, `faturas` **igual** antes e depois (mesclar não cria nem
     perde linha; só `pessoas`/`empresas`/`contatos` diminuem);
   - `pnpm typecheck`, `cd app && pnpm test`,
     `npx tsx --env-file=.env src/scripts/checar-rotas-onface.ts`, e abrir a tela
     de Contatos no navegador procurando um par conhecido.
9. **Declarar a perda de linhas** para o gate de sanidade da carga
   (`_carga_perdas_declaradas`, como `01_mesclar_empresas_duplicadas.sql`), com a
   contagem exata de `pessoas`, `empresas` e `contatos` removidos.

Tudo numa transação por lote (50 pares), `COMMIT` só depois de o lote conferir.
Um erro em qualquer par aborta o lote inteiro, não o deixa pela metade como
aconteceu em 13/10.

### Como desfazer

Pelo log de referências, sem depender de memória:

1. Reinserir a perdedora: `INSERT INTO pessoas SELECT * FROM
   jsonb_populate_record(NULL::pessoas, b.pessoa_sai)` a partir do backup
   (idem `empresas`, `contatos`).
2. Devolver as linhas: para cada linha de `_refs`,
   `UPDATE <tabela> SET <coluna> = <sai> WHERE id = <linha_id>`.
3. Desfazer o lead: `canonical_lead_id = NULL` no lead e reabrir a aquisição
   (`closed_at = NULL`, `motivo_desqualificacao = NULL`) a partir de
   `aquisicoes_sai`, exatamente como a tabela `_virada_mescla_20261013` guarda.
4. Campos que a vencedora herdou da perdedora: restaurar do `pessoa_fica_antes`
   (guardar também o estado da vencedora no backup).
5. Se o desfazer parcial não bastar: `pg_restore` das tabelas do dump do passo 3.

O desfazer é por **lote**, e só é limpo enquanto nada novo foi escrito sobre as
pessoas mescladas. Depois de dias, prefira corrigir à mão a partir do backup.

## 7. Impedir a reincidência (migrations propostas, NÃO aplicadas)

Sempre migration **nova**, aditiva e idempotente, aplicada pelo runner
(`app/src/lib/db/migrar.ts`), nunca `drizzle-kit push`. Cada uma precisa de uma
linha em `docs/operacao/virada/entrega-final.md` (tabela de migrations, formato
`| 0120 | ... |`) quando for aplicada. Numeração provisória; a última hoje é a 0119.

| Provisória | O quê | Detalhe |
|---|---|---|
| 0120 | `pessoas`: índice único parcial `uq_pessoas_org_email` | `ON pessoas (organizacao_id, lower(btrim(email))) WHERE email IS NOT NULL AND position('@' in email) > 0`. **Tolerante**, no molde da 0113: se ainda houver e-mail repetido (ou pseudo-e-mail), avisa com `RAISE NOTICE` e **não cria**. Só roda depois da seção 6. Telefone **não** ganha índice único: central e número compartilhado existem de verdade. |
| 0121 | `contato_identificadores` (LID) | tabela nova, único `(organizacao_id, tipo, valor)`, FK `contato_id` com cascade. Só se o Scott aprovar a seção 5. |

Os dois pontos de código (uma única função de chave; não gravar LID como
telefone) valem mais que o índice: o índice só transforma o erro em exceção.
Quando o índice existir, as portas (`identidade.ts`, `sync-domain-model.ts`)
precisam de `ON CONFLICT` / re-seleção em vez de estourar a exceção.

## 8. O que o Scott precisa decidir

1. Autoriza o commit pequeno que acerta `tela-contatos.ts` (seção 1)? Por si só
   tira as 62 duplicatas da tela.
2. A regra de desempate da seção 4 serve? Em especial: histórico antes de
   telefone real.
3. Pares só por telefone com primeiro nome diferente: revisão manual, como
   proposto?
4. Pseudo-e-mail vira NULL (com o original no backup)?
5. LID sem par real: deixar como está até o número aparecer?
6. Empresas que casam só por nome: decisão sua, grupo a grupo?
7. Homologação primeiro, como no fluxo normal?
