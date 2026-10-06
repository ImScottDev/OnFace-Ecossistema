# QA E2E — DEV (virada ONFACE)

Registro vivo da auditoria de ponta a ponta em dev.crm.callface.io.
Legenda: [PASSOU] exercitado e confere · [CORRIGIDO] bug achado e resolvido ·
[BLOQUEADO] depende de decisão/externo · [PENDENTE] achado, ainda não resolvido.

Método: AÇÃO → estado → persistência → evento → timeline → próxima ação →
downstream. "Renderizou" não é PASSOU. Prova de ciclo escreve-lê fechado.

## Jornada comercial
[CORRIGIDO/P0] Atribuição de responsável — `atribuirResponsavel` e `criarLead`
gravavam `responsavel_id` com id vindo do cliente sem conferir a organização;
usuário de outra empresa era aceito (vazamento de tenant). Guarda
`exigirResponsavelDaOrg` + trava `responsavel-da-org.test.ts`.
[PASSOU] Criar oportunidade pela ficha, qualificação relida, Apollo ligado
(commits e59016f, 7cadba1).

### Propostas e contratos
[CORRIGIDO/P1] Timeline da proposta — horas e textos fixos ("10:14", "16:02",
respostas de exemplo) para toda proposta. Agora usa datas reais
(enviada/visualizada/aceita/recusada/expirada) e omite o que o banco não tem.
`PropostasLiga/Proto.tsx`, `propostas/actions.ts`.
[CORRIGIDO/P1] Validade sempre 30 dias — `+validade || 30` recebia data, virava
NaN e caía em 30 (forecast, "vence em N dias", urgência). Agora `validadeDias` =
data_validade - enviada_em; sem validade mostra "Sem validade". `PropostasLiga.tsx`.
[CORRIGIDO/P1] Desconto >15% dizia "Enviada para aprovação do gestor" mas só
salvava rascunho (não existe fluxo de aprovação). Agora diz "Salva como rascunho".
`PropostaLiga.tsx`.
[PASSOU] Criar proposta (itens exigem catalogoPrecoId), aceite grava status+data
e gera contrato, assinatura Documenso idempotente, rota pública /p/[id] existe.
[PENDENTE/P1] Totais: 194 propostas com total_geral != recorrente+avulso (legado
Zoho, algumas negativas). Precisa decisão de backfill.
[PENDENTE/P1] Expiração não roda em lote: 2 propostas vencidas seguem abertas.
[PENDENTE/P1] Aceite sem data em 428 propostas aceitas (legado; backfill = escrita).
[NOTA] `PropostasLiga.tsx` tem `@ts-nocheck` — tsc não cobre o miolo.

## Pós-venda
[CORRIGIDO] CS "Saúde da carteira" — barra em "—" embora `cs_health_snapshots`
tenha 550 linhas (275 empresas). Agora conta o último snapshot por empresa
(254 saudável, 12 atenção, 9 risco). `CsProto.tsx`.
[CORRIGIDO] CS "Evolução do MRR" — `corrigir` apagava o aviso "sem histórico";
agora o aviso aparece (`cliente_receita_mensal` tem 0 linhas). `CsProto.tsx`.
[CORRIGIDO] Carteira de Clientes — KPIs mostravam "% vs N meses" e curva era
MRR de hoje somado por data de entrada (inventado). Selo removido, curva
rotulada "não é histórico mensal". `ClientesProto.tsx`.
[PASSOU] Cliente 360 (faturas reais), entrada na carteira (handoff idempotente,
275 contas), churn parcial x total no domínio, onboarding por família, expansão
sem duplicar empresa.
[PENDENTE/P1] CS responsável: 0 de 275 clientes têm responsavel_cs_id (dado,
falta regra de atribuição no handoff). "Minha carteira" fica vazia.
[PENDENTE/P1] Churn sem tela: `registrarPedidoCancelamento` existe, a tela de CS
não aciona (`cs_cancelamentos` 0 linhas). Backend pronto, tela não ligada.
[PENDENTE/P2] Renovação: `cs_renovacoes` 0 linhas, `current_period_end` nulo.

