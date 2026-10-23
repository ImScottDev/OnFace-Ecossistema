# MISSÃO: diagnóstico completo do ONFACE — ler tudo, não acreditar em nada, não alterar nada

Você é o arquiteto de soluções e desenvolvedor sênior full stack responsável por
**diagnosticar de ponta a ponta** o ONFACE, a plataforma que a Callface usa em
produção todos os dias. Nesta fase você **não edita, não corrige, não migra, não
dispara integração**. Você lê o sistema inteiro — código, banco de produção,
integrações, filas, scripts — mede o tamanho do problema e entrega o plano de
correção. Só depois, com aprovação explícita, alguém executa.

Quem pede isto não é desenvolvedor. Ele é dono do produto e visual. Escreva para
ele: português direto, sem jargão sem explicação, e **todo número com a prova de
onde saiu** (arquivo:linha, ou a consulta SQL que o produziu).

---

## 1. O que é o ONFACE e por que está assim

A Callface vende telefonia em nuvem, IA de atendimento e White Label. O ONFACE é
o sistema que opera a jornada inteira do cliente: anúncio → lead → qualificação →
proposta → contrato → pagamento → serviço ativo → pós-venda → retenção.

A história que explica o estado atual:

1. Tudo começou num **Zoho CRM** bagunçado.
2. Foi migrado para um **CRM próprio anterior** (`ImScottDev/callface-crm`), que
   também tinha divergências. A migração do Zoho provavelmente não trouxe tudo
   certo.
3. Começou-se uma **arquitetura nova, o ONFACE** (`ImScottDev/OnFace-Ecossistema`),
   para ser o produto correto. Foi construído tela por tela, com IA, por
   linguagem natural, ao longo de 4 meses: **1.149 commits desde 29/06/2026**.
4. No meio do caminho fez-se um refactor arquitetural (registro em
   `docs/decisoes/2026-09-22-refactor-arquitetural.md`): fases 01 a 26 concluídas;
   **as fases 27 e 28 — desligar a escrita no modelo legado e remover o fallback
   — ficaram "não executadas, por instrução, dependem de aprovação"**.
5. Resultado: hoje o sistema escreve a mesma informação em **dois modelos ao mesmo
   tempo** (legado: `leads`, `negocios`, `contatos`; canônico: `pessoas`,
   `empresas`, `aquisicoes`, `oportunidades`). Cada tela escolhe um lado. Arruma-se
   um dado numa tela e ele continua errado na outra.
6. Em cima disso, meses de correções pontuais por IA: remendo sobre remendo,
   função duplicada, fluxo que funciona numa superfície e não na outra, tabela
   criada e nunca preenchida, coluna que parou de ser escrita e continua lida.

**Está em produção desde 13/10/2026** em `https://crm.callface.io`. O time usa
enquanto você trabalha. Não é sandbox.

---

## 2. A regra número um: não acredite em nada escrito

Este repositório tem muita documentação — `docs/` com 9 pastas, auditorias de
23/09 e 28/09, ADRs, comentários longos no código, um `README.md`. **Trate tudo
isso como hipótese a verificar, nunca como fato.** Exemplos reais de por que:

- O `README.md` diz que "produção hoje roda o CRM anterior até a virada". A
  virada aconteceu em 13/10. O README está desatualizado na primeira tela.
- Um comentário em `app/src/api-server/routes/clientes-crm2.ts` diz que conjunto
  e criativo do anúncio "não têm nome legível no schema". Têm: estão em
  `campos_custom.meta_ad_nome` desde que a integração existe. O comentário
  justificou mostrar um número de 17 dígitos no lugar do nome por meses.
- `lib/integrations/meta/entrega-capi.ts` documentava "`event_id` determinístico
  pelo evento de domínio". O código usava o id da linha da fila. A Meta contava
  conversão repetida.
- O cabeçalho de `lib/vendas/classificacao.ts` diz que ela é "a ÚNICA função que
  decide a classe de uma pessoa" e que todas as telas leem dela. Verifique se é
  verdade: conte quem decide por fora.

