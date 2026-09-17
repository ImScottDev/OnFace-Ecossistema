# TASK-001 · 02-plano-execucao

## Diretório

`/Users/Scott/Documents/Scott Studio/callface-crm-dev` — branch `dev`, checkout único.

## Pré-condições de liberação

1. Gabarito aprova o WIP de `9efce0e` com D2 completo.
2. Decisão provisória B do Maestro registrada: não executar Enriquecer contra Apollo; validar diálogo e 403 não-admin, mantendo ressalva transacional pendente do Scott.
3. CTO e Esquadro assinam consenso deste plano.

## Execução serial

| Ordem | Responsável | Arquivos permitidos | Entrega e validação |
|---|---|---|---|
| 1 | Gabarito | nenhum código; `04-qa-review.md` | QA D2 do WIP |
| 2 | Malho | `app/src/lib/vendas/consultas.ts` e teste mínimo associado | filtro `lista` antes do LIMIT; teste RED/GREEN e saída |
| 3 | Torno | `components/onface/vendas/pagina.tsx`, `PreVendas.tsx`, e as páginas viva+espelho de `/pre-vendas` que passam `rotaBase` | CTA do espelho não salta à viva; mata `?lead=`; sem refatorar import circular |
| 4 | Vitral | somente após Torno liberar `pagina.tsx`: `consultas.ts` necessário a WhatsApp, `Contatos.tsx`, `pagina.tsx`, páginas de Pessoas viva+espelho | Responsável, WhatsApp, E-mail e detalhe espelho |
| 5 | CTO | `app/src/scripts/_q.ts` | commit de higiene; não tocar `achado-dados-pipeline.md` |
| 6 | Gabarito | nenhum código; `04-qa-review.md` | QA final pela matriz e D2 |

## Proibições

- Não tocar Pipeline, `negocios`, `oportunidades`, `service_family` ou `docs/tasks/TASK-001/achado-dados-pipeline.md`.
- Não executar Enriquecer contra Apollo; a decisão provisória B dispensa essa execução e preserva a pendência transacional para o Scott.
- Nenhum segundo agente edita o checkout enquanto a frente serial ativa estiver em curso.

## Ajuste QA Malho → Torno

- Incluir `lista` normalizada nos `searchParams` das páginas viva e espelho de Prospecção, passá-la a `listaProspeccao` e ao componente.
- Select inicia no filtro, navega pela URL, remove filtro client-side truncado e limpa selecionados ao trocar lista.
- TDD: manter teste SQL e acrescentar teste da passagem URL→servidor; smoke nas duas superfícies, desktop/mobile, URL, somente membros, reload e sair/voltar.