## Transversais
[CORRIGIDO/P0] No-show — a peça de Reunião só mudava a coluna; PATCH gravava
status no_show e NUNCA chamava `registrarNoShow`. 47 reuniões no_show, 0
MeetingNoShow em `vendas_eventos`, 0 na timeline. Agora chama `acaoNoShow`:
evento + timeline + contagem + Lead volta a Qualificado na mesma oportunidade.
`ReuniaoPecaProto.tsx`.
[CORRIGIDO] Atendimento — atalho criava ligação "3:12 · (11) 4003-1020"
inventados; trocado por "Ligação registrada"/"Telefone". `AtendimentoLiga.tsx`.
[PASSOU] Lida não conclui tarefa; `registrarNoShow` preserva a oportunidade.
[PENDENTE/P1] Reagendar reunião em no_show não registra MeetingRescheduled nem
devolve o Lead (exige `pipeline.ts` compartilhado — diff no relatório).
[PENDENTE/P2] 270 de 331 tarefas a_fazer estão vencidas (dado); a tela de
Atividades precisa aguentar 82% atrasado sem quebrar o resumo.

## Governança e transversais 2
[CORRIGIDO/P1] IA/OpenAI — a credencial nunca validava: mandava `max_tokens`,
e o modelo exige `max_completion_tokens`. Corrigido no gateway (openai usa
max_completion_tokens; Groq segue com max_tokens). `provider-gateway.ts` + teste.
[CORRIGIDO] Notificações — PATCH `/:id` com id não-uuid dava 500; agora valida
e devolve 404. `routes/notificacoes.ts`.
[PASSOU] Notificações (sino lê o real do usuário, badge por não-lidas, lida não
conclui tarefa, aba NEXO vazia sem inventar), Busca/Navegação (26 rotas vivas),
Perfil (senha/nome/foto com bcrypt e checagem), Ajustes (filtra por papel),
Relatórios/Metas (números sobre `negocios.ganho_at`, setembro confere: 38 ganhos
R$ 19.808,50), Financeiro MRR canônico.
[BLOQUEADO] NEXO — sem provider utilizável (`ai_agents` nexo/hermes em draft, 0
runs). Código diz "IA não configurada", não inventa.
[BUILD-OUT] Cadências (`cadence_enrollments` 0 linhas), Automações (`automacoes`
2 linhas inativas, execuções 0), Busca por registro (tela avisa que não cobre).
[PENDENTE/P1] Financeiro — sync Stripe parado desde 23/09 (12 dias); "cobrado"
e "vencido" congelam. Infra/dado, não código.
[PENDENTE/P2] Notificações — 1.232 `callface_ligacao_sem_lead` afogam o sino
(231 por usuário); "Ver tudo" vai para /tarefas; relatório `/resumo` é endpoint
morto com MRR legado. Diffs descritos, não aplicados (precisam de decisão/central
que não existe).

## Bloqueios que dependem do Scott/externo
- (herdados do qa-05-10.md §4) closer altera catálogo/contrato via API;
  lead atribuível a usuário de outra org; pagamento sem negócio falha calado;
  negocios × oportunidades divergem; token RD/Meta versionado.

## Teste interativo logado (06/10, usuário qa.e2e@callface.ai)
[CORRIGIDO/P0] Pré-vendas board quebrava inteiro (ReferenceError: D is not
defined em linhaLista; @ts-nocheck escondeu). `this.dadosDoProto.EQUIPE` + trava.
[CORRIGIDO/P2] Clientes "Carteira": hero "RECEITA RECORRENTE" ainda mostrava
"24% vs. 12 meses antes" (histórico falso, cliente_receita_mensal vazio);
corrigirSaida não tocava v.hero. Selo escondido. `ClientesProto.tsx`.
[PASSOU logado] inicio, pipeline (18 cards reais), oportunidade 360 (dado real,
timeline real contacted→reuniao_agendada), modal Derivar, sino (escopo por
usuário, empty honesto), contatos (949), clientes, propostas, pos-vendas (10
proj), financeiro-admin (MRR 425.619 canônico, fontes rotuladas), insights
(R$1.030), tarefas, calendario (7 reuniões), atendimento (conversa real),
automacoes (build-out), perfil.
[PASSOU] Permissões: admin vê /financeiro; papel não-admin é redirecionado.
[PASSOU] Edição+persistência+refresh: nome do perfil salvo e relido após reload.
[PENDENTE/P2] Role: o conjunto canônico é `admin` (não `administrador`);
`normalizeRole` joga papel desconhecido para `closer`. Se algum seed/usuário
usar nome PT ("administrador"), ele é silenciosamente rebaixado a closer e perde
telas. Validar o papel na escrita ou normalizar na leitura.
[PENDENTE/P2] Clientes MRR R$ 491.591 diverge do canônico R$ 425.619 do
Financeiro/Início (fonte diferente na carteira). Investigar a fonte do hero.
[PENDENTE/P3] Saudação de Atividades diz "Bom dia, Scott" logado como QA E2E
(nome possivelmente hardcoded).

## Risco para produção
_(a decidir ao fim)_