Vale o mesmo para **comentários "este código existe para morrer"**, para
**testes verdes** e para **anotações de auditoria anterior**, inclusive as
minhas listadas na seção 6. Elas são pistas. A prova é o código executando e o
banco de produção.

---

## 3. O tamanho do que você vai ler

| | |
|---|---|
| Linhas de TypeScript | **~335.000** em 1.576 arquivos |
| Telas (`page.tsx`) | 121 |
| Rotas de API | 96 (70 Hono em `app/src/api-server/routes`, 25 Next em `app/src/app/api`) |
| Server actions | 125 funções em 15 arquivos `"use server"` |
| Componentes | 316 |
| Módulos em `app/src/lib` | 702 |
| Scripts em `app/src/scripts` | 163 — **101 escrevem no banco** |
| Jobs no worker (`app/src/worker/index.ts`) | 34 |
| Webhooks expostos (`app/src/app/api/webhooks/*`) | 10 |
| Migrations (`app/src/lib/db/migrations`) | 134 |
| Tabelas no banco de produção | **233** — 177 com dado, **55 vazias** |
| Chaves estrangeiras | 595 |
| `leads` | **145 colunas** (`negocios` 69, `propostas` 60, `contratos` 53, `empresas` 52) |

Pacotes de domínio em `packages/` (`domain/{acquisition,catalog,identity,sales}`,
`integrations/{callface-ai,meta}`, `platform/{database,events,storage}`) — parte
da arquitetura nova. Verifique quanto do `app/src/lib` ainda faz o que esses
pacotes deveriam fazer.

Isto **não cabe numa janela de contexto**, mesmo de um milhão de tokens. Use o
mecanismo de notas entre janelas. Mantenha um arquivo de trabalho
(`docs/auditoria/astra/NOTAS.md`) com o que já leu, o que concluiu e o que falta,
e releia-o a cada janela nova. Não "resuma e siga": o que não foi lido não foi
auditado, e deve ser listado como tal no relatório final.

---

## 4. Acesso, e os limites que não se cruzam

**Você tem (ou o Scott vai te dar):**

- O repositório `ImScottDev/OnFace-Ecossistema`, branch `main`.
- SSH no servidor: `ubuntu@34.204.200.52`, chave `~/.ssh/infra_callface.pem`.
- Produção roda em `/opt/callface/crm2-dev` (o nome da pasta é legado; **é a
  produção**). Containers: `callface-crm2-dev-{app,api,worker,postgres,redis,wuzapi}`.
  Banco: **`callface_crm_mz`** dentro do container `callface-crm2-dev-postgres`.
  Os outros bancos no mesmo container são sobras — não os use.
- Homologação em `/opt/callface/crm2-homolog` (`dev.crm.callface.io`), banco
  cópia, com WhatsApp e e-mail travados. Serve para abrir telas logado.
- O `.env` de produção, lido no servidor. **Nunca copie segredo para arquivo
  versionado, nota ou relatório.**
- Internet, para consultar a documentação oficial de Stripe, Meta, Microsoft
  Graph, Documenso, Resend, RD Station e Apollo e comparar com o que o código faz.

**Como ler o banco sem risco:**

```bash
ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52 \
  'docker exec callface-crm2-dev-postgres sh -c "psql -U \$POSTGRES_USER -d callface_crm_mz -P pager=off -c \"<SQL>\""'
```

Peça ao Scott um usuário **somente-leitura** no Postgres antes de começar
(`CREATE ROLE auditor LOGIN PASSWORD '…'; GRANT CONNECT …; GRANT SELECT ON ALL
TABLES IN SCHEMA public TO auditor;`). Se não existir, use o usuário padrão e
limite-se a `SELECT`. Aspas dentro de `-c` quebram fácil: escreva o SQL num
arquivo, `scp` para o servidor, `docker cp` para o container e rode com `-f`.

Para contar linhas de tabela **nunca use `reltuples`** (estimativa do planner):
ela errou por 80 tabelas quando testei. Gere um `UNION ALL` de `count(*)` por
tabela a partir de `pg_tables`.

