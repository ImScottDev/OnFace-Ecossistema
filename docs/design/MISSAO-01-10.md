# Missão 01/10 — todas as telas na nova arquitetura, com dado real

Dada pelo Kauã em 01/10 antes de dormir. Executada em ciclos (`/loop`), sem
perguntas. Este arquivo é a fonte do progresso: cada ciclo lê, pega o próximo
item aberto, executa, valida e marca.

**Fonte visual:** o protótipo do zip `OneFace-handoff-completo.zip` (servido
local em `:8899`). Não se altera o desenho — troca-se o mock pelo dado real e
ligam-se as lógicas. Telas sem protótipo: aproveitar a base que já existe no
repo e trazê-la para a linguagem ONFACE (casca, tokens, arquétipos do handoff).

**Critério de pronto (não é "a página abriu"):** dado correto + ação correta +
persiste + sobrevive ao reload + sem botão mentiroso + sem regressão + sem
404/deep-link quebrado + sem erro de console/network + tenant/RBAC preservado.

**Ambiente:** local, branch `redesign/onface-ux-spec-v1`, banco local
restaurado de prod. App :3000 + API Hono :3012 precisam estar no ar.
Produção não se toca.

## Legenda
`[ ]` aberto · `[~]` em andamento · `[x]` pronto e validado · `[!]` bloqueado (motivo ao lado)

## Fase A — telas com protótipo (ligadas; validar contra o critério)

| rota | tela | estado |
|---|---|---|
| /pre-vendas | Pré-vendas | [~] ligada, grava; validar critério completo |
| /pipeline | Pipeline | [~] ligada, grava |
| /pipeline/:id | Oportunidade | [~] ligada |
| /propostas | Propostas | [~] ligada (leitura) |
| /propostas/nova?oportunidade= | Proposta (Builder) | [~] cria com catálogo real |
| /contatos | Contatos | [~] ligada, auditada |
| /pessoas/:id | Pessoa 360 | [~] ligada |
| /empresas/:id | Empresa 360 | [~] ligada |
| /tarefas | Atividades | [~] ligada |
| /pos-vendas | Onboarding | [~] ligada, auditada |
| /projetos/:id | Projeto | [~] ligada, auditada |
| /clientes | Clientes | [~] ligada, auditada |
| /clientes/:id | Cliente 360 | [~] ligada, auditada |
| /clientes/cs | Customer Success | [~] ligada, auditada |
| /atendimento | Atendimento | [~] ligada, auditada |
| /calendario | Calendário | [~] ligada, auditada |

## Fase B — deep-links do protótipo e do menu

- [ ] `/clientes/360`, `/operacao/projeto`, `/onface-preview/*` → rota real (redirect)
- [ ] Toda navegação interna das telas portadas aponta para rota existente (teste `link-nao-leva-pro-vazio`)

## Fase C — telas sem protótipo (base existente → linguagem ONFACE)

| rota | hoje | estado |
|---|---|---|
| /inicio | VisaoGeral (onface) | [ ] validar/alinhar |
| /vendas | renderiza Tarefas (ERRADO) | [ ] visão geral de vendas |
| /prospeccao | vendas/Prospeccao (onface) | [ ] validar/alinhar |
| /automacoes/campanhas | crm2 CampanhasWorkspace | [ ] |
| /automacoes | crm2 Workspace | [ ] |
| /automacoes/fluxos | ModuloPendente | [ ] |
| /automacoes/cadencias | crm2 CadenciasWorkspace | [ ] |
| /automacoes/agentes | crm2 AgentesWorkspace | [ ] NEXO / Agentes IA |
| /automacoes/execucoes | crm2 ExecucoesWorkspace | [ ] |
| /relatorios | crm2 Workspace | [ ] |
| /relatorios/biblioteca | ModuloPendente | [ ] |
| /relatorios/performance | ModuloPendente | [ ] |
| /login | página própria | [ ] linguagem ONFACE |
| /ajustes | crm2 (usuários, integrações) | [ ] Configurações |
| /financeiro | não existe (há /clientes/financeiro) | [ ] Financeiro |
| /perfil | crm2 | [ ] |

## Fase D — fechamento

- [ ] build verde, testes verdes (exceto a falha pré-existente do Codex)
- [ ] validação no navegador da lista do Kauã: /inicio, /pre-vendas, /pipeline,
  /pipeline/:id, /propostas, criação de proposta, /contatos, Pessoa, Empresa,
  /clientes, Cliente 360, /pos-vendas, Projeto, /clientes/cs, /tarefas,
  /atendimento, /calendario, /financeiro
