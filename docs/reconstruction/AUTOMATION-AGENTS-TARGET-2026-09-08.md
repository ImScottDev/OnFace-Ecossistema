# Automações e agentes — arquitetura alvo

Data: 2026-09-08

## Decisão

O CRM terá um único executor durável para automações e cadências: o grafo
versionado hoje persistido em `cadence_definitions`/`cadence_versions`.
Cadência é um tipo de automação. `event_outbox` é a entrada canônica para
eventos de domínio; eventos de canal entram pelo mesmo despachante depois de
serem persistidos. Agente de IA é uma ação do grafo e só executa as tools da
versão publicada.

O CRUD simples de `automacoes` permanece temporariamente como compatibilidade
para regras imediatas existentes. Novos fluxos são criados no builder visual e
executados como enrollments pinados a uma versão publicada.

## Alternativas avaliadas

1. Estender o CRUD simples com waits e branches: descartado, duplicaria o motor.
2. Criar um terceiro conjunto `workflow_*`: descartado, aumentaria migração e
   manteria três executores concorrentes.
3. Promover o grafo/cadence engine a motor geral: escolhido. Preserva builder,
   versionamento, fila, retry, branches, agentes e histórico já implementados.

## Fluxo

`event_outbox → automation dispatcher → enrollment idempotente → lease/step →
adapter/tool → step event → próximo nó ou retry/dead`

Uma resposta recebida atualiza os enrollments ativos da Pessoa/Lead antes de
disparar o agente. A política do fluxo decide se pausa, encerra ou ramifica.

## Invariantes

- Uma versão publicada fica imutável para enrollments já iniciados.
- O mesmo evento não cria duas inscrições na mesma automação.
- O mesmo passo/tentativa não produz duas ações externas.
- Toda query e mutação filtra `organizacao_id`.
- Nenhum sweep seleciona backlog apenas por status; evento ou corte temporal é
  obrigatório.
- Handoff pausa agente e follow-up, cria alerta/tarefa e registra o contexto.
- Autonomia vem da versão do agente: `suggest`, `approval` ou `autonomous`.
- Ligação Callface AI usa adapter próprio, com idempotência e falha fechada sem
  credencial.

## Entidades e tags

Labels continuam sendo o catálogo de tags. `entity_labels` associa tags a
Lead, Negócio, Oportunidade, Cliente, Empresa ou Contato. A atribuição publica
`TagAdded`/`TagRemoved` com entidade, tag e correlação. O bridge legado de
`lead_labels`/`contato_labels` é preservado durante a migração.

## Plano de validação

1. Testes puros de grafo, filtros de trigger e materialização de contexto.
2. Banco local: criar fluxo, publicar, emitir evento duas vezes e provar uma
   inscrição.
3. Worker: executar wait/condition/action, provocar falha e observar retry.
4. Frontend/API: criar, salvar, publicar, pausar, retomar e abrir histórico.
5. SDR sandbox: Lead novo recente → agente → qualificação → agenda ou handoff.

Nenhum deploy faz parte desta etapa.
