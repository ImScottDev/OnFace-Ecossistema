# HANDOFF & CONTINUIDADE — ONFACE (leia isto primeiro ao retomar)

Última atualização: 24/09/2026. Este arquivo é o ponto de entrada. Serve pra retomar o trabalho num chat novo sem perder o rumo. Tudo abaixo está salvo em disco — fechar o chat não apaga.

## Onde está tudo
- **Auditoria completa (23 entregáveis + planilhas)**: esta pasta `auditoria-cleanroom-20260923/`. Comece pelo `00-INDEX.md`.
- **Plano de investigação**: `~/.claude/plans/context-existe-um-projeto-tidy-floyd.md`.
- **Página navegável (resumo executivo)**: artefato privado publicado no claude.ai (abrir no navegador). Se perder o link, peça pra listar os artefatos.
- **Planilhas para você validar/decidir**: `de-para-cutover.csv` e `decisoes-cutover.csv` (abrem no Numbers/Excel/Sheets).

## O veredito em 3 linhas
1. O ONFACE é uma **nova arquitetura que vai SUBSTITUIR** a produção atual (cutover), não conviver com ela.
2. Produção (crm.callface) roda uma **geração intermediária** e é **intocável** — é o que o time usa. Não perdeu dados (os sustos de "perda" eram do banco local de ensaio).
3. Não é caso de reconstruir — é **concluir e promover**. O núcleo comercial funciona; falta terminar o front, o backend e a assinatura.

## DECISÕES TOMADAS NESTA CONVERSA (o rumo — não reabrir sem motivo)
1. **Estratégia = plataforma primeiro, legado por último.** NÃO travar o produto na migração do legado. O schema canônico é estável; o front/backend se constroem sobre ele com dados de seed e se provam ponta a ponta ANTES de migrar dados reais. A migração (cutover) é a última fase. (Detalhe em `15-17-DECISOES-TARGET-EXECUCAO.md`, seção 17-B.)
2. **Salvaguarda barata da fase 1**: fazer cedo o diff de schema coluna-a-coluna legado→canônico (decisão #10) — só pra garantir que o modelo novo tem lugar pra tudo. Não é a migração; é check de dias.
3. **Fluxo de construção do front** (corrigido pelo PO): você desenha a versão final de cada tela no **Claude Design** (que é a fonte de verdade visual / o padrão novo, sem integração) → exporta → **Claude Code implementa aquela tela conectando aos NOSSOS DADOS** (dado real + ações reais). O antigo é substituído. Não há "adaptar pro DS antigo" — o design novo é o DS.
4. **Disciplina anti-bagunça**: uma casca de UI só; uma versão por tela (a antiga morre, não coexiste); "pronta" = funciona (sem botão morto, sem link pro vazio, carrega dado), não só bonita — usar as travas de arquitetura do repo como definition-of-done por tela.
5. **Ritmo**: integrar 2-3 telas primeiro pra calibrar o processo de export→implementação, depois escalar em lote.
6. **Modelo de trabalho**: a IA (eu) é consultor — levanta, estrutura, explica, implementa sob validação. **O PO decide** o que é certo/errado, especialmente nas decisões de negócio (planilha `decisoes-cutover.csv`). Nada de IA decidindo sozinha.
7. **Produção intocável até o cutover estar pronto e validado** (sem perda, sem poluição).

## FAZER JÁ — risco puro, independe de tudo
1. **Push dos 47 commits** que só existem no disco local (senão o redesign inteiro se perde se a máquina falhar). Rodar no terminal (o SSH/git remoto não passa pelo sandbox do Claude Code).
2. **Decidir a assinatura de contrato** (único P0 estrutural): produção nem tem coluna `assinado_em`; 178 assinaturas ZohoSign recuperáveis do export. Decisão #7 da planilha.

## PRÓXIMO PASSO CONCRETO (fase 1 — terminar a plataforma)
1. **Desbloquear o proxy de API**: o `.env` aponta `/api` pra porta 3012 (morta); a API viva está em 3001/3002. ~1 linha, desbloqueia 53 telas que hoje não carregam dado. (Detalhe em `03-ROUTE-SCREEN-INVENTORY.md` §0.1.)
2. Pegar a próxima tela pronta no Claude Design → implementar no Claude Code visando os dados → validar funcionando → próxima.
3. Em paralelo, cedo: o diff de schema (decisão #10).

## COMO RETOMAR NUM CHAT NOVO
Cole algo como: *"Retomando o projeto ONFACE. Leia `auditoria-cleanroom-20260923/HANDOFF-CONTINUIDADE.md` e o `00-INDEX.md` na pasta. Estamos na fase 1 (terminar a plataforma). Modo: construção (pode editar código), eu valido cada tela. Próximo passo: [desbloquear o proxy / integrar a tela X que exportei do Claude Design]."*
O novo chat lê estes arquivos e continua exatamente daqui.

## GARANTIA EXTRA (opcional, recomendado)
Pra blindar de vez, faça um commit desta pasta (e/ou copie pro Vault). Os arquivos já estão salvos em disco de qualquer forma; o commit só versiona. Peça o comando quando quiser.
