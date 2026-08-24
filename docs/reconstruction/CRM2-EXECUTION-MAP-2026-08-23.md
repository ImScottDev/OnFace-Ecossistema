# CRM2 — mapa de execução e critérios de aceite

Data: 2026-08-23  
Responsável arquitetural: Codex  
Executor especializado: Claude Code | CRM Maestro, somente por blocos delimitados

## Objetivo

Levar o CRM2 ao estado de sistema operacional da Callface, conectando aquisição, venda, entrega, ativação, adoção, retenção e expansão. Cada módulo precisa terminar em contexto, ação, responsável ou decisão. Tela sem persistência, rota sem ação e mock visual não contam como entrega.

## Estado real auditado antes de novas alterações

### Já existe no CRM2

- Sidebar macro com Início, Vendas, Atendimento, Clientes, Automações, Insights e Ajustes.
- Vendas com Visão Geral, Pré-vendas, Prospecção, Pipeline, Propostas e Contatos & Empresas.
- Clientes com Carteira, Implantação, Onboarding, Sucesso e ponte para Financeiro.
- Automações com Fluxos, Cadências, Agentes e Execuções.
- Atendimento com Inbox, filas básicas, claim/release/transfer, snooze, fechamento/reabertura, tags de conversa, templates slash e modal Scripts/Documentos.
- Cadências persistidas com draft/publicação, enrollments e worker existente.
- Catálogo de agentes, versões e dry-run adicionados nas migrations 0019.
- Entidades canônicas de Pessoa, Empresa, Negócio, Service/serviços canônicos, Fulfillment, contratos, billing, Timeline/outbox e identidade externa Callface AI.

### Existe, mas ainda é parcial ou desconectado

- Cadências têm editor inicial, mas ainda não o builder visual completo com grafo, condição/branch, classificação IA, ações e fila operacional observável.
- Agentes existem como catálogo, mas não há hub completo funcional equivalente ao Deskcomm com Follow-ups, Roteadores, Credenciais, Provedores, Conhecimento, Memória, Skills, Casos, Alertas, Propostas, Execuções e Uso/Orçamento.
- Insights ainda aponta para rota/legado sem hub CRM2 fechado.
- Clientes ainda usa o rótulo Sucesso em vez de CS e Financeiro possui bridge legada.
- Deep-links e ações de cabeçalho do Atendimento foram corrigidos na última rodada, mas precisam de validação manual pós-reload.
- Implantação/Onboarding usam uma engine compartilhada; a regra de produto é PABX somente em Implantação e Callface AI/White Label em Onboarding.

## Contratos de domínio

1. Pessoa e Empresa são identidades persistentes; Lead é processo de aquisição.
2. Negócio representa uma família comercial; eventos não viram colunas de pipeline.
3. Service é o centro econômico por produto, com MRR, lifecycle, billing, contrato, fulfillment e uso próprios.
4. Cliente 360 une contexto, mas não substitui os workspaces de Vendas, Atendimento, Implantação, Onboarding, CS e Financeiro.
5. Aceite de proposta não é Won; Won continua evidence-gated por família.
6. Origem, campanha, ad set, anúncio, criativo e UTMs devem seguir até Cliente 360 quando houver fonte real.
7. Nenhum dado, health score, capacidade, evento de uso ou integração deve ser fabricado.
8. Reutilizar event outbox, motor de cadências e entidades canônicas. Não criar Inbox, Service, Timeline ou enrollment paralelo.

## Opções de execução

### A — Reescrever tudo por módulo

Alta coerência visual, mas alto risco de perder regras, dados e integrações já corrigidas. Rejeitada.

### B — Fechar slices ponta a ponta sobre a base existente

Cada slice liga navegação, UI, rota, persistência, worker e validação sem reescrever domínio. Mantém o strangler pattern e permite progresso verificável. Escolhida.

### C — Delegar uma reconstrução ampla ao Claude

