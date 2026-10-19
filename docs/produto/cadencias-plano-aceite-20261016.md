# Cadências OnFace — decisões de implementação e aceite (16/10/2026)

Esta revisão preserva o motor único existente (cadence_definitions / cadence_versions / cadence_enrollments), conforme docs/produto/cadencias.md. A produção não é alvo desta entrega: homologação é https://dev.crm.callface.io. O comando deploy.sh dev PUBLICA EM PRODUÇÃO.

## Referências de mercado
ManyChat: construtor de conversas com condições, ações e esperas. Apollo/Salesloft: sequência comercial, tarefas humanas e responsabilidade. HubSpot: interrupção após resposta, reunião ou descadastro. Mautic/Activepieces: fluxos com ramificações e publicação versionada. A decisão é evoluir a arquitetura OnFace, sem instalar um segundo motor.

## Portas de entrada
Automações: criar, salvar rascunho, publicar, acompanhar fila e histórico. Pré-vendas (quadro e drawer): inserir, trocar, pausar, retomar, cancelar e ações em massa. Prospecção: lotes e gatilhos. Pessoas/Contatos, Empresas, Oportunidades, Atendimento, Agentes/Fluxos: compartilhar o mesmo backend, sempre garantindo tenant, responsável, sessão remetente, trilha e elegibilidade.

## Implementado nesta rodada
- Proteção para transições de cancelamento e pausa durante execução e transições via API.
- Pausar definição suspende inscrições e republicar retoma só inscrições paradas por essa definição.
- Janela comercial de segunda a sexta, 08h às 20h (São Paulo), preservando atividades internas fora da janela.
- WhatsApp não usa telefone do lead como envio avulso sem registro de conversa; respeita sessão escolhida.
- Esperas no grafo aceitam a partir de um segundo, com sweep periódico de 15s (não é disparo exato por segundo).
- Pré-vendas: inscrição real em massa e drawer, sem opções fictícias; pausa/retomada consulta banco.
- Canvas visual baseado em React Flow, com condições Sim/Não, classificação, arestas editáveis, painel de configuração e lista simples preservada para sequências lineares.
- O motor calcula condições E/OU com dados vivos antes de escolher o ramo; fallback incondicional vem por último.
- Pré-vendas mantém o estado de pausa sincronizado com inscrições reais após recarregar.

## Ainda NÃO entregue ou aguardando aceite
2. Propriedade e visibilidade pessoal/equipe implementadas na V3 de 19/10; aguardam aceite E2E autenticado e teste com dois usuários.
3. Inscrição direta unificada de empresas e oportunidades; rota manual ainda aceita lead, contato e negócio.
4. Handoff completo e interrupção por reunião, e-mail, no-show, opt-out e respostas de outros canais.
5. Execução temporal com precisão garantida de segundos: polling de 15 segundos não tem essa garantia.
6. Preview com contexto real, mídia/áudio, simulação completa sem envios e relatórios comerciais de performance.
7. Substituição total do retry paralelo do AI SDR e da cadência antiga de 13 toques.
8. Testes E2E autenticados com navegador, console, persiste após reload, fila real e validação mobile. O teste HTTP de sessão local foi rejeitado pelo ambiente de homologação (segredos diferentes), portanto não conta como aceite.

## Roteiro de aceite em homologação
Usar somente lead e números internos de teste, sem disparos a clientes reais. Confirmar: criar e editar rascunho; publicar; inscrever do drawer e em massa; verificar banco e eventos; selecionar número; executar espera e mensagem; responder e pausar; retomar/cancelar; confirmar nenhuma duplicidade; simular worker inativo; validar responsividade 390px e erros da rede. Testar permissões multi-tenant e sessões desconectadas. Homolog tem chaves reais para IA, Meta e Stripe live: jamais faturar ou acionar ações externas de clientes no teste.

Este documento registra implementação parcial e os critérios para poder dizer que a frente está 100% concluída.
## Evidências adicionais
- Typecheck executado localmente, testes direcionados do grafo, janela e retomada.
- A versão visual ramificada precisa ser publicada como segundo commit, separadamente do SHA inicial 61f92d4.


## Atualização V3 — 19/10/2026

- Migration aditiva 0129: `cadence_definitions.owner_id` e `visibility`; cadências legadas continuam compartilhadas.
- Cadências novas registram o dono autenticado. Uma cadência pessoal só é listada, editada, inscrita, pausada ou cancelada pelo dono nos caminhos com contexto humano.
- Catálogos e leituras nas fichas, pré-vendas, prospecção, atendimento, execuções e API filtram cadências conforme dono e tenant; a fila filtra antes do limite.
- O SDR pode executar cadências com autorização de escrita comercial (`sales.manage`), sem precisar de permissão para construir automações.
- Automações globais e agentes não executam ou alteram cadências pessoais sem identidade autorizada; portanto, **gatilhos automáticos de cadências pessoais ainda não são suportados**. Fluxos de sistema trabalham com cadências compartilhadas.
- Duas verificações independentes encontraram e levaram a correções adicionais de tipagem, consulta de execuções, idempotência, ações dos agentes e filtros de pré-vendas.
- A aceitação completa ainda depende de teste autenticado no navegador com dois usuários distintos, migration em homologação, criação/publicação/inscrição, resposta/pausa e casos de permissão, sem disparo externo.

**Critério de liberação:** homologação primeiro; sem publicação de V3 em produção antes do aceite funcional.