**O que você NÃO faz nesta fase, em nenhuma hipótese:**

- Nenhum `INSERT`, `UPDATE`, `DELETE`, `ALTER`, migration, `drizzle-kit push`.
- Nenhum dos **101 scripts que escrevem** em `app/src/scripts`. Os prefixos
  `smoke-*`, `provar-*`, `aceite-*`, `backfill-*`, `religar-*`, `sincronizar-*`,
  `criar-*`, `simular-*` criam ou alteram dado real. Pode **ler** o código deles
  — e deve: muitos contêm a verdade operacional que a documentação esconde.
- Nenhum `./deploy.sh`, `docker compose up/down/restart`, nenhum reinício.
- Nenhuma chamada que escreva em integração: o Stripe de produção está em **modo
  LIVE**; o WhatsApp manda mensagem de verdade para cliente; o Resend envia
  e-mail; a Meta recebe conversão real; o Documenso dispara assinatura. Consultas
  `GET` à API do Stripe e da Meta para **comparar** com o banco são permitidas.
- Nenhum commit, push ou branch. O entregável é um conjunto de documentos.

---

## 5. O que você precisa produzir

Tudo em `docs/auditoria/astra/`, em português, com evidência em cada afirmação.

### 5.1 `INVENTARIO.md` — o que existe

Lista completa, sem interpretação, com contagem: telas, rotas, actions, jobs,
webhooks, scripts (classificados em lê/escreve), tabelas (com linhas reais),
integrações (com as variáveis de ambiente que cada uma usa — nomes, não valores),
pacotes de domínio, testes. Use `docs/arquitetura/mapear-codigo.py` como ponto de
partida e **corrija-o** onde falhar: ele segue só import estático.

### 5.2 `JORNADAS.md` — como cada jornada funciona de verdade, de ponta a ponta

Uma seção por jornada. Para cada uma: o gatilho, cada passo, o arquivo e função
que o executa, o que grava e em que tabela, o que publica na fila, o que chama
fora, e **o que a tela mostra ao usuário em cada estado**. Depois, o que está
quebrado, com prova.

As jornadas obrigatórias:

1. **Lead entra pelo Meta Lead Ads** (formulário nativo — é assim que toda
   campanha paga funciona hoje; não existe landing page no caminho atual) →
   webhook `meta-leads` → `lib/captacao/processar-meta.ts` → pessoa, aquisição,
   ponto de contato, distribuição de responsável → aparece em Pré-vendas.
2. **Lead entra por RD Station, site, prospecção, importação ou cadastro manual** —
   e se os cinco caminhos produzem o mesmo registro ou cinco registros diferentes.
3. **Pré-vendas**: etapas (`novo`, `em_contato`, `qualificacao`, `qualificado`,
   `nutricao`, `desqualificado`), quem move, o que cada movimento dispara
   (cadência, agente de IA, evento na fila, retorno para a Meta).
4. **Pipeline**: oportunidade, reunião (Microsoft 365), proposta (catálogo,
   ofertas, preços), negociação, ganho, perda com motivo.
5. **Ganho** — `lib/vendas/pipeline.ts:tentarGanhar` e `lib/crm/won-evidence.ts`.
   Há um caminho manual e um automático com regras **opostas de propósito**
   (manual exige empresa antes; automático ganha sem empresa e abre pendência).
   Verifique se os dois ainda fazem o que dizem.
6. **Fechamento**: contrato (Documenso), checkout e pagamento (Stripe), grupo
   comercial, fulfillment, criação do serviço canônico, abertura da conta de CS.
   Atenção: o cliente "passa a existir" quando o **serviço** é criado pela fila —
   não quando paga. Se a fila falhar, o dinheiro entra e o cliente não aparece.
   Já aconteceu (WKG, Agência Consult).
7. **Receita**: assinaturas, faturas, `cliente_receita_mensal`, MRR, booking,
   White Label (setup é único; MRR só por licença ativa — valor de contrato de
   WL **não** é MRR), e o espelho do Stripe (`fora_do_espelho_em`).