- [ ] vault + diário + commit local (sem push, sem deploy)

## Log

### 01/10 madrugada — ciclo 1
- Fase A: 8 telas restantes ligadas por workflow (investigar → ligar → auditar → corrigir); 8/8 aprovadas na reauditoria. Typecheck limpo.
- Conversor: estilo misto `style="{{ x }};a:b"` perdia a interpolação (grid-column, larguras) — corrigido em dc-para-tsx.mjs; Atividades, Projeto, Onboarding, Propostas, Proposta e Relatório de Ligação regerados. Atividades agora bate com o protótipo.
- Portador: 8 globais do protótipo (OnFaceAgenda, OnFaceRelacoes, *Seed...) viram chaves de catálogo — antes quebrariam o SSR e encheriam de mock.
- scripts/dev-sessao.sh + scripts/dev-smoke.sh: validação autenticada por curl, para os agentes não disputarem o navegador.
- Dev server saturado (renders de 4 min) — reiniciado limpo.
- Cliente 360: aceita id de `clientes` além do de empresa (busca global ⌘K dava 404); "Cliente desde" deixou de mostrar 16/08/2026 (data da carga de reconciliação, 90 clientes) — agora vem de ganho/contrato/fatura paga.
- 404: botão "Ir para o início" estava invisível (texto da cor do fundo) — corrigido.
- Validado no navegador: /tarefas, /clientes, /contatos, /calendario, /pos-vendas, /projetos/:id, /clientes/:id — dado real, 0 erro de console.
- Pendente: trilha do topo em /projetos diz só "ONFACE" (falta /projetos no mapa da navegação).
- Fase C em andamento: workflow wf_8c247665-985 com 15 telas.
- /clientes/cs validada: dado real; "Executar" do plano do dia grava 3 tarefas com o usuário da sessão como responsável (dado de teste apagado).
- /atendimento: RBAC correto — 1.731 conversas, todas com dono; usuário de dev (admin) vê só as suas/sem dono = 0. Validação com dados exige super_admin (promover o usuário de dev foi bloqueado pela política de permissões — decisão do Kauã). PENDENTE: estado vazio do Atendimento oferece Encerrar/Transferir/Ativar NEXO sem conversa selecionada (botão mentiroso).
- /atendimento: estado vazio honesto (sem Encerrar/Transferir para conversa inexistente; explica a regra de privacidade e mostra os 8 números conectados). Validado no navegador.

### 01/10 — ciclo 2
- Casca: trilha sem duplicação; título próprio para /vendas, /financeiro, /perfil, /projetos (`PAGINA_FORA_DA_ARVORE`).
- /pre-vendas/exportar: 500 → 200 (`comoLista()` normaliza text[] que chega como "{a,b}").
- `.env` local: NEXTAUTH_URL/AUTH_URL 3100 → 3000 (sessão do curl voltou).
- TS: `PermissaoMatriz` interface → type (constraint do db.execute). tsc limpo.
- `public/proto/motion.js`: não escreve mais `data-tilt` nos filhos (hydration mismatch em /pre-vendas no dev lento).
- Workflow wf_e3b565ea-23b: segurança da API (6 pontos), RBAC do /vendas, badges mock da casca, links mortos do Início, `?atv=` fora dos 300, /esqueci-senha, testes de catraca, árvores de menu, reauditoria das 12 telas da Fase C.
- Vault e diário de 01/10 atualizados.

### 01/10 manhã — ciclo 3 (orquestrador)
- wf_e3b565ea-23b concluído: 6/6 frentes aprovadas (segurança da API em 6 pontos + 2 achados do verificador; RBAC do /vendas; badge real do Atendimento; links do Início; `?atv=p:<id>`; /esqueci-senha; árvores de menu; reauditoria Fase C). tsc completo limpo; npm test 433/445 (10 falhas pré-existentes ou de outros donos).
- `/contatos/empresas/:id` → redirect para `/empresas/:id` (Empresa 360 do protótipo); `/contatos/pessoas/:id` → `/pessoas/:leadId` quando a pessoa tem lead de origem (3.975/3.988).
- Portador: globais do protótipo sem `?? []` (Relacoes/Agenda são função/objeto — derrubava a Empresa 360); `window.innerWidth/Height` protegido no SSR (Pessoa caía para render no cliente); "Scott Ferraz" fixo vira `this.eu` (usuário da sessão via `UsuarioDoProtoContexto`, fornecido pelo CascaProto). Conversor de markup: perfil da casca mostra o usuário logado. 23 Ligas regeradas.
- Detalhe do lead: `servicos` normalizado (mostrava "{"), data de criação em ISO.
- 15 telas da lista do Kauã: 200, 0 erro de console, 0 request falha (visitante headless).
- Em andamento: wf_62b1d7cc-045 (construtor de automações n8n + agentes IA + cadências/campanhas + ajustes + clientes secundários + públicas/legado + jornadas E2E), wf_ffff0894-b98 (5 telas do zip que faltavam: Atividade, Reunião, Relatório de Ligação, Tags da Oportunidade, Iniciar Relação, via hospedeiro global de peças), wf_53693c10-fc8 (NEXO real).

