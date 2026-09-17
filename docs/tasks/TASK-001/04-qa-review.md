# TASK-001 — QA D2 (WIP Prospecção)

## Veredito

**APROVADO COM RESSALVA — QA 02 Gabarito, 2026-09-17. Não é PASSOU integral.**

O commit revisado é `9efce0e` contra `2c67aed`; os únicos arquivos de produto no diff são `Prospeccao.tsx`, `prospeccao-acoes.ts` e `prospeccao-acoes.test.ts`. O untracked `achado-dados-pipeline.md` foi preservado e ficou fora do escopo.

As ações locais de responsável, lista, cadência, tag e pausar foram expostas com diálogos distintos e payloads separados (`Prospeccao.tsx:151-175`, `Prospeccao.tsx:581-643`, `prospeccao-acoes.ts:9-55`). A ação Enriquecer está visível (`Prospeccao.tsx:169-172`, `prospeccao-acoes.ts:17`) mas **não foi confirmada/executada**: ação não executada por acionar Apollo e consumir crédito externo, pendente de decisão do Scott entre A e B. Sem evidência transacional. Portanto não há aprovação integral da entrega.

## Evidências obrigatórias D2

1. **Typecheck:** comando `./node_modules/.bin/tsc --noEmit --incremental false`, executado em `app/`. Resultado: **exit 0**, stdout/stderr vazios.
2. **Teste relevante:** comando `node --import tsx --env-file-if-exists=.env --test src/components/onface/vendas/prospeccao-acoes.test.ts`, executado em `app/`. Resultado: **exit 0; 5 testes, 5 pass, 0 fail**. Cobertura em `prospeccao-acoes.test.ts:8-62` para catálogo, roteamento de payload, valores vazios e isolamento entre operações.
3. **Smoke autenticado, banco local, rota viva:** `/onface-preview/prospeccao` abriu com título `ONFACE — Prospecção`, viewport desktop `1360x730` e mobile `390x843`.
   - Desktop: [print](evidence/prospeccao-desktop.png) — rota viva, filtros, lista e seleção visíveis; cópia preservada na task.
   - Desktop jornada de ação: os seis botões em massa foram confirmados no snapshot do portal após seleção; a captura original temporária expirou e não é usada como evidência preservada.
   - Mobile: [print](evidence/prospeccao-mobile.png) — viewport `390x843`, cabeçalho responsivo, filtros e lista acessíveis; cópia preservada na task.
   - Enriquecer sem Apollo: [print](evidence/prospeccao-403-sem-permissao.png) — diálogo abriu com `Enriquecer empresas · 1 empresa` e exibiu `Sem permissão` para 403 mockado; confirmação não foi executada.
   - Console capturado com `maestri portal logs "QA 02"`: **sem mensagens/erros**.

## Fluxo exercitado

- Selecionada `VendorIA_Oficial`; a barra mostrou `Atribuir responsável`, `Adicionar à lista`, `Adicionar à cadência`, `Adicionar tag`, `Enriquecer` e `Pausar cadência`.
- Aberto `Adicionar tag`: diálogo exibiu `Adicionar tag · 1 empresa`, campo obrigatório e botão inicialmente desabilitado (`Prospeccao.tsx:633-642`).
- Confirmado somente o marcador local isolado `qa-onface-t1-smoke-20260917`: UI retornou status **“Ação em massa aplicada.”**; após reload da rota o estado foi preservado durante a verificação e a lista/tag apareceu no contexto da tela.
- O marcador e a atribuição foram removidos imediatamente via endpoints locais autenticados para restaurar o banco local; verificação posterior de `/api/leads/<lead>/labels` confirmou ausência do marcador e `/api/labels` não o listou.
- Navegação de saída/retorno à rota viva foi verificada; a rota crítica voltou a renderizar com título `ONFACE — Prospecção`.
- **Enriquecer:** somente identificado/inspecionado na UI; botão de confirmação não foi clicado por risco de crédito Apollo e decisão A/B pendente. Este item bloqueia o PASSOU integral.
- **403 não-admin:** rota `app/src/api-server/routes/leads.ts:722-728` retorna HTTP 403 com `{ error: "Sem permissão" }` para papel diferente de `admin`/`super_admin`. O cliente preserva essa mensagem em `Prospeccao.tsx:103-108`, `useAcao` a coloca no `AvisoBloqueio` (`ui.tsx:261-279`) e o smoke com resposta 403 mockada, sem chamada externa, exibiu `alert "Sem permissão"` no diálogo. Tratamento específico, não erro genérico.

