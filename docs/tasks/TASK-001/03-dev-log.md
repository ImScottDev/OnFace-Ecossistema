# TASK-001 · 03-dev-log

### 2026-09-17 · CTO

- WIP de Prospecção preservado em `2c67aed` e consolidado em `9efce0e`; aguardando QA inicial.
- Spec/plano replanejados e aceitos por CTO e Esquadro, condicionados à decisão segura de QA para Enriquecer.
- Pipeline e o achado de dados foram isolados fora do escopo por decisão pendente do Scott.

### 2026-09-17 · CTO · decisão provisória do Maestro

- Maestro escolheu B para Enriquecer: não chamar Apollo nem consumir crédito externo nesta task.
- QA valida gratuitamente abertura/validação do diálogo e resposta 403 para não-admin; se o erro for genérico, devolve ao dev.
- A evidência transacional permanece pendente de decisão posterior do Scott entre A e B. A decisão é provisória, reversível e não é decisão do Scott.

### 2026-09-17 · Malho · início da frente serial 2

- Escopo ativo restrito a `app/src/lib/vendas/consultas.ts` e ao teste associado ao filtro de lista; Pipeline, rotas, componentes, `_q.ts` e o achado de Pipeline permanecem intocados.
- Diagnóstico: `listaProspeccao` recebe `filtros.lista`, mas a consulta principal não o inclui no `WHERE` e aplica `LIMIT 400` após ordenar. O teste RED usará somente leitura no banco local para escolher um lead de uma lista que esteja além das primeiras 400 linhas não filtradas; ele deve aparecer quando a lista for aplicada.

### 2026-09-17 · Malho · RED confirmado

- Adicionado `app/src/lib/vendas/consultas.test.ts`, teste de integração somente leitura. Ele escolhe uma lista parcial dentro da primeira página e exige que a página filtrada não contenha leads fora dela.
- Comando: `node --import tsx --env-file-if-exists=.env --test src/lib/vendas/consultas.test.ts` (em `app/`). Saída: exit 1; 1 teste, 0 pass, 1 fail; `AssertionError: a página limitada precisa conter somente leads da lista escolhida` em `consultas.test.ts:55`.
- Um ensaio anterior que dependia de mock experimental foi descartado por falhar no harness; não é usado como evidência RED.

### 2026-09-17 · Malho · GREEN

- Alterado somente `app/src/lib/vendas/consultas.ts`: a consulta principal de `listaProspeccao` agora aplica `filtros.lista` com `EXISTS` em `lead_labels`/`labels` no `WHERE`, antes do `ORDER BY` e do `LIMIT 400`.
- Reexecutado `node --import tsx --env-file-if-exists=.env --test src/lib/vendas/consultas.test.ts` em `app/`: exit 0; 1 teste, 1 pass, 0 fail.
- Typecheck oficial: `./node_modules/.bin/tsc --noEmit --incremental false` em `app/`; exit 0, sem stdout/stderr. Uma execução duplicada iniciada durante a espera foi encerrada; a execução oficial única concluiu normalmente.

### 2026-09-17 · Malho · QA Fiel e bloqueio de integração

- Fiel revisou o diff, repetiu o teste relevante (exit 0; 1 pass) e confirmou a rota viva `/onface-preview/prospeccao` em desktop e mobile sem executar Enriquecer/Apollo.
- O SQL e o contrato direto de `listaProspeccao(..., { lista })` passaram, mas a rota viva ainda chama a consulta sem `lista` e a seleção de lista é local: após reload/navegação o filtro não persiste. Assim, não há aceite da jornada da spec nesta frente.
- Correção necessária é encaminhar `lista` pelos search params/rota e remover o filtro cliente sobre a página truncada. Isso toca rota/componente, que são explicitamente fora da propriedade de Malho; nenhum desses arquivos foi alterado.

### 2026-09-17 · Torno · correção da integração de lista

- Diagnóstico confirmado nas duas superfícies: as páginas viva e espelho não declaravam nem encaminhavam `searchParams.lista` para `listaProspeccao`; `Prospeccao.tsx` iniciava a lista em estado local e filtrava `dados.linhas` depois do `LIMIT 400`.
- RED: adicionado `app/src/components/onface/vendas/prospeccao-filtro.test.ts`. Comando `node --import tsx --env-file-if-exists=.env --test src/components/onface/vendas/prospeccao-filtro.test.ts` em `app/` falhou como esperado: `montarUrlProspeccao` era `undefined`.
- GREEN: páginas `onface-preview/prospeccao` e `onface-desenho/prospeccao` normalizam `lista` com `trim`, passam o filtro à consulta e ao componente. O select usa `filtro.lista`, navega pela URL e limpa os selecionados antes da troca. Removido o filtro client-side sobre as linhas já limitadas. A composição da URL foi extraída para `prospeccao-acoes.ts`, sem tocar `consultas.ts` além do WIP de Malho, Pipeline, Apollo ou imports circulares.
- Testes: `node --import tsx --env-file-if-exists=.env --test src/components/onface/vendas/prospeccao-filtro.test.ts src/components/onface/vendas/prospeccao-acoes.test.ts src/lib/vendas/consultas.test.ts` em `app/`: exit 0; 7 pass, 0 fail.
- Smoke autenticado local: rota viva e espelho com `?lista=Consultoria` preservaram a URL e o select após reload e após navegar a `/inicio` e retornar. Em ambas, 55 linhas renderizadas eram membros de `Consultoria`; ao selecionar uma linha na viva e trocar para `Outbound`, a seleção em massa foi limpa (`0` checkboxes e barra ausente). Desktop e mobile preservados em `evidence/prospeccao-lista-viva-desktop.png`, `evidence/prospeccao-lista-viva-mobile.png`, `evidence/prospeccao-lista-espelho-desktop.png` e `evidence/prospeccao-lista-espelho-mobile.png`. Console do portal sem mensagens. Enriquecer/Apollo não foi aberto nem executado.
- Pendente antes de liberar Vitral: typecheck fresco ainda precisa de saída/código de término. O comando oficial excede o limite de 30s do terminal desta role e foi interrompido sem saída; não inferir sucesso. Solicitar execução/revisão independente ao Gabarito.

### 2026-09-17 · Gabarito · QA da correção Torno

- **APROVADO** para a correção de integração do filtro de lista. Revisados somente os arquivos declarados de Torno; `consultas.ts` continua WIP de Malho e não foi avaliado nesta aprovação.
- Typecheck fresco em `app/`: `./node_modules/.bin/tsc --noEmit --incremental false`, exit 0, stdout/stderr vazios (concluiu após mais de 30s). Teste fresco: `node --import tsx --env-file-if-exists=.env --test src/components/onface/vendas/prospeccao-filtro.test.ts src/components/onface/vendas/prospeccao-acoes.test.ts`, exit 0; 6 pass, 0 fail. `git diff --check` limpo.
- QA confirmou viva e espelho com `searchParams.lista` normalizado e encaminhado à consulta/componente, ausência do refiltro client-side pós-`LIMIT`, preservação dos demais parâmetros e limpeza da seleção. Evidências desktop/mobile e smoke de URL/reload/navegação preservados em `evidence/`. Enriquecer/Apollo não executado e fora do parecer.