### 01/10 — ciclo 4 (fechamento)

**Entregue pelos agentes (7 frentes + hospedeiro de peças + 5 peças):**
- **Construtor de Automações nível n8n.** `lib/automacoes/grafo.ts` (26 tipos de
  nó, 24 eventos reais, expressões `{{ }}` sem eval), executor com claim,
  espera, retentativa, três políticas de falha, timeout, reentrada e anti-loop
  por carimbo; 21 rotas Hono; webhook público em `/api/webhooks/automacoes/
  [token]`; migração 0092 aditiva; migração das Regras antigas sem perder
  histórico. Editor em `/automacoes/fluxos/[id]`: canvas React Flow, paleta com
  busca, inspetor, desfazer/refazer, autosave, Ensaiar (dry-run sem efeito),
  Rodar agora, Histórico de versões, 6 modelos prontos.
- **Agentes IA**: jornada única (`/automacoes/agentes`), abas, prompt compilado
  visível (a MESMA função que o runtime usa), playground, KPIs de
  `ai_agent_runs`. Rotas duplicadas viram redirect.
- **Campanhas**: passaram a enviar — migração 0091, `outreach_campanha_
  destinatarios` com status por pessoa, `campanha-sweep` no worker. Testado com
  allowlist: 4 bloqueados, 0 enviados, status correto.
- **Ajustes**: 24 abas no padrão, estado real das integrações derivado do banco.
- **Clientes/Operação**: 21 rotas, redirects preservando id.
- **Legado e públicas**: 27 rotas legadas → redirect; `/estudio/*` morreu;
  formulários públicos de implantação, proposta pública e checkout no ONFACE.
- **5 peças do zip** (Atividade, Reunião, Relatório de Ligação, Tags, Iniciar
  Relação) + hospedeiro global: os 14 adaptadores que respondiam "ainda não
  está ligada" agora abrem a peça de verdade. Concluir/reagendar em `/tarefas`
  grava.
- **NEXO real**: saudação e radar com números conferidos por SQL; sem chave de
  IA, mensagem honesta em vez de resposta inventada.

**Fechamento (orquestrador):**
- `tsc --noEmit -p .` limpo. `npm test`: **482 passam, 0 falham** (eram 9).
  As 9: 4 de reconciliação (dado de teste órfão dos agentes — 20 registros e 67
  dependentes apagados em transação), rotinas (catálogo não listava
  `fluxos-sweep` e `campanha-sweep`), webhook (categoria nova: segredo é token
  no banco, com verificação real de que token desconhecido e automação
  desligada recebem a MESMA recusa), board de Implantação (mudou de casa para
  `/pos-vendas?aba=imp`), inventário (componente passou a receber props),
  cor-tem-nome (191 hex em 5 CSS novos + 179 nos adaptadores → tokens).
- **Tokens novos no DS**: sucesso e aviso (faltavam: havia quatro verdes e
  quatro âmbares quase iguais à mão), `--of-linha-forte`, `--of-tinta-tenue` e
  os três degraus de coral sobre o grafite da casca.
- **Vazamento global corrigido na raiz**: o CSS gerado do handoff pintava TODO
  `a` de coral sem camada, e o `{children}` do app renderiza dentro da casca —
  botão-como-link virava pílula coral sem texto (404, /chamados, "Gerenciar
  sessões"). Agora o gerador emite `a:not([class])`; o remendo local em
  `ajustes.css` saiu.
- **45 rotas visitadas no navegador**: todas 200, 0 erro de console, 0 request
  falha.

**Pendente com o Kauã:**
- Chave de IA (Anthropic ou `GROQ_API_KEY`): sem ela NEXO e playground mostram
  "IA não configurada".
- `WHATSAPP_ALLOWLIST` não está no `.env` local — com a lista vazia o client
  libera todos os destinos. Hoje nada sai porque o worker não roda.
- Em produção, aplicar 0091 e 0092 antes de subir o worker novo.
- `/admin/view-as` passou a ser só de super_admin (admin e gerente nunca viram
  dado de outro usuário, mas o banner reagia ao cookie).