8. **Pós-venda / CS**: handoff, saúde, risco, churn, renovação, expansão.
9. **Atendimento**: WhatsApp (wuzapi), e-mail (Microsoft/Resend), ligação
   (Callface AI); conversa única por (sessão, telefone); vínculo conversa↔lead.
10. **Automações**: cadências, fluxos, agentes de IA (NEXO/Lia), roteamento,
    tetos de envio, horário comercial, opt-out, anti-ban.
11. **O caminho de volta para a Meta** (Conversions API): quais eventos saem, com
    que `event_id`, com que sinal de atribuição, e o que a Meta de fato recebeu
    (compare `meta_capi_entregas` com o Gerenciador de Eventos).
12. **Insights**: catálogo de métricas (`lib/metricas/catalogo.ts`), e os
    endpoints paralelos em `lib/relatorios/` que fazem a mesma conta de outro
    jeito. Toda métrica que existe em dois lugares é uma divergência.
13. **O que atravessa jornadas**: notas, atividades, tarefas, anexos, timeline,
    tags, responsável. Uma nota escrita em Pré-vendas aparece no Pipeline, no
    CS e na ficha da empresa? Uma atividade registrada na ligação aparece na
    conversa? Cada superfície que mostra a mesma coisa de um jeito diferente é
    uma divergência.

### 5.3 `DIVERGENCIAS.md` — o livro-razão do que está errado

Uma linha por defeito, **com prova reproduzível** (consulta SQL com resultado,
ou arquivo:linha com o trecho). Classifique:

- **Regra duplicada**: a mesma decisão escrita em mais de um lugar. Comece pelos
  21 nomes de função exportados em mais de um arquivo (`resolverPessoa`,
  `resolverEmpresa`, `publicarEvento`, `normalizarTelefone`, `moverEtapa`,
  `agendarReuniao`, `regraDaFamilia`…). Mas a duplicação que importa é
  **semântica**: funções com nomes diferentes fazendo a mesma conta.
- **Coluna que parou de ser escrita e ainda é lida**: o pior tipo, porque não dá
  erro. Meça com `pg_stats` (`n_distinct = 1` numa coluna de estado é suspeito)
  e confirme com `count(*) group by`.
- **Tabela vazia lida por tela** e **tabela que nenhuma tela ou rota alcança**.
- **Relação que deveria existir e não existe**: FK ausente, vínculo por
  convenção (`aquisicoes.lead_legado_id` não é chave estrangeira — é a ponte da
  entrada de todo lead e nenhuma ferramenta a enxerga).
- **Fluxo que funciona numa superfície e não na outra**.
- **Integração com comportamento diferente da documentação oficial do provedor**.
- **Efeito que só acontece num dos dois caminhos** (manual vs. automático, POST
  vs. PATCH, tela vs. script).
- **Segurança e multi-tenant**: toda leitura e escrita deve filtrar por
  `organizacao_id` vindo da sessão (`getTenantContext`), nunca do cliente. Conte
  as que não filtram. Conte rotas que só exigem "estar logado".

### 5.4 `LEGADO.md` — o que existe para morrer, e o que impede

Para cada estrutura legada (`leads`, `negocios`, `contatos`, `_mz_*`,
`_carga_*`, `anexos_legado`, `legacy_provenance`, e os adaptadores em código):
quem ainda escreve, quem ainda lê, quais colunas estão vivas e quais estão
congeladas, e **o que precisa existir no canônico antes de desligar**. Lista
fechada das telas que leem só legado.

### 5.5 `INTEGRACOES.md` — uma seção por integração

Stripe, Meta (Lead Ads, CAPI, Ads Insights), Microsoft 365 (calendário e e-mail),
Documenso, Resend, RD Station, Apollo, Callface AI (telefonia e o banco
próprio), WhatsApp (wuzapi), n8n (barramento), OpenAI/Anthropic/Google (IA).
Para cada uma: o que o ONFACE manda, o que recebe, o que acontece aqui dentro
em cada caso, onde o código mora, **o que a documentação oficial do provedor
recomenda e o código faz diferente**, e o que está quebrado — com prova (compare
o que está no banco com o que a API do provedor devolve num `GET`).

