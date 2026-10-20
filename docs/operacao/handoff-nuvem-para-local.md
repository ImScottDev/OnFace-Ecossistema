# Handoff nuvem → local (20/10/2026)

Para a sessão local. Faixa: `cbfaea90..HEAD` na `main` (32 commits, o último
de código é `d4f1af56`, já publicado em homolog; depois dele só script e doc).
A sessão na nuvem não tinha banco real, servidor nem navegador: testou contra
um Postgres local montado do `schema.ts` + 0131/0132. Resumo para o Scott em
`handoff-2026-10-20-automacoes.md`; roteiro de aceite em
`aceite-automacoes-atendimento-20261020.md`; checagem só leitura em
`app/src/scripts/checar-automacoes-homolog.ts`.

## 1. O que entrou, por frente

- **Privacidade (9ce2c533, a4aef183):** número `privado` deixa de ser canal de
  máquina. Entrada nele só registra a mensagem e para cadência (sem evento de
  fluxo, regra `whatsapp_recebido` nem IA); `escolherSessao` pula privado na
  escolha automática (escolha explícita no passo ainda vale); `contatoDoLead`
  e `resolverContatoCompleto` não reaproveitam conversa privada;
  `avaliarEnvio` devolve `numero_privado`; `executeAgent` recusa contato de
  número privado; campanha e seletor de número do fluxo não listam privado;
  `set-default` em privado → 409. Regra única em `lib/whatsapp/uso-automatico.ts`.
- **Números operacionais (17eec372, f58430e4, a4aef183):** coluna
  `whatsapp_sessao.operacional` + CHECK privado ≠ operacional; switch em
  Ajustes › WhatsApp (só quem administra o número, auditado em
  `whatsapp.numero_operacional`); helpers `listarNumerosOperacionais`,
  `sessaoEhOperacional`, `marcarOperacional`.
- **Distribuição (4c5936f4, e3209f5f, 6cbab2af):** `regras_distribuicao_leads`
  ganha critérios (origem, utm_source, utm_campaign, meta_campaign_ids,
  formulario; igualdade sem caixa) e número alvo `sessao_whatsapp_id`; regra
  sem critério = comportamento antigo; rodízio com `SELECT … FOR UPDATE`;
  Meta/RD decidem o dono por lead DEPOIS da deduplicação e gravam
  `leads.distribuicao_regra_id/_motivo/sessao_whatsapp_preferida_id` +
  `LeadAssigned`; `criarLead` decide depois do retorno da aquisição aberta.
- **Captação / caixa de entrada (17eec372, 53794a1e, d84cb38a, d4f1af56):**
  `captacao_entregas` guarda todo payload (meta/rd/site/api) com idempotência
  por chave; processamento dos webhooks movido sem mudança para
  `lib/captacao/processar-{meta,rd,site}.ts`; `GET /api/captacao/entregas` e
  `POST /api/captacao/entregas/:id/reprocessar` (admin/gerente/super_admin,
  auditado); `POST /api/leads` endurecido (org da sessão quando há sessão,
  `exigirResponsavelDaOrg`, trava + dedup sem sessão → `{duplicado:true}`).
- **Agentes / Lia (486a70f3, e187e521, 504d6eab, 4f9d3928, 1884cbc5, 3acdf981,
  5426794e, b65a5563, adb8a9c1, 6bb67a41):** `avaliarEnvio` devolve
  `ia_pausada` com IA desligada/handoff/atribuição humano|pausada (flag
  `pausaDoProprioRun` deixa sair a mensagem de transição); resposta pelo
  celular assina com o dono humano do número e marca
  `dados.enviadoPeloCelular` (eco de envio do CRM é casado e não duplica);
  `transferirParaHumano`/`solicitarHandoffNaAtribuicao` notificam via
  `notificarHandover`; `resolverHumanoDeDevolucao` prefere o responsável
  humano do lead; `aguardando_aprovacao` bloqueia novo run; aprovar caso de
  ferramenta usa teto de permissão do run ∩ do aprovador; aprovar caso de
  mensagem ENVIA (aceita `body` editado); `meeting.schedule` ok → atribuição
  `humano` motivo `reuniao_agendada` com o closer; `handoff_motivo`, ledger
  `sent/failed` e `outbound_message_id` gravados; automação de mensagem
  recebida não cala agente com atribuição viva ou dono-agente; quem pausou
  fica em `ai_agent_atribuicoes.estado.pausada_por`; `/automacoes/ai/cases`
  aceita `contatoId,status,source,agentId`; Lia no pool operacional.
  Telas: selo de estado + aprovações inline no painel da conversa, fila
  "Aguardando aprovação / Com humano" em Execuções e em Gatilhos, `Casos` do
  editor de agentes usa o `AprovacoesPendentes` compartilhado.