Maior velocidade aparente, mas aumenta drift arquitetural, gasto de contexto e telas sem contrato. Rejeitada como estratégia geral; Claude será usado apenas em tarefas com contrato fechado.

## Ordem de execução escolhida

### Slice 0 — Saúde do shell e navegação

- Confirmar sidebar oficial e rotas reais.
- Corrigir links legados dentro de módulos CRM2.
- Renomear Sucesso para CS quando o workspace já tiver o comportamento de CS.
- Criar/fechar hub de Insights somente com dados existentes.
- Critério: nenhum card ou botão principal navega para rota inexistente ou legado sem indicação explícita.

### Slice 1 — Atendimento operacional

- Validar os quatro bugs corrigidos.
- Confirmar filas, claim/release/transfer, snooze, fechar/reabrir, tags, templates, scripts/documentos e deep-link de Contato.
- Critério: abrir uma conversa real, executar cada ação e verificar estado persistido/auditoria sem envio externo.

### Slice 2 — Clientes e jornada pós-venda

- Separar semanticamente Implantação PABX e Onboarding AI/White Label.
- Fechar Cliente 360 com Service por produto, pessoas, origem, comercial, financeiro, fulfillment, onboarding/implantação, CS e timeline agregada.
- Critério: uma empresa real responde quem é, como chegou, o que comprou, quanto paga, em que etapa está, risco e próxima ação sem dados fabricados.

### Slice 3 — Follow-up/Cadência

- Builder visual sobre `cadenceDefinitions`, `cadenceEnrollments` e eventos existentes.
- V1 honesta: Trigger, Wait, Condition/Branch, Action e End, com Condition reutilizando `lib/crm/condicao.ts`.
- Classify IA não entra como tela decorativa; fica para uma fase posterior após definir provedor, modelo, prompt, custo, permissões e aprovação.
- Publicação, pausa, retomada, cancelamento, snooze, retry e fila observável.
- Critério: criar um fluxo de teste, publicar, inscrever entidade controlada, executar wait/action e ver o evento na Timeline/outbox.

### Slice 4 — Agentes e roteamento

- Catálogo/versionamento/dry-run já criado.
- Completar hub operacional, bindings, ferramentas, handoff, limites, custo e dispatcher determinístico.
- Roteadores somente depois do runtime versionado.
- Critério: uma mensagem em modo teste escolhe no máximo um agente, registra a decisão e não envia externamente.

### Slice 5 — Automação, webhooks e governança

- Expandir gatilhos por tag, claim, transferência, snooze, enrollment e webhook.
- Intake genérico somente com idempotência, field map e vínculo canônico.
- Execução por ação, retry, erro e auditoria.

## Regra de delegação

- Codex: arquitetura, leitura do repo, decisões, contratos, revisão, validação e alterações pequenas que dependem de contexto cruzado.
- Claude Code | CRM Maestro: implementação de um slice ou bug com arquivos, contrato, critério de aceite e comando de validação definidos.
- Outros terminais: somente quando houver trabalho independente e sem sobreposição de arquivos/dados.
- Todo report deve identificar o agente, listar feito/parcial/bloqueado, arquivos, validações e limites.

## Gate antes de considerar pronto

- UI, estado de carregamento/erro/vazio e navegação.
- Endpoint/contrato e persistência real.
- Permissão/tenant.
- Vínculo com entidade canônica.
- Idempotência/retry quando houver worker.
- Timeline/outbox para ação relevante.
- `tsc` sem erro novo, build ou teste proporcional e validação manual sem envio externo.

## Decisão executável de 2026-08-23

Auditoria A/B/C/D confirmou que não existe builder visual de nós no Callface e que oito áreas do hub de Agente IA não possuem schema, rota ou código. A execução escolhida é incremental: ligar imediatamente os quatro módulos de IA já reais e marcar o restante como indisponível; adicionar Calendário ao shell; e construir o builder V1 somente sobre capacidades persistidas/executáveis. Isso preserva honestidade funcional e permite evoluir o grafo sem inventar runtime de IA.