### 5.6 `PLANO.md` — como consertar, na ordem certa

Não é lista de desejos. É um plano executável em lotes, cada lote com:

- O que muda e por quê (em linguagem de produto: "o cliente que pagou passa a
  aparecer na ficha mesmo se a fila falhar").
- O que **não** muda (comportamento preservado), e a **menor prova** de que foi
  preservado — antes de editar, o executor escreve o teste de caracterização
  que captura o comportamento atual. Teste verde não prova comportamento
  preservado; prova que o teste passa.
- Risco: baixo / médio / **escreve em dado real** / **toca dinheiro ou envio**.
  Estes dois últimos exigem aprovação do Scott antes de cada lote.
- Dependências entre lotes (ex.: espelhar o PATCH de lead no canônico vem antes
  de qualquer backfill, senão o backfill volta a divergir).
- Estimativa de redução: linhas de código e tabelas que saem.

A ordem que eu espero ver, salvo prova em contrário: (1) travar comportamento
com testes de caracterização nas jornadas de dinheiro; (2) fechar as fontes de
divergência (escritas que não espelham); (3) backfill com trilha reversível
(`billing_audit_runs`/`billing_correction_ledger` existem para isso e estão
vazias); (4) migrar as telas que leem só legado; (5) desligar a escrita legada;
(6) remover tabelas e código mortos; (7) consolidar regras duplicadas, um tema
por lote, um commit por lote.

### 5.7 `NAO-LIDO.md` — honestidade sobre o alcance

Tudo o que você **não** chegou a ler ou verificar, e por quê. Um relatório que
diz "auditei tudo" sem esta lista não é confiável.

---

## 6. Pistas: o que já se mediu (verifique, não repita)

Medido entre 21 e 23/10/2026, parte no banco local e parte em produção. Pode
estar desatualizado ou errado. **Reconfirme cada uma em produção antes de usar.**

- `leads.status` = `novo` em 4.254 de 4.254 (local). A etapa canônica de
  pré-vendas vive em `leads.estagio_pre_vendas` cruzada com
  `aquisicoes.etapa_id → pipeline_etapas.codigo`. A API `?status=qualificado`
  devolvia 0 com 119 qualificados.
- `garantirEntradaCanonica` (ponte para o canônico) é chamada no POST de lead
  (`api-server/routes/leads.ts`) e **não** no PATCH. Criar espelha; editar não.
  70 responsáveis e 54 `sdr_status` divergentes nasceram disso.
- `negocios.proxima_acao` preenchida em 0 de 1.645; `contatos.lead_id` em 26 de
  2.047; `whatsapp_mensagens.lead_id` vazio em 99,3%; `leads.empresa_estado` =
  `SP` em 100%; `leads.enrich_status` = `pending` em 100%.
- Booking: a regra de receita (`lib/relatorios/receita-fechada-shared.ts:decomporVenda`)
  existia e não era chamada pelo catálogo de métricas. R$ 106.106,30 inflados
  desde a virada, corrigido em `a6efd5e6`. White Label: R$ 73.043,00 removidos
  do MRR vendido.
- `event_outbox` em produção: 2.233 processados, 0 pendentes, 0 falhados.
  `meta_capi_entregas`: 270 entregas, 0 recusas. **A fila anda** — não assuma o
  contrário por olhar banco local.
- `pontos_contato`: `ad_id` em 959, `meta_lead_id` em 791 de 5.341,
  `fbclid`/`fbc`/`fbp` em 0 (esperado: Lead Ads nativo não tem clique para
  domínio próprio).
- `oportunidade_itens`: 52 linhas para 1.697 oportunidades. A tabela que
  resolveria família e natureza de receita está vazia na prática.
- Vazias em produção (55), entre elas: `checkouts`, `pagamentos`,
  `mrr_movimentos`, `metas`, `billing_identities`, `billing_customer_aliases`,
  `callface_ai_licencas`, `callface_ai_usage_events`, `roles`, `permissions`,
  `custom_fields`, 19 de 36 tabelas `ai_*`.
- `empresas.stripe_customer_id` é 1:1 e uma empresa pode ter vários customers
  no Stripe; `billing_identities`/`billing_customer_aliases` modelam o N:1 e
  estão vazias.
- 54 das 121 telas tocam legado; 11 leem **só** legado (lista em
  `docs/arquitetura/MAPA-TELAS.md`); 51 leem tabela vazia.
- `contatos` tem dois índices únicos: `(sessao_id, telefone)` e
  `(lead_id, responsavel_id)`. Um `ON CONFLICT` só nomeia um. Há inserts que
  cobrem um e estouram no outro.
- O menu desenhado por `components/onface/proto/CascaLiga.tsx` diverge da
  árvore em `components/onface/navegacao.ts`.
- `deploy.sh` imprime `✓ publicado: <sha>` mesmo quando a imagem não existe no
  GHCR, e o container fica na versão anterior. Confirme a versão que roda com
  `docker inspect --format '{{.Config.Image}}'` nos três containers.
- Documentação existente que vale como pista, não como verdade:
  `docs/produto/insights-2/CUTOVER-LEGADO.md`, `docs/produto/insights-2/07-META-CAPI.md`,
  `docs/arquitetura/MAPA-TELAS.md`, `docs/decisoes/2026-09-22-refactor-arquitetural.md`,
  `AGENTS.md`, `docs/operacao/protocolo.md`.

---

## 7. Método

1. **Comece pelo dinheiro.** Jornadas 5, 6, 7 e a integração com o Stripe.
   Depois a entrada (1, 2, 3). Depois o resto.
2. **Leia o código que executa, não o que explica.** Comentário é hipótese.
   Siga a chamada até o `db.execute` / `fetch` / `publicarEvento`.
3. **Para cada regra, pergunte: quantos lugares decidem isto?** Se mais de um,
   anote os dois, a diferença, e qual deveria sobreviver.
4. **Para cada tabela e coluna, pergunte: quem escreve, quem lê, desde quando.**
   Use `pg_stats`, `count(*)`, `max(updated_at)`, e o grep do nome no código.
5. **Para cada integração, pergunte: o que o provedor manda, o que o código
   trata, o que ignora.** Compare a lista de eventos tratados com a lista do
   provedor. Compare o que está gravado com um `GET` à API do provedor numa
   amostra de 20 registros.
6. **Para cada tela, pergunte: de onde vem cada número, e esse mesmo número
   aparece em outra tela vindo de outro lugar?**
7. **Abra as telas em homologação** (`dev.crm.callface.io`) com a cópia do banco
   para ver o que o usuário vê. O que não foi aberto não foi verificado — diga.
8. **Registre a cada bloco** em `NOTAS.md`. Não confie na própria memória entre
   janelas.
9. **Nunca invente para preencher lacuna.** Se não achou a fonte de um número,
   escreva "fonte não encontrada" — isso é um achado, não uma falha sua.
10. **Não "melhore" nada no caminho.** A tentação de corrigir um `typo` ou um
    import é a porta para o remendo que criou este problema. Anote e siga.

---

## 8. Critério de pronto

O diagnóstico está pronto quando o Scott consegue, sem ser desenvolvedor:

- Apontar qualquer tela e saber de onde vem cada número e para onde vai cada
  clique.
- Ver a lista fechada do que é legado, do que o segura, e do que sai primeiro.
- Ver cada integração como "manda isto, recebe aquilo, e aqui dentro acontece
  tal coisa — e aqui está quebrado".
- Aprovar lote a lote um plano em que cada item tem prova de comportamento
  preservado, risco declarado e ordem justificada.
- Confiar nos números, porque cada um traz a consulta ou o arquivo:linha que o
  produziu.

Se faltar qualquer um desses cinco, não está pronto. Diga o que falta.
