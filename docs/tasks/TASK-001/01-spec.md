# TASK-001 · 01-spec

## Escopo

- Aceitar ou reprovar o WIP de ações em massa de Prospecção do commit `9efce0e`.
- Aplicar `FiltrosProspeccao.lista` na consulta SQL antes do `LIMIT 400`.
- Preservar a navegação no par vivo/espelho de Pré-vendas; remover o deep link morto `?lead=` sem criar página de Lead.
- Fazer o detalhe de Pessoas do espelho funcionar sem sessão e expor Responsável, WhatsApp e E-mail na superfície de Contatos/Empresa 360.
- Remover somente `app/src/scripts/_q.ts` no fechamento.

## Fora de escopo

- Pipeline, `negocios`, `oportunidades`, `service_family` e o achado `achado-dados-pipeline.md`.
- Módulo 02, produção, homologação, migração de dados, nova rota `/pre-vendas/[id]`, refatoração do import circular, Visão Geral/`wa.me` e separação conceitual de lista/tag.

## Regras

- Rota viva: `/onface-preview/*`; `/onface-desenho/*` é espelho deliberado. Toda mudança de rota preserva o par.
- `pagina.tsx` e `PreVendas.tsx` são posse serial única; o import circular existente não será refatorado.
- O checkout é único (`/Users/Scott/Documents/Scott Studio/callface-crm-dev`, branch `dev`): sem branch/worktree e sem edição concorrente.
- `npm run build` não é gate. Typecheck oficial: `tsc --noEmit --incremental false`.
- Decisão provisória do Maestro: não executar Enriquecer enquanto worker/chave puderem chamar Apollo ou consumir crédito. QA cobre abertura/validação do diálogo e resposta 403 não-admin; a evidência transacional fica pendente de decisão do Scott entre A e B.

## Matriz de aceite

| Fluxo | Evidência funcional obrigatória |
|---|---|
| WIP Prospecção | ação clicada, efeito persistido, UI atualizada, reload e próxima navegação; desktop e mobile |
| Enriquecer | sem execução Apollo; abertura/validação do diálogo e resposta 403 não-admin; ressalva explícita sem evidência transacional |
| Filtro lista | teste demonstra filtro SQL antes do `LIMIT 400`; filtro real preserva resultado após reload |
| CTA Pré-vendas | no espelho, CTA permanece em `/onface-desenho/*`; reload e próxima navegação |
| Pessoa espelho | detalhe abre sem sessão, renderiza e navega de volta |
| Contatos / Empresa 360 | Responsável, WhatsApp e E-mail aparecem com dado real; reload e navegação preservam |

Além da matriz, QA só aprova com três evidências D2 em `04-qa-review`: saída do typecheck, saída do teste e prints do portal desktop e mobile.

## Riscos

- Banco local é clone com dados reais: QA usa dado isolado, registra estado anterior e restaura/limpa a alteração local após o smoke.
- O arquivo não rastreado `achado-dados-pipeline.md` é evidência do Scott e não entra em commit.