## Recomendação

APROVADO COM RESSALVA. CTO pode seguir somente com as cinco ações locais preservadas; Enriquecer continua bloqueado até decisão segura do Scott. Se A for escolhido, repetir somente esse item com evidência transacional; até lá, esta ressalva impede PASSOU integral. Pipeline/negocios/oportunidades permaneceram fora do escopo e nenhum código foi alterado pelo QA.

**Assinado:** Gabarito — QA Code Reviewer 02.

---

## 2026-09-17 — QA 01 Fiel · frente Malho

### Veredito

**REPROVADO.** O SQL isolado atende ao requisito de aplicar `FiltrosProspeccao.lista` antes do `ORDER BY`/`LIMIT 400`, e o teste novo passa. Porém o fluxo real da rota viva não envia esse filtro ao servidor: `app/src/app/(onface-preview)/onface-preview/prospeccao/page.tsx:17-30` não declara `lista` em `searchParams` nem o inclui na chamada de `listaProspeccao`. A UI mantém a seleção somente em estado local e filtra a página já limitada em `app/src/components/onface/vendas/Prospeccao.tsx:73,80,205-206`. Portanto o defeito original permanece no navegador para listas com membros fora dos 400 primeiros, e a seleção desaparece no reload/próxima navegação.

### Escopo e diff revisados

- Checkout: `/Users/Scott/Documents/Scott Studio/callface-crm-dev`, branch `dev`.
- `git status`: alteração de produto somente em `app/src/lib/vendas/consultas.ts` e novo `app/src/lib/vendas/consultas.test.ts`; nenhum arquivo de Pipeline/negocios/oportunidades foi tocado nesta frente.
- `app/src/lib/vendas/consultas.ts:498-505`: `EXISTS` em `lead_labels`/`labels` dentro do `WHERE`; `ORDER BY` em `:508` e `LIMIT 400` em `:509`.
- `app/src/lib/vendas/consultas.test.ts:9-62`: caso de integração read-only seleciona uma lista parcial dentro da primeira página, exige presença do lead escolhido e ausência de lead fora da lista.

### Evidências obrigatórias

1. **Typecheck:** em `app/`, `./node_modules/.bin/tsc --noEmit --incremental false` → **exit 0, stdout/stderr vazios**.
2. **Teste:** em `app/`, `node --import tsx --env-file-if-exists=.env --test src/lib/vendas/consultas.test.ts` → **exit 0; 1 teste, 1 pass, 0 fail**.
3. **Portal local, rota viva:** `http://localhost:3000/onface-preview/prospeccao`, título `ONFACE — Prospecção`.
   - Desktop `1360x729`: screenshot `/var/folders/2s/g3vcjgs17hv3fhj90qlqp7d80000gn/T/maestri-portal-300F8573-4D1C-477C-A773-6085B53CE82A.png`; lista real `Consultoria` disponível e seleção exibida na UI.
   - Mobile `390x844`: screenshot `/var/folders/2s/g3vcjgs17hv3fhj90qlqp7d80000gn/T/maestri-portal-E1EB64E6-329B-406A-874D-E0F6A86D91E9.png`; controles e lista acessíveis.
   - Após selecionar `Consultoria`, a UI exibiu somente linhas com `Consultoria` no estado local. Após navegar novamente para a mesma rota (reload), `select[aria-label="Filtrar por lista"]` voltou a `value=""` e a página voltou à lista sem filtro. A navegação para `Início` e retorno também não preserva a seleção.

### Achado bloqueante

O teste de unidade/integração chama `listaProspeccao(..., { lista: caso.lista })` diretamente, mas a rota viva chama `listaProspeccao(ctx.organizacaoId, { busca, estado, responsavelId })` sem `lista`. Logo, o GREEN prova somente o contrato da função, não a jornada exigida pela spec (`filtro real preserva resultado após reload`). A correção precisa ser assumida por Torno na integração da página/componente; Fiel não alterou código.

### Recomendação

Devolver para Torno. Encaminhar `lista` pela URL/search params, passá-la à consulta server-side e remover o filtro client-side sobre os 400 já limitados, preservando a navegação viva/espelho. Repetir teste de filtro no portal com lista real, reload e próxima navegação. **Torno pode assumir esta correção; esta frente Malho não está aprovada.** Não executei Enriquecer/Apollo.

**Assinado:** Fiel — QA Code Reviewer 01.