- **Cadência / fluxo (0543ee03, cfe7fecd, 2cc56c1c, 4177bf38, 2297ccbb,
  7efc2934, 15f72768, 75f8e24a):** `ConfigFluxo.aoResponder` (padrão
  continuar) + `registrarRespostaEmFluxos` chamado de dentro de
  `registrarRespostaEmCadencias`; `ai_agent_message` passa por `acionarAgente`
  (sem `atribuir`), fallback de template só quando o agente falhou; opt-out
  checado em `enfileirarWhatsapp`; aviso de "lead respondeu" vai a humano
  quando o dono é agente; IA de classificar/gerar texto roda sem ferramentas;
  `ia_responder` publica `resposta`/`mensagemIds`; editor: "Quando o lead
  responder" e grupo Campanha no seletor de variáveis.

## 2. Sem verificação no navegador (abrir tudo)

- `/ajustes/whatsapp` — selos Privado/Operacional, legenda, switch
  "Número operacional" no drawer (desabilitado em privado; 409 do servidor).
- `/ajustes/leads` — regra com seção "Quando" (chips), "Número de atendimento"
  (só operacionais), resumo da regra na lista; seção "Caixa de entrada da
  captação" (filtros, Reprocessar, estado vazio, 390px).
- `/atendimento` (conversa com agente) — selo "IA atendendo / Pausada por
  <nome> / Com humano: <nome> — motivo / Aguardando aprovação", resumo do
  handoff, aprovações inline (Aprovar e enviar, Editar e enviar, Descartar,
  Aprovar/Recusar ferramenta).
- `/automacoes` › Execuções de agentes — bloco "Fila da equipe".
- `/automacoes` › Agentes › (agente) › Gatilhos — chips Todas / Aguardando
  aprovação / Com humano em "Atribuições vivas"; editor do agente, bloco
  "Aguardando a equipe".
- `/automacoes/fluxos/<id>` — config sem bloco selecionado: "Quando o lead
  responder" (salva e sobrevive ao reload); seletor de variáveis grupo
  "Campanha"; seletor de número sem privado e com "(operacional)".
- `/automacoes/campanhas` — seletor de remetente não lista número privado.

## 3. Migrations

**0131_captacao_rastreavel_e_numeros_operacionais** — aditiva e idempotente
(aplicada duas vezes com `ON_ERROR_STOP` no banco local). Cria
`whatsapp_sessao.operacional` (default false), CHECK
`whatsapp_sessao_privado_nao_operacional` (NOT VALID + VALIDATE; passa porque
tudo nasce false), índice parcial; colunas de critério + `sessao_whatsapp_id`
(FK SET NULL) em `regras_distribuicao_leads`; `leads.distribuicao_regra_id`,
`distribuicao_motivo`, `sessao_whatsapp_preferida_id` (FKs SET NULL); tabela
`captacao_entregas` com índice único (org, canal, chave). Não toca linha
existente. Depois de aplicada: `SELECT count(*) FROM whatsapp_sessao WHERE
operacional` = 0; colunas novas nulas; `captacao_entregas` vazia até o
primeiro webhook. Não tem bloco ROLLBACK no arquivo: reverter = código
anterior (colunas ficam, inofensivas).

**0132_lia_no_pool_operacional** — idempotente (só toca versão fora do pool;
segunda aplicação mexe em 0 linhas). Nas versões de `ai_agents.slug =
'lia-sdr'`: `guardrail_config.canais` = canais antigos − `sessoes` +
`{whatsapp:true, pool:"operacional"}`; `channel_session_id = NULL`. Linhas
tocadas = nº de versões da Lia (todas as versões, publicada e rascunhos).
Conferir:

```sql
SELECT v.id, v.status, v.channel_session_id, v.guardrail_config->'canais' AS canais
  FROM ai_agent_versions v JOIN ai_agents a ON a.id = v.agent_id
 WHERE a.slug = 'lia-sdr' ORDER BY v.versao;
```

ROLLBACK está no comentário do arquivo (remove `canais.pool` → Lia volta a
não atender, como antes de 20/10).

## 4. Os 7 números operacionais

**Não sei quais são** — a nuvem não via o banco. O Scott disse só que são 7
números novos, operacionais, e que não são todos os conectados. Peça a lista
a ele (ou identifique por `label`/`finalidade`/`created_at` recente) e marque
em Ajustes › WhatsApp (o switch audita). Conferência:

```sql
SELECT id, label, session_name, phone_number, finalidade, tipo, privado, operacional, status, is_default, usuario_id
  FROM whatsapp_sessao
 WHERE organizacao_id = (SELECT id FROM organizacoes WHERE slug = 'scott-studio')
 ORDER BY operacional DESC, created_at DESC;
-- estado certo: os 7 com operacional = true, privado = false, status = 'connected';
-- nenhum privado = true com operacional = true (o CHECK impede);
-- nenhum privado = true com is_default = true.
```

Em homolog a limpeza do banco cópia deixa tudo `disconnected`: a Lia e a
distribuição só usam operacional CONECTADO (passo P5 do roteiro).

## 5. Lia

