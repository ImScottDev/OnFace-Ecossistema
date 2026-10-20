# Handoff — Automações e Atendimento (sessão na nuvem, 20/10/2026)

Entrega feita numa sessão só com o repositório (sem vault, servidor, banco real
ou navegador logado). Está toda na `main` (`cbfaea90..20ed3c2e`, 31 commits) e
**não foi publicada**. Roteiro de aceite: `aceite-automacoes-atendimento-20261020.md`.
Checagem só leitura do banco: `app/src/scripts/checar-automacoes-homolog.ts`.

O pacote `ONFACE_ESPECIFICACAO_CLAUDE_CODE_2026-10-20.zip` **não chegou** à
sessão: o trabalho saiu de uma auditoria do código + specs do repo
(`docs/produto/automacoes-fluxos.md`, `cadencias*.md`, `agentes-*`). Cruzar
com o pacote é o primeiro passo da próxima sessão.

## O que foi feito

| Frente | Onde está | Commits |
|---|---|---|
| Número privado fora de toda IA/automação (entrada não aciona IA/fluxo/regra; escolha automática, agente, campanha e padrão nunca usam número privado) | `lib/whatsapp/uso-automatico.ts` e chamadores | 9ce2c533 |
| Pool operacional (`whatsapp_sessao.operacional`, CHECK privado ≠ operacional) + tela em Ajustes › WhatsApp | migration 0131, `Numeros.tsx`, rota `whatsapp.ts` | 17eec372, f58430e4 |
| Distribuição por campanha (origem, utm_source, utm_campaign, campanha Meta, formulário → pessoa/rodízio + número), rodízio atômico, decisão por lead depois da deduplicação, proveniência no lead | `lib/agentes/distribuicao.ts`, `lib/captacao/`, webhooks, `DistribuicaoLeads.tsx` | 4c5936f4, e3209f5f, 6cbab2af |
| Caixa de entrada da captação (payload de toda entrega, idempotência, reprocessar) + tela | `captacao_entregas`, `api-server/routes/captacao.ts`, `CaixaEntradaCaptacao.tsx` | 17eec372, 53794a1e, d84cb38a, d4f1af56 |
| `POST /api/leads` endurecido (org da sessão, responsável validado, trava e deduplicação) | `api-server/routes/leads.ts` | e3209f5f |
| Handoff real: política de canal bloqueia IA pausada/com humano; resposta pelo celular conta como pessoa; humano notificado; aguardando aprovação não roda de novo | `politica-canal.ts`, `atribuicoes.ts`, `handover.ts`, `acionar.ts`, worker | 486a70f3, 4f9d3928 |
| Aprovações: ação com permissão delegada certa; resposta aprovada é enviada (com edição) | `routes/ai-platform.ts` | 1884cbc5 |
| Lia: reunião agendada passa a conversa ao closer; Lia no pool operacional (migration 0132) | `tools/operacao.ts`, `lia/definicao.ts` | 4f9d3928, adb8a9c1 |
| Rastreio: handoff_motivo no run, ledger enviado/falhou, outbound_message_id | `execute-agent.ts`, worker | 504d6eab, 4f9d3928 |
| Automação de mensagem recebida não cala o agente que conduz a conversa | worker | e187e521 |
| Cadência/fluxo: fluxo para quando o lead responde (`aoResponder`, padrão continuar); passo de IA respeita handoff; opt-out; aviso vai a pessoa; IA que classifica roda sem ferramentas; `ia_responder` publica o texto | `cadence-engine.ts`, `executor.ts`, `adapters-fluxo.ts` | 0543ee03…7efc2934, 6bb67a41 |
| Telas: estado da IA e aprovações na conversa; fila do gestor; editor de fluxos (Quando o lead responder, grupo Campanha, seletor sem número privado) | `atendimento/*`, `ExecucoesAgentes.tsx`, `AgenteOperacao.tsx`, `fluxos/*` | 5426794e, b65a5563, 3acdf981, 15f72768, 75f8e24a, a4aef183 |

## Prova

- `tsc --noEmit` limpo; travas de arquitetura 117/117; `next build` passou em
  `d84cb38a`; portão do GitHub verde em `d84cb38a` e `adb8a9c1`.
- Testes novos com Postgres local (schema gerado do `schema.ts` + 0131/0132):
  `uso-automatico` 2/2, `lia-pool-operacional` 3/3, `handoff-aprovacao` 9/9,
  `captacao` 13/13, `cadencia/convivencia` 6/6, `agente-conversa-http` 3/3,
  `captacao-http` 4/4, editor de fluxos 7/7.
- Falhas que já existiam (iguais antes/depois, por banco local incompleto:
  0118, `backfill_provenance`): `operacao.test.ts` A, B, deal_advance,
  autonomia por classe, H; `agentes-fluxo` 3; `entrada-sem-duplicata` 2;
  `webhooks-fail-closed` (rota `resend` fora da lista).

## Não verificado / pendente

1. **Nada aberto no navegador** e nada publicado. Publicar em homolog
   (`./deploy.sh homolog 20ed3c2e…` ou Actions › publicar) e seguir o roteiro.
2. Lia só atende depois de marcar números como operacionais (homolog: o banco
   cópia desconecta tudo; ver passo P5 do roteiro).
3. Worker (resposta pelo celular, ledger, automação × agente) só tem typecheck:
   o worker sobe filas ao ser importado e não roda em teste.
4. Webhook da Meta não simulado (assinatura); conferir no primeiro lead real.
5. Decisões em aberto: os motivos "leves" de pausa legados
   (`criterio_concluido`, `pedido_contato`) continuam NÃO bloqueando a IA.
6. Fora desta entrega: tela de aceite de cadências V3 com dois usuários,
   substituir o retry paralelo do AI SDR e a cadência de 13 toques legada,
   gatilho automático de cadência pessoal.