Mudado: a Lia (definição `LIA_VERSAO` e, via 0132, as versões gravadas) deixou
de ter número fixo (`channel_session_id` e `canais.sessoes`) e passou a
`canais.pool = "operacional"`. Efeito: `executeAgent` (roteamento por evento)
só a seleciona para conversa de número operacional; `acionarAgente` autoriza
contato em número operacional; `contatoDoLead(..., {poolOperacional})` abre
conversa nova em `leads.sessao_whatsapp_preferida_id` se for operacional, senão
no padrão/primeiro operacional conectado. Decisão do Scott ("sim", 20/10).
Ainda depende dele: quais números entram no pool; se os motivos de pausa
legados `criterio_concluido`/`pedido_contato` devem bloquear a IA (hoje não
bloqueiam, como antes); a qualificação da Lia continua só no prompt (QA
anterior mostra `qualificacao` nula em 9/10 cenários) — não mexido.

## 6. Achados NÃO resolvidos

- ~~`lembrete-reuniao.ts`: primeiro número do responsável (pode ser privado)~~
  **resolvido em f8e97604**: passa por `escolherNumeroAutomatico`
  (`lib/whatsapp/uso-automatico.ts`) — pool operacional primeiro, privado
  nunca; fallback mantém o número do responsável enquanto nenhum número for
  operacional, e sem número segue sem `sessaoId` como antes.
- ~~Worker `findOrCreateContato`: rodízio entre TODOS os usuários ativos~~
  **resolvido em f8e97604**: `atendentesDoNumero` (`lib/whatsapp/acesso.ts`) —
  pessoa ativa, nunca agente de IA, dona do número ou com acesso a ele. Número
  compartilhado sem nenhum acesso concedido mantém a distribuição antiga (sem
  agentes), porque responsável nulo com número preenchido esconde a conversa.
  Não exercitado com Redis/banco: conferir no primeiro lead novo de número
  compartilhado com `assign_strategy` round_robin/carga.
- ~~`WHATSAPP_ALLOWLIST` é fail-open e nada checa no boot~~ **resolvido em
  f8e97604** (só o aviso: `avisoAllowlistVazia`, logado no boot do worker; o
  envio não mudou).
- Escolha EXPLÍCITA de número privado no passo de cadência/fluxo ainda é
  aceita por `escolherSessao` (dono falando pelo que é dele); o seletor do
  fluxo já não oferece. Fluxo antigo salvo com número privado continua
  saindo por ele.
- `roteamento_comercial_regras` (closer por campanha, substring) segue
  paralelo à distribuição por campanha; closers hardcoded por nome em
  `lia/criar.ts`. Não unifiquei.
- Reprocessar RD/site não tem IP/user agent originais (não guardados).
- Testes que já falhavam no banco local (iguais antes/depois): `operacao.test`
  A, B, deal_advance, autonomia por classe, H (falta 0118 `c.busca` no banco
  local, Teste H sem reunião); `agentes-fluxo` 3; `entrada-sem-duplicata` 2 e
  `destino-do-cadastro` (falta índice único de `backfill_provenance`);
  `webhooks-fail-closed` (rota `resend` fora da lista). Rode no banco de
  verdade para saber se são só ambiente.
- Sem teste executado: mudanças do worker (celular, ledger, automação ×
  agente) — o worker sobe filas ao ser importado.
- Meta webhook não simulado (assinatura HMAC).

## 7. Armadilhas

- A cadeia de migrations não monta do zero (0000 é CREATE cru, 0033/0039 leem
  drift). Para banco de teste local: `drizzle-kit generate` para um diretório
  fora do repo e aplicar o SQL gerado; depois as migrations novas à mão.
- `contatos` tem índice único `(lead_id, responsavel_id)`: criar segunda
  conversa do mesmo lead com o mesmo responsável quebra. `contatoDoLead` agora
  usa `onConflictDoNothing` e devolve null.
- `operacao.test.ts` usa a `LIA_VERSAO` real: depois do pool, o número de
  teste precisa ser `operacional = true` (fixture já ajustado em adb8a9c1).
- Testes que tocam fila travam sem Redis (`REDIS_URL`).
- `tsc` da árvore inteira morreu por memória com vários processos: use
  `NODE_OPTIONS=--max-old-space-size=4500`.
- `next build` com `node_modules` em symlink (worktree) falha no Turbopack; na
  nuvem as fontes do Google exigem `NODE_USE_ENV_PROXY=1` +
  `NODE_EXTRA_CA_CERTS` (local não deve ter isso).
- A trava `conversa-so-pela-porta` exige tirar da lista de exceções o arquivo
  que passa a importar `lib/whatsapp/acesso` (feito para cadence-engine e
  autonomia).
- Commits saíram com autor `Scott Ferraz <scott@scottdev.com.br>`, sem
  trailer de IA. A branch `claude/amazing-cannon-f37vwc` é espelho da `main`;
  pode ignorar.

## 8. Verificação do HEAD

Em `4d43fd1d` (código igual ao `d4f1af56` publicado + script e docs):
typecheck limpo, travas de arquitetura 117/117, `next build` passou
(compilou em 93 s). Árvore da nuvem limpa: nada ficou só no disco.
